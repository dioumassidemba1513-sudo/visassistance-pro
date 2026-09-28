require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const app = express();
app.set("trust proxy", true); // nécessaire derrière le proxy de Render pour obtenir la vraie IP
app.use(cors());
app.use(express.json());
// PayDunya poste son IPN en application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

/* ---------------------------------------------------------------
   Anti-spam — limite le nombre de soumissions par IP sur les
   formulaires publics (dossier, liste gratuite, avis). Basique
   mais suffisant pour un site de cette taille, sans dépendance
   ni service tiers payant.
---------------------------------------------------------------- */
const rateLimitMap = new Map();
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [ip, entry] of rateLimitMap) {
    if (entry.windowStart < cutoff) rateLimitMap.delete(ip);
  }
}, 30 * 60 * 1000).unref();

function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > windowMs) {
      rateLimitMap.set(ip, { count: 1, windowStart: now });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ error: "Trop de tentatives depuis cette adresse. Merci de réessayer dans quelques minutes." });
    }
    next();
  };
}

// Un champ caché que seuls les robots remplissent (invisible pour un humain)
function rejectBots(req, res, next) {
  if (req.body && req.body.site_web) {
    // Réponse qui a l'air normale, pour ne pas indiquer au robot qu'il a été repéré
    return res.status(201).json({ ok: true });
  }
  next();
}

/* ---------------------------------------------------------------
   Base de données (SQLite — un seul fichier, aucun serveur à gérer)
   Pour un vrai passage à l'échelle plus tard : remplacer better-sqlite3
   par un client Postgres (ex. pg) en gardant les mêmes fonctions ci-dessous.
---------------------------------------------------------------- */
const db = new Database(process.env.DB_PATH || "visassistance.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS dossiers (
    ref TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    telephone TEXT,
    pays TEXT,
    motif TEXT,
    situation TEXT,
    status TEXT DEFAULT 'ouvert',
    decision TEXT,
    tier TEXT,
    paid INTEGER DEFAULT 0,
    paid_at INTEGER,
    notes TEXT DEFAULT '',
    documents TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);
// Migration douce pour les bases créées avant l'ajout de paid_at
try {
  db.exec(`ALTER TABLE dossiers ADD COLUMN paid_at INTEGER`);
} catch (e) {
  /* colonne déjà présente — rien à faire */
}

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dossier_ref TEXT NOT NULL,
    nom TEXT NOT NULL,
    note INTEGER NOT NULL,
    commentaire TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    telephone TEXT NOT NULL,
    pays TEXT,
    motif TEXT,
    situation TEXT,
    created_at INTEGER NOT NULL
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL
  )
