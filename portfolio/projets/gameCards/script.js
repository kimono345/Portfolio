'use strict';

/* =========================================================
   GameCards — chaque carte est un vrai jeu vidéo (données Steam)
   ========================================================= */

// ---------- Règles du jeu (valeurs de départ, à équilibrer) ----------

// Du plus rare au plus commun. `seuil` porte sur le nombre d'avis Steam.
// Chaque carte tire d'abord sa rareté selon une colonne de chances (en %), puis un jeu au hasard dans cette rareté :
//   `chance`          : les 4 premières cartes d'un booster
//   `chanceGarantie`  : la 5ᵉ carte, garantie Peu commune ou mieux, avec sa propre table pour ne pas
//                       servir de raccourci vers les hautes raretés
//   `chanceDuel`      : les cartes tirées en duel (toi et l'ordinateur)
// `prix` : achat direct dans le catalogue, volontairement bien plus cher que la chance en boosters.
const RARETES = [
    { id: 'mythique',    nom: 'Mythique',    seuil: 750000, chance: 0.1,  chanceGarantie: 0.1, chanceDuel: 3,  revente: 300, prix: 10000 },
    { id: 'legendaire',  nom: 'Légendaire',  seuil: 200000, chance: 0.5,  chanceGarantie: 0.9, chanceDuel: 7,  revente: 100, prix: 4000 },
    { id: 'epique',      nom: 'Épique',      seuil: 60000,  chance: 3,    chanceGarantie: 19,  chanceDuel: 12, revente: 40,  prix: 1500 },
    { id: 'rare',        nom: 'Rare',        seuil: 12000,  chance: 6,    chanceGarantie: 30,   chanceDuel: 18, revente: 15,  prix: 600 },
    { id: 'peu-commune', nom: 'Peu commune', seuil: 3000,   chance: 18,   chanceGarantie: 50,   chanceDuel: 25, revente: 5,   prix: 250 },
    { id: 'commune',     nom: 'Commune',     seuil: 0,      chance: 72.4, chanceGarantie: 0,    chanceDuel: 35, revente: 2,   prix: 100 },
];
// Booster Prestige : ses propres chances, dans l'ordre de RARETES
// (4 premières cartes, puis 5ᵉ carte garantie Rare ou mieux)
[[0.5, 1], [3, 6], [10, 23], [25, 70], [30, 0], [31.5, 0]].forEach(([chance, garantie], i) => {
    RARETES[i].chancePrestige = chance;
    RARETES[i].chancePrestigeGarantie = garantie;
});
const CHANCE_HOLO_PRESTIGE = 0.08; // contre 2 % dans un booster normal

// Boosters spéciaux : le Prestige (meilleures chances) et des thématiques (seulement les jeux d'un genre ou d'un thème).
// `fond`, `texte` et `ombre` habillent le paquet. Les jeux de chaque thème sont rangés par rareté au chargement.
const BOOSTERS_SPECIAUX = [
    { id: 'prestige', nom: 'Prestige', prix: 250, prestige: true, description: 'Rare ou mieux garantie, 4× plus de holos',
      fond: 'linear-gradient(160deg, #15100a 0%, #3a2a10 50%, #b8862b 100%)', texte: '#f6dc8a', ombre: 'rgba(230, 170, 50, 0.5)' },
    { id: 'rpg', nom: 'RPG', prix: 60, description: 'Que des jeux de rôle', filtre: j => j.genres.includes('RPG'),
      fond: 'linear-gradient(160deg, #2b1f6b, #6a3cff 55%, #c58bff)', texte: '#fff', ombre: 'rgba(106, 60, 255, 0.45)' },
    { id: 'horreur', nom: 'Horreur', prix: 60, description: 'Frissons garantis', filtre: j => j.tags.includes('Horreur'),
      fond: 'linear-gradient(160deg, #0d1410, #2a3d26 55%, #7a1f1f)', texte: '#e8f0e0', ombre: 'rgba(122, 31, 31, 0.5)' },
    { id: 'course-sport', nom: 'Course & Sport', prix: 60, description: 'Vitesse et compétition',
      filtre: j => j.genres.includes('Course') || j.genres.includes('Sport'),
      fond: 'linear-gradient(160deg, #0a4fa8, #1fb5ff 55%, #ffd23f)', texte: '#fff', ombre: 'rgba(31, 181, 255, 0.45)' },
    { id: 'anime', nom: 'Anime', prix: 60, description: 'Style japonais', filtre: j => j.tags.includes('Anime'),
      fond: 'linear-gradient(160deg, #ff5fa2, #ffb3d9 55%, #9ad8ff)', texte: '#3a1030', ombre: 'rgba(255, 95, 162, 0.45)' },
    { id: 'inde', nom: 'Indé', prix: 60, description: 'Les pépites indépendantes', filtre: j => j.genres.includes('Indé'),
      fond: 'linear-gradient(160deg, #136e52, #3fbf6f 55%, #d6f56b)', texte: '#0d2a1c', ombre: 'rgba(63, 191, 111, 0.45)' },
    { id: 'multijoueur', nom: 'Multijoueur', prix: 60, description: 'À plusieurs, c’est mieux',
      filtre: j => j.tags.includes('Multijoueur') || j.tags.includes('Coopération'),
      fond: 'linear-gradient(160deg, #b8400c, #ff8a3d 55%, #ffd23f)', texte: '#2a1200', ombre: 'rgba(255, 138, 61, 0.45)' },
    { id: 'sf', nom: 'Science-fiction', prix: 60, description: 'Espace et futur', filtre: j => j.tags.includes('Science-fiction'),
      fond: 'linear-gradient(160deg, #081530, #1f4fd1 55%, #45d4ff)', texte: '#e6f6ff', ombre: 'rgba(69, 212, 255, 0.45)' },
    { id: 'adulte', nom: 'Adulte 18+', prix: 60, description: 'Contenu à caractère sexuel',
      filtre: j => j.tags.includes('Contenu sexuel') || j.tags.includes('Nudité'),
      fond: 'linear-gradient(160deg, #1a0610, #6e0f2c 55%, #e0245e)', texte: '#ffe3ec', ombre: 'rgba(224, 36, 94, 0.45)' },
];

const INDEX_RARE = RARETES.findIndex(r => r.id === 'rare');
const INDEX_EPIQUE = RARETES.findIndex(r => r.id === 'epique');
const INDEX_LEGENDAIRE = RARETES.findIndex(r => r.id === 'legendaire');
const INDEX_MYTHIQUE = RARETES.findIndex(r => r.id === 'mythique');

// God pack : un booster sur 2 000 ne contient que des Légendaires et Mythiques, souvent holo
const CHANCE_GOD_PACK = 1 / 2000;
const CHANCE_HOLO_GOD_PACK = 0.25; // contre 2 % (CHANCE_HOLO) dans un booster normal
const PART_MYTHIQUE_GOD_PACK = 0.25; // en plus de la Mythique garantie

const CARTES_PAR_BOOSTER = 5;
const BOOSTERS_PAR_LOT = 10; // ouverture ×10
const PRIX_BOOSTER = 0;
const DELAI_BOOSTER = 10 * 60 * 1000;
const CHANCE_HOLO = 0.02;
const MULTIPLICATEUR_HOLO = 3;
const SEUIL_CHEF_OEUVRE = 90;

// Jeux de l'année : le dataset Steam ne le dit pas, la liste est faite à la main (identifiant Steam → année, cérémonie).
// The Game Awards depuis 2014, Spike Video Game Awards avant. Les rééditions d'un même jeu sur Steam comptent aussi.
// Lauréats absents de Steam : Madden NFL 2004 (2003), Uncharted 2 (2009), Overwatch (2016), Zelda BOTW (2017), Astro Bot (2024).
const VGA = 'Spike Video Game Awards';
const TGA = 'The Game Awards';
const GOTY = {
    1547000: [2004, VGA],                                   // GTA San Andreas (Definitive Edition)
    254700: [2005, VGA],                                    // Resident Evil 4 (2005)
    22330: [2006, VGA], 900883: [2006, VGA], 2623190: [2006, VGA], // Oblivion (éditions GOTY, Remastered)
    7670: [2007, VGA],                                      // BioShock
    12210: [2008, VGA],                                     // GTA IV
    2668510: [2010, VGA],                                   // Red Dead Redemption
    72850: [2011, VGA], 489830: [2011, VGA], 611670: [2011, VGA], // Skyrim (original, Special Edition, VR)
    207610: [2012, VGA],                                    // The Walking Dead
    271590: [2013, VGA], 3240220: [2013, VGA],              // GTA V (Legacy, Enhanced)
    1222690: [2014, TGA],                                   // Dragon Age: Inquisition
    292030: [2015, TGA],                                    // The Witcher 3
    1593500: [2018, TGA],                                   // God of War
    814380: [2019, TGA],                                    // Sekiro
    2531310: [2020, TGA],                                   // The Last of Us Part II
    1426210: [2021, TGA],                                   // It Takes Two
    1245620: [2022, TGA],                                   // Elden Ring
    1086940: [2023, TGA],                                   // Baldur's Gate 3
    1903340: [2025, TGA],                                   // Clair Obscur: Expedition 33
};
const gotyDe = id => GOTY[id] && { annee: GOTY[id][0], ceremonie: GOTY[id][1] };
const MANCHES_GAGNANTES = 3;
const GAIN_DUEL = 30;
const CARTES_PAR_PAGE = 60; // collection affichée par tranches
const URL_IMAGES = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';

