// utils/settings.js
import pool from "../db.js";

let cachedSettings = null;
let lastLoadTime = null;

/**
 * 🔄 Charge les paramètres depuis la base (avec cache 5 min)
 */
export async function getSettings(forceReload = false) {
  const shouldReload =
    !cachedSettings || !lastLoadTime || (Date.now() - lastLoadTime > 5 * 60 * 1000);

  if (forceReload || shouldReload) {
    const { rows } = await pool.query(`
      SELECT *
      FROM parametres_admin
      ORDER BY maj_le DESC
      LIMIT 1
    `);
    cachedSettings = rows[0] || {};
    lastLoadTime = Date.now();
    console.log("⚙️ Paramètres rechargés depuis la base:", cachedSettings);
  }

  return cachedSettings;
}

/**
 * 🎯 Récupère une seule clé (ex: getSetting('prix_plan_premium'))
 */
export async function getSetting(key, defaultValue = null) {
  const settings = await getSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

/**
 * ♻️ Force le rechargement du cache après mise à jour
 */
export async function refreshSettings() {
  cachedSettings = null;
  lastLoadTime = null;
  await getSettings(true);
  console.log("🔁 Cache des paramètres actualisé manuellement.");
}
