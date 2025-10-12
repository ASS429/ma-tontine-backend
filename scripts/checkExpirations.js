// scripts/checkExpirations.js
import pool from "../db.js";
import { getSetting } from "../utils/settings.js";

(async () => {
  try {
    const delaiGrace = await getSetting("delai_grace", 7);

    const result = await pool.query(`
      UPDATE utilisateurs
      SET status = 'Bloqué'
      WHERE plan = 'Premium'
        AND expiration < NOW() - INTERVAL '${delaiGrace} days'
        AND status = 'Actif'
      RETURNING id, email;
    `);

    if (result.rowCount > 0) {
      console.log(`🔒 ${result.rowCount} comptes Premium suspendus (délai de grâce ${delaiGrace} jours)`);
    } else {
      console.log("✅ Aucun compte à suspendre aujourd’hui.");
    }

    process.exit(0);
  } catch (err) {
    console.error("Erreur script expiration:", err.message);
    process.exit(1);
  }
})();
