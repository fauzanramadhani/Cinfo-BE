const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
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

    socket.on("room", async (msg, callback) => {
      try {
        // Mengakses properti dari objek JSON `msg`
        const msgJson = JSON.parse(msg);
        const room_name = msgJson.room_name;
        const additional = msgJson.additional;
        const client_offset = msgJson.client_offset;
        const date = new Date().getTime();
        const result = await roomMongoCollection.insertOne({
          room_name: room_name,
          additional: additional,
          client_offset: client_offset,
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
        console.log(updatedRoom);
        io.emit("room", updatedRoom);
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
        const serverOffset =
          socket.handshake.auth.serverOffset || "000000000000000000000000";

        const rooms = await roomMongoCollection
          .find({ client_offset: { $gt: serverOffset } })
          .toArray();

        rooms.forEach((room) => {
          socket.emit("room", JSON.stringify(room));
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
