// Convertit games.csv (dataset Steam de Kaggle) en data/jeux.json, léger et prêt pour le jeu.
// Usage : node outils/convertir-csv.js [nombre de jeux, 10000 par défaut]
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const SOURCE = path.join(RACINE, 'games.csv');
const CIBLE = path.join(RACINE, 'data', 'jeux.json');
const NOMBRE = Number(process.argv[2]) || 15000;

// Genres Steam traduits ; ceux absents de la liste (Free To Play, Early Access…) sont ignorés
const GENRES = {
    'Action': 'Action', 'Adventure': 'Aventure', 'Casual': 'Casual', 'Indie': 'Indé',
    'RPG': 'RPG', 'Simulation': 'Simulation', 'Strategy': 'Stratégie',
    'Massively Multiplayer': 'MMO', 'Racing': 'Course', 'Sports': 'Sport',
};

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
        genres: genresSteam.map(g => GENRES[g]).filter(Boolean).slice(0, 3),
    };
    if (image && image !== 'header.jpg') jeu.image = image;
    jeux.push(jeu);
}

// On garde les jeux les plus commentés, du plus populaire au moins populaire
jeux.sort((a, b) => b.avis - a.avis);
const garde = jeux.slice(0, NOMBRE);

fs.mkdirSync(path.dirname(CIBLE), { recursive: true });
fs.writeFileSync(CIBLE, JSON.stringify(garde));

const rang = n => garde[Math.min(n, garde.length) - 1]?.avis;
console.log(`${jeux.length} jeux avec avis, ${garde.length} gardés → ${path.relative(RACINE, CIBLE)} (${Math.round(fs.statSync(CIBLE).size / 1024)} Ko)`);
console.log('Nombre d’avis au rang :', [20, 100, 400, 1500, 4000, garde.length].map(n => `${n} → ${rang(n)}`).join(' · '));
