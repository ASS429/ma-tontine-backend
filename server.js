import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import "dotenv/config";

import authRoutes from "./routes/auth.js";
import tontinesRoutes from "./routes/tontines.js";
import membresRoutes from "./routes/membres.js";
import paiementsRoutes from "./routes/paiements.js";
import tiragesRoutes from "./routes/tirages.js";
import statsRoutes from "./routes/stats.js";
import alertesRoutes from "./routes/alertes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// === CONFIG CORS ===
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

const corsOptions = {
  origin: allowedOrigin,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: "Origin,X-Requested-With,Content-Type,Accept,Authorization",
  credentials: true,
};

app.use(cors(corsOptions));
// 🔑 Important: gérer les preflight avant les routes
app.options("*", cors(corsOptions));

app.use(helmet());
app.use(express.json());
app.use(morgan("tiny"));

app.get("/health", (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use("/auth", authRoutes);
app.use("/tontines", tontinesRoutes);
app.use("/membres", membresRoutes);
app.use("/paiements", paiementsRoutes);
app.use("/tirages", tiragesRoutes);
app.use("/stats", statsRoutes);
app.use("/alertes", alertesRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: "Not Found" }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
