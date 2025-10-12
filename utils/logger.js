// utils/logger.js
import pool from "../db.js";

/**
 * 🪶 Enregistre une trace dans la table logs_system
 * @param {string} action - Identifiant court (ex: "checkGracePeriod")
 * @param {string} [details] - Description optionnelle
 */
export async function logSystem(action, details = "") {
  try {
    await pool.query(
      `INSERT INTO logs_system (action, details, cree_le)
       VALUES ($1, $2, NOW())`,
      [action, details]
    );
    console.log(`🪶 Log enregistré: [${action}] ${details}`);
  } catch (err) {
    console.error("❌ Erreur lors de l'enregistrement du log système:", err.message);
  }
}

/**
 * 🔍 Récupère les logs récents pour affichage admin
 * @param {number} limit - Nombre maximum de logs à renvoyer (par défaut 20)
 */
export async function getRecentLogs(limit = 20) {
  const { rows } = await pool.query(
    `SELECT * FROM logs_system ORDER BY cree_le DESC LIMIT $1`,
    [limit]
  );
  return rows;
}
