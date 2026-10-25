const mongoose = require("mongoose");

const questSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      required: true,
    },

    xpReward: {
      type: Number,
      required: true,
      min: 1,
      max: 1000,
    },

    deadline: {
      type: Date,
      required: true,
      validate: {
        validator: (value) => !Number.isNaN(value.getTime()),
        message: "Deadline must be a valid date",
      },
    },

    generatedBy: {
      type: String,
      enum: ["user", "ai"],
      default: "user",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Quest", questSchema);