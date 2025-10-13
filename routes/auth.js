// routes/auth.js
import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sendOTP, verifyOTP } from "../utils/otp.js";

const router = express.Router();

/* =========================================================
   📌 GET /api/auth/me → infos du JWT
========================================================= */
router.get("/me", requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role || "user",
  });
});

/* =========================================================
   1️⃣ POST /api/auth/init-2fa → Lancer la vérification 2FA
========================================================= */
router.post("/init-2fa", async (req, res) => {
  try {
    const { userId } = req.body;
    console.log("🚀 Requête init-2fa reçue pour user:", userId);

    if (!userId) return res.status(400).json({ error: "userId requis" });

    const { rows: params } = await pool.query(
      "SELECT deux_fa FROM parametres_admin WHERE admin_id = $1 ORDER BY maj_le DESC LIMIT 1",
      [userId]
    );

    const deux_fa = params[0]?.deux_fa || false;
    console.log("🔍 Valeur deux_fa pour cet admin:", deux_fa);

    if (!deux_fa) return res.json({ active: false, message: "2FA désactivée" });

    const { rows } = await pool.query(
      "SELECT id, nom_complet, email FROM utilisateurs WHERE id = $1 AND role = 'admin'",
      [userId]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Administrateur introuvable" });

    const admin = rows[0];
    console.log("📬 Envoi OTP à:", admin.email);

    await sendOTP(admin);
    res.json({ active: true, message: "Code OTP envoyé à votre email" });
  } catch (err) {
    console.error("❌ Erreur init-2fa:", err.message);
    res.status(500).json({ error: "Erreur 2FA : " + err.message });
  }
});

/* =========================================================
   2️⃣ POST /api/auth/verify-2fa → Vérifie le code OTP
========================================================= */
router.post("/verify-2fa", async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code)
      return res.status(400).json({ error: "Champs manquants" });

    const valid = await verifyOTP(userId, code);
    if (!valid)
      return res.status(400).json({ success: false, error: "Code invalide ou expiré" });

    res.json({ success: true, message: "2FA validée ✅" });
  } catch (err) {
    console.error("❌ Erreur verify-2fa:", err.message);
    res.status(500).json({ error: "Erreur vérification OTP" });
  }
});

export default router;
