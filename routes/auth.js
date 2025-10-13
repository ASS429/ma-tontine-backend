import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import sendEmail from "../utils/mailer.js";

const router = express.Router();

/* ==========================
   🧩 Inscription (Admin ou public)
========================== */
router.post("/register", async (req, res) => {
  const {
    username,
    password,
    company_name,
    phone,
    role = "user",
    status = "Actif",
    plan = "Free",
    payment_status = "À jour",
    payment_method,
    expiration,
    amount = 0.0,
    upgrade_status = "validé"
  } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  try {
    const existingUser = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Utilisateur déjà existant" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users 
       (username, password, company_name, phone, role, status, plan, payment_status, payment_method, expiration, amount, upgrade_status) 
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        username,
        hashedPassword,
        company_name || null,
        phone || null,
        role,
        status,
        plan,
        payment_status,
        payment_method || null,
        expiration || null,
        amount,
        upgrade_status
      ]
    );

    res.status(201).json({ message: "Compte créé avec succès", user: result.rows[0] });
  } catch (err) {
    console.error("❌ Erreur inscription :", err);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================
   🔐 Connexion avec 2FA
========================== */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Champs manquants" });

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: "Utilisateur introuvable" });

    const user = result.rows[0];

    if (user.status === "Bloqué") {
      return res.status(403).json({ error: "Compte bloqué, contactez l’administrateur." });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: "Mot de passe incorrect" });

    // 🔎 Vérifie si 2FA activée
    const settings = await pool.query(
      "SELECT twofa_enabled FROM admin_settings WHERE admin_id = $1 LIMIT 1",
      [user.id]
    );

    const twofaEnabled = settings.rows[0]?.twofa_enabled || false;

    if (twofaEnabled && user.role === "admin") {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 5 * 60 * 1000);

      await pool.query(
        `INSERT INTO twofa_codes (user_id, code, expires_at) VALUES ($1, $2, $3)`,
        [user.id, code, expires]
      );

      await sendEmail(
        user.username,
        "Votre code de connexion (2FA) - Ma Boutique",
        `Bonjour,\n\nVoici votre code : ${code}\n\nValable 5 minutes.\n\n— Ma Boutique`
      );

      return res.json({
        twofa_required: true,
        userId: user.id,
        message: "Code 2FA envoyé par email"
      });
    }

    // ✅ Connexion normale
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.username,
        role: user.role,
        company_name: user.company_name,
        phone: user.phone,
        plan: user.plan,
        upgrade_status: user.upgrade_status
      }
    });
  } catch (err) {
    console.error("❌ Erreur connexion :", err);
    res.status(500).json({ error: err.message });
  }
});

/* ==========================
   ✅ Vérification du code 2FA
========================== */
router.post("/verify-2fa", async (req, res) => {
  const { userId, code } = req.body;
  if (!userId || !code) return res.status(400).json({ error: "Champs manquants" });

  try {
    const q = await pool.query(
      `SELECT * FROM twofa_codes 
       WHERE user_id = $1 AND code = $2 AND used = false 
         AND expires_at > NOW() 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, code]
    );

    if (q.rows.length === 0) return res.status(400).json({ error: "Code invalide ou expiré" });

    await pool.query(`UPDATE twofa_codes SET used = true WHERE id = $1`, [q.rows[0].id]);

    const { rows } = await pool.query(
      "SELECT id, username, role, company_name, phone, plan, upgrade_status FROM users WHERE id = $1",
      [userId]
    );
    const user = rows[0];

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token, user });
  } catch (err) {
    console.error("❌ Erreur verify-2fa:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
