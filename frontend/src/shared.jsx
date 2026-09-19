import React, { useState, useEffect, useCallback } from "react";
import {
  Stamp,
  Plane,
  FileCheck2,
  Circle,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Copy,
  Users,
  Plus,
  Loader2,
  Search,
  Building2,
  UserRound,
  AlertCircle,
  Phone,
  MapPin,
  Menu,
  X,
} from "lucide-react";

/* ---------------------------------------------------------------
   Backend — remplacez par l'URL publique de votre serveur une fois
   déployé (voir paydunya-backend/README.md). En local, laissez tel quel.
---------------------------------------------------------------- */
export const API_BASE_URL = "https://visassistance-pro.onrender.com";

/* ---------------------------------------------------------------
   Design tokens
   Navy passport cover / paper document / stamp red / brass seal.
   Deliberately not the cream+terracotta or dark+neon defaults.
---------------------------------------------------------------- */
export const C = {
  navy: "#0369A1",
  navyDeep: "#0C4A6E",
  paper: "#F0F9FF",
  paperCard: "#FFFFFF",
  stamp: "#F43F5E",
  gold: "#F59E0B",
  goldLight: "#FCD34D",
  ink: "#0F172A",
  slate: "#64748B",
  line: "#E0F2FE",
  green: "#10B981",
  gradA: "#0284C7",
  gradB: "#0EA5E9",
  gradC: "#7DD3FC",
};

/* ---------------------------------------------------------------
   Domain data
---------------------------------------------------------------- */
export const COUNTRIES = [
  "Allemagne", "Autriche", "Belgique", "Bulgarie", "Croatie", "Danemark",
  "Espagne", "Estonie", "Finlande", "France", "Grèce", "Hongrie", "Islande",
  "Italie", "Lettonie", "Liechtenstein", "Lituanie", "Luxembourg", "Malte",
  "Norvège", "Pays-Bas", "Pologne", "Portugal", "République tchèque",
  "Roumanie", "Slovaquie", "Slovénie", "Suède", "Suisse",
];

// Tarifs indicatifs — à ajuster selon votre offre réelle.
export const PRICING = [
  {
    id: "verification",
    label: "Vérification",
    price: "10 000 FCFA",
    desc: "Vous avez déjà monté votre dossier ? Un conseiller le relit et signale les erreurs avant dépôt.",
  },
  {
    id: "accompagnement",
    label: "Accompagnement",
    price: "40 000 FCFA",
    desc: "Un conseiller monte votre dossier avec vous, de A à Z, jusqu'au dépôt.",
  },
  {
    id: "rdv",
    label: "Prise de rendez-vous",
    price: "22 000 à 35 000 FCFA selon le pays",
    desc: "On obtient et gère votre rendez-vous au centre de dépôt ou à l'ambassade concernée.",
  },
];

// Tarif de la prise de rendez-vous selon le pays de destination
export const APPOINTMENT_PRICING = { France: 35000, default: 22000 };
export function appointmentPrice(pays) {
  return APPOINTMENT_PRICING[pays] || APPOINTMENT_PRICING.default;
}

export const MOTIFS = [
  { id: "tourisme", label: "Tourisme" },
  { id: "affaires", label: "Affaires" },
  { id: "etudes", label: "Études" },
  { id: "famille", label: "Visite familiale" },
  { id: "transit", label: "Transit" },
];

export const SITUATIONS = [
  { id: "salarie", label: "Salarié(e)" },
  { id: "independant", label: "Indépendant(e) / Entrepreneur" },
  { id: "etudiant", label: "Étudiant(e)" },
  { id: "sans_emploi", label: "Sans emploi" },
  { id: "retraite", label: "Retraité(e)" },
];

// La liste des documents par motif/situation vit désormais côté serveur
// (paydunya-backend/server.js), qui reste la seule source de vérité.

export const STATUS_STEPS = [
  { id: "ouvert", label: "Dossier ouvert" },
  { id: "collecte", label: "Collecte des documents" },
  { id: "complet", label: "Dossier complet" },
  { id: "soumis", label: "Soumis au consulat" },
  { id: "rdv", label: "RDV biométrique pris" },
  { id: "decision", label: "Décision reçue" },
];

// La génération de la checklist et de la référence se fait désormais côté
// serveur (voir paydunya-backend/server.js) pour garder une seule source de vérité.

export function progressOf(dossier) {
  if (!dossier?.documents?.length) return 0;
  const done = dossier.documents.filter((d) => d.checked).length;
  return Math.round((done / dossier.documents.length) * 100);
}

