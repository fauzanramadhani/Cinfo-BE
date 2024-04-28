const express = require("express");
const { join } = require("node:path");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const { availableParallelism } = require("node:os");
const cluster = require("node:cluster");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const { ObjectId } = require("mongodb");
const mongoClient = require("./config/mongo");
require("dotenv").config();
const initDb = process.env.MONGO_INITDB_DATABASE;
const defaultCollection = process.env.MONGO_DEFAULT_COLLECTiON;
const roomCollection = process.env.MONGO_ROOM_COLLECTION;
const postCollection = process.env.POST_ROOM_COLLECTION;
const accountCollection = process.env.ACCOUNT_ROOM_COLLECTION;
const cors = require("cors");
const bodyParser = require("body-parser");
const { register, checkAuth } = require("./controller/auth");
const { getRoomId } = require("./controller/room");
const { isValidHex } = require("./utils/isValidHex");

if (cluster.isPrimary) {
  const numCPUs = availableParallelism();
  // create one worker per available core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork({
      PORT: 3000 + i,
    });
  }

  // set up the adapter on the primary thread
  return setupPrimary();
}

async function main() {
  await mongoClient.connect();

  const defaultMongoCollection = mongoClient
    .db(initDb)
    .collection(defaultCollection);
  await defaultMongoCollection.createIndex(
    { client_offset: 1 },
    { unique: true }
  );
  const roomMongoCollection = mongoClient.db(initDb).collection(roomCollection);
  await roomMongoCollection.createIndex({ client_offset: 1 }, { unique: true });
  const postMongoCollection = mongoClient.db(initDb).collection(postCollection);
  await postMongoCollection.createIndex({ client_offset: 1 }, { unique: true });
  const accountMongoCollection = mongoClient
    .db(initDb)
    .collection(accountCollection);
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {},
    // set up the adapter on each worker thread
    adapter: createAdapter(defaultMongoCollection),
  });

  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "index.html"));
  });

  app.post("/register", register);
  app.get("/get-room-id", checkAuth, getRoomId);
  // app.post("/:room_id/add-member", addMember);
  // app.get("/:room_id/get-member", getAllMember);
  // app.post(":room_id/delete-member", deleteMember);

  io.on("connection", async (socket) => {
    console.log("connected");
    socket.on("disconnect", () => {
      console.log("user disconnected");
    });

    // room

    socket.on("createRoom", async (msg, callback) => {
      try {
        // Mengakses properti dari objek JSON `msg`
        const msgJson = JSON.parse(msg);
        const room_name = msgJson.room_name;
        const additional = msgJson.additional;
        const date = new Date().getTime();
        const lastRoom = await roomMongoCollection.findOne(
          {},
          { sort: { createdAt: -1 } }
        );
        var roomOffset = 1;
        if (lastRoom) {
          roomOffset = lastRoom.client_offset + 1 || roomOffset;
        }
        const result = await roomMongoCollection.insertOne({
          room_name: room_name,
          additional: additional,
          client_offset: roomOffset,
          createdAt: date,
        });
        // socket.join(result.insertedId);
        const insertedRoom = await roomMongoCollection.findOne({
          _id: result.insertedId,
        });
        io.emit("room", insertedRoom);
        callback({
          status: "ok",
        });
      } catch (error) {
        callback({
          status: "error",
          message: error.message,
        });
        console.log(error.message.toString());
      }
    });

    socket.on("editRoom", async (room, callback) => {
      try {
        const roomJson = JSON.parse(room);
        if (!isValidHex(roomJson.room_id)) {
          callback({ status: "error", message: "Invalid room id" });
          return;
        }
        const filter = { _id: new ObjectId(roomJson.room_id) };
        const update = {
          room_name: roomJson.room_name,
          additional: roomJson.additional,
        };

        const updatedRoom = await roomMongoCollection.findOneAndUpdate(
          filter,
          { $set: update },
          { returnDocument: "after" }
        );
        if (!updatedRoom) {
          callback({ status: "error", message: "Room not found" });
          return;
        }
        io.emit("room", updatedRoom);
        callback({ status: "ok" });
      } catch (error) {
        console.log(error.message.toString());
        callback({ status: "error", message: error.message });
      }
    });

    socket.on("deleteRoom", async (req, callback) => {
      try {
        const reqJson = JSON.parse(req);
        const { room_id } = reqJson;
        if (!isValidHex(room_id)) {
          callback({ status: "error", message: "Invalid room id" });
          return;
        }
        const roomObjectId = new ObjectId(room_id);
        const isRoomExist = await roomMongoCollection.findOne({
          _id: roomObjectId,
        });
        if (!isRoomExist) {
          callback({ status: "error", message: "Room not found" });
          return;
        }
        await roomMongoCollection.deleteOne({
          _id: roomObjectId,
        });
        await postMongoCollection.deleteMany({
          room_id: room_id,
        });
        const members = await accountMongoCollection
          .find({
            room_id: room_id,
          })
          .toArray();
        await accountMongoCollection.updateMany(
          {
            room_id: room_id,
          },
          { $unset: { room_id: "" } }
        );
        if (members) {
          members.forEach((member) => {
            io.emit(`${member._id.toString()}-on-room-update`, member.room_id);
          });
        }
        io.emit(`onDeleteRoom`, room_id);
        callback({ status: "ok" });
      } catch (error) {
        console.log(error.message.toString());
        callback({ status: "error", message: error.message });
      }
    });

    // member

    socket.on("addMember", async (req, callback) => {
      try {
        const reqJson = JSON.parse(req);
        const { email, room_id } = reqJson;
        if (!isValidHex(room_id)) {
          callback({ status: "error", message: "Invalid room id" });
          return;
        }

        const roomObjectId = new ObjectId(room_id);
        const room = await roomMongoCollection.findOne({
          _id: roomObjectId,
        });
        socket;

        if (!room) {
          callback({ status: "error", message: "Invalid room id" });
          return;
        }

        const member = await accountMongoCollection.findOne({
          email: email,
        });

        if (!member) {
          callback({ status: "error", message: "User is not exist" });
          return;
        }
        if (member.room_id == room_id) {
          callback({ status: "error", message: "User already in this room" });
          return;
        }
        const updatedMember = await accountMongoCollection.findOneAndUpdate(
          {
            email: email,
          },
          {
            $set: {
              room_id: room_id,
            },
          },
          { returnDocument: "after" }
        );

        await roomMongoCollection.findOneAndUpdate(
          {
            _id: roomObjectId,
          },
          {
            $push: {
              user_id: member._id.toString(),
            },
          },
          { returnDocument: "after" }
        );
        io.emit(`${room_id}-member`, updatedMember);
        io.emit(
          `${updatedMember._id.toString()}-on-room-update`,
          updatedMember.room_id
        );
        callback({ status: "ok" });
      } catch (error) {
        console.log(error.message.toString());
        callback({ status: "error", message: error.message });
      }
    });

    socket.on("deleteMember", async (req, callback) => {
      try {
        const reqJson = JSON.parse(req);
        const { room_id, member_id } = reqJson;
        if (!isValidHex(member_id)) {
          callback({ status: "error", message: "Invalid member id" });
        }
        const memberObjectId = new ObjectId(member_id);

        const member = await accountMongoCollection.findOneAndUpdate(
          {
            _id: memberObjectId,
            room_id: room_id,
          },
          { $unset: { room_id: "" } },
          { returnDocument: "after" }
        );

        if (!member) {
          callback({
            status: "error",
            message: "Member not found in this room",
          });
          return;
        }

        if (!isValidHex(room_id)) {
          callback({
            status: "error",
            message: "Invalid room id",
          });
          return;
        }

        const roomObjectId = new ObjectId(room_id);

        const updatedRoom = await roomMongoCollection.findOneAndUpdate(
          {
            _id: roomObjectId,
          },
          {
            $pull: {
              user_id: member._id.toString(),
            },
          },
          { returnDocument: "after" }
        );

        if (!updatedRoom) {
          callback({
            status: "error",
            message: "Room is not exist",
          });
          return;
        }
        io.emit(`${room_id}-on-delete-member`, member._id.toString());
        io.emit(`${member._id.toString()}-on-room-update`, member.room_id);
        callback({ status: "ok" });
      } catch (error) {
        console.log(error.message.toString());
        callback({ status: "error", message: error.message });
      }
    });

    // post

    socket.on("createPost", async (req, callback) => {
      try {
        const reqJson = JSON.parse(req);
        const { room_id, title, description } = reqJson;
        if (!isValidHex(room_id)) {
          callback({ status: "error", message: "Invalid room id" });
          return;
        }
        const roomObjectId = new ObjectId(room_id);
        const isRoomExist = await roomMongoCollection.findOne({
          _id: roomObjectId,
        });
        if (!isRoomExist) {
          callback({ status: "error", message: "Room not found" });
          return;
        }
        const lastPost = await postMongoCollection.findOne(
          {},
          { sort: { createdAt: -1 } }
        );
        var lastPostOffset = 1;
        if (lastPost) {
          lastPostOffset = lastPost.client_offset + 1 || lastPostOffset;
        }
        const date = new Date().getTime();
        const post = await postMongoCollection.insertOne({
          room_id: room_id,
          title: title,
          description: description,
          client_offset: lastPostOffset,
          createdAt: date,
        });
        const insertedPost = await postMongoCollection.findOne({
          _id: post.insertedId,
        });
        await roomMongoCollection.findOneAndUpdate(
          {
            _id: roomObjectId,
          },
          {
            $push: {
              post_id: post.insertedId.toString(),
            },
          },
          { returnDocument: "after" }
        );
        io.emit(room_id, insertedPost);
        callback({ status: "ok" });
      } catch (error) {
        console.log(error.message.toString());
        callback({ status: "error", message: error.message });
      }
    });

    socket.on("editPost", async (req, callback) => {
      const reqJson = JSON.parse(req);
      const { room_id, post_id, title, description } = reqJson;
      if (!isValidHex(room_id)) {
        callback({ status: "error", message: "Invalid room id" });
        return;
      }
      const roomObjectId = new ObjectId(room_id);
      const isRoomExist = await roomMongoCollection.findOne({
        _id: roomObjectId,
      });
      if (!isRoomExist) {
        callback({ status: "error", message: "Room not found" });
        return;
      }
      if (!isValidHex(post_id)) {
        callback({ status: "error", message: "Invalid post id" });
        return;
      }
      const postObjectId = new ObjectId(post_id);
      const updatedPost = await postMongoCollection.findOneAndUpdate(
        {
          _id: postObjectId,
        },
        {
          $set: {
            title: title,
            description: description,
          },
        },
        { returnDocument: "after" }
      );
      if (!updatedPost) {
        callback({ status: "error", message: "Post not found" });
        return;
      }
      io.emit(room_id, updatedPost);
      callback({ status: "ok" });
    });

    socket.on("deletePost", async (req, callback) => {});

    socket.on("chat message", async (msg, clientOffset, callback) => {
      try {
        const result = await defaultMongoCollection.insertOne({
          content: msg,
          client_offset: clientOffset,
        });
        io.emit("chat message", msg, result.insertedId);
        callback();
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error code
          // Notify the client that the message was already inserted
          callback("Message already exists");
        } else {
          console.error("Error inserting message into MongoDB:", error);
        }
      }
    });

    if (!socket.recovered) {
      // if the connection state recovery was not successful
      try {
        const roomOffset = parseInt(socket.handshake.auth.roomOffset) || 0;
        const postOffset = parseInt(socket.handshake.auth.postOffset) || 0;
        const memberOffset = parseInt(socket.handshake.auth.memberOffset) || 0;

        const rooms = await roomMongoCollection
          .find({ client_offset: { $gt: roomOffset } })
          .toArray();
        rooms.forEach(async (room) => {
          socket.emit("room", room);

          const members = await accountMongoCollection
            .find({
              room_id: room._id.toString(),
              client_offset: { $gt: memberOffset },
            })
            .toArray();

          if (members) {
            members.forEach((member) => {
              io.emit(`${room._id.toString()}-member`, member);
            });
          }

          const posts = await postMongoCollection
            .find({
              room_id: room._id.toString(),
              client_offset: { $gt: postOffset },
            })
            .toArray();

          if (posts) {
            posts.forEach((post) => {
              io.emit(`${room._id.toString()}-post`, post);
            });
          }
        });

        // Mark socket as recovered
        socket.recovered = true;
      } catch (error) {
        console.error("Error recovering chat state from MongoDB:", error);
      }
    }
  });

  const port = process.env.PORT;

  server.listen(port, () => {
    console.log(`server running at http://localhost:${port}`);
  });
}

main();
