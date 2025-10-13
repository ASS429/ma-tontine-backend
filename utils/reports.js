import pool from "../db.js";
import { getSetting } from "./settings.js";
import { logSystem } from "./logger.js";
import { createAdminAlert } from "./alertes.js";

/**
 * 📈 Génère un rapport mensuel complet si activé
 */
export async function generateMonthlyReport(adminId = null) {
  try {
    const active = await getSetting("notif_rapports_mensuels", false);
    if (!active) return;

    console.log("📊 Génération du rapport mensuel...");

    // Déterminer le mois précédent
    const mois = new Date();
    mois.setMonth(mois.getMonth() - 1);
    const moisTexte = mois.toISOString().slice(0, 7); // ex: 2025-09

    // Vérifie si un rapport existe déjà
    const { rows: existing } = await pool.query(
      `SELECT id FROM rapports_admin WHERE mois = $1 AND admin_id = $2`,
      [moisTexte, adminId]
    );
    if (existing.length > 0) {
      console.log(`ℹ️ Rapport ${moisTexte} déjà existant pour cet admin.`);
      return;
    }

    // 📊 Calculer les statistiques du mois passé
    const { rows: stats } = await pool.query(`
      WITH
      revenus AS (
        SELECT COALESCE(SUM(montant), 0) AS total
        FROM revenus_admin
        WHERE DATE_PART('month', cree_le) = DATE_PART('month', CURRENT_DATE - INTERVAL '1 month')
          AND DATE_PART('year', cree_le) = DATE_PART('year', CURRENT_DATE - INTERVAL '1 month')
      ),
      abonnes AS (
        SELECT COUNT(*) AS total FROM utilisateurs
      ),
      premium AS (
        SELECT COUNT(*) AS total FROM utilisateurs WHERE plan = 'Premium'
      ),
      nouveaux AS (
        SELECT COUNT(*) AS total FROM utilisateurs
        WHERE DATE_PART('month', cree_le) = DATE_PART('month', CURRENT_DATE - INTERVAL '1 month')
      )
      SELECT 
        (SELECT total FROM revenus) AS total_revenus,
        (SELECT total FROM abonnes) AS total_abonnes,
        (SELECT total FROM premium) AS total_premium,
        (SELECT total FROM nouveaux) AS nouveaux_abonnes;
    `);

    const rapport = stats[0];

    // 💾 Enregistrer dans la table
await pool.query(
  `INSERT INTO rapports_admin (mois, total_revenus, total_abonnes, total_premium, nouveaux_abonnes, admin_id)
   VALUES ($1, $2, $3, $4, $5, $6)
   ON CONFLICT (mois, admin_id)
   DO NOTHING;`,
  [
    moisTexte,
    rapport.total_revenus,
    rapport.total_abonnes,
    rapport.total_premium,
    rapport.nouveaux_abonnes,
    adminId || (await getDefaultAdminId()), // 👈 correction ici
  ]
);

    console.log(`✅ Rapport du mois ${moisTexte} enregistré.`);

    // 🪶 Journaliser l’action
    await logSystem(
      "generateMonthlyReport",
      `Rapport mensuel généré pour ${moisTexte} : ${rapport.total_revenus} FCFA, ${rapport.total_premium} Premium.`
    );

    // 🔔 Créer une alerte si autorisé
    if (await getSetting("alertes_automatiques", true)) {
      await createAdminAlert(
        "rapport_disponible",
        `Un nouveau rapport mensuel (${moisTexte}) est disponible.`,
        adminId
      );
    }
  } catch (err) {
    console.error("❌ Erreur génération rapport:", err.message);
  }
}
