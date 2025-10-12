// utils/alertes.js
import pool from "../db.js";

/**
 * 🔔 Crée une alerte admin automatiquement
 * @param {string} type - Type d’alerte (ex: abonnement_premium_valide)
 * @param {string} message - Message descriptif
 * @param {string|null} utilisateur_id - ID de l’utilisateur lié (facultatif)
 */
export async function createAdminAlert(type, message, utilisateur_id = null) {
  try {
    // Liste sécurisée des types autorisés (pour éviter les fautes de frappe)
    const typesAutorises = [
      'paiement_en_retard', 'paiement_effectue', 'solde_compte_faible', 'revenu_enregistre', 'transaction_refusee', 'remboursement_effectue',
      'nouvel_utilisateur', 'abonnement_premium_demande', 'abonnement_premium_valide', 'abonnement_expire', 'utilisateur_suspendu', 'utilisateur_reactive',
      'nouvelle_tontine', 'tontine_cloturee', 'retard_cotisation', 'tirage_effectue', 'cycle_termine', 'cycle_retard',
      'erreur_serveur', 'operation_suspecte', 'sauvegarde_effectuee', 'maj_systeme', 'erreur_api',
      'rapport_disponible', 'validation_requise', 'compte_admin_cree', 'compte_admin_modifie', 'operation_manquante'
    ];

    if (!typesAutorises.includes(type)) {
      console.warn(`⚠️ Type d’alerte inconnu ignoré : ${type}`);
      return;
    }

    // Insertion en base
    await pool.query(
      `INSERT INTO alertes_admin (type, message, utilisateur_id)
       VALUES ($1, $2, $3)`,
      [type, message, utilisateur_id]
    );

    console.log(`🔔 [Alerte créée] ${type} → ${message}`);
  } catch (err) {
    console.error("❌ Erreur création alerte admin:", err.message);
  }
}
