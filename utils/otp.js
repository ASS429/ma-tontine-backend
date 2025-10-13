// utils/otp.js
import pool from "../db.js";
import nodemailer from "nodemailer";

/**
 * 📤 Envoie un code OTP 2FA par email
 */
export async function sendOTP(admin) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expireTime = new Date(Date.now() + 5 * 60 * 1000); // expire dans 5 min

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
      text: `Bonjour ${admin.nom_complet || "Administrateur"},

Voici votre code de connexion : ${code}
Ce code expire dans 5 minutes.

L’équipe Ma Tontine.`,
    });

    console.log(`📨 OTP envoyé à ${admin.email} (${code})`);
    return true;
  } catch (err) {
    console.error("❌ Erreur d'envoi d'email OTP:", err.message);
    throw new Error("Impossible d’envoyer le code OTP");
  }
}

/**
 * ✅ Vérifie un code OTP
 */
export async function verifyOTP(userId, code) {
  const { rows } = await pool.query(
    `SELECT * FROM otp_codes 
     WHERE utilisateur_id=$1 AND code=$2 AND utilise=false AND expire_le>NOW()
     ORDER BY cree_le DESC LIMIT 1`,
    [userId, code]
  );

  if (rows.length === 0) return false;

  await pool.query(`UPDATE otp_codes SET utilise=true WHERE id=$1`, [rows[0].id]);
  return true;
}
