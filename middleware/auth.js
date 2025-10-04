import jwt from "jsonwebtoken";
import pool from "../db.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.error("❌ Aucun header Authorization reçu");
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    console.error("❌ Mauvais format Authorization:", authHeader);
    return res.status(401).json({ error: "Invalid token format" });
  }

  try {
    // Vérifie le token avec le secret Supabase
    const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);

    console.log("✅ Payload décodé:", payload);

    // 🔎 Cherche l’utilisateur dans ta table `utilisateurs`
    const { rows } = await pool.query(
      "SELECT id, email, role FROM utilisateurs WHERE id=$1",
      [payload.sub]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: "Utilisateur non trouvé" });
    }

    req.user = {
      id: rows[0].id,
      email: rows[0].email,
      role: rows[0].role // ⚡ le vrai rôle (admin/user)
    };

    next();
  } catch (err) {
    console.error("❌ Auth error:", err.message);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
