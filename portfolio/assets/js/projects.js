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
        image: 'assets/img/projects/orange.png?v=202610200950',
        preview: 'projets/voiture/index.html?v=202610200934',
        demo: 'projets/voiture/index.html?v=202610200934', github: '',
        color: 0x1f5fff, glow: 0x8fd0ff, type: 'ice', size: 1.5, orbit: 52, speed: 0.037
    },
    {
        id: 'bureaucratie', name: 'Bureaucratie', category: 'Jeu incrémental',
        icon: 'stamp', filters: ['jeu'],
        short: 'Jeu incrémental au guichet : vérifiez, tamponnez, faites grandir votre administration.',
        desc: "Jeu incrémental sur l'absurdité administrative. Au guichet, on compare chaque formulaire à la liste des règles (signature, case cochée, date de validité, tampon bleu, papier rose…) puis on tamponne « Approuvé » ou « Refusé », à la souris ou au clavier (A / R). La paperasse gagnée sert à recruter 7 services qui produisent tout seuls, se débloquent en chaîne et se boostent entre eux. Événements aléatoires (inspection surprise, visite du ministre, nouvelles circulaires), progression du Bureau 214 jusqu'au Bureau galactique, réformes administratives en guise de prestige, gains hors ligne et sauvegarde automatique. Un seul fichier HTML, en JavaScript natif sans aucune dépendance.",
        tags: ['JavaScript', 'HTML / CSS', 'localStorage', 'Game design'],
        image: 'assets/img/projects/bureaucratie.webp',
        preview: 'projets/officeClicker/index.html',
        demo: 'projets/officeClicker/index.html', github: '',
        color: 0x5b3c9e, glow: 0xc3a6ff, type: 'ink', size: 1.8, orbit: 60, speed: 0.031, ring: true
    }
];

// Filtres de la grille « Projets Récents »
const PROJECT_FILTERS = [
    { key: 'all', label: 'Tous' },
    { key: 'web', label: 'Applications web' },
    { key: 'jeu', label: 'Jeux' },
    { key: 'parcours', label: 'Études & alternance' }
];
