// Convertit games.csv (dataset Steam de Kaggle) en data/jeux.json, léger et prêt pour le jeu.
// Usage : node outils/convertir-csv.js [nombre de jeux, tous par défaut]
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.join(RACINE, 'games.csv');
const CIBLE = path.join(RACINE, 'data', 'jeux.json');
const NOMBRE = Number(process.argv[2]) || Infinity;

// Genres Steam traduits ; ceux absents de la liste sont ignorés
const GENRES = {
    'Action': 'Action', 'Adventure': 'Aventure', 'Casual': 'Casual', 'Indie': 'Indé',
    'RPG': 'RPG', 'Simulation': 'Simulation', 'Strategy': 'Stratégie',
    'Massively Multiplayer': 'MMO', 'Racing': 'Course', 'Sports': 'Sport',
    'Free To Play': 'Free-to-play', 'Early Access': 'Accès anticipé',
};

// Thèmes tirés des tags Steam (posés par les joueurs), traduits et regroupés pour les filtres.
// Plusieurs tags peuvent donner le même thème (Rogue-like et Rogue-lite → Roguelike).
// Le groupe "Contenu sensible" lit aussi les genres officiels Steam du même nom.
const GROUPES_TAGS = {
    'Gameplay': {
        'Réflexion': ['Puzzle'], 'Plateforme': ['Platformer'], 'Tir': ['Shooter', 'FPS'],
        'Survie': ['Survival'], 'Monde ouvert': ['Open World'], 'Roguelike': ['Rogue-like', 'Rogue-lite'],
        'Visual novel': ['Visual Novel'], 'Point & click': ['Point & Click'], 'Combat en duel': ['Fighting'],
        'Bac à sable': ['Sandbox'], 'Gestion': ['Management', 'City Builder'], 'Tower defense': ['Tower Defense'],
        'Metroidvania': ['Metroidvania'], 'Battle royale': ['Battle Royale'], 'Rythme': ['Rhythm'],
        'Jeu de cartes': ['Card Game', 'Deckbuilding'], 'Infiltration': ['Stealth'],
        "Beat'em all": ['Hack and Slash', "Beat 'em up"], 'Souls-like': ['Souls-like'],
        'Tour par tour': ['Turn-Based Strategy', 'Turn-Based'], 'Objets cachés': ['Hidden Object'],
        'Bullet hell': ['Bullet Hell'], 'Dungeon crawler': ['Dungeon Crawler'], 'JRPG': ['JRPG'],
        'Simulation de vie': ['Life Sim', 'Farming Sim'], 'Romance': ['Romance', 'Dating Sim'],
    },
    'Modes': {
        'Multijoueur': ['Multiplayer', 'PvP'], 'Coopération': ['Co-op', 'Online Co-Op'], 'Réalité virtuelle': ['VR'],
    },
    'Univers': {
        'Horreur': ['Horror'], 'Science-fiction': ['Sci-fi', 'Space', 'Cyberpunk'], 'Fantasy': ['Fantasy', 'Medieval'],
        'Post-apocalyptique': ['Post-apocalyptic', 'Zombies'], 'Guerre': ['War', 'Military'], 'Anime': ['Anime'],
        'Pixel art': ['Pixel Graphics'], 'Narratif': ['Story Rich'], 'Enquête': ['Mystery', 'Detective'],
        'Comédie': ['Comedy'], 'Relaxant': ['Relaxing', 'Cozy'],
    },
    'Contenu sensible': {
        'Contenu sexuel': ['Sexual Content', 'Hentai', 'NSFW'], 'Nudité': ['Nudity'],
        'Violence': ['Violent'], 'Gore': ['Gore'],
    },
};
const listeTags = Object.values(GROUPES_TAGS).flatMap(groupe => Object.keys(groupe));
const tagVersTheme = {};
for (const groupe of Object.values(GROUPES_TAGS)) {
    for (const [theme, tagsSteam] of Object.entries(groupe)) for (const t of tagsSteam) tagVersTheme[t] = theme;
}

