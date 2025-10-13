// ✅ Version ESM (compatible avec import/export)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import tontinesRoutes from "./routes/tontines.js";
import membresRoutes from "./routes/membres.js";
import cotisationsRoutes from "./routes/cotisations.js";
import utilisateursRoutes from "./routes/utilisateurs.js";
import authRoutes from "./routes/auth.js";
import tiragesRoutes from "./routes/tirages.js";
import statsRoutes from "./routes/stats.js";
import alertesRoutes from "./routes/alertes.js";
import paiementsRoutes from "./routes/paiements.js";
import comptesRoutes from "./routes/comptes.js";
import revenusRoutes from "./routes/revenus.js";
import revenusAdminRoutes from "./routes/revenusAdmin.js";
import comptesAdminRoutes from "./routes/comptesAdmin.js";
import adminAlertesRoutes from "./routes/adminAlertes.js";
import adminParametresRoutes from "./routes/adminParametres.js";

import { checkGracePeriod } from "./utils/checkGracePeriod.js";
import { checkLatePayments } from "./utils/payments.js";
import { getSetting } from "./utils/settings.js";

dotenv.config();
const app = express();

/* =========================================================
   🌍 CORS
========================================================= */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      process.env.FRONTEND_URL,
      "https://ma-tontine-frontend-1.onrender.com",
    ],
    credentials: true,
  })
);

app.use(express.json());

/* =========================================================
   💚 Health Check
========================================================= */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* =========================================================
   🚦 Routes principales
========================================================= */
app.use("/api/tontines", tontinesRoutes);
app.use("/api/membres", membresRoutes);
app.use("/api/cotisations", cotisationsRoutes);
app.use("/api/utilisateurs", utilisateursRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tirages", tiragesRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/alertes", alertesRoutes);
app.use("/api/paiements", paiementsRoutes);
app.use("/api/comptes", comptesRoutes);
app.use("/api/revenus", revenusRoutes);
app.use("/api/admin/revenus", revenusAdminRoutes);
app.use("/api/admin/comptes", comptesAdminRoutes);
app.use("/api/admin/alertes", adminAlertesRoutes);
app.use("/api/admin/parametres", adminParametresRoutes);

/* =========================================================
   ⚡ Import dynamique adminRapports
========================================================= */
try {
  const { default: adminRapportsRoutes } = await import("./routes/adminRapports.js");
  app.use("/api/admin/rapports", adminRapportsRoutes);
} catch (err) {
  console.error("⚠️ Impossible de charger adminRapports:", err.message);
}

/* =========================================================
   🔁 Vérifications automatiques périodiques
========================================================= */
async function startAutoChecks() {
  try {
    const intervalHours = 6; // toutes les 6 heures
    const delayMs = intervalHours * 60 * 60 * 1000;

    console.log(`🕒 Vérifications automatiques toutes les ${intervalHours}h.`);

    const runChecks = async () => {
      console.log("🔍 Vérification automatique des abonnements & paiements...");
      try {
        const graceActive = await getSetting("alertes_automatiques", true);
        if (graceActive) {
          await checkGracePeriod();
          await checkLatePayments("system");
          console.log("✅ Vérifications terminées avec succès.");
        } else {
          console.log("⚙️ Vérifications automatiques désactivées.");
        }
      } catch (err) {
        console.error("❌ Erreur vérifications automatiques:", err.message);
      }
    };

    await runChecks();
    setInterval(runChecks, delayMs);
  } catch (err) {
    console.error("❌ Erreur démarrage vérifications automatiques:", err.message);
  }
}

/* =========================================================
   🚀 Lancement serveur
========================================================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur le port ${PORT}`);
  console.log("📍 Routes principales actives : /api/auth, /api/tontines, /api/admin/...");
  startAutoChecks();
});
