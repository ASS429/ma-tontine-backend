import pool from "../db.js";
import { getSetting } from "./settings.js";
import { createAdminAlert } from "./alertes.js";
import { logSystem } from "./logger.js";

/**
 * 🔎 Vérifie les paiements en retard et crée une alerte si activé
 * @param {string} adminId - ID de l’administrateur connecté
 */
export async function checkLatePayments(adminId) {
  try {
    // Vérifie si la notification est activée dans les paramètres
    const notifActive = await getSetting("notif_paiements_retard", true);
    if (!notifActive) return;

    // Cherche les utilisateurs Premium expirés
    const { rows: enRetard } = await pool.query(`
      SELECT id, nom_complet, email, expiration
      FROM utilisateurs
      WHERE plan = 'Premium'
        AND expiration < NOW()
        AND payment_status = 'effectue'
    `);

    if (enRetard.length === 0) return;

    for (const user of enRetard) {
      // ✅ Vérifie si une alerte "paiement_en_retard" existe déjà pour cet utilisateur
      const { rows: existing } = await pool.query(
        `SELECT 1 FROM alertes_admin 
         WHERE type = 'paiement_en_retard' 
           AND utilisateur_id = $1 
           AND statut = 'en_attente'`,
        [user.id]
      );

      if (existing.length > 0) {
        console.log(`🔁 Alerte déjà existante pour ${user.email}, ignorée.`);
        continue; // passe au suivant
      }

      // 🔔 Crée une nouvelle alerte
      await createAdminAlert(
        "paiement_en_retard",
        `L’utilisateur ${user.nom_complet} (${user.email}) a un paiement en retard depuis le ${new Date(
          user.expiration
        ).toLocaleDateString("fr-FR")}.`,
        user.id
      );
    }

   console.log(`⚠️ Vérification terminée : ${enRetard.length} utilisateurs en retard analysés.`);
await logSystem(
  "checkLatePayments",
  `${enRetard.length} utilisateurs Premium en retard de paiement vérifiés.`
);
  } catch (err) {
    console.error("❌ Erreur checkLatePayments:", err.message);
  }
}
