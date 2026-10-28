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

const jeux = [];
for (const l of lignes) {
    if (l.length < entete.length) continue;
    const positifs = Number(l[col.Positive]) || 0;
    const negatifs = Number(l[col.Negative]) || 0;
    const avis = positifs + negatifs;
    if (!avis || !l[col.Name] || !l[col['Header image']]) continue;
    const genresSteam = l[col.Genres] ? l[col.Genres].split(',') : [];
    if (genresSteam.some(g => LOGICIELS.includes(g))) continue;

    const id = Number(l[col.AppID]);
    const annee = (l[col['Release date']].match(/\d{4}/) || [])[0];
    // L'image vaut presque toujours .../apps/<id>/header.jpg : on ne stocke que les exceptions
    const image = l[col['Header image']].split('?')[0].split(`/apps/${id}/`)[1];
    const jeu = {
        id,
        nom: l[col.Name].trim(),
        annee: annee ? Number(annee) : null,
        avis,
        note: Math.round((positifs / avis) * 100),
        metacritic: Number(l[col['Metacritic score']]) || null,
        genres: genresSteam.map(g => GENRES[g]).filter(Boolean),
        // Tags des joueurs + genres officiels "Violent", "Nudity"… ; rangés dans l'ordre de listeTags
        tags: [...new Set([...(l[col.Tags] ? l[col.Tags].split(',') : []), ...genresSteam]
            .map(t => tagVersTheme[t]).filter(Boolean))]
            .sort((a, b) => listeTags.indexOf(a) - listeTags.indexOf(b)),
    };
    if (image && image !== 'header.jpg') jeu.image = image;
    jeux.push(jeu);
}

// On garde les jeux les plus commentés, du plus populaire au moins populaire
jeux.sort((a, b) => b.avis - a.avis);
const garde = jeux.slice(0, NOMBRE);

// Format compact pour alléger le fichier : un tableau par jeu au lieu d'un objet,
// et genres / thèmes codés par un caractère chacun (position dans ALPHABET).
// [id, nom, année, avis, note, metacritic, "codes genres", "codes thèmes", image (seulement si spéciale)]
const listeGenres = Object.values(GENRES);
const coder = (valeurs, liste) => valeurs.map(v => ALPHABET[liste.indexOf(v)]).join('');
if (listeGenres.length > ALPHABET.length || listeTags.length > ALPHABET.length) throw new Error('trop de genres ou de thèmes');
const compact = {
    genres: listeGenres,
    tags: listeTags,
    groupesTags: Object.fromEntries(Object.entries(GROUPES_TAGS).map(([nom, groupe]) => [nom, Object.keys(groupe)])),
    jeux: garde.map(j => {
        const ligne = [j.id, j.nom, j.annee, j.avis, j.note, j.metacritic, coder(j.genres, listeGenres), coder(j.tags, listeTags)];
        if (j.image) ligne.push(j.image);
        return ligne;
    }),
};

fs.mkdirSync(path.dirname(CIBLE), { recursive: true });
fs.writeFileSync(CIBLE, JSON.stringify(compact));

const rang = n => garde[Math.min(n, garde.length) - 1]?.avis;
console.log(`${jeux.length} jeux avec avis, ${garde.length} gardés → ${path.relative(RACINE, CIBLE)} (${Math.round(fs.statSync(CIBLE).size / 1024)} Ko)`);
console.log('Nombre d’avis au rang :', [20, 100, 400, 1500, 4000, garde.length].map(n => `${n} → ${rang(n)}`).join(' · '));
