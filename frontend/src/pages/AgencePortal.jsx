import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  FileCheck2,
  ArrowLeft,
  Users,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  inputStyle,
  C,
  Checklist,
  Field,
  MOTIFS,
  PRICING,
  PrimaryButton,
  SITUATIONS,
  STATUS_BADGE,
  STATUS_STEPS,
  Seal,
  Stars,
  StatusStepper,
  progressOf,
  apiUpdateDossier,
  apiListDossiers,
  apiAgenceLogin,
  apiGetStats,
  apiDeleteDossier,
  apiListLeads,
  apiDeleteLead,
} from "../shared";

export function AgencePortal({ onBack, agencePin }) {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("tous");
  const [stats, setStats] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState("dossiers"); // dossiers | prospects
  const [leads, setLeads] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await apiListDossiers(agencePin);
      setDossiers(all);
    } catch {
      setDossiers([]);
    }
    setLoading(false);
  }, [agencePin]);

  useEffect(() => {
    refresh();
    apiGetStats(agencePin)
      .then(setStats)
      .catch(() => setStats(null));
    apiListLeads(agencePin)
      .then(setLeads)
      .catch(() => setLeads([]));
  }, [refresh, agencePin]);

  const handleDeleteLead = async (id) => {
    try {
      await apiDeleteLead(id, agencePin);
      setLeads((prev) => prev.filter((l) => l.id !== id));
    } catch {
      // pas grave, l'agence peut réessayer
    }
  };

  const updateSelected = async (updated) => {
    setSelected(updated);
    try {
      const saved = await apiUpdateDossier(
        updated.ref,
        { documents: updated.documents, notes: updated.notes, status: updated.status, decision: updated.decision },
        agencePin
      );
      setDossiers((prev) => prev.map((d) => (d.ref === saved.ref ? saved : d)));
    } catch {
      // la mise à jour locale reste visible même si la sauvegarde échoue
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await apiDeleteDossier(selected.ref, agencePin);
      setDossiers((prev) => prev.filter((d) => d.ref !== selected.ref));
      setSelected(null);
      setConfirmDelete(false);
    } catch {
      // en cas d'échec, on laisse l'agence réessayer
    }
    setDeleting(false);
  };

  const exportExcel = () => {
    const header = ["Référence", "Nom", "Téléphone", "Pays", "Motif", "Offre", "Statut", "Payé", "Créé le"];
    const rows = dossiers.map((d) => [
      d.ref,
      d.nom,
      d.telephone || "",
      d.pays || "",
      MOTIFS.find((m) => m.id === d.motif)?.label || d.motif || "",
      PRICING.find((t) => t.id === d.tier)?.label || "",
      STATUS_BADGE[d.status]?.label || d.status,
      d.paid ? "Oui" : "Non",
      d.created_at ? new Date(d.created_at).toLocaleDateString("fr-FR") : "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [
      { wch: 14 }, // Référence
      { wch: 22 }, // Nom
      { wch: 15 }, // Téléphone
      { wch: 14 }, // Pays
      { wch: 14 }, // Motif
      { wch: 16 }, // Offre
      { wch: 16 }, // Statut
      { wch: 8 },  // Payé
      { wch: 12 }, // Créé le
    ];
    ws["!autofilter"] = { ref: `A1:I${rows.length + 1}` };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dossiers");
    XLSX.writeFile(wb, `dossiers-visassistance-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const filtered = dossiers.filter((d) => {
    const matchesQuery =
      !query ||
      d.nom.toLowerCase().includes(query.toLowerCase()) ||
      d.ref.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "tous" || d.status === filter;
    return matchesQuery && matchesFilter;
  });

  if (selected) {
    return (
      <div className="min-h-screen px-5 py-8" style={{ background: C.paper }}>
        <div className="max-w-md mx-auto flex flex-col gap-6">
          <button
            onClick={() => {
              setSelected(null);
              setConfirmDelete(false);
            }}
            className="flex items-center gap-1"
            style={{ background: "transparent", border: "none", cursor: "pointer" }}
          >
            <ArrowLeft size={16} color={C.slate} />
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>
              Tous les dossiers
            </span>
          </button>

          <div className="flex items-center gap-4">
            <Seal percent={progressOf(selected)} />
            <div>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 18, color: C.navy }}>
                {selected.nom}
              </p>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>
                {selected.pays} · {selected.telephone || "—"}
                {selected.tier && ` · Offre ${PRICING.find((t) => t.id === selected.tier)?.label}`}
              </p>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.gold }}>
                {selected.ref}
              </span>
            </div>
          </div>

          <div>
            <p
              className="uppercase mb-2"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.slate, letterSpacing: "0.08em" }}
            >
              Statut — cliquer pour mettre à jour
            </p>
            <StatusStepper
              status={selected.status}
              editable
              onChange={(status) => updateSelected({ ...selected, status })}
            />
            {selected.status === "decision" && (
              <div className="flex gap-2 mt-2 ml-9">
                <button
                  onClick={() => updateSelected({ ...selected, decision: "accepte" })}
                  className="px-3 py-1.5"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    background: selected.decision === "accepte" ? C.green : "transparent",
                    color: selected.decision === "accepte" ? "#fff" : C.green,
                    border: `1px solid ${C.green}`,
                  }}
                >
                  Accepté
                </button>
                <button
                  onClick={() => updateSelected({ ...selected, decision: "refuse" })}
                  className="px-3 py-1.5"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    background: selected.decision === "refuse" ? C.stamp : "transparent",
                    color: selected.decision === "refuse" ? "#fff" : C.stamp,
                    border: `1px solid ${C.stamp}`,
                  }}
                >
                  Refusé
                </button>
              </div>
            )}
          </div>

          <div>
            <p
              className="uppercase mb-2"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.slate, letterSpacing: "0.08em" }}
            >
              Documents
            </p>
            <Checklist
              documents={selected.documents}
              onToggle={(id) =>
                updateSelected({
                  ...selected,
                  documents: selected.documents.map((d) => (d.id === id ? { ...d, checked: !d.checked } : d)),
                })
              }
              onNoteChange={(id, note) =>
                updateSelected({
                  ...selected,
                  documents: selected.documents.map((d) => (d.id === id ? { ...d, note } : d)),
                })
              }
            />
          </div>

          <Field label="Notes internes">
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
              value={selected.notes || ""}
              onChange={(e) => setSelected({ ...selected, notes: e.target.value })}
              onBlur={() => updateSelected(selected)}
            />
          </Field>

          <div className="flex flex-col gap-2 pt-2" style={{ borderTop: `1px dashed ${C.line}` }}>
            {confirmDelete && (
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.stamp }}>
                Confirmez : ce dossier et son avis éventuel seront supprimés définitivement.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  color: confirmDelete ? "#fff" : C.stamp,
                  background: confirmDelete ? C.stamp : "transparent",
                  border: `1.5px solid ${C.stamp}`,
                  borderRadius: 10,
                  cursor: "pointer",
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : confirmDelete ? "Confirmer la suppression" : "Supprimer ce dossier"}
              </button>
              {confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="py-2.5 px-4"
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, color: C.slate, background: "transparent", border: `1.5px solid ${C.line}`, borderRadius: 10, cursor: "pointer" }}
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-8" style={{ background: C.paper }}>
      <div className="max-w-md mx-auto flex flex-col gap-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <ArrowLeft size={16} color={C.slate} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>Retour</span>
        </button>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={20} color={C.navy} />
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 22, color: C.navy }}>
              Dossiers clients
            </h2>
          </div>
          {dossiers.length > 0 && (
            <button
              onClick={exportExcel}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 12,
                color: C.gradB,
                background: `${C.gradB}12`,
                border: "none",
                borderRadius: 8,
                padding: "7px 12px",
                cursor: "pointer",
              }}
            >
              Exporter (.xlsx)
            </button>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Visites (aujourd'hui)", value: stats.visitesAujourdhui, color: C.gradB },
              { label: "Visites (7 jours)", value: stats.visites7j, color: C.gradA },
              { label: "Dossiers", value: stats.total, color: C.gradB },
              { label: "Payés", value: stats.payes, color: C.green },
              { label: "En attente", value: stats.enAttente, color: C.gold },
              { label: "Revenu", value: `${stats.revenu.toLocaleString("fr-FR")} F`, color: C.gradA },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-1 p-3.5 lift-hover" style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.line}` }}>
                <span className="uppercase" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em", color: C.slate }}>
                  {s.label}
                </span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: s.color }}>
                  {s.value}
                </span>
              </div>
            ))}
            <div className="col-span-2 flex items-center justify-between p-3" style={{ background: `${C.gradB}0d`, borderRadius: 10 }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: C.slate }}>
                Visites totales depuis le lancement
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: C.ink }}>
                {stats.visitesTotal}
              </span>
            </div>
            {stats.nbAvis > 0 && (
              <div className="col-span-2 flex items-center justify-between p-3.5" style={{ background: "#fff", borderRadius: 12, border: `1px solid ${C.line}` }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.slate }}>
                  Note moyenne des avis ({stats.nbAvis})
                </span>
                <div className="flex items-center gap-1.5">
                  <Stars value={Math.round(stats.noteMoyenne)} size={14} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: C.ink }}>
                    {stats.noteMoyenne.toFixed(1)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {[
            { id: "dossiers", label: `Dossiers (${dossiers.length})` },
            { id: "prospects", label: `Prospects (${leads.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                borderRadius: 10,
                border: `1.5px solid ${tab === t.id ? C.gradB : C.line}`,
                background: tab === t.id ? `${C.gradB}12` : "transparent",
                color: tab === t.id ? C.gradB : C.slate,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "prospects" ? (
          leads.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center" style={{ padding: "40px 20px" }}>
              <span className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 999, background: `${C.gradB}12` }}>
                <Users size={22} color={C.gradB} />
              </span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5, color: C.ink }}>
                Pas encore de prospect
              </span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.slate, maxWidth: 260 }}>
                Ils apparaîtront ici dès qu'un visiteur demandera sa liste de documents gratuite.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {leads.map((l) => (
                <div key={l.id} className="flex items-center gap-3 p-3 lift-hover" style={{ background: C.paperCard, border: `1px solid ${C.line}` }}>
                  <FileCheck2 size={18} color={C.gradB} />
                  <span className="flex-1">
                    <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: C.ink, display: "block" }}>
                      {l.nom}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.slate }}>
                      {l.telephone} · {l.pays ? `${l.pays} · ` : ""}{MOTIFS.find((m) => m.id === l.motif)?.label || l.motif} · {SITUATIONS.find((s) => s.id === l.situation)?.label || l.situation}
                    </span>
                  </span>
                  <button
                    onClick={() => handleDeleteLead(l.id)}
                    style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: C.stamp, background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            <input
              style={inputStyle}
              placeholder="Rechercher par nom ou référence"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <div className="flex gap-2 flex-wrap">
              {["tous", ...STATUS_STEPS.map((s) => s.id)].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    border: `1px solid ${filter === f ? C.navy : C.line}`,
                    background: filter === f ? C.navy : "transparent",
                    color: filter === f ? "#fff" : C.slate,
                  }}
                >
                  {f === "tous" ? "Tous" : STATUS_BADGE[f]?.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3"
                    style={{ background: C.paperCard, border: `1px solid ${C.line}`, borderRadius: 10 }}
                  >
                    <div className="skeleton shrink-0" style={{ width: 18, height: 18, borderRadius: 999 }} />
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="skeleton" style={{ width: "42%", height: 11 }} />
                      <div className="skeleton" style={{ width: "62%", height: 9 }} />
                    </div>
                    <div className="skeleton shrink-0" style={{ width: 52, height: 18, borderRadius: 6 }} />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-center" style={{ padding: "40px 20px" }}>
                <span className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 999, background: `${C.gradB}12` }}>
                  <FileCheck2 size={22} color={C.gradB} />
                </span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5, color: C.ink }}>
                  Pas encore de dossier
                </span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.slate, maxWidth: 260 }}>
                  Les dossiers créés côté client apparaîtront ici.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((d) => (
                  <button
                    key={d.ref}
                    onClick={() => setSelected(d)}
                    className="flex items-center gap-3 p-3 text-left w-full lift-hover"
                    style={{ background: C.paperCard, border: `1px solid ${C.line}` }}
                  >
                    <FileCheck2 size={18} color={C.navy} />
                    <span className="flex-1">
                      <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: C.ink, display: "block" }}>
                        {d.nom}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.slate }}>
                        {d.ref} · {d.pays} · {progressOf(d)}%
                        {d.tier && ` · ${PRICING.find((t) => t.id === d.tier)?.label}`}
                      </span>
                    </span>
                    <span
                      className="px-2 py-1"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        color: "#fff",
                        background: STATUS_BADGE[d.status]?.color || C.slate,
                      }}
                    >
                      {STATUS_BADGE[d.status]?.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Agency access gate — verified by the backend (AGENCE_PIN in its .env)
---------------------------------------------------------------- */
export function AgenceGate({ onBack, onUnlocked }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const ok = await apiAgenceLogin(input);
      if (ok) {
        onUnlocked(input);
      } else {
        setError("Code incorrect.");
      }
    } catch {
      setError("Impossible de joindre le serveur. Vérifiez qu'il est démarré.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen px-5 py-8 flex flex-col" style={{ background: C.paper }}>
      <div className="max-w-md mx-auto w-full flex flex-col gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <ArrowLeft size={16} color={C.slate} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>Retour</span>
        </button>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 22, color: C.navy }}>
          Espace agence
        </h2>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.slate }}>
          Entrez le code d'accès fourni par l'agence.
        </p>
        <Field label="Code d'accès">
          <input
            type="password"
            style={inputStyle}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </Field>
        {error && (
          <p className="flex items-center gap-2" style={{ color: C.stamp, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>
            <AlertCircle size={14} /> {error}
          </p>
        )}
        <PrimaryButton onClick={handleLogin} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Entrer"}
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Root
---------------------------------------------------------------- */