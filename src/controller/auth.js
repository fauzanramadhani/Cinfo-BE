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
      return res.status(200).json({
        status: "success",
        message: "User already exist",
        data: {
          user_id: isExist._id.toString(),
        },
      });
    }
    const lastAccount = await accountMongoCollection.findOne(
      {},
      { sort: { createdAt: -1 } }
    );
    var clientOffset = 1;
    if (lastAccount) {
      clientOffset = lastAccount.client_offset + 1 || clientOffset;
    }
    await accountMongoCollection.insertOne({
      email: email,
      client_offset: clientOffset,
      created_at: date,
    });
    const user = await accountMongoCollection.findOne({
      email: email,
    });
    return res.status(200).json({
      status: "success",
      message: "User created successfully",
      data: {
        user_id: user._id.toString(),
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

const checkAuth = async (req, res, next) => {
  try {
    const { authorization } = req.headers;

    if (!authorization) {
      return res.status(400).json({ 
        status: "error",
        message: "You must be logged in"
       });
    }

    const user_id = authorization.replace("Bearer ", "");

    if (!isValidHex(user_id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid user id",
      });
    }

    const userObjectId = new ObjectId(room_id);

    const user = await accountMongoCollection.findOne({
      _id: userObjectId
    })

    if (!user) {
      return res.status(400).json({ 
        status: "error",
        message: "User not found"
       });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({ 
      message: error.message 
    });
  }
};

module.exports = { register, checkAuth };
