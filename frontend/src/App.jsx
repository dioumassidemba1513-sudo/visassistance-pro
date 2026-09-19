import React, { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { C, apiGetDossier, apiCheckPaymentStatus, recordVisitOnce } from "./shared";
import { LandingPage } from "./pages/LandingPage";
import { FreeChecklistTool } from "./pages/FreeChecklistTool";
import { ClientPortal } from "./pages/ClientPortal";
import { AgenceGate, AgencePortal } from "./pages/AgencePortal";
import { LegalPage } from "./pages/LegalPage";

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
    <div key={role ?? "accueil"} className="screen-enter">
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
    </div>
  );
}