/* ---------------------------------------------------------------
   API helpers — parlent au backend Node (voir paydunya-backend/)
---------------------------------------------------------------- */
export async function apiCreateDossier(form) {
  const res = await fetch(`${API_BASE_URL}/api/dossiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erreur de création.");
  return res.json();
}

export async function apiGetDossier(ref, telephone) {
  const qs = telephone ? `?telephone=${encodeURIComponent(telephone)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/dossiers/${encodeURIComponent(ref.trim().toUpperCase())}${qs}`);
  if (res.status === 404) return null;
  if (res.status === 403) throw new Error("Le numéro de téléphone ne correspond pas à ce dossier.");
  if (!res.ok) throw new Error("Erreur de récupération du dossier.");
  return res.json();
}

// Filet de sécurité : interroge PayDunya directement (le serveur se charge de
// mettre à jour la base si le webhook n'est pas encore passé)
export async function apiCheckPaymentStatus(token) {
  const res = await fetch(`${API_BASE_URL}/api/status/${encodeURIComponent(token)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function apiUpdateDossier(ref, patch, agencePin) {
  const headers = { "Content-Type": "application/json" };
  if (agencePin) headers["x-agence-pin"] = agencePin;
  const res = await fetch(`${API_BASE_URL}/api/dossiers/${encodeURIComponent(ref)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erreur de mise à jour.");
  return res.json();
}

export async function apiListDossiers(agencePin) {
  const res = await fetch(`${API_BASE_URL}/api/dossiers`, {
    headers: { "x-agence-pin": agencePin },
  });
  if (!res.ok) throw new Error("Erreur de récupération des dossiers.");
  return res.json();
}

export async function apiAgenceLogin(pin) {
  const res = await fetch(`${API_BASE_URL}/api/agence/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  return res.ok;
}

export async function apiCheckout(ref, tier) {
  const res = await fetch(`${API_BASE_URL}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref, tier }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erreur de paiement.");
  return res.json();
}

export async function apiSubmitReview(ref, note, commentaire, site_web) {
  const res = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref, note, commentaire, site_web }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erreur lors de l'envoi de l'avis.");
  return res.json();
}

export async function apiGetReviews() {
  const res = await fetch(`${API_BASE_URL}/api/reviews`);
  if (!res.ok) throw new Error("Erreur de récupération des avis.");
  return res.json();
}

export async function apiReviewExists(ref) {
  const res = await fetch(`${API_BASE_URL}/api/reviews/${encodeURIComponent(ref)}`);
  if (!res.ok) return false;
  return (await res.json()).exists;
}

export async function apiGetStats(agencePin) {
  const res = await fetch(`${API_BASE_URL}/api/stats`, {
    headers: { "x-agence-pin": agencePin },
  });
  if (!res.ok) throw new Error("Erreur de récupération des statistiques.");
  return res.json();
}

// Une visite comptée par session (pas à chaque clic dans l'appli)
export function recordVisitOnce() {
  if (sessionStorage.getItem("vp_visit_logged")) return;
  sessionStorage.setItem("vp_visit_logged", "1");
  fetch(`${API_BASE_URL}/api/visit`, { method: "POST" }).catch(() => {});
}

export async function apiDeleteDossier(ref, agencePin) {
  const res = await fetch(`${API_BASE_URL}/api/dossiers/${encodeURIComponent(ref)}`, {
    method: "DELETE",
    headers: { "x-agence-pin": agencePin },
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erreur lors de la suppression.");
  return res.json();
}

export async function apiSubmitLead(nom, telephone, motif, situation, pays, site_web) {
  const res = await fetch(`${API_BASE_URL}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nom, telephone, motif, situation, pays, site_web }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erreur lors de l'envoi.");
  return res.json();
}

export async function apiListLeads(agencePin) {
  const res = await fetch(`${API_BASE_URL}/api/leads`, {
    headers: { "x-agence-pin": agencePin },
  });
  if (!res.ok) throw new Error("Erreur de récupération des prospects.");
  return res.json();
}

export async function apiDeleteLead(id, agencePin) {
  const res = await fetch(`${API_BASE_URL}/api/leads/${id}`, {
    method: "DELETE",
    headers: { "x-agence-pin": agencePin },
  });
  if (!res.ok) throw new Error("Erreur lors de la suppression.");
  return res.json();
}

/* ---------------------------------------------------------------
   Small UI primitives
---------------------------------------------------------------- */
export function Seal({ percent, size = 88 }) {
  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: "9999px",
        background: `conic-gradient(${C.gold} ${percent}%, ${C.line} 0)`,
        padding: 6,
      }}
    >
      <div
        className="flex items-center justify-center w-full h-full"
        style={{ borderRadius: "9999px", background: C.paperCard, border: `1px solid ${C.line}` }}
      >
        <span
          className="font-mono font-medium"
          style={{ color: C.navy, fontSize: size * 0.24, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {percent}%
        </span>
      </div>
    </div>
  );
}

export function StatusStepper({ status, editable = false, onChange }) {
  const activeIdx = STATUS_STEPS.findIndex((s) => s.id === status);
  return (
    <div className="flex flex-col gap-0">
      {STATUS_STEPS.map((step, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <button
            key={step.id}
            disabled={!editable}
            onClick={() => onChange && onChange(step.id)}
            className="flex items-center gap-3 text-left py-2"
            style={{ cursor: editable ? "pointer" : "default", background: "transparent", border: "none" }}
          >
            <span className="flex flex-col items-center">
              {done || active ? (
                <CheckCircle2 size={18} color={active ? C.stamp : C.gold} />
              ) : (
                <Circle size={18} color={C.line} />
              )}
              {i < STATUS_STEPS.length - 1 && (
                <span style={{ width: 1, height: 18, background: done ? C.gold : C.line }} />
              )}
            </span>
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                color: active ? C.stamp : done ? C.ink : C.slate,
              }}
            >
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Checklist({ documents, onToggle, onNoteChange, editable = true }) {
  const byCategory = {};
  documents.forEach((d) => {
    byCategory[d.category] = byCategory[d.category] || [];
    byCategory[d.category].push(d);
  });
  return (
    <div className="flex flex-col gap-5">
      {Object.entries(byCategory).map(([cat, docs]) => (
        <div key={cat}>
          <p
            className="uppercase tracking-wide mb-2"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.slate, letterSpacing: "0.08em" }}
          >
            {cat}
          </p>
          <div className="flex flex-col gap-1">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col gap-2 py-2 px-3"
                style={{ background: C.paperCard, border: `1px solid ${C.line}` }}
              >
                <label className="flex items-start gap-3" style={{ cursor: editable ? "pointer" : "default" }}>
                  <input
                    type="checkbox"
                    checked={doc.checked}
                    disabled={!editable}
                    onChange={() => onToggle(doc.id)}
                    className="mt-1"
                    style={{ accentColor: C.gold, width: 16, height: 16 }}
                  />
                  <span
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 14,
                      color: doc.checked ? C.slate : C.ink,
                      textDecoration: doc.checked ? "line-through" : "none",
                    }}
                  >
                    {doc.label}
                  </span>
                </label>
                {onNoteChange && (
                  <input
                    placeholder="Note (ex : lien du document, remarque…)"
                    defaultValue={doc.note || ""}
                    onBlur={(e) => onNoteChange(doc.id, e.target.value)}
                    className="ml-7"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 12,
                      color: C.ink,
                      background: "#fff",
                      border: `1px solid ${C.line}`,
                      padding: "6px 8px",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled, type = "button" }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center justify-center gap-2 px-5 py-3 w-full"
      style={{
        background: disabled ? C.slate : hover ? "#000000" : C.ink,
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        fontSize: 14,
        border: "none",
        borderRadius: 12,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: !disabled && hover ? "0 10px 24px -8px rgba(15,23,42,0.35)" : "none",
        transform: !disabled && hover ? "translateY(-1px)" : "none",
        transition: "all 0.2s ease",
      }}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label
        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.slate, letterSpacing: "0.05em" }}
        className="uppercase"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------
   Piège à robots — un champ invisible pour un humain (hors écran,
   ignoré à la tabulation) mais que les robots de spam remplissent
   automatiquement. Le backend rejette silencieusement s'il est rempli.
---------------------------------------------------------------- */
export function Honeypot({ value, onChange }) {
  return (
    <input
      type="text"
      name="site_web"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
    />
  );
}

export const inputStyle = {
  fontFamily: "'Inter', sans-serif",
  fontSize: 14,
  color: C.ink,
  background: "#fff",
  border: `1.5px solid ${C.line}`,
  borderRadius: 10,
  padding: "10px 12px",
  width: "100%",
  outline: "none",
};

/* ---------------------------------------------------------------
   Logo mark — the real brand logo, with a slow-orbiting ring behind
   it in animated contexts (hero) to feel alive rather than static.
---------------------------------------------------------------- */
export function LogoMark({ size = 88, animated = false }) {
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size * 1.9, height: size }}>
      {animated && (
        <div
          style={{
            position: "absolute",
            inset: -14,
            borderRadius: 9999,
            border: `1.5px dashed ${C.gradB}28`,
            animation: "spinSlow 22s linear infinite",
          }}
        />
      )}
      <img
        src="/logo.png"
        alt="VisAssistance Pro"
        style={{
          width: size * 1.9,
          height: "auto",
          animation: animated ? "popIn 0.6s cubic-bezier(.2,.9,.3,1) both" : undefined,
        }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------
   Logo lockup — used in the nav and footer. The logo already
   contains the wordmark, so this simply sizes the image.
---------------------------------------------------------------- */
export function Logo({ size = 40, tagline = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo.png" alt="VisAssistance Pro" style={{ height: size, width: "auto" }} />
      {tagline && (
        <span
          className="hidden sm:block uppercase"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em", color: C.slate, lineHeight: 1.3, borderLeft: `1.5px solid ${C.line}`, paddingLeft: 10 }}
        >
          Expert en dossiers
          <br />
          Visa Schengen
        </span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Flying planes — a continuous background motif. Small, quiet,
   never competing with the foreground content.
---------------------------------------------------------------- */
export const PLANE_ROUTES = [
  { top: "16%", size: 16, duration: "26s", delay: "0s", opacity: 0.22, color: C.gradB },
  { top: "68%", size: 13, duration: "32s", delay: "10s", opacity: 0.16, color: C.gradA },
];

export function FlyingPlanes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {PLANE_ROUTES.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: p.top,
            left: 0,
            animation: `flyAcross ${p.duration} linear infinite`,
            animationDelay: p.delay,
          }}
        >
          <Plane size={p.size} color={p.color} style={{ opacity: p.opacity, transform: "rotate(45deg)" }} />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Role select
---------------------------------------------------------------- */
/* ---------------------------------------------------------------
   Navigation bar — sticky, glass, smooth-scrolls to page sections.
---------------------------------------------------------------- */
export function NavBar({ onSelect }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const links = [
    { href: "#accueil", label: "Accueil" },
    { href: "#visuels", label: "En images" },
    { href: "#services", label: "Services" },
    { href: "#tarifs", label: "Tarifs" },
    { href: "#procedure", label: "Procédure" },
    { href: "#avis", label: "Avis clients" },
    { href: "#faq", label: "FAQ" },
    { href: "#contact", label: "Contact" },
  ];

  return (
    <>
      <div
        className="sticky top-0 z-50 w-full flex items-center justify-between px-5 md:px-10"
        style={{
          height: 68,
          background: scrolled || menuOpen ? "rgba(248,249,255,0.92)" : "transparent",
          backdropFilter: scrolled || menuOpen ? "blur(14px)" : "none",
          WebkitBackdropFilter: scrolled || menuOpen ? "blur(14px)" : "none",
          borderBottom: scrolled || menuOpen ? `1px solid ${C.line}` : "1px solid transparent",
          transition: "all 0.25s ease",
        }}
      >
        <Logo size={34} tagline />
        <div className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="nav-link"
              style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, fontWeight: 500, color: C.ink, textDecoration: "none" }}
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => onSelect("agence")}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: C.ink,
              background: "transparent",
              border: `1.5px solid ${C.line}`,
              borderRadius: 10,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            Espace agence
          </button>
          <button
            onClick={() => onSelect("client")}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              background: C.ink,
              border: "none",
              borderRadius: 10,
              padding: "9px 16px",
              cursor: "pointer",
            }}
          >
            Espace client
          </button>
        </div>

        {/* Bouton hamburger — mobile uniquement */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="md:hidden flex items-center justify-center"
          aria-label="Menu"
          style={{ width: 40, height: 40, background: "transparent", border: "none", cursor: "pointer" }}
        >
          {menuOpen ? <X size={24} color={C.ink} /> : <Menu size={24} color={C.ink} />}
        </button>
      </div>

      {/* Panneau coulissant mobile */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-x-0 z-40 flex flex-col"
          style={{
            top: 68,
            background: "#fff",
            borderBottom: `1px solid ${C.line}`,
            boxShadow: "0 16px 30px -20px rgba(2,132,199,0.35)",
            animation: "riseIn 0.22s ease both",
          }}
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 15,
                fontWeight: 500,
                color: C.ink,
                textDecoration: "none",
                padding: "16px 24px",
                borderBottom: `1px solid ${C.line}`,
              }}
            >
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 p-5">
            <button
              onClick={() => { setMenuOpen(false); onSelect("agence"); }}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                color: C.ink,
                background: "transparent",
                border: `1.5px solid ${C.line}`,
                borderRadius: 10,
                padding: "12px 0",
                cursor: "pointer",
              }}
            >
              Espace agence
            </button>
            <button
              onClick={() => { setMenuOpen(false); onSelect("client"); }}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                color: "#fff",
                background: C.ink,
                border: "none",
                borderRadius: 10,
                padding: "12px 0",
                cursor: "pointer",
              }}
            >
              Espace client
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------
   Star rating — used for review submission and display.
---------------------------------------------------------------- */
export function Stars({ value, size = 16, interactive = false, onChange }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={interactive ? () => onChange(n) : undefined}
          style={{ cursor: interactive ? "pointer" : "default", lineHeight: 0 }}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill={n <= value ? C.gold : "none"} stroke={n <= value ? C.gold : C.line} strokeWidth="1.5">
            <path d="M12 2 L14.9 8.6 L22 9.3 L16.7 14 L18.2 21 L12 17.3 L5.8 21 L7.3 14 L2 9.3 L9.1 8.6 Z" strokeLinejoin="round" />
          </svg>
        </span>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------
   Section — shared heading treatment for the marketing page.
---------------------------------------------------------------- */
export function Section({ id, eyebrow, title, subtitle, children, dark }) {
  return (
    <section id={id} className="w-full px-5 md:px-10 py-16 md:py-20" style={{ scrollMarginTop: 68 }}>
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center gap-3 mb-12">
        {eyebrow && (
          <span
            className="uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, letterSpacing: "0.12em", color: C.gradB, fontWeight: 500 }}
          >
            {eyebrow}
          </span>
        )}
        <h2
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: "-0.01em",
            color: dark ? "#fff" : C.ink,
            maxWidth: 560,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14.5, color: dark ? "rgba(255,255,255,0.75)" : C.slate, maxWidth: 480 }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="max-w-5xl mx-auto">{children}</div>
    </section>
  );
}

export const SERVICES = [
  { icon: <FileCheck2 />, title: "Dossier guidé", desc: "Une checklist personnalisée selon votre motif de voyage et votre situation — rien d'oublié." },
  { icon: <Search />, title: "Vérification des documents", desc: "Chaque pièce est relue avant dépôt pour éviter les refus liés à un dossier incomplet." },
  { icon: <Users />, title: "Accompagnement humain", desc: "Un conseiller dédié répond à vos questions du début du dossier jusqu'au rendez-vous." },
  { icon: <Stamp />, title: "Suivi en temps réel", desc: "Votre numéro de dossier vous permet de suivre chaque étape, à tout moment." },
];

export function ServiceCard({ icon, title, desc, delay }) {
  return (
    <div
      className="flex flex-col gap-3 p-6 lift-hover"
      style={{
        background: "#fff",
        borderRadius: 16,
        border: `1px solid ${C.line}`,
        animation: "riseIn 0.5s ease both",
        animationDelay: delay,
      }}
    >
      <span
        className="flex items-center justify-center shrink-0"
        style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.gradA}18, ${C.gradC}18)` }}
      >
        {React.cloneElement(icon, { color: C.gradB, size: 20 })}
      </span>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: C.ink }}>{title}</span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: C.slate, lineHeight: 1.5 }}>{desc}</span>
    </div>
  );
}

export function PricingPreviewCard({ tier, onSelect, featured }) {
  return (
    <div
      className="flex flex-col gap-4 p-6 lift-hover"
      style={{
        background: featured ? C.ink : "#fff",
        borderRadius: 16,
        border: `1px solid ${featured ? C.ink : C.line}`,
        boxShadow: featured ? "0 20px 44px -18px rgba(15,23,42,0.4)" : "none",
      }}
    >
      {featured && (
        <span
          className="self-start uppercase"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: C.gradC, background: "rgba(255,255,255,0.12)", padding: "3px 8px", borderRadius: 999 }}
        >
          Le plus choisi
        </span>
      )}
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 18, color: featured ? "#fff" : C.ink }}>
        {tier.label}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, color: featured ? C.gradC : C.gradB }}>
        {tier.price}
      </span>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: featured ? "rgba(255,255,255,0.75)" : C.slate, lineHeight: 1.5, minHeight: 40 }}>
        {tier.desc}
      </span>
      <button
        onClick={() => onSelect("client")}
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: 13.5,
          color: featured ? C.ink : "#fff",
          background: featured ? "#fff" : C.ink,
          border: "none",
          borderRadius: 10,
          padding: "10px 0",
          cursor: "pointer",
        }}
      >
        Choisir cette offre
      </button>
    </div>
  );
}

export function ReviewsSection() {
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiGetReviews()
      .then(setReviews)
      .catch(() => setError(true));
  }, []);

  const average = reviews?.length ? (reviews.reduce((s, r) => s + r.note, 0) / reviews.length).toFixed(1) : null;

  return (
    <Section
      id="avis"
      eyebrow="Avis clients"
      title="Ce que disent nos clients"
      subtitle={average ? `Note moyenne de ${average} / 5 sur ${reviews.length} avis.` : "Les avis apparaissent ici une fois les premiers dossiers accompagnés."}
    >
      {error && (
        <p className="text-center" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>
          Les avis ne sont pas disponibles pour le moment.
        </p>
      )}
      {!reviews && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3 p-5" style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.line}` }}>
              <div className="skeleton" style={{ width: 80, height: 12 }} />
              <div className="skeleton" style={{ width: "100%", height: 10 }} />
              <div className="skeleton" style={{ width: "85%", height: 10 }} />
              <div className="flex items-center gap-2 mt-1">
                <div className="skeleton shrink-0" style={{ width: 28, height: 28, borderRadius: 999 }} />
                <div className="skeleton" style={{ width: 70, height: 10 }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {reviews && reviews.length === 0 && !error && (
        <div className="flex flex-col items-center gap-2 py-8">
          <Stars value={0} size={20} />
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: C.slate, textAlign: "center" }}>
            Aucun avis pour le moment — les clients accompagnés sont invités à en laisser un après leur dossier.
          </p>
        </div>
      )}
      {reviews && reviews.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {reviews.slice(0, 6).map((r, i) => (
            <div
              key={i}
              className="relative flex flex-col gap-3 p-5 lift-hover"
              style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.line}`, overflow: "hidden" }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -14,
                  right: 10,
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 76,
                  fontWeight: 700,
                  color: `${C.gradB}12`,
                  lineHeight: 1,
                  pointerEvents: "none",
                }}
              >
                &rdquo;
              </span>
              <Stars value={r.note} size={14} />
              {r.commentaire && (
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: C.ink, lineHeight: 1.55, position: "relative" }}>
                  {r.commentaire}
                </p>
              )}
              <div className="flex items-center gap-2.5 mt-auto pt-1">
                <span
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    background: `${C.gradB}15`,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: C.gradA,
                  }}
                >
                  {(r.nom || "?").trim().charAt(0).toUpperCase()}
                </span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 12.5, color: C.slate }}>
                  {r.nom}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function WhatsAppIcon({ size = 20, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.47 14.38c-.29-.14-1.71-.84-1.97-.94-.27-.1-.46-.14-.65.14-.19.29-.75.94-.92 1.13-.17.19-.34.22-.63.07-.29-.14-1.22-.45-2.32-1.43-.86-.76-1.44-1.71-1.61-2-.17-.29-.02-.44.13-.59.13-.13.29-.34.43-.51.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.65-1.57-.89-2.15-.23-.56-.47-.48-.65-.49-.17-.01-.36-.01-.55-.01-.19 0-.5.07-.76.36-.26.29-1 .98-1 2.39s1.02 2.77 1.17 2.96c.14.19 2 3.05 4.85 4.28.68.29 1.21.47 1.62.6.68.22 1.3.19 1.79.11.55-.08 1.71-.7 1.95-1.37.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.34z" />
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.33 4.99L2 22l5.2-1.36a9.94 9.94 0 0 0 4.84 1.23h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm0 18.2h-.01a8.24 8.24 0 0 1-4.2-1.15l-.3-.18-3.09.81.82-3.01-.2-.31a8.23 8.23 0 0 1-1.26-4.4c0-4.55 3.7-8.25 8.25-8.25 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.55-3.7 8.24-8.25 8.24Z" />
    </svg>
  );
}

export function ContactCard({ href, icon, label, value }) {
  const [hover, setHover] = useState(false);
  const isLink = !!href;
  const Tag = isLink ? "a" : "div";
  return (
    <Tag
      {...(isLink ? { href, target: href.startsWith("http") ? "_blank" : undefined, rel: "noreferrer" } : {})}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex flex-col items-center gap-2 p-6 text-center"
      style={{
        background: "#fff",
        borderRadius: 16,
        border: `1px solid ${hover ? C.gradB : C.line}`,
        textDecoration: "none",
        cursor: isLink ? "pointer" : "default",
        transform: hover ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hover ? `0 14px 30px -14px ${C.gradB}28` : "none",
        transition: "all 0.22s ease",
      }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          background: hover ? icon.color : `${icon.color}18`,
          transition: "background 0.22s ease",
        }}
      >
        {React.cloneElement(icon.node, { color: hover ? "#fff" : icon.color })}
      </span>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: C.ink }}>{label}</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: C.slate }}>{value}</span>
    </Tag>
  );
}

export function ContactSection() {
  const CONTACT = {
    phone: "+221 77 619 91 61",
    whatsapp: "221776199161",
    email: "visaassistancepro6@gmail.com",
    zone: "Grand Yoff, Dakar",
  };
  return (
    <Section id="contact" eyebrow="Contact" title="Une question avant de commencer ?" subtitle="Écrivez-nous sur WhatsApp, réponse rapide garantie.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ContactCard
          href={`https://wa.me/${CONTACT.whatsapp}`}
          icon={{ node: <WhatsAppIcon size={20} />, color: "#25D366" }}
          label="WhatsApp"
          value={CONTACT.phone}
        />
        <ContactCard
          href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}
          icon={{ node: <Phone size={20} />, color: C.gradB }}
          label="Téléphone"
          value={CONTACT.phone}
        />
        <ContactCard
          href={`mailto:${CONTACT.email}`}
          icon={{ node: <FileCheck2 size={20} />, color: C.gold }}
          label="Email"
          value={CONTACT.email}
        />
        <ContactCard
          icon={{ node: <MapPin size={20} />, color: C.stamp }}
          label="Basés à"
          value={CONTACT.zone}
        />
      </div>
    </Section>
  );
}

