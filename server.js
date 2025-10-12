// ESM
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

dotenv.config();
const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",               // pour le dev local
    process.env.FRONTEND_URL,              // ton URL Render du frontend (env)
    "https://ma-tontine-frontend-1.onrender.com" // explicitement ton frontend déployé
  ],
  credentials: true,
}));

app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Routes
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

// Lancement du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API démarrée sur le port : ${PORT}`);
  console.log("Routes actives :");
  console.log(" - /api/tontines");
  console.log(" - /api/membres");
  console.log(" - /api/cotisations");
  console.log(" - /api/utilisateurs");
  console.log(" - /api/auth");
  console.log(" - /api/tirages");
  console.log(" - /api/stats");
  console.log(" - /api/alertes");
  console.log(" - /api/paiements");  
  console.log(" - /api/comptes");    
  console.log(" - /health");
});