// Codage compact des listes : un caractère par genre ou thème (62 possibles)
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Ce ne sont pas des jeux (Wallpaper Engine, logiciels de dessin…)
const LOGICIELS = ['Utilities', 'Design & Illustration', 'Animation & Modeling', 'Video Production',
    'Audio Production', 'Photo Editing', 'Software Training', 'Web Publishing', 'Accounting', 'Game Development'];

// Doublons du catalogue Steam (versions régionales ou packs) qui prêtent à confusion avec le vrai jeu
const DOUBLONS = [
    10190, // Call of Duty: Modern Warfare 2 (2009), seconde fiche
    52003, // Portal, seconde fiche
    48173, // Assassin's Creed II, seconde fiche
];

// Lecture CSV caractère par caractère : les descriptions contiennent des virgules,
// des guillemets doublés et des retours à la ligne entre guillemets.
function* lignesCsv(texte) {
    let champ = '', ligne = [], entreGuillemets = false;
    for (let i = 0; i < texte.length; i++) {
        const c = texte[i];
        if (entreGuillemets) {
            if (c === '"') {
                if (texte[i + 1] === '"') { champ += '"'; i++; }
                else entreGuillemets = false;
            } else champ += c;
        } else if (c === '"') entreGuillemets = true;
        else if (c === ',') { ligne.push(champ); champ = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && texte[i + 1] === '\n') i++;
            ligne.push(champ);
            yield ligne;
            ligne = []; champ = '';
        } else champ += c;
    }
    if (champ || ligne.length) { ligne.push(champ); yield ligne; }
}

const lignes = lignesCsv(fs.readFileSync(SOURCE, 'utf8'));

// L'en-tête du dataset fusionne "Discount" et "DLC count" : on le répare
const entete = lignes.next().value.flatMap(c => c === 'DiscountDLC count' ? ['Discount', 'DLC count'] : [c]);
const col = Object.fromEntries(entete.map((nom, i) => [nom, i]));

// Jeux sans avis dans le dataset alors qu'ils en ont sur Steam : vrais chiffres saisis à la main
// (à lire sur la page Steam du jeu). Format : identifiant: { avis: total des avis, note: % d'avis positifs }
const CORRECTIONS = {
    1223750: { avis: 5518, note: 85 },  // Cloud Meadow
    1449850: { avis: 102707, note: 72 }, // Yu-Gi-Oh! Master Duel
    2357570: { avis: 429544, note: 32 },
    3764200: { avis: 109711, note: 95 }, // Resident Evil Requiem
    1030300: { avis: 426230, note: 90 },      // Hollow Knight: Silksong
    2807960: { avis: 376204, note: 63 },      // Battlefield 6
    3527290: { avis: 380967, note: 94 },      // PEAK
    1808500: { avis: 429211, note: 82 },      // ARC Raiders
    2592160: { avis: 185636, note: 97 },      // Dispatch
    2669320: { avis: 107154, note: 53 },      // EA SPORTS FC 25
    3405340: { avis: 107215, note: 94 },      // Megabonk
    3167020: { avis: 104941, note: 84 },      // Escape From Duckov
    1172710: { avis: 80900, note: 72 },       // Dune: Awakening
    3489700: { avis: 95756, note: 93 },       // Stellar Blade
    3949040: { avis: 89813, note: 90 },       // RV There Yet?
    1285190: { avis: 87239, note: 58 },       // Borderlands 4
    3008130: { avis: 73193, note: 86 },       // Dying Light: The Beast
    2277560: { avis: 106936, note: 57 },      // WUCHANG: Fallen Feathers
    3932890: { avis: 68044, note: 50 },       // Escape from Tarkov
    2138720: { avis: 56837, note: 69 },       // REMATCH
    3405690: { avis: 109955, note: 51 },      // EA SPORTS FC 26
    3159330: { avis: 40682, note: 75 },       // Assassin’s Creed Shadows
    1948280: { avis: 30529, note: 96 },       // Stacklands
    1604270: { avis: 36465, note: 54 },       // Broken Arrow
    3180070: { avis: 31622, note: 93 },       // No, I’m not a Human
    3450310: { avis: 29794, note: 67 },       // Europa Universalis V
    1002300: { avis: 23064, note: 94 },       // Fear & Hunger
    3314790: { avis: 26523, note: 90 },       // CloverPit
    1941540: { avis: 31017, note: 73 },       // Mafia: The Old Country
    3350200: { avis: 50543, note: 80 },       // Revenge on gold diggers
    3101040: { avis: 35225, note: 96 },       // Magical Girl Witch Trials
    1034140: { avis: 15813, note: 67 },       // Subverse
    3716600: { avis: 20485, note: 91 },       // Mage Arena
    2062430: { avis: 27718, note: 95 },       // BALL x PIT
    2661300: { avis: 25276, note: 82 },       // Grounded 2
    3551340: { avis: 36551, note: 36 },       // Football Manager 26
    3595270: { avis: 24270, note: 48 },       // Call of Duty: Modern Warfare III
    1430190: { avis: 24015, note: 44 },       // Killing Floor 3
    1154030: { avis: 18505, note: 81 },       // Titan Quest II
    2947440: { avis: 30000, note: 81 },       // SILENT HILL f (≈)
    2352620: { avis: 17670, note: 75 },       // Fellowship
    1984270: { avis: 22886, note: 89 },       // Digimon Story Time Stranger
    2171440: { avis: 15700, note: 97 },       // Fear & Hunger 2: Termina
    2119830: { avis: 26600, note: 84 },       // MISERY (≈)
    1601570: { avis: 20116, note: 90 },       // The Alters
    2444750: { avis: 21407, note: 90 },       // Shape of Dreams
    2429640: { avis: 68963, note: 67 },       // Throne and Liberty
};

