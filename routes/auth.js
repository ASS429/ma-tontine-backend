import pool from "../db.js";
import nodemailer from "nodemailer";

export async function sendOTP(admin) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expireTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  console.log("🚀 Envoi OTP pour:", admin.email);

  await pool.query(
    `INSERT INTO otp_codes (utilisateur_id, code, expire_le)
     VALUES ($1, $2, $3)`,
    [admin.id, code, expireTime]
  );

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"Ma Tontine" <${process.env.SMTP_USER}>`,
      to: admin.email,
      subject: "🔐 Code de vérification (2FA)",
      text: `Bonjour ${admin.nom_complet || ""},

Voici votre code de connexion : ${code}
Ce code est valable 5 minutes.

Merci,
L’équipe Ma Tontine.`
    });

    console.log(`📨 OTP envoyé à ${admin.email} (${code})`);
    return true;
  } catch (err) {
    console.error("❌ Erreur envoi email OTP:", err.message);
    throw new Error("Impossible d’envoyer le code OTP");
  }
}
