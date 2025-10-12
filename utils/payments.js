import pool from "../db.js";
import { getSetting } from "./settings.js";
import { createAdminAlert } from "./alertes.js";

/**
 * 🔎 Vérifie les paiements en retard et crée une alerte si activé
 * @param {string} adminId - ID de l’administrateur connecté
 */
export async function checkLatePayments(adminId) {
  try {
    // Vérifie si les notifications sont activées
    const notifActive = await getSetting("notif_paiements_retard", true);
    if (!notifActive) return;

    // Récupère les utilisateurs en retard
    const { rows: enRetard } = await pool.query(`
      SELECT id, nom_complet, email, expiration
      FROM utilisateurs
      WHERE plan = 'Premium'
        AND expiration < NOW()
        AND payment_status = 'effectue'
    `);

    if (enRetard.length === 0) return;

    // Crée une alerte par utilisateur en retard
    for (const user of enRetard) {
      await createAdminAlert(
        "paiement_en_retard",
        `L’utilisateur ${user.nom_complet} (${user.email}) a un paiement en retard depuis le ${new Date(user.expiration).toLocaleDateString()}.`,
        user.id
      );
    }

    console.log(`⚠️ ${enRetard.length} utilisateurs en retard détectés et alertes créées.`);
  } catch (err) {
    console.error("❌ Erreur checkLatePayments:", err.message);
  }
}
