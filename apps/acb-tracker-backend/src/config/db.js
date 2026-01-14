const mongoose = require("mongoose");

const connectDb = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/acb_tracker";
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
};

module.exports = { connectDb };
