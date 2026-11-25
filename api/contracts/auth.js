import { createClient } from "@supabase/supabase-js";

export async function requireAdmin(req, res) {
  const authorization = req.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");

  if (!token) {
    res.status(401).json({ error: "Connexion requise." });
    return null;
  }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Session invalide." });
    return null;
  }

  return { user: data.user };
}
