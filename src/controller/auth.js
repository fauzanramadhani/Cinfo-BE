require("dotenv").config();
const accountCollection = process.env.ACCOUNT_ROOM_COLLECTION;
const initDb = process.env.MONGO_INITDB_DATABASE;
const mongoClient = require("../config/mongo");
const accountMongoCollection = mongoClient
  .db(initDb)
  .collection(accountCollection);

const register = async (req, res) => {
  try {
    const email = req.body.email;
    const date = new Date().getTime();
    const isExist = await accountMongoCollection.findOne({
      email: email,
    });
    if (isExist) {
      return res.status(400).json({
        status: "error",
        message: "User already exist",
      });
    }
    await accountMongoCollection.insertOne({
      email: email,
      createdAt: date,
    });
    const user = await accountMongoCollection.findOne({
      email: email,
    });
    return res.status(200).json({
      status: "success",
      message: "User created successfully",
      data: {
        email: user._id.toString(),
      },
    });
  } catch (error) {
    console.log(error.message.toString());
    return res.status(400).json({
      status: "error",
      message: error.message,
    });
  }
};

module.exports = { register };
