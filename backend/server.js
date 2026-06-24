const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");
const app = express();

const User = require("./models/User");

app.use(cors());
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Arise Backend Running"
  });
});

app.listen(process.env.PORT, () => {
  console.log(`Server Running On Port ${process.env.PORT}`);
});

app.get("/test-user", async (req, res) => {
  try {
    const user = await User.create({
      name: "Arav",
      email: "arav@gmail.com",
    });

    res.json({user, message: "Yup, rest assured the User is working as intended...!!!"});
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});