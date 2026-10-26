const User = require("../models/User");
const mongoose = require("mongoose");

let inMemoryUsers = [];

const createUser = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const user = await User.create(req.body);
      return res.status(201).json(user);
    }

    const { name, email } = req.body;
    const existing = inMemoryUsers.find(u => u.email === email);
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    const newUser = {
      _id: `user_${Date.now()}`,
      name: name || "Hunter",
      email: email || "hunter@system.io",
      xp: 0,
      level: 1,
      createdAt: new Date().toISOString(),
    };
    inMemoryUsers.push(newUser);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(error.code === 11000 ? 409 : 400).json({
      success: false,
      message: error.code === 11000 ? "Email already exists" : error.message,
    });
  }
};

const getUsers = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const users = await User.find();
      return res.status(200).json(users);
    }
    res.status(200).json(inMemoryUsers);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const getUserById = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
      }
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      return res.status(200).json(user);
    }

    const found = inMemoryUsers.find(u => u._id === req.params.id);
    if (!found) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(found);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const updateUser = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const user = await User.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      );
      return res.status(200).json(user);
    }

    const index = inMemoryUsers.findIndex(u => u._id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ message: "User not found" });
    }
    inMemoryUsers[index] = { ...inMemoryUsers[index], ...req.body };
    res.status(200).json(inMemoryUsers[index]);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await User.findByIdAndDelete(req.params.id);
      return res.status(200).json({
        message: "User deleted",
      });
    }

    inMemoryUsers = inMemoryUsers.filter(u => u._id !== req.params.id);
    res.status(200).json({
      message: "User deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
};
