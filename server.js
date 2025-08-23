// ESM
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import tontinesRoutes from "./routes/tontines.js";
import membresRoutes from "./routes/membres.js";
import cotisationsRoutes from "./routes/cotisations.js";
import utilisateursRoutes from "./routes/utilisateurs.js";
import authRoutes from "./routes/auth.js";

dotenv.config();
const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL, // ou ["http://localhost:5173", process.env.FRONTEND_URL]
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
  console.log(" - /health");
});
