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
    const payload = jwt.decode(token);

    if (!payload?.sub) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // Supabase met le user.id dans "sub"
    // email dans "email"
    // rôle dans "role" (souvent "authenticated")
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
