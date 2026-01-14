const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

const { connectDb } = require("./config/db");
const authRoutes = require("./routes/auth");
const meRoutes = require("./routes/me");
const airShipmentsRoutes = require("./routes/airShipments");
const presenceRoutes = require("./routes/presence");
const { errorHandler } = require("./middleware/error");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/me", meRoutes);
app.use("/air-shipments", airShipmentsRoutes);
app.use("/presence", presenceRoutes);

app.use(errorHandler);

const port = process.env.PORT || 4000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`API running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
