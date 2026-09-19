import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  inputStyle,
  C,
  COUNTRIES,
  Checklist,
  Field,
  Honeypot,
  MOTIFS,
  PrimaryButton,
  SITUATIONS,
  apiSubmitLead,
} from "../shared";

export function FreeChecklistTool({ onBack, onContinue }) {
  const [form, setForm] = useState({ nom: "", telephone: "", pays: "France", motif: "", situation: "", site_web: "" });
  const [documents, setDocuments] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!form.nom.trim() || !form.telephone.trim() || !form.motif || !form.situation) {
      setError("Merci de remplir tous les champs.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { documents } = await apiSubmitLead(form.nom.trim(), form.telephone.trim(), form.motif, form.situation, form.pays, form.site_web);
      setDocuments(documents);
    } catch (e) {
      setError(e.message || "Impossible de générer la liste pour le moment.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: C.paper }}>
      <div className="max-w-md mx-auto flex flex-col gap-5">
        <button onClick={onBack} className="flex items-center gap-1" style={{ background: "transparent", border: "none", cursor: "pointer" }}>
          <ArrowLeft size={16} color={C.slate} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>Retour</span>
        </button>

        {!documents ? (
          <>
            <div className="flex flex-col gap-1">
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: C.navy }}>
                Votre liste de documents, gratuite
              </h2>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>
                Deux infos, et votre liste personnalisée s'affiche tout de suite.
              </p>
            </div>
            <Honeypot value={form.site_web} onChange={(v) => setForm({ ...form, site_web: v })} />

            <Field label="Nom complet">
              <input style={inputStyle} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </Field>
            <Field label="Numéro WhatsApp">
              <input style={inputStyle} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="77 000 00 00" />
            </Field>
            <Field label="Pays de destination">
              <select style={inputStyle} value={form.pays} onChange={(e) => setForm({ ...form, pays: e.target.value })}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Motif du voyage">
              <select style={inputStyle} value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })}>
                <option value="">Choisir…</option>
                {MOTIFS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Votre situation">
              <select style={inputStyle} value={form.situation} onChange={(e) => setForm({ ...form, situation: e.target.value })}>
                <option value="">Choisir…</option>
                {SITUATIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Field>

            {error && (
              <p className="flex items-center gap-2" style={{ color: C.stamp, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                <AlertCircle size={14} /> {error}
              </p>
            )}
            <PrimaryButton onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Voir ma liste de documents"}
            </PrimaryButton>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: C.slate, textAlign: "center" }}>
              Utilisé uniquement pour vous transmettre des informations utiles à votre dossier.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: C.navy }}>
                Voici votre liste de documents
              </h2>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>
                Personnalisée selon votre motif et votre situation.
              </p>
            </div>
            <Checklist documents={documents} onToggle={() => {}} onNoteChange={() => {}} editable={false} />

            <div
              className="flex flex-col gap-3 p-5"
              style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.stamp}44` }}
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} color={C.stamp} style={{ flexShrink: 0, marginTop: 1 }} />
                <div className="flex flex-col gap-1">
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5, color: C.ink }}>
                    Ce que coûte un refus
                  </span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate, lineHeight: 1.55 }}>
                    Les frais consulaires (90 € / environ 59 000 FCFA) ne sont <strong>jamais remboursés</strong> en cas de refus — quelle qu'en soit la raison. Un dossier mal justifié fait perdre cette somme et retarde le voyage le temps d'un nouveau rendez-vous.
                  </span>
                </div>
              </div>
            </div>

            <div
              className="flex flex-col items-center gap-3 p-5 text-center"
              style={{ background: `linear-gradient(135deg, ${C.gradA}0d, ${C.gradC}0d)`, borderRadius: 16, border: `1px solid ${C.line}` }}
            >
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15, color: C.ink }}>
                Deux façons de sécuriser votre dossier
              </span>

              <button
                onClick={() => onContinue({ motif: form.motif, situation: form.situation, pays: form.pays, tier: "verification" })}
                className="w-full flex items-center justify-between gap-3 p-4 text-left"
                style={{ background: "#fff", border: `1.5px solid ${C.line}`, borderRadius: 12, cursor: "pointer" }}
              >
                <span className="flex flex-col">
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 13.5, color: C.ink }}>
                    Faire vérifier mon dossier
                  </span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.slate }}>
                    Vous le montez vous-même, un conseiller le relit avant dépôt
                  </span>
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 13, color: C.gradB, whiteSpace: "nowrap" }}>
                  10 000 F
                </span>
              </button>

              <button
                onClick={() => onContinue({ motif: form.motif, situation: form.situation, pays: form.pays })}
                className="w-full"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  fontSize: 13.5,
                  color: "#fff",
                  background: C.ink,
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 20px",
                  cursor: "pointer",
                }}
              >
                Être accompagné de A à Z
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
