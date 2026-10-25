const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const questRoutes = require("./routes/questRoutes");
const completedQuestRoutes = require("./routes/completedQuestRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");


const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "Arise Backend Running",
    });
});

app.use("/api/users", userRoutes);
app.use("/api/quests", questRoutes);
app.use("/api/completedquests", completedQuestRoutes);
app.use("/api/recommendations", recommendationRoutes);

const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Server Running On Port ${port}`);
});