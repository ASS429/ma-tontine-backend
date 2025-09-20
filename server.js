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

dotenv.config();
const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",               // pour le dev
    process.env.FRONTEND_URL,              // ton URL Render (déjà dans ton .env)
    "https://ma-tontine-frontend-1.onrender.com" // ajoute explicitement
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
  console.log(" - /health");
});