`);
try {
  db.exec(`ALTER TABLE leads ADD COLUMN pays TEXT`);
} catch (e) {
  /* colonne déjà présente — rien à faire */
}

/* ---------------------------------------------------------------
   Logique métier de la checklist (identique à celle du frontend —
   c'est le serveur qui fait foi désormais)
---------------------------------------------------------------- */
const MOTIFS = {
  tourisme: "Tourisme",
  affaires: "Affaires",
  etudes: "Études",
  famille: "Visite familiale",
  transit: "Transit",
};

const SITUATIONS = {
  salarie: "Salarié(e)",
  independant: "Indépendant(e) / Entrepreneur",
  etudiant: "Étudiant(e)",
  sans_emploi: "Sans emploi",
  retraite: "Retraité(e)",
};

const BASE_DOCS = [
  "Passeport valide (émis depuis moins de 10 ans, valide au moins 3 mois après la date de retour prévue, 2 pages vierges minimum)",
  "Formulaire de demande de visa Schengen rempli et signé (via France-Visas ou le portail du pays de destination)",
  "Photo d'identité biométrique récente aux normes",
  "Récépissé de prise de rendez-vous au centre de dépôt (VFS Global ou équivalent)",
  "Assurance voyage Schengen (couverture médicale min. 30 000 €, valable dans tout l'espace Schengen pour toute la durée du séjour)",
  "Réservation de billet d'avion aller-retour (réservation suffit, pas de billet payé en totalité)",
  "Preuve d'hébergement (réservation d'hôtel ou attestation d'accueil)",
  "Relevés bancaires des 3 derniers mois (mouvements réguliers, éviter un dépôt important juste avant la demande)",
];

const MOTIF_DOCS = {
  tourisme: [
    "Itinéraire de voyage détaillé jour par jour",
    "Justificatif d'activité professionnelle ou de scolarité justifiant le retour (selon situation)",
  ],
  affaires: [
    "Lettre d'invitation de l'entreprise partenaire dans le pays de destination",
    "Attestation de l'employeur au Sénégal précisant l'objet de la mission et la prise en charge des frais",
    "Registre de commerce / NINEA de l'entreprise (si mission pour compte propre)",
    "Programme des rendez-vous professionnels prévus",
  ],
  etudes: [
    "Attestation d'inscription ou de préinscription de l'établissement d'accueil",
    "Justificatif de paiement des frais de scolarité (si déjà réglés)",
    "Preuve de logement étudiant",
    "⚠️ Pour un séjour de plus de 90 jours (année scolaire complète), la procédure passe par Campus France, pas par une simple demande de court séjour",
  ],
  famille: [
    "Attestation d'accueil (formulaire officiel validé par la mairie française du lieu d'hébergement, ou équivalent selon le pays)",
    "Copie de la pièce d'identité ou du titre de séjour de la personne qui accueille",
    "Justificatif du lien de parenté (acte de naissance, livret de famille, etc.)",
  ],
  transit: [
    "Visa valide du pays de destination finale (si celui-ci l'exige)",
    "Billet ou réservation vers la destination finale hors espace Schengen",
  ],
};

const SITUATION_DOCS = {
  salarie: [
    "Attestation de travail récente",
    "3 derniers bulletins de salaire",
    "Autorisation de congé de l'employeur",
  ],
  independant: [
    "Registre de commerce / NINEA",
    "Attestation d'activité",
    "Relevés bancaires professionnels (6 derniers mois)",
  ],
  etudiant: [
    "Certificat de scolarité en cours",
    "Prise en charge financière des parents (si applicable)",
  ],
  sans_emploi: [
    "Attestation de prise en charge financière par un garant",
    "Relevés bancaires du garant",
    "Lettre explicative de la situation",
  ],
  retraite: ["Justificatif de pension / retraite"],
};

const PAYS_DOCS = {
  Espagne: [
    "Le centre de dépôt est BLS International (et non VFS Global comme pour la France)",
    "2 photocopies du passeport (page d'identité + page de visa antérieur le cas échéant)",
    "Traduction en espagnol des documents qui ne sont pas rédigés en français (le consulat d'Espagne exige l'espagnol pour certaines pièces)",
    "Attestation d'assurance voyage à présenter obligatoirement en version imprimée au centre BLS",
  ],
  Allemagne: [
    "⚠️ IMPORTANT : les demandes de visa court séjour (tourisme, affaires, visite) pour l'Allemagne ne se déposent PAS à Dakar. Elles doivent être soumises au Consulat de l'Ambassade du Portugal à BISSAU (Guinée-Bissau), qui représente l'Allemagne pour ce type de visa depuis mars 2015",
    "Seules les demandes de long séjour (études, regroupement familial) se déposent directement à l'Ambassade d'Allemagne à Dakar",
    "Un rendez-vous est obligatoire avant tout dépôt, à confirmer directement auprès de l'autorité compétente selon le type de visa",
  ],
  Italie: [
    "Le centre de dépôt est BLS International Dakar (pour le tourisme individuel)",
    "La première demande de rendez-vous pour un visa tourisme doit être envoyée par email (visa.ambdakar@esteri.it) avec tous les documents réunis en un seul fichier PDF, avant toute prise de rendez-vous",
    "Pour un visa affaires, la démarche est différente : email direct à l'ambassade (dakar.vistiaffari@esteri.it), pas de passage par le circuit standard BLS",
    "Paiement au centre BLS uniquement par Wave, Orange Money ou carte bancaire — les espèces ne sont plus acceptées",
  ],
  Belgique: [
    "Le centre de dépôt est TLScontact Dakar (différent de VFS Global utilisé pour la France et les Pays-Bas)",
    "L'ambassade de Belgique alerte sur les tentatives de fraude — vérifiez toute information uniquement via dakar.visa@diplobel.fed.be",
  ],
  "Pays-Bas": [
    "Le centre de dépôt est VFS Global Dakar (comme pour la France)",
    "Pour une visite familiale ou privée, une simple lettre d'invitation rédigée par l'hébergeant est généralement acceptée — contrairement à la France, une attestation d'accueil visée en mairie n'est pas systématiquement exigée",
  ],
  Norvège: [
    "Le dépôt du dossier se fait chez VFS Global Dakar, comme pour la France",
    "⚠️ Depuis mars 2025, la décision est prise par l'ambassade de Norvège à Nairobi (Kenya), et non plus à Accra — comptez une semaine supplémentaire pour l'acheminement du dossier",
    "Prévoir une demande au moins 3 à 4 semaines avant le départ pour absorber ce délai",
  ],
  Luxembourg: [
    "⚠️ Contrairement aux autres pays, le dossier ne passe pas par VFS Global, BLS ou TLScontact : il se dépose directement à l'Ambassade du Luxembourg à Dakar (Résidence Naja, Rue David Diop, Fann)",
    "Le rendez-vous s'obtient uniquement par email (dakar.consulat@mae.etat.lu) — aucune prise de rendez-vous par téléphone",
    "Aucun dossier n'est accepté par voie électronique : la comparution en personne est obligatoire au dépôt",
    "Demande à faire au moins 15 jours avant le départ, jusqu'à 6 mois à l'avance",
  ],
};

function buildChecklist(motif, situation, pays) {
  const items = [];
  BASE_DOCS.forEach((label, i) =>
    items.push({ id: `base-${i}`, category: "Identité & voyage", label, checked: false, note: "" })
  );
  (MOTIF_DOCS[motif] || []).forEach((label, i) =>
    items.push({ id: `motif-${i}`, category: `Motif : ${MOTIFS[motif] || ""}`, label, checked: false, note: "" })
  );
  (SITUATION_DOCS[situation] || []).forEach((label, i) =>
    items.push({
      id: `situ-${i}`,
      category: `Situation : ${SITUATIONS[situation] || ""}`,
      label,
      checked: false,
      note: "",
    })
  );
  (PAYS_DOCS[pays] || []).forEach((label, i) =>
    items.push({ id: `pays-${i}`, category: `Spécificités ${pays}`, label, checked: false, note: "" })
  );
  return items;
}

function generateRef() {
  const year = new Date().getFullYear();
  const num = Math.floor(1000 + Math.random() * 9000);
  return `VP-${year}-${num}`;
}

function rowToDossier(row) {
  if (!row) return null;
  return { ...row, paid: !!row.paid, documents: JSON.parse(row.documents) };
}

/* ---------------------------------------------------------------
   Auth agence — un code partagé simple. Suffisant pour une seule
   agence ; pour plusieurs conseillers avec des comptes distincts,
   il faudra une vraie table utilisateurs + mots de passe hashés.
---------------------------------------------------------------- */
function requireAgencePin(req, res, next) {
  const pin = req.header("x-agence-pin");
  if (!process.env.AGENCE_PIN) {
    return res.status(500).json({ error: "AGENCE_PIN non configuré côté serveur." });
  }
  if (pin !== process.env.AGENCE_PIN) {
    return res.status(401).json({ error: "Code d'accès invalide." });
  }
  next();
}

app.post("/api/agence/login", (req, res) => {
  if (req.body.pin === process.env.AGENCE_PIN) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

/* ---------------------------------------------------------------
   Dossiers
---------------------------------------------------------------- */

// Créer un dossier (parcours client)
app.post("/api/dossiers", rateLimit({ windowMs: 10 * 60 * 1000, max: 8 }), rejectBots, (req, res) => {
  const { nom, telephone, pays, motif, situation } = req.body;
  if (!nom || !motif || !situation) {
    return res.status(400).json({ error: "nom, motif et situation sont requis." });
  }

  let ref = generateRef();
  // évite (rare) collision de référence
  while (db.prepare("SELECT 1 FROM dossiers WHERE ref = ?").get(ref)) {
    ref = generateRef();
  }

  const documents = buildChecklist(motif, situation, pays);
  const created_at = Date.now();

  db.prepare(
    `INSERT INTO dossiers (ref, nom, telephone, pays, motif, situation, status, documents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'ouvert', ?, ?)`
  ).run(ref, nom, telephone || "", pays || "", motif, situation, JSON.stringify(documents), created_at);

  const row = db.prepare("SELECT * FROM dossiers WHERE ref = ?").get(ref);
  res.status(201).json(rowToDossier(row));
});

// Retrouver un dossier par référence (le client fournit sa propre référence)
// Normalise un numéro pour comparaison (retire espaces/tirets/indicatif)
function normalizePhone(p) {
  return (p || "").replace(/[^0-9]/g, "").slice(-9);
}

app.get("/api/dossiers/:ref", (req, res) => {
  const row = db.prepare("SELECT * FROM dossiers WHERE ref = ?").get(req.params.ref.toUpperCase());
  if (!row) return res.status(404).json({ error: "Dossier introuvable." });

  const isAgence = req.header("x-agence-pin") === process.env.AGENCE_PIN;
  if (!isAgence) {
    const given = normalizePhone(req.query.telephone);
    const expected = normalizePhone(row.telephone);
    if (!given || !expected || given !== expected) {
      return res.status(403).json({ error: "Le numéro de téléphone ne correspond pas à ce dossier." });
    }
  }
  res.json(rowToDossier(row));
});

// Lister tous les dossiers (agence uniquement)
app.get("/api/dossiers", requireAgencePin, (req, res) => {
  const rows = db.prepare("SELECT * FROM dossiers ORDER BY created_at DESC").all();
  res.json(rows.map(rowToDossier));
});

// Mettre à jour un dossier — documents/notes ouverts au client, statut/décision réservés à l'agence
app.patch("/api/dossiers/:ref", (req, res) => {
  const ref = req.params.ref.toUpperCase();
  const row = db.prepare("SELECT * FROM dossiers WHERE ref = ?").get(ref);
  if (!row) return res.status(404).json({ error: "Dossier introuvable." });

  const isAgence = req.header("x-agence-pin") === process.env.AGENCE_PIN;
  const { documents, notes, status, decision, telephone } = req.body;

  if ((status || decision !== undefined) && !isAgence) {
    return res.status(401).json({ error: "Seule l'agence peut modifier le statut du dossier." });
  }
  if (!isAgence) {
    const given = normalizePhone(telephone);
    const expected = normalizePhone(row.telephone);
    if (!given || !expected || given !== expected) {
      return res.status(403).json({ error: "Le numéro de téléphone ne correspond pas à ce dossier." });
    }
  }

  const next = {
    documents: documents ? JSON.stringify(documents) : row.documents,
    notes: notes !== undefined ? notes : row.notes,
    status: isAgence && status ? status : row.status,
    decision: isAgence && decision !== undefined ? decision : row.decision,
  };

  db.prepare(
    "UPDATE dossiers SET documents = ?, notes = ?, status = ?, decision = ? WHERE ref = ?"
  ).run(next.documents, next.notes, next.status, next.decision, ref);

  const updated = db.prepare("SELECT * FROM dossiers WHERE ref = ?").get(ref);
  res.json(rowToDossier(updated));
});

// Suppression d'un dossier — réservée à l'agence
app.delete("/api/dossiers/:ref", requireAgencePin, (req, res) => {
  const ref = req.params.ref.toUpperCase();
  const row = db.prepare("SELECT * FROM dossiers WHERE ref = ?").get(ref);
  if (!row) return res.status(404).json({ error: "Dossier introuvable." });
  db.prepare("DELETE FROM dossiers WHERE ref = ?").run(ref);
  db.prepare("DELETE FROM reviews WHERE dossier_ref = ?").run(ref);
  res.json({ ok: true });
});

/* ---------------------------------------------------------------
   Paiement (PayDunya)
---------------------------------------------------------------- */
const MODE = process.env.PAYDUNYA_MODE || "test";
const BASE_URL =
  MODE === "live"
    ? "https://app.paydunya.com/api/v1"
    : "https://app.paydunya.com/sandbox-api/v1";

const PAYDUNYA_HEADERS = {
  "Content-Type": "application/json",
  "PAYDUNYA-MASTER-KEY": process.env.PAYDUNYA_MASTER_KEY,
  "PAYDUNYA-PRIVATE-KEY": process.env.PAYDUNYA_PRIVATE_KEY,
  "PAYDUNYA-TOKEN": process.env.PAYDUNYA_TOKEN,
};

// Doit correspondre aux offres affichées côté client
const PRICING = {
  verification: { label: "Vérification", amount: 10000 },
  accompagnement: { label: "Accompagnement", amount: 40000 },
};

// Prise de rendez-vous — tarif selon le pays de destination (démarche
// plus ou moins complexe selon le centre de dépôt concerné)
const APPOINTMENT_PRICING = { France: 35000, default: 22000 };

function resolveTier(tier, pays) {
  if (tier === "rdv") {
    return { label: "Prise de rendez-vous", amount: APPOINTMENT_PRICING[pays] || APPOINTMENT_PRICING.default };
  }
  return PRICING[tier];
}

app.post("/api/checkout", async (req, res) => {
  const { ref, tier } = req.body;
  if (!ref || !tier) {
    return res.status(400).json({ error: "ref et tier (offre) sont requis." });
  }

  const dossier = db.prepare("SELECT * FROM dossiers WHERE ref = ?").get(ref);
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });

  const offre = resolveTier(tier, dossier.pays);
  if (!offre) {
    return res.status(400).json({ error: "Offre inconnue." });
  }

  const payload = {
    invoice: {
      total_amount: offre.amount,
      description: `VisAssistance Pro — Offre ${offre.label} — dossier ${ref}`,
      customer: { name: dossier.nom, phone: dossier.telephone || "" },
      channels: ["wave-senegal", "orange-money-senegal", "free-money-senegal", "card"],
    },
    store: { name: "VisAssistance Pro" },
    custom_data: { dossier_ref: ref, tier },
    actions: {
      cancel_url: process.env.CANCEL_URL || "",
      return_url: process.env.RETURN_URL || "",
      callback_url: process.env.CALLBACK_URL || "",
    },
  };

  try {
    const { data } = await axios.post(`${BASE_URL}/checkout-invoice/create`, payload, {
      headers: PAYDUNYA_HEADERS,
    });

    if (data.response_code === "00") {
      db.prepare("UPDATE dossiers SET tier = ? WHERE ref = ?").run(tier, ref);
      return res.json({ checkout_url: data.response_text, token: data.token });
    }
    return res.status(400).json({ error: data.response_text || "Échec de création de la facture." });
  } catch (err) {
    console.error("Erreur création facture PayDunya :", err.response?.data || err.message);
    return res.status(500).json({ error: "Erreur lors de la création du paiement." });
  }
});

// Webhook IPN — confirme le paiement et met à jour le dossier automatiquement
app.post("/api/webhook/paydunya", (req, res) => {
  const data = req.body?.data || req.body;

  const expectedHash = crypto
    .createHash("sha512")
    .update(process.env.PAYDUNYA_MASTER_KEY || "")
    .digest("hex");

  if (!data || data.hash !== expectedHash) {
    console.warn("IPN PayDunya rejeté : hash invalide.");
    return res.status(400).send("Hash invalide");
  }

  const ref = data.custom_data?.dossier_ref;

  if (data.status === "completed" && ref) {
    db.prepare("UPDATE dossiers SET paid = 1, paid_at = ? WHERE ref = ?").run(Date.now(), ref);
    console.log(`Paiement confirmé pour le dossier ${ref}.`);
  } else {
    console.log(`IPN reçu — statut "${data.status}" pour le dossier ${ref}.`);
  }

  res.status(200).send("OK");
});

// Vérification manuelle du statut (utile après redirection return_url, ou pour un bouton "Vérifier mon paiement")
// Vérification manuelle du statut — filet de sécurité si le webhook PayDunya
// tarde ou échoue. Interroge PayDunya directement (authentifié côté serveur,
// non falsifiable) et met à jour la base si le paiement est bien confirmé.
app.get("/api/status/:token", async (req, res) => {
  try {
    const { data } = await axios.get(`${BASE_URL}/checkout-invoice/confirm/${req.params.token}`, {
      headers: PAYDUNYA_HEADERS,
    });

    const ref = data.custom_data?.dossier_ref;
    let dossierUpdated = false;

    if (data.status === "completed" && ref) {
      const dossier = db.prepare("SELECT * FROM dossiers WHERE ref = ?").get(ref);
      if (dossier && !dossier.paid) {
        db.prepare("UPDATE dossiers SET paid = 1, paid_at = ? WHERE ref = ?").run(Date.now(), ref);
        dossierUpdated = true;
        console.log(`Paiement confirmé pour le dossier ${ref} (via vérification manuelle, pas le webhook).`);
      }
    }

    res.json({ status: data.status, total_amount: data.invoice?.total_amount, ref, dossierUpdated });
  } catch (err) {
    console.error("Erreur vérification statut :", err.response?.data || err.message);
    res.status(500).json({ error: "Impossible de vérifier le statut." });
  }
});

/* ---------------------------------------------------------------
   Avis clients — soumis par un client après paiement, affichés
   publiquement sur la vitrine (aucune authentification requise
   pour la lecture, la soumission exige un dossier payé existant).
---------------------------------------------------------------- */
app.post("/api/reviews", rateLimit({ windowMs: 10 * 60 * 1000, max: 8 }), rejectBots, (req, res) => {
  const { ref, note, commentaire } = req.body;
  const n = Number(note);
  if (!ref || !n || n < 1 || n > 5) {
    return res.status(400).json({ error: "ref et note (1 à 5) sont requis." });
  }
  const dossier = db.prepare("SELECT * FROM dossiers WHERE ref = ?").get(ref.toUpperCase());
  if (!dossier) return res.status(404).json({ error: "Dossier introuvable." });
  if (!dossier.paid) {
    return res.status(400).json({ error: "Seul un dossier payé peut faire l'objet d'un avis." });
  }
  const already = db.prepare("SELECT 1 FROM reviews WHERE dossier_ref = ?").get(dossier.ref);
  if (already) {
    return res.status(400).json({ error: "Un avis a déjà été envoyé pour ce dossier." });
  }
  db.prepare(
    `INSERT INTO reviews (dossier_ref, nom, note, commentaire, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(dossier.ref, dossier.nom, n, (commentaire || "").slice(0, 500), Date.now());
  res.status(201).json({ ok: true });
});

