// utils/checkGracePeriod.js
import pool from "../db.js";
import { getSetting } from "./settings.js";
import { createAdminAlert } from "./alertes.js";

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
      if (await getSetting("alertes_automatiques", true)) {
        for (const u of rows) {
          await createAdminAlert(
            "abonnement_expire",
            `L’abonnement Premium de ${u.nom_complet} (${u.email}) a expiré depuis plus de ${delaiGrace} jours.`,
            u.id
          );
        }
      }
    }
  } catch (err) {
    console.error("❌ Erreur checkGracePeriod:", err.message);
  }
}
