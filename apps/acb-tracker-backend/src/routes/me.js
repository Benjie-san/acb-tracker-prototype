const express = require("express");

const User = require("../models/User");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      "username displayName role isActive"
    );
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
