const express = require("express");
const {
  createUser, getUsers, getUserById, updateUser, deleteUser 
    } = require("../controllers/userController");

const router = express.Router();

router.get("/", getUsers);
router.get("/:id", getUserById);

router.post("/", createUser);

router.put("/:id", updateUser);

router.delete("/:id", deleteUser);

module.exports = router;