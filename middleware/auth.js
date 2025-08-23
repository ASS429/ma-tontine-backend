// ESM
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // clé serveur confidentielle
);

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Token manquant" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Token invalide" });

    req.user = data.user; // { id, email, user_metadata, ... }
    next();
  } catch (e) {
    res.status(401).json({ error: "Authentification requise" });
  }
}

/* CJS:
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function requireAuth(req,res,next){ ... }
module.exports = { requireAuth };
*/
