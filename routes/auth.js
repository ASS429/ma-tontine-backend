import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing email or password" });
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `insert into app_users (email, password_hash) values ($1, $2) returning id`,
      [email, hash]
    );
    const userId = result.rows[0].id;
    const token = jwt.sign({}, process.env.JWT_SECRET || "devsecret", { subject: userId, expiresIn: "7d" });
    res.json({ token });
  } catch (e) {
    if (e.message && e.message.includes("duplicate key")) {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error(e);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await query(`select id, password_hash from app_users where email = $1`, [email]);
    if (result.rowCount === 0) return res.status(401).json({ error: "Invalid credentials" });
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({}, process.env.JWT_SECRET || "devsecret", { subject: user.id, expiresIn: "7d" });
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
