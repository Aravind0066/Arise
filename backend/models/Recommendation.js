const mongoose = require("mongoose");

const recommendationSchema = new mongoose.Schema(
  {
    goal: { type: String, required: true },
    category: { type: String, required: true },
    availableMinutes: { type: Number, required: true },
    difficulty: { type: String, required: true },
    questIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Quest" }],
    generatedBy: { type: String, default: "gemini" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Recommendation", recommendationSchema);
