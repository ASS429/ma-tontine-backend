// scripts/checkGracePeriod.js
import pool from "../db.js";
import { getSetting } from "../utils/settings.js";
import { createAdminAlert } from "../utils/alertes.js";

(async () => {
  try {
    const delaiGrace = await getSetting("delai_grace", 7);

    console.log(`🕓 Vérification des comptes expirés (grâce = ${delaiGrace} jours)...`);

    // 🔹 Suspendre les Premium expirés depuis plus que le délai de grâce
    const { rows } = await pool.query(`
      UPDATE utilisateurs
      SET status = 'Bloqué'
      WHERE plan = 'Premium'
        AND payment_status = 'effectue'
        AND expiration < NOW() - INTERVAL '${delaiGrace} days'
        AND status = 'Actif'
      RETURNING id, email, nom_complet, expiration;
    `);

    if (rows.length > 0) {
      console.log(`🔒 ${rows.length} comptes Premium bloqués.`);
      if (await getSetting("alertes_automatiques", true)) {
        for (const u of rows) {
          await createAdminAlert(
            "abonnement_expire",
            `L'abonnement Premium de ${u.nom_complet} (${u.email}) a expiré depuis plus de ${delaiGrace} jours.`,
            u.id
          );
        }
      }
    } else {
      console.log("✅ Aucun compte à bloquer aujourd’hui.");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur script delai_grace:", err.message);
    process.exit(1);
  }
})();
