# Guide de déploiement — VisAssistance Pro

Vous partez de zéro : ce guide suppose que vous n'avez ni compte GitHub ni
hébergeur. Comptez 30-40 minutes la première fois.

## Étape 1 — Compte GitHub (5 min)

1. Allez sur https://github.com et créez un compte gratuit.
2. Cliquez sur "New repository" (bouton vert "+" en haut à droite).
3. Nommez-le `visassistance-pro`, laissez-le "Public" ou "Private", ne cochez
   rien d'autre, cliquez "Create repository".
4. Sur votre ordinateur, dans le dossier de ce projet, ouvrez un terminal et
   tapez (remplacez VOTRE-USER par votre nom d'utilisateur GitHub) :

```bash
git init
git add .
git commit -m "Premier envoi"
git branch -M main
git remote add origin https://github.com/VOTRE-USER/visassistance-pro.git
git push -u origin main
```

GitHub vous demandera de vous connecter (un jeton d'accès personnel, pas
votre mot de passe — GitHub vous guide pour le créer si besoin).

## Étape 2 — Déployer le backend sur Render (10 min)

1. Allez sur https://render.com, créez un compte (vous pouvez vous connecter
   directement avec GitHub).
2. Cliquez "New +" → "Web Service".
3. Connectez votre dépôt `visassistance-pro`.
4. Configuration :
   - **Root Directory** : `backend`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : Free
5. Dans l'onglet "Environment", ajoutez les variables (valeurs de
   `backend/.env.example`) :
   - `PAYDUNYA_MODE` = `test` (mettrez `live` plus tard)
   - `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN` (étape 4)
   - `AGENCE_PIN` = un code que vous choisissez (ex. `4127`)
   - `CANCEL_URL`, `RETURN_URL` = URLs de votre frontend (étape 3, à remplir
     après coup)
   - `CALLBACK_URL` = `https://VOTRE-BACKEND.onrender.com/api/webhook/paydunya`
   - `DB_PATH` = `./visassistance.db`
6. Cliquez "Create Web Service". Render vous donne une URL du type
   `https://visassistance-pro.onrender.com` — notez-la, c'est votre backend.

**Important** : sur le plan gratuit de Render, le disque n'est pas
persistant entre redéploiements — la base SQLite serait réinitialisée à
chaque mise à jour du code. Pour un vrai lancement, ajoutez un "Persistent
Disk" (payant, quelques dollars/mois) dans les réglages du service, monté
sur `/opt/render/project/src/backend`.

## Étape 3 — Compte PayDunya (5-10 min)

1. Allez sur https://paydunya.com, créez un compte Business.
2. Une fois connecté : "Intégrez notre API" → récupérez vos clés
   `Master Key`, `Private Key`, `Token` (mode test au départ).
3. Retournez sur Render (étape 2) et collez ces clés dans les variables
   d'environnement, puis redéployez.

## Étape 4 — Déployer le frontend sur Netlify (5 min, aucun Git requis)

1. Sur votre ordinateur, dans `frontend/`, mettez à jour la ligne suivante
   dans `src/App.jsx` avec l'URL Render de l'étape 2 :

```js
const API_BASE_URL = "https://VOTRE-BACKEND.onrender.com";
```

2. Ouvrez un terminal dans `frontend/` :

```bash
npm install
npm run build
```

   Cela crée un dossier `dist/`.
3. Allez sur https://app.netlify.com, créez un compte gratuit.
4. Glissez-déposez simplement le dossier `dist/` sur la page d'accueil
   Netlify ("Drag and drop your site output folder here"). Netlify vous
   donne une URL publique en quelques secondes (ex.
   `https://visassistance-pro.netlify.app`).
5. Retournez sur Render (étape 2), mettez à jour `CANCEL_URL` et
   `RETURN_URL` avec cette URL Netlify, puis redéployez le backend.

## Étape 5 — Test réel

1. Ouvrez votre URL Netlify, créez un dossier test.
2. Lancez un paiement avec les identifiants de test PayDunya (fournis dans
   leur documentation sandbox).
3. Vérifiez sur Render (onglet "Logs") que l'IPN `Paiement confirmé pour le
   dossier ...` s'affiche bien.
4. Une fois satisfait, repassez PayDunya en mode `live` (vos vraies clés),
   changez `PAYDUNYA_MODE=live` sur Render, refaites un petit paiement réel
   pour valider avant d'ouvrir au public.

## Pour la suite

- Chaque fois que vous modifiez le code : `git add . && git commit -m "..."
  && git push` → Render redéploie le backend automatiquement ; pour le
  frontend, refaites `npm run build` et re-glissez `dist/` sur Netlify (ou
  connectez Netlify à GitHub pour un déploiement automatique aussi).
