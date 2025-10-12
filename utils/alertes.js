// utils/alertes.js
import pool from "../db.js";

/**
 * 🔔 Crée une alerte admin automatiquement
 * @param {string} type - Type d’alerte (ex: abonnement_premium_valide)
 * @param {string} message - Message à afficher
 * @param {string|null} utilisateur_id - ID utilisateur lié (facultatif)
 */
export async function createAdminAlert(type, message, utilisateur_id = null) {
  try {
    await pool.query(
      `INSERT INTO alertes_admin (type, message, utilisateur_id)
       VALUES ($1, $2, $3)`,
      [type, message, utilisateur_id]
    );
    console.log(`🔔 Alerte créée : ${type} → ${message}`);
  } catch (err) {
    console.error("❌ Erreur création alerte admin:", err.message);
  }
}
