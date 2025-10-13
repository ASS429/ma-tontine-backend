// routes/testEmail.js
import express from "express";
import { sendOTP } from "../utils/otp.js";

const router = express.Router();

/**
 * 🧪 Route de test pour vérifier l'envoi d'email via Gmail/Render
 * Exemple : POST /api/test-email { "email": "ton@email.com" }
 */
router.post("/", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email requis dans le corps de la requête." });
    }

    console.log("📨 Test envoi OTP vers :", email);

    // Simule un "admin" factice juste pour test
    const fakeAdmin = {
      id: "00000000-0000-0000-0000-000000000000",
      nom_complet: "Test Render",
      email
    };

    await sendOTP(fakeAdmin);

    res.json({
      success: true,
      message: `✅ Email de test envoyé à ${email}`
    });
  } catch (err) {
    console.error("❌ Erreur test-email:", err.message);
    res.status(500).json({
      error: "Erreur lors de l’envoi de l’email",
      details: err.message
    });
  }
});

export default router;
