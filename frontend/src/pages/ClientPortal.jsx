import React, { useState, useEffect, useCallback } from "react";
import {
  Stamp,
  FileCheck2,
  CheckCircle2,
  ArrowLeft,
  Copy,
  Plus,
  Loader2,
  Search,
  AlertCircle,
} from "lucide-react";
import {
  inputStyle,
  API_BASE_URL,
  C,
  COUNTRIES,
  Checklist,
  Field,
  Honeypot,
  Logo,
  MOTIFS,
  PRICING,
  PrimaryButton,
  SITUATIONS,
  Seal,
  Stars,
  StatusStepper,
  appointmentPrice,
  progressOf,
  apiCreateDossier,
  apiGetDossier,
  apiCheckPaymentStatus,
  apiUpdateDossier,
  apiCheckout,
  apiSubmitReview,
  apiReviewExists,
} from "../shared";

export function ClientPortal({ onBack, prefill, initialDossier, initialShowPaidModal, initialUnconfirmedPayment }) {
  const [mode, setMode] = useState(initialDossier ? "dossier" : prefill ? "onboarding" : "choice"); // choice | lookup | onboarding | dossier
  const [dossier, setDossier] = useState(initialDossier || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refInput, setRefInput] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    nom: "",
    telephone: "",
    pays: prefill?.pays || COUNTRIES[0],
    motif: prefill?.motif || "",
    situation: prefill?.situation || "",
    site_web: "",
  });
  const [selectedTier, setSelectedTier] = useState(prefill?.tier || null);

  const [reviewDone, setReviewDone] = useState(false);
  const [reviewNote, setReviewNote] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewHoneypot, setReviewHoneypot] = useState("");
  const [reviewSent, setReviewSent] = useState(false);
  const [showPaidModal, setShowPaidModal] = useState(!!initialShowPaidModal);
  const [unconfirmedBanner, setUnconfirmedBanner] = useState(!!initialUnconfirmedPayment);

  useEffect(() => {
    if (dossier?.paid) {
      apiReviewExists(dossier.ref)
        .then(setReviewDone)
        .catch(() => {});
    }
  }, [dossier?.ref, dossier?.paid]);

  const handleSubmitReview = async () => {
    if (!reviewNote) {
      setError("Merci de choisir une note avant d'envoyer.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await apiSubmitReview(dossier.ref, reviewNote, reviewComment, reviewHoneypot);
      setReviewSent(true);
      setReviewDone(true);
    } catch (e) {
      setError(e.message || "Erreur lors de l'envoi de l'avis.");
    }
    setLoading(false);
  };

  const handleLookup = async () => {
    setError("");
    if (!refInput.trim() || !lookupPhone.trim()) {
      setError("Merci de renseigner la référence et le numéro de téléphone du dossier.");
      return;
    }
    setLoading(true);
    try {
      const found = await apiGetDossier(refInput, lookupPhone);
      if (!found) {
        setError("Aucun dossier trouvé pour cette référence.");
      } else {
        setDossier(found);
        setMode("dossier");
      }
    } catch (e) {
      setError(e.message || "Impossible de joindre le serveur. Réessayez.");
    }
    setLoading(false);
  };

  const handleContinueToPayment = async () => {
    if (!form.nom.trim() || !form.motif || !form.situation) {
      setError("Merci de compléter tous les champs.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const created = await apiCreateDossier(form);
      setDossier(created);
      setMode("paiement");
    } catch {
      setError("Impossible de créer le dossier. Vérifiez que le serveur est démarré.");
    }
    setLoading(false);
  };

  const handlePay = async () => {
    if (!selectedTier) {
      setError("Merci de choisir une offre.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { checkout_url, token } = await apiCheckout(dossier.ref, selectedTier);
      localStorage.setItem("vp_pending_payment", JSON.stringify({ ref: dossier.ref, telephone: dossier.telephone, token }));
      window.location.href = checkout_url;
    } catch (e) {
      setError(e.message || "Erreur lors de la création du paiement.");
      setLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    setLoading(true);
    setError("");
    try {
      let refreshed = await apiGetDossier(dossier.ref, dossier.telephone);

      // Filet de sécurité : si toujours pas payé, on interroge PayDunya
      // directement au cas où le webhook n'aurait pas encore été reçu
      if (!refreshed.paid) {
        try {
          const pendingRaw = localStorage.getItem("vp_pending_payment");
          const pending = pendingRaw ? JSON.parse(pendingRaw) : null;
          if (pending?.ref === dossier.ref && pending?.token) {
            await apiCheckPaymentStatus(pending.token);
            refreshed = await apiGetDossier(dossier.ref, dossier.telephone);
          }
        } catch {
          // le filet de sécurité a échoué, on continue avec ce qu'on a
        }
      }

      const justPaid = refreshed.paid && !dossier.paid;
      setDossier(refreshed);
      if (refreshed.paid) {
        setMode("dossier");
        if (justPaid) setShowPaidModal(true);
      } else {
        setError("Paiement pas encore confirmé — patientez quelques secondes après avoir payé, puis réessayez.");
      }
    } catch {
      setError("Impossible de vérifier le paiement pour le moment.");
    }
    setLoading(false);
  };

  const toggleDoc = async (id) => {
    const updatedDocs = dossier.documents.map((d) => (d.id === id ? { ...d, checked: !d.checked } : d));
    setDossier({ ...dossier, documents: updatedDocs });
    try {
      await apiUpdateDossier(dossier.ref, { documents: updatedDocs, telephone: dossier.telephone });
    } catch {
      // la mise à jour locale reste visible même si la sauvegarde échoue
    }
  };

  const updateNote = async (id, note) => {
    const updatedDocs = dossier.documents.map((d) => (d.id === id ? { ...d, note } : d));
    setDossier({ ...dossier, documents: updatedDocs });
    try {
      await apiUpdateDossier(dossier.ref, { documents: updatedDocs, telephone: dossier.telephone });
    } catch {
      // la mise à jour locale reste visible même si la sauvegarde échoue
    }
  };

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(dossier.ref);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore silently
    }
  };

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: C.paper }}>
      <div className="max-w-md mx-auto">
        <button
          onClick={() => {
            if (mode === "choice") onBack();
            else if (mode === "recu" || mode === "avis") setMode("dossier");
            else setMode("choice");
          }}
          className="flex items-center gap-1 mb-6"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <ArrowLeft size={16} color={C.slate} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>Retour</span>
        </button>

        {mode === "choice" && (
          <div className="flex flex-col gap-3">
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 22, color: C.navy }}>
              Votre dossier
            </h2>
            <button
              onClick={() => setMode("onboarding")}
              className="flex items-center gap-3 p-4 w-full text-left"
              style={{ background: C.navy, color: "#fff", border: "none" }}
            >
              <Plus size={18} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14 }}>
                Créer un nouveau dossier
              </span>
            </button>
            <button
              onClick={() => setMode("lookup")}
              className="flex items-center gap-3 p-4 w-full text-left"
              style={{ background: C.paperCard, border: `1px solid ${C.line}` }}
            >
              <Search size={18} color={C.navy} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: C.ink }}>
                Retrouver mon dossier existant
              </span>
            </button>
          </div>
        )}

        {mode === "lookup" && (
          <div className="flex flex-col gap-4">
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 22, color: C.navy }}>
              Retrouver mon dossier
            </h2>
            <Field label="Référence du dossier">
              <input
                style={inputStyle}
                placeholder="VP-2026-1234"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
              />
            </Field>
            <Field label="Numéro de téléphone du dossier">
              <input
                style={inputStyle}
                placeholder="77 000 00 00"
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
              />
            </Field>
            {error && (
              <p className="flex items-center gap-2" style={{ color: C.stamp, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                <AlertCircle size={14} /> {error}
              </p>
            )}
            <PrimaryButton onClick={handleLookup} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Retrouver"}
            </PrimaryButton>
          </div>
        )}

        {mode === "onboarding" && (
          <div className="flex flex-col gap-4">
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 22, color: C.navy }}>
              Nouveau dossier
            </h2>
            <Honeypot value={form.site_web} onChange={(v) => setForm({ ...form, site_web: v })} />
            <Field label="Nom complet">
              <input style={inputStyle} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </Field>
            <Field label="Téléphone">
              <input style={inputStyle} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
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
                <option value="">Sélectionner…</option>
                {MOTIFS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Situation professionnelle">
              <select style={inputStyle} value={form.situation} onChange={(e) => setForm({ ...form, situation: e.target.value })}>
                <option value="">Sélectionner…</option>
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
            <PrimaryButton onClick={handleContinueToPayment} disabled={loading}>
              Choisir mon offre
            </PrimaryButton>
          </div>
        )}

        {mode === "paiement" && (
          <div className="flex flex-col gap-4">
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 22, color: C.navy }}>
              Choisissez votre offre
            </h2>
            <div className="flex flex-col gap-3">
              {PRICING.map((tier) => {
                const active = selectedTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    className="flex flex-col gap-1 p-4 text-left w-full relative"
                    style={{
                      background: active ? `linear-gradient(135deg, ${C.gradA}12, ${C.gradC}12)` : C.paperCard,
                      borderRadius: 14,
                      border: `2px solid ${active ? C.gradB : C.line}`,
                      boxShadow: active ? `0 8px 22px -12px ${C.gradB}35` : "none",
                      transform: active ? "scale(1.015)" : "scale(1)",
                      transition: "all 0.18s ease",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className="flex items-center justify-center shrink-0"
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 999,
                            border: `2px solid ${active ? C.gradB : C.line}`,
                            background: active ? C.ink : "transparent",
                            transition: "all 0.18s ease",
                          }}
                        >
                          {active && <CheckCircle2 size={20} color="#fff" style={{ marginLeft: -2, marginTop: -2 }} />}
                        </span>
                        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: C.ink }}>
                          {tier.label}
                        </span>
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: active ? C.gradB : C.gold, fontWeight: 600 }}>
                        {tier.id === "rdv" ? `${appointmentPrice(dossier.pays).toLocaleString("fr-FR")} FCFA` : tier.price}
                      </span>
                    </div>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate, marginLeft: 28 }}>
                      {tier.desc}
                    </span>
                  </button>
                );
              })}
            </div>
            {!selectedTier && (
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.slate, textAlign: "center" }}>
                Choisissez une offre ci-dessus, puis payez juste en dessous.
              </p>
            )}
            {error && (
              <p className="flex items-center gap-2" style={{ color: C.stamp, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                <AlertCircle size={14} /> {error}
              </p>
            )}
            <PrimaryButton onClick={handlePay} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Payer maintenant"}
            </PrimaryButton>
          </div>
        )}

        {mode === "verification" && (
          <div className="flex flex-col gap-4 items-center text-center py-6">
            <Stamp size={28} color={C.gold} />
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 20, color: C.navy }}>
              Paiement en cours
            </h2>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>
              Si vous revenez d'un paiement qui vient de se terminer, cliquez ci-dessous pour confirmer.
            </p>
            {error && (
              <p className="flex items-center gap-2" style={{ color: C.stamp, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                <AlertCircle size={14} /> {error}
              </p>
            )}
            <PrimaryButton onClick={handleVerifyPayment} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : "J'ai payé — vérifier"}
            </PrimaryButton>
          </div>
        )}

        {mode === "dossier" && dossier && (
          <div className="flex flex-col gap-6">
            {unconfirmedBanner && (
              <div
                className="flex flex-col gap-2 p-4"
                style={{ background: "#FFF8E8", border: "1px solid #F0D999", borderRadius: 12 }}
              >
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#7A5B00", fontWeight: 600 }}>
                  Vérification du paiement en cours
                </p>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: "#7A5B00" }}>
                  Votre paiement a peut-être été accepté, mais la confirmation prend plus de temps que prévu.
                  Réessayez dans une minute avec le bouton ci-dessous, ou gardez votre référence {dossier.ref}.
                </p>
                <button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const refreshed = await apiGetDossier(dossier.ref, dossier.telephone);
                      if (refreshed) setDossier(refreshed);
                      if (refreshed?.paid) {
                        setUnconfirmedBanner(false);
                        setShowPaidModal(true);
                      }
                    } catch {
                      // on laisse la bannière, l'utilisateur peut réessayer
                    }
                    setLoading(false);
                  }}
                  disabled={loading}
                  className="self-start px-3 py-1.5"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#7A5B00",
                    background: "#fff",
                    border: "1px solid #F0D999",
                  }}
                >
                  {loading ? "Vérification…" : "Vérifier à nouveau"}
                </button>
              </div>
            )}
            <div className="flex items-center gap-4">
              <Seal percent={progressOf(dossier)} />
              <div className="flex-1">
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 18, color: C.navy }}>
                  {dossier.nom}
                </p>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>
                  {dossier.pays} · {MOTIFS.find((m) => m.id === dossier.motif)?.label}
                  {dossier.tier && ` · Offre ${PRICING.find((t) => t.id === dossier.tier)?.label}`}
                </p>
                <button
                  onClick={copyRef}
                  className="flex items-center gap-1 mt-1"
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                >
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.gold }}>
                    {dossier.ref}
                  </span>
                  <Copy size={12} color={C.gold} />
                  {copied && <span style={{ fontSize: 11, color: C.green }}>copié</span>}
                </button>
              </div>
            </div>

            <div>
              <p
                className="uppercase mb-2"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.slate, letterSpacing: "0.08em" }}
              >
                Statut du dossier
              </p>
              <StatusStepper status={dossier.status} editable={false} />
            </div>

            <div>
              <p
                className="uppercase mb-2"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.slate, letterSpacing: "0.08em" }}
              >
                Documents à réunir
              </p>
              <Checklist documents={dossier.documents} onToggle={toggleDoc} onNoteChange={updateNote} />
            </div>

            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.slate }}>
              Conservez votre référence <strong>{dossier.ref}</strong> pour retrouver ce dossier plus tard.
            </p>

            {!dossier.paid && (
              <div className="flex flex-col gap-2">
                <PrimaryButton
                  onClick={() => {
                    // Réveil discret de Render (plan gratuit) le plus tôt possible,
                    // pour que le webhook de retour de paiement le trouve déjà actif.
                    fetch(API_BASE_URL).catch(() => {});
                    setMode("paiement");
                  }}
                >
                  Payer maintenant
                </PrimaryButton>
                <button
                  onClick={() => setMode("verification")}
                  style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.slate, background: "transparent", border: "none", cursor: "pointer" }}
                >
                  J'ai déjà payé — vérifier
                </button>
              </div>
            )}

            {dossier.paid && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setMode("recu")}
                  className="flex items-center justify-center gap-2 p-3 w-full"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: 13.5,
                    color: C.ink,
                    background: "#fff",
                    border: `1.5px solid ${C.line}`,
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                >
                  <FileCheck2 size={16} color={C.gradB} /> Voir mon reçu de paiement
                </button>

                {!reviewDone && (
                  <div
                    className="flex flex-col items-center gap-2 p-4 text-center"
                    style={{ background: `linear-gradient(135deg, ${C.gradA}0d, ${C.gradC}0d)`, borderRadius: 14, border: `1px solid ${C.line}` }}
                  >
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: C.ink }}>
                      Comment s'est passée votre expérience ?
                    </span>
                    <button
                      onClick={() => setMode("avis")}
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 600,
                        fontSize: 13,
                        color: "#fff",
                        background: C.ink,
                        border: "none",
                        borderRadius: 10,
                        padding: "8px 16px",
                        cursor: "pointer",
                      }}
                    >
                      Laisser un avis
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {mode === "recu" && dossier && (
          <div className="flex flex-col gap-5">
            <div className="print-receipt flex flex-col items-center gap-3 p-6" style={{ background: "#fff", borderRadius: 18, border: `1px solid ${C.line}` }}>
              <Logo size={32} />
              <span className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.12em", color: C.slate }}>
                Reçu de paiement
              </span>
              <span
                className="uppercase"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                  color: C.green,
                  background: `${C.green}18`,
                  padding: "4px 12px",
                  borderRadius: 999,
                }}
              >
                Payé
              </span>

              <div className="w-full flex flex-col gap-3 mt-2" style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 16 }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>Numéro de suivi</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: C.ink }}>{dossier.ref}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>Client</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ink }}>{dossier.nom}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>Offre</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ink }}>
                    {PRICING.find((t) => t.id === dossier.tier)?.label || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>Montant</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: C.gradB }}>
                    {dossier.tier === "rdv" ? `${appointmentPrice(dossier.pays).toLocaleString("fr-FR")} FCFA` : PRICING.find((t) => t.id === dossier.tier)?.price || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>Date</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.ink }}>
                    {dossier.paid_at ? new Date(dossier.paid_at).toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="no-print flex items-center justify-center gap-2 p-3 w-full"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 13.5,
                color: "#fff",
                background: C.ink,
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              Imprimer / Enregistrer en PDF
            </button>
            <p className="no-print text-center" style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: C.slate }}>
              Conservez ce numéro de suivi ({dossier.ref}) : il fait foi en cas de question sur votre dossier.
            </p>
          </div>
        )}

        {mode === "avis" && dossier && (
          <div className="flex flex-col gap-4">
            {!reviewSent ? (
              <>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 20, color: C.navy }}>
                  Votre avis compte
                </h2>
                <Honeypot value={reviewHoneypot} onChange={setReviewHoneypot} />
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>
                  Dossier {dossier.ref} — quelques secondes pour partager votre expérience.
                </p>
                <div className="flex justify-center py-2">
                  <Stars value={reviewNote} size={32} interactive onChange={setReviewNote} />
                </div>
                <Field label="Un commentaire (facultatif)">
                  <textarea
                    style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Ce que vous avez apprécié, ou ce qu'on peut améliorer…"
                  />
                </Field>
                {error && (
                  <p className="flex items-center gap-2" style={{ color: C.stamp, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
                    <AlertCircle size={14} /> {error}
                  </p>
                )}
                <PrimaryButton onClick={handleSubmitReview} disabled={loading}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Envoyer mon avis"}
                </PrimaryButton>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CheckCircle2 size={36} color={C.green} />
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 17, color: C.ink }}>
                  Merci pour votre avis !
                </span>
                <button
                  onClick={() => setMode("dossier")}
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: C.gradB,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Retour au dossier
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showPaidModal && (
        <div
          className="fixed inset-0 flex items-center justify-center px-5 z-50"
          style={{ background: "rgba(10,10,20,0.55)", backdropFilter: "blur(3px)" }}
        >
          <div
            className="w-full max-w-xs flex flex-col items-center text-center gap-3 p-7"
            style={{ background: "#fff", borderRadius: 20, animation: "popIn 0.35s cubic-bezier(.2,.9,.3,1) both" }}
          >
            <span
              className="flex items-center justify-center"
              style={{ width: 56, height: 56, borderRadius: 999, background: `${C.green}18` }}
            >
              <CheckCircle2 size={30} color={C.green} />
            </span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 19, color: C.ink }}>
              Paiement effectué !
            </span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>
              Votre numéro de dossier :
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                fontSize: 20,
                color: C.gradB,
                background: `${C.gradB}12`,
                padding: "8px 18px",
                borderRadius: 10,
                letterSpacing: "0.03em",
              }}
            >
              {dossier?.ref}
            </span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.slate }}>
              Conservez-le : il permet de retrouver votre dossier à tout moment.
            </span>
            <div className="flex flex-col gap-2 w-full mt-2">
              <button
                onClick={() => {
                  setShowPaidModal(false);
                  setMode("recu");
                }}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  fontSize: 13.5,
                  color: "#fff",
                  background: C.ink,
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 0",
                  cursor: "pointer",
                }}
              >
                Voir mon reçu
              </button>
              <button
                onClick={() => setShowPaidModal(false)}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  color: C.slate,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}