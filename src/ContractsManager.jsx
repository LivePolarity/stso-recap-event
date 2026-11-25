
import React, { useEffect, useRef, useState } from "react";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { renderAsync } from "docx-preview";

const TEMPLATE_URL = "/templates/ConventionDePartenariat_STSO_vierge.docx";

const initialForm = {
  producteur_nom: "",
  producteur_adresse: "",
  producteur_telephone: "",
  producteur_siret: "",
  producteur_ape: "",
  producteur_representant: "",
  producteur_qualite: "",
  date_animation: "",
  duree_jours: "1",
  montant_ttc: "",
  date_signature: new Date().toISOString().slice(0, 10),
};

function formatDate(date) {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export default function ContractsManager() {
  const [form, setForm] = useState(initialForm);
  const [documentBlob, setDocumentBlob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const previewRef = useRef(null);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  useEffect(() => {
    if (!documentBlob || !previewRef.current) return;

    const container = previewRef.current;
    container.innerHTML = "";

    renderAsync(documentBlob, container, undefined, {
      className: "docx-preview",
      inWrapper: true,
      breakPages: true,
    }).catch(() => {
      setError("Impossible d'afficher l'aperçu du document.");
    });
  }, [documentBlob]);

  async function generateContract(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setDocumentBlob(null);

    try {
      const response = await fetch(TEMPLATE_URL);

      if (!response.ok) {
        throw new Error(
          "Modèle Word introuvable. Vérifie son emplacement et son nom dans public/templates."
        );
      }

      const content = await response.arrayBuffer();
      const zip = new PizZip(content);

      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.render({
        ...form,
        date_animation: formatDate(form.date_animation),
        date_signature: formatDate(form.date_signature),
        duree_jours: form.duree_jours,
        montant_ttc: form.montant_ttc,
      });

      const blob = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      setDocumentBlob(blob);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Une erreur est survenue pendant la génération du contrat."
      );
    } finally {
      setLoading(false);
    }
  }

  function downloadContract() {
    if (!documentBlob) return;

    const url = URL.createObjectURL(documentBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Convention_STSO_${form.producteur_nom || "nouveau"}.docx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const fields = [
    ["producteur_nom", "Nom du producteur", "text", true],
    ["producteur_adresse", "Adresse", "text", true],
    ["producteur_telephone", "Téléphone", "tel", false],
    ["producteur_siret", "N° de SIRET", "text", true],
    ["producteur_ape", "Code APE", "text", false],
    ["producteur_representant", "Nom du représentant", "text", true],
    ["producteur_qualite", "Agissant en qualité de", "text", true],
  ];

  const inputStyle = {
    width: "100%",
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    boxSizing: "border-box",
    fontSize: "14px",
  };

  const labelStyle = {
    display: "block",
    marginBottom: "6px",
    fontWeight: "600",
    fontSize: "14px",
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
      <h2>Nouvelle convention de partenariat</h2>
      <p>Renseigne les informations nécessaires à la préparation du contrat.</p>

      <form onSubmit={generateContract}>
        <h3>Informations du producteur</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
          }}
        >
          {fields.map(([name, label, type, required]) => (
            <div key={name}>
              <label style={labelStyle} htmlFor={name}>
                {label}
              </label>
              <input
                id={name}
                name={name}
                type={type}
                value={form[name]}
                onChange={updateField}
                required={required}
                style={inputStyle}
              />
            </div>
          ))}
        </div>

        <h3 style={{ marginTop: "28px" }}>Informations de l'animation</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          <div>
            <label style={labelStyle} htmlFor="date_animation">
              Date de l'animation
            </label>
            <input
              id="date_animation"
              name="date_animation"
              type="date"
              value={form.date_animation}
              onChange={updateField}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="duree_jours">
              Durée (en jours)
            </label>
            <input
              id="duree_jours"
              name="duree_jours"
              type="number"
              min="1"
              value={form.duree_jours}
              onChange={updateField}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="montant_ttc">
              Rémunération TTC par animation (€)
            </label>
            <input
              id="montant_ttc"
              name="montant_ttc"
              type="number"
              min="0"
              step="0.01"
              value={form.montant_ttc}
              onChange={updateField}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="date_signature">
              Date de signature prévue
            </label>
            <input
              id="date_signature"
              name="date_signature"
              type="date"
              value={form.date_signature}
              onChange={updateField}
              required
              style={inputStyle}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: "24px",
            padding: "12px 20px",
            background: "#222",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          {loading ? "Génération en cours..." : "Générer et prévisualiser le contrat"}
        </button>
      </form>

      {error && (
        <p style={{ color: "#c62828", marginTop: "16px" }}>{error}</p>
      )}

      {documentBlob && (
        <section style={{ marginTop: "36px" }}>
          <h3>Aperçu du contrat</h3>
          <p>Vérifie attentivement le document avant de l'utiliser.</p>

          <button
            type="button"
            onClick={downloadContract}
            style={{
              padding: "12px 20px",
              background: "#236b45",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              marginBottom: "20px",
            }}
          >
            Télécharger le contrat Word
          </button>

          <div
            ref={previewRef}
            style={{
              background: "#eee",
              padding: "16px",
              borderRadius: "8px",
              overflowX: "auto",
            }}
          />
        </section>
      )}
    </div>
  );
}
