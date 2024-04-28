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

    const roomObjectId = new ObjectId(room_id);
    const room = await roomMongoCollection.findOne({
      _id: roomObjectId,
    });

    if (!room) {
      return res.status(400).json({
        status: "error",
        message: "Room is not exist",
      });
    }

    const member = await accountMongoCollection.findOne({
      email: email,
    });

    if (!member) {
      return res.status(400).json({
        status: "error",
        message: "User is not exist",
      });
    }
    if (member.room_id == room_id) {
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
        _id: roomObjectId,
      },
      {
        $push: {
          user_id: member._id.toString(),
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

const getAllMember = async (req, res) => {
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

    return res.status(200).json({
      status: "success",
      message: "Successfully fetch all member email",
      data: members,
    });
  } catch (error) {
    console.log(error.message.toString());
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

const deleteMember = async (req, res) => {
  try {
    const room_id = req.params.room_id;
    const member_id = req.body.member_id;

    if (!isValidHex(member_id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid member id",
      });
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
      return res.status(400).json({
        status: "error",
        message: "Member not found in this room",
      });
    }

    if (!isValidHex(room_id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid room id",
      });
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
      return res.status(400).json({
        status: "error",
        message: "Room is not exist",
      });
    }

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

module.exports = { addMember, getAllMember, deleteMember };
