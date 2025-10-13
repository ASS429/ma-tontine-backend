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

  try {
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
  } catch (err) {
    console.error("❌ Erreur d'envoi d'email OTP:", err.message);
    throw new Error("Impossible d'envoyer l'OTP: " + err.message);
  }
}
