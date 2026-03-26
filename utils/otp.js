// utils/otp.js
import pool from "../db.js";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";

/**
 * 📤 Envoie un code OTP 2FA par email
 * ✅ CORRECTIFS :
 *   - Le code OTP est hashé (bcrypt) avant stockage en BDD
 *   - Le code en clair n'apparaît plus dans les logs
 */
export async function sendOTP(admin) {
  // Génération du code en clair (utilisé une seule fois, jamais persisté tel quel)
  const codeClair = Math.floor(100000 + Math.random() * 900000).toString();
  const expireTime = new Date(Date.now() + 5 * 60 * 1000); // expire dans 5 min

  // ✅ Hash du code avant insertion — le clair n'est jamais stocké
  const codeHash = await bcrypt.hash(codeClair, 10);

  await pool.query(
    `INSERT INTO otp_codes (utilisateur_id, code, expire_le)
     VALUES ($1, $2, $3)`,
    [admin.id, codeHash, expireTime]
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
      text: `Bonjour ${admin.nom_complet || "Administrateur"},\n\nVoici votre code de connexion : ${codeClair}\nCe code expire dans 5 minutes.\n\nL'équipe Ma Tontine.`,
    });

    // ✅ CORRECTIF : le code en clair n'est plus loggé
    console.log(`📨 OTP envoyé à ${admin.email}`);
    return true;
  } catch (err) {
    console.error("❌ Erreur d'envoi d'email OTP:", err.message);
    throw new Error("Impossible d'envoyer le code OTP");
  }
}

/**
 * ✅ Vérifie un code OTP
 * ✅ CORRECTIF : comparaison via bcrypt.compare (hash vs clair)
 *    L'ancien code faisait WHERE code=$2 en clair — impossible avec un hash.
 *    On récupère maintenant le dernier OTP valide et on compare côté JS.
 */
export async function verifyOTP(userId, codeSaisi) {
  // On récupère le hash stocké pour cet utilisateur (non utilisé, non expiré)
  const { rows } = await pool.query(
    `SELECT * FROM otp_codes 
     WHERE utilisateur_id = $1
       AND utilise = false
       AND expire_le > NOW()
     ORDER BY cree_le DESC
     LIMIT 1`,
    [userId]
  );

  if (rows.length === 0) return false;

  // Comparaison sécurisée hash ↔ code saisi
  const match = await bcrypt.compare(codeSaisi, rows[0].code);
  if (!match) return false;

  // Marquer comme utilisé
  await pool.query(`UPDATE otp_codes SET utilise = true WHERE id = $1`, [rows[0].id]);
  return true;
}