export function RoleCard({ icon, title, desc, onClick, delay }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center gap-4 p-5 text-left w-full"
      style={{
        background: hover ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.72)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderRadius: 18,
        border: `1.5px solid ${hover ? "transparent" : "rgba(255,255,255,0.6)"}`,
        boxShadow: hover
          ? `0 12px 26px -16px ${C.gradB}30, 0 0 0 1.5px ${C.gradB}55 inset`
          : "0 4px 18px -8px rgba(15,23,42,0.1)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.25s cubic-bezier(.2,.9,.3,1)",
        animation: "riseIn 0.55s cubic-bezier(.2,.9,.3,1) both",
        animationDelay: delay,
      }}
    >
      <span
        className="flex items-center justify-center shrink-0"
        style={{
          width: 46,
          height: 46,
          borderRadius: 13,
          background: hover
            ? C.ink
            : `linear-gradient(135deg, ${C.gradA}22, ${C.gradC}22)`,
          transition: "background 0.25s ease",
        }}
      >
        {React.cloneElement(icon, { color: hover ? "#fff" : C.navy, size: 20 })}
      </span>
      <span className="flex-1">
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16.5, color: C.ink, display: "block" }}>
          {title}
        </span>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>
          {desc}
        </span>
      </span>
      <ChevronRight
        size={18}
        color={hover ? C.gradB : C.line}
        style={{ transition: "color 0.25s ease", transform: hover ? "translateX(2px)" : "none" }}
      />
    </button>
  );
}

