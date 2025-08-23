import express from "express";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/* -----------------------
   📌 GET infos du JWT
------------------------ */
router.get("/me", requireAuth, (req, res) => {
  // req.user est déjà rempli par le middleware auth.js
  res.json({
    id: req.user.id,
    email: req.user.email,       // si tu veux inclure email (payload Supabase)
    role: req.user.role || "user"
  });
});

export default router;
