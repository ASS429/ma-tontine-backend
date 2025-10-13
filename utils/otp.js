// utils/otp.js
import nodemailer from "nodemailer";
import pool from "../db.js";
import { getSetting } from "./settings.js";

export async function sendOTP(admin) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expireTime = new Date(Date.now() + 5 * 60 * 1000);

  console.log("🚀 Début sendOTP pour:", admin.email);
  console.log("📩 SMTP_USER:", process.env.SMTP_USER);
  console.log("🔑 SMTP_PASS présent:", !!process.env.SMTP_PASS);

  await pool.query(
    `INSERT INTO otp_codes (utilisateur_id, code, expire_le)
     VALUES ($1, $2, $3)`,
    [admin.id, code, expireTime]
  );

  const email_from = await getSetting("email_contact", "noreply@matontine.com");

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465, // port sécurisé SSL
      secure: true, // true pour le port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 15000, // 15 secondes max
    });

    const info = await transporter.sendMail({
      from: email_from,
      to: admin.email,
      subject: "🔐 Code de vérification (2FA)",
      html: `
        <h2>Connexion sécurisée</h2>
        <p>Bonjour ${admin.nom_complet || admin.email},</p>
        <p>Votre code de vérification est :</p>
        <h1 style="font-size:24px;letter-spacing:3px;">${code}</h1>
        <p>Ce code expire dans 5 minutes.</p>
      `,
    });

    console.log("✅ Résultat sendMail:", info);
    console.log(`📨 OTP envoyé à ${admin.email} (${code})`);
    return true;
  } catch (err) {
    console.error("❌ Erreur d'envoi d'email OTP:", err.message);
    throw new Error("Impossible d'envoyer le code OTP : " + err.message);
  }
}
