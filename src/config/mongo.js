require("dotenv").config();
const { MongoClient } = require("mongodb");
const initDb = process.env.MONGO_INITDB_DATABASE;
const mongoUsername = process.env.MONGO_INITDB_ROOT_USERNAME;
const mongoPassword = process.env.MONGO_INITDB_ROOT_PASSWORD;

const mongoClient = new MongoClient(
  `mongodb://${mongoUsername}:${mongoPassword}@mongodb:27017/${initDb}?authSource=admin`
);

module.exports = mongoClient;
