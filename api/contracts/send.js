import { requireAdmin } from "./auth.js";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(res, status, data) {
  return res.status(status).json(data);
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req, res);
if (!auth) return;
  if (req.method !== "POST") {
    return json(res, 405, { error: "Méthode non autorisée." });
  }

  try {
    const { contractId } = req.body || {};

    if (!contractId || !/^[0-9a-f-]{36}$/i.test(contractId)) {
      return json(res, 400, { error: "Identifiant de convention invalide." });
    }

    if (!process.env.RESEND_API_KEY) {
      return json(res, 500, { error: "La clé Resend n'est pas configurée." });
    }

    const { data: contract, error: findError } = await supabase
      .from("contracts")
      .select("id, producteur_nom, signer_email, prepared_file_path, status")
      .eq("id", contractId)
      .single();

    if (findError || !contract) {
      return json(res, 404, { error: "Convention introuvable." });
    }

    if (!contract.prepared_file_path || !contract.signer_email) {
      return json(res, 400, { error: "Convention ou e-mail du signataire manquant." });
    }

    if (contract.status === "signe" || contract.status === "annule") {
      return json(res, 400, { error: "Cette convention ne peut plus être envoyée." });
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("contracts")
      .update({
        sign_token_hash: tokenHash,
        sign_token_expires_at: expiresAt,
        status: "en_attente",
      })
      .eq("id", contract.id);

    if (updateError) throw updateError;

    const appUrl = (
      process.env.APP_URL ||
      (req.headers.origin && new URL(req.headers.origin).origin) ||
      `https://${req.headers.host}`
    ).replace(/\/$/, "");

    const signingUrl = `${appUrl}/sign/${token}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "STSO <onboarding@resend.dev>",
        to: [contract.signer_email],
        subject: "Votre convention de partenariat - Bistrot StSo",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222">
            <h2>Convention de partenariat - Bistrot StSo</h2>
            <p>Bonjour,</p>
            <p>Votre convention de partenariat concernant <strong>${String(contract.producteur_nom).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c])}</strong> est prête.</p>
            <p>Pour consulter et signer le document, cliquez sur le lien ci-dessous :</p>
            <p style="margin:30px 0">
              <a href="${signingUrl}" style="background:#222;color:white;padding:14px 22px;text-decoration:none;border-radius:6px">
                Consulter et signer la convention
              </a>
            </p>
            <p>Ce lien est personnel et valable pendant 7 jours.</p>
            <p>Le Bistrot StSo</p>
          </div>
        `,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      await supabase
        .from("contracts")
        .update({
          sign_token_hash: null,
          sign_token_expires_at: null,
          status: "brouillon",
        })
        .eq("id", contract.id);

      console.error("Resend :", emailResult);
      return json(res, 502, { error: "Resend n'a pas pu envoyer l'e-mail. Vérifie l'adresse d'expédition." });
    }

    return json(res, 200, { success: true });
  } catch (error) {
    console.error("Envoi convention :", error);
    return json(res, 500, { error: "Erreur lors de l'envoi de la convention." });
  }
}
