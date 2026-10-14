# Le Studio

Générateur de visuels pour les réseaux sociaux. Initiative personnelle non officielle, actuellement non soutenue par le parti Nouvelle Énergie.

Stack : Next.js, React, TypeScript, Tailwind CSS et shadcn/ui (Radix).

## Lancer le projet

Prérequis : Node.js 20.9 ou supérieur et npm.

```powershell
npm.cmd ci
npm.cmd run dev
```

Ouvrir [http://127.0.0.1:3000](http://127.0.0.1:3000). Aucun compte ni service externe n’est nécessaire pour le développement local.

## Fonctionnalités

- Six modèles : message, citation libre, événement, image, chiffre et typographie.
- Quatre formats : carré, portrait, Story et paysage.
- Trois couleurs et deux compositions.
- Import d’une image personnelle JPG, PNG ou WebP, jusqu’à 10 Mo.
- Aperçu et téléchargement en PNG ou JPEG.

Les textes et images sont traités dans le navigateur, sans sauvegarde automatique. L’application n’utilise pas de cookies ni de mesure d’audience. L’hébergeur peut traiter des données techniques de connexion.

L’exploration est interdite à tous les robots via `robots.txt`, avec des directives `noindex` dans les pages et les en-têtes HTTP. Ces consignes reposent sur leur respect par les robots.

## Ressources et organisation

- `src/components/` : interface et aperçu.
- `src/lib/catalog.ts` : modèles, textes de départ, formats et couleurs.
- `src/lib/render-poster.ts` : rendu des visuels.
- `src/lib/import-image.ts` : préparation des images importées.
- `public/brand/` et `public/fonts/` : ressources graphiques utilisées par le site.

Les dossiers graphiques sources ont été supprimés ; ils ne sont pas nécessaires au fonctionnement du site. `public/brand/source-manifest.json` conserve leur origine historique et les empreintes enregistrées lors de l’intégration.

## Vérification et build

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run start
```

`start` lance le build de production sur le port 3000 : arrêter le serveur de développement avant de l’utiliser.

Les captures et rapports locaux restent dans `artifacts/`, exclu de Git avec les dépendances, les builds, les caches et les fichiers d’environnement. Les ressources dans `public/` et `package-lock.json` sont destinés à être versionnés.

Avant publication, compléter le contact `[A VENIR]` dans les mentions légales.
