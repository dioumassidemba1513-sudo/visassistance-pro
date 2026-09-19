import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
} from "lucide-react";
import {
  C,
} from "../shared";

export function LegalPage({ page, onBack }) {
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
