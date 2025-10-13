import express from "express";
import { requireAuth } from "../middleware/auth.js";
import pool from "../db.js";
import { getSetting } from "../utils/settings.js";
import { sendOTP, verifyOTP } from "../utils/otp.js";
const router = express.Router();

/* -----------------------
   📌 GET infos du JWT
------------------------ */
router.get("/me", requireAuth, (req, res) => {
  // req.user est déjà rempli par le middleware auth.js
  res.json({
    id: req.user.id,
    email: req.user.email,       // si tu veux inclure email (payload Supabase)
    role: req.user.role || "user"
  });
});

/**
 * 1️⃣ Lancer la vérification 2FA
 * (appelé après connexion Supabase)
 */
router.post("/init-2fa", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId requis" });

    const deux_fa = await getSetting("deux_fa", false);
    if (!deux_fa) return res.json({ active: false });

    const { rows } = await pool.query(
      "SELECT id, nom_complet, email FROM utilisateurs WHERE id=$1 AND role='admin'",
      [userId]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Administrateur introuvable" });

    await sendOTP(rows[0]);
    res.json({ active: true, message: "Code OTP envoyé à votre email" });
  } catch (err) {
    console.error("Erreur init-2fa:", err.message);
    res.status(500).json({ error: "Erreur 2FA" });
  }
});

/**
 * 2️⃣ Vérifier le code OTP
 */
router.post("/verify-2fa", async (req, res) => {
  try {
    const { userId, code } = req.body;
    const valid = await verifyOTP(userId, code);

    if (!valid)
      return res.status(400).json({ error: "Code invalide ou expiré" });

    res.json({ success: true, message: "2FA validé ✅" });
  } catch (err) {
    console.error("Erreur verify-2fa:", err.message);
    res.status(500).json({ error: "Erreur vérification OTP" });
  }
});
export default router;
