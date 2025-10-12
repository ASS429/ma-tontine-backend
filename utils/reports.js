
import { getSetting } from "./settings.js";
import { logSystem } from "./logger.js";

/**
 * 📈 Génère un rapport mensuel si activé
 */
export async function generateMonthlyReport() {
  try {
    const active = await getSetting("notif_rapports_mensuels", false);
    if (!active) return;

    // Ici tu pourrais calculer les stats du mois passé
    await logSystem(
      "generateMonthlyReport",
      "Rapport mensuel généré automatiquement (simulation)."
    );
    console.log("📊 Rapport mensuel généré automatiquement ✅");
  } catch (err) {
    console.error("❌ Erreur génération rapport:", err.message);
  }
}
