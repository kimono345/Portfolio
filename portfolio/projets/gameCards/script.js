'use strict';

/* =========================================================
   GameCards — chaque carte est un vrai jeu vidéo (données Steam)
   ========================================================= */

// ---------- Règles du jeu (valeurs de départ, à équilibrer) ----------

// Du plus rare au plus commun. Les Mythiques sont choisies à la main (MYTHIQUES) ; les autres jeux sont classés
// par score de prestige, puis répartis selon `quota` (nombre de jeux de la rareté, la Commune prend le reste).
// Chaque carte tire d'abord sa rareté selon une colonne de chances (en %), puis un jeu au hasard dans cette rareté :
//   `chance`          : les 4 premières cartes d'un booster
//   `chanceGarantie`  : la 5ᵉ carte, garantie Peu commune ou mieux, avec sa propre table pour ne pas
//                       servir de raccourci vers les hautes raretés
//   `chancePrestige`  : les 4 premières cartes d'un Prestige (Peu commune ou mieux)
//   `chancePrestigeGarantie` : la 5ᵉ carte d'un Prestige (Épique ou mieux)
//   `chanceDuel`      : les cartes tirées en duel (toi et l'ordinateur)
// Chaque colonne de chances doit faire 100 au total ; 0 interdit la rareté.
// `prix` : achat direct dans le catalogue, volontairement bien plus cher que la chance en boosters.
// `stats` : fourchette des stats de jeu de la rareté ; les vraies données placent la carte dans cette fourchette,
// Les fourchettes se chevauchent : une carte rare est en général plus forte, mais une excellente Légendaire
// peut dépasser une Mythique moyenne sur son point fort.
const RARETES = [
    { id: 'mythique',    nom: t('Mythique'),    quota: null, stats: [55, 100], chance: 0.1, chanceGarantie: 0.1, chancePrestige: 0.2,  chancePrestigeGarantie: 1,  chanceDuel: 3,  revente: 300, prix: 10000 },
    { id: 'legendaire',  nom: t('Légendaire'),  quota: 110,  stats: [45, 95],  chance: 0.5, chanceGarantie: 0.9, chancePrestige: 1,    chancePrestigeGarantie: 5,  chanceDuel: 7,  revente: 100, prix: 4000 },
    { id: 'epique',      nom: t('Épique'),      quota: 600,  stats: [35, 90],  chance: 2, chanceGarantie: 12,  chancePrestige: 6,    chancePrestigeGarantie: 94, chanceDuel: 12, revente: 40,  prix: 1500 },
    { id: 'rare',        nom: t('Rare'),        quota: 1500, stats: [25, 85],  chance: 6, chanceGarantie: 30,  chancePrestige: 22.8, chancePrestigeGarantie: 0,  chanceDuel: 18, revente: 15,  prix: 600 },
    { id: 'peu-commune', nom: t('Peu commune'), quota: 3000, stats: [15, 80],  chance: 18, chanceGarantie: 57,  chancePrestige: 70,   chancePrestigeGarantie: 0,  chanceDuel: 25, revente: 5,   prix: 250 },
    { id: 'commune',     nom: t('Commune'),     quota: null, stats: [5, 75],   chance: 73.4, chanceGarantie: 0,   chancePrestige: 0,    chancePrestigeGarantie: 0,  chanceDuel: 35, revente: 2,   prix: 100 },
];
const CHANCE_HOLO_PRESTIGE = 0.08; // contre 2 % dans un booster normal

// Full Art : variante des Légendaires et Mythiques (illustration sur toute la carte). Jamais holo en même temps.
const CHANCE_FULL_ART = 0.05;
const CHANCE_FULL_ART_GOD_PACK = 0.30;
const MULTIPLICATEUR_FULL_ART = 5; // revente

// EX : version des jeux adorés des joueurs mais peu connus (Rare ou en dessous). Sa Qualité est calculée
// comme une rareté au-dessus. Jamais holo ni Full Art en même temps.
const SEUIL_EX_NOTE = 93;   // % d'avis positifs
const SEUIL_EX_AVIS = 1000; // vrais avis Steam (pas estimés)
const CHANCE_EX = 0.05;     // quand un jeu éligible est tiré
const MULTIPLICATEUR_EX = 4; // revente

const INDEX_RARE = RARETES.findIndex(r => r.id === 'rare');
const INDEX_EPIQUE = RARETES.findIndex(r => r.id === 'epique');
const INDEX_LEGENDAIRE = RARETES.findIndex(r => r.id === 'legendaire');
const INDEX_MYTHIQUE = RARETES.findIndex(r => r.id === 'mythique');

// God pack : un booster sur 2 000 ne contient que des Légendaires et Mythiques, souvent holo
const CHANCE_GOD_PACK = 1 / 2000;
const CHANCE_HOLO_GOD_PACK = 0.25; // contre 2 % (CHANCE_HOLO) dans un booster normal
const PART_MYTHIQUE_GOD_PACK = 0.25; // en plus de la Mythique garantie

// Compteur de malchance : après 50 boosters sans Légendaire ni Mythique, le suivant en garantit une
const MALCHANCE_MAX = 50;
// Plus ou moins : des pièces aux paliers de la série (5, 10, 20 bonnes réponses), puis toutes les 10 au-delà
const PALIERS_POM = { 5: 5, 10: 15, 20: 40 };
const GAIN_POM_AU_DELA = 40;

const CARTES_PAR_BOOSTER = 5;
const BOOSTERS_PAR_LOT = 10; // ouverture ×10
const PRIX_BOOSTER = 0; //50

// Les deux boosters. Chacun se recharge gratuitement (`recharge` ms), avec une réserve de `stockMax` ;
// quand il n'en reste plus, on peut en acheter (`prix` pièces). `gain` : pièces gagnées à chaque ouverture.
// `paquet` : le paquet de l'accueil.
const TYPES_BOOSTER = {
    standard: { id: 'standard', nom: t('booster'), prix: PRIX_BOOSTER, gain: 5, recharge: 10 * 60 * 1000, stockMax: 10, paquet: '#paquet-gratuit' },
    prestige: { id: 'prestige', nom: 'Prestige', prix: 0, gain: 25, recharge: 24 * 60 * 60 * 1000, stockMax: 1, prestige: true, paquet: '#paquet-prestige' },
};
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
    22330: [2006, VGA], //900883: [2006, VGA], 2623190: [2006, VGA], // Oblivion 
    7670: [2007, VGA],                                      // BioShock
    12210: [2008, VGA],                                     // GTA IV
    2668510: [2010, VGA],                                   // Red Dead Redemption 
    489830: [2011, VGA], //72850: [2011, VGA], 611670: [2011, VGA], // Skyrim (original, Special Edition, VR)
    207610: [2012, VGA],                                    // The Walking Dead
    271590: [2013, VGA], //3240220: [2013, VGA],              // GTA V (Legacy, Enhanced)
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

// Les Mythiques : les jeux les plus cultes et connus, choisis à la main (identifiant Steam)
const MYTHIQUES = [
    271590,  // Grand Theft Auto V
    319510,  // Five Nights at Freddy's
    1174180, // Red Dead Redemption 2
    292030,  // The Witcher 3: Wild Hunt
    1086940, // Baldur's Gate 3
    1245620, // Elden Ring
    105600,  // Terraria
    1903340, // Clair Obscur: Expedition 33
    730,     // Counter-Strike 2
    1091500, // Cyberpunk 2077
    220,     // Half-Life 2
    620,     // Portal 2
    1593500, // God of War 
    391540,  // Undertale
    489830,  // The Elder Scrolls V: Skyrim Special Edition
    379720,  // DOOM
    4000,    // Garry's Mod
    254700,  // Resident Evil 4 (2005)
    10180,   // Call of Duty: Modern Warfare 2 (2009)
    33230,   // Assassin's Creed II
    39140,   // Final Fantasy VII
    1328670, // Mass Effect Legendary Edition
];

// Classiques cultes : leur notoriété dépasse leurs chiffres Steam (jeux anciens ou surtout joués sur console).
// Ils sont placés exactement dans cette rareté, en prenant une place du quota.
const CULTES_LEGENDAIRES = [
    12210,   // Grand Theft Auto IV (Mythique avant Terraria ; GTA V reste la Mythique de la série)
    632470,  // Disco Elysium
    753640,  // Outer Wilds
    546560,  // Half-Life: Alyx
    287700,  // Metal Gear Solid V: The Phantom Pain
    570940,  // Dark Souls Remastered
    22370,   // Fallout 3
    8870,    // BioShock Infinite
    1687950, // Persona 5 Royal
    524220,  // NieR:Automata
    20920,   // The Witcher 2
    205100,  // Dishonored
    504230,  // Celeste
    1057090, // Ori and the Will of the Wisps
    35140,   // Batman: Arkham Asylum
    200260,  // Batman: Arkham City
    813780,  // Age of Empires II: Definitive Edition
    500,     // Left 4 Dead
    219150,  // Hotline Miami
    304430,  // INSIDE
    1222140, // Detroit: Become Human
    638970,  // Yakuza 0
    601150,  // Devil May Cry 5
    782330,  // DOOM Eternal
    1551360, // Forza Horizon 5
    2215430, // Ghost of Tsushima
    1817070, // Marvel's Spider-Man Remastered
    2050650, // Resident Evil 4 (2023)
    22330,   // The Elder Scrolls IV: Oblivion (GOTY Edition)
    268910,  // Cuphead
    2357570, // Overwatch 2
    304240,  // Resident Evil (le premier)
    3764200, // Resident Evil Requiem
    620980,  // Beat Saber
    698780,  // Doki Doki Literature Club!
    1659040, // HITMAN World of Assassination
    438100,  // VRChat
    646570,  // Slay the Spire
    883710,  // Resident Evil 2
    2379780, // Balatro
    294100,  // RimWorld
];
// Jeux plafonnés à Épique : surtout des succès viraux (petit prix, portés par les streamers), populaires sur Steam mais pas « légendaires ».
// Ils ne dépassent jamais Épique, leurs places en Légendaire reviennent aux suivants.
const PLAFONNES_EPIQUE = [
    477160,  // Human: Fall Flat
    304930,  // Unturned
    1118200, // People Playground
    648800,  // Raft
    322170,  // Geometry Dash
    242760,  // The Forest
    1326470, // Sons Of The Forest
    3164500, // Schedule I
    3241660, // R.E.P.O.
    444090,  // Paladins
    291550,  // Brawlhalla
    284160,  // BeamNG.drive
    251570,  // 7 Days to Die
    990080,  // Hogwarts Legacy
    1063730, // New World: Aeternum
    960090,  // Bloons TD 6
    322330,  // Don't Starve Together
    700330,  // SCP: Secret Laboratory
    239030,  // Papers, Please
];
const CULTES_EPIQUES = [
    332800,  // Five Nights at Freddy's 2
    388090,  // Five Nights at Freddy's 4
    32360,   // The Secret of Monkey Island
    2060130, // Return to Monkey Island
    316790,  // Grim Fandango
    466300,  // Planescape: Torment
    13600,   // Prince of Persia : Les Sables du Temps
    211600,  // Thief Gold
    26800,   // Braid
    40800,   // Super Meat Boy
    239350,  // Spelunky
    590380,  // Into the Breach
    731490,  // Crash Bandicoot N. Sane Trilogy
    996580,  // Spyro Reignited Trilogy
    584400,  // Sonic Mania
    213610,  // Sonic Adventure 2
    6910,    // Deus Ex
    238010,  // Deus Ex: Human Revolution
    12140,   // Max Payne
    12150,   // Max Payne 2
    257350,  // Baldur's Gate II
    38400,   // Fallout
    38410,   // Fallout 2
    50,      // Half-Life: Opposing Force
    2310,    // Quake
    960910,  // Heavy Rain
    250320,  // The Wolf Among Us
    108710,  // Alan Wake
    1235140, // Yakuza: Like a Dragon
    460790,  // Bayonetta
    3830,    // Psychonauts
    1213210, // Command & Conquer Remastered
    221910,  // The Stanley Parable
    1693980, // Dead Space (2023)
    2252570, // Football Manager 2024
    1388880, // Doki Doki Literature Club Plus!
    521890,  // Hello Neighbor
    859570,  // Secret Neighbor
    1002300, // Fear & Hunger
    2171440, // Fear & Hunger 2: Termina
    382940,  // HITMAN (2016)
];

// Jeux connus placés à la main en Rare (leurs données Steam les classent trop bas)
const CULTES_RARES = [
    2239550, // Watch Dogs: Legion
    393080,  // Call of Duty: Modern Warfare Remastered (2017)
    2933620, // Call of Duty: Black Ops 6
];

// Ces jeux ne montent jamais au-dessus de Rare
const PLAFONNES_RARE = [
    2669320, // EA SPORTS FC 25
    3405690, // EA SPORTS FC 26
    2195250, // EA SPORTS FC 24
    924970,  // Back 4 Blood
];

// Stats réglées à la main, quand les données Steam ne reflètent pas le jeu
const STATS_FORCEES = {
    //2357570: { attaque: 75, popularite: 88 }, // Overwatch 2 : le CSV date d'avant sa sortie sur Steam
    72850: { attaque: 84 },                   // The Elder Scrolls V: Skyrim (2011)
    12210: { attaque: 93 },                   // GTA IV : note Steam plombée par le portage PC (98 sur Metacritic)
    319510: { attaque: 92, popularite: 96 },             // Five Nights at Freddy's : phénomène bien au-delà de ses avis Steam
    332800: { popularite: 88 },               // Five Nights at Freddy's 2 : porté par le phénomène FNAF
    388090: { popularite: 86 },               // Five Nights at Freddy's 4
    814380: { attaque: 93 },                  // Sekiro : GOTY 2019, ex-Mythique
    // Mythiques anciennes : leur notoriété dépasse leurs avis Steam (surtout joués sur console)
    33230: { popularite: 96 },                // Assassin's Creed II
    10180: { popularite: 94 },                // Call of Duty: Modern Warfare 2 (2009)
    39140: { popularite: 92 },                // Final Fantasy VII
    1328670: { attaque: 95 },                  // mass effect
    304240: { popularite: 92 },               // Resident Evil (1996) : le fondateur du survival horror
};

// Score de prestige des autres jeux : 85 % popularité + 15 % qualité + bonus
//   popularité = 75 % avis Steam (1 → 0, 1 million → 100) + 25 % joueurs estimés (1 → 0, 100 millions → 100)
//   qualité    = note public (corrigée pour les jeux à peu d'avis), moyennée avec Metacritic quand il y en a une
const POIDS_POPULARITE = 0.85;
const PART_JOUEURS = 0.25;
const BONUS_PRESTIGE = { goty: 3, chefOeuvre: 2, adore: 1, malNote: -3 };
// Ces jeux ne descendent jamais sous Légendaire : les GOTY, et les géants (750 000 avis ou plus)
const AVIS_GEANT = 750000;
const MANCHES_GAGNANTES = 3;
const GAIN_DUEL = 10;
// Gains du jour, mode par mode : la 1re victoire compte triple, puis 100 % jusqu'à la 5e, 50 % jusqu'à la 15e, 10 % au-delà
const TAUX_GAINS = [{ jusqua: 1, taux: 3 }, { jusqua: 5, taux: 1 }, { jusqua: 15, taux: 0.5 }, { jusqua: Infinity, taux: 0.1 }];
const CARTES_PAR_PAGE = 60; // collection affichée par tranches
// Récompense de connexion : un cycle de 7 jours qui recommence ; manquer un jour fait repartir au jour 1
const RECOMPENSES_CONNEXION = [
    { pieces: 50 }, { boosters: 2 }, { pieces: 100 }, { boosters: 3 }, { prestiges: 1 }, { pieces: 200 }, { fullArt: true },
];
const URL_IMAGES = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';