// Icônes Bootstrap Icons (licence MIT) en SVG : rendu identique sur tous les appareils, contrairement aux emoji
const ICONES = {
    pouce: '<svg class="bi" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.956 1.745C7.021.81 7.908.087 8.864.325l.261.066c.463.116.874.456 1.012.965.22.816.533 2.511.062 4.51a10 10 0 0 1 .443-.051c.713-.065 1.669-.072 2.516.21.518.173.994.681 1.2 1.273.184.532.16 1.162-.234 1.733q.086.18.138.363c.077.27.113.567.113.856s-.036.586-.113.856c-.039.135-.09.273-.16.404.169.387.107.819-.003 1.148a3.2 3.2 0 0 1-.488.901c.054.152.076.312.076.465 0 .305-.089.625-.253.912C13.1 15.522 12.437 16 11.5 16H8c-.605 0-1.07-.081-1.466-.218a4.8 4.8 0 0 1-.97-.484l-.048-.03c-.504-.307-.999-.609-2.068-.722C2.682 14.464 2 13.846 2 13V9c0-.85.685-1.432 1.357-1.615.849-.232 1.574-.787 2.132-1.41.56-.627.914-1.28 1.039-1.639.199-.575.356-1.539.428-2.59z"/></svg>',
    medaille: '<svg class="bi" viewBox="0 0 16 16" aria-hidden="true"><path d="m8 0 1.669.864 1.858.282.842 1.68 1.337 1.32L13.4 6l.306 1.854-1.337 1.32-.842 1.68-1.858.282L8 12l-1.669-.864-1.858-.282-.842-1.68-1.337-1.32L2.6 6l-.306-1.854 1.337-1.32.842-1.68L6.331.864z"/><path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1z"/></svg>',
    sablier: '<svg class="bi" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 15a.5.5 0 1 1 0-1h1v-1a4.5 4.5 0 0 1 2.557-4.06c.29-.139.443-.377.443-.59v-.7c0-.213-.154-.451-.443-.59A4.5 4.5 0 0 1 3.5 3V2h-1a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1h-1v1a4.5 4.5 0 0 1-2.557 4.06c-.29.139-.443.377-.443.59v.7c0 .213.154.451.443.59A4.5 4.5 0 0 1 12.5 13v1h1a.5.5 0 0 1 0 1zm2-13v1c0 .537.12 1.045.337 1.5h6.326c.216-.455.337-.963.337-1.5V2zm3 6.35c0 .701-.478 1.236-1.011 1.492A3.5 3.5 0 0 0 4.5 13s.866-1.299 3-1.48zm1 0v3.17c2.134.181 3 1.48 3 1.48a3.5 3.5 0 0 0-1.989-3.158C8.978 9.586 8.5 9.052 8.5 8.351z"/></svg>',
};

// Couronne de laurier dorée : deux branches qui se croisent en bas, des paires de feuilles en amande
// le long d'une courbe de Bézier. Le dégradé doré (#degrade-laurier) est défini une fois dans index.html.
function laurierSVG() {
    // Tige de la branche gauche : part du bas, à droite du centre, remonte le long du bord gauche
    const [p0, p1, p2, p3] = [[62, 92], [14, 84], [2, 44], [33, 11]];
    const bezier = t => [0, 1].map(k => (1 - t) ** 3 * p0[k] + 3 * (1 - t) ** 2 * t * p1[k] + 3 * (1 - t) * t ** 2 * p2[k] + t ** 3 * p3[k]);
    const tangente = t => {
        const d = [0, 1].map(k => 3 * (1 - t) ** 2 * (p1[k] - p0[k]) + 6 * (1 - t) * t * (p2[k] - p1[k]) + 3 * t ** 2 * (p3[k] - p2[k]));
        const n = Math.hypot(...d);
        return [d[0] / n, d[1] / n];
    };
    // Feuille en amande, base en (0, 0), pointe vers le haut, puis tournée dans la direction voulue
    const feuille = ([x, y], [dx, dy], longueur) => {
        const l = longueur, w = longueur * 0.24;
        const rotation = Math.atan2(dx, -dy) * 180 / Math.PI;
        return `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(0)})" d="M0 0C${w.toFixed(1)} ${(-l * 0.28).toFixed(1)} ${(w * 0.85).toFixed(1)} ${(-l * 0.75).toFixed(1)} 0 ${-l}C${(-w * 0.85).toFixed(1)} ${(-l * 0.75).toFixed(1)} ${(-w).toFixed(1)} ${(-l * 0.28).toFixed(1)} 0 0Z"/>`;
    };
    const inclinaison = 38 * Math.PI / 180;
    let feuilles = '';
    for (let i = 0; i < 10; i++) {
        const t = 0.13 + i * 0.085;
        const point = bezier(t);
        const [ux, uy] = tangente(t);
        const [nx, ny] = [uy, -ux]; // normale vers l'extérieur de la couronne
        const longueur = 13 - i * 0.35;
        const vers = signe => [ux * Math.cos(inclinaison) + signe * nx * Math.sin(inclinaison), uy * Math.cos(inclinaison) + signe * ny * Math.sin(inclinaison)];
        feuilles += feuille(point, vers(1), longueur) + feuille(point, vers(-1), longueur * 0.85);
    }
    feuilles += feuille(bezier(1), tangente(1), 10); // feuille au bout de la branche
    const tige = `<path d="M${p0.join(' ')}C${p1.join(' ')} ${p2.join(' ')} ${p3.join(' ')}" fill="none" stroke="url(#degrade-laurier)" stroke-width="1.8" stroke-linecap="round"/>`;
    const branche = tige + feuilles;
    return `<svg class="laurier" viewBox="0 0 100 100" aria-hidden="true">${branche}<g transform="translate(100 0) scale(-1 1)">${branche}</g></svg>`;
}
const LAURIER = laurierSVG();

function brinLaurierSVG() {
    let feuilles = '';
    [[5, 1], [9, -1], [13, 1], [17, -1]].forEach(([x, cote]) => {
        feuilles += `<ellipse cx="${x}" cy="${6 - cote * 2.4}" rx="2.6" ry="1.2" transform="rotate(${-cote * 32} ${x} ${6 - cote * 2.4})"/>`;
    });
    return `<svg class="brin" viewBox="0 0 24 12" aria-hidden="true" fill="currentColor">
        <path d="M22 6 Q12 5.2 2 6" fill="none" stroke="currentColor" stroke-width="0.9"/>${feuilles}
        <ellipse cx="2.4" cy="6" rx="2.4" ry="1.1"/></svg>`;
}
const BRIN_LAURIER = brinLaurierSVG();

const STATS = {
    attaque:    { nom: 'Note public',     icone: ICONES.pouce },
    anciennete: { nom: 'Ancienneté',      icone: ICONES.sablier },
    popularite: { nom: 'Popularité',      icone: '★' },
};

// ---------- Utilitaires ----------

const $ = sel => document.querySelector(sel);
const attendre = ms => new Promise(r => setTimeout(r, ms));
const auHasard = liste => liste[Math.floor(Math.random() * liste.length)];
const indexRarete = id => RARETES.findIndex(r => r.id === id);
const rareteDe = avis => RARETES.find(r => (avis || 0) >= r.seuil);
const nombre = n => n.toLocaleString('fr-FR');
const PIECE = '<span class="piece" aria-hidden="true"></span>';