// Avis publics affichés sur la vitrine — les plus récents d'abord
app.get("/api/reviews", (req, res) => {
  const rows = db
    .prepare(`SELECT nom, note, commentaire, created_at FROM reviews ORDER BY created_at DESC LIMIT 30`)
    .all();
  res.json(rows);
});

// A-t-on déjà un avis pour ce dossier ? (pour ne pas re-proposer le formulaire)
app.get("/api/reviews/:ref", (req, res) => {
  const row = db.prepare("SELECT 1 FROM reviews WHERE dossier_ref = ?").get(req.params.ref.toUpperCase());
  res.json({ exists: !!row });
});

/* ---------------------------------------------------------------
   Prospects — capturés via l'outil gratuit de liste de documents.
   La checklist est renvoyée immédiatement pour un affichage sans
   étape supplémentaire côté client.
---------------------------------------------------------------- */
app.post("/api/leads", rateLimit({ windowMs: 10 * 60 * 1000, max: 8 }), rejectBots, (req, res) => {
  const { nom, telephone, motif, situation, pays } = req.body;
  if (!nom || !telephone || !motif || !situation) {
    return res.status(400).json({ error: "nom, telephone, motif et situation sont requis." });
  }
  db.prepare(
    `INSERT INTO leads (nom, telephone, pays, motif, situation, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(nom, telephone, pays || null, motif, situation, Date.now());

  const documents = buildChecklist(motif, situation, pays);
  res.status(201).json({ documents });
});

// Liste des prospects — réservée à l'agence
app.get("/api/leads", requireAgencePin, (req, res) => {
  const rows = db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all();
  res.json(rows);
});

app.delete("/api/leads/:id", requireAgencePin, (req, res) => {
  db.prepare("DELETE FROM leads WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

/* ---------------------------------------------------------------
   Visites — compteur simple, anonyme (aucune IP ni donnée
   personnelle enregistrée), un appel par session côté client.
---------------------------------------------------------------- */
app.post("/api/visit", rateLimit({ windowMs: 60 * 1000, max: 5 }), (req, res) => {
  db.prepare("INSERT INTO visits (created_at) VALUES (?)").run(Date.now());
  res.status(201).json({ ok: true });
});

/* ---------------------------------------------------------------
   Statistiques — tableau de bord agence
---------------------------------------------------------------- */
app.get("/api/stats", requireAgencePin, (req, res) => {
  const dossiers = db.prepare("SELECT * FROM dossiers").all();
  const total = dossiers.length;
  const payes = dossiers.filter((d) => d.paid).length;
  const enAttente = total - payes;
  const revenu = dossiers.reduce((sum, d) => {
    if (!d.paid || !d.tier) return sum;
    return sum + (resolveTier(d.tier, d.pays)?.amount || 0);
  }, 0);
  const parStatut = dossiers.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});
  const avis = db.prepare("SELECT note FROM reviews").all();
  const noteMoyenne = avis.length ? avis.reduce((s, a) => s + a.note, 0) / avis.length : null;
  const nbProspects = db.prepare("SELECT COUNT(*) as c FROM leads").get().c;

  const now = Date.now();
  const jour = 24 * 60 * 60 * 1000;
  const visitesTotal = db.prepare("SELECT COUNT(*) as c FROM visits").get().c;
  const visitesAujourdhui = db.prepare("SELECT COUNT(*) as c FROM visits WHERE created_at > ?").get(now - jour).c;
  const visites7j = db.prepare("SELECT COUNT(*) as c FROM visits WHERE created_at > ?").get(now - 7 * jour).c;

  res.json({
    total, payes, enAttente, revenu, parStatut, nbAvis: avis.length, noteMoyenne, nbProspects,
    visitesTotal, visitesAujourdhui, visites7j,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Serveur VisAssistance Pro (mode ${MODE}) sur le port ${PORT}`);
});