export const TRUST_BADGES = [
  { icon: <Stamp />, label: "Dossiers suivis avec rigueur" },
  { icon: <Users />, label: "Réponse rapide sur WhatsApp" },
  { icon: <Search />, label: "Suivi par numéro de dossier" },
  { icon: <Building2 />, label: "Basés à Dakar" },
];

/* ---------------------------------------------------------------
   Illustrations originales — thème voyage/visa, palette du site.
   Pas de photos : évite toute image trompeuse tant qu'il n'y a pas
   de vrais visuels à afficher.
---------------------------------------------------------------- */
export function IllustrationPassport() {
  return (
    <svg viewBox="0 0 320 220" width="100%" height="100%">
      <rect x="0" y="0" width="320" height="220" rx="18" fill="#F0F9FF" />
      <g transform="translate(85,40)">
        <rect x="0" y="0" width="110" height="150" rx="10" fill="#0369A1" />
        <rect x="8" y="8" width="94" height="134" rx="6" fill="#0EA5E9" opacity="0.35" />
        <circle cx="55" cy="55" r="26" fill="none" stroke="#F0F9FF" strokeWidth="3" />
        <circle cx="55" cy="46" r="9" fill="#F0F9FF" />
        <path d="M35 78 Q55 60 75 78" stroke="#F0F9FF" strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="20" y="105" width="70" height="6" rx="3" fill="#F0F9FF" opacity="0.8" />
        <rect x="20" y="118" width="45" height="6" rx="3" fill="#F0F9FF" opacity="0.5" />
      </g>
      <g transform="translate(175,110) rotate(18)">
        <rect x="0" y="0" width="90" height="42" rx="6" fill="#FFFFFF" stroke="#7DD3FC" strokeWidth="2" />
        <circle cx="14" cy="21" r="5" fill="none" stroke="#7DD3FC" strokeWidth="2" />
        <path d="M24 21 h58" stroke="#BAE6FD" strokeWidth="2" strokeDasharray="4 3" />
        <path d="M60 8 l14 13 l-14 13" stroke="#0EA5E9" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle cx="55" cy="35" r="4" fill="#F59E0B" opacity="0.7" />
      <circle cx="270" cy="40" r="3" fill="#0EA5E9" opacity="0.6" />
    </svg>
  );
}

