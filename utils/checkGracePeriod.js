// utils/checkGracePeriod.js
import pool from "../db.js";
import { getSetting } from "./settings.js";
import { createAdminAlert } from "./alertes.js";
import { logSystem } from "./logger.js";

/**
 * 🕓 Vérifie les abonnements expirés et bloque ceux qui dépassent le délai de grâce.
 */
export async function checkGracePeriod() {
  try {
    const delaiGrace = await getSetting("delai_grace", 7);

    // 🔹 Cherche les comptes à bloquer
    const { rows } = await pool.query(`
      UPDATE utilisateurs
      SET status = 'Bloqué'
      WHERE plan = 'Premium'
        AND payment_status = 'effectue'
        AND expiration < NOW() - INTERVAL '${delaiGrace} days'
        AND status = 'Actif'
      RETURNING id, nom_complet, email, expiration;
    `);

    if (rows.length > 0) {
      console.log(`🔒 ${rows.length} abonnements Premium suspendus automatiquement.`);

      await logSystem(
        "checkGracePeriod",
        `${rows.length} abonnements Premium suspendus après dépassement du délai de grâce.`
      );

      // ✅ Empêche les doublons d’alertes dans la même journée
      const { rows: existingAlerts } = await pool.query(
        `SELECT id FROM alertes_admin 
         WHERE type = 'grace_period_expired' 
         AND DATE(cree_le) = CURRENT_DATE`
      );

      if (existingAlerts.length === 0) {
        await createAdminAlert(
          "grace_period_expired",
          "Des comptes Premium ont été bloqués automatiquement après 7 jours de grâce."
        );
      } else {
        console.log("⚙️ Alerte déjà créée aujourd'hui — pas de duplication.");
      }
    }
  } catch (err) {
    console.error("❌ Erreur checkGracePeriod:", err.message);
  }
}
