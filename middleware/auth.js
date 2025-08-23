import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Invalid token format" });
  }

  try {
    // ⚠️ On ne vérifie pas la signature avec la clé privée (elle est chez Supabase)
    // Mais on peut décoder le payload JWT qui contient l'ID utilisateur (champ "sub")
    const payload = jwt.decode(token);

    if (!payload?.sub) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    req.user = { id: payload.sub }; // user.id = UUID Supabase
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
