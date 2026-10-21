// ====================================================
// DONNÉES DES PROJETS (les planètes)
// Utilisées par le système solaire ET la grille « Projets Récents ».
// Ajoute tes liens dans demo / github / download (vide = bouton masqué).
// filters : clés de PROJECT_FILTERS · icon : nom d'icône Lucide · image : capture affichée sur la carte (optionnelle)
// ====================================================
const PROJECTS = [
    {
        id: 'greenscore', name: 'GreenScore Web', category: 'Projet universitaire · SAÉ BUT 3',
        icon: 'leaf', filters: ['web', 'parcours'],
        short: "Plugin navigateur qui mesure l'empreinte carbone des pages web visitées.",
        desc: "Projet de groupe (BUT Informatique, 2026-2027) : plugin Firefox / Chrome qui mesure la consommation et l'empreinte carbone des sites visités, avec une application web de tableaux de bord. Reprise et amélioration d'un projet existant : précision des calculs, anonymisation des données, sobriété du stockage.",
        tags: ['Rust', 'SvelteKit', 'MySQL', 'JavaScript', 'WebExtension'],
        demo: '', github: '',
        color: 0x3fbf6f, glow: 0x7dffa8, type: 'earth', size: 2.1, orbit: 15, speed: 0.11
    },
    {
        id: 'ocr', name: 'Archivage OCR', category: 'Alternance · Burographic',
        icon: 'scan-text', filters: ['parcours'],
        short: "Module d'archivage de documents avec OCR et complément Outlook.",
        desc: "Module interne d'archivage de documents avec reconnaissance de texte (OCR), développé en alternance chez Burographic. Base MySQL de 8 tables et complément Microsoft Outlook pour importer les pièces jointes directement, avec recherche de clients en temps réel et création à la volée.",
        tags: ['MySQL', 'OCR', 'Complément Outlook', 'JavaScript'],
        demo: '', github: '',
        color: 0x5a7bd6, glow: 0x9db4ff, type: 'rock', size: 1.7, orbit: 22, speed: 0.085
    },
    {
        id: 'devis', name: 'devisArtisan', category: 'SaaS · Projet personnel',
        icon: 'file-text', filters: ['web'],
        short: 'Générateur de devis et factures pour les artisans français.',
        desc: "SaaS de création de devis et de factures pour les artisans français, avec calcul de la TVA, logo de l'entreprise et envoi par email. Backend PHP / MySQL avec PDO, authentification JWT et rotation des refresh tokens, frontend en JavaScript natif. Plan gratuit limité à 5 documents et plan Pro (logo, envoi par email, documents illimités), tableau de bord, fichier clients, numérotation automatique et export PDF. La démo ci-dessus simule l'API dans votre navigateur : un compte d'exemple est déjà rempli, tout est sauvegardé localement, et le passage Pro comme l'envoi d'emails sont simulés.",
        tags: ['PHP', 'MySQL', 'PDO', 'JWT', 'JavaScript'],
        image: 'assets/img/projects/devis.webp',
        preview: 'projets/devisartisan/index.html?v=202610191556',
        demo: 'projets/devisartisan/index.html?v=202610191556', github: '',
        color: 0xd99a3a, glow: 0xffd28a, type: 'gas', size: 2.6, orbit: 30, speed: 0.065, ring: true
    },
    {
        id: 'grind', name: 'Grind Arena', category: 'Jeu vidéo · FPS 3D',
        icon: 'swords', filters: ['jeu'],
        short: 'FPS de survie par vagues en Three.js, jouable dans le navigateur et sur PC.',
        desc: "FPS d'arène où l'on survit à des vagues d'ennemis de plus en plus coriaces, boss compris. 8 classes jouables (Le Rempart, Le Guetteur, Le Spectre…) avec chacune ses armes, son ultime et son arbre de compétences, des événements de vague aléatoires, une progression sauvegardée et une interface en français et en anglais. Aucun asset externe : toute la géométrie est procédurale et les sons sont synthétisés en direct (Web Audio). Environ 18 000 lignes de JavaScript en modules, bundlé avec Vite et packagé en application Windows avec Electron. La démo ci-dessus est la version web : cliquez dans le jeu pour capturer la souris, Échap pour la relâcher.",
        tags: ['Three.js', 'JavaScript', 'Vite', 'Electron', 'Web Audio'],
        image: 'assets/img/projects/grind.webp',
        preview: 'projets/grindarena/index.html',
        demo: 'projets/grindarena/index.html', github: '',
        download: '', // lien vers le zip Windows (ex. Release GitHub, itch.io, Drive) : vide = bouton masqué
        color: 0xd8483a, glow: 0xff8a6a, type: 'lava', size: 1.9, orbit: 38, speed: 0.052
    },
    {
        id: 'pokedb', name: 'PokéDB', category: 'Application web',
        icon: 'book-open', filters: ['web'],
        short: 'Encyclopédie Pokémon en français basée sur PokéAPI.',
        desc: "Encyclopédie Pokémon en français construite sur PokéAPI v2 : défilement infini, statistiques, calculateur de faiblesses, chaînes d'évolution, formes régionales (Alola, Galar, Hisui, Paldea), Méga-évolutions et Gigamax, capacités, talents et objets. Les noms français sont servis depuis un cache JSON statique pour éviter un appel API par carte.",
        tags: ['JavaScript', 'PokéAPI', 'GraphQL', 'JSON', 'HTML / CSS'],
        image: 'assets/img/projects/pokedb.webp',
        preview: 'projets/pokedb/index.html',
        demo: 'projets/pokedb/index.html', github: '',
        color: 0xe25c6a, glow: 0xffb3bd, type: 'gas', size: 1.6, orbit: 45, speed: 0.044
    },
    {
        id: 'orage', name: 'Atelier Orage', category: '3D · Configurateur & conduite',
        icon: 'car', filters: ['web', 'jeu'],
        short: 'Configurateur 3D d’une voiture de sport, avec un mode essai routier jouable.',
        desc: "Configurateur automobile 3D de l'Orage GT-1, une sportive fictive entièrement modélisée en code (aucun modèle 3D importé). Peinture en 11 teintes ou couleur libre, 5 finitions (métallisée, mate, nacrée, chrome, carbone) rendue avec un vernis réaliste et des reflets d'environnement, jantes, étriers, aileron, vitrage, plaque d'immatriculation et inscription personnalisées sur les portières, lieux et éclairages de présentation, vues caméra. Le mode « Essai routier » permet de conduire la voiture au clavier ou au tactile, avec pilote automatique, cycle jour / coucher de soleil / nuit et son moteur synthétisé. La configuration est sauvegardée dans le navigateur. Un seul fichier HTML, en Three.js.",
        tags: ['Three.js', 'JavaScript', 'WebGL', 'Canvas API', 'Web Audio', 'localStorage'],
        image: 'assets/img/projects/orange.webp?v=202610201003',
        preview: 'projets/voiture/index.html?v=202610211537',
        demo: 'projets/voiture/index.html?v=202610211537', github: '',
        color: 0x1f5fff, glow: 0x8fd0ff, type: 'ice', size: 1.5, orbit: 52, speed: 0.037
    },
    {
        id: 'echeance', name: 'Échéance', category: 'Application web · Productivité',
        icon: 'calendar-check', filters: ['web'],
        short: 'Tableau de tâches à colonnes pour suivre ses projets, ses échéances et ses rappels.',
        desc: "Tableau de tâches (kanban) pensé pour suivre ses projets au quotidien. À la première ouverture, on choisit un profil (développeur, freelance, créateur) qui prépare les bonnes colonnes, ou on compose son propre tableau de 2 à 8 colonnes ; on peut en avoir plusieurs. Chaque tâche a un client, une priorité, une date d'échéance, un rappel, un poids en points, des étapes à cocher et des notes. L'avancement est calculé en pourcentage pondéré, les tâches en retard ou proches de l'échéance ressortent, et un panneau regroupe les rappels du moment. Glisser-déposer à la souris, appui long avec vibration sur mobile, une colonne à la fois sur petit écran. Pas de compte : tout est sauvegardé dans le navigateur. Un seul fichier HTML, en JavaScript natif.",
        tags: ['JavaScript', 'HTML / CSS', 'Drag & drop', 'localStorage', 'Responsive'],
        image: 'assets/img/projects/echeance.webp',
        preview: 'projets/echeance/index.html?v=202610201046',
        demo: 'projets/echeance/index.html?v=202610201046', github: '',
        color: 0x5b3c9e, glow: 0xc3a6ff, type: 'ink', size: 1.8, orbit: 60, speed: 0.031, ring: true
    },
    {
        id: 'alien', name: 'Flotte Alien', category: '3D · Scène Three.js (BUT)',
        icon: 'rocket', filters: ['parcours'],
        short: 'Scène spatiale en Three.js : secoupes, vaisseaux mères et station de combat animés.',
        desc: "Scène 3D réalisée en TD de Three.js (BUT Informatique) : une flotte alien entièrement construite à partir de formes de base (sphères, cylindres, tores) et de groupes d'objets. Une escadrille de secoupes avance en projetant des rayons tracteurs, un méga-vaisseau transporte des secoupes qu'il peut larguer, et quatre vaisseaux mères à gyroscope tournent autour d'une immense station de combat. Commandes au clavier : Espace pour charger et tirer les canons, flèches pour déplacer le vaisseau mère, & pour larguer une secoupe, R pour revenir au départ. Caméra libre à la souris et réglages de la caméra (champ de vision, plans proche et lointain) dans un panneau lil-gui.",
        tags: ['Three.js', 'JavaScript', 'WebGL', 'Modules ES'],
        image: 'assets/img/projects/alien.webp',
        preview: 'projets/threejsAlien/index.html?v=202610211737',
        demo: 'projets/threejsAlien/index.html?v=202610211737', github: '',
        color: 0x2f9e57, glow: 0x6dffb0, type: 'rock', size: 1.6, orbit: 67, speed: 0.027
    }
];

// Filtres de la grille « Projets Récents »
const PROJECT_FILTERS = [
    { key: 'all', label: 'Tous' },
    { key: 'web', label: 'Applications web' },
    { key: 'jeu', label: 'Jeux' },
    { key: 'parcours', label: 'Études & alternance' }
];
