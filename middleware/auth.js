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
    // Vérifie le token avec le secret Supabase
    const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role || "authenticated"
    };

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
