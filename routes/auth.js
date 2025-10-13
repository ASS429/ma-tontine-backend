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
    console.log("🚀 Requête init-2fa reçue pour user:", userId);
    if (!userId) return res.status(400).json({ error: "userId requis" });

    // Vérifie si 2FA activée
    const { rows: params } = await pool.query(
      "SELECT deux_fa FROM parametres_admin WHERE admin_id = $1 ORDER BY maj_le DESC LIMIT 1",
      [userId]
    );
    const deux_fa = params[0]?.deux_fa || false;
    console.log("🔍 Valeur deux_fa pour cet admin:", deux_fa);

    if (!deux_fa) return res.json({ active: false });

    // Récupère l'admin
    const { rows } = await pool.query(
      "SELECT id, nom_complet, email FROM utilisateurs WHERE id=$1 AND role='admin'",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Administrateur introuvable" });
    }

    const admin = rows[0];
    console.log("📬 Envoi OTP à:", admin.email);

    try {
      await sendOTP(admin);
      return res.json({ active: true, message: "Code OTP envoyé à votre email" });
    } catch (emailError) {
      console.error("❌ Erreur sendOTP:", emailError.message);
      return res.status(500).json({
        active: false,
        error: "Erreur d’envoi du mail : " + emailError.message
      });
    }

  } catch (err) {
    console.error("❌ Erreur init-2fa:", err.message);
    return res.status(500).json({ error: err.message || "Erreur 2FA" });
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