// Jeux sans avis : on écarte ce qui n'est pas un jeu complet (démos, playtests, bandes-son, serveurs…)
const PAS_UN_JEU = /\b(playtest|demo|prologue|soundtrack|ost|dedicated server|server|beta|benchmark|sdk)\b|friend'?s pass/i;
const NOTE_NEUTRE = 76;       // note moyenne des jeux, pour ceux dont on ne connaît pas la note
const JOUEURS_PAR_AVIS = 50;  // estimation : environ 1 avis Steam pour 50 joueurs

const jeux = [];
const estimes = [];
for (const l of lignes) {
    if (l.length < entete.length) continue;
    if (!l[col.Name] || !l[col['Header image']]) continue;
    const genresSteam = l[col.Genres] ? l[col.Genres].split(',') : [];
    if (genresSteam.some(g => LOGICIELS.includes(g))) continue;

    const id = Number(l[col.AppID]);
    if (DOUBLONS.includes(id)) continue;
    const annee = (l[col['Release date']].match(/\d{4}/) || [])[0];
    // Joueurs estimés : Steam donne une tranche ("2000000 - 5000000"), on garde son milieu (moyenne géométrique)
    const [min, max] = (l[col['Estimated owners']] || '0 - 0').split(' - ').map(Number);
    let joueurs = Math.round(Math.sqrt(Math.max(min, 1) * Math.max(max, 1)));
    const metacritic = Number(l[col['Metacritic score']]) || null;

    const positifs = Number(l[col.Positive]) || 0;
    const negatifs = Number(l[col.Negative]) || 0;
    let avis = positifs + negatifs;
    let note = avis ? Math.round((positifs / avis) * 100) : null;
    let estime = false;
    if (CORRECTIONS[id]) {
        ({ avis, note } = CORRECTIONS[id]);
        // La tranche de joueurs du dataset date d'avant la correction : on l'estime à partir des vrais avis
        joueurs = Math.max(joueurs, avis * JOUEURS_PAR_AVIS);
    } else if (!avis) {
        // Pas d'avis : on estime à partir des autres colonnes, sinon valeurs neutres
        if (PAS_UN_JEU.test(l[col.Name])) continue;
        estime = true;
        const recommandations = Number(l[col.Recommendations]) || 0;
        avis = recommandations || (max > 20000 ? Math.round(joueurs / JOUEURS_PAR_AVIS) : 0);
        note = metacritic ?? NOTE_NEUTRE;
    }
    // L'image vaut presque toujours .../apps/<id>/header.jpg : on ne stocke que les exceptions
    const image = l[col['Header image']].split('?')[0].split(`/apps/${id}/`)[1];
    const jeu = {
        id,
        nom: l[col.Name].trim(),
        annee: annee ? Number(annee) : null,
        avis,
        note,
        metacritic,
        joueurs,
        genres: genresSteam.map(g => GENRES[g]).filter(Boolean),
        // Tags des joueurs + genres officiels "Violent", "Nudity"… ; rangés dans l'ordre de listeTags
        tags: [...new Set([...(l[col.Tags] ? l[col.Tags].split(',') : []), ...genresSteam]
            .map(t => tagVersTheme[t]).filter(Boolean))]
            .sort((a, b) => listeTags.indexOf(a) - listeTags.indexOf(b)),
    };
    if (image && image !== 'header.jpg') jeu.image = image;
    if (estime) estimes.push(id);
    jeux.push(jeu);
}

