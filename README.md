# Portfolio — Killian Roche Rodriguez

Portfolio de développeur full-stack : site statique en HTML / JavaScript, fond spatial et système solaire de projets en Three.js, mode « Pro » noir et or, démos jouables des projets.

## Structure

```
portfolio/                  ← le site publié (dossier à mettre en ligne)
├── index.html
├── assets/
│   ├── css/style.css       ← styles du site
│   ├── css/tailwind.css    ← généré, ne pas modifier à la main
│   ├── js/                 ← scripts (projects.js = données des projets)
│   └── img/                ← favicon, image de partage, captures des projets
└── projets/                ← démos jouables (devisArtisan, Grind Arena, PokéDB, Bureaucratie)
tailwind.config.js          ← configuration Tailwind (couleurs, police)
tailwind.input.css
package.json
```

## Développement

```bash
npm install          # une fois
npm run watch:css    # recompile Tailwind à chaque modification
npm run build:css    # compilation minifiée avant publication
```

Ajouter ou modifier un projet : `portfolio/assets/js/projects.js` (il alimente la grille et le système solaire).

Après une modification de CSS ou de JS, augmenter le numéro `?v=` correspondant dans `portfolio/index.html` pour que les navigateurs ne gardent pas l'ancienne version en cache.