export function IllustrationChecklist() {
  return (
    <svg viewBox="0 0 320 220" width="100%" height="100%">
      <rect x="0" y="0" width="320" height="220" rx="18" fill="#F0F9FF" />
      <g transform="translate(95,30)">
        <rect x="0" y="0" width="130" height="160" rx="10" fill="#FFFFFF" stroke="#BAE6FD" strokeWidth="2" />
        <rect x="35" y="-10" width="60" height="20" rx="6" fill="#0284C7" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(16, ${34 + i * 30})`}>
            <rect x="0" y="0" width="18" height="18" rx="5" fill={i < 3 ? "#0EA5E9" : "#E0F2FE"} />
            {i < 3 && <path d="M4 9 l4 4 l8 -9" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            <rect x="28" y="4" width="86" height="6" rx="3" fill="#CBD5E1" />
            <rect x="28" y="14" width="60" height="5" rx="2.5" fill="#E2E8F0" />
          </g>
        ))}
      </g>
      <circle cx="248" cy="150" r="30" fill="#0369A1" />
      <path d="M235 150 l9 9 l18 -19" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IllustrationGlobe() {
  return (
    <svg viewBox="0 0 320 220" width="100%" height="100%">
      <rect x="0" y="0" width="320" height="220" rx="18" fill="#F0F9FF" />
      <circle cx="150" cy="110" r="75" fill="#0EA5E9" opacity="0.18" />
      <circle cx="150" cy="110" r="55" fill="none" stroke="#0284C7" strokeWidth="2" />
      <ellipse cx="150" cy="110" rx="55" ry="20" fill="none" stroke="#7DD3FC" strokeWidth="1.6" />
      <ellipse cx="150" cy="110" rx="24" ry="55" fill="none" stroke="#7DD3FC" strokeWidth="1.6" />
      <path d="M70 150 Q150 40 245 75" stroke="#F59E0B" strokeWidth="2.4" strokeDasharray="1 8" strokeLinecap="round" fill="none" />
      <g transform="translate(235,68) rotate(35)">
        <path d="M0 0 L18 6 L0 12 L4 6 Z" fill="#0369A1" />
      </g>
      <circle cx="72" cy="151" r="5" fill="#F43F5E" />
      <circle cx="72" cy="151" r="9" fill="none" stroke="#F43F5E" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

export function IllustrationApproved() {
  return (
    <svg viewBox="0 0 320 220" width="100%" height="100%">
      <rect x="0" y="0" width="320" height="220" rx="18" fill="#F0F9FF" />
      <rect x="110" y="30" width="100" height="140" rx="8" fill="#FFFFFF" stroke="#BAE6FD" strokeWidth="2" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x="126" y={52 + i * 16} width="68" height="6" rx="3" fill="#DBEAFE" />
      ))}
      <g transform="translate(160,120)">
        <circle cx="0" cy="0" r="42" fill="none" stroke="#10B981" strokeWidth="4" strokeDasharray="6 4" />
        <circle cx="0" cy="0" r="30" fill="#10B981" opacity="0.15" />
        <path d="M-14 0 l10 10 l20 -22" stroke="#10B981" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {[[40, 40], [270, 50], [30, 180], [280, 170]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3 + (i % 2)} fill={i % 2 ? "#F59E0B" : "#0EA5E9"} opacity="0.6" />
      ))}
    </svg>
  );
}

export const CAROUSEL_SLIDES = [
  { Illu: IllustrationPassport, title: "Un dossier bien préparé", desc: "Chaque document identifié selon votre motif de voyage." },
  { Illu: IllustrationChecklist, title: "Vérification minutieuse", desc: "Rien n'est envoyé sans avoir été relu et validé." },
  { Illu: IllustrationGlobe, title: "Suivi jusqu'au dépôt", desc: "Votre dossier accompagné, étape par étape." },
  { Illu: IllustrationApproved, title: "Objectif : votre visa", desc: "Un dossier solide, déposé dans les meilleures conditions." },
];

export function VisualCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % CAROUSEL_SLIDES.length), 4200);
    return () => clearInterval(t);
  }, [paused]);

  const go = (dir) => setIndex((i) => (i + dir + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length);
  const { Illu, title, desc } = CAROUSEL_SLIDES[index];

  return (
    <Section id="visuels" eyebrow="En images" title="Ce que couvre votre accompagnement">
      <div
        className="flex flex-col items-center gap-5"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="relative w-full max-w-md overflow-hidden"
          style={{ borderRadius: 20, border: `1px solid ${C.line}`, boxShadow: `0 20px 44px -26px ${C.gradB}35` }}
        >
          <div style={{ aspectRatio: "320 / 220", position: "relative" }}>
            <div key={index} style={{ width: "100%", height: "100%", animation: "riseIn 0.5s ease both" }}>
              <Illu />
            </div>

            <button
              onClick={() => go(-1)}
              aria-label="Précédent"
              className="lift-hover"
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                width: 38,
                height: 38,
                borderRadius: 999,
                border: "none",
                background: "rgba(255,255,255,0.9)",
                boxShadow: "0 6px 16px -6px rgba(2,132,199,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <ChevronRight size={18} color={C.navy} style={{ transform: "rotate(180deg)" }} />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Suivant"
              className="lift-hover"
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                width: 38,
                height: 38,
                borderRadius: 999,
                border: "none",
                background: "rgba(255,255,255,0.9)",
                boxShadow: "0 6px 16px -6px rgba(2,132,199,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <ChevronRight size={18} color={C.navy} />
            </button>
          </div>

          {/* Légende — bandeau collé directement sous l'image */}
          <div className="flex flex-col items-center gap-0.5 text-center py-4 px-5" style={{ background: "#fff", borderTop: `1px solid ${C.line}` }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15.5, color: C.ink }}>{title}</span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: C.slate }}>{desc}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {CAROUSEL_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Diapositive ${i + 1}`}
              style={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 999,
                border: "none",
                background: i === index ? C.gradB : C.line,
                cursor: "pointer",
                transition: "all 0.25s ease",
              }}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}

