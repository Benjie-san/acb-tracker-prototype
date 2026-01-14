const express = require("express");
const jwt = require("jsonwebtoken");

const { auth } = require("../middleware/auth");
const {
  addClient,
  removeClient,
  snapshot,
  beginPresence,
  endPresence,
  writeEvent,
} = require("../services/presence");

const router = express.Router();

const readToken = (req) => {
  const queryToken = req.query.token;
  if (queryToken) return queryToken;
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) return token;
  return null;
};

router.get("/stream", (req, res) => {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("\n");

  addClient(res);
  writeEvent(res, "presence:state", { items: snapshot() });

  const heartbeat = setInterval(() => {
    res.write("event: ping\ndata: {}\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeClient(res);
  });
});

router.post("/begin", auth, (req, res) => {
  const { shipmentId } = req.body || {};
  if (!shipmentId) {
    return res.status(400).json({ error: "Missing shipmentId" });
  }
  beginPresence(shipmentId, req.user);
  return res.json({ ok: true });
});

router.post("/end", auth, (req, res) => {
  const { shipmentId } = req.body || {};
  if (!shipmentId) {
    return res.status(400).json({ error: "Missing shipmentId" });
  }
  endPresence(shipmentId, req.user.id);
  return res.json({ ok: true });
});

module.exports = router;
