import pool from "../db.js";
import nodemailer from "nodemailer";
import { getSetting } from "./settings.js";

export async function sendOTP(admin) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expireTime = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  await pool.query(
    `INSERT INTO otp_codes (utilisateur_id, code, expire_le)
     VALUES ($1, $2, $3)`,
    [admin.id, code, expireTime]
  );

  const email_from = await getSetting("email_contact", "noreply@matontine.com");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: email_from,
    to: admin.email,
    subject: "🔐 Code de vérification (2FA)",
    html: `
      <h2>Connexion sécurisée</h2>
      <p>Bonjour ${admin.nom_complet || admin.email},</p>
      <p>Votre code de vérification est :</p>
      <h1 style="font-size:24px;letter-spacing:3px;">${code}</h1>
      <p>Ce code expire dans 5 minutes.</p>
    `
  });

  console.log(`📨 OTP envoyé à ${admin.email} (${code})`);
  return true;
}

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
