import { requireAdmin } from "./auth.js";
import { createClient } from "@supabase/supabase-js";

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
    const { form, file } = req.body || {};

    if (!form || !file) {
      return json(res, 400, { error: "Informations ou document manquants." });
    }

    const required = [
      "producteur_nom",
      "producteur_adresse",
      "producteur_siret",
      "producteur_representant",
      "producteur_qualite",
      "signer_email",
      "date_animation",
      "duree_jours",
      "montant_ttc",
    ];

    for (const field of required) {
      if (!String(form[field] ?? "").trim()) {
        return json(res, 400, { error: `Champ manquant : ${field}` });
      }
    }

    const email = String(form.signer_email).trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(res, 400, { error: "Adresse e-mail invalide." });
    }

    const buffer = Buffer.from(file, "base64");

    if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
      return json(res, 400, { error: "Document vide ou supérieur à 10 Mo." });
    }

    const contractData = {
      producteur_nom: String(form.producteur_nom).trim(),
      producteur_adresse: String(form.producteur_adresse).trim(),
      producteur_telephone: String(form.producteur_telephone || "").trim(),
      producteur_siret: String(form.producteur_siret).trim(),
      producteur_ape: String(form.producteur_ape || "").trim(),
      producteur_representant: String(form.producteur_representant).trim(),
      producteur_qualite: String(form.producteur_qualite).trim(),
      date_animation: form.date_animation,
      duree_jours: Number(form.duree_jours),
      montant_ttc: Number(form.montant_ttc),
      signer_email: email,
      status: "brouillon",
    };

    if (
      !Number.isInteger(contractData.duree_jours) ||
      contractData.duree_jours < 1 ||
      !Number.isFinite(contractData.montant_ttc) ||
      contractData.montant_ttc < 0
    ) {
      return json(res, 400, { error: "Durée ou montant invalide." });
    }

    const { data: contract, error: insertError } = await supabase
      .from("contracts")
      .insert(contractData)
      .select("id")
      .single();

    if (insertError) throw insertError;

    const filePath = `${contract.id}/Convention_STSO.docx`;

    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(filePath, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (uploadError) {
      await supabase.from("contracts").delete().eq("id", contract.id);
      throw uploadError;
    }

    const { error: updateError } = await supabase
      .from("contracts")
      .update({ prepared_file_path: filePath })
      .eq("id", contract.id);

    if (updateError) throw updateError;

    return json(res, 200, { contractId: contract.id });
  } catch (error) {
    console.error("Création convention :", error);
    return json(res, 500, { error: "Erreur lors de l'enregistrement de la convention." });
  }
}
