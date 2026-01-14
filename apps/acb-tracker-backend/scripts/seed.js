const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

const { connectDb } = require("../src/config/db");
const User = require("../src/models/User");

dotenv.config();

const users = [
  {
    username: "admin",
    displayName: "Admin",
    role: "Admin",
    password: process.env.SEED_ADMIN_PASSWORD || "admin123",
  },
  {
    username: "tl",
    displayName: "Team Lead",
    role: "TL",
    password: process.env.SEED_TL_PASSWORD || "tl123",
  },
  {
    username: "analyst",
    displayName: "Analyst",
    role: "Analyst",
    password: process.env.SEED_ANALYST_PASSWORD || "analyst123",
  },
  {
    username: "billing",
    displayName: "Billing",
    role: "Billing",
    password: process.env.SEED_BILLING_PASSWORD || "billing123",
  },
];

const run = async () => {
  await connectDb();

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    await User.updateOne(
      { username: user.username },
      {
        $set: {
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          passwordHash,
          isActive: true,
        },
      },
      { upsert: true }
    );
  }

  console.log("Seeded users:", users.map((u) => u.username).join(", "));
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
