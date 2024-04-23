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
const cors = require("cors");
const bodyParser = require("body-parser");
const { register } = require("./controller/auth");
const {
  addMember,
  getAllMemberEmail,
  kickMemberByEmail,
} = require("./controller/room");
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
  app.post("/:room_id/add-member", addMember);
  app.get("/:room_id/get-all-member-email", getAllMemberEmail);
  app.post("/:room_id/kick-member-by-email", kickMemberByEmail);

  io.on("connection", async (socket) => {
    console.log("connected");
    socket.on("disconnect", () => {
      console.log("user disconnected");
    });

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
        io.emit("room", JSON.stringify(insertedRoom));
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

    // Event untuk mengedit data ruangan
    socket.on("editRoom", async (room, callback) => {
      try {
        const roomJson = JSON.parse(room);
        if (!isValidHex(roomJson._id)) {
          callback({ status: "error", message: "Invalid room id" });
          return;
        }
        const filter = { _id: new ObjectId(roomJson._id) };
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
        io.emit(room_id, JSON.stringify(insertedPost));
        callback({ status: "ok" });
      } catch (error) {
        console.log(error.message.toString());
        callback({ status: "error", message: error.message });
      }
    });

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

        const rooms = await roomMongoCollection
          .find({ client_offset: { $gt: roomOffset } })
          .toArray();
        rooms.forEach(async (room) => {
          const roomJson = JSON.stringify(room);
          socket.emit("room", roomJson);
          const posts = await postMongoCollection
            .find({
              room_id: room._id.toString(),
              client_offset: { $gt: postOffset },
            })
            .toArray();
          console.log(room._id.toString());
          if (posts) {
            posts.forEach((post) => {
              socket.emit(room._id.toString(), JSON.stringify(post));
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