export function TrustBar() {
  return (
    <div className="w-full flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-6 relative" style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
      {TRUST_BADGES.map((b) => (
        <span key={b.label} className="flex items-center gap-2">
          {React.cloneElement(b.icon, { size: 15, color: C.gradB })}
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, fontWeight: 500, color: C.ink }}>{b.label}</span>
        </span>
      ))}
    </div>
  );
}

export const STEPS = [
  { n: "01", title: "Créez votre dossier", desc: "Renseignez votre motif de voyage et votre situation — 2 minutes suffisent." },
  { n: "02", title: "Choisissez une offre et payez", desc: "Wave, Orange Money ou carte, en toute sécurité via PayDunya." },
  { n: "03", title: "Suivez chaque étape", desc: "Votre numéro de dossier permet de suivre l'avancement jusqu'à la décision." },
];

export function HowItWorks() {
  return (
    <Section id="procedure" eyebrow="Procédure" title="Trois étapes, du dossier à la décision" subtitle="Aucune démarche cachée : voici exactement ce qui se passe après votre inscription.">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex flex-col gap-2 p-6 lift-hover" style={{ background: "#fff", borderRadius: 16, border: `1px solid ${C.line}`, animation: "riseIn 0.5s ease both", animationDelay: `${i * 0.1}s` }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, color: `${C.gradB}28` }}>{s.n}</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: C.ink }}>{s.title}</span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: C.slate, lineHeight: 1.5 }}>{s.desc}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

export const FAQS = [
  { q: "Quel est le délai pour monter un dossier ?", a: "Une fois votre offre choisie et payée, votre dossier est pris en charge et vous êtes guidé document par document. Le délai dépend surtout de la rapidité avec laquelle vous rassemblez vos pièces." },
  { q: "Le paiement en ligne est-il sécurisé ?", a: "Oui, tous les paiements passent par PayDunya (Wave, Orange Money, carte bancaire), un prestataire de paiement agréé. Nous n'avons jamais accès à vos identifiants de paiement." },
  { q: "Que se passe-t-il si mon dossier est incomplet ?", a: "Chaque pièce est vérifiée avant la mise en ligne de votre demande. Si un document manque ou pose problème, vous êtes prévenu avant l'envoi, pas après." },
  { q: "Puis-je suivre l'avancement de mon dossier ?", a: "Oui, votre numéro de dossier (format VP-2026-XXXX) vous permet de retrouver son statut à tout moment depuis la page d'accueil." },
  { q: "Le prix affiché inclut-il les frais consulaires ?", a: "Non, nos offres couvrent l'accompagnement et la constitution du dossier. Les frais consulaires, fixés par chaque ambassade, restent à votre charge en plus." },
];

export function FAQItem({ q, a, open, onClick }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.line}` }}>
      <button
        onClick={onClick}
        className="flex items-center justify-between w-full py-4 text-left"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5, color: C.ink }}>{q}</span>
        <ChevronRight size={16} color={C.gradB} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s ease", flexShrink: 0, marginLeft: 12 }} />
      </button>
      {open && (
        <p className="pb-4" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: C.slate, lineHeight: 1.6, animation: "riseIn 0.3s ease both" }}>
          {a}
        </p>
      )}
    </div>
  );
}

export function FAQSection() {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <Section id="faq" eyebrow="Questions fréquentes" title="Tout ce qu'on nous demande avant de commencer">
      <div className="max-w-2xl mx-auto">
        {FAQS.map((f, i) => (
          <FAQItem key={f.q} q={f.q} a={f.a} open={openIdx === i} onClick={() => setOpenIdx(openIdx === i ? -1 : i)} />
        ))}
      </div>
    </Section>
  );
}


/* ---------------------------------------------------------------
   Agence portal
---------------------------------------------------------------- */
export const STATUS_BADGE = {
  ouvert: { label: "Ouvert", color: C.slate },
  collecte: { label: "Collecte", color: C.slate },
  complet: { label: "Complet", color: C.gold },
  soumis: { label: "Soumis", color: C.navy },
  rdv: { label: "RDV pris", color: C.navy },
  decision: { label: "Décision", color: C.green },
};
