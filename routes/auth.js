const express = require("express");
const { requireAuth } = require("../middleware/auth.js");
const pool = require("../db.js");
const { getSetting } = require("../utils/settings.js");
const { sendOTP, verifyOTP } = require("../utils/otp.js");

const router = express.Router();

/* -----------------------
   📌 GET infos du JWT
------------------------ */
router.get("/me", requireAuth, (req, res) => {
  // req.user est déjà rempli par le middleware auth.js
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role || "user",
  });
});

/* -----------------------
   1️⃣ Init 2FA après login
------------------------ */
router.post("/init-2fa", async (req, res) => {
  try {
    const { userId } = req.body;
    console.log("🚀 Requête init-2fa reçue pour user:", userId);
    if (!userId) return res.status(400).json({ error: "userId requis" });

    // 🔍 Vérifie si l’option 2FA est activée
    const { rows: params } = await pool.query(
      "SELECT deux_fa FROM parametres_admin WHERE admin_id = $1 ORDER BY maj_le DESC LIMIT 1",
      [userId]
    );

    const deux_fa = params[0]?.deux_fa || false;
    console.log("🔍 Valeur deux_fa pour cet admin:", deux_fa);

    if (!deux_fa) {
      console.log("⚙️ 2FA désactivée pour cet admin");
      return res.json({ active: false });
    }

    // 👤 Récupère l’administrateur
    const { rows } = await pool.query(
      "SELECT id, nom_complet, email FROM utilisateurs WHERE id=$1 AND role='admin'",
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Administrateur introuvable" });
    }

    const admin = rows[0];
    console.log("📬 Envoi OTP à:", admin.email);

    // ✉️ Envoi du code OTP
    try {
      await sendOTP(admin);
      console.log("✅ sendOTP terminé sans erreur");
      return res.json({ active: true, message: "Code OTP envoyé à votre email" });
    } catch (emailError) {
      console.error("❌ Erreur sendOTP:", emailError.message);
      return res.status(500).json({
        active: false,
        error: "Erreur d’envoi du mail : " + emailError.message,
      });
    }
  } catch (err) {
    console.error("❌ Erreur init-2fa:", err.message);
    return res.status(500).json({ error: err.message || "Erreur 2FA" });
  }
});

/* -----------------------
   2️⃣ Vérification du code OTP
------------------------ */
router.post("/verify-2fa", async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code)
      return res.status(400).json({ error: "Champs manquants" });

    const valid = await verifyOTP(userId, code);

    if (!valid)
      return res.status(400).json({ error: "Code invalide ou expiré" });

    console.log(`✅ 2FA validé pour ${userId}`);
    res.json({ success: true, message: "2FA validé ✅" });
  } catch (err) {
    console.error("❌ Erreur verify-2fa:", err.message);
    res.status(500).json({ error: "Erreur vérification OTP" });
  }
});

module.exports = router;
