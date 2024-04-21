require("dotenv").config();
const accountCollection = process.env.ACCOUNT_ROOM_COLLECTION;
const roomCollection = process.env.MONGO_ROOM_COLLECTION;
const initDb = process.env.MONGO_INITDB_DATABASE;
const mongoClient = require("../config/mongo");
const accountMongoCollection = mongoClient
  .db(initDb)
  .collection(accountCollection);
const roomMongoCollection = mongoClient.db(initDb).collection(roomCollection);
const { ObjectId } = require("mongodb");
const { isValidHex } = require("../utils/isValidHex");

const addMember = async (req, res) => {
  try {
    const email = req.body.email;
    const room_id = req.params.room_id;
    if (!isValidHex(room_id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid room id",
      });
    }
    const room_object_id = new ObjectId(room_id);
    const room = await roomMongoCollection.findOne({
      _id: room_object_id,
    });
    const user = await accountMongoCollection.findOne({
      email: email,
    });
    if (!room) {
      return res.status(400).json({
        status: "error",
        message: "Room is not exist",
      });
    }
    if (!user) {
      return res.status(400).json({
        status: "error",
        message: "User is not exist",
      });
    }
    if (user.room_id == room_id) {
      return res.status(400).json({
        status: "error",
        message: "User already in this room",
      });
    }
    await accountMongoCollection.findOneAndUpdate(
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
        _id: room_object_id,
      },
      {
        $push: {
          user_id: user._id.toString(),
        },
      },
      { returnDocument: "after" }
    );
    return res.status(200).json({
      status: "success",
      message: "User added to room",
    });
  } catch (error) {
    console.log(error.message.toString());
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

const getAllMemberEmail = async (req, res) => {
  try {
    const room_id = req.params.room_id;
    if (!isValidHex(room_id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid room id",
      });
    }

    const room_object_id = new ObjectId(room_id);
    const room = await roomMongoCollection.findOne({
      _id: room_object_id,
    });

    if (!room) {
      return res.status(400).json({
        status: "error",
        message: "Room is not exist",
      });
    }

    const members = await accountMongoCollection
      .find({
        room_id: room_id,
      })
      .toArray();

    const emails = members.map((member) => member.email);

    return res.status(200).json({
      status: "success",
      message: "Successfully fetch all member email",
      data: emails,
    });
  } catch (error) {
    console.log(error.message.toString());
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

const kickMemberByEmail = async (req, res) => {
  try {
    const room_id = req.params.room_id;
    const email = req.body.email;

    if (!isValidHex(room_id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid room id",
      });
    }

    const room_object_id = new ObjectId(room_id);

    const room = await roomMongoCollection.findOne({
      _id: room_object_id,
    });

    if (!room) {
      return res.status(400).json({
        status: "error",
        message: "Room is not exist",
      });
    }

    const member = await accountMongoCollection.findOneAndUpdate(
      {
        email: email,
        room_id: room_id,
      },
      { $unset: { room_id: "" } },
      { returnDocument: "after" }
    );

    if (!member) {
      return res.status(400).json({
        status: "error",
        message: "Member not found in this room",
      });
    }

    await roomMongoCollection.findOneAndUpdate(
      {
        _id: room_object_id,
      },
      {
        $pull: {
          user_id: member._id.toString(),
        },
      },
      { returnDocument: "after" }
    );

    return res.status(200).json({
      status: "success",
      message: "Member kicked from the room",
    });
  } catch (error) {
    console.log(error.message.toString());
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

// TODO get my room id by user id at auth

module.exports = { addMember, getAllMemberEmail, kickMemberByEmail };
