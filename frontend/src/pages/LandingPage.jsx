import React, { useState, useEffect, useCallback } from "react";
import {
  Stamp,
  FileCheck2,
  Circle,
  CheckCircle2,
  ChevronRight,
  Building2,
  UserRound,
  Phone,
  MapPin,
} from "lucide-react";
import {
  C,
  ContactSection,
  FAQSection,
  FlyingPlanes,
  HowItWorks,
  Logo,
  LogoMark,
  NavBar,
  PRICING,
  PricingPreviewCard,
  ReviewsSection,
  RoleCard,
  SERVICES,
  Section,
  ServiceCard,
  TrustBar,
  VisualCarousel,
  WhatsAppIcon,
} from "../shared";

export function LandingPage({ onSelect }) {
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
              className="flex items-center gap-2 mt-4"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12.5,
                fontWeight: 500,
                color: C.ink,
                background: "#F8FAFC",
                border: `1px solid ${C.line}`,
                padding: "7px 16px",
                borderRadius: 999,
                animation: "riseIn 0.6s ease both",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 999, background: C.green, display: "inline-block" }} />
              Agence d'accompagnement visa à Dakar
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
                  background: C.ink,
                  boxShadow: "0 16px 36px -14px rgba(15,23,42,0.4)",
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

          {/* Colonne visuelle — aperçu d'un dossier (exemple illustratif) */}
          <div
            className="hidden md:block w-full p-6"
            style={{ borderRadius: 24, background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 30px 60px -30px rgba(15,23,42,0.18)", animation: "riseIn 0.6s ease 0.2s both" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center shrink-0" style={{ width: 40, height: 40, borderRadius: 10, background: C.ink, color: "#fff", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13 }}>
                  VP
                </span>
                <span className="flex flex-col">
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5, color: C.ink }}>
                    Dossier client #VP-2026-4821
                  </span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.slate }}>
                    France · Tourisme · <em style={{ fontStyle: "normal", color: "#B4BCC8" }}>exemple</em>
                  </span>
                </span>
              </div>
              <span
                className="uppercase shrink-0"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.06em", color: C.green, background: `${C.green}15`, padding: "5px 10px", borderRadius: 999 }}
              >
                Prêt au dépôt
              </span>
            </div>

            <div className="flex items-center gap-4 p-4 mb-5" style={{ background: C.paper, borderRadius: 14 }}>
              <div className="relative shrink-0" style={{ width: 60, height: 60 }}>
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="26" fill="none" stroke={C.line} strokeWidth="6" />
                  <circle
                    cx="30" cy="30" r="26" fill="none" stroke={C.gradB} strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 26}`} strokeDashoffset={`${2 * Math.PI * 26 * (1 - 0.88)}`}
                    strokeLinecap="round" transform="rotate(-90 30 30)"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, color: C.ink }}>
                  88%
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13.5, color: C.ink }}>
                  7 documents sur 8 validés
                </span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: C.slate }}>
                  Relecture terminée par le conseiller
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {[
                { label: "Passeport & biométrie", done: true },
                { label: "Assurance voyage 30 000 €", done: true },
                { label: "Relevés bancaires 3 mois", done: true },
                { label: "Réservation billet A/R", done: false },
              ].map((doc) => (
                <div key={doc.label} className="flex items-center justify-between py-1">
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: doc.done ? C.ink : C.slate }}>{doc.label}</span>
                  {doc.done ? (
                    <CheckCircle2 size={18} color={C.green} />
                  ) : (
                    <Circle size={18} color={C.line} />
                  )}
                </div>
              ))}
            </div>
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
                { href: "#procedure", label: "Procédure" },
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
export const LEGAL_CONTENT = {
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
