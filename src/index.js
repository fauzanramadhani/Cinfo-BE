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
const postGlobalCollection = process.env.POST_GLOBAL_COLLECTION;
const cors = require("cors");
const bodyParser = require("body-parser");
const { register, checkAuth } = require("./controller/auth");
const { isValidHex } = require("./utils/isValidHex");
const randomNumberUntilThree = require("./utils/randomNumberUntilThree");

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

  const postGlobalMongoCollection = mongoClient
    .db(initDb)
    .collection(postGlobalCollection);
  await postGlobalMongoCollection.createIndex(
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
    // connectionStateRecovery: {},
    // set up the adapter on each worker thread
    adapter: createAdapter(
      postGlobalMongoCollection,
      roomMongoCollection,
      postMongoCollection,
      accountMongoCollection
    ),
  });

  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.get("/", (req, res) => {
    // res.sendFile(join(__dirname, "index.html"));
    return res.status(200).json({
      status: "success",
      message: "Server is running...",
    });
  });

  app.post("/register", register);

  io.on("connection", async (socket) => {
    console.log("connected");
    socket.on("disconnect", () => {
      console.log("user disconnected");
    });

    // Global Post

    socket.on("createPostGlobal", async (req, callback) => {
      try {
        const reqJson = JSON.parse(req);
        const { title, description } = reqJson;
        const date = new Date().getTime();

        const lastPost = await postGlobalMongoCollection.findOne(
          {},
          { sort: { created_at: -1 } }
        );
        var lastPostOffset = 1;
        if (lastPost) {
          lastPostOffset = lastPost.client_offset + 1 || lastPostOffset;
        }

        const post = await postGlobalMongoCollection.insertOne({
          title: title,
          description: description,
          client_offset: lastPostOffset,
          created_at: date,
        });
        const insertedPost = await postGlobalMongoCollection.findOne({
          _id: post.insertedId,
        });
        io.emit("postGlobal", insertedPost);
        callback({ status: "ok" });
      } catch (error) {
        callback({
          status: "error",
          message: error.message,
        });
        console.log(error.message.toString());
      }
    });

    socket.on("editPostGlobal", async (req, callback) => {
      try {
        const reqJson = JSON.parse(req);
        const { post_id, title, description } = reqJson;
        if (!isValidHex(post_id)) {
          callback({ status: "error", message: "Invalid global post id" });
          return;
        }
        const postGlobalObjectId = new ObjectId(post_id);
        const updatedPostGlobal =
          await postGlobalMongoCollection.findOneAndUpdate(
            {
              _id: postGlobalObjectId,
            },
            {
              $set: {
                title: title,
                description: description,
              },
            },
            { returnDocument: "after" }
          );

        if (!updatedPostGlobal) {
          callback({ status: "error", message: "Global post not found" });
          return;
        }
        io.emit("postGlobal", updatedPostGlobal);
        callback({ status: "ok" });
      } catch (error) {
        callback({
          status: "error",
          message: error.message,
        });
        console.log(error.message.toString());
      }
    });

    socket.on("deletePostGlobal", async (req, callback) => {
      try {
        const reqJson = JSON.parse(req);
        const { post_id } = reqJson;
        if (!isValidHex(post_id)) {
          callback({ status: "error", message: "Invalid global post id" });
          return;
        }
        const postGlobalObjectId = new ObjectId(post_id);
        const deletedpostGlobal =
          await postGlobalMongoCollection.findOneAndDelete({
            _id: postGlobalObjectId,
          });
        if (!deletedpostGlobal) {
          callback({ status: "error", message: "Global post not found" });
          return;
        }
        io.emit("onDeletedPostGlobal", post_id);
        callback({ status: "ok" });
      } catch (error) {
        callback({
          status: "error",
          message: error.message,
        });
        console.log(error.message.toString());
      }
    });

    // room

    socket.on("createRoom", async (msg, callback) => {
      try {
        // Mengakses properti dari objek JSON `msg`
        const msgJson = JSON.parse(msg);
        const room_name = msgJson.room_name;
        const additional = msgJson.additional;
        const date = new Date().getTime();
        const backgroundId = randomNumberUntilThree();
        const lastRoom = await roomMongoCollection.findOne(
          {},
          { sort: { created_at: -1 } }
        );
        var roomOffset = 1;
        if (lastRoom) {
          roomOffset = lastRoom.client_offset + 1 || roomOffset;
        }
        const result = await roomMongoCollection.insertOne({
          room_name: room_name,
          additional: additional,
          background_id: backgroundId,
          client_offset: roomOffset,
          created_at: date,
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
            io.emit(`${member._id.toString()}-on-room-update`, "");
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
        console.log(email)
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
          room
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
        io.emit(`${member._id.toString()}-on-room-update`, "");
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
          { sort: { created_at: -1 } }
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
          created_at: date,
        });
        const insertedPost = await postMongoCollection.findOne({
          _id: post.insertedId,
        });
        io.emit(`${room_id}-post`, insertedPost);
        callback({ status: "ok" });
      } catch (error) {
        console.log(error.message.toString());
        callback({ status: "error", message: error.message });
      }
    });

    socket.on("editPost", async (req, callback) => {
      const reqJson = JSON.parse(req);
      const { post_id, title, description } = reqJson;

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
      io.emit(`${updatedPost.room_id}-post`, updatedPost);
      callback({ status: "ok" });
    });

    socket.on("deletePost", async (req, callback) => {
      const reqJson = JSON.parse(req);
      const { post_id } = reqJson;
      if (!isValidHex(post_id)) {
        callback({ status: "error", message: "Invalid post id" });
        return;
      }
      const postObjectId = new ObjectId(post_id);
      const post = await postMongoCollection.findOne({
        _id: postObjectId,
      });
      if (!post) {
        callback({ status: "error", message: "Post not found" });
        return;
      }
      await postMongoCollection.deleteOne({
        _id: postObjectId,
      });
      const updatedRoom = await roomMongoCollection.findOne({
        _id: new ObjectId(post.room_id),
      });
      io.emit(`${updatedRoom._id.toString()}-on-delete-post`, post_id);
      callback({ status: "ok" });
    });

    socket.on("chat message", async (msg, callback) => {
      try {
        const date = new Date().getTime();
        let clientOffset = 0;
        const lastMessage = await defaultMongoCollection.findOne(
          {},
          { sort: { created_at: -1 } }
        );
        if (lastMessage) {
          clientOffset = lastMessage.client_offset + 1;
        }
        await defaultMongoCollection.insertOne({
          content: msg,
          client_offset: clientOffset,
          created_at: date,
        });
        io.emit("chat message", msg, clientOffset);
        callback({ status: "ok" });
      } catch (error) {
        console.error(error.message);
        if (error.code === 11000) {
          // Duplicate key error code
          // Notify the client that the message was already inserted
          callback("Message already exists");
        } else {
          callback("Error inserting message into MongoDB:");
        }
      }
    });

    if (!socket.recovered) {
      // if the connection state recovery was not successful
      try {
        const messageOffset = parseInt(socket.handshake.auth.serverOffset) || 0;
        const postGlobalOffset =
          parseInt(socket.handshake.auth.postGlobalOffset) || 0;
        const roomOffset = parseInt(socket.handshake.auth.roomOffset) || 0;
        const postOffset = parseInt(socket.handshake.auth.postOffset) || 0;
        const memberOffset = parseInt(socket.handshake.auth.memberOffset) || 0;

        const members = await accountMongoCollection
        .find()
        .toArray();

        members.forEach(async (member) => {
          if (member.room_id) {
            const roomObjectId = new ObjectId(member.room_id);
            const memberRoom = await roomMongoCollection
            .findOne(
              {
                _id: roomObjectId
              }
            )
            socket.emit(`${member._id.toString()}-on-room-update`, memberRoom);
          } else {
            socket.emit(`${member._id.toString()}-on-room-update`, "");
          }
          
        });

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
              socket.emit(`${room._id.toString()}-member`, member);
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
              socket.emit(`${room._id.toString()}-post`, post);
            });
          }
        });

        const postGlobal = await postGlobalMongoCollection
          .find({ client_offset: { $gt: postGlobalOffset } })
          .toArray();

        postGlobal.forEach((post) => {
          socket.emit("postGlobal", post);
        });

        const cursor = await defaultMongoCollection
          .find({
            client_offset: { $gt: messageOffset },
          })
          .toArray();
        cursor.forEach((doc) => {
          socket.emit("chat message", doc.content, doc._id);
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
