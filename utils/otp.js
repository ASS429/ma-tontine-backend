import pool from "../db.js";
import nodemailer from "nodemailer";
import { getSetting } from "./settings.js";

/**
 * ✉️ Envoie un code OTP à un administrateur
 */
export async function sendOTP(admin) {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 chiffres
  const expireTime = new Date(Date.now() + 5 * 60 * 1000); // expire dans 5 minutes

  // Enregistrer en base
  await pool.query(
    `INSERT INTO otp_codes (utilisateur_id, code, expire_le)
     VALUES ($1, $2, $3)`,
    [admin.id, code, expireTime]
  );

  const email_contact = await getSetting("email_contact", "noreply@matontine.com");

  // Transport mail basique (ici avec un SMTP générique)
  const transporter = nodemailer.createTransport({
    service: "gmail", // ou autre service (Mailtrap, etc.)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: email_contact,
    to: admin.email,
    subject: "Code de vérification (2FA) – Ma Tontine",
    html: `
      <h2>🔐 Double authentification</h2>
      <p>Bonjour ${admin.nom_complet},</p>
      <p>Voici votre code de connexion sécurisé :</p>
      <h1 style="font-size:28px;letter-spacing:3px;">${code}</h1>
      <p>Ce code expire dans 5 minutes.</p>
      <p>Si vous n'êtes pas à l'origine de cette tentative, ignorez ce message.</p>
    `,
  });

  console.log(`📨 OTP envoyé à ${admin.email} : ${code}`);
  return true;
}

/**
 * 🔍 Vérifie la validité d’un code OTP
 */
export async function verifyOTP(utilisateur_id, code) {
  const { rows } = await pool.query(
    `SELECT * FROM otp_codes
     WHERE utilisateur_id = $1
       AND code = $2
       AND utilise = false
       AND expire_le > NOW()
     ORDER BY cree_le DESC
     LIMIT 1`,
    [utilisateur_id, code]
  );

  if (rows.length === 0) return false;

  // Marquer comme utilisé
  await pool.query(
    `UPDATE otp_codes SET utilise = true WHERE id = $1`,
    [rows[0].id]
  );

  return true;
}