// DLC et modules (multijoueur, season pass, packs…) : Steam leur donne le nom du jeu de base.
// Parmi les fiches de même nom sorties la même année, on ne garde que la plus commentée : le jeu lui-même.
const cleNom = j => `${j.nom.toLowerCase().replace(/[®™]/g, '').replace(/\s+/g, ' ').trim()}|${j.annee}`;
const principales = new Map();
for (const j of jeux) {
    const autre = principales.get(cleNom(j));
    if (!autre || j.avis > autre.avis || (j.avis === autre.avis && j.id < autre.id)) principales.set(cleNom(j), j);
}
const dlc = jeux.length - principales.size;

// On garde les jeux les plus commentés, du plus populaire au moins populaire
const garde = [...principales.values()].sort((a, b) => b.avis - a.avis).slice(0, NOMBRE);
const ids = new Set(garde.map(j => j.id));

// Format compact pour alléger le fichier : un tableau par jeu au lieu d'un objet,
// et genres / thèmes codés par un caractère chacun (position dans ALPHABET).
// [id, nom, année, avis, note, metacritic, joueurs estimés, "codes genres", "codes thèmes", image (seulement si spéciale)]
const listeGenres = Object.values(GENRES);
const coder = (valeurs, liste) => valeurs.map(v => ALPHABET[liste.indexOf(v)]).join('');
if (listeGenres.length > ALPHABET.length || listeTags.length > ALPHABET.length) throw new Error('trop de genres ou de thèmes');
const compact = {
    genres: listeGenres,
    tags: listeTags,
    groupesTags: Object.fromEntries(Object.entries(GROUPES_TAGS).map(([nom, groupe]) => [nom, Object.keys(groupe)])),
    jeux: garde.map(j => {
        const ligne = [j.id, j.nom, j.annee, j.avis, j.note, j.metacritic, j.joueurs, coder(j.genres, listeGenres), coder(j.tags, listeTags)];
        if (j.image) ligne.push(j.image);
        return ligne;
    }),
    // Jeux sans avis dans le dataset : avis et note estimés (affiché sur leur fiche)
    estimes: estimes.filter(id => ids.has(id)),
};

fs.mkdirSync(path.dirname(CIBLE), { recursive: true });
fs.writeFileSync(CIBLE, JSON.stringify(compact));

const rang = n => garde[Math.min(n, garde.length) - 1]?.avis;
console.log(`${jeux.length} fiches, ${dlc} DLC écartés (même nom que leur jeu), ${garde.length} gardés dont ${compact.estimes.length} aux avis estimés → ${path.relative(RACINE, CIBLE)} (${Math.round(fs.statSync(CIBLE).size / 1024)} Ko)`);
console.log('Nombre d’avis au rang :', [20, 100, 400, 1500, 4000, garde.length].map(n => `${n} → ${rang(n)}`).join(' · '));
