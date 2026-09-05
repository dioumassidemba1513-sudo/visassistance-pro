import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
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
const API_BASE_URL = "https://visassistance-pro.onrender.com";

/* ---------------------------------------------------------------
   Design tokens
   Navy passport cover / paper document / stamp red / brass seal.
   Deliberately not the cream+terracotta or dark+neon defaults.
---------------------------------------------------------------- */
const C = {
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
const COUNTRIES = [
  "Allemagne", "Autriche", "Belgique", "Bulgarie", "Croatie", "Danemark",
  "Espagne", "Estonie", "Finlande", "France", "Grèce", "Hongrie", "Islande",
  "Italie", "Lettonie", "Liechtenstein", "Lituanie", "Luxembourg", "Malte",
  "Norvège", "Pays-Bas", "Pologne", "Portugal", "République tchèque",
  "Roumanie", "Slovaquie", "Slovénie", "Suède", "Suisse",
];

// Tarifs indicatifs — à ajuster selon votre offre réelle.
const PRICING = [
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
const APPOINTMENT_PRICING = { France: 35000, default: 22000 };
function appointmentPrice(pays) {
  return APPOINTMENT_PRICING[pays] || APPOINTMENT_PRICING.default;
}

const MOTIFS = [
  { id: "tourisme", label: "Tourisme" },
  { id: "affaires", label: "Affaires" },
  { id: "etudes", label: "Études" },
  { id: "famille", label: "Visite familiale" },
  { id: "transit", label: "Transit" },
];

const SITUATIONS = [
  { id: "salarie", label: "Salarié(e)" },
  { id: "independant", label: "Indépendant(e) / Entrepreneur" },
  { id: "etudiant", label: "Étudiant(e)" },
  { id: "sans_emploi", label: "Sans emploi" },
  { id: "retraite", label: "Retraité(e)" },
];

// La liste des documents par motif/situation vit désormais côté serveur
// (paydunya-backend/server.js), qui reste la seule source de vérité.

const STATUS_STEPS = [
  { id: "ouvert", label: "Dossier ouvert" },
  { id: "collecte", label: "Collecte des documents" },
  { id: "complet", label: "Dossier complet" },
  { id: "soumis", label: "Soumis au consulat" },
  { id: "rdv", label: "RDV biométrique pris" },
  { id: "decision", label: "Décision reçue" },
];

// La génération de la checklist et de la référence se fait désormais côté
// serveur (voir paydunya-backend/server.js) pour garder une seule source de vérité.

function progressOf(dossier) {
  if (!dossier?.documents?.length) return 0;
  const done = dossier.documents.filter((d) => d.checked).length;
  return Math.round((done / dossier.documents.length) * 100);
}

/* ---------------------------------------------------------------
   API helpers — parlent au backend Node (voir paydunya-backend/)
---------------------------------------------------------------- */
async function apiCreateDossier(form) {
  const res = await fetch(`${API_BASE_URL}/api/dossiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erreur de création.");
  return res.json();
}

async function apiGetDossier(ref, telephone) {
  const qs = telephone ? `?telephone=${encodeURIComponent(telephone)}` : "";
  const res = await fetch(`${API_BASE_URL}/api/dossiers/${encodeURIComponent(ref.trim().toUpperCase())}${qs}`);
  if (res.status === 404) return null;
  if (res.status === 403) throw new Error("Le numéro de téléphone ne correspond pas à ce dossier.");
  if (!res.ok) throw new Error("Erreur de récupération du dossier.");
  return res.json();
}

// Filet de sécurité : interroge PayDunya directement (le serveur se charge de
// mettre à jour la base si le webhook n'est pas encore passé)
async function apiCheckPaymentStatus(token) {
  const res = await fetch(`${API_BASE_URL}/api/status/${encodeURIComponent(token)}`);
  if (!res.ok) return null;
  return res.json();
}

async function apiUpdateDossier(ref, patch, agencePin) {
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

async function apiListDossiers(agencePin) {
  const res = await fetch(`${API_BASE_URL}/api/dossiers`, {
    headers: { "x-agence-pin": agencePin },
  });
  if (!res.ok) throw new Error("Erreur de récupération des dossiers.");
  return res.json();
}

async function apiAgenceLogin(pin) {
  const res = await fetch(`${API_BASE_URL}/api/agence/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  return res.ok;
}

async function apiCheckout(ref, tier) {
  const res = await fetch(`${API_BASE_URL}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref, tier }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erreur de paiement.");
  return res.json();
}

async function apiSubmitReview(ref, note, commentaire, site_web) {
  const res = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref, note, commentaire, site_web }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erreur lors de l'envoi de l'avis.");
  return res.json();
}

async function apiGetReviews() {
  const res = await fetch(`${API_BASE_URL}/api/reviews`);
  if (!res.ok) throw new Error("Erreur de récupération des avis.");
  return res.json();
}

async function apiReviewExists(ref) {
  const res = await fetch(`${API_BASE_URL}/api/reviews/${encodeURIComponent(ref)}`);
  if (!res.ok) return false;
  return (await res.json()).exists;
}

async function apiGetStats(agencePin) {
  const res = await fetch(`${API_BASE_URL}/api/stats`, {
    headers: { "x-agence-pin": agencePin },
  });
  if (!res.ok) throw new Error("Erreur de récupération des statistiques.");
  return res.json();
}

// Une visite comptée par session (pas à chaque clic dans l'appli)
function recordVisitOnce() {
  if (sessionStorage.getItem("vp_visit_logged")) return;
  sessionStorage.setItem("vp_visit_logged", "1");
  fetch(`${API_BASE_URL}/api/visit`, { method: "POST" }).catch(() => {});
}

async function apiDeleteDossier(ref, agencePin) {
  const res = await fetch(`${API_BASE_URL}/api/dossiers/${encodeURIComponent(ref)}`, {
    method: "DELETE",
    headers: { "x-agence-pin": agencePin },
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erreur lors de la suppression.");
  return res.json();
}

async function apiSubmitLead(nom, telephone, motif, situation, pays, site_web) {
  const res = await fetch(`${API_BASE_URL}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nom, telephone, motif, situation, pays, site_web }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Erreur lors de l'envoi.");
  return res.json();
}

async function apiListLeads(agencePin) {
  const res = await fetch(`${API_BASE_URL}/api/leads`, {
    headers: { "x-agence-pin": agencePin },
  });
  if (!res.ok) throw new Error("Erreur de récupération des prospects.");
  return res.json();
}

async function apiDeleteLead(id, agencePin) {
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
function Seal({ percent, size = 88 }) {
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

function StatusStepper({ status, editable = false, onChange }) {
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

function Checklist({ documents, onToggle, onNoteChange, editable = true }) {
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

function PrimaryButton({ children, onClick, disabled, type = "button" }) {
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
        background: disabled
          ? C.slate
          : `linear-gradient(135deg, ${C.gradA}, ${C.gradB})`,
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        fontSize: 14,
        border: "none",
        borderRadius: 12,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: !disabled && hover ? `0 10px 24px -8px ${C.gradB}40` : "none",
        transform: !disabled && hover ? "translateY(-1px)" : "none",
        transition: "all 0.2s ease",
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
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
function Honeypot({ value, onChange }) {
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

const inputStyle = {
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
function LogoMark({ size = 88, animated = false }) {
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
function Logo({ size = 40, tagline = false }) {
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
const PLANE_ROUTES = [
  { top: "16%", size: 16, duration: "26s", delay: "0s", opacity: 0.22, color: C.gradB },
  { top: "68%", size: 13, duration: "32s", delay: "10s", opacity: 0.16, color: C.gradA },
];

function FlyingPlanes() {
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
function NavBar({ onSelect }) {
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
              background: `linear-gradient(135deg, ${C.gradA}, ${C.gradB})`,
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
                background: `linear-gradient(135deg, ${C.gradA}, ${C.gradB})`,
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
function Stars({ value, size = 16, interactive = false, onChange }) {
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
function Section({ id, eyebrow, title, subtitle, children, dark }) {
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

const SERVICES = [
  { icon: <FileCheck2 />, title: "Dossier guidé", desc: "Une checklist personnalisée selon votre motif de voyage et votre situation — rien d'oublié." },
  { icon: <Search />, title: "Vérification des documents", desc: "Chaque pièce est relue avant dépôt pour éviter les refus liés à un dossier incomplet." },
  { icon: <Users />, title: "Accompagnement humain", desc: "Un conseiller dédié répond à vos questions du début du dossier jusqu'au rendez-vous." },
  { icon: <Stamp />, title: "Suivi en temps réel", desc: "Votre numéro de dossier vous permet de suivre chaque étape, à tout moment." },
];

function ServiceCard({ icon, title, desc, delay }) {
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

function PricingPreviewCard({ tier, onSelect, featured }) {
  return (
    <div
      className="flex flex-col gap-4 p-6 lift-hover"
      style={{
        background: featured ? C.navy : "#fff",
        borderRadius: 16,
        border: `1px solid ${featured ? C.navy : C.line}`,
        boxShadow: featured ? `0 20px 44px -18px ${C.gradB}35` : "none",
      }}
    >
      {featured && (
        <span
          className="self-start uppercase"
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: C.goldLight, background: "rgba(255,255,255,0.1)", padding: "3px 8px", borderRadius: 999 }}
        >
          Le plus choisi
        </span>
      )}
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 18, color: featured ? "#fff" : C.ink }}>
        {tier.label}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, color: featured ? C.goldLight : C.gradB }}>
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
          color: featured ? C.navy : "#fff",
          background: featured ? "#fff" : `linear-gradient(135deg, ${C.gradA}, ${C.gradB})`,
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

function ReviewsSection() {
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
            <div key={i} className="flex flex-col gap-2 p-5" style={{ background: "#fff", borderRadius: 14, border: `1px solid ${C.line}` }}>
              <Stars value={r.note} size={14} />
              {r.commentaire && (
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: C.ink, lineHeight: 1.5 }}>
                  « {r.commentaire} »
                </p>
              )}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.slate }}>{r.nom}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function WhatsAppIcon({ size = 20, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.47 14.38c-.29-.14-1.71-.84-1.97-.94-.27-.1-.46-.14-.65.14-.19.29-.75.94-.92 1.13-.17.19-.34.22-.63.07-.29-.14-1.22-.45-2.32-1.43-.86-.76-1.44-1.71-1.61-2-.17-.29-.02-.44.13-.59.13-.13.29-.34.43-.51.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.65-1.57-.89-2.15-.23-.56-.47-.48-.65-.49-.17-.01-.36-.01-.55-.01-.19 0-.5.07-.76.36-.26.29-1 .98-1 2.39s1.02 2.77 1.17 2.96c.14.19 2 3.05 4.85 4.28.68.29 1.21.47 1.62.6.68.22 1.3.19 1.79.11.55-.08 1.71-.7 1.95-1.37.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.34z" />
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.33 4.99L2 22l5.2-1.36a9.94 9.94 0 0 0 4.84 1.23h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2Zm0 18.2h-.01a8.24 8.24 0 0 1-4.2-1.15l-.3-.18-3.09.81.82-3.01-.2-.31a8.23 8.23 0 0 1-1.26-4.4c0-4.55 3.7-8.25 8.25-8.25 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.55-3.7 8.24-8.25 8.24Z" />
    </svg>
  );
}

function ContactCard({ href, icon, label, value }) {
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

function ContactSection() {
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

function RoleCard({ icon, title, desc, onClick, delay }) {
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
            ? `linear-gradient(135deg, ${C.gradA}, ${C.gradB})`
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

const TRUST_BADGES = [
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
function IllustrationPassport() {
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

function IllustrationChecklist() {
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

function IllustrationGlobe() {
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

function IllustrationApproved() {
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

const CAROUSEL_SLIDES = [
  { Illu: IllustrationPassport, title: "Un dossier bien préparé", desc: "Chaque document identifié selon votre motif de voyage." },
  { Illu: IllustrationChecklist, title: "Vérification minutieuse", desc: "Rien n'est envoyé sans avoir été relu et validé." },
  { Illu: IllustrationGlobe, title: "Suivi jusqu'au dépôt", desc: "Votre dossier accompagné, étape par étape." },
  { Illu: IllustrationApproved, title: "Objectif : votre visa", desc: "Un dossier solide, déposé dans les meilleures conditions." },
];

function VisualCarousel() {
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

function TrustBar() {
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

const STEPS = [
  { n: "01", title: "Créez votre dossier", desc: "Renseignez votre motif de voyage et votre situation — 2 minutes suffisent." },
  { n: "02", title: "Choisissez une offre et payez", desc: "Wave, Orange Money ou carte, en toute sécurité via PayDunya." },
  { n: "03", title: "Suivez chaque étape", desc: "Votre numéro de dossier permet de suivre l'avancement jusqu'à la décision." },
];

function HowItWorks() {
  return (
    <Section id="comment-ca-marche" eyebrow="Comment ça marche" title="Trois étapes, du dossier à la décision" subtitle="Aucune démarche cachée : voici exactement ce qui se passe après votre inscription.">
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

const FAQS = [
  { q: "Quel est le délai pour monter un dossier ?", a: "Une fois votre offre choisie et payée, votre dossier est pris en charge et vous êtes guidé document par document. Le délai dépend surtout de la rapidité avec laquelle vous rassemblez vos pièces." },
  { q: "Le paiement en ligne est-il sécurisé ?", a: "Oui, tous les paiements passent par PayDunya (Wave, Orange Money, carte bancaire), un prestataire de paiement agréé. Nous n'avons jamais accès à vos identifiants de paiement." },
  { q: "Que se passe-t-il si mon dossier est incomplet ?", a: "Chaque pièce est vérifiée avant la mise en ligne de votre demande. Si un document manque ou pose problème, vous êtes prévenu avant l'envoi, pas après." },
  { q: "Puis-je suivre l'avancement de mon dossier ?", a: "Oui, votre numéro de dossier (format VP-2026-XXXX) vous permet de retrouver son statut à tout moment depuis la page d'accueil." },
  { q: "Le prix affiché inclut-il les frais consulaires ?", a: "Non, nos offres couvrent l'accompagnement et la constitution du dossier. Les frais consulaires, fixés par chaque ambassade, restent à votre charge en plus." },
];

function FAQItem({ q, a, open, onClick }) {
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

function FAQSection() {
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

function LandingPage({ onSelect }) {
  return (
    <div style={{ background: C.paper }}>
      <NavBar onSelect={onSelect} />

      {/* Hero */}
      <div id="accueil" className="w-full px-5 md:px-10 py-14 md:py-20 relative overflow-hidden" style={{ scrollMarginTop: 68 }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div style={{ position: "absolute", top: "-12%", left: "-10%", width: 420, height: 420, borderRadius: "50%", background: `radial-gradient(circle, ${C.gradA}30, transparent 70%)`, filter: "blur(14px)", animation: "floatSlow 22s ease-in-out infinite" }} />
          <div style={{ position: "absolute", top: "8%", right: "-14%", width: 380, height: 380, borderRadius: "50%", background: `radial-gradient(circle, ${C.gradC}28, transparent 70%)`, filter: "blur(14px)", animation: "floatSlower 26s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: "-16%", left: "18%", width: 460, height: 460, borderRadius: "50%", background: `radial-gradient(circle, ${C.gradB}22, transparent 70%)`, filter: "blur(14px)", animation: "floatSlow 30s ease-in-out infinite reverse" }} />
        </div>
        <FlyingPlanes />

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center relative">
          {/* Colonne texte */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2">
            <LogoMark size={80} />
            <span
              className="uppercase mt-4"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11.5,
                letterSpacing: "0.1em",
                color: C.navy,
                background: `${C.gradB}18`,
                border: `1px solid ${C.gradB}44`,
                padding: "6px 16px",
                borderRadius: 999,
                animation: "riseIn 0.6s ease both",
              }}
            >
              Accompagnement visa Schengen · Dakar
            </span>
            <h1
              className="mt-4"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 34,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                background: `linear-gradient(100deg, ${C.gradA}, ${C.gradB} 45%, ${C.gradC})`,
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                animation: "riseIn 0.6s ease 0.1s both",
              }}
            >
              Votre dossier de visa, sans mauvaise surprise
            </h1>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: C.slate, animation: "riseIn 0.6s ease 0.18s both" }}>
              Montez votre dossier de visa Schengen, étape par étape, avec un vrai suivi jusqu'à la décision.
            </p>

            <div className="w-full flex flex-col gap-3 mt-4">
              <button
                onClick={() => onSelect("gratuit")}
                className="flex items-center gap-4 p-5 text-left w-full relative overflow-hidden"
                style={{
                  borderRadius: 18,
                  border: "none",
                  background: `linear-gradient(135deg, ${C.gradA}, ${C.gradB} 55%, ${C.gradC})`,
                  boxShadow: `0 16px 36px -14px ${C.gradB}40`,
                  animation: "riseIn 0.55s cubic-bezier(.2,.9,.3,1) both",
                  animationDelay: "0.14s",
                }}
              >
                <span
                  className="absolute uppercase"
                  style={{ top: 10, right: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.08em", color: "#fff", background: "rgba(255,255,255,0.2)", padding: "3px 8px", borderRadius: 999 }}
                >
                  Gratuit
                </span>
                <span className="flex items-center justify-center shrink-0" style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(255,255,255,0.18)" }}>
                  <FileCheck2 size={20} color="#fff" />
                </span>
                <span className="flex-1">
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16.5, color: "#fff", display: "block" }}>
                    Ma liste de documents
                  </span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
                    Personnalisée selon votre motif, en 2 minutes
                  </span>
                </span>
                <ChevronRight size={18} color="#fff" />
              </button>
              <RoleCard icon={<UserRound />} title="Je prépare mon dossier" desc="Créer ou retrouver mon dossier" onClick={() => onSelect("client")} delay="0.22s" />
              <RoleCard icon={<Building2 />} title="Espace agence" desc="Suivre l'ensemble des dossiers clients" onClick={() => onSelect("agence")} delay="0.3s" />
            </div>
          </div>

          {/* Colonne visuelle */}
          <div
            className="hidden md:block w-full"
            style={{ borderRadius: 24, overflow: "hidden", border: `1px solid ${C.line}`, boxShadow: `0 30px 60px -30px ${C.gradB}28`, animation: "riseIn 0.6s ease 0.2s both" }}
          >
            <IllustrationApproved />
          </div>
        </div>

        {/* Bandeau de points forts — vérifiables, sans chiffres inventés */}
        <div className="max-w-5xl mx-auto mt-12 relative">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5" style={{ background: "#fff", borderRadius: 18, border: `1px solid ${C.line}` }}>
            {[
              { icon: <MapPin />, label: "Basés à Dakar" },
              { icon: <WhatsAppIcon size={18} color={C.gradB} />, label: "Réponse rapide WhatsApp" },
              { icon: <FileCheck2 />, label: "Suivi transparent" },
              { icon: <Stamp />, label: "Expertise Schengen" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col sm:flex-row items-center sm:items-start gap-2 text-center sm:text-left">
                <span className="flex items-center justify-center shrink-0" style={{ width: 36, height: 36, borderRadius: 10, background: `${C.gradB}15` }}>
                  {React.isValidElement(item.icon) && item.icon.type === WhatsAppIcon ? item.icon : React.cloneElement(item.icon, { size: 17, color: C.gradB })}
                </span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 12.5, color: C.ink }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>


      <TrustBar />

      <VisualCarousel />

      {/* Services */}
      <Section id="services" eyebrow="Services" title="Un accompagnement complet, pas juste une checklist" subtitle="Chaque étape du dossier est prise en charge, du premier document au jour du rendez-vous.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICES.map((s, i) => (
            <ServiceCard key={s.title} {...s} delay={`${i * 0.08}s`} />
          ))}
        </div>
      </Section>

      <HowItWorks />

      {/* Tarifs */}
      <Section id="tarifs" eyebrow="Tarifs" title="Une offre pour chaque niveau d'accompagnement" subtitle="Le tarif exact se confirme une fois votre dossier créé.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PRICING.map((t, i) => (
            <PricingPreviewCard key={t.id} tier={t} onSelect={onSelect} featured={t.id === "accompagnement"} />
          ))}
        </div>
      </Section>

      {/* Avis clients */}
      <ReviewsSection />

      <FAQSection />

      {/* Contact */}
      <ContactSection />

      {/* Footer */}
      <footer style={{ background: C.navyDeep }}>
        <div className="max-w-5xl mx-auto px-5 md:px-10 py-14 flex flex-col gap-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            <div className="flex flex-col gap-3">
              <div style={{ background: "#fff", borderRadius: 10, padding: "6px 10px", width: "fit-content" }}>
                <Logo size={26} />
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
                Accompagnement à la constitution de dossiers de visa Schengen, basé à Dakar.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Phone size={14} color="#7DD3FC" />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                  Ouvert · Lun-Sam : 9h – 18h
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 13.5, color: "#fff" }}>
                Liens rapides
              </span>
              {[
                { href: "#accueil", label: "Accueil" },
                { href: "#services", label: "Services" },
                { href: "#tarifs", label: "Tarifs" },
                { href: "#faq", label: "FAQ" },
                { href: "#contact", label: "Contact" },
              ].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="footer-link"
                  style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}
                >
                  {l.label}
                </a>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 13.5, color: "#fff" }}>
                Destinations les plus courantes
              </span>
              {["France", "Allemagne", "Italie", "Espagne", "Belgique", "Pays-Bas", "Norvège", "Luxembourg"].map((d) => (
                <button
                  key={d}
                  onClick={() => onSelect("client", { pays: d })}
                  className="footer-link text-left"
                  style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: "rgba(255,255,255,0.65)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)" }}>
            <iframe
              title="Zone d'intervention — Grand Yoff, Dakar"
              src="https://maps.google.com/maps?q=Grand%20Yoff%2C%20Dakar%2C%20S%C3%A9n%C3%A9gal&z=13&output=embed"
              width="100%"
              height="200"
              style={{ border: 0, display: "block" }}
              loading="lazy"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 20 }}>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {[
                { id: "apropos", label: "À propos" },
                { id: "mentions", label: "Mentions légales" },
                { id: "cgv", label: "CGV" },
              ].map((l) => (
                <button
                  key={l.id}
                  onClick={() => onSelect(l.id)}
                  className="footer-link"
                  style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.6)", background: "transparent", border: "none", cursor: "pointer" }}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
              © {new Date().getFullYear()} VisAssistance Pro
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------------------------------------------------------------
   Client portal
---------------------------------------------------------------- */
/* ---------------------------------------------------------------
   Outil gratuit — liste de documents personnalisée. Capture le
   contact avant d'afficher la checklist, puis propose de continuer
   vers l'accompagnement payant avec motif/situation déjà repris.
---------------------------------------------------------------- */
/* ---------------------------------------------------------------
   Pages légales & à propos
---------------------------------------------------------------- */
const LEGAL_CONTENT = {
  apropos: {
    title: "À propos de VisAssistance Pro",
    body: [
      ["", "VisAssistance Pro accompagne les particuliers dans la constitution de leur dossier de demande de visa Schengen, depuis Dakar. L'objectif est simple : que chaque dossier soit complet, cohérent et déposé dans les meilleures conditions."],
      ["Ce que nous faisons", "Nous aidons à identifier les documents nécessaires selon le motif du voyage et la situation du demandeur, à vérifier leur cohérence avant dépôt, et à suivre le dossier jusqu'à la décision consulaire."],
      ["Ce que nous ne faisons pas", "Nous ne délivrons aucun visa — cette décision appartient exclusivement au consulat concerné. Aucun accompagnement, quel qu'il soit, ne peut garantir l'obtention d'un visa."],
      ["Notre engagement", "Transparence sur ce qui est inclus dans chaque offre, et sur les frais consulaires qui restent toujours à la charge du demandeur, en plus de nos prestations."],
    ],
  },
  mentions: {
    title: "Mentions légales",
    body: [
      ["Éditeur du site", "VisAssistance Pro — service d'accompagnement aux dossiers de visa, basé à Grand Yoff, Dakar, Sénégal. Contact : +221 77 619 91 61 (WhatsApp et téléphone)."],
      ["Hébergement", "Site (frontend) hébergé par Netlify, Inc. Application (backend) hébergée par Render Services, Inc. Paiements traités par PayDunya."],
      ["Propriété intellectuelle", "L'ensemble des contenus de ce site (textes, logo, mise en page) est la propriété de VisAssistance Pro, sauf mention contraire. Toute reproduction sans autorisation est interdite."],
      ["Responsabilité", "VisAssistance Pro accompagne la constitution des dossiers mais ne contrôle pas les décisions des autorités consulaires, seules compétentes pour l'attribution des visas."],
    ],
  },
  cgv: {
    title: "Conditions générales de vente",
    body: [
      ["Objet", "Les présentes conditions régissent la vente de prestations d'accompagnement à la constitution de dossiers de demande de visa Schengen par VisAssistance Pro."],
      ["Offres et tarifs", "Les offres et leurs tarifs sont affichés sur le site au moment de la commande. Les frais consulaires, fixés par chaque ambassade, ne sont pas inclus et restent à la charge du client."],
      ["Paiement", "Le paiement s'effectue en ligne via PayDunya (Wave, Orange Money ou carte bancaire). La prestation démarre après confirmation du paiement."],
      ["Absence de garantie de résultat", "VisAssistance Pro s'engage sur les moyens mis en œuvre pour la constitution du dossier, pas sur son résultat. La décision d'octroi du visa relève exclusivement du consulat."],
      ["Annulation", "Toute demande d'annulation doit être adressée via WhatsApp. Si l'accompagnement n'a pas encore débuté, un remboursement peut être étudié au cas par cas."],
      ["Données personnelles", "Les informations transmises (nom, téléphone, documents) sont utilisées uniquement pour le traitement du dossier, conformément à la loi sénégalaise n° 2008-12 du 25 janvier 2008 sur la protection des données à caractère personnel. Vous disposez d'un droit d'accès et de suppression de vos données, à exercer via WhatsApp."],
    ],
  },
};

function LegalPage({ page, onBack }) {
  const content = LEGAL_CONTENT[page];
  return (
    <div className="min-h-screen px-5 py-8" style={{ background: C.paper }}>
      <div className="max-w-md mx-auto flex flex-col gap-5">
        <button onClick={onBack} className="flex items-center gap-1" style={{ background: "transparent", border: "none", cursor: "pointer" }}>
          <ArrowLeft size={16} color={C.slate} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>Retour</span>
        </button>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: C.navy }}>
          {content.title}
        </h2>
        <div className="flex flex-col gap-4">
          {content.body.map(([heading, text], i) => (
            <div key={i} className="flex flex-col gap-1.5">
              {heading && (
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: C.ink }}>
                  {heading}
                </span>
              )}
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13.5, color: C.slate, lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FreeChecklistTool({ onBack, onContinue }) {
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
                  background: `linear-gradient(135deg, ${C.gradA}, ${C.gradB})`,
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

function ClientPortal({ onBack, prefill, initialDossier, initialShowPaidModal }) {
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
                            background: active ? `linear-gradient(135deg, ${C.gradA}, ${C.gradB})` : "transparent",
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
                <PrimaryButton onClick={() => setMode("paiement")}>Payer maintenant</PrimaryButton>
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
                        background: `linear-gradient(135deg, ${C.gradA}, ${C.gradB})`,
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
            <div className="flex flex-col items-center gap-3 p-6" style={{ background: "#fff", borderRadius: 18, border: `1px solid ${C.line}` }}>
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
              className="flex items-center justify-center gap-2 p-3 w-full"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: 13.5,
                color: "#fff",
                background: `linear-gradient(135deg, ${C.gradA}, ${C.gradB})`,
                border: "none",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              Imprimer / Enregistrer en PDF
            </button>
            <p className="text-center" style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: C.slate }}>
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
                  background: `linear-gradient(135deg, ${C.gradA}, ${C.gradB})`,
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

/* ---------------------------------------------------------------
   Agence portal
---------------------------------------------------------------- */
const STATUS_BADGE = {
  ouvert: { label: "Ouvert", color: C.slate },
  collecte: { label: "Collecte", color: C.slate },
  complet: { label: "Complet", color: C.gold },
  soumis: { label: "Soumis", color: C.navy },
  rdv: { label: "RDV pris", color: C.navy },
  decision: { label: "Décision", color: C.green },
};

function AgencePortal({ onBack, agencePin }) {
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
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate, textAlign: "center", padding: "24px 0" }}>
              Aucun prospect pour l'instant. Ils apparaîtront ici dès qu'un visiteur demandera sa liste de documents gratuite.
            </p>
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
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin" color={C.slate} />
              </div>
            ) : filtered.length === 0 ? (
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate, textAlign: "center", padding: "24px 0" }}>
                Aucun dossier pour l'instant. Les dossiers créés côté client apparaîtront ici.
              </p>
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
function AgenceGate({ onBack, onUnlocked }) {
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
          Le code d'accès est défini dans le fichier .env de votre serveur (AGENCE_PIN).
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
export default function App() {
  const [role, setRole] = useState(null);
  const [agencePin, setAgencePin] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const [autoPaid, setAutoPaid] = useState(null); // { dossier } une fois détecté
  const [checkingReturn, setCheckingReturn] = useState(
    () => new URLSearchParams(window.location.search).has("token") && !!localStorage.getItem("vp_pending_payment")
  );

  useEffect(() => {
    recordVisitOnce();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasToken = params.has("token");
    // Nettoie l'URL dans tous les cas pour éviter un re-déclenchement au rafraîchissement
    if (hasToken) window.history.replaceState({}, "", window.location.pathname);

    const pendingRaw = localStorage.getItem("vp_pending_payment");
    if (!hasToken || !pendingRaw) {
      setCheckingReturn(false);
      return;
    }

    let cancelled = false;
    const { ref, telephone, token } = JSON.parse(pendingRaw);

    // Le webhook PayDunya peut arriver quelques secondes après le retour du
    // client — on retente quelques fois avant d'abandonner silencieusement.
    // À partir du 2e essai, on interroge aussi PayDunya directement en secours,
    // au cas où le webhook n'arriverait pas du tout.
    const attempt = async (n) => {
      try {
        const found = await apiGetDossier(ref, telephone);
        if (cancelled) return;
        if (found?.paid) {
          localStorage.removeItem("vp_pending_payment");
          setAutoPaid({ dossier: found });
          setRole("client");
          setCheckingReturn(false);
          return;
        }
        if (n >= 1 && token) {
          await apiCheckPaymentStatus(token);
          if (cancelled) return;
          const rechecked = await apiGetDossier(ref, telephone);
          if (rechecked?.paid) {
            localStorage.removeItem("vp_pending_payment");
            setAutoPaid({ dossier: rechecked });
            setRole("client");
            setCheckingReturn(false);
            return;
          }
        }
      } catch {
        // on retente quand même, le webhook peut juste être en retard
      }
      if (n < 4) {
        setTimeout(() => attempt(n + 1), 2000);
      } else {
        localStorage.removeItem("vp_pending_payment");
        setCheckingReturn(false);
      }
    };
    attempt(0);

    return () => {
      cancelled = true;
    };
  }, []);

  if (checkingReturn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: C.paper }}>
        <Loader2 size={26} className="animate-spin" color={C.gradB} />
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: C.slate }}>
          Vérification de votre paiement…
        </p>
      </div>
    );
  }

  const handleSelect = (role, extra) => {
    if (extra) setPrefill(extra);
    setRole(role);
  };

  return (
    <>
      {role === null && <LandingPage onSelect={handleSelect} />}
      {role === "gratuit" && (
        <FreeChecklistTool
          onBack={() => setRole(null)}
          onContinue={(data) => {
            setPrefill(data);
            setRole("client");
          }}
        />
      )}
      {role === "client" && (
        <ClientPortal
          onBack={() => {
            setRole(null);
            setPrefill(null);
            setAutoPaid(null);
          }}
          prefill={prefill}
          initialDossier={autoPaid?.dossier}
          initialShowPaidModal={!!autoPaid}
        />
      )}
      {role === "agence" && !agencePin && (
        <AgenceGate onBack={() => setRole(null)} onUnlocked={(pin) => setAgencePin(pin)} />
      )}
      {role === "agence" && agencePin && (
        <AgencePortal agencePin={agencePin} onBack={() => { setRole(null); setAgencePin(null); }} />
      )}
      {(role === "apropos" || role === "mentions" || role === "cgv") && (
        <LegalPage page={role} onBack={() => setRole(null)} />
      )}
    </>
  );
}
