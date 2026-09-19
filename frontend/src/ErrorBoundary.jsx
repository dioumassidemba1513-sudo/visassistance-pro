import React from "react";
import { C } from "./shared";

/* ---------------------------------------------------------------
   Filet de sécurité : si une erreur JavaScript survient n'importe
   où dans l'application, ceci évite un écran blanc silencieux et
   propose de recharger la page plutôt que de bloquer le visiteur.
---------------------------------------------------------------- */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Erreur applicative interceptée :", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center"
          style={{ background: C.paper }}
        >
          <img src="/logo.png" alt="VisAssistance Pro" style={{ height: 36, width: "auto" }} />
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: C.ink }}>
            Un problème est survenu
          </h1>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: C.slate, maxWidth: 340 }}>
            Rien n'est perdu — rechargez la page pour continuer. Si le problème persiste, écrivez-nous sur WhatsApp.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              color: "#fff",
              background: C.ink,
              border: "none",
              borderRadius: 10,
              padding: "12px 24px",
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
