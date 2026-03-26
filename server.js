// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

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
import adminRapportsRoutes from "./routes/adminRapports.js"; // ✅ Import statique (supprime la race condition)
import testEmailRoutes from "./routes/testEmail.js";

import { checkGracePeriod } from "./utils/checkGracePeriod.js";
import { checkLatePayments } from "./utils/payments.js";
import { getSetting } from "./utils/settings.js";

dotenv.config();

const app = express();

// =========================================================
// 🛡️  Sécurité HTTP — helmet ajoute ~14 headers de protection
//     (CSP, X-Frame-Options, HSTS, X-DNS-Prefetch-Control…)
// =========================================================
app.use(helmet());

// =========================================================
// 📋 Journalisation HTTP
// =========================================================
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// =========================================================
// 🌐 CORS
// =========================================================
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

// =========================================================
// 🔒 Rate-limiting
//    — Routes d'authentification / 2FA : 20 req / 15 min
//    — Routes admin sensibles           : 60 req / 15 min
//    — API globale                      : 300 req / 15 min (anti-DDoS léger)
// =========================================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessayez dans 15 minutes." },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes admin. Réessayez dans 15 minutes." },
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Réessayez dans 15 minutes." },
});

app.use(globalLimiter);

// 🩺 Route de test de santé (hors rate-limit)
app.get("/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// =========================================================
// 📦 Routes principales
// =========================================================
app.use("/api/auth",            authLimiter,  authRoutes);
app.use("/api/tontines",                      tontinesRoutes);
app.use("/api/membres",                       membresRoutes);
app.use("/api/cotisations",                   cotisationsRoutes);
app.use("/api/utilisateurs",                  utilisateursRoutes);
app.use("/api/tirages",                       tiragesRoutes);
app.use("/api/stats",                         statsRoutes);
app.use("/api/alertes",                       alertesRoutes);
app.use("/api/paiements",                     paiementsRoutes);
app.use("/api/comptes",                       comptesRoutes);
app.use("/api/revenus",                       revenusRoutes);
app.use("/api/admin/revenus",  adminLimiter,  revenusAdminRoutes);
app.use("/api/admin/comptes",  adminLimiter,  comptesAdminRoutes);
app.use("/api/admin/alertes",  adminLimiter,  adminAlertesRoutes);
app.use("/api/admin/parametres", adminLimiter, adminParametresRoutes);
app.use("/api/admin/rapports", adminLimiter,  adminRapportsRoutes);
app.use("/api/test-email",     adminLimiter,  testEmailRoutes);

// =========================================================
// 🔁 Vérifications automatiques périodiques
//    ⚠️  setInterval ne survit pas aux redémarrages Render.
//    Voir le fichier SQL migration pour la version pg_cron.
// =========================================================
async function startAutoChecks() {
  try {
    const intervalHours = 6;
    const delayMs = intervalHours * 60 * 60 * 1000;

    console.log(`🕒 Vérifications automatiques toutes les ${intervalHours}h.`);

    const runChecks = async () => {
      console.log("🔍 Vérification des abonnements & paiements…");
      try {
        const graceActive = await getSetting("alertes_automatiques", true);
        if (graceActive) {
          await checkGracePeriod();
          await checkLatePayments("system");
          console.log("✅ Vérifications terminées.");
        } else {
          console.log("⚙️ Vérifications automatiques désactivées dans les paramètres.");
        }
      } catch (err) {
        console.error("❌ Erreur lors de l'exécution automatique :", err.message);
      }
    };

    await runChecks();
    setInterval(runChecks, delayMs);
  } catch (err) {
    console.error("❌ Erreur démarrage du système auto :", err.message);
  }
}

// =========================================================
// 🚀 Lancement du serveur
// =========================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API démarrée sur le port : ${PORT}`);
  startAutoChecks();
});
