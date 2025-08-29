import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
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
    // 🔍 Debug : affichons un extrait du token
    console.log("🔑 Token reçu (début):", token.substring(0, 20) + "...");

    // Vérifie le token avec le secret Supabase
    const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);

    // 🔍 Debug : affichons le payload décodé
    console.log("✅ Payload décodé:", payload);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role || "authenticated"
    };

    next();
  } catch (err) {
    console.error("❌ Auth error:", err.message);
    console.error("🔍 Vérifie que SUPABASE_JWT_SECRET est bien défini !");
    return res.status(401).json({ error: "Unauthorized" });
  }
}
