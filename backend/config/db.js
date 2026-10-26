const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.log("ℹ️ MONGO_URI not configured. Operating in local-first AI gateway mode (cloud ready).");
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected successfully");
  } catch (error) {
    console.warn("⚠️ Database Connection Warning:", error.message);
    console.warn("Operating in fallback mode — app and AI gateway will remain functional.");
  }
};

module.exports = connectDB;
