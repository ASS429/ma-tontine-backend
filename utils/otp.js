// utils/otp.js
const pool = require("../db.js");
const nodemailer = require("nodemailer");
const { getSetting } = require("./settings.js");

async function sendOTP(admin) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expireTime = new Date(Date.now() + 5 * 60 * 1000);

  console.log("🚀 Début sendOTP pour:", admin.email);
  console.log("📩 EMAIL_USER:", process.env.EMAIL_USER);
  console.log("🔑 EMAIL_PASS présent:", !!process.env.EMAIL_PASS);

  await pool.query(
    `INSERT INTO otp_codes (utilisateur_id, code, expire_le)
     VALUES ($1, $2, $3)`,
    [admin.id, code, expireTime]
  );

  const email_from = await getSetting("email_contact", "noreply@matontine.com");

  try {
    // ✅ Même config que ta boutique
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"Ma Tontine" <${process.env.EMAIL_USER}>`,
      to: admin.email,
      subject: "🔐 Code de vérification (2FA)",
      text: `Bonjour ${admin.nom_complet || admin.email},
Votre code de vérification est : ${code}

Ce code expire dans 5 minutes.
— L’équipe Ma Tontine`
    });

    console.log(`📨 OTP envoyé à ${admin.email} (${code})`);
    return true;
  } catch (err) {
    console.error("❌ Erreur d'envoi d'email OTP:", err.message);
    throw new Error("Impossible d'envoyer le code OTP : " + err.message);
  }
}

async function verifyOTP(userId, code) {
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

module.exports = { sendOTP, verifyOTP };