// Icônes Bootstrap Icons (licence MIT) en SVG : rendu identique sur tous les appareils, contrairement aux emoji
const ICONES = {
    pouce: '<svg class="bi" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.956 1.745C7.021.81 7.908.087 8.864.325l.261.066c.463.116.874.456 1.012.965.22.816.533 2.511.062 4.51a10 10 0 0 1 .443-.051c.713-.065 1.669-.072 2.516.21.518.173.994.681 1.2 1.273.184.532.16 1.162-.234 1.733q.086.18.138.363c.077.27.113.567.113.856s-.036.586-.113.856c-.039.135-.09.273-.16.404.169.387.107.819-.003 1.148a3.2 3.2 0 0 1-.488.901c.054.152.076.312.076.465 0 .305-.089.625-.253.912C13.1 15.522 12.437 16 11.5 16H8c-.605 0-1.07-.081-1.466-.218a4.8 4.8 0 0 1-.97-.484l-.048-.03c-.504-.307-.999-.609-2.068-.722C2.682 14.464 2 13.846 2 13V9c0-.85.685-1.432 1.357-1.615.849-.232 1.574-.787 2.132-1.41.56-.627.914-1.28 1.039-1.639.199-.575.356-1.539.428-2.59z"/></svg>',
    medaille: '<svg class="bi" viewBox="0 0 16 16" aria-hidden="true"><path d="m8 0 1.669.864 1.858.282.842 1.68 1.337 1.32L13.4 6l.306 1.854-1.337 1.32-.842 1.68-1.858.282L8 12l-1.669-.864-1.858-.282-.842-1.68-1.337-1.32L2.6 6l-.306-1.854 1.337-1.32.842-1.68L6.331.864z"/><path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1z"/></svg>',
    trophee: '<svg class="bi" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5.5A.5.5 0 0 1 3 0h10a.5.5 0 0 1 .5.5q0 .807-.034 1.536a3 3 0 1 1-1.133 5.89c-.79 1.865-1.878 2.777-2.833 3.011v2.173l1.425.356c.194.048.377.135.537.255L13.3 15.1a.5.5 0 0 1-.3.9H3a.5.5 0 0 1-.3-.9l1.838-1.379c.16-.12.343-.207.537-.255L6.5 13.11v-2.173c-.955-.234-2.043-1.146-2.833-3.012a3 3 0 1 1-1.132-5.89A33 33 0 0 1 2.5.5m.099 2.54a2 2 0 0 0 .72 3.935c-.333-1.05-.588-2.346-.72-3.935m10.083 3.935a2 2 0 0 0 .72-3.935c-.133 1.59-.388 2.885-.72 3.935"/></svg>',
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

// Ordre d'affichage : l'Ancienneté, stat « joker » souvent plus basse, en dernier
const STATS = {
    attaque:    { nom: t('Qualité'),      icone: ICONES.pouce },
    popularite: { nom: t('Popularité'),   icone: '★' },
    anciennete: { nom: t('Ancienneté'),   icone: ICONES.sablier },
};

// ---------- Utilitaires ----------

const $ = sel => document.querySelector(sel);
const attendre = ms => new Promise(r => setTimeout(r, ms));
const auHasard = liste => liste[Math.floor(Math.random() * liste.length)];
const indexRarete = id => RARETES.findIndex(r => r.id === id);
const nombre = n => n.toLocaleString(LOCALE);
const PIECE = '<span class="piece" aria-hidden="true"></span>';

function echapper(texte) {
    return String(texte ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 7:05 sous une heure, 23:59:59 au-delà
function formatDuree(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const deux = n => String(n).padStart(2, '0');
    return s >= 3600
        ? `${Math.floor(s / 3600)}:${deux(Math.floor(s / 60) % 60)}:${deux(s % 60)}`
        : `${Math.floor(s / 60)}:${deux(s % 60)}`;
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
    charges: 'gameCards.charges',
    godPacks: 'gameCards.godPacks',
    stats: 'gameCards.stats',
    succes: 'gameCards.succes',
    succesRecuperes: 'gameCards.succesRecuperes',
    malchance: 'gameCards.malchance',
    reglages: 'gameCards.reglages',
    connexion: 'gameCards.connexion',
    gainsJour: 'gameCards.gainsJour',
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
    // Boosters gratuits en réserve, et début du chrono de la prochaine recharge.
    // Première partie : la réserve est déjà pleine (10 boosters et 1 Prestige).
    charges: {
        standard: { charges: TYPES_BOOSTER.standard.stockMax, depuis: Date.now() },
        prestige: { charges: TYPES_BOOSTER.prestige.stockMax, depuis: Date.now() },
        ...lire(CLES.charges, {}),
    },
    godPacks: lire(CLES.godPacks, { nombre: 0, premier: null }), // trophée : combien, et la date du premier
    stats: { boosters: 0, prestiges: 0, duelsGagnes: 0, duelsParfaits: 0, ventes: 0, recordPom: 0, decksGagnes: 0, decksHardcore: 0, ...lire(CLES.stats, {}) },
    succes: lire(CLES.succes, {}),        // { id du succès: date d'obtention }
    // { id du succès: date de récupération de la récompense }. Les anciennes sauvegardes avaient reçu
    // leurs récompenses tout de suite : leurs succès déjà obtenus comptent comme récupérés.
    succesRecuperes: lire(CLES.succesRecuperes, null) ?? { ...lire(CLES.succes, {}) },
    malchance: lire(CLES.malchance, 0),   // boosters ouverts depuis la dernière Légendaire ou Mythique
    reglages: { sons: false, ...lire(CLES.reglages, {}) },
    connexion: lire(CLES.connexion, { dernier: null, serie: 0 }), // dernier jour récupéré, et jours d'affilée
    gainsJour: lire(CLES.gainsJour, { jour: null }), // victoires payées aujourd'hui, mode par mode
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
// Stat Popularité d'une carte, gardée en mémoire sur le jeu (le tri du catalogue la demande pour 115 000 jeux)
const statPopularite = jeu => (jeu.statPopularite ??= STATS_FORCEES[jeu.id]?.popularite ?? statDeJeu(popularite(jeu.avis), jeu.rarete));
// Stat Qualité d'une carte, gardée en mémoire de la même façon (tri du catalogue)
const statQualite = jeu => (jeu.statQualite ??= STATS_FORCEES[jeu.id]?.attaque ?? statDeJeu(notePublic(jeu.note, jeu.avis), jeu.rarete, 50));

// Note public lissée : on fait comme si chaque jeu avait déjà 10 avis à la note moyenne (76 %).
// 1 avis à 100 % donne 78, mais 10 000 avis à 95 % gardent 95.
const NOTE_MOYENNE = 76;
const POIDS_MOYENNE = 10;
const notePublic = (note, avis) => Math.round((note * avis + NOTE_MOYENNE * POIDS_MOYENNE) / (avis + POIDS_MOYENNE));

// Ancienneté : moitié selon l'âge (année la plus ancienne → 100, la plus récente → 0),
// moitié selon le rang (plus ancien que X % du catalogue). Le rang seul tasserait tous les jeux
// d'avant 2012 vers 100, l'âge seul tasserait les jeux récents vers 0.
let ancienneteParAnnee = {};
let premiereAnnee = Infinity;

function calculerAnciennete() {
    const parAnnee = {};
    for (const jeu of tousLesJeux) if (jeu.annee) parAnnee[jeu.annee] = (parAnnee[jeu.annee] || 0) + 1;
    const annees = Object.keys(parAnnee).map(Number).sort((a, b) => a - b);
    const total = annees.reduce((n, a) => n + parAnnee[a], 0);
    const [plusAncienne, plusRecente] = [annees[0], annees.at(-1)];
    premiereAnnee = plusAncienne;
    let plusRecents = total;
    ancienneteParAnnee = {};
    for (const annee of annees) {
        plusRecents -= parAnnee[annee];
        const rang = plusRecents / total;
        const age = (plusRecente - annee) / (plusRecente - plusAncienne || 1);
        ancienneteParAnnee[annee] = Math.round((rang + age) * 50);
    }
}

const anciennete = annee => ancienneteParAnnee[annee] ?? (annee < premiereAnnee ? 100 : 0);
// Les rééditions lauréates d'un GOTY (GTA IV, Resident Evil 4, Skyrim SE…) comptent depuis l'année du prix,
// pas depuis la sortie de leur version Steam
// sauf les remakes, qui sont presque de nouveaux jeux
const REMAKES_GOTY = [2623190]; // Oblivion Remastered
// Rééditions dont l'ancienneté compte depuis la sortie du jeu d'origine, saisie à la main
const ANNEES_ORIGINALES = {
    304240: 1996, // Resident Evil (HD Remaster de 2015)
};
const anneeOriginale = jeu => ANNEES_ORIGINALES[jeu.id]
    ?? (GOTY[jeu.id] && !REMAKES_GOTY.includes(jeu.id) ? Math.min(GOTY[jeu.id][0], jeu.annee ?? Infinity) : jeu.annee);

const echelleLog = (valeur, max) => Math.max(0, Math.min(100, Math.log10(Math.max(1, valeur)) * 100 / Math.log10(max)));

// Nom simplifié pour reconnaître les éditions d'un même jeu (« GOTY Edition », « Remastered »…)
const nomDeBase = nom => nom.toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[®™:\-–]/g, ' ')
    .replace(/\b(game of the year|goty|definitive|complete|deluxe|remastered|enhanced|legacy|special|edition|vr)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Calcule le score de prestige de chaque jeu, puis sa rareté (jeu.rarete) et la raison (jeu.raisons)
function calculerRaretes() {
    const mythiques = new Set(MYTHIQUES);
    for (const jeu of tousLesJeux) {
        const note = notePublic(jeu.note, jeu.avis);
        const qualite = jeu.metacritic ? (note + jeu.metacritic) / 2 : note;
        // Jeux estimés (souvent sortis après la collecte) : leur tranche de joueurs n'est pas fiable, on ne garde que les avis
        const partJoueurs = jeu.estime ? 0 : PART_JOUEURS;
        const pop = (1 - partJoueurs) * echelleLog(jeu.avis, 1e6) + partJoueurs * echelleLog(jeu.joueurs, 1e8);
        jeu.raisons = [];
        let bonus = 0;
        const ajouter = (condition, points, raison) => {
            if (!condition) return;
            bonus += points;
            jeu.raisons.push(raison);
        };
        ajouter(GOTY[jeu.id], BONUS_PRESTIGE.goty, 'GOTY');
        ajouter(jeu.metacritic >= SEUIL_CHEF_OEUVRE, BONUS_PRESTIGE.chefOeuvre, t('chef-d’œuvre'));
        ajouter(note >= 95 && jeu.avis >= 1000, BONUS_PRESTIGE.adore, t('adoré des joueurs'));
        ajouter(jeu.note < 50 && jeu.avis >= 1000, BONUS_PRESTIGE.malNote, t('mal noté'));
        jeu.prestige = POIDS_POPULARITE * pop + (1 - POIDS_POPULARITE) * qualite + bonus;
    }

    // Les meilleurs scores remplissent les quotas, de Légendaire à Peu commune.
    // En Légendaire et Épique, une seule édition par jeu (les autres passent en dessous),
    // et les autres éditions d'une Mythique ne dépassent pas Épique.
    const basesMythiques = new Set(tousLesJeux.filter(j => mythiques.has(j.id)).map(j => nomDeBase(j.nom)));
    const classement = [...tousLesJeux].sort((a, b) => b.prestige - a.prestige);
    const pris = RARETES.map(() => 0);
    const vus = RARETES.map(() => new Set());
    const indexLibre = (j, depart) => {
        let i = depart;
        while (RARETES[i].quota && (pris[i] >= RARETES[i].quota || (i <= INDEX_EPIQUE && vus[i].has(j.base)))) i++;
        return i;
    };
    for (const jeu of tousLesJeux) jeu.base = nomDeBase(jeu.nom);

    // Classiques cultes : placés d'abord, ils prennent leur place dans le quota de leur rareté
    const cultes = new Map([
        ...CULTES_LEGENDAIRES.map(id => [id, INDEX_LEGENDAIRE]),
        ...CULTES_EPIQUES.map(id => [id, INDEX_EPIQUE]),
        ...CULTES_RARES.map(id => [id, INDEX_RARE]),
    ]);
    for (const jeu of tousLesJeux) {
        const i = cultes.get(jeu.id);
        if (i === undefined) continue;
        pris[i]++;
        vus[i].add(jeu.base);
        jeu.rarete = RARETES[i].id;
        jeu.raisons.unshift(t('classique culte'));
    }

    const plafonnes = new Set(PLAFONNES_EPIQUE);
    const plafonnesRare = new Set(PLAFONNES_RARE);
    for (const jeu of tousLesJeux) {
        if (plafonnes.has(jeu.id)) jeu.raisons.push(t('plafonné à Épique'));
        if (plafonnesRare.has(jeu.id)) jeu.raisons.push(t('plafonné à Rare'));
    }

    let rang = 0;
    for (const jeu of classement) {
        if (mythiques.has(jeu.id)) {
            jeu.rarete = 'mythique';
            continue;
        }
        jeu.rang = ++rang;
        if (cultes.has(jeu.id)) continue;
        const editionMythique = basesMythiques.has(jeu.base);
        const plafonneRare = plafonnesRare.has(jeu.id);
        const plafonne = plafonnes.has(jeu.id) || plafonneRare;
        let i = indexLibre(jeu, plafonneRare ? INDEX_RARE : editionMythique || plafonne ? INDEX_EPIQUE : INDEX_LEGENDAIRE);
        // GOTY et géants : au moins Légendaire, sauf si une autre édition du jeu y est déjà
        const garanti = (GOTY[jeu.id] || jeu.avis >= AVIS_GEANT) && !editionMythique && !plafonne && !vus[INDEX_LEGENDAIRE].has(jeu.base);
        if (garanti && i > INDEX_LEGENDAIRE) i = INDEX_LEGENDAIRE;
        pris[i]++;
        vus[i].add(jeu.base);
        jeu.rarete = RARETES[i].id;
    }
}

// Place une valeur réelle dans la fourchette de stats de la rareté.
// `bas` : valeur réelle qui correspond au bas de la fourchette (50 pour la Qualité : presque aucun jeu n'est noté
// sous 50 %, partir de 0 tasserait toutes les cartes vers le haut de leur fourchette).
function statDeJeu(valeur, rarete, bas = 0) {
    const [min, max] = RARETES[indexRarete(rarete)].stats;
    const position = Math.max(0, Math.min(1, (valeur - bas) / (100 - bas)));
    return Math.round(min + position * (max - min));
}

// Un jeu a une version EX s'il est adoré des joueurs (sur de vrais avis) mais classé Rare ou en dessous
const aUneVersionEX = jeu => Boolean(jeu) && !jeu.estime && jeu.note >= SEUIL_EX_NOTE && jeu.avis >= SEUIL_EX_AVIS
    && indexRarete(jeu.rarete) >= INDEX_RARE;

// `ex` : version EX, la Qualité est placée dans la fourchette de la rareté au-dessus
function creerCarte(jeu, { ex = false } = {}) {
    return {
        id: jeu.id,
        nom: jeu.nom,
        image: `${URL_IMAGES}/${jeu.id}/${jeu.image || 'header.jpg'}`,
        attaque: ex
            ? STATS_FORCEES[jeu.id]?.attaque ?? statDeJeu(notePublic(jeu.note, jeu.avis), RARETES[indexRarete(jeu.rarete) - 1].id, 50)
            : statQualite(jeu),
        ex,
        // Stat « joker » : la vraie ancienneté, sans lien avec la rareté (une vieille Commune peut battre une Mythique récente)
        anciennete: anciennete(anneeOriginale(jeu)),
        popularite: statPopularite(jeu),
        // Vraies données, affichées sur la fiche à côté des stats de jeu
        noteReelle: jeu.note,
        avis: jeu.avis,
        metacritic: jeu.metacritic,
        rarete: jeu.rarete,
        annee: jeu.annee,
        genres: jeu.genres,
        tags: jeu.tags,
    };
}

// `cachee` masque les stats, et ce qui les trahirait (année, chef-d'œuvre) : carte adverse en duel
// Jaquette verticale Steam (600 × 900) pour les Full Art ; à défaut, l'image horizontale
const imagePortrait = carte => `${URL_IMAGES}/${carte.id}/library_600x900.jpg`;

// Image de secours, sous l'image Steam : visible pendant le chargement, et si l'image n'existe pas.
// Une couleur propre à chaque jeu, ses initiales en grand et son nom.
function imageSecoursHTML(carte) {
    const mots = carte.nom.replace(/[^\p{L}\p{N} ]/gu, ' ').split(' ').filter(Boolean);
    const initiales = mots.slice(0, 2).map(mot => mot[0]).join('').toUpperCase() || '?';
    return `<div class="image-secours" style="--teinte: ${(carte.id * 47) % 360}" aria-hidden="true">
                        <span class="secours-initiales">${echapper(initiales)}</span><span class="secours-nom">${echapper(carte.nom)}</span>
                    </div>`;
}

function carteHTML(carte, { holo = false, compteur = 0, cachee = false, fullArt = (carte.fullArts || 0) > 0, ex = Boolean(carte.ex) } = {}) {
    if (fullArt) holo = false;
    const rarete = RARETES[indexRarete(carte.rarete)];
    // Sur la carte adverse du duel, l'année trahirait l'Ancienneté : on la cache aussi
    const infos = [cachee ? null : carte.annee, carte.genres[0]].filter(Boolean).join(' · ');
    const chef = !cachee && carte.metacritic >= SEUIL_CHEF_OEUVRE;
    const goty = gotyDe(carte.id);
    const plaque = chef ? `<span class="plaque-chef" title="${t('Metacritic : {n} / 100', { n: carte.metacritic })}">${ICONES.medaille}<span>${t('Chef-d’œuvre')}</span></span>` : '';
    const texte = `
                <div class="carte-titre">
                    <h3 class="carte-nom">${echapper(carte.nom)}</h3>
                    ${ex ? '<span class="badge-ex">EX</span>' : ''}
                </div>
                <p class="carte-infos">${echapper(infos) || '&nbsp;'}</p>
                <ul class="carte-stats">
                    ${Object.entries(STATS).map(([cle, stat]) => fullArt
                        // Full Art : juste l'icône et le chiffre, pour laisser la place à l'illustration
                        ? `
                        <li data-stat="${cle}" title="${stat.nom}"><span>${stat.icone}</span><b>${cachee ? '?' : carte[cle]}</b></li>`
                        : `
                        <li data-stat="${cle}">
                            <span>${stat.icone} ${stat.nom}</span><b>${cachee ? '?' : carte[cle]}</b>
                            <i style="--v:${cachee ? 0 : Math.min(100, carte[cle])}%"></i>
                        </li>`).join('')}
                </ul>`;
    const secours = echapper(carte.image);
    return `
        <article class="carte rarete-${rarete.id}${holo ? ' holo' : ''}${cachee ? ' stats-cachees' : ''}${chef ? ' chef-oeuvre' : ''}${goty ? ' goty' : ''}${fullArt ? ' full-art' : ''}${ex ? ' ex' : ''}">
            <div class="carte-corps">
                ${fullArt ? `<div class="full-art-fond" style="--secours: url('${secours}')" aria-hidden="true">${imageSecoursHTML(carte)}<img src="${imagePortrait(carte)}" alt="" loading="lazy"
                    onerror="if (this.dataset.repli) { this.parentNode.classList.remove('paysage'); this.remove(); } else { this.dataset.repli = 1; this.src = '${secours}'; this.parentNode.classList.add('paysage'); }"></div>` : ''}
                ${goty ? `<span class="ruban-goty" title="${t('Jeu de l’année {annee}', { annee: goty.annee })} · ${goty.ceremonie}"><span>${BRIN_LAURIER}GOTY ${goty.annee}${BRIN_LAURIER}</span></span>` : ''}
                ${goty && !fullArt ? `<span class="filigrane-goty" aria-hidden="true">${LAURIER}</span>` : ''}
                <header class="carte-haut">
                    <span class="carte-rarete">${rarete.nom}${fullArt ? ' · Full Art' : holo ? ' · Holo' : ''}</span>
                    ${compteur > 1 ? `<span class="carte-compteur">×${compteur}</span>` : ''}
                </header>
                ${fullArt
                    ? `<div class="carte-bas">${plaque}${texte}</div>`
                    : `<div class="carte-image">
                    ${imageSecoursHTML(carte)}
                    ${carte.image ? `<img src="${secours}" alt="" loading="lazy" onerror="this.remove()">` : ''}
                    ${plaque}
                </div>${texte}`}
            </div>
        </article>`;
}

// Carte retournable (dos / face), pour les boosters et le duel
function flipHTML(carte, { holo = false, fullArt = false, retournee = false, nouvelle = false, cachee = false, godPack = false } = {}) {
    return `
        <div class="flip${retournee ? ' retournee' : ''}${godPack ? ' dos-divin' : ''}" data-rarete="${carte.rarete}" data-id="${carte.id}">
            <div class="flip-inner">
                <div class="flip-face">
                    ${carteHTML(carte, { holo, fullArt, cachee })}
                    ${nouvelle ? `<span class="badge-nouvelle">${t('Nouvelle !')}</span>` : ''}
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
    return (boutons ? puce('', t('Toutes'), entrees.length, totaux ? totalJeux() : 0) : '')
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
    return `<option value="">${t('Tous les genres et thèmes')}</option>`
        + groupe(t('Distinctions'), Object.keys(DISTINCTIONS))
        + groupe(t('Genres'), genresCatalogue)
        + Object.entries(groupesTags).map(([titre, liste]) => groupe(titre, liste)).join('');
}

// Distinctions : valeurs spéciales du filtre, calculées plutôt que stockées
const DISTINCTIONS = {
    [t('GOTY (jeu de l’année)')]: carte => Boolean(GOTY[carte.id]),
    [t('Chef-d’œuvre (Metacritic 90+)')]: carte => carte.metacritic >= SEUIL_CHEF_OEUVRE,
};
const distinctionsDe = carte => Object.keys(DISTINCTIONS).filter(nom => DISTINCTIONS[nom](carte));

const aLeGenre = (carte, valeur) => DISTINCTIONS[valeur]
    ? DISTINCTIONS[valeur](carte)
    : carte.genres.includes(valeur) || (carte.tags || []).includes(valeur);

// ---------- Données ----------

async function chargerJeux() {
    const reponse = await fetch('data/jeux.json?v=14');
    if (!reponse.ok) throw new Error(`data/jeux.json introuvable (${reponse.status})`);
    // Format compact (voir outils/convertir-csv.js) : un tableau par jeu, genres et thèmes codés en caractères
    const { genres: genresFr, tags: tagsFr, jeux, groupesTags: groupesFr, estimes = [] } = await reponse.json();
    // Noms des genres et thèmes dans la langue choisie
    const genres = genresFr.map(g => t(g));
    const tags = tagsFr.map(g => t(g));
    const groupes = Object.fromEntries(Object.entries(groupesFr).map(([nom, liste]) => [t(nom), liste.map(g => t(g))]));
    const decoder = (codes, liste) => [...codes].map(c => liste[ALPHABET_CODES.indexOf(c)]);
    for (const r of RARETES) jeuxParRarete[r.id] = [];
    tousLesJeux = jeux.map(([id, nom, annee, avis, note, metacritic, joueurs, codesGenres, codesTags, image]) =>
        ({ id, nom, annee, avis, note, metacritic, joueurs, genres: decoder(codesGenres, genres), tags: decoder(codesTags, tags), image }));
    groupesTags = groupes;
    // Jeux sans avis dans le dataset : avis et note estimés, signalé sur leur fiche
    const ensembleEstimes = new Set(estimes);
    for (const jeu of tousLesJeux) jeu.estime = ensembleEstimes.has(jeu.id);
    calculerRaretes();
    for (const jeu of tousLesJeux) jeuxParRarete[jeu.rarete].push(jeu);
    jeuxParId = new Map(tousLesJeux.map(jeu => [jeu.id, jeu]));
    calculerAnciennete();
    genresCatalogue = genres;
    majCollectionDepuisDonnees();
}

// Les cartes déjà obtenues gardent une copie de leurs stats : on les recalcule
// pour qu'elles suivent les règles actuelles (exemplaires, holos et date sont conservés)
function majCollectionDepuisDonnees() {
    for (const entree of Object.values(etat.collection)) {
        const jeu = jeuxParId.get(entree.id);
        if (!jeu) continue;
        Object.assign(entree, creerCarte(jeu, { ex: entree.exs > 0 }));
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

// Pioche un jeu au hasard dans la rareté demandée, tous avec la même chance (sans doublon dans `exclus`)
function piocher(index, exclus = new Set()) {
    const bac = jeuxParRarete[RARETES[index].id];
    let jeu = auHasard(bac);
    for (let essai = 0; essai < 20 && exclus.has(jeu.id); essai++) jeu = auHasard(bac);
    return creerCarte(jeu);
}

// ---------- Collection et monnaie ----------

function ajouterACollection(carte, holo, fullArt = false, ex = false) {
    const entree = etat.collection[carte.id];
    if (entree) {
        entree.exemplaires++;
        if (holo) entree.holos++;
        if (fullArt) entree.fullArts = (entree.fullArts || 0) + 1;
        if (ex) {
            entree.exs = (entree.exs || 0) + 1;
            Object.assign(entree, carte); // la carte prend les stats de sa version EX
        }
        return false;
    }
    etat.collection[carte.id] = { ...carte, exemplaires: 1, holos: holo ? 1 : 0, fullArts: fullArt ? 1 : 0, exs: ex ? 1 : 0, obtenue: Date.now() };
    return true;
}

// Ordre de revente : d'abord les exemplaires normaux, puis les holos, les EX, et le Full Art en dernier (gardé en priorité)
function prochaineVente(entree) {
    const { normale, holo, ex } = exemplairesParVariante(entree);
    if (normale > 0) return 'normale';
    if (holo > 0) return 'holo';
    return ex > 0 ? 'ex' : 'fullArt';
}

const VARIANTES = {
    normale: { nom: t('Normale'), multiplicateur: 1 },
    holo: { nom: 'Holo', multiplicateur: MULTIPLICATEUR_HOLO },
    ex: { nom: 'EX', multiplicateur: MULTIPLICATEUR_EX },
    fullArt: { nom: 'Full Art', multiplicateur: MULTIPLICATEUR_FULL_ART },
};

// Nombre d'exemplaires de chaque variante possédés
function exemplairesParVariante(entree) {
    const fullArt = entree.fullArts || 0;
    const ex = entree.exs || 0;
    return { normale: entree.exemplaires - entree.holos - ex - fullArt, holo: entree.holos, ex, fullArt };
}

const prixVariante = (entree, variante) => RARETES[indexRarete(entree.rarete)].revente * VARIANTES[variante].multiplicateur;
const prixRevente = entree => prixVariante(entree, prochaineVente(entree));

// Vend un exemplaire de la variante choisie ; le dernier exemplaire fait sortir la carte de la collection
function vendreExemplaire(id, variante) {
    const entree = etat.collection[id];
    if (!entree || exemplairesParVariante(entree)[variante] < 1) return 0;
    const prix = prixVariante(entree, variante);
    if (variante === 'holo') entree.holos--;
    if (variante === 'fullArt') entree.fullArts--;
    if (variante === 'ex') {
        entree.exs--;
        // Plus aucun exemplaire EX : la carte reprend ses stats normales
        const jeu = jeuxParId.get(id);
        if (!entree.exs && jeu) Object.assign(entree, creerCarte(jeu));
    }
    if (--entree.exemplaires === 0) delete etat.collection[id];
    etat.pieces += prix;
    etat.stats.ventes++;
    return prix;
}

// Revente groupée : on garde toujours un exemplaire
function vendreDoublon(id) {
    const entree = etat.collection[id];
    if (!entree || entree.exemplaires < 2) return 0;
    return vendreExemplaire(id, prochaineVente(entree));
}

// Valeur de tous les doublons : on simule les ventes sur une copie
function valeurDoublons(entree) {
    const copie = { ...entree, fullArts: entree.fullArts || 0, exs: entree.exs || 0 };
    let total = 0;
    while (copie.exemplaires > 1) {
        total += prixRevente(copie);
        const vendue = prochaineVente(copie);
        if (vendue === 'holo') copie.holos--;
        if (vendue === 'fullArt') copie.fullArts--;
        if (vendue === 'ex') copie.exs--;
        copie.exemplaires--;
    }
    return total;
}

// ---------- En-tête et paquets ----------

let ouvertureEnCours = false;

// ---------- Recharges des boosters gratuits ----------
// Un booster gratuit arrive toutes les `recharge` ms, jusqu'à `stockMax` en réserve.
// Réserve pleine : le chrono attend, il ne repart qu'une fois un booster ouvert.
function majCharges(type) {
    const reserve = etat.charges[type.id];
    if (reserve.charges >= type.stockMax) {
        reserve.depuis = Date.now();
        return;
    }
    const gagnees = Math.floor((Date.now() - reserve.depuis) / type.recharge);
    if (gagnees <= 0) return;
    reserve.charges = Math.min(type.stockMax, reserve.charges + gagnees);
    reserve.depuis = reserve.charges >= type.stockMax ? Date.now() : reserve.depuis + gagnees * type.recharge;
    sauvegarder();
}

function chargesDispo(type) {
    majCharges(type);
    return etat.charges[type.id].charges;
}

// Temps avant le prochain booster gratuit (0 si la réserve est pleine)
function avantRecharge(type) {
    majCharges(type);
    const reserve = etat.charges[type.id];
    return reserve.charges >= type.stockMax ? 0 : reserve.depuis + type.recharge - Date.now();
}

function consommerCharges(type, nombre) {
    majCharges(type);
    etat.charges[type.id].charges -= nombre;
}

function majEntete() {
    $('#solde').textContent = nombre(etat.pieces);
    majPaquets();
}

// Appelée chaque seconde : réserve et minuteur de chaque paquet, boutons de l'écran de bilan
function majPaquets() {
    for (const type of Object.values(TYPES_BOOSTER)) {
        const charges = chargesDispo(type);
        const reste = avantRecharge(type);
        const paquet = $(type.paquet);
        paquet.classList.toggle('verrouille', charges === 0);
        paquet.setAttribute('aria-label', charges
            ? tn(charges, 'Ouvrir un {type} gratuit ({n} disponible)', 'Ouvrir un {type} gratuit ({n} disponibles)', { type: type.nom })
            : t('Plus de {type} gratuit, prochain dans {duree}. Cliquer pour en acheter', { type: type.nom, duree: formatDuree(reste) }));
        $(`#compte-${type.id}`).textContent = formatDuree(reste);
        $(`#charges-${type.id}`).hidden = charges === 0;
        $(`#charges-${type.id}`).textContent = `×${charges}`;
        $(`#legende-${type.id}`).innerHTML = charges
            ? `<b>${charges} / ${type.stockMax}</b> ${type.stockMax > 1 ? t('gratuits') : t('gratuit')} · ${reste ? t('prochain dans {duree}', { duree: formatDuree(reste) }) : t('réserve pleine')}`
            : t('Prochain gratuit dans {duree}<br>Clique pour en acheter', { duree: formatDuree(reste) });
    }

    // Ouvrir d'un coup toute la réserve de boosters gratuits
    const reserve = chargesDispo(TYPES_BOOSTER.standard);
    $('#btn-tout-ouvrir').hidden = reserve < 2;
    $('#btn-tout-ouvrir').textContent = t('Ouvrir les {n} boosters gratuits', { n: reserve });

    $('#lien-accueil').classList.toggle('pret', Object.values(TYPES_BOOSTER).some(type => chargesDispo(type) > 0));
}

// Clic sur un paquet de l'accueil : on ouvre un gratuit s'il en reste, sinon on propose d'en acheter
function cliquerPaquet(type) {
    if (chargesDispo(type) > 0) ouvrirBooster('gratuit', 1, type);
    else proposerAchat(type);
}

function proposerAchat(type) {
    const prixLot = type.prix * BOOSTERS_PAR_LOT;
    $('#modale-contenu').innerHTML = `
        <div class="achat">
            <h2>${t('Plus de {type} gratuit', { type: type.nom })}</h2>
            <p>${t('Le prochain arrive dans <b>{duree}</b>. En attendant, tu peux en acheter :', { duree: formatDuree(avantRecharge(type)) })}</p>
            <div class="achat-options">
                <button class="btn btn-principal btn-grand" data-acheter-booster="${type.id}" data-nombre="1"${etat.pieces < type.prix ? ' disabled' : ''}>
                    ${t('Acheter 1 {type}', { type: type.nom })} · ${nombre(type.prix)} ${PIECE}</button>
                <button class="btn btn-or btn-grand" data-acheter-booster="${type.id}" data-nombre="${BOOSTERS_PAR_LOT}"${etat.pieces < prixLot ? ' disabled' : ''}>
                    ${t('Ouvrir')} ×${BOOSTERS_PAR_LOT} · ${nombre(prixLot)} ${PIECE}</button>
            </div>
            <p class="achat-solde">${t('Tu as')} ${nombre(etat.pieces)} ${PIECE}${etat.pieces < type.prix ? t(' : revends des doublons ou gagne des duels pour en avoir plus.') : ''}</p>
        </div>`;
    if (!$('#modale').open) $('#modale').showModal();
}

// ---------- Ouverture de boosters ----------

// Commande de test, à taper dans la console : le prochain booster sera un god pack
let prochainGodPack = false;
window.forcerGodPack = () => {
    prochainGodPack = true;
    return 'Le prochain booster ouvert sera un god pack ✨';
};

// Holo, Full Art ou EX pour une carte tirée (elles ne se cumulent pas)
function variante(carte, chanceHolo, chanceFullArt) {
    const fullArt = indexRarete(carte.rarete) <= INDEX_LEGENDAIRE && Math.random() < chanceFullArt;
    const jeu = jeuxParId.get(carte.id);
    const ex = !fullArt && aUneVersionEX(jeu) && Math.random() < CHANCE_EX;
    return { carte: ex ? creerCarte(jeu, { ex }) : carte, fullArt, ex, holo: !fullArt && !ex && Math.random() < chanceHolo };
}

// God pack : une Mythique garantie, puis des Légendaires (et parfois d'autres Mythiques), une chance sur 4 d'être holo
function tirerGodPack() {
    const exclus = new Set();
    return Array.from({ length: CARTES_PAR_BOOSTER }, (_, i) => {
        const index = i === 0 || Math.random() < PART_MYTHIQUE_GOD_PACK ? INDEX_MYTHIQUE : INDEX_LEGENDAIRE;
        const carte = piocher(index, exclus);
        exclus.add(carte.id);
        return { ...variante(carte, CHANCE_HOLO_GOD_PACK, CHANCE_FULL_ART_GOD_PACK), godPack: true };
    });
}

// Les 5 cartes d'un booster : 4 au hasard + une 5ᵉ garantie (ou, très rarement, un god pack)
function tirerBooster(type, legendaireGarantie = false) {
    if (prochainGodPack || Math.random() < CHANCE_GOD_PACK) {
        prochainGodPack = false;
        return tirerGodPack();
    }
    const [cleChance, cleGarantie] = type.prestige ? ['chancePrestige', 'chancePrestigeGarantie'] : ['chance', 'chanceGarantie'];
    const chanceHolo = type.prestige ? CHANCE_HOLO_PRESTIGE : CHANCE_HOLO;
    const indices = Array.from({ length: CARTES_PAR_BOOSTER - 1 }, () => tirerRarete(cleChance));
    // Compteur de malchance atteint : la dernière carte est Légendaire ou mieux
    indices.push(legendaireGarantie
        ? tirerRarete('chance', RARETES.slice(0, INDEX_LEGENDAIRE + 1))
        : tirerRarete(cleGarantie));
    const exclus = new Set();
    return indices.map(index => {
        const carte = piocher(index, exclus);
        exclus.add(carte.id);
        return variante(carte, chanceHolo, CHANCE_FULL_ART);
    });
}

// `mode` : 'gratuit' (pris dans la réserve) ou 'achat' (payé en pièces)
async function ouvrirBooster(mode, nombreBoosters = 1, type = TYPES_BOOSTER.standard) {
    if (ouvertureEnCours || !donneesPretes()) return;
    const prix = type.prix * nombreBoosters;
    if (mode === 'gratuit' && chargesDispo(type) < nombreBoosters) return proposerAchat(type);
    if (mode === 'achat' && etat.pieces < prix) {
        return toast(t('Il te manque {n} pièces. Revends des doublons ou gagne un duel !', { n: nombre(prix - etat.pieces) }));
    }
    ouvertureEnCours = true;

    const boosters = [];
    for (let i = 0; i < nombreBoosters; i++) {
        const booster = tirerBooster(type, etat.malchance >= MALCHANCE_MAX - 1);
        const hauteRarete = booster.some(t => indexRarete(t.carte.rarete) <= INDEX_LEGENDAIRE);
        etat.malchance = hauteRarete ? 0 : etat.malchance + 1;
        boosters.push(booster);
    }
    etat.stats.boosters += nombreBoosters;
    if (type.prestige) etat.stats.prestiges += nombreBoosters;
    const tirage = boosters.flat();
    const godPacks = tirage.filter(t => t.godPack).length / CARTES_PAR_BOOSTER;
    if (mode === 'gratuit') consommerCharges(type, nombreBoosters);
    else etat.pieces -= prix;
    // Chaque booster ouvert rapporte des pièces
    dernierGain = type.gain * nombreBoosters;
    etat.pieces += dernierGain;
    if (godPacks) {
        etat.godPacks.nombre += godPacks;
        etat.godPacks.premier ??= Date.now();
    }
    for (const t of tirage) t.nouvelle = ajouterACollection(t.carte, t.holo, t.fullArt, t.ex);
    sauvegarder();
    majEntete();

    $('#choix').hidden = true;
    $('#ouverture').hidden = false;
    $('#ouverture').classList.toggle('multiple', nombreBoosters > 1);
    $('#tirage').innerHTML = '';
    for (const id of ['#bilan', '#btn-retour', '#btn-voir-collection']) $(id).hidden = true;
    $('#btn-passer').textContent = nombreBoosters > 1 ? t('Tout passer') : t('Passer');
    $('#btn-passer').hidden = false;
    $('#ouverture-aide').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Chaque paquet : on le déchire, puis on fait défiler sa pile, la carte la plus rare en dernier
    const modele = $(type.paquet);
    seance.passer = false;
    for (let i = 0; i < boosters.length && !seance.passer; i++) {
        const cartes = [...boosters[i]].sort((a, b) => indexRarete(b.carte.rarete) - indexRarete(a.carte.rarete));
        const rang = nombreBoosters > 1 ? `${t('Paquet {i} / {n}', { i: i + 1, n: nombreBoosters })} · ` : '';
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
let dernierGain = 0; // pièces gagnées par la dernière ouverture

// Mise en scène du god pack : le paquet devient doré et tremble, flash, pluie d'étincelles, titre géant
async function revelationGodPack(paquet) {
    paquet.classList.add('divin');
    jouerSon('godpack');
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
        $('#trophee-godpack').innerHTML = `✨ ${tn(nombre, '<b>{n}</b> god pack ouvert', '<b>{n}</b> god packs ouverts')}
            <span>· ${t('le premier le {date}', { date: new Date(premier).toLocaleDateString(LOCALE) })}</span>`;
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
    paquet.classList.remove('verrouille');
    paquet.querySelector('.paquet-charges')?.remove();
    paquet.classList.add('paquet-seul');
    paquet.querySelector('.paquet-verrou')?.remove();
    paquet.setAttribute('aria-label', t('Ouvrir le paquet'));
    // Indication du geste : un point lumineux qui glisse le long de la ligne de découpe
    paquet.insertAdjacentHTML('beforeend', '<span class="geste-dechirer" aria-hidden="true"><i></i></span>');
    return paquet;
}

// Part de la largeur du paquet à parcourir le long du haut pour le déchirer
const DECHIRURE_COMPLETE = 0.7;

// Attend un vrai geste de déchirure : attraper le haut du paquet et glisser le long, de gauche à droite
// ou de droite à gauche. Le bandeau se soulève au fil du geste ; lâché trop tôt, il retombe.
// Un simple clic ne suffit pas (il rappelle le geste). Le clavier (Espace, Entrée) reste possible.
async function dechirerPaquet(modele, divin, rang) {
    const paquet = clonerPaquet(modele);
    $('#ouverture-scene').replaceChildren(paquet);
    const consigne = `${rang}${t('Attrape le haut du paquet et glisse le long pour le déchirer')}`;
    $('#ouverture-aide').innerHTML = consigne;

    // Petite secousse du bandeau et consigne mise en avant : rappelle le geste attendu
    const rappelerGeste = () => {
        paquet.classList.remove('indice');
        void paquet.offsetWidth; // relance l'animation
        paquet.classList.add('indice');
        $('#ouverture-aide').innerHTML = `<b>${consigne}</b>`;
    };

    let sens = 1;
    await new Promise(resolve => {
        let depart = null;
        seance.reprendre = resolve;
        paquet.addEventListener('pointerdown', e => {
            const cadre = paquet.getBoundingClientRect();
            // Il faut attraper le haut du paquet (le tiers supérieur, pour rester facile au doigt)
            if (e.clientY - cadre.top > cadre.height * 0.3) return rappelerGeste();
            depart = e.clientX;
            paquet.setPointerCapture(e.pointerId);
            paquet.classList.add('en-dechirure');
        });
        paquet.addEventListener('pointermove', e => {
            if (depart === null) return;
            const dx = e.clientX - depart;
            sens = dx < 0 ? -1 : 1;
            const progres = Math.min(1, Math.abs(dx) / (paquet.getBoundingClientRect().width * DECHIRURE_COMPLETE));
            paquet.style.setProperty('--sens', sens);
            paquet.style.setProperty('--dechirure', progres.toFixed(3));
            if (progres >= 1) {
                depart = null;
                resolve();
            }
        });
        const lacher = () => {
            if (depart === null) return;
            depart = null;
            paquet.classList.remove('en-dechirure');
            paquet.style.setProperty('--dechirure', 0);
            rappelerGeste();
        };
        paquet.addEventListener('pointerup', lacher);
        paquet.addEventListener('pointercancel', lacher);
    });
    seance.reprendre = null;
    if (seance.passer) return;

    paquet.classList.remove('en-dechirure', 'indice');
    paquet.style.setProperty('--sens', sens);
    jouerSon('dechirure');
    if (divin) await revelationGodPack(paquet);
    paquet.classList.remove('divin');
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
    pile.innerHTML = cartes.map((tiree, i) => `
        <div class="pile-carte" style="z-index: ${cartes.length - i}">
            ${carteHTML(tiree.carte, { holo: tiree.holo, fullArt: tiree.fullArt })}
            ${tiree.nouvelle ? `<span class="badge-nouvelle">${t('Nouvelle !')}</span>` : ''}
        </div>`).join('');
    $('#ouverture-scene').replaceChildren(pile);
    const elements = [...pile.children];

    for (let i = 0; i < elements.length && !seance.passer; i++) {
        elements.forEach((element, k) => element.style.setProperty('--rang', k - i));
        const dessus = elements[i];
        if (indexRarete(cartes[i].carte.rarete) <= INDEX_LEGENDAIRE || cartes[i].ex) dessus.classList.add(cartes[i].fullArt ? 'apparition-full-art' : 'apparition-rare');
        jouerSonRarete(cartes[i].ex ? 'epique' : cartes[i].carte.rarete);

        // Si la carte suivante est Épique ou mieux, la pile brille de sa couleur : suspense
        const suivante = cartes[i + 1];
        const annonce = suivante && indexRarete(suivante.carte.rarete) <= INDEX_EPIQUE;
        pile.className = `pile${cartes[0].godPack ? ' pile-divine' : ''}${annonce ? ` annonce rarete-${suivante.carte.rarete}` : ''}`;
        $('#ouverture-aide').innerHTML = `${rang}${t('Carte <b>{i} / {n}</b> · glisse-la pour voir la suivante', { i: i + 1, n: cartes.length })}`;

        const sens = await glisserCarte(dessus);
        seance.reprendre = null;
        if (seance.passer) return;
        dessus.style.setProperty('--sens', sens);
        dessus.classList.add('envolee');
        jouerSon('carte');
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
                <h2 class="tirage-titre titre-divin">✨ God pack ✨ <span>${t('{n} cartes divines', { n: divines.length })}</span></h2>
                <div class="tirage-grille tirage-vedettes">${divines.map(visible).join('')}</div>` : ''}
            ${vedettes.length ? `
                <h2 class="tirage-titre">${t('Tes meilleures cartes')} <span>${t('Rare et plus')} · ${vedettes.length}</span></h2>
                <div class="tirage-grille tirage-vedettes">${vedettes.map(visible).join('')}</div>` : ''}
            ${reste.length ? `
                <h2 class="tirage-titre">${t('Le reste')} <span>${t('Communes et peu communes')} · ${reste.length}</span></h2>
                <div class="tirage-grille tirage-reste">${reste.map(visible).join('')}</div>` : ''}`;
    } else {
        $('#tirage').innerHTML = tirage.map(visible).join('');
    }
    $('#tirage').querySelectorAll('.flip').forEach((flip, i) => {
        flip.style.animationDelay = `${Math.min(i * (nombreBoosters > 1 ? 20 : 90), 600)}ms`;
        flip.tabIndex = 0;
        flip.setAttribute('role', 'button');
        flip.setAttribute('aria-label', t('Voir le détail de la carte'));
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
    const fullArts = dernierTirage.filter(t => t.fullArt).length;
    const exs = dernierTirage.filter(t => t.ex).length;
    $('#ouverture-aide').hidden = true;
    const divines = dernierTirage.filter(t => t.godPack);
    const mythiques = divines.filter(t => t.carte.rarete === 'mythique').length;
    $('#bilan').classList.toggle('bilan-divin', divines.length > 0);
    $('#bilan').innerHTML = (divines.length
        ? `<span class="bilan-godpack">✨ GOD PACK ✨</span>
           <span class="rarete-mythique">${tn(mythiques, '<b class="texte-rarete">{n}</b> Mythique', '<b class="texte-rarete">{n}</b> Mythiques')}</span>`
        : '') + `
        <span>${tn(nouvelles, '<b>{n}</b> nouvelle', '<b>{n}</b> nouvelles')}</span>
        <span class="rarete-${meilleure.id}">${t('Meilleure :')} <b class="texte-rarete">${meilleure.nom}</b></span>
        ${holos ? `<span>✨ ${tn(holos, '<b>{n}</b> holo', '<b>{n}</b> holos')}</span>` : ''}
        ${fullArts ? `<span class="bilan-full-art"><b>${fullArts}</b> Full Art</span>` : ''}
        ${exs ? `<span class="bilan-ex"><b>${exs}</b> EX</span>` : ''}
        <span class="bilan-gain">+<b>${nombre(dernierGain)}</b> ${PIECE}</span>`;
    majPaquets();
    for (const id of ['#bilan', '#btn-retour', '#btn-voir-collection']) $(id).hidden = false;
    verifierSucces();
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
        ? t('<b>{n}</b> / {total} jeux découverts', { n: nombre(entrees.length), total: nombre(total) })
        : t('Chargement des jeux…');
    $('#progression-barre').style.width = total ? `${Math.max(0.5, (entrees.length / total) * 100)}%` : '0';
    $('#progression-raretes').innerHTML = pucesRaretesHTML();
    majTropheeGodPack();
    majMalchance();

    const recentes = entrees.sort((a, b) => b.obtenue - a.obtenue).slice(0, 8);
    $('#bloc-recentes').hidden = !recentes.length;
    $('#recentes').innerHTML = recentes.map(e => `
        <button class="mini" data-fiche="${e.id}" aria-label="${t('Voir {nom}', { nom: echapper(e.nom) })}">
            ${carteHTML(e, { holo: e.holos > 0 })}
        </button>`).join('');
    majPaquets();
}

// ---------- Écran collection ----------

// Année qui fait l'Ancienneté d'une carte de la collection (sortie d'origine, année du GOTY)
const anneeDeCarte = carte => {
    const jeu = jeuxParId.get(carte.id);
    return jeu ? anneeOriginale(jeu) : carte.annee;
};

const TRIS = {
    rarete: (a, b) => indexRarete(a.rarete) - indexRarete(b.rarete) || b.popularite - a.popularite,
    recent: (a, b) => b.obtenue - a.obtenue,
    attaque: (a, b) => b.attaque - a.attaque,
    anciennete: (a, b) => b.anciennete - a.anciennete,
    popularite: (a, b) => b.popularite - a.popularite,
    annee: (a, b) => (anneeDeCarte(b) || 0) - (anneeDeCarte(a) || 0),
    nom: (a, b) => a.nom.localeCompare(b.nom, LOCALE),
    exemplaires: (a, b) => b.exemplaires - a.exemplaires,
};

let filtreRarete = '';
let limiteCollection = CARTES_PAR_PAGE;

function caseCollectionHTML(entree) {
    return `
        <div class="case" data-id="${entree.id}">
            <button class="case-carte" data-fiche="${entree.id}" aria-label="${t('Voir {nom}', { nom: echapper(entree.nom) })}">
                ${carteHTML(entree, { holo: entree.holos > 0, compteur: entree.exemplaires })}
            </button>
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
    const seulementFullArt = $('#filtre-fullart').checked;
    const seulementEX = $('#filtre-ex').checked;
    const visibles = entrees
        .filter(e => !recherche || e.nom.toLowerCase().includes(recherche))
        .filter(e => !filtreRarete || e.rarete === filtreRarete)
        .filter(e => !genreChoisi || aLeGenre(e, genreChoisi))
        .filter(e => !doublons || e.exemplaires > 1)
        .filter(e => !seulementFullArt || e.fullArts > 0)
        .filter(e => !seulementEX || e.exs > 0)
        .sort(TRIS[$('#tri').value]);

    const grille = $('#grille-collection');
    if (!entrees.length) {
        grille.innerHTML = `<p class="vide">${t('Ta collection est vide.')}<br><a class="btn btn-principal" href="#accueil">${t('Ouvre ton premier booster')}</a></p>`;
    } else if (!visibles.length) {
        grille.innerHTML = `<p class="vide">${t('Aucune carte ne correspond à ces filtres.')}</p>`;
    } else {
        grille.innerHTML = visibles.slice(0, limiteCollection).map(caseCollectionHTML).join('');
    }
    const restantes = visibles.length - limiteCollection;
    $('#btn-plus').hidden = restantes <= 0;
    $('#btn-plus').textContent = t('Afficher plus ({n} restantes)', { n: nombre(restantes) });
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
        t('{jeux} jeux différents · {cartes} cartes · {doublons} doublons', { jeux: nombre(entrees.length), cartes: nombre(total), doublons: nombre(total - entrees.length) });
    const bouton = $('#btn-vendre-tout');
    bouton.disabled = valeur === 0;
    bouton.innerHTML = valeur ? `${t('Revendre les doublons')} · +${nombre(valeur)} ${PIECE}` : t('Aucun doublon');
}

function vendreDepuisFiche(id, variante) {
    const entree = etat.collection[id];
    if (!entree) return;
    if (entree.exemplaires === 1
        && !confirm(t('C’est ton seul exemplaire de « {nom} » : la carte quittera ta collection. La vendre quand même ?', { nom: entree.nom }))) return;
    const prix = vendreExemplaire(id, variante);
    if (!prix) return;
    sauvegarder();
    majEntete();
    const reste = etat.collection[id];
    const caseCarte = document.querySelector(`.case[data-id="${id}"]`);
    if (caseCarte) {
        if (!reste || ($('#filtre-doublons').checked && reste.exemplaires < 2) || ($('#filtre-fullart').checked && !reste.fullArts)
            || ($('#filtre-ex').checked && !reste.exs)) caseCarte.remove();
        else caseCarte.outerHTML = caseCollectionHTML(reste);
        majResumeCollection();
    }
    if (!$('#ecran-catalogue').hidden) afficherCatalogue();
    toast(t('+{n} pièces', { n: nombre(prix) }), 'gain');
    verifierSucces();
}

function vendreTousLesDoublons() {
    const entrees = Object.values(etat.collection);
    const valeur = entrees.reduce((n, e) => n + valeurDoublons(e), 0);
    if (!valeur || !confirm(t('Revendre tous tes doublons pour {n} pièces ? Tu gardes un exemplaire de chaque jeu (la holo en priorité).', { n: nombre(valeur) }))) return;
    for (const e of entrees) while (e.exemplaires > 1) vendreDoublon(e.id);
    sauvegarder();
    majEntete();
    afficherCollection();
    toast(t('+{n} pièces', { n: nombre(valeur) }), 'gain');
    verifierSucces();
}

// ---------- Fiche détaillée ----------

// « 3,2 M », « 450 k »
const formatJoueurs = n => n >= 1e6
    ? `${(n / 1e6).toLocaleString(LOCALE, { maximumFractionDigits: n >= 1e7 ? 0 : 1 })} M`
    : `${Math.round(n / 1e3).toLocaleString(LOCALE)} k`;

// Pourquoi ce jeu a cette rareté, en une phrase
function raisonRarete(jeu) {
    if (jeu.rarete === 'mythique') return t('Mythique : l’un des 22 jeux les plus cultes du jeu vidéo');
    const raisons = jeu.raisons.length ? ` · ${jeu.raisons.join(', ')}` : '';
    return `${t('Rang {n} au score de prestige', { n: nombre(jeu.rang) })}${raisons}`;
}

// Une seule variante : vente directe. Plusieurs : « Vendre » ouvre le choix de l'exemplaire
function boutonsVenteHTML(e) {
    const variantes = Object.entries(exemplairesParVariante(e)).filter(([, n]) => n > 0);
    if (variantes.length === 1) {
        const [variante] = variantes[0];
        return `<button class="btn btn-or" data-vendre="${e.id}" data-variante="${variante}">${t('Vendre')} · +${prixVariante(e, variante)} ${PIECE}</button>`;
    }
    return `<button class="btn btn-or" data-choix-vente>${t('Vendre…')}</button>
        <div class="fiche-vente" hidden>
            <p>${t('Quel exemplaire veux-tu vendre ?')}</p>
            ${variantes.map(([variante, n]) => `
                <button class="btn" data-vendre="${e.id}" data-variante="${variante}">
                    ${VARIANTES[variante].nom} <span class="gris">×${n}</span> · +${prixVariante(e, variante)} ${PIECE}
                </button>`).join('')}
            <button class="btn" data-annuler-vente>${t('Annuler')}</button>
        </div>`;
}

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
            <span class="fiche-rarete">${rarete.nom}${carte.ex ? ' EX' : ''}${e?.holos ? ' · ✨ Holo' : ''}</span>
            <h2>${echapper(carte.nom)}</h2>
            <p class="fiche-meta">${[carte.annee, ...carte.genres].filter(Boolean).map(echapper).join(' · ')}</p>
            ${jeu ? `<p class="fiche-raison">${raisonRarete(jeu)}</p>` : ''}
            ${aUneVersionEX(jeu) ? `<p class="fiche-ex">${carte.ex
                ? t('Version EX : jeu adoré des joueurs mais peu connu, sa Qualité est calculée comme une rareté au-dessus.')
                : t('Ce jeu existe en version EX (5 % de chance quand il est tiré) : sa Qualité y est calculée comme une rareté au-dessus.')}</p>` : ''}
            ${gotyDe(carte.id) || carte.metacritic >= SEUIL_CHEF_OEUVRE ? `<div class="fiche-distinctions">
                ${gotyDe(carte.id) ? `<p class="fiche-distinction">${LAURIER}${t('Jeu de l’année {annee}', { annee: gotyDe(carte.id).annee })}<span>${gotyDe(carte.id).ceremonie}</span></p>` : ''}
                ${carte.metacritic >= SEUIL_CHEF_OEUVRE ? `<p class="fiche-distinction">${ICONES.medaille}${t('Chef-d’œuvre')}<span>${t('noté {n}/100 par la presse (Metacritic)', { n: carte.metacritic })}</span></p>` : ''}
            </div>` : ''}
            ${carte.tags?.length ? `<p class="fiche-tags">${carte.tags.map(tag => `<span${(groupesTags[t('Contenu sensible')] || []).includes(tag)
                ? ' class="tag-sensible"' : ''}>${echapper(tag)}</span>`).join('')}</p>` : ''}
            <dl class="fiche-stats">
                <div><dt>${STATS.attaque.icone} ${STATS.attaque.nom}</dt><dd>${carte.attaque} <span class="gris">· ${jeu?.estime ? t('note estimée') : t('{n} % d’avis positifs', { n: carte.noteReelle ?? '?' })}</span></dd></div>
                <div><dt>★ ${STATS.popularite.nom}</dt><dd>${carte.popularite} <span class="gris">· ${jeu?.estime
                    ? (carte.avis ? t('≈ {n} avis (estimés)', { n: nombre(carte.avis) }) : t('pas encore d’avis Steam'))
                    : t('{n} avis Steam', { n: carte.avis ? nombre(carte.avis) : '?' })}</span></dd></div>
                <div><dt>${STATS.anciennete.icone} ${STATS.anciennete.nom}</dt><dd>${carte.anciennete} <span class="gris">· ${t('sorti en {annee}', { annee: jeu && anneeOriginale(jeu) !== carte.annee
                    ? t('{annee} (sur Steam en {steam})', { annee: anneeOriginale(jeu), steam: carte.annee }) : carte.annee })}</span></dd></div>
                ${jeu?.joueurs > 1 ? `<div><dt>👥 ${t('Joueurs estimés')}</dt><dd>≈ ${formatJoueurs(jeu.joueurs)}</dd></div>` : ''}
                <div><dt>📰 Metacritic</dt><dd>${carte.metacritic ?? `<span class="gris">${t('aucune')}</span>`}</dd></div>
                <div><dt># ${t('ID Steam')}</dt><dd>${carte.id}</dd></div>
            </dl>
            <p class="fiche-exemplaires">
                ${e
                    ? `${tn(e.exemplaires, '{n} exemplaire', '{n} exemplaires')}${[e.holos ? `${e.holos} holo` : '', e.exs ? `${e.exs} EX` : '', e.fullArts ? `${e.fullArts} Full Art` : ''].filter(Boolean).map(v => ` · ${v}`).join('')}
                       · ${t('obtenue le {date}', { date: new Date(e.obtenue).toLocaleDateString(LOCALE) })}`
                    : t('Pas encore dans ta collection.')}
            </p>
            <div class="fiche-actions">
                ${e ? boutonsVenteHTML(e) : ''}
                ${!e
                    ? `<button class="btn btn-principal" data-acheter="${carte.id}"${manque > 0 ? ` disabled title="${t('Il te manque {n} pièces', { n: nombre(manque) })}"` : ''}>
                           ${t('Acheter')} · ${nombre(rarete.prix)} ${PIECE}</button>`
                    : ''}
                <a class="btn" href="https://store.steampowered.com/app/${carte.id}" target="_blank" rel="noopener">${t('Voir sur Steam ↗')}</a>
            </div>
            ${!e && manque > 0 ? `<p class="fiche-note">${t('Il te manque {n} pièces.', { n: nombre(manque) })}</p>` : ''}
        </div>`;
    if (!$('#modale').open) $('#modale').showModal();
}

// ---------- Écran catalogue ----------

const TRIS_CATALOGUE = {
    // Par défaut : de la plus rare à la plus commune, puis par score de prestige dans chaque rareté
    rarete: (a, b) => indexRarete(a.rarete) - indexRarete(b.rarete) || b.prestige - a.prestige,
    // Stat Popularité de la carte (dans la fourchette de sa rareté), pas le nombre d'avis brut
    popularite: (a, b) => statPopularite(b) - statPopularite(a) || b.avis - a.avis,
    // Stat Qualité de la carte (dans la fourchette de sa rareté), pas la note Steam brute
    qualite: (a, b) => statQualite(b) - statQualite(a) || notePublic(b.note, b.avis) - notePublic(a.note, a.avis),
    metacritic: (a, b) => (b.metacritic ?? -1) - (a.metacritic ?? -1),
    // Année qui fait l'Ancienneté (sortie d'origine, année du GOTY), pas celle de la version Steam
    recent: (a, b) => (anneeOriginale(b) || 0) - (anneeOriginale(a) || 0),
    ancien: (a, b) => (anneeOriginale(a) || 9999) - (anneeOriginale(b) || 9999),
    nom: (a, b) => a.nom.localeCompare(b.nom, LOCALE),
};

let filtreRareteCatalogue = '';
let limiteCatalogue = CARTES_PAR_PAGE;

function caseCatalogueHTML(jeu) {
    const entree = etat.collection[jeu.id];
    const carte = creerCarte(jeu, { ex: entree?.exs > 0 });
    return `
        <div class="case">
            <button class="case-carte${entree ? '' : ' non-possedee'}" data-fiche="${jeu.id}" aria-label="${t('Voir {nom}', { nom: echapper(jeu.nom) })}${entree ? ` ${t('(dans ta collection)')}` : ''}">
                ${carteHTML(carte, { holo: entree?.holos > 0, fullArt: entree?.fullArts > 0, compteur: entree?.exemplaires || 0 })}
                ${entree ? `<span class="badge-possedee" title="${t('Dans ta collection')}">✓</span>` : ''}
            </button>
        </div>`;
}

function afficherCatalogue() {
    if (!donneesPretes()) {
        $('#grille-catalogue').innerHTML = `<p class="vide">${t('Chargement des jeux…')}</p>`;
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
        : `<p class="vide">${t('Aucun jeu ne correspond à ces filtres.')}</p>`;
    const restantes = visibles.length - limiteCatalogue;
    $('#btn-catalogue-plus').hidden = restantes <= 0;
    $('#btn-catalogue-plus').textContent = t('Afficher plus ({n} restants)', { n: nombre(restantes) });
    $('#resume-catalogue').textContent = t('{total} jeux · tu en possèdes {n}', { total: nombre(totalJeux()), n: nombre(Object.keys(etat.collection).length) })
        + (visibles.length !== totalJeux() ? ` · ${t('{n} avec ces filtres', { n: nombre(visibles.length) })}` : '');
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
    if (etat.pieces < prix) return toast(t('Il te manque {n} pièces pour acheter {nom}', { n: nombre(prix - etat.pieces), nom: carte.nom }));
    if (!confirm(t('Acheter {nom} pour {n} pièces ?', { nom: carte.nom, n: nombre(prix) }))) return;
    etat.pieces -= prix;
    ajouterACollection(carte, false);
    sauvegarder();
    majEntete();
    toast(t('{nom} rejoint ta collection !', { nom: carte.nom }), 'gain');
    verifierSucces();
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
            <td>${r.id === 'mythique' ? t('choisis à la main') : r.quota ? t('{n} suivants', { n: nombre(r.quota) }) : t('tous les autres')}</td>
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
    const message = t('Supprimer définitivement ta sauvegarde ?\n\nTu perdras tes {cartes} cartes et tes {pieces} pièces. Cette action ne peut pas être annulée.',
        { cartes: nombre(cartes), pieces: nombre(etat.pieces) });
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
// L'ordinateur peut aussi tomber sur une version EX
function tirerCarteOrdi(exclus) {
    const carte = piocher(tirerRarete('chanceDuel'), exclus);
    const jeu = jeuxParId.get(carte.id);
    return aUneVersionEX(jeu) && Math.random() < CHANCE_EX ? creerCarte(jeu, { ex: true }) : carte;
}

const duel = { joueur: 0, ordi: 0, carteJoueur: null, carteOrdi: null, verrou: false };

function actionsDuel(html) {
    $('#duel-actions').innerHTML = html;
}

function majScoreDuel() {
    const pips = n => Array.from({ length: MANCHES_GAGNANTES }, (_, i) => `<i${i < n ? ' class="plein"' : ''}></i>`).join('');
    $('#pips-joueur').innerHTML = pips(duel.joueur);
    $('#pips-ordi').innerHTML = pips(duel.ordi);
    $('#pips-joueur').setAttribute('aria-label', t('{n} manche(s) gagnée(s)', { n: duel.joueur }));
    $('#pips-ordi').setAttribute('aria-label', t('{n} manche(s) gagnée(s)', { n: duel.ordi }));
}

function demarrerDuel() {
    if (!donneesPretes()) return;
    if (!Object.keys(etat.collection).length) {
        toast(t('Ouvre d’abord un booster pour avoir des cartes'), 'erreur');
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
    $('#duel-manche').textContent = t('Manche {n}', { n: duel.manche });
    $('#duel-message').innerHTML = t('L’ordinateur joue <b>{nom}</b>. Sur quelle stat penses-tu le battre ?', { nom: echapper(duel.carteOrdi.nom) });
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
        if (ecart) departage = ` ${t('Égalité, départagée par la Popularité ({a} contre {b}).', { a: pm, b: ps })}`;
    }

    let resultat = t('Égalité parfaite, personne ne marque.');
    if (ecart > 0) {
        duel.joueur++;
        resultat = t('Manche gagnée !');
        $('#duel-joueur').classList.add('gagne');
        $('#duel-ordi').classList.add('perd');
    } else if (ecart < 0) {
        duel.ordi++;
        resultat = t('Manche perdue.');
        $('#duel-joueur').classList.add('perd');
        $('#duel-ordi').classList.add('gagne');
    }
    majScoreDuel();
    $('#duel-message').innerHTML = `${t('{stat} : <b>{a}</b> contre <b>{b}</b>.', { stat: `${STATS[stat].icone} ${STATS[stat].nom}`, a: mienne, b: sienne })}${departage} <b>${resultat}</b>`;

    if (duel.joueur >= MANCHES_GAGNANTES || duel.ordi >= MANCHES_GAGNANTES) finDuel();
    else actionsDuel(`<button class="btn btn-principal btn-grand" data-action="manche">${t('Manche suivante')}</button>`);
}

function finDuel() {
    const victoire = duel.joueur >= MANCHES_GAGNANTES;
    const gain = victoire ? gainDuJour('duel', GAIN_DUEL) : null;
    if (victoire) {
        etat.stats.duelsGagnes++;
        if (duel.ordi === 0) etat.stats.duelsParfaits++;
        etat.pieces += gain.pieces;
        sauvegarder();
        majEntete();
        toast(t('Victoire ! +{n} pièces', { n: gain.pieces }) + noteGain(gain.taux), 'gain');
    }
    // Le détail de la dernière manche reste affiché au-dessus du résultat
    $('#duel-message').innerHTML += victoire
        ? t('<br><b class="victoire">Victoire {a} à {b} !</b> Tu gagnes {n} pièces.', { a: duel.joueur, b: duel.ordi, n: gain.pieces }) + noteGain(gain.taux)
        : t('<br><b class="defaite">Défaite {a} à {b}.</b> Retente ta chance !', { a: duel.joueur, b: duel.ordi });
    actionsDuel(`<button class="btn btn-principal btn-grand" data-action="demarrer">${t('Rejouer')}</button>`);
    jouerSon(victoire ? 'succes' : 'mauvaise');
    verifierSucces();
}

// ---------- Compteur de malchance ----------

function majMalchance() {
    const reste = MALCHANCE_MAX - etat.malchance;
    $('#malchance').innerHTML = reste <= 1
        ? t('<b>Prochain booster : Légendaire garantie !</b>')
        : t('Légendaire garantie au plus tard dans <b>{n}</b> boosters', { n: reste });
}

// ---------- Succès ----------

const possedees = () => Object.values(etat.collection);
const nombreDeRarete = id => possedees().filter(e => e.rarete === id).length;
// Années de GOTY couvertes par la collection (plusieurs éditions d'un même GOTY comptent pour une)
const anneesGotyPossedees = () => new Set(possedees().filter(e => GOTY[e.id]).map(e => GOTY[e.id][0])).size;
const ANNEES_GOTY = new Set(Object.values(GOTY).map(g => g[0])).size;

// Chaque succès se débloque quand valeur() atteint cible ; sa récompense se récupère ensuite dans le profil :
// { pieces }, { boosters } (classiques, ajoutés à la réserve), { prestiges } ou { fullArt } (une Légendaire ou Mythique au hasard)
const SUCCES = [
    // Collection
    { id: 'premier-pas', nom: t('Premier pas'), description: t('Obtenir ta première carte'), cible: 1, recompense: { boosters: 10 }, valeur: () => possedees().length },
    { id: 'collectionneur', nom: t('Collectionneur'), description: t('Posséder 100 jeux différents'), cible: 100, recompense: { pieces: 50 }, valeur: () => possedees().length },
    { id: 'archiviste', nom: t('Archiviste'), description: t('Posséder 500 jeux différents'), cible: 500, recompense: { prestiges: 1 }, valeur: () => possedees().length },
    { id: 'conservateur', nom: t('Conservateur de musée'), description: t('Posséder 1 000 jeux différents'), cible: 1000, recompense: { prestiges: 2 }, valeur: () => possedees().length },
    { id: 'premiere-rare', nom: t('Ça devient rare'), description: t('Obtenir une carte Rare'), cible: 1, recompense: { pieces: 10 }, valeur: () => nombreDeRarete('rare') },
    { id: 'premiere-epique', nom: t('Épique !'), description: t('Obtenir une carte Épique'), cible: 1, recompense: { boosters: 10 }, valeur: () => nombreDeRarete('epique') },
    { id: 'premiere-legendaire', nom: t('Une légende'), description: t('Obtenir une carte Légendaire'), cible: 1, recompense: { pieces: 75 }, valeur: () => nombreDeRarete('legendaire') },
    { id: 'premiere-mythique', nom: t('Mythe vivant'), description: t('Obtenir une carte Mythique'), cible: 1, recompense: { prestiges: 1 }, valeur: () => nombreDeRarete('mythique') },
    { id: 'salle-legendes', nom: t('Salle des légendes'), description: t('Posséder 25 Légendaires différentes'), cible: 25, recompense: { fullArt: 1 }, valeur: () => nombreDeRarete('legendaire') },
    { id: 'pantheon', nom: t('Panthéon'), description: t('Posséder 5 Mythiques différentes'), cible: 5, recompense: { pieces: 500 }, valeur: () => nombreDeRarete('mythique') },
    { id: 'olympe', nom: t('Olympe'), description: t('Posséder toutes les Mythiques'), cible: MYTHIQUES.length, recompense: { pieces: 2000 }, valeur: () => nombreDeRarete('mythique') },
    { id: 'palmares', nom: t('Palmarès'), description: t('Posséder 5 jeux de l’année (années différentes)'), cible: 5, recompense: { prestiges: 1 }, valeur: anneesGotyPossedees },
    { id: 'tous-goty', nom: t('Toutes les cérémonies'), description: t('Posséder un jeu de l’année pour chaque année'), cible: ANNEES_GOTY, recompense: { pieces: 1000 }, valeur: anneesGotyPossedees },
    { id: 'critique', nom: t('Critique avisé'), description: t('Posséder 10 chefs-d’œuvre (Metacritic 90+)'), cible: 10, recompense: { boosters: 10 }, valeur: () => possedees().filter(e => e.metacritic >= SEUIL_CHEF_OEUVRE).length },
    { id: 'brillant', nom: t('Tout ce qui brille'), description: t('Obtenir une carte holo'), cible: 1, recompense: { pieces: 50 }, valeur: () => possedees().filter(e => e.holos > 0).length },
    { id: 'galerie-holo', nom: t('Galerie des glaces'), description: t('Posséder 10 cartes holo différentes'), cible: 10, recompense: { prestiges: 1 }, valeur: () => possedees().filter(e => e.holos > 0).length },
    { id: 'oeuvre-art', nom: t('Œuvre d’art'), description: t('Obtenir une carte Full Art'), cible: 1, recompense: { pieces: 100 }, valeur: () => possedees().filter(e => e.fullArts > 0).length },
    { id: 'premiere-ex', nom: t('Pépite dénichée'), description: t('Obtenir une carte EX'), cible: 1, recompense: { pieces: 50 }, valeur: () => possedees().filter(e => e.exs > 0).length },
    { id: 'chercheur-pepites', nom: t('Chercheur de pépites'), description: t('Posséder 10 cartes EX différentes'), cible: 10, recompense: { boosters: 10 }, valeur: () => possedees().filter(e => e.exs > 0).length },
    { id: 'galerie-privee', nom: t('Galerie privée'), description: t('Posséder 5 cartes Full Art différentes'), cible: 5, recompense: { pieces: 500 }, valeur: () => possedees().filter(e => e.fullArts > 0).length },
    { id: 'divin', nom: t('Intervention divine'), description: t('Ouvrir un god pack'), cible: 1, recompense: { prestiges: 2 }, valeur: () => etat.godPacks.nombre },
    // Boosters
    { id: 'boosters-10', nom: t('Déchireur'), description: t('Ouvrir 10 boosters'), cible: 10, recompense: { boosters: 10 }, valeur: () => etat.stats.boosters },
    { id: 'boosters-100', nom: t('Accro aux boosters'), description: t('Ouvrir 100 boosters'), cible: 100, recompense: { pieces: 100 }, valeur: () => etat.stats.boosters },
    { id: 'boosters-500', nom: t('Usine à cartes'), description: t('Ouvrir 500 boosters'), cible: 500, recompense: { prestiges: 2 }, valeur: () => etat.stats.boosters },
    { id: 'boosters-1000', nom: t('Mille paquets'), description: t('Ouvrir 1 000 boosters'), cible: 1000, recompense: { pieces: 600 }, valeur: () => etat.stats.boosters },
    { id: 'grand-luxe', nom: t('Grand luxe'), description: t('Ouvrir un booster Prestige'), cible: 1, recompense: { pieces: 30 }, valeur: () => etat.stats.prestiges },
    { id: 'habitue-prestige', nom: t('Habitué du Prestige'), description: t('Ouvrir 30 boosters Prestige'), cible: 30, recompense: { pieces: 200 }, valeur: () => etat.stats.prestiges },
    // Jeux
    { id: 'stratege', nom: t('Stratège'), description: t('Gagner un duel de decks'), cible: 1, recompense: { boosters: 10 }, valeur: () => etat.stats.decksGagnes },
    { id: 'invincible', nom: t('Invincible'), description: t('Gagner un duel de decks en Hardcore'), cible: 1, recompense: { fullArt: 1 }, valeur: () => etat.stats.decksHardcore },
    { id: 'premier-sang', nom: t('Premier sang'), description: t('Gagner un duel'), cible: 1, recompense: { boosters: 10 }, valeur: () => etat.stats.duelsGagnes },
    { id: 'duelliste', nom: t('Duelliste'), description: t('Gagner 10 duels'), cible: 10, recompense: { pieces: 100 }, valeur: () => etat.stats.duelsGagnes },
    { id: 'champion', nom: t('Champion'), description: t('Gagner 50 duels'), cible: 50, recompense: { prestiges: 1 }, valeur: () => etat.stats.duelsGagnes },
    { id: 'sans-appel', nom: t('Sans appel'), description: t('Gagner un duel 3 à 0'), cible: 1, recompense: { pieces: 50 }, valeur: () => etat.stats.duelsParfaits },
    { id: 'bon-instinct', nom: t('Bon instinct'), description: t('Enchaîner 5 bonnes réponses au Plus ou moins'), cible: 5, recompense: { boosters: 10 }, valeur: () => etat.stats.recordPom },
    { id: 'encyclopedie', nom: t('Encyclopédie'), description: t('Enchaîner 15 bonnes réponses au Plus ou moins'), cible: 15, recompense: { pieces: 100 }, valeur: () => etat.stats.recordPom },
    { id: 'oracle', nom: t('Oracle'), description: t('Enchaîner 30 bonnes réponses au Plus ou moins'), cible: 30, recompense: { prestiges: 1 }, valeur: () => etat.stats.recordPom },
    // Commerce
    { id: 'marchand', nom: t('Marchand'), description: t('Revendre un doublon'), cible: 1, recompense: { pieces: 10 }, valeur: () => etat.stats.ventes },
    { id: 'grossiste', nom: t('Grossiste'), description: t('Revendre 100 doublons'), cible: 100, recompense: { pieces: 100 }, valeur: () => etat.stats.ventes },
];

// Débloque les succès atteints et les annonce ; leurs récompenses attendent d'être récupérées dans le profil
function verifierSucces() {
    const nouveaux = SUCCES.filter(s => !etat.succes[s.id] && s.valeur() >= s.cible);
    if (!nouveaux.length) return;
    for (const s of nouveaux) etat.succes[s.id] = Date.now();
    sauvegarder();
    jouerSon('succes');
    if (nouveaux.length > 3) {
        toast(t('{n} succès débloqués ! Récupère tes récompenses dans le Profil', { n: nouveaux.length }), 'gain');
    } else {
        for (const s of nouveaux) toast(t('Succès « {nom} » débloqué ! Récupère ta récompense dans le Profil', { nom: s.nom }), 'gain');
    }
    majBadgeSucces();
    if (!$('#ecran-profil').hidden) afficherProfil();
}

const succesARecuperer = () => SUCCES.filter(s => etat.succes[s.id] && !etat.succesRecuperes[s.id]);

// Pastille sur le menu Profil tant qu'une récompense attend (succès ou récompense du jour)
function majBadgeSucces() {
    $('#lien-profil').classList.toggle('pret', succesARecuperer().length > 0 || jourConnexion() > 0);
}

// « +50 pièces », « +2 boosters », « Carte Full Art » : texte de la récompense, avec la pièce dessinée si piece est vrai
function texteRecompense(r, piece = true) {
    if (r.pieces) return piece ? `+${nombre(r.pieces)} ${PIECE}` : t('+{n} pièces', { n: nombre(r.pieces) });
    if (r.boosters) return tn(r.boosters, '+{n} booster', '+{n} boosters');
    if (r.prestiges) return tn(r.prestiges, '+{n} Prestige', '+{n} Prestiges');
    return t('Carte Full Art');
}

// Verse une récompense (succès ou connexion) et l'annonce ; renvoie la carte Full Art gagnée, s'il y en a une
function verserRecompense(r) {
    let carte = null;
    if (r.pieces) etat.pieces += r.pieces;
    // Les boosters gagnés s'ajoutent à la réserve, même au-delà de son maximum
    if (r.boosters) etat.charges.standard.charges += r.boosters;
    if (r.prestiges) etat.charges.prestige.charges += r.prestiges;
    if (r.fullArt) {
        carte = piocher(tirerRarete('chance', RARETES.slice(0, INDEX_LEGENDAIRE + 1)));
        ajouterACollection(carte, false, true);
    }
    sauvegarder();
    majEntete();
    majBadgeSucces();
    jouerSon('succes');
    if (r.pieces) toast(texteRecompense(r, false), 'gain');
    if (r.boosters) toast(tn(r.boosters, '+{n} booster ajouté à ta réserve', '+{n} boosters ajoutés à ta réserve'), 'gain');
    if (r.prestiges) toast(tn(r.prestiges, '+{n} Prestige ajouté à ta réserve', '+{n} Prestiges ajoutés à ta réserve'), 'gain');
    if (carte) toast(t('{nom} en Full Art rejoint ta collection !', { nom: carte.nom }), 'gain');
    return carte;
}

// Verse la récompense d'un succès obtenu (une seule fois)
function recupererSucces(id) {
    const succes = SUCCES.find(s => s.id === id);
    if (!succes || !etat.succes[id] || etat.succesRecuperes[id] || !donneesPretes()) return;
    etat.succesRecuperes[id] = Date.now();
    const carte = verserRecompense(succes.recompense);
    afficherProfil();
    verifierSucces(); // la carte gagnée peut débloquer d'autres succès
    if (carte) afficherFiche(carte.id);
}

function toutRecuperer() {
    for (const s of succesARecuperer()) recupererSucces(s.id);
}

// ---------- Gains du jour ----------

// Pièces d'une victoire dans un mode ('duel', 'decks', 'pom'), selon le nombre de victoires déjà payées aujourd'hui
function gainDuJour(mode, base) {
    if (etat.gainsJour.jour !== jourLocal()) etat.gainsJour = { jour: jourLocal() };
    const n = etat.gainsJour[mode] = (etat.gainsJour[mode] || 0) + 1;
    const { taux } = TAUX_GAINS.find(palier => n <= palier.jusqua);
    return { pieces: Math.max(1, Math.round(base * taux)), taux };
}

// Précision affichée après le gain : bonus du jour ou gains réduits
function noteGain(taux) {
    if (taux > 1) return t(' (première victoire du jour : ×3)');
    if (taux === 0.5) return t(' (gains réduits de moitié pour aujourd’hui)');
    if (taux < 0.5) return t(' (gains très réduits jusqu’à demain)');
    return '';
}

// ---------- Récompense de connexion quotidienne ----------

// Date en heure locale (« 2026-10-30 ») : aujourd'hui, ou décalée de quelques jours
function jourLocal(decalage = 0) {
    const d = new Date();
    d.setDate(d.getDate() + decalage);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Jours d'affilée en comptant aujourd'hui : la série continue si la dernière récompense date d'hier
const serieConnexion = () => etat.connexion.dernier === jourLocal(-1) ? etat.connexion.serie + 1 : 1;

// Jour du cycle à récupérer aujourd'hui (1 à 7), 0 si c'est déjà fait
function jourConnexion() {
    if (etat.connexion.dernier === jourLocal()) return 0;
    return (serieConnexion() - 1) % RECOMPENSES_CONNEXION.length + 1;
}

// Les 7 jours du cycle : passés cochés, celui du jour mis en avant
function calendrierConnexionHTML() {
    const jour = jourConnexion();
    // Déjà récupérée aujourd'hui : on montre où en est le cycle
    const actuel = jour || (etat.connexion.serie - 1) % RECOMPENSES_CONNEXION.length + 1;
    const serie = jour ? serieConnexion() : etat.connexion.serie;
    return `
        <p class="connexion-serie">${serie > 1
            ? tn(serie, '{n} jour d’affilée', '{n} jours d’affilée')
            : t('Reviens chaque jour : la récompense grandit jusqu’au 7ᵉ jour. Un jour manqué, et le cycle recommence.')}</p>
        <ol class="connexion-jours">${RECOMPENSES_CONNEXION.map((r, i) => {
            const etatJour = i + 1 < actuel || (!jour && i + 1 === actuel) ? 'faite' : i + 1 === actuel ? 'aujourdhui' : '';
            return `
            <li class="${etatJour}${r.fullArt ? ' jour-full-art' : ''}">
                <span class="connexion-numero">${t('Jour {n}', { n: i + 1 })}</span>
                <b>${texteRecompense(r)}</b>
                ${etatJour === 'faite' ? '<span class="connexion-coche" aria-hidden="true">✓</span>' : ''}
            </li>`;
        }).join('')}</ol>
        ${jour
            ? `<button class="btn btn-or btn-grand" data-connexion>${t('Récupérer')}</button>`
            : `<p class="connexion-suite">${t('Reviens demain pour la récompense suivante !')}</p>`}`;
}

// Fenêtre de la récompense du jour, à l'arrivée sur le jeu (si elle n'est pas encore récupérée)
function proposerConnexion() {
    if (!jourConnexion() || !donneesPretes() || $('#modale').open) return;
    $('#modale-contenu').innerHTML = `
        <div class="connexion">
            <h2>${t('Récompense du jour')}</h2>
            ${calendrierConnexionHTML()}
        </div>`;
    $('#modale').showModal();
}

function recupererConnexion() {
    const jour = jourConnexion();
    if (!jour || !donneesPretes()) return;
    etat.connexion = { dernier: jourLocal(), serie: serieConnexion() };
    if ($('#modale').open && $('#modale-contenu .connexion')) $('#modale').close();
    const carte = verserRecompense(RECOMPENSES_CONNEXION[jour - 1]);
    majBadgeSucces();
    if (!$('#ecran-profil').hidden) afficherProfil();
    verifierSucces();
    if (carte) afficherFiche(carte.id);
}

// ---------- Écran profil ----------

function afficherProfil() {
    const faits = SUCCES.filter(s => etat.succes[s.id]).length;
    const stats = etat.stats;
    $('#resume-profil').textContent = t('{boosters} boosters ouverts · {duels} duels gagnés · record au Plus ou moins : {record}',
        { boosters: nombre(stats.boosters), duels: nombre(stats.duelsGagnes), record: stats.recordPom });
    $('#succes-compte').textContent = `${faits} / ${SUCCES.length}`;
    $('#succes-grille').innerHTML = SUCCES.map(succes => {
        const obtenu = etat.succes[succes.id];
        const aRecuperer = obtenu && !etat.succesRecuperes[succes.id];
        const valeur = Math.min(succes.valeur(), succes.cible);
        return `
            <article class="succes${obtenu ? ' obtenu' : ''}${aRecuperer ? ' a-recuperer' : ''}">
                ${ICONES.trophee}
                <div class="succes-texte">
                    <h3>${succes.nom}</h3>
                    <p>${succes.description}</p>
                    ${aRecuperer
                        ? `<button class="btn btn-or succes-recuperer" data-recuperer="${succes.id}">${t('Récupérer')}</button>`
                        : obtenu
                            ? `<span class="succes-date">${t('Obtenu le {date}', { date: new Date(obtenu).toLocaleDateString(LOCALE) })}</span>`
                            : `<span class="succes-progres"><i style="--v: ${(valeur / succes.cible) * 100}%"></i>${nombre(valeur)} / ${nombre(succes.cible)}</span>`}
                </div>
                <span class="succes-gain${succes.recompense.fullArt ? ' gain-full-art' : ''}">${texteRecompense(succes.recompense)}</span>
            </article>`;
    }).join('');
    $('#btn-tout-recuperer').hidden = succesARecuperer().length < 2;
    $('#connexion-profil').innerHTML = calendrierConnexionHTML();
    $('#reglage-sons').checked = etat.reglages.sons;
    $('#reglage-langue').value = LANGUE;
}

// ---------- Mini-jeu « Plus ou moins » ----------

// `different` : écart minimal pour que la question ait une vraie réponse
const QUESTIONS_POM = [
    { question: t('Lequel a le plus d’avis Steam ?'), valeur: j => j.avis, gagnant: 'max',
      different: (a, b) => Math.max(a, b) >= Math.min(a, b) * 1.15, texte: j => t('{n} avis', { n: nombre(j.avis) }) },
    { question: t('Lequel est le mieux noté par les joueurs ?'), valeur: j => j.note, gagnant: 'max',
      different: (a, b) => Math.abs(a - b) >= 3, texte: j => t('{n} % d’avis positifs', { n: j.note }) },
    { question: t('Lequel est sorti en premier ?'), valeur: j => j.annee, gagnant: 'min',
      different: (a, b) => a !== b, texte: j => t('sorti en {annee}', { annee: j.annee }) },
];
const pom = { serie: 0, paire: null, question: null, verrou: false };
let jeuxPom = null;

// Prochain palier de série qui rapporte des pièces
function prochainPalierPom(serie) {
    const palier = Object.keys(PALIERS_POM).map(Number).find(p => p > serie);
    return palier ?? (Math.floor(serie / 10) + 1) * 10;
}

function majScorePom() {
    $('#pom-serie').textContent = pom.serie;
    $('#pom-record').textContent = etat.stats.recordPom;
}

function nouvelleQuestionPom() {
    if (!donneesPretes()) return;
    // Des jeux assez connus pour qu'on puisse deviner (au moins 3 000 avis réels)
    jeuxPom ??= tousLesJeux.filter(j => !j.estime && j.avis >= 3000 && j.annee);
    const question = auHasard(QUESTIONS_POM);
    let a, b;
    do {
        a = auHasard(jeuxPom);
        b = auHasard(jeuxPom);
    } while (a.id === b.id || !question.different(question.valeur(a), question.valeur(b)));
    Object.assign(pom, { question, paire: [a, b], verrou: false });

    $('#pom-question').textContent = question.question;
    $('#pom-plateau').innerHTML = pom.paire.map((jeu, i) => `
        <button class="pom-choix" data-pom="${i}" aria-label="${echapper(jeu.nom)}">
            ${carteHTML(creerCarte(jeu), { cachee: true })}
            <span class="pom-valeur" hidden>${question.texte(jeu)}</span>
        </button>`).join(`<span class="duel-vs">${t('OU')}</span>`);
    $('#pom-message').textContent = t('Clique sur la bonne carte.');
    $('#pom-actions').innerHTML = '';
    majScorePom();
}

function repondrePom(choix) {
    if (pom.verrou || !pom.paire) return;
    pom.verrou = true;
    const [va, vb] = pom.paire.map(pom.question.valeur);
    const bonne = pom.question.gagnant === 'max' ? (va > vb ? 0 : 1) : (va < vb ? 0 : 1);
    document.querySelectorAll('.pom-choix').forEach((bouton, i) => {
        bouton.disabled = true;
        bouton.classList.add(i === bonne ? 'bonne' : 'mauvaise');
        bouton.querySelector('.pom-valeur').hidden = false;
    });

    if (choix === bonne) {
        pom.serie++;
        etat.stats.recordPom = Math.max(etat.stats.recordPom, pom.serie);
        // Palier de série atteint : il compte comme une victoire dans les gains du jour
        const base = PALIERS_POM[pom.serie] ?? (pom.serie > 20 && pom.serie % 10 === 0 ? GAIN_POM_AU_DELA : 0);
        const gain = base ? gainDuJour('pom', base) : null;
        if (gain) etat.pieces += gain.pieces;
        sauvegarder();
        majEntete();
        jouerSon('bonne');
        $('#pom-message').innerHTML = gain
            ? t('<b class="victoire">Bonne réponse !</b> Palier de {s} : +{n} pièces', { s: pom.serie, n: gain.pieces }) + noteGain(gain.taux)
            : t('<b class="victoire">Bonne réponse !</b> Prochain palier : {p} bonnes réponses', { p: prochainPalierPom(pom.serie) });
        $('#pom-actions').innerHTML = `<button class="btn btn-principal btn-grand" data-pom-action="suivant">${t('Question suivante')}</button>`;
    } else {
        jouerSon('mauvaise');
        const serie = pom.serie;
        $('#pom-message').innerHTML = tn(serie, '<b class="defaite">Raté !</b> Série terminée : {n} bonne réponse.', '<b class="defaite">Raté !</b> Série terminée : {n} bonnes réponses.');
        pom.serie = 0;
        $('#pom-actions').innerHTML = `<button class="btn btn-principal btn-grand" data-pom-action="suivant">${t('Rejouer')}</button>`;
    }
    majScorePom();
    verifierSucces();
}

// Onglets de l'écran « Jouer » : Duel, Duel de decks ou Plus ou moins
function changerModeJeu(mode) {
    document.querySelectorAll('[data-mode]').forEach(onglet => {
        onglet.classList.toggle('actif', onglet.dataset.mode === mode);
        onglet.setAttribute('aria-selected', onglet.dataset.mode === mode);
    });
    $('#mode-duel').hidden = mode !== 'duel';
    $('#mode-pom').hidden = mode !== 'pom';
    $('#mode-decks').hidden = mode !== 'decks';
    if (mode === 'pom' && !pom.paire) nouvelleQuestionPom();
    if (mode === 'decks') afficherDuelDecks();
}

// ---------- Duel de decks ----------

// Chacun a un deck de 3 cartes, sous le plafond de rareté du niveau (pour toi comme pour l'ordinateur).
// À tour de rôle, l'attaquant pose une carte face cachée et annonce une stat ; le défenseur répond avec une
// de ses cartes sans voir celle de l'attaquant. Premier à 2 points. Score à égalité avant la dernière manche
// (ou à la fin) : les dernières cartes se départagent au total de leurs stats.
const TAILLE_DECK = 3;
const POINTS_VICTOIRE_DECK = Math.floor(TAILLE_DECK / 2) + 1;
// `intelligence` : probabilité que l'ordinateur joue son meilleur coup (sinon il joue au hasard)
// `elite` : son deck est tiré parmi les N meilleures cartes du jeu sous le plafond (sinon au hasard, selon chanceDuel)
const NIVEAUX_DECK = [
    { id: 'facile', nom: t('Facile'), max: 'peu-commune', gain: 5, intelligence: 0 },
    { id: 'normal', nom: t('Normal'), max: 'rare', gain: 10, intelligence: 0.35 },
    { id: 'difficile', nom: t('Difficile'), max: 'epique', gain: 20, intelligence: 0.6 },
    { id: 'impossible', nom: t('Impossible'), max: 'legendaire', gain: 40, intelligence: 0.85, elite: 100 },
    { id: 'hardcore', nom: t('Hardcore'), max: 'mythique', gain: 80, intelligence: 1, elite: 30 },
];
const CARTES_CHOIX_DECK = 40; // cartes affichées à la fois pendant la composition du deck
const STATS_DECK = Object.keys(STATS);
// Tris de la composition du deck : une stat de la carte, ou le total des trois
const TRIS_DECK = {
    total: t('Tri : total des stats'),
    attaque: t('Tri : qualité'),
    popularite: t('Tri : popularité'),
    anciennete: t('Tri : ancienneté'),
};

const deckDuel = {
    etape: 'niveau', niveau: null, choix: [], dernierAjout: null, recherche: '', tri: 'total', limite: CARTES_CHOIX_DECK,
    moi: [], ordi: [], score: { moi: 0, ordi: 0 }, attaquant: 'moi',
    attente: null,   // 'attaque' (choisir une carte puis une stat), 'defense' (choisir une carte), ou rien
    carte: null,     // index de la carte choisie pour attaquer
    // Cartes posées sur la table : { moi, ordi, stat, ecart, cache (carte de l'ordi face cachée),
    // revele (elle se retourne pendant l'animation), arrivee (elle vient d'être posée) }
    combat: null,
    actions: null,   // boutons du moment : 'suivante', 'decisive' ou 'fin'
    pointMarque: null, // 'moi' ou 'ordi' : le point qui vient d'être marqué (petite animation)
    verrou: false,   // animation en cours, les clics attendent
    message: '',
};

const totalStats = c => c.attaque + c.popularite + c.anciennete;
const autoriseeAuNiveau = (rarete, niveau) => indexRarete(rarete) >= indexRarete(niveau.max);
const cartesDuNiveau = niveau => Object.values(etat.collection).filter(e => autoriseeAuNiveau(e.rarete, niveau));

function melanger(liste) {
    const copie = [...liste];
    for (let i = copie.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
}

// Les meilleures cartes du jeu sous un plafond, calculées une seule fois par niveau
const meilleuresParNiveau = {};

function deckOrdinateur(niveau) {
    if (niveau.elite) {
        meilleuresParNiveau[niveau.id] ??= tousLesJeux.filter(j => autoriseeAuNiveau(j.rarete, niveau))
            .map(j => creerCarte(j)).sort((a, b) => totalStats(b) - totalStats(a)).slice(0, niveau.elite);
        return melanger(meilleuresParNiveau[niveau.id]).slice(0, TAILLE_DECK);
    }
    const raretes = RARETES.filter(r => autoriseeAuNiveau(r.id, niveau));
    const exclus = new Set();
    return Array.from({ length: TAILLE_DECK }, () => {
        const carte = piocher(tirerRarete('chanceDuel', raretes), exclus);
        exclus.add(carte.id);
        return carte;
    });
}

// Coup de l'ordinateur : le meilleur avec la probabilité `intelligence` du niveau, sinon au hasard
function coupOrdi(role, stat) {
    const d = deckDuel;
    const malin = Math.random() < d.niveau.intelligence;
    if (role === 'attaque') {
        if (!malin) return { carte: auHasard(d.ordi), stat: auHasard(STATS_DECK) };
        let meilleur = null;
        for (const carte of d.ordi) {
            for (const s of STATS_DECK) if (!meilleur || carte[s] > meilleur.carte[meilleur.stat]) meilleur = { carte, stat: s };
        }
        return meilleur;
    }
    // Défense : il ne voit pas ta carte, il répond avec sa meilleure valeur dans la stat annoncée
    return malin ? d.ordi.reduce((m, c) => (c[stat] > m[stat] ? c : m)) : auHasard(d.ordi);
}

function niveauxDeckHTML() {
    return `
        <p class="duel-message">${t('Choisis la difficulté. Elle fixe la rareté maximale des cartes, pour toi comme pour l’ordinateur.')}</p>
        <div class="niveaux-deck">
            ${NIVEAUX_DECK.map(niveau => {
                const max = RARETES[indexRarete(niveau.max)];
                const assez = cartesDuNiveau(niveau).length >= TAILLE_DECK;
                return `
                <button class="niveau-deck rarete-${max.id}" data-niveau="${niveau.id}"${assez ? '' : ' disabled'}>
                    <b>${niveau.nom}</b>
                    <span>${t('Rareté max : {rarete}', { rarete: max.nom })}</span>
                    <span class="niveau-gain">+${niveau.gain} ${PIECE}</span>
                    ${assez ? '' : `<small>${t('Il te faut au moins {n} cartes {rarete} ou moins', { n: TAILLE_DECK, rarete: max.nom })}</small>`}
                </button>`;
            }).join('')}
        </div>`;
}

function choixDeckHTML() {
    const d = deckDuel;
    const recherche = d.recherche.trim().toLowerCase();
    const valeur = c => (d.tri === 'total' ? totalStats(c) : c[d.tri]);
    const cartes = cartesDuNiveau(d.niveau)
        .filter(e => !recherche || e.nom.toLowerCase().includes(recherche))
        .sort((a, b) => valeur(b) - valeur(a) || totalStats(b) - totalStats(a));
    return `
        <p class="duel-message">${t('Niveau {niveau} : clique sur tes cartes pour remplir les {n} emplacements de ton deck.',
            { niveau: d.niveau.nom, n: TAILLE_DECK })}</p>
        <div class="deck-slots">${Array.from({ length: TAILLE_DECK }, (_, i) => {
            const carte = etat.collection[d.choix[i]];
            return carte
                ? `<button class="deck-slot plein${carte.id === d.dernierAjout ? ' arrive' : ''}" data-choix-deck="${carte.id}"
                        aria-label="${t('Retirer {nom} du deck', { nom: echapper(carte.nom) })}">
                        ${carteHTML(carte, { holo: carte.holos > 0 })}<span class="slot-retirer" aria-hidden="true">✕</span>
                    </button>`
                : `<div class="deck-slot"><span>${i + 1}</span></div>`;
        }).join('')}</div>
        <div class="duel-actions">
            <button class="btn" data-deck-action="niveaux">${t('Changer de difficulté')}</button>
            <button class="btn btn-principal" data-deck-action="lancer"${d.choix.length === TAILLE_DECK ? '' : ' disabled'}>${t('Lancer la partie')}</button>
        </div>
        <div class="deck-outils">
            <label class="recherche">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <input type="search" id="deck-recherche" value="${echapper(d.recherche)}" placeholder="${t('Rechercher un jeu…')}" aria-label="${t('Rechercher un jeu')}">
            </label>
            <select id="deck-tri" aria-label="${t('Trier')}">
                ${Object.entries(TRIS_DECK).map(([cle, nom]) => `<option value="${cle}"${cle === d.tri ? ' selected' : ''}>${nom}</option>`).join('')}
            </select>
        </div>
        <div class="grille">${cartes.slice(0, d.limite).map(e => `
            <button class="carte-choix${d.choix.includes(e.id) ? ' choisie' : ''}" data-choix-deck="${e.id}" aria-pressed="${d.choix.includes(e.id)}">
                ${carteHTML(e, { holo: e.holos > 0 })}
            </button>`).join('')}</div>
        ${cartes.length > d.limite ? `<div class="plus"><button class="btn" data-deck-action="plus">${t('Afficher plus')}</button></div>` : ''}`;
}

function actionsDeckHTML() {
    const d = deckDuel;
    if (d.verrou) return '';
    if (d.attente === 'attaque' && d.carte !== null) {
        const carte = d.moi[d.carte];
        return STATS_DECK.map(s => `
            <button class="btn-stat" data-stat-deck="${s}"><span>${STATS[s].icone} ${STATS[s].nom}</span><b>${carte[s]}</b></button>`).join('');
    }
    if (d.actions === 'suivante') return `<button class="btn btn-principal btn-grand" data-deck-action="suivante">${t('Manche suivante')}</button>`;
    if (d.actions === 'decisive') return `<button class="btn btn-principal btn-grand" data-deck-action="decisive">${t('Révéler les dernières cartes')}</button>`;
    if (d.actions === 'fin') {
        return `<button class="btn btn-principal btn-grand" data-deck-action="rejouer">${t('Rejouer')}</button>
            <button class="btn" data-deck-action="niveaux">${t('Changer de difficulté')}</button>`;
    }
    return '';
}

// Bandeau au-dessus de la table : qui attaque, et sur quelle stat
function annonceStatHTML() {
    const c = deckDuel.combat;
    if (!c) return '<div class="stat-annoncee vide"></div>';
    if (c.stat === null) return `<div class="stat-annoncee">Σ <b>${t('Manche décisive : total des stats')}</b></div>`;
    const ordi = c.par === 'ordi';
    return `<div class="stat-annoncee${ordi ? ' par-ordi' : ''}">⚔ <span>${ordi ? t('Attaque de l’ordinateur :') : t('Ton attaque :')}</span>
        <b>${STATS[c.stat].icone} ${STATS[c.stat].nom}</b></div>`;
}

// Gros message au centre de l'écran (« Tu commences ! », « L'ordinateur attaque ! »…), qui disparaît tout seul
function annonceDeck(texte, qui) {
    const annonce = document.createElement('div');
    annonce.className = `annonce-deck ${qui}`;
    annonce.setAttribute('role', 'status');
    annonce.textContent = texte;
    document.body.append(annonce);
    setTimeout(() => annonce.remove(), 1700);
}

function plateauDeckHTML() {
    const d = deckDuel;
    const c = d.combat;
    const pips = qui => Array.from({ length: POINTS_VICTOIRE_DECK }, (_, i) => {
        const plein = i < d.score[qui];
        const nouveau = plein && d.pointMarque === qui && i === d.score[qui] - 1;
        return `<i class="${plein ? 'plein' : ''}${nouveau ? ' nouveau' : ''}"></i>`;
    }).join('');
    const dos = '<div class="dos-carte" aria-hidden="true"><span>GC</span></div>';
    const resultat = qui => (!c || !c.ecart ? '' : (qui === 'moi') === (c.ecart > 0) ? ' gagne' : ' perd');
    // Manche décisive : le total des stats s'affiche sur chaque carte
    const total = carte => (c && c.stat === null && carte ? `<span class="total-deck">Σ ${totalStats(carte)}</span>` : '');
    const carteOrdi = !c?.ordi ? '' : c.revele ? flipHTML(c.ordi) : c.cache ? dos : carteHTML(c.ordi);
    const mainOrdi = d.ordi.filter(carte => carte !== c?.ordi);
    const table = `${annonceStatHTML()}
        <div class="decks-combat${c?.ecart !== undefined ? ' compare' : ''}">
            <div class="duel-emplacement${resultat('moi')}${['moi', 'les-deux'].includes(c?.arrivee) ? ' arrivee-moi' : ''}" data-titre="${t('Ta carte')}">
                ${c?.moi ? carteHTML(c.moi, { holo: c.moi.holos > 0 }) : ''}${total(c?.moi)}
            </div>
            <div class="duel-emplacement${resultat('ordi')}${['ordi', 'les-deux'].includes(c?.arrivee) ? ' arrivee-ordi' : ''}" data-titre="${t('Ordinateur')}">
                ${carteOrdi}${total(c?.ordi)}
            </div>
        </div>`;
    return `
        <div class="duel-score">
            <div class="duel-joueur-score"><span>${t('Toi')}</span><div class="pips">${pips('moi')}</div></div>
            <div class="duel-infos"><div class="duel-vs">VS</div><span>${d.niveau.nom}</span></div>
            <div class="duel-joueur-score"><span>${t('Ordi')}</span><div class="pips">${pips('ordi')}</div></div>
        </div>
        <div class="decks-main decks-ordi">${mainOrdi.map(() => dos).join('')}</div>
        ${table}
        <p class="duel-message${d.actions === 'fin' ? ' resultat-final' : ''}">${d.message}</p>
        <div class="duel-actions">${actionsDeckHTML()}</div>
        <div class="decks-main">${d.moi.map((carte, i) => `
            <button class="carte-main${d.carte === i ? ' choisie' : ''}" data-carte-main="${i}"${d.attente && !d.verrou ? '' : ' disabled'}>
                ${carteHTML(carte, { holo: carte.holos > 0 })}
            </button>`).join('')}</div>`;
}

function afficherDuelDecks() {
    const d = deckDuel;
    const zone = $('#mode-decks');
    if (d.etape === 'niveau') zone.innerHTML = niveauxDeckHTML();
    else if (d.etape === 'deck') zone.innerHTML = choixDeckHTML();
    else {
        zone.innerHTML = plateauDeckHTML();
        // La stat comparée ressort sur les deux cartes de la table
        if (d.combat?.stat && d.combat.ecart !== undefined) surlignerStatDeck(d.combat.stat);
    }
}

const surlignerStatDeck = stat => document.querySelectorAll(`#mode-decks .decks-combat li[data-stat="${stat}"]`)
    .forEach(li => li.classList.add('stat-choisie'));

function lancerPartieDecks() {
    const d = deckDuel;
    d.choix = d.choix.filter(id => etat.collection[id]);
    if (!donneesPretes() || d.choix.length < TAILLE_DECK) return afficherDuelDecks();
    Object.assign(d, {
        moi: d.choix.map(id => ({ ...etat.collection[id] })),
        ordi: deckOrdinateur(d.niveau),
        score: { moi: 0, ordi: 0 },
        attaquant: Math.random() < 0.5 ? 'moi' : 'ordi',
        etape: 'partie', combat: null, actions: null, attente: null, pointMarque: null,
    });
    // Le premier attaquant est tiré au sort, le gros message de la première manche l'annonce
    mancheDecks(true);
}

// `premiere` : première manche, le gros message dit qui commence
function mancheDecks(premiere = false) {
    const d = deckDuel;
    Object.assign(d, { carte: null, combat: null, actions: null, attente: null, pointMarque: null });
    if (d.moi.length === 1 && d.score.moi === d.score.ordi) {
        d.actions = 'decisive';
        d.message = t('Égalité ! Dernière manche : vos dernières cartes se départagent au total de leurs stats.');
        annonceDeck(t('Manche décisive !'), 'decisive');
    } else if (d.attaquant === 'moi') {
        d.attente = 'attaque';
        d.message = t('À toi d’attaquer : choisis une carte, puis la stat sur laquelle tu l’engages.');
        annonceDeck(premiere ? t('Tu commences !') : t('À toi d’attaquer !'), 'moi');
    } else {
        const coup = coupOrdi('attaque');
        d.combat = { ordi: coup.carte, stat: coup.stat, cache: true, arrivee: 'ordi', par: 'ordi' };
        d.attente = 'defense';
        annonceDeck(premiere ? t('L’ordinateur commence !') : t('L’ordinateur attaque !'), 'ordi');
        d.message = t('L’ordinateur pose une carte face cachée et attaque en {stat}. Choisis ta carte pour défendre.', { stat: STATS[coup.stat].nom });
        jouerSon('carte');
    }
    afficherDuelDecks();
}

// Une manche en quatre temps : les cartes se posent, celle de l'ordinateur se retourne,
// la stat comparée s'allume, puis le résultat. `stat` vide : manche décisive, au total des stats.
async function resoudreMancheDecks(carteMoi, carteOrdi, stat) {
    const d = deckDuel;
    if (d.verrou) return;
    d.verrou = true;
    d.moi = d.moi.filter(c => c !== carteMoi);
    d.ordi = d.ordi.filter(c => c !== carteOrdi);
    const nomStat = stat ? `${STATS[stat].icone} ${STATS[stat].nom}` : t('Total des stats');
    Object.assign(d, {
        combat: { moi: carteMoi, ordi: carteOrdi, stat, revele: true, arrivee: d.combat?.cache ? 'moi' : 'les-deux', par: d.attaquant },
        attente: null, carte: null, actions: null, pointMarque: null,
        message: t('{stat} : qui l’emporte ?', { stat: nomStat }),
    });
    afficherDuelDecks();
    jouerSon('carte');
    await attendre(550);

    // La carte de l'ordinateur se retourne
    $('#mode-decks .decks-combat .flip')?.classList.add('retournee');
    jouerSon('carte');
    await attendre(800);

    // La stat comparée (ou le total) s'allume sur les deux cartes
    if (stat) surlignerStatDeck(stat);
    $('#mode-decks .decks-combat').classList.add('compare');
    await attendre(600);

    // Résultat
    const valeur = c => (stat ? c[stat] : totalStats(c));
    const ecart = valeur(carteMoi) - valeur(carteOrdi);
    if (ecart > 0) d.score.moi++;
    else if (ecart < 0) d.score.ordi++;
    const resultat = ecart > 0 ? t('Manche gagnée !') : ecart < 0 ? t('Manche perdue.') : t('Égalité parfaite, personne ne marque.');
    Object.assign(d, {
        combat: { moi: carteMoi, ordi: carteOrdi, stat, ecart, par: d.combat.par },
        pointMarque: ecart > 0 ? 'moi' : ecart < 0 ? 'ordi' : null,
        message: `${t('{stat} : <b>{a}</b> contre <b>{b}</b>.', { stat: nomStat, a: valeur(carteMoi), b: valeur(carteOrdi) })} <b>${resultat}</b>`,
        verrou: false,
    });
    jouerSon(ecart > 0 ? 'bonne' : ecart < 0 ? 'mauvaise' : 'carte');
    if (d.score.moi >= POINTS_VICTOIRE_DECK || d.score.ordi >= POINTS_VICTOIRE_DECK || !d.moi.length) {
        finPartieDecks(carteMoi, carteOrdi, stat);
    } else {
        d.attaquant = d.attaquant === 'moi' ? 'ordi' : 'moi';
        d.actions = 'suivante';
    }
    afficherDuelDecks();
}

function finPartieDecks(carteMoi, carteOrdi, stat) {
    const d = deckDuel;
    const { moi, ordi } = d.score;
    let gagnant = moi > ordi ? 'moi' : ordi > moi ? 'ordi' : null;
    // Toujours à égalité après la dernière manche : total des stats des dernières cartes jouées
    if (!gagnant && stat) {
        const ecart = totalStats(carteMoi) - totalStats(carteOrdi);
        gagnant = ecart > 0 ? 'moi' : ecart < 0 ? 'ordi' : null;
        d.message += ` ${t('Score à égalité : départage au total des stats des dernières cartes ({a} contre {b}).', { a: totalStats(carteMoi), b: totalStats(carteOrdi) })}`;
    }
    if (gagnant === 'moi') {
        const gain = gainDuJour('decks', d.niveau.gain);
        etat.pieces += gain.pieces;
        etat.stats.decksGagnes++;
        if (d.niveau.id === 'hardcore') etat.stats.decksHardcore++;
        sauvegarder();
        majEntete();
        toast(t('Victoire ! +{n} pièces', { n: gain.pieces }) + noteGain(gain.taux), 'gain');
        d.message += t('<br><b class="victoire">Victoire {a} à {b} !</b> Tu gagnes {n} pièces.', { a: moi, b: ordi, n: gain.pieces }) + noteGain(gain.taux);
    } else if (gagnant === 'ordi') {
        d.message += t('<br><b class="defaite">Défaite {a} à {b}.</b> Retente ta chance !', { a: moi, b: ordi });
    } else {
        d.message += t('<br><b>Match nul.</b>');
    }
    jouerSon(gagnant === 'moi' ? 'succes' : gagnant === 'ordi' ? 'mauvaise' : 'carte');
    d.actions = 'fin';
    verifierSucces();
}

function actionDuelDecks(element) {
    const d = deckDuel;
    if (d.verrou) return;
    const { niveau, choixDeck, carteMain, statDeck, deckAction } = element.dataset;
    if (niveau) {
        Object.assign(d, { niveau: NIVEAUX_DECK.find(n => n.id === niveau), choix: [], recherche: '', limite: CARTES_CHOIX_DECK, etape: 'deck' });
    } else if (choixDeck) {
        const id = Number(choixDeck);
        if (d.choix.includes(id)) d.choix = d.choix.filter(x => x !== id);
        else if (d.choix.length < TAILLE_DECK) d.choix.push(id);
        d.dernierAjout = d.choix.includes(id) ? id : null; // la carte qui vient d'arriver dans un emplacement s'anime
    } else if (carteMain !== undefined) {
        const i = Number(carteMain);
        if (d.attente === 'defense') return resoudreMancheDecks(d.moi[i], d.combat.ordi, d.combat.stat);
        if (d.attente === 'attaque') d.carte = i;
    } else if (statDeck) {
        return resoudreMancheDecks(d.moi[d.carte], coupOrdi('defense', statDeck), statDeck);
    } else if (deckAction === 'niveaux') {
        d.etape = 'niveau';
    } else if (deckAction === 'plus') {
        d.limite += CARTES_CHOIX_DECK;
    } else if (deckAction === 'lancer') {
        return lancerPartieDecks();
    } else if (deckAction === 'suivante') {
        return mancheDecks();
    } else if (deckAction === 'decisive') {
        return resoudreMancheDecks(d.moi[0], d.ordi[0], null);
    } else if (deckAction === 'rejouer') {
        d.choix = d.choix.filter(id => etat.collection[id]);
        d.etape = 'deck';
    }
    afficherDuelDecks();
}

// ---------- Sons (synthétisés avec Web Audio, coupés par défaut) ----------

let contexteAudio = null;

function jouerNote(frequence, debut, duree, { type = 'sine', volume = 0.15 } = {}) {
    const ctx = contexteAudio;
    const oscillateur = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillateur.type = type;
    oscillateur.frequency.value = frequence;
    const t = ctx.currentTime + debut;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    oscillateur.connect(gain).connect(ctx.destination);
    oscillateur.start(t);
    oscillateur.stop(t + duree + 0.05);
}

// Bruit filtré : froissement de papier, glissement de carte
function jouerBruit(duree, { filtre = 'bandpass', de = 4000, a = 800, volume = 0.25 } = {}) {
    const ctx = contexteAudio;
    const tampon = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duree), ctx.sampleRate);
    const echantillons = tampon.getChannelData(0);
    for (let i = 0; i < echantillons.length; i++) echantillons[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = tampon;
    const passeBande = ctx.createBiquadFilter();
    passeBande.type = filtre;
    const t = ctx.currentTime;
    passeBande.frequency.setValueAtTime(de, t);
    passeBande.frequency.exponentialRampToValueAtTime(a, t + duree);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    source.connect(passeBande).connect(gain).connect(ctx.destination);
    source.start(t);
}

const SONS = {
    dechirure: () => jouerBruit(0.35, { de: 6000, a: 900, volume: 0.3 }),
    carte: () => jouerBruit(0.12, { filtre: 'highpass', de: 2500, a: 5000, volume: 0.12 }),
    epique: () => [784, 1175].forEach((f, i) => jouerNote(f, i * 0.09, 0.35)),
    legendaire: () => [523, 659, 784, 1047].forEach((f, i) => jouerNote(f, i * 0.08, 0.5, { type: 'triangle' })),
    mythique: () => {
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => jouerNote(f, i * 0.07, 0.7, { type: 'triangle' }));
        jouerNote(2093, 0.45, 1.2, { volume: 0.08 });
    },
    godpack: () => {
        [392, 523, 659, 784].forEach((f, i) => jouerNote(f, i * 0.12, 0.6, { type: 'sawtooth', volume: 0.07 }));
        [1047, 1319, 1568].forEach(f => jouerNote(f, 0.55, 1.4, { type: 'triangle', volume: 0.1 }));
    },
    succes: () => {
        jouerNote(1047, 0, 0.3);
        jouerNote(1568, 0.1, 0.5);
    },
    bonne: () => {
        jouerNote(660, 0, 0.12);
        jouerNote(990, 0.08, 0.2);
    },
    mauvaise: () => jouerNote(180, 0, 0.35, { type: 'square', volume: 0.06 }),
};

function jouerSon(nom) {
    if (!etat.reglages.sons) return;
    try {
        contexteAudio ??= new (window.AudioContext || window.webkitAudioContext)();
        if (contexteAudio.state === 'suspended') contexteAudio.resume();
        SONS[nom]?.();
    } catch (e) {
        console.warn('Son impossible', e);
    }
}

function jouerSonRarete(rarete) {
    if (rarete === 'mythique' || rarete === 'legendaire' || rarete === 'epique') jouerSon(rarete);
}

// ---------- Sauvegarde dans un fichier ----------

function exporterSauvegarde() {
    const donnees = {};
    for (const cle of Object.keys(localStorage)) if (cle.startsWith('gameCards.')) donnees[cle] = localStorage.getItem(cle);
    const contenu = JSON.stringify({ jeu: 'GameCards', version: 1, date: new Date().toISOString(), donnees });
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
    lien.download = `gamecards-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
    toast(t('Sauvegarde téléchargée'), 'gain');
}

async function importerSauvegarde(fichier) {
    try {
        const contenu = JSON.parse(await fichier.text());
        const donnees = contenu?.donnees;
        if (contenu?.jeu !== 'GameCards' || !donnees || typeof donnees !== 'object') throw new Error('format inconnu');
        const cles = Object.keys(donnees).filter(cle => cle.startsWith('gameCards.') && typeof donnees[cle] === 'string');
        if (!cles.length) throw new Error('sauvegarde vide');
        const date = new Date(contenu.date).toLocaleDateString(LOCALE);
        if (!confirm(t('Remplacer ta progression actuelle par la sauvegarde du {date} ?', { date }))) return;
        Object.keys(localStorage).filter(cle => cle.startsWith('gameCards.')).forEach(cle => localStorage.removeItem(cle));
        for (const cle of cles) localStorage.setItem(cle, donnees[cle]);
        location.hash = '#accueil';
        location.reload();
    } catch (e) {
        console.warn(e);
        toast(t('Ce fichier n’est pas une sauvegarde GameCards valide'), 'erreur');
    }
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
    if (nom === 'profil') afficherProfil();
    window.scrollTo(0, 0);
}

// ---------- Démarrage ----------

function init() {
    traduirePage();

    // Accueil : paquets et ouverture
    $('#paquet-gratuit').addEventListener('click', () => cliquerPaquet(TYPES_BOOSTER.standard));
    $('#paquet-prestige').addEventListener('click', () => cliquerPaquet(TYPES_BOOSTER.prestige));
    $('#btn-tout-ouvrir').addEventListener('click', () =>
        ouvrirBooster('gratuit', chargesDispo(TYPES_BOOSTER.standard), TYPES_BOOSTER.standard));
    // Fenêtre d'achat (plus de booster gratuit)
    $('#modale-contenu').addEventListener('click', e => {
        const bouton = e.target.closest('[data-acheter-booster]');
        if (!bouton) return;
        $('#modale').close();
        ouvrirBooster('achat', Number(bouton.dataset.nombre), TYPES_BOOSTER[bouton.dataset.acheterBooster]);
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
    // Écran de bilan : retour aux paquets de l'accueil
    $('#btn-retour').addEventListener('click', afficherAccueil);
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
    for (const id of ['#filtre-genre', '#tri', '#filtre-doublons', '#filtre-fullart', '#filtre-ex']) $(id).addEventListener('change', filtrerCollection);
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

    // Clics partagés : ouvrir une fiche, acheter une carte, vendre un exemplaire
    document.addEventListener('click', e => {
        const acheter = e.target.closest('[data-acheter]');
        if (acheter) return acheterCarte(Number(acheter.dataset.acheter));
        const vendre = e.target.closest('[data-vendre]');
        if (vendre) {
            const id = Number(vendre.dataset.vendre);
            vendreDepuisFiche(id, vendre.dataset.variante);
            if ($('#modale').open) afficherFiche(id);
            return;
        }
        const choixVente = e.target.closest('[data-choix-vente], [data-annuler-vente]');
        if (choixVente) {
            const choisir = choixVente.matches('[data-choix-vente]');
            $('#modale [data-choix-vente]').hidden = choisir;
            $('#modale .fiche-vente').hidden = !choisir;
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
    // Récompense du jour : depuis la fenêtre d'arrivée ou le Profil
    document.addEventListener('click', e => {
        if (e.target.closest('[data-connexion]')) recupererConnexion();
    });
    // Jeu resté ouvert : la récompense du lendemain est proposée au retour sur l'onglet
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible' || !donneesPretes()) return;
        majBadgeSucces();
        if (!ouvertureEnCours) proposerConnexion();
    });

    // Duel
    $('#duel-actions').addEventListener('click', e => {
        const bouton = e.target.closest('button');
        if (!bouton) return;
        if (bouton.dataset.stat) choisirStat(bouton.dataset.stat);
        else if (bouton.dataset.action === 'demarrer') demarrerDuel();
        else if (bouton.dataset.action === 'manche') nouvelleManche();
    });

    // Jouer : onglets, Plus ou moins
    $('#onglets-jeu').addEventListener('click', e => {
        const onglet = e.target.closest('[data-mode]');
        if (onglet) changerModeJeu(onglet.dataset.mode);
    });
    $('#mode-decks').addEventListener('click', e => {
        const element = e.target.closest('[data-niveau], [data-choix-deck], [data-carte-main], [data-stat-deck], [data-deck-action]');
        if (element && !element.disabled) actionDuelDecks(element);
    });
    // Recherche pendant la composition du deck : on garde le curseur dans le champ
    $('#mode-decks').addEventListener('change', e => {
        if (e.target.id !== 'deck-tri') return;
        Object.assign(deckDuel, { tri: e.target.value, limite: CARTES_CHOIX_DECK });
        afficherDuelDecks();
    });
    $('#mode-decks').addEventListener('input', e => {
        if (e.target.id !== 'deck-recherche') return;
        Object.assign(deckDuel, { recherche: e.target.value, limite: CARTES_CHOIX_DECK });
        afficherDuelDecks();
        const champ = $('#deck-recherche');
        champ.focus();
        champ.setSelectionRange(champ.value.length, champ.value.length);
    });
    $('#pom-plateau').addEventListener('click', e => {
        const choix = e.target.closest('[data-pom]');
        if (choix) repondrePom(Number(choix.dataset.pom));
    });
    $('#pom-actions').addEventListener('click', e => {
        if (e.target.closest('[data-pom-action]')) nouvelleQuestionPom();
    });

    // Profil : sons, sauvegarde dans un fichier
    $('#reglage-sons').addEventListener('change', e => {
        etat.reglages.sons = e.target.checked;
        sauvegarder();
        jouerSon('succes');
    });
    // Langue : on recharge la page, tous les textes repartent dans la nouvelle langue
    $('#reglage-langue').innerHTML = Object.entries(LANGUES)
        .map(([code, nom]) => `<option value="${code}"${code === LANGUE ? ' selected' : ''}>${nom}</option>`).join('');
    $('#reglage-langue').addEventListener('change', e => {
        etat.reglages.langue = e.target.value;
        sauvegarder();
        location.reload();
    });
    $('#succes-grille').addEventListener('click', e => {
        const bouton = e.target.closest('[data-recuperer]');
        if (bouton) recupererSucces(bouton.dataset.recuperer);
    });
    $('#btn-tout-recuperer').addEventListener('click', toutRecuperer);
    $('#btn-exporter').addEventListener('click', exporterSauvegarde);
    $('#btn-importer').addEventListener('click', () => $('#fichier-import').click());
    $('#fichier-import').addEventListener('change', e => {
        if (e.target.files[0]) importerSauvegarde(e.target.files[0]);
        e.target.value = '';
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
            const ecran = location.hash.slice(1) || 'accueil';
            if (ecran === 'accueil') afficherAccueil();
            if (ecran === 'regles') afficherRegles();
            if (ecran === 'catalogue') afficherCatalogue();
            if (ecran === 'collection') afficherCollection();
            if (ecran === 'profil') afficherProfil();
            if (!$('#mode-pom').hidden) nouvelleQuestionPom();
            verifierSucces(); // succès déjà atteints par une collection existante
            majBadgeSucces();
            proposerConnexion();
        })
        .catch(e => {
            console.error(e);
            toast(t('Impossible de charger les jeux (lance le site via WAMP ou Live Server)'), 'erreur');
        });
}

init();

// Application installable : le service worker garde le jeu en cache pour y rejouer hors ligne
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker indisponible', e));
}
