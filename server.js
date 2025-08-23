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

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/tontines", tontinesRoutes);
app.use("/api/membres", membresRoutes);
app.use("/api/cotisations", cotisationsRoutes);
app.use("/api/utilisateurs", utilisateursRoutes);
app.use("/api/auth", authRoutes);



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API démarrée sur : ${PORT}`));

/* CJS:
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const tontinesRoutes = require("./routes/tontines");
...
*/