function echapper(texte) {
    return String(texte ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatDuree(ms) {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    $('#toasts').append(el);
    setTimeout(() => el.classList.add('sortie'), 3200);
    setTimeout(() => el.remove(), 3600);
}

// ---------- Sauvegarde (localStorage) ----------

// Préfixe "gameCards." : en local, tous les projets partagent la même origine
const CLES = {
    collection: 'gameCards.collection',
    pieces: 'gameCards.pieces',
    dernierBooster: 'gameCards.dernierBooster',
    godPacks: 'gameCards.godPacks',
};

function lire(cle, defaut) {
    try {
        const valeur = localStorage.getItem(cle);
        return valeur === null ? defaut : JSON.parse(valeur);
    } catch {
        return defaut;
    }
}

function ecrire(cle, valeur) {
    try {
        localStorage.setItem(cle, JSON.stringify(valeur));
    } catch (e) {
        console.warn('Sauvegarde impossible', e);
    }
}

const etat = {
    collection: lire(CLES.collection, {}),       // { id: carte + exemplaires, holos, obtenue }
    pieces: lire(CLES.pieces, 0),
    dernierBooster: lire(CLES.dernierBooster, 0),
    godPacks: lire(CLES.godPacks, { nombre: 0, premier: null }), // trophée : combien, et la date du premier
};

// Tous les jeux de data/jeux.json (chargés au démarrage), et les mêmes rangés par rareté
let tousLesJeux = [];
let jeuxParId = new Map();
let genresCatalogue = [];
let groupesTags = {};       // { "Gameplay": ["Réflexion", …], …, "Contenu sensible": […] }
const ALPHABET_CODES = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const jeuxParRarete = {};

function sauvegarder() {
    for (const [nom, cle] of Object.entries(CLES)) ecrire(cle, etat[nom]);
}

// ---------- Cartes ----------

// Popularité sur une échelle logarithmique : 1 avis → 0, 1 000 → 50, 1 million → 100
const popularite = avis => Math.max(0, Math.min(100, Math.round(Math.log10(Math.max(1, avis)) * 100 / 6)));

// Note public lissée : on fait comme si chaque jeu avait déjà 10 avis à la note moyenne (76 %).
// 1 avis à 100 % donne 78, mais 10 000 avis à 95 % gardent 95.
const NOTE_MOYENNE = 76;
const POIDS_MOYENNE = 10;
const notePublic = (note, avis) => Math.round((note * avis + NOTE_MOYENNE * POIDS_MOYENNE) / (avis + POIDS_MOYENNE));

// Ancienneté : moitié selon l'âge (année la plus ancienne → 100, la plus récente → 0),
// moitié selon le rang (plus ancien que X % du catalogue). Le rang seul tasserait tous les jeux
// d'avant 2012 vers 100, l'âge seul tasserait les jeux récents vers 0.
let ancienneteParAnnee = {};

function calculerAnciennete() {
    const parAnnee = {};
    for (const jeu of tousLesJeux) if (jeu.annee) parAnnee[jeu.annee] = (parAnnee[jeu.annee] || 0) + 1;
    const annees = Object.keys(parAnnee).map(Number).sort((a, b) => a - b);
    const total = annees.reduce((n, a) => n + parAnnee[a], 0);
    const [plusAncienne, plusRecente] = [annees[0], annees.at(-1)];
    let plusRecents = total;
    ancienneteParAnnee = {};
    for (const annee of annees) {
        plusRecents -= parAnnee[annee];
        const rang = plusRecents / total;
        const age = (plusRecente - annee) / (plusRecente - plusAncienne || 1);
        ancienneteParAnnee[annee] = Math.round((rang + age) * 50);
    }
}

const anciennete = annee => ancienneteParAnnee[annee] ?? 0;

function creerCarte(jeu) {
    return {
        id: jeu.id,
        nom: jeu.nom,
        image: `${URL_IMAGES}/${jeu.id}/${jeu.image || 'header.jpg'}`,
        attaque: notePublic(jeu.note, jeu.avis),
        anciennete: anciennete(jeu.annee),
        popularite: popularite(jeu.avis),
        metacritic: jeu.metacritic,
        rarete: rareteDe(jeu.avis).id,
        annee: jeu.annee,
        genres: jeu.genres,
        tags: jeu.tags,
    };
}

// `cachee` masque les stats, et ce qui les trahirait (année, chef-d'œuvre) : carte adverse en duel
function carteHTML(carte, { holo = false, compteur = 0, cachee = false } = {}) {
    const rarete = RARETES[indexRarete(carte.rarete)];
    // Sur la carte adverse du duel, l'année trahirait l'Ancienneté : on la cache aussi
    const infos = [cachee ? null : carte.annee, carte.genres[0]].filter(Boolean).join(' · ');
    const chef = !cachee && carte.metacritic >= SEUIL_CHEF_OEUVRE;
    const goty = gotyDe(carte.id);
    return `
        <article class="carte rarete-${rarete.id}${holo ? ' holo' : ''}${cachee ? ' stats-cachees' : ''}${chef ? ' chef-oeuvre' : ''}${goty ? ' goty' : ''}">
            <div class="carte-corps">
                ${goty ? `<span class="ruban-goty" title="Jeu de l’année ${goty.annee} · ${goty.ceremonie}"><span>${BRIN_LAURIER}GOTY ${goty.annee}${BRIN_LAURIER}</span></span>` : ''}
                ${goty ? `<span class="filigrane-goty" aria-hidden="true">${LAURIER}</span>` : ''}
                <header class="carte-haut">
                    <span class="carte-rarete">${rarete.nom}${holo ? ' · Holo' : ''}</span>
                    ${compteur > 1 ? `<span class="carte-compteur">×${compteur}</span>` : ''}
                </header>
                <div class="carte-image">
                    ${carte.image ? `<img src="${echapper(carte.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
                    ${chef ? `<span class="plaque-chef" title="Metacritic : ${carte.metacritic} / 100">${ICONES.medaille}<span>Chef-d’œuvre</span></span>` : ''}
                </div>
                <h3 class="carte-nom">${echapper(carte.nom)}</h3>
                <p class="carte-infos">${echapper(infos) || '&nbsp;'}</p>
                <ul class="carte-stats">
                    ${Object.entries(STATS).map(([cle, stat]) => `
                        <li data-stat="${cle}">
                            <span>${stat.icone} ${stat.nom}</span><b>${cachee ? '?' : carte[cle]}</b>
                            <i style="--v:${cachee ? 0 : Math.min(100, carte[cle])}%"></i>
                        </li>`).join('')}
                </ul>
            </div>
        </article>`;
}

// Carte retournable (dos / face), pour les boosters et le duel
function flipHTML(carte, { holo = false, retournee = false, nouvelle = false, cachee = false, godPack = false } = {}) {
    return `
        <div class="flip${retournee ? ' retournee' : ''}${godPack ? ' dos-divin' : ''}" data-rarete="${carte.rarete}" data-id="${carte.id}">
            <div class="flip-inner">
                <div class="flip-face">
                    ${carteHTML(carte, { holo, cachee })}
                    ${nouvelle ? '<span class="badge-nouvelle">Nouvelle !</span>' : ''}
                </div>
                <div class="flip-dos" aria-hidden="true"><span>GC</span></div>
            </div>
        </div>`;
}

// Pastilles de rareté (progression de l'accueil et filtre de la collection)
function pucesRaretesHTML({ boutons = false, actif = '', totaux = !boutons } = {}) {
    const entrees = Object.values(etat.collection);
    const puce = (id, nom, possedees, total) => {
        const contenu = `<i></i>${nom} <b>${nombre(possedees)}${total ? ` / ${nombre(total)}` : ''}</b>`;
        const classe = `puce${id ? ` rarete-${id}` : ''}${boutons && actif === id ? ' active' : ''}`;
        return boutons
            ? `<button class="${classe}" data-rarete="${id}" aria-pressed="${actif === id}">${contenu}</button>`
            : `<span class="${classe}">${contenu}</span>`;
    };
    return (boutons ? puce('', 'Toutes', entrees.length, totaux ? totalJeux() : 0) : '')
        + RARETES.map(r => puce(r.id, r.nom,
            entrees.filter(e => e.rarete === r.id).length,
            totaux ? jeuxParRarete[r.id]?.length || 0 : 0)).join('');
}

// Options du filtre genre / thème, groupées. `presents` (Set) ne garde que les valeurs rencontrées.
function optionsGenresHTML(choisi, presents = null) {
    const groupe = (titre, liste) => {
        const valeurs = liste.filter(v => !presents || presents.has(v));
        return valeurs.length
            ? `<optgroup label="${titre}">${valeurs.map(v =>
                `<option value="${echapper(v)}"${v === choisi ? ' selected' : ''}>${echapper(v)}</option>`).join('')}</optgroup>`
            : '';
    };
    return '<option value="">Tous les genres et thèmes</option>'
        + groupe('Distinctions', Object.keys(DISTINCTIONS))
        + groupe('Genres', genresCatalogue)
        + Object.entries(groupesTags).map(([titre, liste]) => groupe(titre, liste)).join('');
}

// Distinctions : valeurs spéciales du filtre, calculées plutôt que stockées
const DISTINCTIONS = {
    'GOTY (jeu de l’année)': carte => Boolean(GOTY[carte.id]),
    'Chef-d’œuvre (Metacritic 90+)': carte => carte.metacritic >= SEUIL_CHEF_OEUVRE,
};
const distinctionsDe = carte => Object.keys(DISTINCTIONS).filter(nom => DISTINCTIONS[nom](carte));

const aLeGenre = (carte, valeur) => DISTINCTIONS[valeur]
    ? DISTINCTIONS[valeur](carte)
    : carte.genres.includes(valeur) || (carte.tags || []).includes(valeur);

// ---------- Données ----------

async function chargerJeux() {
    const reponse = await fetch('data/jeux.json?v=3');
    if (!reponse.ok) throw new Error(`data/jeux.json introuvable (${reponse.status})`);
    // Format compact (voir outils/convertir-csv.js) : un tableau par jeu, genres et thèmes codés en caractères
    const { genres, tags, jeux, groupesTags: groupes } = await reponse.json();
    const decoder = (codes, liste) => [...codes].map(c => liste[ALPHABET_CODES.indexOf(c)]);
    for (const r of RARETES) jeuxParRarete[r.id] = [];
    tousLesJeux = jeux.map(([id, nom, annee, avis, note, metacritic, codesGenres, codesTags, image]) =>
        ({ id, nom, annee, avis, note, metacritic, genres: decoder(codesGenres, genres), tags: decoder(codesTags, tags), image }));
    groupesTags = groupes;
    for (const jeu of tousLesJeux) jeuxParRarete[rareteDe(jeu.avis).id].push(jeu);
    jeuxParId = new Map(tousLesJeux.map(jeu => [jeu.id, jeu]));
    calculerAnciennete();
    genresCatalogue = genres;
    for (const booster of BOOSTERS_SPECIAUX) {
        booster.bacs = booster.filtre
            ? Object.fromEntries(RARETES.map(r => [r.id, jeuxParRarete[r.id].filter(booster.filtre)]))
            : jeuxParRarete;
        booster.total = Object.values(booster.bacs).reduce((n, liste) => n + liste.length, 0);
    }
    majCollectionDepuisDonnees();
}

// Les cartes déjà obtenues gardent une copie de leurs stats : on les recalcule
// pour qu'elles suivent les règles actuelles (exemplaires, holos et date sont conservés)
function majCollectionDepuisDonnees() {
    for (const entree of Object.values(etat.collection)) {
        const jeu = jeuxParId.get(entree.id);
        if (!jeu) continue;
        Object.assign(entree, creerCarte(jeu));
        delete entree.defense; // ancienne stat Note Metacritic
    }
    sauvegarder();
}

const donneesPretes = () => tousLesJeux.length > 0;
const totalJeux = () => tousLesJeux.length;

// Tire un index de rareté (dans RARETES) selon la colonne de chances `cle` ;
// `possibles` limite le tirage à certaines raretés, leurs chances sont alors réparties entre elles
function tirerRarete(cle = 'chance', possibles = RARETES) {
    let t = Math.random() * possibles.reduce((s, r) => s + r[cle], 0);
    for (const rarete of possibles) {
        t -= rarete[cle];
        if (t < 0) return indexRarete(rarete.id);
    }
    return indexRarete(possibles.at(-1).id);
}

// Pioche un jeu au hasard dans la rareté demandée, tous avec la même chance (sans doublon dans `exclus`).
// `bacs` : les jeux rangés par rareté (un thème pour les boosters thématiques). Si la rareté est vide
// dans ce thème, on prend la plus proche : d'abord plus commune, puis plus rare.
function piocher(index, exclus = new Set(), bacs = jeuxParRarete) {
    const ordre = [index];
    for (let d = 1; d < RARETES.length; d++) ordre.push(index + d, index - d);
    const trouve = ordre.find(i => i >= 0 && i < RARETES.length && bacs[RARETES[i].id]?.length);
    const bac = bacs[RARETES[trouve].id];
    let jeu = auHasard(bac);
    for (let essai = 0; essai < 20 && exclus.has(jeu.id); essai++) jeu = auHasard(bac);
    return creerCarte(jeu);
}

// ---------- Collection et monnaie ----------

function ajouterACollection(carte, holo) {
    const entree = etat.collection[carte.id];
    if (entree) {
        entree.exemplaires++;
        if (holo) entree.holos++;
        return false;
    }
    etat.collection[carte.id] = { ...carte, exemplaires: 1, holos: holo ? 1 : 0, obtenue: Date.now() };
    return true;
}

// On revend d'abord les exemplaires normaux, pour garder la holo
function prixRevente(entree) {
    const base = RARETES[indexRarete(entree.rarete)].revente;
    return entree.exemplaires > entree.holos ? base : base * MULTIPLICATEUR_HOLO;
}

function vendreDoublon(id) {
    const entree = etat.collection[id];
    if (!entree || entree.exemplaires < 2) return 0;
    const prix = prixRevente(entree);
    if (entree.exemplaires === entree.holos) entree.holos--;
    entree.exemplaires--;
    etat.pieces += prix;
    return prix;
}

function valeurDoublons(entree) {
    const base = RARETES[indexRarete(entree.rarete)].revente;
    const normales = entree.exemplaires - entree.holos;
    const normalesVendues = entree.holos > 0 ? normales : Math.max(0, normales - 1);
    const holosVendues = Math.max(0, entree.holos - 1);
    return normalesVendues * base + holosVendues * base * MULTIPLICATEUR_HOLO;
}

// ---------- En-tête et paquets ----------

let ouvertureEnCours = false;
const tempsRestant = () => Math.max(0, etat.dernierBooster + DELAI_BOOSTER - Date.now());

function majEntete() {
    $('#solde').textContent = nombre(etat.pieces);
    majPaquets();
}

// Appelée chaque seconde : minuteur du booster gratuit et état des paquets
function majPaquets() {
    const reste = tempsRestant();
    const manque = PRIX_BOOSTER - etat.pieces;

    const gratuit = $('#paquet-gratuit');
    gratuit.classList.toggle('verrouille', reste > 0);
    gratuit.setAttribute('aria-disabled', reste > 0);
    gratuit.setAttribute('aria-label', reste > 0
        ? `Booster gratuit, disponible dans ${formatDuree(reste)}` : 'Ouvrir le booster gratuit');
    $('#compte-gratuit').textContent = formatDuree(reste);
    $('#legende-gratuit').textContent = reste > 0 ? `Prochain dans ${formatDuree(reste)}` : 'Prêt ! Clique pour l’ouvrir';

    const achat = $('#paquet-achat');
    achat.classList.toggle('verrouille', manque > 0);
    achat.setAttribute('aria-disabled', manque > 0);
    achat.setAttribute('aria-label', manque > 0
        ? `Booster à ${PRIX_BOOSTER} pièces, il te manque ${manque} pièces` : `Acheter un booster pour ${PRIX_BOOSTER} pièces`);
    $('#manque-achat').textContent = `Il manque ${manque}`;

    // Ouverture ×10 (payante uniquement : le gratuit ne revient que toutes les 10 min)
    const prixLot = PRIX_BOOSTER * BOOSTERS_PAR_LOT;
    for (const bouton of [$('#btn-x10'), $('#btn-autre-x10')]) {
        bouton.disabled = etat.pieces < prixLot;
        bouton.title = bouton.disabled ? `Il te manque ${prixLot - etat.pieces} pièces` : '';
        bouton.innerHTML = `Ouvrir ×${BOOSTERS_PAR_LOT} · ${prixLot} ${PIECE}`;
    }

    for (const booster of BOOSTERS_SPECIAUX) {
        const bouton = document.querySelector(`[data-booster="${booster.id}"]`);
        if (!bouton) continue;
        const manqueSpecial = booster.prix - etat.pieces;
        bouton.classList.toggle('verrouille', manqueSpecial > 0);
        bouton.setAttribute('aria-disabled', manqueSpecial > 0);
        bouton.setAttribute('aria-label', manqueSpecial > 0
            ? `Booster ${booster.nom} à ${booster.prix} pièces, il te manque ${manqueSpecial} pièces`
            : `Acheter un booster ${booster.nom} pour ${booster.prix} pièces`);
        bouton.querySelector('[data-manque]').textContent = `Il manque ${manqueSpecial}`;
    }

    // "Ouvrir un autre" : le même booster spécial, sinon le gratuit s'il est prêt, sinon un booster payant
    const autre = $('#btn-autre');
    if (dernierType) {
        autre.disabled = etat.pieces < dernierType.prix;
        autre.innerHTML = `Ouvrir un autre ${dernierType.nom} · ${dernierType.prix} ${PIECE}`;
    } else {
        autre.disabled = reste > 0 && manque > 0;
        autre.innerHTML = reste === 0 ? 'Ouvrir un autre booster · gratuit'
            : autre.disabled ? `Booster gratuit dans ${formatDuree(reste)}`
            : `Ouvrir un autre booster · ${PRIX_BOOSTER} ${PIECE}`;
    }

    $('#lien-accueil').classList.toggle('pret', reste === 0);
}

function afficherBoostersSpeciaux() {
    $('#boosters-speciaux').innerHTML = BOOSTERS_SPECIAUX.map(b => `
        <div class="emplacement-paquet emplacement-special">
            <button class="paquet paquet-mini${b.prestige ? ' paquet-prestige' : ''}" data-booster="${b.id}" data-incline
                    style="--fond-paquet: ${b.fond}; --texte-paquet: ${b.texte}; --ombre-paquet: ${b.ombre}">
                <span class="paquet-haut"></span>
                <span class="paquet-corps">
                    <span class="paquet-marque">${b.nom}</span>
                    <span class="paquet-embleme" aria-hidden="true"></span>
                    <span class="paquet-type">${b.prix} pièces</span>
                </span>
                <span class="paquet-verrou"><span class="piece" aria-hidden="true"></span><b data-manque></b></span>
            </button>
            <p class="legende-paquet">${b.description}${b.total && b.filtre ? `<br><span>${nombre(b.total)} jeux</span>` : ''}</p>
        </div>`).join('');
    majPaquets();
}

// ---------- Ouverture de boosters ----------

// Commande de test, à taper dans la console : le prochain booster sera un god pack
let prochainGodPack = false;
window.forcerGodPack = () => {
    prochainGodPack = true;
    return 'Le prochain booster ouvert sera un god pack ✨';
};

// God pack : une Mythique garantie, puis des Légendaires (et parfois d'autres Mythiques), une chance sur 4 d'être holo
function tirerGodPack(bacs) {
    const exclus = new Set();
    return Array.from({ length: CARTES_PAR_BOOSTER }, (_, i) => {
        const index = i === 0 || Math.random() < PART_MYTHIQUE_GOD_PACK ? INDEX_MYTHIQUE : INDEX_LEGENDAIRE;
        const carte = piocher(index, exclus, bacs);
        exclus.add(carte.id);
        return { carte, holo: Math.random() < CHANCE_HOLO_GOD_PACK, godPack: true };
    });
}

// Les 5 cartes d'un booster : 4 au hasard + une 5ᵉ garantie (ou, très rarement, un god pack).
// `type` : un booster spécial (thème ou Prestige), ou rien pour le booster standard.
function tirerBooster(type = null) {
    const bacs = type?.bacs || jeuxParRarete;
    if (prochainGodPack || Math.random() < CHANCE_GOD_PACK) {
        prochainGodPack = false;
        return tirerGodPack(bacs);
    }
    const [cleChance, cleGarantie] = type?.prestige ? ['chancePrestige', 'chancePrestigeGarantie'] : ['chance', 'chanceGarantie'];
    const chanceHolo = type?.prestige ? CHANCE_HOLO_PRESTIGE : CHANCE_HOLO;
    const indices = Array.from({ length: CARTES_PAR_BOOSTER - 1 }, () => tirerRarete(cleChance));
    indices.push(tirerRarete(cleGarantie));
    const exclus = new Set();
    return indices.map(index => {
        const carte = piocher(index, exclus, bacs);
        exclus.add(carte.id);
        return { carte, holo: Math.random() < chanceHolo };
    });
}

let dernierType = null; // dernier booster spécial ouvert, pour « Ouvrir un autre »

async function ouvrirBooster(mode, nombreBoosters = 1, type = null) {
    if (ouvertureEnCours || !donneesPretes()) return;
    const prix = (type ? type.prix : PRIX_BOOSTER) * nombreBoosters;
    if (mode === 'gratuit' && tempsRestant() > 0) {
        return toast(`Prochain booster gratuit dans ${formatDuree(tempsRestant())}`);
    }
    if (mode === 'achat' && etat.pieces < prix) {
        return toast(`Il te manque ${prix - etat.pieces} pièces. Revends des doublons ou gagne un duel !`);
    }
    ouvertureEnCours = true;
    dernierType = type;

    const boosters = Array.from({ length: nombreBoosters }, () => tirerBooster(type));
    const tirage = boosters.flat();
    const godPacks = tirage.filter(t => t.godPack).length / CARTES_PAR_BOOSTER;
    if (mode === 'gratuit') etat.dernierBooster = Date.now();
    else etat.pieces -= prix;
    if (godPacks) {
        etat.godPacks.nombre += godPacks;
        etat.godPacks.premier ??= Date.now();
    }
    for (const t of tirage) t.nouvelle = ajouterACollection(t.carte, t.holo);
    sauvegarder();
    majEntete();

    $('#choix').hidden = true;
    $('#ouverture').hidden = false;
    $('#ouverture').classList.toggle('multiple', nombreBoosters > 1);
    $('#tirage').innerHTML = '';
    for (const id of ['#bilan', '#btn-autre', '#btn-autre-x10', '#btn-voir-collection']) $(id).hidden = true;
    $('#btn-passer').textContent = nombreBoosters > 1 ? 'Tout passer' : 'Passer';
    $('#btn-passer').hidden = false;
    $('#ouverture-aide').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Chaque paquet : on le déchire, puis on fait défiler sa pile, la carte la plus rare en dernier
    const modele = type ? $(`[data-booster="${type.id}"]`) : $(mode === 'gratuit' ? '#paquet-gratuit' : '#paquet-achat');
    seance.passer = false;
    for (let i = 0; i < boosters.length && !seance.passer; i++) {
        const cartes = [...boosters[i]].sort((a, b) => indexRarete(b.carte.rarete) - indexRarete(a.carte.rarete));
        const rang = nombreBoosters > 1 ? `Paquet ${i + 1} / ${nombreBoosters} · ` : '';
        await dechirerPaquet(modele, cartes[0].godPack, rang);
        if (!seance.passer) await defilerPile(cartes, rang);
    }

    $('#ouverture-scene').replaceChildren();
    $('#btn-passer').hidden = true;
    afficherRecapitulatif(tirage, nombreBoosters);
    ouvertureEnCours = false;
    finTirage();
}

let dernierTirage = [];

// Mise en scène du god pack : le paquet devient doré et tremble, flash, pluie d'étincelles, titre géant
async function revelationGodPack(paquet) {
    paquet.classList.add('divin');
    await attendre(1200);

    const flash = document.createElement('div');
    flash.className = 'flash-divin';
    const etincelles = document.createElement('div');
    etincelles.className = 'etincelles';
    etincelles.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 60; i++) {
        const e = document.createElement('span');
        e.textContent = Math.random() < 0.5 ? '✦' : '✧';
        e.style.left = `${Math.random() * 100}%`;
        e.style.fontSize = `${10 + Math.random() * 22}px`;
        e.style.animationDuration = `${2.2 + Math.random() * 2}s`;
        e.style.animationDelay = `${Math.random() * 1.2}s`;
        etincelles.append(e);
    }
    const titre = document.createElement('div');
    titre.className = 'titre-godpack';
    titre.setAttribute('role', 'status');
    titre.textContent = 'GOD PACK';
    document.body.append(flash, etincelles, titre);
    setTimeout(() => flash.remove(), 1200);
    setTimeout(() => titre.remove(), 2600);
    setTimeout(() => etincelles.remove(), 5000);
    await attendre(1600);
}

function majTropheeGodPack() {
    const { nombre, premier } = etat.godPacks;
    $('#trophee-godpack').hidden = !nombre;
    if (nombre) {
        $('#trophee-godpack').innerHTML = `✨ <b>${nombre}</b> god pack${nombre > 1 ? 's' : ''} ouvert${nombre > 1 ? 's' : ''}
            <span>· le premier le ${new Date(premier).toLocaleDateString('fr-FR')}</span>`;
    }
}

// ---------- Séance d'ouverture (paquet à déchirer, pile de cartes) ----------

// `reprendre` débloque l'étape en cours (geste, clic, clavier) ; `passer` saute tout jusqu'au récapitulatif
const seance = { passer: false, reprendre: null };

function passerOuverture() {
    seance.passer = true;
    seance.reprendre?.();
}

function clonerPaquet(modele) {
    const paquet = modele.cloneNode(true);
    paquet.removeAttribute('id');
    paquet.removeAttribute('data-incline');
    for (const variable of ['--rx', '--ry', '--mx', '--my']) paquet.style.removeProperty(variable);
    paquet.removeAttribute('aria-describedby');
    paquet.removeAttribute('data-booster');
    paquet.classList.remove('verrouille', 'paquet-mini');
    paquet.classList.add('paquet-seul');
    paquet.querySelector('.paquet-verrou')?.remove();
    paquet.setAttribute('aria-label', 'Ouvrir le paquet');
    // Indication du geste : un point lumineux qui glisse le long de la ligne de découpe
    paquet.insertAdjacentHTML('beforeend', '<span class="geste-dechirer" aria-hidden="true"><i></i></span>');
    return paquet;
}

// Attend un glissé (ou un clic) sur le paquet, puis le fait trembler et le déchire dans le sens du geste
async function dechirerPaquet(modele, divin, rang) {
    const paquet = clonerPaquet(modele);
    $('#ouverture-scene').replaceChildren(paquet);
    $('#ouverture-aide').innerHTML = `${rang}Glisse sur le haut du paquet pour l’ouvrir`;

    let sens = 1;
    await new Promise(resolve => {
        let depart = null;
        seance.reprendre = resolve;
        paquet.addEventListener('pointerdown', e => {
            depart = e.clientX;
            paquet.setPointerCapture(e.pointerId);
        });
        paquet.addEventListener('pointerup', e => {
            if (depart !== null && e.clientX < depart - 10) sens = -1;
            resolve();
        });
    });
    seance.reprendre = null;
    if (seance.passer) return;

    paquet.classList.add('secoue');
    await attendre(500);
    if (divin) await revelationGodPack(paquet);
    paquet.classList.remove('secoue', 'divin');
    paquet.style.setProperty('--sens', sens);
    paquet.classList.add('dechire');
    await attendre(600);
}

// Attend qu'on fasse glisser la carte du dessus hors de la pile (ou un simple clic) ; renvoie le sens : 1 ou -1
function glisserCarte(element) {
    return new Promise(resolve => {
        let depart = null;
        let dx = 0;
        seance.reprendre = () => resolve(1);
        element.onpointerdown = e => {
            depart = e.clientX;
            dx = 0;
            element.setPointerCapture(e.pointerId);
            element.classList.add('saisie');
        };
        element.onpointermove = e => {
            if (depart === null) return;
            dx = e.clientX - depart;
            element.style.translate = `${dx}px ${Math.abs(dx) * -0.08}px`;
            element.style.rotate = `${dx / 16}deg`;
        };
        element.onpointerup = () => {
            element.classList.remove('saisie');
            depart = null;
            // Assez loin, ou simple clic : la carte part ; sinon elle revient sur la pile
            if (Math.abs(dx) > 70 || Math.abs(dx) < 6) return resolve(dx < 0 ? -1 : 1);
            element.style.translate = '';
            element.style.rotate = '';
        };
    });
}

// Pile de cartes face visible : on les fait défiler une par une, la plus rare arrive en dernier
async function defilerPile(cartes, rang) {
    const pile = document.createElement('div');
    pile.innerHTML = cartes.map((t, i) => `
        <div class="pile-carte" style="z-index: ${cartes.length - i}">
            ${carteHTML(t.carte, { holo: t.holo })}
            ${t.nouvelle ? '<span class="badge-nouvelle">Nouvelle !</span>' : ''}
        </div>`).join('');
    $('#ouverture-scene').replaceChildren(pile);
    const elements = [...pile.children];

    for (let i = 0; i < elements.length && !seance.passer; i++) {
        elements.forEach((element, k) => element.style.setProperty('--rang', k - i));
        const dessus = elements[i];
        if (indexRarete(cartes[i].carte.rarete) <= INDEX_LEGENDAIRE) dessus.classList.add('apparition-rare');

        // Si la carte suivante est Épique ou mieux, la pile brille de sa couleur : suspense
        const suivante = cartes[i + 1];
        const annonce = suivante && indexRarete(suivante.carte.rarete) <= INDEX_EPIQUE;
        pile.className = `pile${cartes[0].godPack ? ' pile-divine' : ''}${annonce ? ` annonce rarete-${suivante.carte.rarete}` : ''}`;
        $('#ouverture-aide').innerHTML = `${rang}Carte <b>${i + 1} / ${cartes.length}</b> · glisse-la pour voir la suivante`;

        const sens = await glisserCarte(dessus);
        seance.reprendre = null;
        if (seance.passer) return;
        dessus.style.setProperty('--sens', sens);
        dessus.classList.add('envolee');
        await attendre(300);
        dessus.hidden = true;
    }
}

// Récapitulatif : toutes les cartes face visible (un clic ouvre la fiche)
function afficherRecapitulatif(tirage, nombreBoosters) {
    tirage.sort((a, b) => indexRarete(b.carte.rarete) - indexRarete(a.carte.rarete));
    dernierTirage = tirage;
    const visible = t => flipHTML(t.carte, { ...t, retournee: true });
    if (nombreBoosters > 1) {
        // ×10 : god pack en haut, puis les meilleures cartes, puis le reste en petit
        const parRarete = [...tirage].reverse();
        const divines = parRarete.filter(t => t.godPack);
        const vedettes = parRarete.filter(t => !t.godPack && indexRarete(t.carte.rarete) <= INDEX_RARE);
        const reste = parRarete.filter(t => !t.godPack && indexRarete(t.carte.rarete) > INDEX_RARE);
        $('#tirage').innerHTML = `
            ${divines.length ? `
                <h2 class="tirage-titre titre-divin">✨ God pack ✨ <span>${divines.length} cartes divines</span></h2>
                <div class="tirage-grille tirage-vedettes">${divines.map(visible).join('')}</div>` : ''}
            ${vedettes.length ? `
                <h2 class="tirage-titre">Tes meilleures cartes <span>Rare et plus · ${vedettes.length}</span></h2>
                <div class="tirage-grille tirage-vedettes">${vedettes.map(visible).join('')}</div>` : ''}
            ${reste.length ? `
                <h2 class="tirage-titre">Le reste <span>Communes et peu communes · ${reste.length}</span></h2>
                <div class="tirage-grille tirage-reste">${reste.map(visible).join('')}</div>` : ''}`;
    } else {
        $('#tirage').innerHTML = tirage.map(visible).join('');
    }
    $('#tirage').querySelectorAll('.flip').forEach((flip, i) => {
        flip.style.animationDelay = `${Math.min(i * (nombreBoosters > 1 ? 20 : 90), 600)}ms`;
        flip.tabIndex = 0;
        flip.setAttribute('role', 'button');
        flip.setAttribute('aria-label', 'Voir le détail de la carte');
    });
}

// Clic sur une carte du récapitulatif : ouvrir sa fiche
function cliquerCarteTirage(flip) {
    if (flip) afficherFiche(Number(flip.dataset.id));
}

function finTirage() {
    const nouvelles = dernierTirage.filter(t => t.nouvelle).length;
    const meilleure = RARETES[Math.min(...dernierTirage.map(t => indexRarete(t.carte.rarete)))];
    const holos = dernierTirage.filter(t => t.holo).length;
    $('#ouverture-aide').hidden = true;
    const divines = dernierTirage.filter(t => t.godPack);
    const mythiques = divines.filter(t => t.carte.rarete === 'mythique').length;
    $('#bilan').classList.toggle('bilan-divin', divines.length > 0);
    $('#bilan').innerHTML = (divines.length
        ? `<span class="bilan-godpack">✨ GOD PACK ✨</span>
           <span class="rarete-mythique"><b class="texte-rarete">${mythiques}</b> Mythique${mythiques > 1 ? 's' : ''}</span>`
        : '') + `
        <span><b>${nouvelles}</b> nouvelle${nouvelles > 1 ? 's' : ''}</span>
        <span class="rarete-${meilleure.id}">Meilleure : <b class="texte-rarete">${meilleure.nom}</b></span>
        ${holos ? `<span>✨ <b>${holos}</b> holo${holos > 1 ? 's' : ''}</span>` : ''}`;
    majPaquets();
    for (const id of ['#bilan', '#btn-autre', '#btn-autre-x10', '#btn-voir-collection']) $(id).hidden = false;
}

// ---------- Écran accueil ----------

function afficherAccueil() {
    // Une ouverture en cours reste affichée
    if (!$('#ouverture').hidden && ouvertureEnCours) return;
    $('#ouverture').hidden = true;
    $('#choix').hidden = false;

    const entrees = Object.values(etat.collection);
    const total = totalJeux();
    $('#progression-texte').innerHTML = total
        ? `<b>${nombre(entrees.length)}</b> / ${nombre(total)} jeux découverts`
        : 'Chargement des jeux…';
    $('#progression-barre').style.width = total ? `${Math.max(0.5, (entrees.length / total) * 100)}%` : '0';
    $('#progression-raretes').innerHTML = pucesRaretesHTML();
    majTropheeGodPack();

    const recentes = entrees.sort((a, b) => b.obtenue - a.obtenue).slice(0, 8);
    $('#bloc-recentes').hidden = !recentes.length;
    $('#recentes').innerHTML = recentes.map(e => `
        <button class="mini" data-fiche="${e.id}" aria-label="Voir ${echapper(e.nom)}">
            ${carteHTML(e, { holo: e.holos > 0 })}
        </button>`).join('');
    majPaquets();
}

// ---------- Écran collection ----------

const TRIS = {
    rarete: (a, b) => indexRarete(a.rarete) - indexRarete(b.rarete) || b.popularite - a.popularite,
    recent: (a, b) => b.obtenue - a.obtenue,
    attaque: (a, b) => b.attaque - a.attaque,
    anciennete: (a, b) => b.anciennete - a.anciennete,
    popularite: (a, b) => b.popularite - a.popularite,
    annee: (a, b) => (b.annee || 0) - (a.annee || 0),
    nom: (a, b) => a.nom.localeCompare(b.nom, 'fr'),
    exemplaires: (a, b) => b.exemplaires - a.exemplaires,
};

let filtreRarete = '';
let limiteCollection = CARTES_PAR_PAGE;

function caseCollectionHTML(entree) {
    return `
        <div class="case" data-id="${entree.id}">
            <button class="case-carte" data-fiche="${entree.id}" aria-label="Voir ${echapper(entree.nom)}">
                ${carteHTML(entree, { holo: entree.holos > 0, compteur: entree.exemplaires })}
            </button>
            ${entree.exemplaires > 1
                ? `<button class="btn-vendre" data-vendre="${entree.id}">Revendre · +${prixRevente(entree)} ${PIECE}</button>`
                : ''}
        </div>`;
}

function afficherCollection() {
    const entrees = Object.values(etat.collection);
    $('#filtre-raretes').innerHTML = pucesRaretesHTML({ boutons: true, actif: filtreRarete });

    // Le menu des genres se construit à partir de la collection
    const selGenre = $('#filtre-genre');
    const genreChoisi = selGenre.value;
    selGenre.innerHTML = optionsGenresHTML(genreChoisi, new Set(entrees.flatMap(e => [...e.genres, ...(e.tags || []), ...distinctionsDe(e)])));

    const recherche = $('#filtre-nom').value.trim().toLowerCase();
    const doublons = $('#filtre-doublons').checked;
    const visibles = entrees
        .filter(e => !recherche || e.nom.toLowerCase().includes(recherche))
        .filter(e => !filtreRarete || e.rarete === filtreRarete)
        .filter(e => !genreChoisi || aLeGenre(e, genreChoisi))
        .filter(e => !doublons || e.exemplaires > 1)
        .sort(TRIS[$('#tri').value]);

    const grille = $('#grille-collection');
    if (!entrees.length) {
        grille.innerHTML = '<p class="vide">Ta collection est vide.<br><a class="btn btn-principal" href="#accueil">Ouvre ton premier booster</a></p>';
    } else if (!visibles.length) {
        grille.innerHTML = '<p class="vide">Aucune carte ne correspond à ces filtres.</p>';
    } else {
        grille.innerHTML = visibles.slice(0, limiteCollection).map(caseCollectionHTML).join('');
    }
    const restantes = visibles.length - limiteCollection;
    $('#btn-plus').hidden = restantes <= 0;
    $('#btn-plus').textContent = `Afficher plus (${nombre(restantes)} restantes)`;
    majResumeCollection();
}

function filtrerCollection() {
    limiteCollection = CARTES_PAR_PAGE;
    afficherCollection();
}

function majResumeCollection() {
    const entrees = Object.values(etat.collection);
    const total = entrees.reduce((n, e) => n + e.exemplaires, 0);
    const valeur = entrees.reduce((n, e) => n + valeurDoublons(e), 0);
    $('#resume-collection').textContent =
        `${nombre(entrees.length)} jeux différents · ${nombre(total)} cartes · ${nombre(total - entrees.length)} doublons`;
    const bouton = $('#btn-vendre-tout');
    bouton.disabled = valeur === 0;
    bouton.innerHTML = valeur ? `Revendre les doublons · +${nombre(valeur)} ${PIECE}` : 'Aucun doublon';
}

function vendreDepuisCollection(id) {
    const prix = vendreDoublon(id);
    if (!prix) return;
    sauvegarder();
    majEntete();
    const caseCarte = document.querySelector(`.case[data-id="${id}"]`);
    if (caseCarte) {
        if ($('#filtre-doublons').checked && etat.collection[id].exemplaires < 2) caseCarte.remove();
        else caseCarte.outerHTML = caseCollectionHTML(etat.collection[id]);
        majResumeCollection();
    }
    toast(`+${prix} pièces`, 'gain');
}

function vendreTousLesDoublons() {
    const entrees = Object.values(etat.collection);
    const valeur = entrees.reduce((n, e) => n + valeurDoublons(e), 0);
    if (!valeur || !confirm(`Revendre tous tes doublons pour ${valeur} pièces ? Tu gardes un exemplaire de chaque jeu (la holo en priorité).`)) return;
    for (const e of entrees) while (e.exemplaires > 1) vendreDoublon(e.id);
    sauvegarder();
    majEntete();
    afficherCollection();
    toast(`+${nombre(valeur)} pièces`, 'gain');
}

// ---------- Fiche détaillée ----------

function afficherFiche(id) {
    const e = etat.collection[id];
    const jeu = jeuxParId.get(id);
    const carte = e || (jeu && creerCarte(jeu));
    if (!carte) return;
    const rarete = RARETES[indexRarete(carte.rarete)];
    const manque = rarete.prix - etat.pieces;
    $('#modale-contenu').innerHTML = `
        <div class="fiche-visuel" data-incline>${carteHTML(carte, { holo: e?.holos > 0 })}</div>
        <div class="fiche-infos rarete-${rarete.id}">
            <span class="fiche-rarete">${rarete.nom}${e?.holos ? ' · ✨ Holo' : ''}</span>
            <h2>${echapper(carte.nom)}</h2>
            <p class="fiche-meta">${[carte.annee, ...carte.genres].filter(Boolean).map(echapper).join(' · ')}</p>
            ${gotyDe(carte.id) || carte.metacritic >= SEUIL_CHEF_OEUVRE ? `<div class="fiche-distinctions">
                ${gotyDe(carte.id) ? `<p class="fiche-distinction">${LAURIER}Jeu de l’année ${gotyDe(carte.id).annee}<span>${gotyDe(carte.id).ceremonie}</span></p>` : ''}
                ${carte.metacritic >= SEUIL_CHEF_OEUVRE ? `<p class="fiche-distinction">${ICONES.medaille}Chef-d’œuvre<span>noté ${carte.metacritic}/100 par la presse (Metacritic)</span></p>` : ''}
            </div>` : ''}
            ${carte.tags?.length ? `<p class="fiche-tags">${carte.tags.map(t => `<span${(groupesTags['Contenu sensible'] || []).includes(t)
                ? ' class="tag-sensible"' : ''}>${echapper(t)}</span>`).join('')}</p>` : ''}
            <dl class="fiche-stats">
                <div><dt>${STATS.attaque.icone} Note public</dt><dd>${carte.attaque} %</dd></div>
                <div><dt>${STATS.anciennete.icone} Ancienneté</dt><dd>${carte.anciennete} / 100 <span class="gris">· ${carte.annee}</span></dd></div>
                <div><dt>★ Popularité</dt><dd>${carte.popularite} / 100</dd></div>
                <div><dt>📰 Metacritic</dt><dd>${carte.metacritic ?? '<span class="gris">aucune</span>'}</dd></div>
            </dl>
            <p class="fiche-exemplaires">
                ${e
                    ? `${e.exemplaires} exemplaire${e.exemplaires > 1 ? 's' : ''}${e.holos ? ` dont ${e.holos} holo` : ''}
                       · obtenue le ${new Date(e.obtenue).toLocaleDateString('fr-FR')}`
                    : 'Pas encore dans ta collection.'}
            </p>
            <div class="fiche-actions">
                ${e && e.exemplaires > 1
                    ? `<button class="btn btn-or" data-vendre="${e.id}">Revendre un doublon · +${prixRevente(e)} ${PIECE}</button>`
                    : ''}
                ${!e
                    ? `<button class="btn btn-principal" data-acheter="${carte.id}"${manque > 0 ? ` disabled title="Il te manque ${nombre(manque)} pièces"` : ''}>
                           Acheter · ${nombre(rarete.prix)} ${PIECE}</button>`
                    : ''}
                <a class="btn" href="https://store.steampowered.com/app/${carte.id}" target="_blank" rel="noopener">Voir sur Steam ↗</a>
            </div>
            ${!e && manque > 0 ? `<p class="fiche-note">Il te manque ${nombre(manque)} pièces.</p>` : ''}
        </div>`;
    if (!$('#modale').open) $('#modale').showModal();
}

// ---------- Écran catalogue ----------

const TRIS_CATALOGUE = {
    popularite: null, // data/jeux.json est déjà trié du plus au moins populaire
    note: (a, b) => notePublic(b.note, b.avis) - notePublic(a.note, a.avis),
    metacritic: (a, b) => (b.metacritic ?? -1) - (a.metacritic ?? -1),
    recent: (a, b) => (b.annee || 0) - (a.annee || 0),
    ancien: (a, b) => (a.annee || 9999) - (b.annee || 9999),
    nom: (a, b) => a.nom.localeCompare(b.nom, 'fr'),
};

let filtreRareteCatalogue = '';
let limiteCatalogue = CARTES_PAR_PAGE;

function caseCatalogueHTML(jeu) {
    const carte = creerCarte(jeu);
    const entree = etat.collection[jeu.id];
    const prix = RARETES[indexRarete(carte.rarete)].prix;
    return `
        <div class="case">
            <button class="case-carte${entree ? '' : ' non-possedee'}" data-fiche="${jeu.id}" aria-label="Voir ${echapper(jeu.nom)}">
                ${carteHTML(carte, { holo: entree?.holos > 0, compteur: entree?.exemplaires || 0 })}
            </button>
            ${entree
                ? `<span class="etiquette-possedee">✓ Dans ta collection</span>`
                : `<button class="btn-acheter" data-acheter="${jeu.id}"${etat.pieces < prix ? ' disabled' : ''}>Acheter · ${nombre(prix)} ${PIECE}</button>`}
        </div>`;
}

function afficherCatalogue() {
    if (!donneesPretes()) {
        $('#grille-catalogue').innerHTML = '<p class="vide">Chargement des jeux…</p>';
        return;
    }
    $('#catalogue-raretes').innerHTML = pucesRaretesHTML({ boutons: true, actif: filtreRareteCatalogue, totaux: true });

    const selGenre = $('#catalogue-genre');
    if (selGenre.options.length <= 1) selGenre.innerHTML = optionsGenresHTML(selGenre.value);

    const recherche = $('#catalogue-nom').value.trim().toLowerCase();
    const genre = selGenre.value;
    const manquantes = $('#catalogue-manquantes').checked;
    const bac = filtreRareteCatalogue ? jeuxParRarete[filtreRareteCatalogue] : tousLesJeux;
    const visibles = bac.filter(j =>
        (!recherche || j.nom.toLowerCase().includes(recherche))
        && (!genre || aLeGenre(j, genre))
        && (!manquantes || !etat.collection[j.id]));
    const tri = TRIS_CATALOGUE[$('#catalogue-tri').value];
    if (tri) visibles.sort(tri);

    $('#grille-catalogue').innerHTML = visibles.length
        ? visibles.slice(0, limiteCatalogue).map(caseCatalogueHTML).join('')
        : '<p class="vide">Aucun jeu ne correspond à ces filtres.</p>';
    const restantes = visibles.length - limiteCatalogue;
    $('#btn-catalogue-plus').hidden = restantes <= 0;
    $('#btn-catalogue-plus').textContent = `Afficher plus (${nombre(restantes)} restants)`;
    $('#resume-catalogue').textContent = `${nombre(totalJeux())} jeux · tu en possèdes ${nombre(Object.keys(etat.collection).length)}`
        + (visibles.length !== totalJeux() ? ` · ${nombre(visibles.length)} avec ces filtres` : '');
}

function filtrerCatalogue() {
    limiteCatalogue = CARTES_PAR_PAGE;
    afficherCatalogue();
}

function acheterCarte(id) {
    const jeu = jeuxParId.get(id);
    if (!jeu || etat.collection[id]) return;
    const carte = creerCarte(jeu);
    const prix = RARETES[indexRarete(carte.rarete)].prix;
    if (etat.pieces < prix) return toast(`Il te manque ${nombre(prix - etat.pieces)} pièces pour acheter ${carte.nom}`);
    if (!confirm(`Acheter ${carte.nom} pour ${nombre(prix)} pièces ?`)) return;
    etat.pieces -= prix;
    ajouterACollection(carte, false);
    sauvegarder();
    majEntete();
    toast(`${carte.nom} rejoint ta collection !`, 'gain');
    if (!$('#ecran-catalogue').hidden) afficherCatalogue();
    if ($('#modale').open) afficherFiche(id);
}

// ---------- Écran règles ----------

const chanceRarete = rarete => `${nombre(rarete.chance)} %`;

function afficherRegles() {
    const entrees = Object.values(etat.collection);
    $('#legende-raretes').innerHTML = RARETES.map((r, i) => `
        <tr class="rarete-${r.id}">
            <td><span class="pastille"></span>${r.nom}</td>
            <td>${r.seuil ? `≥ ${nombre(r.seuil)}` : `< ${nombre(RARETES[i - 1].seuil)}`}</td>
            <td>${chanceRarete(r)}</td>
            <td>${r.chanceGarantie ? `${nombre(r.chanceGarantie)} %` : '—'}</td>
            <td>${nombre(r.chanceDuel)} %</td>
            <td>${r.revente} ${PIECE}</td>
            <td>${nombre(r.prix)} ${PIECE}</td>
            <td>${entrees.filter(e => e.rarete === r.id).length} / ${nombre(jeuxParRarete[r.id]?.length || 0)}</td>
        </tr>`).join('');
}

// Efface tout ce que le jeu a enregistré (clés "gameCards.") et repart de zéro
function reinitialiser() {
    const cartes = Object.values(etat.collection).reduce((n, e) => n + e.exemplaires, 0);
    const message = `Supprimer définitivement ta sauvegarde ?\n\nTu perdras tes ${nombre(cartes)} cartes et tes ${nombre(etat.pieces)} pièces. `
        + 'Cette action ne peut pas être annulée.';
    if (!confirm(message)) return;
    try {
        Object.keys(localStorage).filter(cle => cle.startsWith('gameCards.')).forEach(cle => localStorage.removeItem(cle));
    } catch (e) {
        console.warn('Suppression impossible', e);
    }
    location.hash = '#accueil';
    location.reload();
}

// ---------- Duel ----------

// Tirage d'une carte de duel : une rareté selon `chanceDuel`, puis une carte au hasard dedans.
// Pour toi, seules les raretés que tu possèdes comptent (leurs chances se répartissent entre elles).
function tirerCarteJoueur() {
    const parRarete = {};
    for (const e of Object.values(etat.collection)) (parRarete[e.rarete] ??= []).push(e);
    const rarete = RARETES[tirerRarete('chanceDuel', RARETES.filter(r => parRarete[r.id]))];
    return auHasard(parRarete[rarete.id]);
}
const tirerCarteOrdi = exclus => piocher(tirerRarete('chanceDuel'), exclus);

const duel = { joueur: 0, ordi: 0, carteJoueur: null, carteOrdi: null, verrou: false };

function actionsDuel(html) {
    $('#duel-actions').innerHTML = html;
}

function majScoreDuel() {
    const pips = n => Array.from({ length: MANCHES_GAGNANTES }, (_, i) => `<i${i < n ? ' class="plein"' : ''}></i>`).join('');
    $('#pips-joueur').innerHTML = pips(duel.joueur);
    $('#pips-ordi').innerHTML = pips(duel.ordi);
    $('#pips-joueur').setAttribute('aria-label', `${duel.joueur} manche(s) gagnée(s)`);
    $('#pips-ordi').setAttribute('aria-label', `${duel.ordi} manche(s) gagnée(s)`);
}

function demarrerDuel() {
    if (!donneesPretes()) return;
    if (!Object.keys(etat.collection).length) {
        toast('Ouvre d’abord un booster pour avoir des cartes', 'erreur');
        return;
    }
    duel.joueur = 0;
    duel.ordi = 0;
    duel.manche = 0;
    nouvelleManche();
}

function nouvelleManche() {
    duel.manche++;
    duel.verrou = false;
    duel.carteJoueur = tirerCarteJoueur();
    duel.carteOrdi = tirerCarteOrdi(new Set([duel.carteJoueur.id]));

    $('#duel-joueur').className = 'duel-emplacement';
    $('#duel-ordi').className = 'duel-emplacement';
    $('#duel-joueur').innerHTML = flipHTML(duel.carteJoueur, { holo: duel.carteJoueur.holos > 0, retournee: true });
    // On voit le jeu adverse, pas ses stats : à toi de deviner où il est faible
    $('#duel-ordi').innerHTML = flipHTML(duel.carteOrdi, { retournee: true, cachee: true });
    $('#duel-manche').textContent = `Manche ${duel.manche}`;
    $('#duel-message').innerHTML = `L’ordinateur joue <b>${echapper(duel.carteOrdi.nom)}</b>. Sur quelle stat penses-tu le battre ?`;
    actionsDuel(Object.entries(STATS).map(([cle, stat]) => `
        <button class="btn-stat" data-stat="${cle}">
            <span>${stat.icone} ${stat.nom}</span><b>${duel.carteJoueur[cle]}</b>
        </button>`).join(''));
    majScoreDuel();
}

async function choisirStat(stat) {
    if (duel.verrou) return;
    duel.verrou = true;
    $('#duel-actions').querySelectorAll('button').forEach(b => (b.disabled = true));
    $(`#duel-actions [data-stat="${stat}"]`).classList.add('choisie');
    $('#duel-joueur').querySelector(`li[data-stat="${stat}"]`).classList.add('stat-choisie');
    await attendre(400);

    // Révélation des stats adverses
    $('#duel-ordi').innerHTML = flipHTML(duel.carteOrdi, { retournee: true });
    $('#duel-ordi .carte').classList.add('revelation');
    $('#duel-ordi').querySelector(`li[data-stat="${stat}"]`).classList.add('stat-choisie');
    await attendre(700);

    // En cas d'égalité, la Popularité départage
    const mienne = duel.carteJoueur[stat];
    const sienne = duel.carteOrdi[stat];
    let ecart = mienne - sienne;
    let departage = '';
    if (!ecart && stat !== 'popularite') {
        const pm = duel.carteJoueur.popularite;
        const ps = duel.carteOrdi.popularite;
        ecart = pm - ps;
        if (ecart) departage = ` Égalité, départagée par la Popularité (${pm} contre ${ps}).`;
    }

    let resultat = 'Égalité parfaite, personne ne marque.';
    if (ecart > 0) {
        duel.joueur++;
        resultat = 'Manche gagnée !';
        $('#duel-joueur').classList.add('gagne');
        $('#duel-ordi').classList.add('perd');
    } else if (ecart < 0) {
        duel.ordi++;
        resultat = 'Manche perdue.';
        $('#duel-joueur').classList.add('perd');
        $('#duel-ordi').classList.add('gagne');
    }
    majScoreDuel();
    $('#duel-message').innerHTML = `${STATS[stat].icone} ${STATS[stat].nom} : <b>${mienne}</b> contre <b>${sienne}</b>.${departage} <b>${resultat}</b>`;

    if (duel.joueur >= MANCHES_GAGNANTES || duel.ordi >= MANCHES_GAGNANTES) finDuel();
    else actionsDuel('<button class="btn btn-principal btn-grand" data-action="manche">Manche suivante</button>');
}

function finDuel() {
    const victoire = duel.joueur >= MANCHES_GAGNANTES;
    if (victoire) {
        etat.pieces += GAIN_DUEL;
        sauvegarder();
        majEntete();
        toast(`Victoire ! +${GAIN_DUEL} pièces`, 'gain');
    }
    // Le détail de la dernière manche reste affiché au-dessus du résultat
    $('#duel-message').innerHTML += victoire
        ? `<br><b class="victoire">Victoire ${duel.joueur} à ${duel.ordi} !</b> Tu gagnes ${GAIN_DUEL} pièces.`
        : `<br><b class="defaite">Défaite ${duel.joueur} à ${duel.ordi}.</b> Retente ta chance !`;
    actionsDuel('<button class="btn btn-principal btn-grand" data-action="demarrer">Rejouer</button>');
}

// ---------- Effet d'inclinaison 3D (paquets, fiche) ----------

let elementIncline = null;

function inclinerVers(element, e) {
    if (elementIncline && elementIncline !== element) {
        elementIncline.style.removeProperty('--rx');
        elementIncline.style.removeProperty('--ry');
    }
    elementIncline = element;
    if (!element) return;
    const r = element.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    element.style.setProperty('--rx', `${((0.5 - y) * 16).toFixed(2)}deg`);
    element.style.setProperty('--ry', `${((x - 0.5) * 16).toFixed(2)}deg`);
    element.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    element.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
}

// ---------- Navigation ----------

function afficherEcran(nom) {
    if (!document.getElementById(`ecran-${nom}`)) nom = 'accueil';
    document.querySelectorAll('.ecran').forEach(e => (e.hidden = e.id !== `ecran-${nom}`));
    document.querySelectorAll('.menu a').forEach(a => {
        if (a.dataset.ecran === nom) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
    });
    if ($('#modale').open) $('#modale').close();
    if (nom === 'accueil') afficherAccueil();
    if (nom === 'collection') afficherCollection();
    if (nom === 'regles') afficherRegles();
    if (nom === 'catalogue') afficherCatalogue();
    window.scrollTo(0, 0);
}

// ---------- Démarrage ----------

function init() {
    // Accueil : paquets et ouverture
    $('#paquet-gratuit').addEventListener('click', () => ouvrirBooster('gratuit'));
    $('#paquet-achat').addEventListener('click', () => ouvrirBooster('achat'));
    afficherBoostersSpeciaux();
    $('#boosters-speciaux').addEventListener('click', e => {
        const bouton = e.target.closest('[data-booster]');
        if (bouton) ouvrirBooster('achat', 1, BOOSTERS_SPECIAUX.find(b => b.id === bouton.dataset.booster));
    });
    $('#btn-passer').addEventListener('click', passerOuverture);
    // Clavier pendant l'ouverture : Espace, Entrée ou flèche droite pour déchirer le paquet ou passer à la carte suivante
    document.addEventListener('keydown', e => {
        if (!seance.reprendre || $('#ouverture').hidden || $('#modale').open) return;
        if (![' ', 'Enter', 'ArrowRight'].includes(e.key)) return;
        if (e.target.closest('a, input, select, button:not(.paquet-seul)')) return;
        e.preventDefault();
        seance.reprendre();
    });
    $('#btn-autre').addEventListener('click', () => dernierType
        ? ouvrirBooster('achat', 1, dernierType)
        : ouvrirBooster(tempsRestant() === 0 ? 'gratuit' : 'achat'));
    $('#btn-x10').addEventListener('click', () => ouvrirBooster('achat', BOOSTERS_PAR_LOT));
    // Le ×10 de l'écran de bilan est toujours le standard
    $('#btn-autre-x10').addEventListener('click', () => ouvrirBooster('achat', BOOSTERS_PAR_LOT));
    $('#tirage').addEventListener('click', e => cliquerCarteTirage(e.target.closest('.flip')));
    $('#tirage').addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            cliquerCarteTirage(e.target.closest('.flip'));
        }
    });

    // Collection
    $('#filtre-raretes').addEventListener('click', e => {
        const puce = e.target.closest('[data-rarete]');
        if (!puce) return;
        filtreRarete = puce.dataset.rarete;
        filtrerCollection();
    });
    for (const id of ['#filtre-genre', '#tri', '#filtre-doublons']) $(id).addEventListener('change', filtrerCollection);
    $('#filtre-nom').addEventListener('input', filtrerCollection);
    $('#btn-plus').addEventListener('click', () => {
        limiteCollection += CARTES_PAR_PAGE;
        afficherCollection();
    });
    $('#btn-vendre-tout').addEventListener('click', vendreTousLesDoublons);
    $('#btn-reinitialiser').addEventListener('click', reinitialiser);

    // Catalogue
    $('#catalogue-raretes').addEventListener('click', e => {
        const puce = e.target.closest('[data-rarete]');
        if (!puce) return;
        filtreRareteCatalogue = puce.dataset.rarete;
        filtrerCatalogue();
    });
    for (const id of ['#catalogue-genre', '#catalogue-tri', '#catalogue-manquantes']) $(id).addEventListener('change', filtrerCatalogue);
    let attenteRecherche;
    $('#catalogue-nom').addEventListener('input', () => {
        clearTimeout(attenteRecherche);
        attenteRecherche = setTimeout(filtrerCatalogue, 150); // 81 000 jeux : on attend la fin de la frappe
    });
    $('#btn-catalogue-plus').addEventListener('click', () => {
        limiteCatalogue += CARTES_PAR_PAGE;
        afficherCatalogue();
    });

    // Clics partagés : ouvrir une fiche, acheter une carte, revendre un doublon
    document.addEventListener('click', e => {
        const acheter = e.target.closest('[data-acheter]');
        if (acheter) return acheterCarte(Number(acheter.dataset.acheter));
        const vendre = e.target.closest('[data-vendre]');
        if (vendre) {
            const id = Number(vendre.dataset.vendre);
            vendreDepuisCollection(id);
            if ($('#modale').open) afficherFiche(id);
            return;
        }
        const fiche = e.target.closest('[data-fiche]');
        if (fiche) afficherFiche(Number(fiche.dataset.fiche));
    });

    // Fiche : fermeture par le bouton ou en cliquant à côté
    $('#modale-fermer').addEventListener('click', () => $('#modale').close());
    $('#modale').addEventListener('click', e => {
        if (e.target === $('#modale')) $('#modale').close();
    });

    // Duel
    $('#duel-actions').addEventListener('click', e => {
        const bouton = e.target.closest('button');
        if (!bouton) return;
        if (bouton.dataset.stat) choisirStat(bouton.dataset.stat);
        else if (bouton.dataset.action === 'demarrer') demarrerDuel();
        else if (bouton.dataset.action === 'manche') nouvelleManche();
    });

    // Inclinaison 3D à la souris uniquement
    document.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        inclinerVers(e.target.closest('[data-incline]'), e);
    });
    document.addEventListener('pointerleave', () => inclinerVers(null));

    // Hauteur de l'en-tête, pour coller la barre d'actions du ×10 juste en dessous
    const majHauteurEntete = () =>
        document.documentElement.style.setProperty('--hauteur-entete', `${$('.entete').offsetHeight}px`);
    majHauteurEntete();
    window.addEventListener('resize', majHauteurEntete);

    window.addEventListener('hashchange', () => afficherEcran(location.hash.slice(1)));
    // Un lien vers l'écran déjà affiché ne déclenche pas hashchange : "Boosters" ramène quand même aux paquets
    document.addEventListener('click', e => {
        const lien = e.target.closest('a[href^="#"]');
        if (lien && lien.hash === (location.hash || '#accueil')) afficherEcran(lien.hash.slice(1));
    });
    afficherEcran(location.hash.slice(1));
    majScoreDuel();
    majEntete();
    setInterval(majPaquets, 1000);

    chargerJeux()
        .then(() => {
            afficherBoostersSpeciaux(); // avec le nombre de jeux de chaque thème
            const ecran = location.hash.slice(1) || 'accueil';
            if (ecran === 'accueil') afficherAccueil();
            if (ecran === 'regles') afficherRegles();
            if (ecran === 'catalogue') afficherCatalogue();
            if (ecran === 'collection') afficherCollection();
        })
        .catch(e => {
            console.error(e);
            toast('Impossible de charger les jeux (lance le site via WAMP ou Live Server)', 'erreur');
        });
}

init();
