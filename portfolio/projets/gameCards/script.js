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
//   `chanceDraft`     : les cartes proposées en draft (toi et l'ordinateur)
// Chaque colonne de chances doit faire 100 au total ; 0 interdit la rareté.
// `prix` : achat direct dans le catalogue, volontairement bien plus cher que la chance en boosters.
// `stats` : fourchette des stats de jeu de la rareté ; les vraies données placent la carte dans cette fourchette,
// Les fourchettes se chevauchent : une carte rare est en général plus forte, mais une excellente Légendaire
// peut dépasser une Mythique moyenne sur son point fort.
const RARETES = [
    { id: 'mythique',    nom: t('Mythique'),    quota: null, stats: [55, 100], chance: 0.1, chanceGarantie: 0.1, chancePrestige: 0.2,  chancePrestigeGarantie: 1,  chanceDuel: 3,  chanceDraft: 2,  revente: 1500, prix: 10000 },
    { id: 'legendaire',  nom: t('Légendaire'),  quota: 110,  stats: [45, 95],  chance: 0.5, chanceGarantie: 0.9, chancePrestige: 1,    chancePrestigeGarantie: 5,  chanceDuel: 7,  chanceDraft: 8,  revente: 500, prix: 4000 },
    { id: 'epique',      nom: t('Épique'),      quota: 600,  stats: [35, 90],  chance: 2, chanceGarantie: 12,  chancePrestige: 6,    chancePrestigeGarantie: 94, chanceDuel: 12, chanceDraft: 20, revente: 40,  prix: 1500 },
    { id: 'rare',        nom: t('Rare'),        quota: 1500, stats: [25, 85],  chance: 6, chanceGarantie: 30,  chancePrestige: 22.8, chancePrestigeGarantie: 0,  chanceDuel: 18, chanceDraft: 30, revente: 15,  prix: 600 },
    { id: 'peu-commune', nom: t('Peu commune'), quota: 3000, stats: [15, 80],  chance: 18, chanceGarantie: 57,  chancePrestige: 70,   chancePrestigeGarantie: 0,  chanceDuel: 25, chanceDraft: 25, revente: 5,   prix: 250 },
    { id: 'commune',     nom: t('Commune'),     quota: null, stats: [5, 75],   chance: 73.4, chanceGarantie: 0,   chancePrestige: 0,    chancePrestigeGarantie: 0,  chanceDuel: 35, chanceDraft: 15, revente: 2,   prix: 100 },
    // Promo : hors du tirage (toutes ses chances à 0), obtenue seulement avec un code cadeau (voir PROMOS) ;
    // ni vendue ni achetée, stats choisies à la main
    { id: 'promo',       nom: t('Promo'),       quota: null, stats: [30, 100],  chance: 0, chanceGarantie: 0,     chancePrestige: 0,    chancePrestigeGarantie: 0,  chanceDuel: 0,  chanceDraft: 0,  revente: 300, prix: 0, promo: true },
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

// Les boosters ne donnent que des cartes pas encore possédées ; seule exception, une Légendaire ou Mythique
// est un doublon 1 fois sur 20 (bien revendu, voir `revente`)
const CHANCE_DOUBLON = 0.05;

const CARTES_PAR_BOOSTER = 5;
const BOOSTERS_PAR_LOT = 10; // ouverture ×10
const BOOSTERS_MAX_ACHAT = 100; // achat « Tout dépenser » : autant de boosters que les pièces le permettent, au plus 100
const PRIX_BOOSTER = 50; //50

// Les deux boosters. Chacun se recharge gratuitement (`recharge` ms), avec une réserve de `stockMax` ;
// quand il n'en reste plus, on peut en acheter (`prix` pièces). `gain` : pièces gagnées à chaque ouverture.
// `paquet` : le paquet de l'accueil.
const TYPES_BOOSTER = {
    standard: { id: 'standard', nom: t('booster'), prix: PRIX_BOOSTER, gain: 5, recharge: 5 * 60 * 1000, stockMax: 10, paquet: '#paquet-gratuit' },
    prestige: { id: 'prestige', nom: 'Prestige', prix: 250, gain: 25, recharge: 24 * 60 * 60 * 1000, stockMax: 1, prestige: true, paquet: '#paquet-prestige' },
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
    332800: { popularite: 87 },               // Five Nights at Freddy's 2 : porté par le phénomène FNAF
    388090: { popularite: 85 },               // Five Nights at Freddy's 4
    814380: { attaque: 93 },                  // Sekiro : GOTY 2019, ex-Mythique
    304240: { popularite: 92 },               // Resident Evil (1996) : le fondateur du survival horror

    // Mythiques : leurs vraies stats Steam, ajustées de quelques points seulement. Elles ne sont pas toutes
    // aussi fortes : (Qualité + Popularité) de 192 à 196 pour les titans, 188 à 191 pour le cœur,
    // 185 à 187 pour les classiques surtout joués sur console (leurs chiffres Steam les sous-estiment déjà).
    // Titans
    1086940: { attaque: 97, popularite: 97 }, // Baldur's Gate 3 (194)
    292030: { attaque: 96, popularite: 97 },  // The Witcher 3: Wild Hunt (193)
    1245620: { attaque: 98, popularite: 98 }, // Elden Ring (196)
    105600: { attaque: 95, popularite: 98 },  // Terraria (193)
    620: { attaque: 99, popularite: 93 },     // Portal 2 (192)
    4000: { attaque: 94, popularite: 98 },    // Garry's Mod (192)
    1174180: { attaque: 95, popularite: 97 }, // Red Dead Redemption 2 (192)
    // Cœur
    489830: { attaque: 95, popularite: 96 },  // The Elder Scrolls V: Skyrim Special Edition (191)
    220: { attaque: 98, popularite: 92 },     // Half-Life 2 (190)
    391540: { attaque: 97, popularite: 93 },  // Undertale (190)
    1593500: { attaque: 96, popularite: 94 }, // God of War (190)
    271590: { attaque: 90, popularite: 100 }, // Grand Theft Auto V (190)
    1903340: { attaque: 97, popularite: 92 }, // Clair Obscur: Expedition 33 (189)
    379720: { attaque: 96, popularite: 93 },  // DOOM (189)
    730: { attaque: 88, popularite: 100 },    // Counter-Strike 2 (188)
    // Classiques de console, et Cyberpunk (lancement raté)
    10180: { attaque: 94, popularite: 93 },   // Call of Duty: Modern Warfare 2 (2009) (187)
    319510: { attaque: 91, popularite: 97 },  // Five Nights at Freddy's (187)
    1091500: { attaque: 89, popularite: 97 }, // Cyberpunk 2077 (186)
    254700: { attaque: 94, popularite: 92 },  // Resident Evil 4 (2005) (186)
    39140: { attaque: 94, popularite: 91 },   // Final Fantasy VII (185)
    33230: { attaque: 90, popularite: 95 },   // Assassin's Creed II (185)
    1328670: { attaque: 95, popularite: 90 }, // Mass Effect Legendary Edition (185)
};

// Score de prestige des autres jeux : 75 % popularité + 25 % qualité + bonus
//   popularité = 75 % avis Steam (1 → 0, 1 million → 100) + 25 % joueurs estimés (1 → 0, 100 millions → 100)
//   qualité    = note public (corrigée pour les jeux à peu d'avis), moyennée avec Metacritic quand il y en a une
const POIDS_POPULARITE = 0.75;
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
// Marché du jour (catalogue) : une carte de chacune de ces raretés, pas encore possédée, à prix réduit
const MARCHE_RARETES = ['rare', 'epique', 'legendaire'];
const REMISE_MARCHE = 0.5;
// Codes cadeaux (Profil), un seul usage par sauvegarde. Récompenses : { pieces }, { boosters }, { prestiges },
// { fullArt } (un paquet Full Art) et { carte: identifiant Steam } (cette carte précise)
const CODES_CADEAUX = {
    // Clés en base64 (btoa du code en majuscules) : les codes sont à trouver, pas à lire dans le script
    'V0VMQ09NRQ==': { pieces: 300 }, // bienvenue
    'Qk9PU1RFUlM=': { boosters: 10 }, // boosters
    'UFJFU1RJR0U=': { prestiges: 1 }, // prestige
    'VEhYRk9SUExBWUlORw==': { fullArt: true }, // merci d'avoir joué
    'SEVTT1lBTQ==': { secret: true, pieces: 250 }, // triche de GTA San Andreas
    'TU9USEVSTE9ERQ==': { secret: true, pieces: 250 }, // triche des Sims
    'SUREUUQ=': { secret: true, prestiges: 1 }, // mode dieu de Doom
    'VEhFQ0FLRUlTQUxJRQ==': { secret: true, boosterSerie: 'hasard' }, // Portal : un booster promo d'une série au hasard
    'R0FCRU4=': { secret: true, fullArt: true }, // le patron de Steam
    'REVWVE9PTFM=': { secret: true, boosters: 3 }, // affiché dans la console du navigateur
    'Q09ERVNPVVJDRQ==': { secret: true, pieces: 300 }, // caché dans un commentaire d'index.html
    'Q09VTlRFUlNUUklLRQ==': { secret: true, prestiges: 1 }, // réponse de l'énigme du Profil (le jeu n° 10 sur Steam) 
}; 
// Le code Konami (↑ ↑ ↓ ↓ ← → ← → B A) se tape au clavier n'importe où, pas dans le champ
const CODE_KONAMI = { recompense: { prestiges: 1, pieces: 500 }, touches: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'] };
// Cartes promo (rareté Promo) : une édition spéciale d'un jeu, distincte de sa carte normale (identifiant à part, négatif),
// obtenue seulement avec un code cadeau ({ promo: identifiant }) : jamais dans les boosters, le catalogue ni le draft.
// `steam` : le jeu d'origine (image, fiche Steam) ; `serie` et `numero` : affichés « S1 · #001 » ; `stats` : Qualité et Popularité
// choisies à la main (l'Ancienneté reste celle du jeu) ; `image` : illustration verticale à part (dossier promos/) ;
// `jeu` : infos du jeu quand il manque au dataset (genres et thèmes en français, traduits au chargement) ;
// `site` : lien officiel d'un jeu hors Steam, à la place de la page Steam ;
// `encres` : les deux encres de la risographie (série 3) : [ombres, lumières] ; `nom` : nom affiché, s'il diffère de celui de Steam
const PROMOS = {
    [-3602290]: { steam: 3602290, serie: 1, numero: 1, stats: { attaque: 93, popularite: 85 }, image: 'promos/001.png?v=2' }, // FEMBOY FUTA HOUSE
    [-1245620]: { steam: 1245620, serie: 1, numero: 2, stats: { attaque: 99, popularite: 99 }, image: 'promos/002.png' }, // ELDEN RING
    [-553850]: { steam: 553850, serie: 1, numero: 3, stats: { attaque: 94, popularite: 97 }, image: 'promos/003.png' }, // HELLDIVERS 2
    [-753640]: { steam: 753640, serie: 1, numero: 4, stats: { attaque: 97, popularite: 92 }, image: 'promos/004.png' }, // OUTER WILDS
    [-319510]: { steam: 319510, serie: 1, numero: 5, stats: { attaque: 93, popularite: 99 }, image: 'promos/005.png' }, // FIVE NIGHTS AT FREDDY'S
    [-1903340]: { steam: 1903340, serie: 1, numero: 6, stats: { attaque: 98, popularite: 96 }, image: 'promos/006.png' }, // CLAIR OBSCUR: EXPEDITION 33
    [-1150690]: { steam: 1150690, serie: 1, numero: 7, stats: { attaque: 96, popularite: 80 }, image: 'promos/007.png' }, // OMORI
    [-2592160]: { steam: 2592160, serie: 1, numero: 8, stats: { attaque: 95, popularite: 90 }, image: 'promos/008.png' }, // DISPATCH
    [-1223750]: { steam: 1223750, serie: 1, numero: 9, stats: { attaque: 92, popularite: 80 }, image: 'promos/009.png' }, // CLOUD MEADOW
    // Absent du dataset Steam : infos du jeu données ici (avis et note relevés sur Steam)
    [-242050]: { steam: 242050, serie: 1, numero: 10, stats: { attaque: 95, popularite: 92 }, image: 'promos/010.png', // ASSASSIN'S CREED IV BLACK FLAG
        jeu: { nom: 'Assassin’s Creed® IV Black Flag', annee: 2013, avis: 72357, note: 88, metacritic: 84, genres: ['Action', 'Aventure'], tags: ['Monde ouvert', 'Infiltration', 'Multijoueur', 'Narratif'] } },

    // Série 2 : jeux hors Steam (pas de `steam`, identifiants -900001…), avec le lien de leur site officiel
    [-900001]: { serie: 2, numero: 1, stats: { attaque: 96, popularite: 99 }, image: 'promos/s2-001.png', site: 'https://www.minecraft.net',
        jeu: { nom: 'Minecraft', annee: 2011, metacritic: 93, genres: ['Aventure', 'Simulation'], tags: ['Bac à sable', 'Survie', 'Monde ouvert', 'Multijoueur', 'Coopération', 'Pixel art'] } },
    [-900002]: { serie: 2, numero: 2, stats: { attaque: 94, popularite: 98 }, image: 'promos/s2-002.png', site: 'https://www.leagueoflegends.com',
        jeu: { nom: 'League of Legends', annee: 2009, metacritic: 78, genres: ['Stratégie', 'Action', 'Free-to-play'], tags: ['Multijoueur', 'Fantasy'] } },
    [-900003]: { serie: 2, numero: 3, stats: { attaque: 89, popularite: 96 }, image: 'promos/s2-003.jpg', site: 'https://playvalorant.com',
        jeu: { nom: 'VALORANT', annee: 2020, metacritic: 80, genres: ['Action', 'Free-to-play'], tags: ['Tir', 'Multijoueur', 'Science-fiction'] } },
    [-900004]: { serie: 2, numero: 4, stats: { attaque: 89, popularite: 96 }, image: 'promos/s2-004.png', site: 'https://genshin.hoyoverse.com',
        jeu: { nom: 'Genshin Impact', annee: 2020, metacritic: 84, genres: ['Action', 'Aventure', 'RPG', 'Free-to-play'], tags: ['Monde ouvert', 'Anime', 'Fantasy', 'Coopération'] } },
    [-900005]: { serie: 2, numero: 5, stats: { attaque: 86, popularite: 99 }, image: 'promos/s2-005.png', site: 'https://www.fortnite.com',
        jeu: { nom: 'Fortnite', annee: 2017, metacritic: 81, genres: ['Action', 'Free-to-play'], tags: ['Battle royale', 'Tir', 'Bac à sable', 'Multijoueur', 'Coopération', 'Comédie'] } },

    // Série 4 « Rétro » : les classiques d'avant 2000, hors Steam (identifiants -900101…)
    [-900101]: { serie: 4, numero: 1, stats: { attaque: 85, popularite: 92 }, image: 'promos/s4-001.jpg?v=3', site: 'https://pacman.com',
        jeu: { nom: 'PAC-MAN', annee: 1980, genres: ['Action', 'Casual'], tags: ['Pixel art'] } },
    [-900102]: { serie: 4, numero: 2, stats: { attaque: 90, popularite: 93 }, image: 'promos/s4-002.jpg?v=3', site: 'https://mario.nintendo.com',
        jeu: { nom: 'Super Mario Bros.', annee: 1985, genres: ['Action', 'Aventure'], tags: ['Plateforme', 'Pixel art'] } },
    [-900103]: { serie: 4, numero: 3, stats: { attaque: 88, popularite: 92 }, image: 'promos/s4-003.jpg?v=3', site: 'https://tetris.com',
        jeu: { nom: 'Tetris', annee: 1984, genres: ['Casual', 'Stratégie'], tags: ['Réflexion', 'Pixel art'] } },
    [-900104]: { serie: 4, numero: 4, stats: { attaque: 87, popularite: 93 }, image: 'promos/s4-004.jpg?v=4', site: 'https://www.pokemon.com',
        jeu: { nom: 'Pokémon Rouge / Bleu', annee: 1996, genres: ['RPG', 'Aventure'], tags: ['JRPG', 'Tour par tour', 'Pixel art'] } },
    [-900105]: { serie: 4, numero: 5, stats: { attaque: 95, popularite: 85 }, image: 'promos/s4-005.jpg?v=3', site: 'https://www.zelda.com',
        jeu: { nom: 'The Legend of Zelda: Ocarina of Time', annee: 1998, metacritic: 99, genres: ['Action', 'Aventure'], tags: ['Fantasy', 'Réflexion'] } },

    // Série 3 « Indé » : des pépites très bien notées, sur Steam
    [-1002300]: { steam: 1002300, serie: 3, numero: 1, stats: { attaque: 95, popularite: 82 }, image: 'promos/s3-001.jpg?v=3', encres: ['#3a0d12', '#e9dcc4'] }, // FEAR & HUNGER
    [-433340]: { steam: 433340, serie: 3, numero: 2, stats: { attaque: 95, popularite: 84 }, image: 'promos/s3-002.jpg?v=3', encres: ['#5b2a86', '#ff9ad5'] }, // SLIME RANCHER
    [-3180070]: { steam: 3180070, serie: 3, numero: 3, stats: { attaque: 95, popularite: 82 }, image: 'promos/s3-003.jpg?v=3', encres: ['#0e3b2e', '#ff4a3d'] }, // NO, I'M NOT A HUMAN
    [-1055540]: { steam: 1055540, serie: 3, numero: 4, stats: { attaque: 97, popularite: 80 }, image: 'promos/s3-004.jpg?v=3', encres: ['#5a3d8a', '#ffc38a'] }, // A SHORT HIKE
    [-1931770]: { steam: 1931770, serie: 3, numero: 5, stats: { attaque: 96, popularite: 80 }, image: 'promos/s3-005.jpg?v=3', encres: ['#7a1838', '#ffe14d'] }, // CHANTS OF SENNAAR
    [-557600]: { steam: 557600, serie: 3, numero: 6, stats: { attaque: 95, popularite: 80 }, image: 'promos/s3-006.jpg?v=3', encres: ['#1d3d2a', '#f2c94c'] }, // GOROGOA
    [-257850]: { steam: 257850, serie: 3, numero: 7, stats: { attaque: 94, popularite: 80 }, image: 'promos/s3-007.jpg?v=3', encres: ['#3b1f8f', '#ff3fa4'] }, // HYPER LIGHT DRIFTER
    [-481510]: { steam: 481510, serie: 3, numero: 8, stats: { attaque: 94, popularite: 80 }, image: 'promos/s3-008.jpg?v=3', encres: ['#1b2440', '#ff8a3d'] }, // NIGHT IN THE WOODS
    [-2062430]: { steam: 2062430, serie: 3, numero: 9, stats: { attaque: 95, popularite: 82 }, image: 'promos/s3-009.jpg?v=3', encres: ['#3a0d1a', '#ff6a2a'] }, // BALL X PIT
    [-553420]: { steam: 553420, serie: 3, numero: 10, stats: { attaque: 95, popularite: 80 }, image: 'promos/s3-010.jpg?v=3', encres: ['#123d33', '#ffb347'] }, // TUNIC

    // Série 5 « Romance » : des jeux dont l'histoire d'amour est le cœur, sur Steam
    [-698780]: { steam: 698780, serie: 5, numero: 1, stats: { attaque: 96, popularite: 90 }, image: 'promos/s5-001.jpg' }, // DOKI DOKI LITERATURE CLUB!
    [-1289310]: { steam: 1289310, serie: 5, numero: 2, stats: { attaque: 94, popularite: 87 }, image: 'promos/s5-002.jpg' }, // HELLTAKER
    [-1144400]: { steam: 1144400, serie: 5, numero: 3, stats: { attaque: 94, popularite: 85 }, image: 'promos/s5-003.jpg' }, // SENREN＊BANKA
    [-1230140]: { steam: 1230140, serie: 5, numero: 4, stats: { attaque: 94, popularite: 84 }, image: 'promos/s5-004.jpg' }, // ATRI -MY DEAR MOMENTS-
    [-1669980]: { steam: 1669980, serie: 5, numero: 5, stats: { attaque: 93, popularite: 85 }, image: 'promos/s5-005.jpg' }, // VOLCANO PRINCESS
    [-339800]: { steam: 339800, serie: 5, numero: 6, stats: { attaque: 92, popularite: 85 }, image: 'promos/s5-006.jpg' }, // HUNIEPOP
    [-2322560]: { steam: 2322560, serie: 5, numero: 7, stats: { attaque: 92, popularite: 85 }, image: 'promos/s5-007.jpg' }, // LOVE IS ALL AROUND
    [-331470]: { steam: 331470, serie: 5, numero: 8, stats: { attaque: 92, popularite: 85 }, image: 'promos/s5-008.jpg' }, // EVERLASTING SUMMER
    [-333600]: { steam: 333600, serie: 5, numero: 9, stats: { attaque: 92, popularite: 84 }, image: 'promos/s5-009.jpg' }, // NEKOPARA VOL. 1
    [-1451940]: { steam: 1451940, serie: 5, numero: 10, stats: { attaque: 95, popularite: 86 }, image: 'promos/s5-010.jpg', nom: 'NEEDY GIRL OVERDOSE' }, // NEEDY STREAMER OVERLOAD sur Steam

    // Série 6 « Nintendo Switch » : les exclusivités de la console, hors Steam (identifiants -900201…)
    [-900201]: { serie: 6, numero: 1, stats: { attaque: 97, popularite: 95 }, image: 'promos/s6-001.jpg?v=3', site: 'https://www.zelda.com',
        jeu: { nom: 'The Legend of Zelda: Breath of the Wild', annee: 2017, metacritic: 97, genres: ['Action', 'Aventure'], tags: ['Monde ouvert', 'Survie', 'Fantasy'] } },
    [-900202]: { serie: 6, numero: 2, stats: { attaque: 96, popularite: 96 }, image: 'promos/s6-002.jpg?v=3', site: 'https://www.nintendo.com',
        jeu: { nom: 'Super Mario Odyssey', annee: 2017, metacritic: 97, genres: ['Action', 'Aventure'], tags: ['Plateforme', 'Monde ouvert', 'Coopération'] } },
    [-900203]: { serie: 6, numero: 3, stats: { attaque: 93, popularite: 93 }, image: 'promos/s6-003.jpg?v=3', site: 'https://www.smashbros.com',
        jeu: { nom: 'Super Smash Bros. Ultimate', annee: 2018, metacritic: 93, genres: ['Action'], tags: ['Combat en duel', 'Multijoueur', 'Coopération'] } },
    [-900204]: { serie: 6, numero: 4, stats: { attaque: 92, popularite: 95 }, image: 'promos/s6-004.jpg?v=3', site: 'https://www.animal-crossing.com',
        jeu: { nom: 'Animal Crossing: New Horizons', annee: 2020, metacritic: 90, genres: ['Simulation', 'Casual'], tags: ['Simulation de vie', 'Relaxant', 'Multijoueur', 'Coopération'] } },
    [-900205]: { serie: 6, numero: 5, stats: { attaque: 90, popularite: 95 }, image: 'promos/s6-005.jpg?v=3', site: 'https://www.pokemon.com',
        jeu: { nom: 'Pokémon Legends: Z-A', annee: 2025, genres: ['Action', 'RPG'], tags: ['JRPG', 'Monde ouvert', 'Fantasy'] } },

    // Série 7 « Science-fiction » : cyberpunk, androïdes et futurs proches, sur Steam (style HUD futuriste)
    [-1091500]: { steam: 1091500, serie: 7, numero: 1, stats: { attaque: 98, popularite: 98 }, image: 'promos/s7-001.jpg' }, // CYBERPUNK 2077
    [-238010]: { steam: 238010, serie: 7, numero: 2, stats: { attaque: 92, popularite: 84 }, image: 'promos/s7-002.jpg', nom: 'Deus Ex: Human Revolution' }, // DEUS EX: HUMAN REVOLUTION
    [-1328670]: { steam: 1328670, serie: 7, numero: 3, stats: { attaque: 96, popularite: 91 }, image: 'promos/s7-003.jpg', nom: 'Mass Effect Legendary Edition' }, // MASS EFFECT LEGENDARY EDITION
    [-620]: { steam: 620, serie: 7, numero: 4, stats: { attaque: 99, popularite: 94 }, image: 'promos/s7-004.jpg' }, // PORTAL 2
    [-220]: { steam: 220, serie: 7, numero: 5, stats: { attaque: 98, popularite: 95 }, image: 'promos/s7-005.jpg' }, // HALF-LIFE 2
    [-1237970]: { steam: 1237970, serie: 7, numero: 6, stats: { attaque: 94, popularite: 90 }, image: 'promos/s7-006.jpg', nom: 'Titanfall 2' }, // TITANFALL 2
    [-1222140]: { steam: 1222140, serie: 7, numero: 7, stats: { attaque: 92, popularite: 92 }, image: 'promos/s7-007.jpg' }, // DETROIT: BECOME HUMAN
    [-282140]: { steam: 282140, serie: 7, numero: 8, stats: { attaque: 93, popularite: 82 }, image: 'promos/s7-008.jpg' }, // SOMA
    [-1139900]: { steam: 1139900, serie: 7, numero: 9, stats: { attaque: 94, popularite: 86 }, image: 'promos/s7-009.jpg' }, // GHOSTRUNNER
    [-480490]: { steam: 480490, serie: 7, numero: 10, stats: { attaque: 92, popularite: 83 }, image: 'promos/s7-010.jpg' }, // PREY

    // Série 8 « Duo » : deux jeux sur une même carte. `duo` : [jeu de gauche, jeu de droite], `images` dans le même ordre,
    // `couleurs` : celles de chaque moitié du cadre. `stats` : la meilleure des deux cartes dans chaque stat (à défaut, calculée
    // au chargement) ; l'Ancienneté est celle du plus ancien des deux (`steam`)
    [-900801]: { steam: 319510, duo: [391540, 319510], serie: 8, numero: 1, stats: { attaque: 97, popularite: 97 }, nom: 'Undertale × Five Nights at Freddy’s',
        images: ['promos/s8-001a.jpg', 'promos/s8-001b.jpg'], couleurs: ['#ffc27a', '#c99bff'] },
    [-900802]: { steam: 10, duo: [4000, 10], serie: 8, numero: 2, stats: { attaque: 94, popularite: 98 }, nom: 'Garry’s Mod × Counter-Strike',
        images: ['promos/s8-002a.jpg', 'promos/s8-002b.jpg'], couleurs: ['#7cc6ff', '#ffd97a'] },
    [-900803]: { steam: 271590, duo: [271590, 1174180], serie: 8, numero: 3, stats: { attaque: 95, popularite: 100 }, nom: 'GTA V × Red Dead Redemption 2',
        images: ['promos/s8-003a.jpg', 'promos/s8-003b.jpg'], couleurs: ['#ffd27f', '#ff6f61'] },
    [-900804]: { steam: 489830, duo: [1245620, 489830], serie: 8, numero: 4, stats: { attaque: 100, popularite: 98 }, nom: 'Elden Ring × Skyrim',
        images: ['promos/s8-004a.jpg', 'promos/s8-004b.jpg'], couleurs: ['#f2c46d', '#8fd6d0'] },
    [-900805]: { steam: 698780, duo: [1451940, 698780], serie: 8, numero: 5, stats: { attaque: 99, popularite: 92 }, nom: 'NEEDY GIRL OVERDOSE × Doki Doki Literature Club!',
        images: ['promos/s5-010.jpg', 'promos/s5-001.jpg'], couleurs: ['#6fd3ff', '#ff8fc7'] },

    // Série 9 « Ténèbres » : gothique minimaliste en noir et blanc, sur Steam (illustration pleine carte, un seul filet blanc)
    [-374320]: { steam: 374320, serie: 9, numero: 1, stats: { attaque: 97, popularite: 93 }, image: 'promos/s9-001.jpg', nom: 'Dark Souls III' }, // DARK SOULS III
    [-367520]: { steam: 367520, serie: 9, numero: 2, stats: { attaque: 98, popularite: 92 }, image: 'promos/s9-002.jpg' }, // HOLLOW KNIGHT
    [-774361]: { steam: 774361, serie: 9, numero: 3, stats: { attaque: 93, popularite: 82 }, image: 'promos/s9-003.jpg' }, // BLASPHEMOUS
    [-1627720]: { steam: 1627720, serie: 9, numero: 4, stats: { attaque: 95, popularite: 85 }, image: 'promos/s9-004.jpg' }, // LIES OF P
    [-692850]: { steam: 692850, serie: 9, numero: 5, stats: { attaque: 93, popularite: 82 }, image: 'promos/s9-005.jpg' }, // BLOODSTAINED: RITUAL OF THE NIGHT
    [-262060]: { steam: 262060, serie: 9, numero: 6, stats: { attaque: 93, popularite: 86 }, image: 'promos/s9-006.jpg', nom: 'Darkest Dungeon' }, // DARKEST DUNGEON
    [-1196590]: { steam: 1196590, serie: 9, numero: 7, stats: { attaque: 95, popularite: 90 }, image: 'promos/s9-007.jpg' }, // RESIDENT EVIL VILLAGE
    [-205100]: { steam: 205100, serie: 9, numero: 8, stats: { attaque: 96, popularite: 84 }, image: 'promos/s9-008.jpg' }, // DISHONORED
    [-1369630]: { steam: 1369630, serie: 9, numero: 9, stats: { attaque: 94, popularite: 80 }, image: 'promos/s9-009.jpg', nom: 'Ender Lilies' }, // ENDER LILIES
    [-2171440]: { steam: 2171440, serie: 9, numero: 10, stats: { attaque: 97, popularite: 80 }, image: 'promos/s9-010.jpg' }, // FEAR & HUNGER 2: TERMINA

    // Carte secrète, hors séries (série 0) : récompense du succès secret « Overdose ». Les trois stats au maximum,
    // style « angel.exe » : une fenêtre de vieil ordinateur rose bonbon (style.css)
    // (identifiant à part : -1451940 est déjà la promo Série 5 #10 du même jeu)
    [-1451999]: { steam: 1451940, serie: 0, numero: 0, secrete: true, stats: { attaque: 100, popularite: 100 }, image: 'promos/secrete.jpg', nom: 'Needy Girl Overdose' }, // NEEDY STREAMER OVERLOAD
};
const ID_CARTE_SECRETE = -1451999;
// Carte promo d'une carte (ou undefined) ; une promo sans `steam` est un jeu hors Steam (séries 2, 4 et 6)
const promoDe = carte => PROMOS[carte.id];
const horsSteam = carte => Boolean(promoDe(carte)) && !promoDe(carte).steam;
// « S1 · #001 » : série, puis numéro dans la série
const numeroPromoHTML = promo => `S${promo.serie} · #${String(promo.numero).padStart(3, '0')}`;
// En duel de decks, une Promo compte comme cette rareté pour les plafonds des niveaux (jouable là où les Mythiques le sont)
const PLAFOND_PROMO = 'mythique';
// Contour des cartes promo, à essayer : 'noir-or' (édition limitée) ou 'neon' (néon GameCards)
const STYLE_PROMO = 'neon';
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
// Recherche : on attend la fin de la frappe avant de filtrer
const differer = (fonction, ms = 150) => {
    let minuteur;
    return () => {
        clearTimeout(minuteur);
        minuteur = setTimeout(fonction, ms);
    };
};
const auHasard = liste => liste[Math.floor(Math.random() * liste.length)];
// Index de chaque rareté dans RARETES (appelé dans les tris : une table plutôt qu'une recherche)
const INDEX_PAR_RARETE = new Map(RARETES.map((r, i) => [r.id, i]));
const indexRarete = id => INDEX_PAR_RARETE.get(id) ?? -1;
const estHauteRarete = id => indexRarete(id) <= INDEX_LEGENDAIRE; // Légendaire ou Mythique
const HAUTES_RARETES = RARETES.slice(0, INDEX_LEGENDAIRE + 1);
const comparerNoms = new Intl.Collator(LOCALE).compare;
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

// Fenêtre principale (fiche, achat, récompense…), son contenu déjà rempli dans #modale-contenu
const ouvrirModale = () => {
    if (!$('#modale').open) $('#modale').showModal();
};

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
    marche: 'gameCards.marche',
    codes: 'gameCards.codes',
    quetes: 'gameCards.quetes',
    cadeaux: 'gameCards.cadeaux',
    decks: 'gameCards.decks',
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
    stats: { boosters: 0, prestiges: 0, duelsGagnes: 0, duelsParfaits: 0, ventes: 0, decksGagnes: 0, decksHardcore: 0, draftsGagnes: 0, defisGagnes: 0, logo: 0, nuit: 0, pireMalchance: 0, quetes: 0, joursQuetes: 0, ...lire(CLES.stats, {}) },
    succes: lire(CLES.succes, {}),        // { id du succès: date d'obtention }
    // { id du succès: date de récupération de la récompense }. Les anciennes sauvegardes avaient reçu
    // leurs récompenses tout de suite : leurs succès déjà obtenus comptent comme récupérés.
    succesRecuperes: lire(CLES.succesRecuperes, null) ?? { ...lire(CLES.succes, {}) },
    malchance: lire(CLES.malchance, 0),   // boosters ouverts depuis la dernière Légendaire ou Mythique
    reglages: { sons: false, ...lire(CLES.reglages, {}) },
    connexion: lire(CLES.connexion, { dernier: null, serie: 0 }), // dernier jour récupéré, et jours d'affilée
    gainsJour: lire(CLES.gainsJour, { jour: null }), // victoires payées aujourd'hui, mode par mode
    marche: lire(CLES.marche, { jour: null, offres: [], achetes: [] }), // offres du jour (identifiants) et celles achetées
    codes: lire(CLES.codes, {}),          // { code cadeau utilisé: date }
    // Quêtes du jour : [{ id, progres, recuperee }], une seule remplacée par jour, bonus des 3 récupéré ou non
    quetes: lire(CLES.quetes, { jour: null, liste: [], remplacee: false, bonus: false }),
    cadeaux: lire(CLES.cadeaux, []),     // boosters de série à ouvrir (onglet Cadeaux) : le numéro de série de chacun
    // Duel de decks : les decks enregistrés ({ nom, cartes: [identifiants] }) et le dernier deck joué
    decks: { sauves: [], dernier: [], ...lire(CLES.decks, {}) },
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

// Popularité sur une échelle logarithmique : 1 avis → 0, 1 000 → 48, 2 millions → 100
// (au-delà d'un million d'avis, les géants restent départagés au lieu de tous plafonner à 100)
const popularite = avis => Math.round(echelleLog(avis, 2e6));
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

// Plancher de 20 : les jeux les plus récents ne tombent pas à 0 (l'échelle 0–100 est ramenée à 20–100)
const PLANCHER_ANCIENNETE = 20;
const anciennete = annee => {
    const brute = ancienneteParAnnee[annee] ?? (annee < premiereAnnee ? 100 : 0);
    return Math.round(PLANCHER_ANCIENNETE + brute * (100 - PLANCHER_ANCIENNETE) / 100);
};
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
const aUneVersionEX = jeu => Boolean(jeu) && !jeu.promo && !jeu.estime && jeu.note >= SEUIL_EX_NOTE && jeu.avis >= SEUIL_EX_AVIS
    && indexRarete(jeu.rarete) >= INDEX_RARE;

// `ex` : version EX, la Qualité est placée dans la fourchette de la rareté au-dessus
function creerCarte(jeu, { ex = false } = {}) {
    return {
        id: jeu.id,
        steam: jeu.steam ?? jeu.id, // identifiant Steam (différent de `id` pour une carte promo)
        promo: Boolean(jeu.promo),
        numero: jeu.numero, // numéro d'une carte promo
        nom: jeu.nom,
        image: horsSteam(jeu) ? promoDe(jeu).image : `${URL_IMAGES}/${jeu.steam ?? jeu.id}/${jeu.image || 'header.jpg'}`,
        attaque: ex
            ? STATS_FORCEES[jeu.id]?.attaque ?? statDeJeu(notePublic(jeu.note, jeu.avis), RARETES[indexRarete(jeu.rarete) - 1].id, 50)
            : statQualite(jeu),
        ex,
        // Stat « joker » : la vraie ancienneté, sans lien avec la rareté (une vieille Commune peut battre une Mythique récente)
        anciennete: STATS_FORCEES[jeu.id]?.anciennete ?? anciennete(anneeOriginale(jeu)),
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
// Jaquette verticale Steam (600 × 900) pour les Full Art (ou l'illustration d'une promo) ; à défaut, l'image horizontale
const imagePortrait = carte => PROMOS[carte.id]?.image || `${URL_IMAGES}/${carte.steam ?? carte.id}/library_600x900.jpg`;

// Image de secours, sous l'image Steam : visible pendant le chargement, et si l'image n'existe pas.
// Une couleur propre à chaque jeu, ses initiales en grand et son nom.
function imageSecoursHTML(carte) {
    const mots = carte.nom.replace(/[^\p{L}\p{N} ]/gu, ' ').split(' ').filter(Boolean);
    const initiales = mots.slice(0, 2).map(mot => mot[0]).join('').toUpperCase() || '?';
    return `<div class="image-secours" style="--teinte: ${(carte.id * 47) % 360}" aria-hidden="true">
                        <span class="secours-initiales">${echapper(initiales)}</span><span class="secours-nom">${echapper(carte.nom)}</span>
                    </div>`;
}

// `bonus` : bonus de variante en combat, affiché en pastille à côté de chaque stat (duels)
// Holo et Full Art suivent par défaut les exemplaires possédés (carte de la collection)
function carteHTML(carte, { holo = (carte.holos || 0) > 0, compteur = 0, cachee = false, fullArt = (carte.fullArts || 0) > 0, ex = Boolean(carte.ex), bonus = 0 } = {}) {
    if (carte.promo) fullArt = true; // toutes les promos sont Full Art
    if (fullArt) holo = false;
    const rarete = RARETES[indexRarete(carte.rarete)];
    // Sur la carte adverse du duel, l'année trahirait l'Ancienneté : on la cache aussi
    const infos = [cachee ? null : carte.annee, carte.genres[0]].filter(Boolean).join(' · ');
    const chef = !cachee && !carte.promo && carte.metacritic >= SEUIL_CHEF_OEUVRE; // pas de chef-d’œuvre sur une promo
    const goty = gotyDe(carte.id);
    const pastille = bonus && !cachee ? `<small class="bonus-stat">+${bonus}</small>` : '';
    const plaque = chef ? `<span class="plaque-chef" title="${t('Metacritic : {n} / 100', { n: carte.metacritic })}">${ICONES.medaille}<span>${t('Chef-d’œuvre')}</span></span>` : '';
    const texte = `
                <div class="carte-titre">
                    <h3 class="carte-nom">${promoDe(carte)?.duo ? echapper(carte.nom).split(' × ').map((nom, i) => `<span class="duo-nom-${i ? 'b' : 'a'}">${nom}</span>`).join(' <i class="duo-x">×</i> ') : echapper(carte.nom)}</h3>
                    ${ex ? '<span class="badge-ex">EX</span>' : ''}
                </div>
                <p class="carte-infos">${echapper(infos) || '&nbsp;'}</p>
                <ul class="carte-stats">
                    ${Object.entries(STATS).map(([cle, stat]) => fullArt
                        // Full Art : juste l'icône et le chiffre, pour laisser la place à l'illustration
                        ? `
                        <li data-stat="${cle}" title="${stat.nom}"><span>${stat.icone}</span><b>${cachee ? '?' : carte[cle]}${pastille}</b></li>`
                        : `
                        <li data-stat="${cle}">
                            <span>${stat.icone} ${stat.nom}</span><b>${cachee ? '?' : carte[cle]}${pastille}</b>
                            <i style="--v:${cachee ? 0 : Math.min(100, carte[cle])}%"></i>
                        </li>`).join('')}
                </ul>`;
    const secours = echapper(carte.image);
    const duo = promoDe(carte)?.duo ? promoDe(carte) : null;
    // Carte Duo : un jeu de chaque côté d'une diagonale soulignée d'un filet métallique (style.css, série 8)
    const fondDuo = duo && `<div class="full-art-fond fond-duo" aria-hidden="true">${duo.images.map((src, i) =>
        `<img class="duo-${i ? 'b' : 'a'}" src="${src}" alt="" loading="lazy">`).join('')}<span class="duo-filet"></span></div>`;
    return `
        <article class="carte rarete-${rarete.id}${holo ? ' holo' : ''}${cachee ? ' stats-cachees' : ''}${chef ? ' chef-oeuvre' : ''}${goty ? ' goty' : ''}${fullArt ? ' full-art' : ''}${ex ? ' ex' : ''}${carte.promo ? ` promo promo-${STYLE_PROMO} promo-serie-${promoDe(carte)?.serie ?? 1}" data-incline${promoDe(carte)?.encres ? ` style="--encre-1: ${promoDe(carte).encres[0]}; --encre-2: ${promoDe(carte).encres[1]}"` : ''}${duo ? ` style="--duo-1: ${duo.couleurs[0]}; --duo-2: ${duo.couleurs[1]}"` : ''}` : '"'}>
            <div class="carte-corps">
                ${fondDuo || ''}${fullArt && !fondDuo ? `<div class="full-art-fond" style="--secours: url('${secours}')" aria-hidden="true">${imageSecoursHTML(carte)}<img src="${imagePortrait(carte)}" alt="" loading="lazy"
                    onerror="if (this.dataset.repli) { this.parentNode.classList.remove('paysage'); this.remove(); } else { this.dataset.repli = 1; this.src = '${secours}'; this.parentNode.classList.add('paysage'); }"></div>` : ''}
                ${goty ? `<span class="ruban-goty" title="${t('Jeu de l’année {annee}', { annee: goty.annee })} · ${goty.ceremonie}"><span>${BRIN_LAURIER}GOTY ${goty.annee}${BRIN_LAURIER}</span></span>` : ''}
                ${goty && !fullArt ? `<span class="filigrane-goty" aria-hidden="true">${LAURIER}</span>` : ''}
                <header class="carte-haut">
                    <span class="carte-rarete">${carte.promo
                        ? promoDe(carte)?.secrete ? '♡ angel.exe' : `${rarete.nom}${promoDe(carte) ? ` ${numeroPromoHTML(promoDe(carte))}` : ''}`
                        : `${rarete.nom}${fullArt ? ' · Full Art' : holo ? ' · Holo' : ''}`}</span>
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
function flipHTML(carte, { holo = false, fullArt = false, retournee = false, nouvelle = false, cachee = false, godPack = false, bonus = 0 } = {}) {
    return `
        <div class="flip${retournee ? ' retournee' : ''}${godPack ? ' dos-divin' : ''}" data-rarete="${carte.rarete}" data-id="${carte.id}">
            <div class="flip-inner">
                <div class="flip-face">
                    ${carteHTML(carte, { holo, fullArt, cachee, bonus })}
                    ${nouvelle ? `<span class="badge-nouvelle">${t('Nouvelle !')}</span>` : ''}
                </div>
                <div class="flip-dos" aria-hidden="true"><span>GC</span></div>
            </div>
        </div>`;
}

// Pastilles de rareté (filtres de la collection et du catalogue) ; `totaux` : nombre de jeux de chaque rareté
function pucesRaretesHTML({ actif = '', totaux = false } = {}) {
    const puce = (id, nom, n, total) => `
        <button class="puce${id ? ` rarete-${id}` : ''}${actif === id ? ' active' : ''}" data-rarete="${id}" aria-pressed="${actif === id}">
            <i></i>${nom} <b>${nombre(n)}${totaux ? ` / ${nombre(total)}` : ''}</b></button>`;
    return puce('', t('Toutes'), jeuxPossedes().length, totalJeux())
        // Le catalogue (avec les totaux) ne montre que les jeux : pas de pastille Promo
        + RARETES.filter(r => !(totaux && r.promo)).map(r => puce(r.id, r.nom, nombreDeRarete(r.id), totalDeRarete(r.id))).join('');
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
    return `<option value="">${t('Tous les genres')}</option>`
        + groupe(t('Distinctions'), Object.keys(DISTINCTIONS))
        + groupe(t('Genres'), genresCatalogue)
        + Object.entries(groupesTags).map(([titre, liste]) => groupe(titre, liste)).join('');
}

// Distinctions : valeurs spéciales du filtre, calculées plutôt que stockées
const DISTINCTIONS = {
    [t('GOTY (jeu de l’année)')]: carte => Boolean(GOTY[carte.id]),
    [t('Chef-d’œuvre (Metacritic 90+)')]: carte => !carte.promo && carte.metacritic >= SEUIL_CHEF_OEUVRE,
};
const distinctionsDe = carte => Object.keys(DISTINCTIONS).filter(nom => DISTINCTIONS[nom](carte));

const aLeGenre = (carte, valeur) => DISTINCTIONS[valeur]
    ? DISTINCTIONS[valeur](carte)
    : carte.genres.includes(valeur) || (carte.tags || []).includes(valeur);

// ---------- Données ----------

async function chargerJeux() {
    const reponse = await fetch('data/jeux.json?v=17');
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
        ({ id, nom, nomMin: nom.toLowerCase(), annee, avis, note, metacritic, joueurs, genres: decoder(codesGenres, genres), tags: decoder(codesTags, tags), image }));
    groupesTags = groupes;
    // Jeux sans avis dans le dataset : avis et note estimés, signalé sur leur fiche
    const ensembleEstimes = new Set(estimes);
    for (const jeu of tousLesJeux) jeu.estime = ensembleEstimes.has(jeu.id);
    calculerRaretes();
    for (const jeu of tousLesJeux) jeuxParRarete[jeu.rarete].push(jeu);
    jeuxParId = new Map(tousLesJeux.map(jeu => [jeu.id, jeu]));
    // Les cartes promo ne sont connues que par leur identifiant (hors de tousLesJeux et des raretés)
    for (const [id, { steam, numero, stats, nom, jeu: infos, duo }] of Object.entries(PROMOS)) {
        let jeu = jeuxParId.get(steam) ?? (infos && { ...infos, nomMin: infos.nom.toLowerCase(), genres: infos.genres.map(t), tags: infos.tags.map(t) });
        if (!jeu) continue;
        // L'Ancienneté d'une promo est celle de la carte normale : l'année de sortie d'origine, pas celle de la réédition Steam
        if (steam && jeuxParId.get(steam)) jeu = { ...jeu, annee: anneeOriginale(jeu) };
        let statsPromo = stats;
        if (duo) {
            // Carte Duo : les genres et thèmes des deux jeux ; sans `stats` écrites, la meilleure des deux cartes dans chaque stat
            const [a, b] = duo.map(i => jeuxParId.get(i));
            if (!a || !b) continue;
            statsPromo ??= { attaque: Math.max(statQualite(a), statQualite(b)), popularite: Math.max(statPopularite(a), statPopularite(b)) };
            jeu = { ...jeu, annee: Math.min(anneeOriginale(a), anneeOriginale(b)), avis: a.avis + b.avis, genres: [...new Set([...a.genres, ...b.genres])], tags: [...new Set([...(a.tags || []), ...(b.tags || [])])] };
        }
        STATS_FORCEES[id] = statsPromo;
        jeuxParId.set(Number(id), { ...jeu, ...(nom && { nom, nomMin: nom.toLowerCase() }), id: Number(id), steam, numero, rarete: 'promo', promo: true, statPopularite: undefined, statQualite: undefined });
    }
    calculerAnciennete();
    genresCatalogue = genres;
    majCollectionDepuisDonnees(); 
}

// La carte secrète a d'abord été rangée sous -1451940, l'identifiant de la promo Série 5 #10 du même jeu :
// si « Overdose » a été récupéré sans que la carte secrète soit dans la collection, l'exemplaire versé
// par le succès quitte la promo Série 5 (retirée si elle n'était là que grâce à lui) et la carte secrète arrive
function reparerCarteSecrete() {
    const recuperee = etat.succesRecuperes.overdose;
    if (!recuperee || etat.collection[ID_CARTE_SECRETE] || !jeuxParId.get(ID_CARTE_SECRETE)) return;
    const s5 = etat.collection[-1451940];
    if (s5?.exemplaires > 1) {
        s5.exemplaires--;
        s5.fullArts = Math.max(0, (s5.fullArts || 0) - 1);
    } else if (s5 && s5.obtenue >= recuperee - 60000) {
        delete etat.collection[-1451940];
    }
    ajouterACollection(creerCarte(jeuxParId.get(ID_CARTE_SECRETE)), false, true);
}

// Les cartes déjà obtenues gardent une copie de leurs stats : on les recalcule
// pour qu'elles suivent les règles actuelles (exemplaires, holos et date sont conservés).
// Une carte dont le jeu a disparu des données (doublon, DLC retiré…) quitte la collection, ses exemplaires sont remboursés.
function majCollectionDepuisDonnees() {
    reparerCarteSecrete();
    let retirees = 0;
    let rembourse = 0;
    for (const entree of possedees()) {
        const jeu = jeuxParId.get(entree.id);
        if (!jeu) {
            const copie = { ...entree, holos: entree.holos || 0 };
            for (const [variante, n] of Object.entries(exemplairesParVariante(copie))) rembourse += n * prixVariante(copie, variante);
            delete etat.collection[entree.id];
            retirees++;
            continue;
        }
        Object.assign(entree, creerCarte(jeu, { ex: entree.exs > 0 }));
        // Toutes les promos sont Full Art (y compris celles obtenues avant cette règle)
        if (jeu.promo) entree.fullArts = entree.exemplaires;
        delete entree.defense; // ancienne stat Note Metacritic
    }
    etat.pieces += rembourse;
    sauvegarder();
    if (retirees) {
        majEntete();
        toast(tn(retirees, '{n} carte retirée : son jeu n’existe plus dans GameCards. +{p} pièces remboursées',
            '{n} cartes retirées : leurs jeux n’existent plus dans GameCards. +{p} pièces remboursées', { p: nombre(rembourse) }), 'gain');
    }
}

const donneesPretes = () => tousLesJeux.length > 0;
const totalJeux = () => tousLesJeux.length;
const totalDeRarete = id => (id === 'promo' ? Object.keys(PROMOS).length : jeuxParRarete[id]?.length || 0);
// Cartes de la collection
const possedees = () => Object.values(etat.collection);
// Les jeux de la collection, sans les cartes promo (compteurs « jeux découverts », « jeux différents », succès de collection)
const jeuxPossedes = () => possedees().filter(e => !e.promo);
const nombreDeRarete = id => possedees().filter(e => e.rarete === id).length;
const nombreCartes = () => possedees().reduce((n, e) => n + e.exemplaires, 0);
const valeurTousDoublons = () => possedees().reduce((n, e) => n + valeurDoublons(e), 0);

// Tire un index de rareté (dans RARETES) selon la colonne de chances `cle` ;
// `possibles` limite le tirage à certaines raretés, leurs chances sont alors réparties entre elles
function tirerRarete(cle = 'chance', possibles = RARETES) {
    let t = Math.random() * possibles.reduce((s, r) => s + r[cle], 0);
    for (const rarete of possibles) {
        t -= rarete[cle];
        if (t < 0) return indexRarete(rarete.id);
    }
    // Arrondi : la dernière rareté qui a une chance (jamais la Promo, hors du tirage)
    return indexRarete(possibles.findLast(r => r[cle] > 0)?.id ?? possibles.at(-1).id);
}

// Pioche un jeu au hasard dans la rareté demandée, tous avec la même chance (sans doublon dans `exclus`,
// où le jeu pioché est ajouté)
function piocher(index, exclus = new Set()) {
    const bac = jeuxParRarete[RARETES[index].id];
    let jeu = auHasard(bac);
    for (let essai = 0; essai < 20 && exclus.has(jeu.id); essai++) jeu = auHasard(bac);
    exclus.add(jeu.id);
    return creerCarte(jeu);
}

// Pioche d'un booster : seulement des cartes pas encore possédées (ni déjà sorties dans `exclus`).
// Exception : une Légendaire ou Mythique peut, rarement (CHANCE_DOUBLON), être un doublon.
// Si toute la rareté est déjà possédée, n'importe quelle carte de la rareté.
function piocherNouvelle(index, exclus = new Set()) {
    if (estHauteRarete(RARETES[index].id) && Math.random() < CHANCE_DOUBLON) return piocher(index, exclus);
    const bac = jeuxParRarete[RARETES[index].id];
    const estNouvelle = j => !etat.collection[j.id] && !exclus.has(j.id);
    // Quelques essais au hasard d'abord (rapide quand la rareté est loin d'être complète), puis la liste des manquantes
    for (let essai = 0; essai < 30; essai++) {
        const jeu = auHasard(bac);
        if (estNouvelle(jeu)) {
            exclus.add(jeu.id);
            return creerCarte(jeu);
        }
    }
    const nouvelles = bac.filter(estNouvelle);
    if (!nouvelles.length) return piocher(index, exclus);
    const jeu = auHasard(nouvelles);
    exclus.add(jeu.id);
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

// `champ` : compteur de la variante dans la collection (les exemplaires normaux n'en ont pas)
const VARIANTES = {
    normale: { nom: t('Normale'), multiplicateur: 1 },
    holo: { nom: 'Holo', multiplicateur: MULTIPLICATEUR_HOLO, champ: 'holos' },
    ex: { nom: 'EX', multiplicateur: MULTIPLICATEUR_EX, champ: 'exs' },
    fullArt: { nom: 'Full Art', multiplicateur: MULTIPLICATEUR_FULL_ART, champ: 'fullArts' },
};

// Nombre d'exemplaires de chaque variante possédés
function exemplairesParVariante(entree) {
    const fullArt = entree.fullArts || 0;
    const ex = entree.exs || 0;
    return { normale: entree.exemplaires - entree.holos - ex - fullArt, holo: entree.holos, ex, fullArt };
}

const prixVariante = (entree, variante) => RARETES[indexRarete(entree.rarete)].revente * VARIANTES[variante].multiplicateur;

// Vend un exemplaire de la variante choisie ; le dernier exemplaire fait sortir la carte de la collection
function vendreExemplaire(id, variante) {
    const entree = etat.collection[id];
    if (!entree || exemplairesParVariante(entree)[variante] < 1) return 0;
    const prix = prixVariante(entree, variante);
    const { champ } = VARIANTES[variante];
    if (champ) entree[champ]--;
    // Plus aucun exemplaire EX : la carte reprend ses stats normales
    const jeu = jeuxParId.get(id);
    if (variante === 'ex' && !entree.exs && jeu) Object.assign(entree, creerCarte(jeu));
    if (--entree.exemplaires === 0) delete etat.collection[id];
    etat.pieces += prix;
    etat.stats.ventes++;
    progresserQuetes('vente');
    return prix;
}

// Revente groupée : on garde toujours un exemplaire
function vendreDoublon(id) {
    const entree = etat.collection[id];
    if (!entree || entree.exemplaires < 2) return 0;
    return vendreExemplaire(id, prochaineVente(entree));
}

// Valeur de tous les doublons : tous les exemplaires, moins celui qu'on garde
// (le dernier dans l'ordre de revente : le Full Art, sinon l'EX, la holo, la normale)
function valeurDoublons(entree) {
    const parVariante = exemplairesParVariante(entree);
    const gardee = ['fullArt', 'ex', 'holo', 'normale'].find(v => parVariante[v] > 0);
    const total = Object.entries(parVariante).reduce((n, [v, k]) => n + k * prixVariante(entree, v), 0);
    return gardee ? total - prixVariante(entree, gardee) : 0;
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
    majChronoQuetes();
    const dispo = {};
    for (const type of Object.values(TYPES_BOOSTER)) {
        const charges = dispo[type.id] = chargesDispo(type);
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
            ? `<b>${charges > type.stockMax ? charges : `${charges} / ${type.stockMax}`}</b> ${type.stockMax > 1 ? t('gratuits') : t('gratuit')} · ${reste ? t('prochain dans {duree}', { duree: formatDuree(reste) }) : t('réserve pleine')}`
            : t('Prochain gratuit dans {duree}<br>Clique pour en acheter', { duree: formatDuree(reste) });
    }

    // Ouvrir d'un coup toute la réserve de boosters gratuits
    const reserve = dispo.standard;
    $('#btn-tout-ouvrir').hidden = reserve < 2;
    $('#btn-tout-ouvrir').textContent = t('Ouvrir les {n} boosters gratuits', { n: reserve });
    // Pareil pour les Prestige (la réserve peut dépasser 1 grâce aux récompenses)
    $('#btn-tout-ouvrir-prestige').hidden = dispo.prestige < 2;
    $('#btn-tout-ouvrir-prestige').textContent = t('Ouvrir les {n} Prestige', { n: dispo.prestige });

    $('#lien-accueil').classList.toggle('pret', Object.values(dispo).some(n => n > 0));
}

// Clic sur un paquet de l'accueil : on ouvre un gratuit s'il en reste, sinon on propose d'en acheter
function cliquerPaquet(type) {
    if (chargesDispo(type) > 0) ouvrirBooster('gratuit', 1, type);
    else proposerAchat(type);
}

function proposerAchat(type) {
    const prixLot = type.prix * BOOSTERS_PAR_LOT;
    // Autant de boosters que les pièces le permettent, jusqu’à BOOSTERS_MAX_ACHAT
    const maxi = Math.min(BOOSTERS_MAX_ACHAT, Math.floor(etat.pieces / type.prix));
    $('#modale-contenu').innerHTML = `
        <div class="achat">
            <h2>${t('Plus de {type} gratuit', { type: type.nom })}</h2>
            <p>${t('Le prochain arrive dans <b>{duree}</b>. En attendant, tu peux en acheter :', { duree: formatDuree(avantRecharge(type)) })}</p>
            <div class="achat-options">
                <button class="btn btn-principal btn-grand" data-acheter-booster="${type.id}" data-nombre="1"${etat.pieces < type.prix ? ' disabled' : ''}>
                    ${t('Acheter 1 {type}', { type: type.nom })} · ${nombre(type.prix)} ${PIECE}</button>
                <button class="btn btn-or btn-grand" data-acheter-booster="${type.id}" data-nombre="${BOOSTERS_PAR_LOT}"${etat.pieces < prixLot ? ' disabled' : ''}>
                    ${t('Ouvrir')} ×${BOOSTERS_PAR_LOT} · ${nombre(prixLot)} ${PIECE}</button>
                ${maxi > BOOSTERS_PAR_LOT ? `
                <button class="btn btn-or btn-grand" data-acheter-booster="${type.id}" data-nombre="${maxi}">
                    ${t('Tout dépenser')} ×${maxi} · ${nombre(type.prix * maxi)} ${PIECE}</button>` : ''}
            </div>
            <p class="achat-solde">${t('Tu as')} ${nombre(etat.pieces)} ${PIECE}${etat.pieces < type.prix ? t(' : revends des doublons ou gagne des duels pour en avoir plus.') : ''}</p>
        </div>`;
    ouvrirModale();
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
    const fullArt = estHauteRarete(carte.rarete) && Math.random() < chanceFullArt;
    const jeu = jeuxParId.get(carte.id);
    const ex = !fullArt && aUneVersionEX(jeu) && Math.random() < CHANCE_EX;
    return { carte: ex ? creerCarte(jeu, { ex }) : carte, fullArt, ex, holo: !fullArt && !ex && Math.random() < chanceHolo };
}

// God pack : une Mythique garantie, puis des Légendaires (et parfois d'autres Mythiques), une chance sur 4 d'être holo
function tirerGodPack(exclus) {
    return Array.from({ length: CARTES_PAR_BOOSTER }, (_, i) => {
        const index = i === 0 || Math.random() < PART_MYTHIQUE_GOD_PACK ? INDEX_MYTHIQUE : INDEX_LEGENDAIRE;
        return { ...variante(piocherNouvelle(index, exclus), CHANCE_HOLO_GOD_PACK, CHANCE_FULL_ART_GOD_PACK), godPack: true };
    });
}

// Les 5 cartes d'un booster : 4 au hasard + une 5ᵉ garantie (ou, très rarement, un god pack).
// `exclus` : cartes déjà sorties pendant cette ouverture (partagé entre les boosters d'un ×10)
function tirerBooster(type, legendaireGarantie = false, exclus = new Set()) {
    if (prochainGodPack || Math.random() < CHANCE_GOD_PACK) {
        prochainGodPack = false;
        return tirerGodPack(exclus);
    }
    const [cleChance, cleGarantie] = type.prestige ? ['chancePrestige', 'chancePrestigeGarantie'] : ['chance', 'chanceGarantie'];
    const chanceHolo = type.prestige ? CHANCE_HOLO_PRESTIGE : CHANCE_HOLO;
    const indices = Array.from({ length: CARTES_PAR_BOOSTER - 1 }, () => tirerRarete(cleChance));
    // Compteur de malchance atteint : la dernière carte est Légendaire ou mieux
    indices.push(legendaireGarantie
        ? tirerRarete('chance', HAUTES_RARETES)
        : tirerRarete(cleGarantie));
    return indices.map(index => variante(piocherNouvelle(index, exclus), chanceHolo, CHANCE_FULL_ART));
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
    const exclus = new Set();
    for (let i = 0; i < nombreBoosters; i++) {
        const booster = tirerBooster(type, etat.malchance >= MALCHANCE_MAX - 1, exclus);
        const hauteRarete = booster.some(t => estHauteRarete(t.carte.rarete));
        etat.malchance = hauteRarete ? 0 : etat.malchance + 1;
        etat.stats.pireMalchance = Math.max(etat.stats.pireMalchance, etat.malchance);
        boosters.push(booster);
    }
    if (new Date().getHours() < 5) etat.stats.nuit += nombreBoosters; // succès secret « Noctambule »
    etat.stats.boosters += nombreBoosters;
    if (type.prestige) etat.stats.prestiges += nombreBoosters;
    const tirage = boosters.flat();
    const godPacks = tirage.filter(t => t.godPack).length / CARTES_PAR_BOOSTER;
    if (mode === 'gratuit') consommerCharges(type, nombreBoosters);
    else etat.pieces -= prix;
    // Chaque booster ouvert rapporte des pièces
    const gain = type.gain * nombreBoosters;
    etat.pieces += gain;
    if (godPacks) {
        etat.godPacks.nombre += godPacks;
        etat.godPacks.premier ??= Date.now();
    }
    for (const t of tirage) t.nouvelle = ajouterACollection(t.carte, t.holo, t.fullArt, t.ex);
    sauvegarder();
    majEntete();

    debutOuverture(nombreBoosters > 1);
    // Chaque paquet : on le déchire, puis on fait défiler sa pile, la carte la plus rare en dernier
    const modele = $(type.paquet);
    for (let i = 0; i < boosters.length && !seance.passer; i++) {
        const cartes = [...boosters[i]].sort((a, b) => indexRarete(b.carte.rarete) - indexRarete(a.carte.rarete));
        const rang = nombreBoosters > 1 ? `${t('Paquet {i} / {n}', { i: i + 1, n: nombreBoosters })} · ` : '';
        await dechirerPaquet(modele, cartes[0].godPack, rang);
        if (!seance.passer) await defilerPile(cartes, rang);
    }
    finOuverture(tirage, nombreBoosters, gain);
    progresserQuetes('booster', nombreBoosters);
    if (type.prestige) progresserQuetes('prestige', nombreBoosters);
    progresserQuetes('epique', tirage.filter(t => indexRarete(t.carte.rarete) <= INDEX_EPIQUE).length);
    progresserQuetes('legendaire', tirage.filter(t => estHauteRarete(t.carte.rarete)).length);
    progresserQuetes('holo', tirage.filter(t => t.holo).length);
    progresserQuetes('nouvelle', tirage.filter(t => t.nouvelle).length);
}

// Écran d'ouverture (boosters ou paquet Full Art) : on cache les paquets, on prépare la scène
function debutOuverture(multiple) {
    $('#choix').hidden = true;
    $('#ouverture').hidden = false;
    $('#ouverture').classList.toggle('multiple', multiple);
    $('#tirage').innerHTML = '';
    for (const id of ['#bilan', '#btn-retour', '#btn-voir-collection']) $(id).hidden = true;
    $('#btn-passer').textContent = multiple ? t('Tout passer') : t('Passer');
    $('#btn-passer').hidden = false;
    $('#ouverture-aide').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    seance.passer = false;
}

// Fin de l'ouverture : récapitulatif des cartes et bilan (`gain` : pièces rapportées par les boosters)
function finOuverture(tirage, nombreBoosters, gain = 0) {
    $('#ouverture-scene').replaceChildren();
    $('#btn-passer').hidden = true;
    afficherRecapitulatif(tirage, nombreBoosters);
    ouvertureEnCours = false;
    finTirage(tirage, gain);
}

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
    paquet.hidden = false;
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
        if (estHauteRarete(cartes[i].carte.rarete) || cartes[i].ex) dessus.classList.add(cartes[i].fullArt ? 'apparition-full-art' : 'apparition-rare');
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

function finTirage(tirage, gain) {
    const nouvelles = tirage.filter(t => t.nouvelle).length;
    const meilleure = RARETES[Math.min(...tirage.map(t => indexRarete(t.carte.rarete)))];
    const holos = tirage.filter(t => t.holo).length;
    const fullArts = tirage.filter(t => t.fullArt).length;
    const exs = tirage.filter(t => t.ex).length;
    $('#ouverture-aide').hidden = true;
    const divines = tirage.filter(t => t.godPack);
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
        ${gain ? `<span class="bilan-gain">+<b>${nombre(gain)}</b> ${PIECE}</span>` : ''}`;
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

    const entrees = possedees();
    const total = totalJeux();
    $('#progression-texte').innerHTML = total
        ? t('<b>{n}</b> / {total} jeux découverts', { n: nombre(jeuxPossedes().length), total: nombre(total) })
        : t('Chargement des jeux…');
    $('#progression-raretes').innerHTML = progressionRaretesHTML();
    afficherQuetes();
    majTropheeGodPack();
    majMalchance();

    const recentes = entrees.sort((a, b) => b.obtenue - a.obtenue).slice(0, 8);
    $('#bloc-recentes').hidden = !recentes.length;
    $('#recentes').innerHTML = recentes.map(e => `
        <button class="mini" data-fiche="${e.id}" aria-label="${t('Voir {nom}', { nom: echapper(e.nom) })}">
            ${carteHTML(e)}
        </button>`).join('');
    majPaquets();
}

// ---------- Écran collection ----------

// Année qui fait l'Ancienneté d'une carte de la collection (sortie d'origine, année du GOTY)
const anneeDeCarte = carte => {
    const jeu = jeuxParId.get(carte.id);
    return jeu ? anneeOriginale(jeu) : carte.annee;
};

// Ordre d'une carte promo (série, puis numéro), 0 pour les autres
const numeroPromo = carte => (promoDe(carte) ? promoDe(carte).serie * 1000 + promoDe(carte).numero : 0);
const TRIS = {
    rarete: (a, b) => indexRarete(a.rarete) - indexRarete(b.rarete) || numeroPromo(a) - numeroPromo(b) || b.popularite - a.popularite,
    recent: (a, b) => b.obtenue - a.obtenue,
    attaque: (a, b) => b.attaque - a.attaque,
    anciennete: (a, b) => b.anciennete - a.anciennete,
    popularite: (a, b) => b.popularite - a.popularite,
    annee: (a, b) => (anneeDeCarte(b) || 0) - (anneeDeCarte(a) || 0),
    nom: (a, b) => comparerNoms(a.nom, b.nom),
    exemplaires: (a, b) => b.exemplaires - a.exemplaires,
};

let filtreRarete = '';
let limiteCollection = CARTES_PAR_PAGE;

function caseCollectionHTML(entree) {
    return `
        <div class="case" data-id="${entree.id}">
            <button class="case-carte" data-fiche="${entree.id}" aria-label="${t('Voir {nom}', { nom: echapper(entree.nom) })}">
                ${carteHTML(entree, { compteur: entree.exemplaires })}
            </button>
        </div>`;
}

// Filtres de la collection (rareté, recherche, genre, cases à cocher) : une carte passe-t-elle ?
function filtreCollection() {
    const recherche = $('#filtre-nom').value.trim().toLowerCase();
    const genre = $('#filtre-genre').value;
    const doublons = $('#filtre-doublons').checked;
    const seulementFullArt = $('#filtre-fullart').checked;
    const seulementEX = $('#filtre-ex').checked;
    return e => (!recherche || e.nom.toLowerCase().includes(recherche))
        && (filtreRarete ? e.rarete === filtreRarete : e.rarete !== 'promo') // les promos n'apparaissent qu'avec leur filtre
        && (!genre || aLeGenre(e, genre))
        && (!doublons || e.exemplaires > 1)
        && (!seulementFullArt || e.fullArts > 0)
        && (!seulementEX || e.exs > 0);
}

function afficherCollection() {
    const entrees = possedees();
    $('#filtre-raretes').innerHTML = pucesRaretesHTML({ actif: filtreRarete });

    // Le menu des genres se construit à partir de la collection
    const selGenre = $('#filtre-genre');
    selGenre.innerHTML = optionsGenresHTML(selGenre.value, new Set(entrees.flatMap(e => [...e.genres, ...(e.tags || []), ...distinctionsDe(e)])));

    // Les promos seules : toujours par numéro croissant
    const visibles = entrees.filter(filtreCollection()).sort(filtreRarete === 'promo' ? (a, b) => numeroPromo(a) - numeroPromo(b) : TRIS[$('#tri').value]);

    const grille = $('#grille-collection');
    if (!entrees.length) {
        grille.innerHTML = `<p class="vide">${t('Ta collection est vide.')}<br><a class="btn btn-principal" href="#accueil">${t('Ouvre ton premier booster')}</a></p>`;
    } else if (!visibles.length) {
        grille.innerHTML = `<p class="vide">${t('Aucune carte ne correspond à ces filtres.')}</p>`;
    } else {
        grille.innerHTML = visibles.slice(0, limiteCollection).map((e, i, liste) => {
            const serie = filtreRarete === 'promo' && promoDe(e)?.serie;
            const titre = serie && serie !== promoDe(liste[i - 1] ?? {})?.serie ? `<h3 class="titre-serie serie-${serie}">${t('Série {n}', { n: serie })}</h3>` : '';
            return titre + caseCollectionHTML(e);
        }).join('');
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
    const jeux = jeuxPossedes().length;
    const total = nombreCartes();
    const valeur = valeurTousDoublons();
    $('#resume-collection').textContent = [
        tn(jeux, '{n} jeu différent', '{n} jeux différents'),
        tn(total, '{n} carte', '{n} cartes'),
        tn(total - possedees().length, '{n} doublon', '{n} doublons'),
    ].join(' · ');
    const bouton = $('#btn-vendre-tout');
    bouton.disabled = valeur === 0;
    bouton.innerHTML = valeur ? `${t('Vendre doublons')} · +${nombre(valeur)} ${PIECE}` : t('Aucun doublon');
    $('#btn-echanger').disabled = !echangesPossibles();
}

// ---------- Échange de doublons ----------

// Doublons d'une rareté contre 1 carte au hasard de la rareté au-dessus (plus cher pour monter en Mythique)
const DOUBLONS_ECHANGE = { commune: 5, 'peu-commune': 5, rare: 5, epique: 5, legendaire: 10 };

// Exemplaires normaux qu'on peut échanger : on garde toujours un exemplaire du jeu (une variante, sinon une normale)
function doublonsNormaux(entree) {
    const { normale } = exemplairesParVariante(entree);
    return entree.exemplaires > normale ? normale : Math.max(0, normale - 1);
}
const doublonsDeRarete = rarete => possedees().filter(e => e.rarete === rarete).reduce((n, e) => n + doublonsNormaux(e), 0);
const echangesPossibles = () => Object.entries(DOUBLONS_ECHANGE).some(([rarete, cout]) => doublonsDeRarete(rarete) >= cout);

function proposerEchange() {
    $('#modale-contenu').innerHTML = `
        <div class="echange">
            <h2>${t('Échanger des doublons')}</h2>
            <p class="echange-intro">${t('Tes doublons contre une carte de la rareté au-dessus, si possible une que tu n’as pas. Tu gardes toujours un exemplaire de chaque jeu, et tes holos, EX et Full Art ne sont jamais pris.')}</p>
            <div class="echange-options">${Object.entries(DOUBLONS_ECHANGE).map(([rarete, cout]) => {
                const de = RARETES[indexRarete(rarete)];
                const vers = RARETES[indexRarete(rarete) - 1];
                const dispo = doublonsDeRarete(rarete);
                return `
                <button class="echange-option" data-echanger="${rarete}"${dispo < cout ? ' disabled' : ''}>
                    <span class="rarete-${de.id}"><b class="texte-rarete">${cout} × ${de.nom}</b></span>
                    <span class="echange-fleche" aria-hidden="true">→</span>
                    <span class="rarete-${vers.id}"><b class="texte-rarete">1 × ${vers.nom}</b></span>
                    <small>${tn(dispo, '{n} doublon disponible', '{n} doublons disponibles')}</small>
                </button>`;
            }).join('')}</div>
        </div>`;
    ouvrirModale();
}

function echangerDoublons(rarete) {
    const cout = DOUBLONS_ECHANGE[rarete];
    if (!cout || !donneesPretes() || doublonsDeRarete(rarete) < cout) return;
    // On prend d'abord sur les cartes qui ont le plus de doublons
    let reste = cout;
    const cartes = possedees().filter(e => e.rarete === rarete && doublonsNormaux(e) > 0)
        .sort((a, b) => doublonsNormaux(b) - doublonsNormaux(a));
    for (const entree of cartes) {
        const pris = Math.min(reste, doublonsNormaux(entree));
        entree.exemplaires -= pris;
        reste -= pris;
        if (!reste) break;
    }
    // La carte reçue : au hasard dans la rareté au-dessus, une qui manque à la collection si possible
    const bac = jeuxParRarete[RARETES[indexRarete(rarete) - 1].id];
    let jeu = auHasard(bac);
    for (let essai = 0; essai < 30 && etat.collection[jeu.id]; essai++) jeu = auHasard(bac);
    const carte = creerCarte(jeu);
    const nouvelle = ajouterACollection(carte, false);
    sauvegarder();
    jouerSonRarete(carte.rarete);
    $('#modale-contenu').innerHTML = `
        <div class="echange echange-resultat">
            <h2>${t('Échange réussi !')}</h2>
            <div class="echange-carte">${flipHTML(carte, { retournee: true, nouvelle })}</div>
            <div class="echange-actions">
                ${echangesPossibles() ? `<button class="btn btn-principal" data-echange-encore>${t('Nouvel échange')}</button>` : ''}
                <button class="btn" data-fiche="${carte.id}">${t('Voir la fiche')}</button>
            </div>
        </div>`;
    if (!$('#ecran-collection').hidden) afficherCollection();
    verifierSucces();
}

function vendreDepuisFiche(id, variante) {
    const entree = etat.collection[id];
    if (!entree || (entree.promo && entree.exemplaires < 2)) return; // une promo garde toujours un exemplaire
    if (entree.exemplaires === 1
        && !confirm(t('C’est ton seul exemplaire de « {nom} » : la carte quittera ta collection. La vendre quand même ?', { nom: entree.nom }))) return;
    const prix = vendreExemplaire(id, variante);
    if (!prix) return;
    sauvegarder();
    majEntete();
    const reste = etat.collection[id];
    const caseCarte = document.querySelector(`.case[data-id="${id}"]`);
    if (caseCarte) {
        if (!reste || !filtreCollection()(reste)) caseCarte.remove();
        else caseCarte.outerHTML = caseCollectionHTML(reste);
        majResumeCollection();
    }
    if (!$('#ecran-catalogue').hidden) afficherCatalogue();
    toast(t('+{n} pièces', { n: nombre(prix) }), 'gain');
    verifierSucces();
}

function vendreTousLesDoublons() {
    const valeur = valeurTousDoublons();
    if (!valeur || !confirm(t('Revendre tous tes doublons pour {n} pièces ? Tu gardes un exemplaire de chaque jeu (la holo en priorité).', { n: nombre(valeur) }))) return;
    for (const e of possedees()) while (e.exemplaires > 1) vendreDoublon(e.id);
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
    if (jeu.promo) return t('Carte promo : une édition spéciale, obtenue seulement avec un code cadeau');
    if (jeu.rarete === 'mythique') return t('Mythique : l’un des 22 jeux les plus cultes du jeu vidéo');
    const raisons = jeu.raisons.length ? ` · ${jeu.raisons.join(', ')}` : '';
    return `${t('Rang {n} au score de prestige', { n: nombre(jeu.rang) })}${raisons}`;
}

const variantesPossedees = e => Object.entries(exemplairesParVariante(e)).filter(([, n]) => n > 0);

// Une seule variante : vente directe. Plusieurs : « Vendre… » ouvre la fenêtre du choix de l'exemplaire
function boutonsVenteHTML(e) {
    if (e.promo && e.exemplaires < 2) return ''; // une promo ne se vend qu'en doublon : on garde toujours un exemplaire
    const variantes = variantesPossedees(e);
    if (variantes.length === 1) {
        const [variante] = variantes[0];
        return `<button class="btn btn-or" data-vendre="${e.id}" data-variante="${variante}">${t('Vendre')} · +${prixVariante(e, variante)} ${PIECE}</button>`;
    }
    return `<button class="btn btn-or" data-choix-vente="${e.id}">${t('Vendre…')}</button>`;
}

// Fusion : 3 exemplaires normaux (la carte et 2 doublons) deviennent 1 holo. Même valeur de revente
// (une holo vaut 3 normales), mais la holo gagne son bonus en duel.
const EXEMPLAIRES_FUSION = 3;

// Bouton de la fiche : actif à 3 exemplaires normaux, grisé à 2 pour montrer que la fusion approche
function boutonFusionHTML(e) {
    const normales = exemplairesParVariante(e).normale;
    if (normales < EXEMPLAIRES_FUSION - 1) return '';
    const pret = normales >= EXEMPLAIRES_FUSION;
    return `<button class="btn btn-fusion" data-fusion="${e.id}"${pret ? '' : ' disabled'}
                title="${t('{n} exemplaires normaux deviennent 1 holo', { n: EXEMPLAIRES_FUSION })}">
                ✨ ${t('Fusionner en holo')} · ${Math.min(normales, EXEMPLAIRES_FUSION)}/${EXEMPLAIRES_FUSION}</button>`;
}

function fusionnerHolo(id) {
    const entree = etat.collection[id];
    if (!entree || exemplairesParVariante(entree).normale < EXEMPLAIRES_FUSION) return;
    if (!confirm(t('Fusionner {n} exemplaires normaux de « {nom} » en 1 holo ?', { n: EXEMPLAIRES_FUSION, nom: entree.nom }))) return;
    entree.exemplaires -= EXEMPLAIRES_FUSION - 1;
    entree.holos++;
    sauvegarder();
    jouerSon('succes');
    toast(t('✨ {nom} devient holo !', { nom: entree.nom }), 'gain');
    const caseCarte = document.querySelector(`.case[data-id="${id}"]`);
    if (caseCarte) {
        if (filtreCollection()(entree)) caseCarte.outerHTML = caseCollectionHTML(entree);
        else caseCarte.remove();
        majResumeCollection();
    }
    if (!$('#ecran-catalogue').hidden) afficherCatalogue();
    afficherFiche(id);
    verifierSucces();
}

// Fenêtre par-dessus la fiche : chaque variante possédée, avec sa carte, son nombre et son prix
function choisirVente(id) {
    const e = etat.collection[id];
    if (!e) return;
    const jeu = jeuxParId.get(id);
    // Stats de la variante : l'EX a les siennes, les autres celles de la carte normale
    const carteDe = variante => jeu ? creerCarte(jeu, { ex: variante === 'ex' }) : e;
    $('#vente-contenu').innerHTML = `
        <h2>${t('Quel exemplaire veux-tu vendre ?')}</h2>
        <p class="vente-nom">${echapper(e.nom)}</p>
        <div class="vente-options">${variantesPossedees(e).map(([variante, n]) => `
            <button class="vente-option" data-vendre="${id}" data-variante="${variante}">
                ${carteHTML(carteDe(variante), { holo: variante === 'holo', fullArt: variante === 'fullArt', ex: variante === 'ex' })}
                <span class="vente-variante">${VARIANTES[variante].nom} <span class="gris">×${n}</span></span>
                <span class="vente-prix">+${prixVariante(e, variante)} ${PIECE}</span>
            </button>`).join('')}</div>`;
    $('#modale-vente').showModal();
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
        <div class="fiche-infos rarete-${rarete.id}${promoDe(carte) ? ` promo-serie-${promoDe(carte).serie}` : ''}">
            <span class="fiche-rarete">${rarete.nom}${promoDe(carte) ? ` · ${promoDe(carte).secrete ? t('Carte secrète') : t('Série {n}', { n: promoDe(carte).serie })}${horsSteam(carte) ? ` · ${t('hors Steam')}` : ''}` : ''}${carte.ex ? ' EX' : ''}${e?.holos ? ' · ✨ Holo' : ''}</span>
            <h2>${echapper(carte.nom)}</h2>
            <p class="fiche-meta">${[carte.annee, ...carte.genres].filter(Boolean).map(echapper).join(' · ')}</p>
            ${jeu ? `<p class="fiche-raison">${raisonRarete(jeu)}</p>` : ''}
            ${aUneVersionEX(jeu) ? `<p class="fiche-ex">${carte.ex
                ? t('Version EX : jeu adoré des joueurs mais peu connu, sa Qualité est calculée comme une rareté au-dessus.')
                : t('Ce jeu existe en version EX (5 % de chance quand il est tiré) : sa Qualité y est calculée comme une rareté au-dessus.')}</p>` : ''}
            ${gotyDe(carte.id) || (!carte.promo && carte.metacritic >= SEUIL_CHEF_OEUVRE) ? `<div class="fiche-distinctions">
                ${gotyDe(carte.id) ? `<p class="fiche-distinction">${LAURIER}${t('Jeu de l’année {annee}', { annee: gotyDe(carte.id).annee })}<span>${gotyDe(carte.id).ceremonie}</span></p>` : ''}
                ${!carte.promo && carte.metacritic >= SEUIL_CHEF_OEUVRE ? `<p class="fiche-distinction">${ICONES.medaille}${t('Chef-d’œuvre')}<span>${t('noté {n}/100 par la presse (Metacritic)', { n: carte.metacritic })}</span></p>` : ''}
            </div>` : ''}
            ${carte.tags?.length ? `<p class="fiche-tags">${carte.tags.map(tag => `<span${(groupesTags[t('Contenu sensible')] || []).includes(tag)
                ? ' class="tag-sensible"' : ''}>${echapper(tag)}</span>`).join('')}</p>` : ''}
            <dl class="fiche-stats">
                <div><dt>${STATS.attaque.icone} ${STATS.attaque.nom}</dt><dd>${carte.attaque} <span class="gris">· ${horsSteam(carte) ? t('jeu hors Steam') : jeu?.estime ? t('note estimée') : t('{n} % d’avis positifs', { n: carte.noteReelle ?? '?' })}</span></dd></div>
                <div><dt>★ ${STATS.popularite.nom}</dt><dd>${carte.popularite} <span class="gris">· ${horsSteam(carte) ? t('jeu hors Steam') : jeu?.estime
                    ? (carte.avis ? t('≈ {n} avis (estimés)', { n: nombre(carte.avis) }) : t('pas encore d’avis Steam'))
                    : t('{n} avis Steam', { n: carte.avis ? nombre(carte.avis) : '?' })}</span></dd></div>
                <div><dt>${STATS.anciennete.icone} ${STATS.anciennete.nom}</dt><dd>${carte.anciennete} <span class="gris">· ${t('sorti en {annee}', { annee: jeu && anneeOriginale(jeu) !== carte.annee
                    ? t('{annee} (sur Steam en {steam})', { annee: anneeOriginale(jeu), steam: carte.annee }) : carte.annee })}</span></dd></div>
                ${jeu?.joueurs > 1 && !jeu.promo ?`<div><dt>👥 ${t('Joueurs estimés')}</dt><dd>≈ ${formatJoueurs(jeu.joueurs)}</dd></div>` : ''}
                <div><dt>📰 Metacritic</dt><dd>${carte.metacritic ?? `<span class="gris">${t('aucune')}</span>`}</dd></div>
                ${horsSteam(carte) ? '' : `<div><dt># ${t('ID Steam')}</dt><dd>${carte.steam ?? carte.id}</dd></div>`}
            </dl>
            <p class="fiche-exemplaires">
                ${e
                    ? `${tn(e.exemplaires, '{n} exemplaire', '{n} exemplaires')}${[e.holos ? `${e.holos} holo` : '', e.exs ? `${e.exs} EX` : '', e.fullArts ? `${e.fullArts} Full Art` : ''].filter(Boolean).map(v => ` · ${v}`).join('')}
                       · ${t('obtenue le {date}', { date: new Date(e.obtenue).toLocaleDateString(LOCALE) })}`
                    : t('Pas encore dans ta collection.')}
            </p>
            <div class="fiche-actions">
                ${e ? boutonsVenteHTML(e) : ''}
                ${e ? boutonFusionHTML(e) : ''}
                ${!e && !carte.promo
                    ? `<button class="btn btn-principal" data-acheter="${carte.id}"${manque > 0 ? ` disabled title="${t('Il te manque {n} pièces', { n: nombre(manque) })}"` : ''}>
                           ${t('Acheter')} · ${nombre(rarete.prix)} ${PIECE}</button>`
                    : ''}
                ${horsSteam(carte)
                    ? `<a class="btn" href="${promoDe(carte).site}" target="_blank" rel="noopener">${t('Site officiel ↗')}</a>`
                    : `<a class="btn" href="https://store.steampowered.com/app/${carte.steam ?? carte.id}" target="_blank" rel="noopener">${t('Voir sur Steam ↗')}</a>`}
            </div>
            ${!e && !carte.promo && manque > 0 ? `<p class="fiche-note">${t('Il te manque {n} pièces.', { n: nombre(manque) })}</p>` : ''}
        </div>`;
    ouvrirModale();
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
    nom: (a, b) => comparerNoms(a.nom, b.nom),
};

let filtreRareteCatalogue = '';
// Dernière liste filtrée et triée : « Afficher plus », une vente ou un achat ne refont pas le tri des 115 000 jeux
let cacheCatalogue = { cle: null, jeux: [] };
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
    afficherMarche();
    $('#catalogue-raretes').innerHTML = pucesRaretesHTML({ actif: filtreRareteCatalogue, totaux: true });

    const selGenre = $('#catalogue-genre');
    if (selGenre.options.length <= 1) selGenre.innerHTML = optionsGenresHTML(selGenre.value);

    const recherche = $('#catalogue-nom').value.trim().toLowerCase();
    const genre = selGenre.value;
    const tri = $('#catalogue-tri').value;
    const cle = JSON.stringify([filtreRareteCatalogue, recherche, genre, tri]);
    if (cacheCatalogue.cle !== cle) {
        const bac = filtreRareteCatalogue ? jeuxParRarete[filtreRareteCatalogue] : tousLesJeux;
        const jeux = bac.filter(j => (!recherche || j.nomMin.includes(recherche)) && (!genre || aLeGenre(j, genre)));
        if (TRIS_CATALOGUE[tri]) jeux.sort(TRIS_CATALOGUE[tri]);
        cacheCatalogue = { cle, jeux };
    }
    // Le filtre « manquantes » dépend de la collection : appliqué à chaque fois, sans trier
    const visibles = $('#catalogue-manquantes').checked ? cacheCatalogue.jeux.filter(j => !etat.collection[j.id]) : cacheCatalogue.jeux;

    $('#grille-catalogue').innerHTML = visibles.length
        ? visibles.slice(0, limiteCatalogue).map(caseCatalogueHTML).join('')
        : `<p class="vide">${t('Aucun jeu ne correspond à ces filtres.')}</p>`;
    const restantes = visibles.length - limiteCatalogue;
    $('#btn-catalogue-plus').hidden = restantes <= 0;
    $('#btn-catalogue-plus').textContent = t('Afficher plus ({n} restants)', { n: nombre(restantes) });
    $('#resume-catalogue').textContent = t('{total} jeux · tu en possèdes {n}', { total: nombre(totalJeux()), n: nombre(jeuxPossedes().length) })
        + (visibles.length !== totalJeux() ? ` · ${t('{n} avec ces filtres', { n: nombre(visibles.length) })}` : '');
}

function filtrerCatalogue() {
    limiteCatalogue = CARTES_PAR_PAGE;
    afficherCatalogue();
}

function acheterCarte(id) {
    const jeu = jeuxParId.get(id);
    if (!jeu || jeu.promo || etat.collection[id]) return; // une promo ne s'obtient qu'avec son code cadeau
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

// ---------- Marché du jour ----------

// Offres du jour, tirées au premier passage de la journée puis gardées (elles ne bougent plus si ta collection change)
function offresDuJour() {
    if (etat.marche.jour !== jourLocal()) {
        const offres = MARCHE_RARETES.map(rarete => {
            const bac = jeuxParRarete[rarete];
            let jeu = auHasard(bac);
            for (let essai = 0; essai < 30 && etat.collection[jeu.id]; essai++) jeu = auHasard(bac);
            return jeu.id;
        });
        etat.marche = { jour: jourLocal(), offres, achetes: [] };
        sauvegarder();
    }
    return etat.marche.offres.map(id => jeuxParId.get(id)).filter(Boolean).map(jeu => creerCarte(jeu));
}

const prixNormal = carte => RARETES[indexRarete(carte.rarete)].prix;
const prixMarche = carte => Math.round(prixNormal(carte) * (1 - REMISE_MARCHE));

function afficherMarche() {
    $('#marche-offres').innerHTML = offresDuJour().map(carte => {
        const prix = prixMarche(carte);
        const achetee = etat.marche.achetes.includes(carte.id);
        const action = achetee
            ? `<span class="offre-etat">${t('Achetée ✓')}</span>`
            : etat.collection[carte.id]
                ? `<span class="offre-etat">${t('Déjà dans ta collection')}</span>`
                : `<button class="btn btn-or" data-marche="${carte.id}"${etat.pieces < prix ? ' disabled' : ''}>
                       <s>${nombre(prixNormal(carte))}</s> ${nombre(prix)} ${PIECE}</button>`;
        return `
            <div class="offre-marche">
                <button class="case-carte" data-fiche="${carte.id}" aria-label="${t('Voir {nom}', { nom: echapper(carte.nom) })}">${carteHTML(carte)}</button>
                ${action}
            </div>`;
    }).join('');
}

function acheterMarche(id) {
    const offre = offresDuJour().find(carte => carte.id === id);
    if (!offre || etat.marche.achetes.includes(id) || etat.collection[id]) return;
    const prix = prixMarche(offre);
    if (etat.pieces < prix) return toast(t('Il te manque {n} pièces pour acheter {nom}', { n: nombre(prix - etat.pieces), nom: offre.nom }));
    if (!confirm(t('Acheter {nom} pour {n} pièces ?', { nom: offre.nom, n: nombre(prix) }))) return;
    etat.pieces -= prix;
    etat.marche.achetes.push(id);
    ajouterACollection(offre, false);
    sauvegarder();
    majEntete();
    toast(t('{nom} rejoint ta collection !', { nom: offre.nom }), 'gain');
    verifierSucces();
    afficherCatalogue();
}

// ---------- Codes cadeaux ----------

function utiliserCode() {
    const champ = $('#code-cadeau');
    // Majuscules, sans espaces ni ponctuation (« Counter-Strike » marche comme « COUNTERSTRIKE »)
    const code = champ.value.toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '');
    if (!code || !donneesPretes()) return;
    const recompense = CODES_CADEAUX[btoa(code)];
    if (!recompense) return toast(t('Ce code n’existe pas'), 'erreur');
    if (etat.codes[code]) return toast(t('Tu as déjà utilisé ce code'), 'erreur');
    champ.value = '';
    activerCode(code, recompense);
}

// Verse la récompense d'un code (une seule fois par sauvegarde)
function activerCode(code, recompense) {
    etat.codes[code] = Date.now();
    // Une carte précise : elle rejoint la collection, le reste se verse comme une récompense de succès
    const { carte: idCarte, promo: idPromo, serie, boosterSerie, secret, ...reste } = recompense;
    const jeu = jeuxParId.get(idCarte);
    if (jeu) {
        ajouterACollection(creerCarte(jeu), false);
        toast(t('{nom} rejoint ta collection !', { nom: jeu.nom }), 'gain');
    }
    encaisserRecompense(reste, t('Code cadeau'));
    // Une carte promo : présentée dans une fenêtre, comme une récompense rare
    const promo = jeuxParId.get(idPromo);
    if (promo) {
        const carte = creerCarte(promo);
        const nouvelle = ajouterACollection(carte, false, true); // toutes les promos sont Full Art
        sauvegarder();
        jouerSonRarete(carte.rarete);
        $('#modale-contenu').innerHTML = `
            <div class="echange echange-resultat">
                <h2>${t('Carte promo obtenue !')}</h2>
                <p class="echange-intro">${t('Une édition spéciale, à part de la carte normale du jeu.')}</p>
                <div class="echange-carte">${flipHTML(carte, { retournee: true, nouvelle })}</div>
                <div class="echange-actions"><button class="btn" data-fiche="${carte.id}">${t('Voir la fiche')}</button></div>
            </div>`;
        ouvrirModale();
        verifierSucces();
    }
    if (serie) obtenirSerie(serie);
    if (boosterSerie) {
        const numero = boosterSerie === 'hasard' ? auHasard(seriesPromo()) : boosterSerie;
        ajouterCadeau(numero);
        toast(t('🎁 Un booster Série {n}, dans tes cadeaux !', { n: numero }), 'gain');
    }
}

// Logo cliqué 10 fois d'affilée (moins d'une seconde entre deux clics) : la petite carte fait des pirouettes
let clicsLogo = 0, minuteurLogo = null;
function compterClicLogo() {
    clearTimeout(minuteurLogo);
    minuteurLogo = setTimeout(() => (clicsLogo = 0), 1000);
    if (++clicsLogo < 10) return;
    clicsLogo = 0;
    const carte = $('.logo-carte');
    carte.classList.remove('logo-pirouette');
    void carte.offsetWidth; // relance l'animation
    carte.classList.add('logo-pirouette');
    if (etat.stats.logo) return jouerSon('succes');
    etat.stats.logo = 1;
    sauvegarder();
    verifierSucces();
}

// Code Konami : la suite de touches tapée n'importe où (hors champs de texte), une seule fois par sauvegarde
let progresKonami = 0;
function suivreKonami(e) {
    if (e.target.closest('input, textarea, select')) return;
    const touche = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    progresKonami = touche === CODE_KONAMI.touches[progresKonami] ? progresKonami + 1 : (touche === CODE_KONAMI.touches[0] ? 1 : 0);
    if (progresKonami < CODE_KONAMI.touches.length) return;
    progresKonami = 0;
    if (!donneesPretes()) return;
    if (etat.codes.KONAMI) return toast(t('Tu connais déjà le code Konami'), 'erreur');
    document.body.classList.add('konami');
    setTimeout(() => document.body.classList.remove('konami'), 1600);
    jouerSon('succes');
    toast(t('Code Konami !'), 'gain');
    activerCode('KONAMI', CODE_KONAMI.recompense);
}

// Toutes les promos d'une série d'un coup (code cadeau), présentées dans une fenêtre
function obtenirSerie(serie) {
    const cartes = promosDeSerie(serie).sort((a, b) => numeroPromo({ id: a }) - numeroPromo({ id: b }))
        .map(id => creerCarte(jeuxParId.get(id)));
    const nouvelles = cartes.map(carte => ajouterACollection(carte, false, true)); // toutes les promos sont Full Art
    sauvegarder();
    jouerSon('succes');
    $('#modale-contenu').innerHTML = `
        <div class="echange echange-resultat">
            <h2>${t('Série {n} complète !', { n: serie })}</h2>
            <p class="echange-intro">${tn(cartes.length, '{n} carte promo rejoint ta collection.', '{n} cartes promo rejoignent ta collection.')}</p>
            <div class="promos-obtenues">${cartes.map((carte, i) => `
                <button class="carte-choix" data-fiche="${carte.id}">${carteHTML(carte)}${nouvelles[i] ? `<span class="badge-nouvelle">${t('Nouvelle !')}</span>` : ''}</button>`).join('')}</div>
        </div>`;
    ouvrirModale();
    verifierSucces();
}

// ---------- Réinitialisation ----------

// Efface tout ce que le jeu a enregistré (clés "gameCards.")
function effacerSauvegarde() {
    try {
        Object.keys(localStorage).filter(cle => cle.startsWith('gameCards.')).forEach(cle => localStorage.removeItem(cle));
    } catch (e) {
        console.warn('Suppression impossible', e);
    }
}

// Efface la sauvegarde et repart de zéro
function reinitialiser() {
    const message = t('Supprimer définitivement ta sauvegarde ?\n\nTu perdras tes {cartes} cartes et tes {pieces} pièces. Cette action ne peut pas être annulée.',
        { cartes: nombre(nombreCartes()), pieces: nombre(etat.pieces) });
    if (!confirm(message)) return;
    effacerSauvegarde();
    location.hash = '#accueil';
    location.reload();
}

// ---------- Duel ----------

// Bonus des variantes en combat (duel et duel de decks), sur chaque stat : Full Art +3, Holo +2
const BONUS_COMBAT = { fullArt: 3, holo: 2 };
// Variante qui compte en combat : le Full Art passe avant la holo
// Une promo est toujours Full Art, mais sans le bonus en combat (ses stats sont déjà choisies à la main)
const varianteCombat = carte => (carte.promo ? null : carte.fullArts > 0 ? 'fullArt' : carte.holos > 0 ? 'holo' : null);
// Synergie (duel de decks et draft) : si les 3 cartes d'un deck partagent un genre ou un thème,
// chacune gagne ce bonus sur toutes ses stats (`carte.synergie`, posé au début de la partie)
const BONUS_SYNERGIE = 1;
const bonusCombat = carte => (BONUS_COMBAT[varianteCombat(carte)] ?? 0) + (carte.synergie ?? 0) + (carte.bonusRegle ?? 0);
const valeurCombat = (carte, stat) => carte[stat] + bonusCombat(carte);
// « (bonus Holo +2, synergie +1 compris) » après le score, quand ta carte en a un
function noteBonusCombat(carte) {
    const variante = varianteCombat(carte);
    const parties = [
        variante && `${VARIANTES[variante].nom} +${BONUS_COMBAT[variante]}`,
        carte.synergie && t('synergie +{n}', { n: carte.synergie }),
        carte.bonusRegle && t('{genre} +{n}', { genre: defiDeSerie(deckDuel.niveau?.serie).genre, n: carte.bonusRegle }),
    ].filter(Boolean);
    return parties.length ? ` ${t('(bonus {detail} compris)', { detail: parties.join(', ') })}` : '';
}

// Genres et thèmes communs à toutes ces cartes
const tagsCommuns = ([premiere, ...autres]) => (premiere
    ? [...premiere.genres, ...(premiere.tags || [])].filter(v => autres.every(c => aLeGenre(c, v)))
    : []);
// Le genre ou thème qui donne la synergie à un deck complet, sinon null
const tagSynergie = cartes => (cartes.length === TAILLE_DECK ? tagsCommuns(cartes)[0] ?? null : null);
// Pendant la composition : cette carte, ajoutée aux 2 déjà choisies, donnerait-elle la synergie ?
const completeSynergie = (choisies, carte) => choisies.length === TAILLE_DECK - 1 && tagsCommuns([...choisies, carte]).length > 0;
const BADGE_SYNERGIE = `<span class="badge-synergie" aria-hidden="true">✦ +${BONUS_SYNERGIE}</span>`;

// Boutons d'attaque : une stat par bouton, avec sa valeur sur la carte (`attribut` : data-stat ou data-stat-deck)
const boutonsStatsHTML = (carte, attribut, stats = Object.keys(STATS)) => stats.map(cle => [cle, STATS[cle]]).map(([cle, stat]) => `
        <button class="btn-stat" ${attribut}="${cle}"><span>${stat.icone} ${stat.nom}</span><b>${carte[cle]}</b></button>`).join('');

// Victoire payée selon les gains du jour du mode ; renvoie { pieces, taux }
function payerVictoire(mode, base) {
    const gain = gainDuJour(mode, base);
    etat.pieces += gain.pieces;
    sauvegarder();
    majEntete();
    return gain;
}

// Annonce d'une victoire en duel ou en duel de decks : toast et ligne de résultat
function annoncerVictoire(gain, a, b) {
    toast(t('Victoire ! +{n} pièces', { n: gain.pieces }) + noteGain(gain.taux), 'gain');
    return t('<br><b class="victoire">Victoire {a} à {b} !</b> Tu gagnes {n} pièces.', { a, b, n: gain.pieces }) + noteGain(gain.taux);
}

// Tirage d'une carte de duel : une rareté selon `chanceDuel`, puis une carte au hasard dedans.
// Pour toi, seules les raretés que tu possèdes comptent (leurs chances se répartissent entre elles).
function tirerCarteJoueur() {
    const parRarete = {};
    for (const e of possedees()) (parRarete[e.rarete] ??= []).push(e);
    const rarete = RARETES[tirerRarete('chanceDuel', RARETES.filter(r => parRarete[r.id]))];
    return auHasard(parRarete[rarete.id]);
}
// L'ordinateur peut aussi tomber sur une version EX
function tirerCarteOrdi(exclus) {
    return variante(piocher(tirerRarete('chanceDuel'), exclus), 0, 0).carte;
}

const duel = { joueur: 0, ordi: 0, manche: 0, carteJoueur: null, carteOrdi: null, verrou: false };

function actionsDuel(html) {
    $('#duel-actions').innerHTML = html;
}

function majScoreDuel() {
    const pips = n => Array.from({ length: MANCHES_GAGNANTES }, (_, i) => `<i${i < n ? ' class="plein"' : ''}></i>`).join('');
    for (const qui of ['joueur', 'ordi']) {
        $(`#pips-${qui}`).innerHTML = pips(duel[qui]);
        $(`#pips-${qui}`).setAttribute('aria-label', t('{n} manche(s) gagnée(s)', { n: duel[qui] }));
    }
}

function demarrerDuel() {
    if (!donneesPretes()) return;
    if (!possedees().length) {
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
    $('#duel-joueur').innerHTML = flipHTML(duel.carteJoueur, { holo: duel.carteJoueur.holos > 0, fullArt: duel.carteJoueur.fullArts > 0, retournee: true, bonus: bonusCombat(duel.carteJoueur) });
    // On voit le jeu adverse, pas ses stats : à toi de deviner où il est faible
    $('#duel-ordi').innerHTML = flipHTML(duel.carteOrdi, { retournee: true, cachee: true });
    $('#duel-manche').textContent = t('Manche {n}', { n: duel.manche });
    $('#duel-message').innerHTML = t('L’ordinateur joue <b>{nom}</b>. Sur quelle stat penses-tu le battre ?', { nom: echapper(duel.carteOrdi.nom) });
    actionsDuel(boutonsStatsHTML(duel.carteJoueur, 'data-stat'));
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

    // En cas d'égalité, la Popularité départage (bonus de variante compris)
    const mienne = valeurCombat(duel.carteJoueur, stat);
    const sienne = valeurCombat(duel.carteOrdi, stat);
    let ecart = mienne - sienne;
    let departage = '';
    if (!ecart && stat !== 'popularite') {
        const pm = valeurCombat(duel.carteJoueur, 'popularite');
        const ps = valeurCombat(duel.carteOrdi, 'popularite');
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
    $('#duel-message').innerHTML = `${t('{stat} : <b>{a}</b> contre <b>{b}</b>.', { stat: `${STATS[stat].icone} ${STATS[stat].nom}`, a: mienne, b: sienne })}${noteBonusCombat(duel.carteJoueur)}${departage} <b>${resultat}</b>`;

    if (duel.joueur >= MANCHES_GAGNANTES || duel.ordi >= MANCHES_GAGNANTES) finDuel();
    else actionsDuel(`<button class="btn btn-principal btn-grand" data-action="manche">${t('Manche suivante')}</button>`);
}

function finDuel() {
    const victoire = duel.joueur >= MANCHES_GAGNANTES;
    if (victoire) {
        etat.stats.duelsGagnes++;
        if (duel.ordi === 0) etat.stats.duelsParfaits++;
        progresserQuetes('duel');
        if (duel.ordi === 0) progresserQuetes('duel-parfait');
    }
    // Le détail de la dernière manche reste affiché au-dessus du résultat
    $('#duel-message').innerHTML += victoire
        ? annoncerVictoire(payerVictoire('duel', GAIN_DUEL), duel.joueur, duel.ordi)
        : t('<br><b class="defaite">Défaite {a} à {b}.</b> Retente ta chance !', { a: duel.joueur, b: duel.ordi });
    actionsDuel(`<button class="btn btn-principal btn-grand" data-action="demarrer">${t('Rejouer')}</button>`);
    jouerSon(victoire ? 'succes' : 'mauvaise');
    verifierSucces();
}

// ---------- Compteur de malchance ----------

function majMalchance() {
    const reste = MALCHANCE_MAX - etat.malchance;
    const texte = reste <= 1
        ? t('<b>Prochain booster : Légendaire garantie !</b>')
        : t('Légendaire garantie au plus tard dans <b>{n}</b> boosters', { n: reste });
    // La jauge se remplit à chaque booster sans Légendaire ni Mythique
    $('#malchance').innerHTML = `<p>${texte}</p><div class="malchance-jauge"><i style="--v: ${(etat.malchance / MALCHANCE_MAX) * 100}%"></i></div>`;
}

// Progression de l'accueil : une tuile par rareté (possédées / total, jauge et pourcentage)
function progressionRaretesHTML() {
    const pourcent = p => `${p > 0 && p < 0.1 ? '< ' + (0.1).toLocaleString(LOCALE) : p.toLocaleString(LOCALE, { maximumFractionDigits: p < 10 ? 1 : 0 })} %`;
    return RARETES.filter(r => !r.promo).map(r => {
        const n = nombreDeRarete(r.id);
        const total = totalDeRarete(r.id);
        const p = total ? (n / total) * 100 : 0;
        return `
            <div class="tuile-rarete rarete-${r.id}">
                <span class="tuile-nom"><i></i>${r.nom}</span>
                <b>${nombre(n)}<small> / ${nombre(total)}</small></b>
                <div class="tuile-jauge"><i style="--v: ${p > 0 ? Math.max(2, p) : 0}%"></i></div>
                <span class="tuile-pourcent">${pourcent(p)}</span>
            </div>`;
    }).join('');
}

// ---------- Succès ----------

// Années de GOTY couvertes par la collection (plusieurs éditions d'un même GOTY comptent pour une)
const anneesGotyPossedees = () => new Set(possedees().filter(e => GOTY[e.id]).map(e => GOTY[e.id][0])).size;
const ANNEES_GOTY = new Set(Object.values(GOTY).map(g => g[0])).size;

// Chaque succès se débloque quand valeur() atteint cible ; sa récompense se récupère ensuite dans le profil :
// { pieces }, { boosters } (classiques, ajoutés à la réserve), { prestiges } ou { fullArt } (une Légendaire ou Mythique au hasard)
const TOTAL_CODES_SECRETS = Object.values(CODES_CADEAUX).filter(r => r.secret).length + 1; // + le code Konami
const SUCCES = [
    // Collection
    { id: 'premier-pas', nom: t('Premier pas'), description: t('Obtenir ta première carte'), cible: 1, recompense: { boosters: 10 }, valeur: () => possedees().length },
    { id: 'collectionneur', nom: t('Collectionneur'), description: t('Posséder 100 jeux différents'), cible: 100, recompense: { pieces: 50 }, valeur: () => jeuxPossedes().length },
    { id: 'archiviste', nom: t('Archiviste'), description: t('Posséder 500 jeux différents'), cible: 500, recompense: { prestiges: 1 }, valeur: () => jeuxPossedes().length },
    { id: 'conservateur', nom: t('Conservateur de musée'), description: t('Posséder 1 000 jeux différents'), cible: 1000, recompense: { prestiges: 2 }, valeur: () => jeuxPossedes().length },
    { id: 'premiere-rare', nom: t('Ça devient rare'), description: t('Obtenir une carte Rare'), cible: 1, recompense: { pieces: 10 }, valeur: () => nombreDeRarete('rare') },
    { id: 'premiere-epique', nom: t('Épique !'), description: t('Obtenir une carte Épique'), cible: 1, recompense: { boosters: 10 }, valeur: () => nombreDeRarete('epique') },
    { id: 'premiere-legendaire', nom: t('Une légende'), description: t('Obtenir une carte Légendaire'), cible: 1, recompense: { pieces: 75 }, valeur: () => nombreDeRarete('legendaire') },
    { id: 'premiere-mythique', nom: t('Mythe vivant'), description: t('Obtenir une carte Mythique'), cible: 1, recompense: { prestiges: 1 }, valeur: () => nombreDeRarete('mythique') },
    { id: 'salle-legendes', nom: t('Salle des légendes'), description: t('Posséder 25 Légendaires différentes'), cible: 25, recompense: { fullArt: 1 }, valeur: () => nombreDeRarete('legendaire') },
    { id: 'pantheon', nom: t('Panthéon'), description: t('Posséder 5 Mythiques différentes'), cible: 5, recompense: { pieces: 500 }, valeur: () => nombreDeRarete('mythique') },
    { id: 'olympe', nom: t('Olympe'), description: t('Posséder toutes les Mythiques'), cible: MYTHIQUES.length, recompense: { pieces: 2000 }, valeur: () => nombreDeRarete('mythique') },
    { id: 'palmares', nom: t('Palmarès'), description: t('Posséder 5 jeux de l’année (années différentes)'), cible: 5, recompense: { prestiges: 1 }, valeur: anneesGotyPossedees },
    { id: 'tous-goty', nom: t('Toutes les cérémonies'), description: t('Posséder un jeu de l’année pour chaque année'), cible: ANNEES_GOTY, recompense: { pieces: 1000 }, valeur: anneesGotyPossedees },
    { id: 'critique', nom: t('Critique avisé'), description: t('Posséder 10 chefs-d’œuvre (Metacritic 90+)'), cible: 10, recompense: { boosters: 10 }, valeur: () => possedees().filter(e => !e.promo && e.metacritic >= SEUIL_CHEF_OEUVRE).length },
    { id: 'brillant', nom: t('Tout ce qui brille'), description: t('Obtenir une carte holo'), cible: 1, recompense: { pieces: 50 }, valeur: () => possedees().filter(e => e.holos > 0).length },
    { id: 'galerie-holo', nom: t('Galerie des glaces'), description: t('Posséder 10 cartes holo différentes'), cible: 10, recompense: { prestiges: 1 }, valeur: () => possedees().filter(e => e.holos > 0).length },
    { id: 'oeuvre-art', nom: t('Œuvre d’art'), description: t('Obtenir une carte Full Art'), cible: 1, recompense: { pieces: 100 }, valeur: () => jeuxPossedes().filter(e => e.fullArts > 0).length },
    { id: 'premiere-ex', nom: t('Pépite dénichée'), description: t('Obtenir une carte EX'), cible: 1, recompense: { pieces: 50 }, valeur: () => possedees().filter(e => e.exs > 0).length },
    { id: 'chercheur-pepites', nom: t('Chercheur de pépites'), description: t('Posséder 10 cartes EX différentes'), cible: 10, recompense: { boosters: 10 }, valeur: () => possedees().filter(e => e.exs > 0).length },
    { id: 'galerie-privee', nom: t('Galerie privée'), description: t('Posséder 5 cartes Full Art différentes'), cible: 5, recompense: { pieces: 500 }, valeur: () => jeuxPossedes().filter(e => e.fullArts > 0).length },
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
    { id: 'improvisateur', nom: t('Improvisateur'), description: t('Gagner un draft'), cible: 1, recompense: { boosters: 10 }, valeur: () => etat.stats.draftsGagnes },
    { id: 'maitre-draft', nom: t('Maître du draft'), description: t('Gagner 10 drafts'), cible: 10, recompense: { pieces: 100 }, valeur: () => etat.stats.draftsGagnes },
    { id: 'roi-draft', nom: t('Roi du draft'), description: t('Gagner 30 drafts'), cible: 30, recompense: { prestiges: 1 }, valeur: () => etat.stats.draftsGagnes },
    // Commerce
    { id: 'marchand', nom: t('Marchand'), description: t('Revendre un doublon'), cible: 1, recompense: { pieces: 10 }, valeur: () => etat.stats.ventes },
    { id: 'grossiste', nom: t('Grossiste'), description: t('Revendre 10 doublons'), cible: 10, recompense: { pieces: 100 }, valeur: () => etat.stats.ventes },
    // Quêtes du jour
    { id: 'aventurier', nom: t('Aventurier'), description: t('Terminer 10 quêtes du jour'), cible: 10, recompense: { boosters: 10 }, valeur: () => etat.stats.quetes },
    { id: 'queteur', nom: t('Quêteur assidu'), description: t('Terminer les 3 quêtes du jour, 7 jours'), cible: 7, recompense: { prestiges: 2 }, valeur: () => etat.stats.joursQuetes },
    // Secrets : le nom se voit, le détail reste flou tant qu'ils ne sont pas débloqués
    { id: 'curieux', secret: true, nom: t('Curieux'), description: t('Cliquer 10 fois d’affilée sur le logo'), cible: 1, recompense: { pieces: 100 }, valeur: () => etat.stats.logo },
    { id: 'fouineur', secret: true, nom: t('Fouineur'), description: t('Trouver 3 codes secrets'), cible: 3, recompense: { pieces: 200 }, valeur: codesSecretsTrouves },
    { id: 'hacker', secret: true, nom: t('Hacker'), description: t('Trouver tous les codes secrets'), cible: TOTAL_CODES_SECRETS, recompense: { prestiges: 2 }, valeur: codesSecretsTrouves },
    { id: 'old-school', secret: true, nom: t('Old school'), description: t('Taper le code Konami'), cible: 1, recompense: { boosters: 5 }, valeur: () => (etat.codes.KONAMI ? 1 : 0) },
    { id: 'noctambule', secret: true, nom: t('Noctambule'), description: t('Ouvrir un booster entre minuit et 5 h du matin'), cible: 1, recompense: { boosters: 5 }, valeur: () => etat.stats.nuit },
    { id: 'chat-noir', secret: true, nom: t('Chat noir'), description: t('Ouvrir 30 boosters d’affilée sans Légendaire ni Mythique'), cible: 30, recompense: { pieces: 300 }, valeur: () => etat.stats.pireMalchance },
    { id: 'overdose', secret: true, nom: t('Overdose'), description: t('Débloquer tous les autres succès secrets'), cible: 6, recompense: { carteSecrete: true },
        valeur: () => SUCCES.filter(x => x.secret && x.id !== 'overdose' && etat.succes[x.id]).length },
];

// ---------- Quêtes journalières ----------

// Chaque jour à minuit, 3 quêtes tirées au hasard : une facile, une moyenne, une difficile.
// `evenement` : l'action qui fait avancer la quête (voir progresserQuetes) ; seul ce qui est fait après le tirage compte
const NIVEAUX_QUETE = [
    { id: 'facile', nom: t('Facile') },
    { id: 'moyenne', nom: t('Moyenne') },
    { id: 'difficile', nom: t('Difficile') },
];
const QUETES = [
    { id: 'f-boosters', niveau: 'facile', texte: t('Ouvrir 3 boosters'), evenement: 'booster', cible: 3, recompense: { pieces: 50 } },
    { id: 'f-duel', niveau: 'facile', texte: t('Gagner 1 duel'), evenement: 'duel', cible: 1, recompense: { boosters: 1 } },
    { id: 'f-nouvelles', niveau: 'facile', texte: t('Découvrir 10 nouvelles cartes en boosters'), evenement: 'nouvelle', cible: 10, recompense: { pieces: 50 } },
    { id: 'f-draft', niveau: 'facile', texte: t('Jouer 1 draft'), evenement: 'draft-joue', cible: 1, recompense: { boosters: 1 } },
    { id: 'm-boosters', niveau: 'moyenne', texte: t('Ouvrir 10 boosters'), evenement: 'booster', cible: 10, recompense: { boosters: 3 } },
    { id: 'm-duels', niveau: 'moyenne', texte: t('Gagner 3 duels'), evenement: 'duel', cible: 3, recompense: { pieces: 100 } },
    { id: 'm-decks', niveau: 'moyenne', texte: t('Gagner 1 duel de decks'), evenement: 'decks-gagne', cible: 1, recompense: { pieces: 100 } },
    { id: 'm-epique', niveau: 'moyenne', texte: t('Obtenir une carte Épique ou mieux'), evenement: 'epique', cible: 1, recompense: { boosters: 3 } },
    { id: 'm-nouvelles', niveau: 'moyenne', texte: t('Découvrir 40 nouvelles cartes en boosters'), evenement: 'nouvelle', cible: 40, recompense: { pieces: 100 } },
    { id: 'm-draft', niveau: 'moyenne', texte: t('Gagner 1 draft'), evenement: 'draft-gagne', cible: 1, recompense: { boosters: 3 } },
    { id: 'd-prestige', niveau: 'difficile', texte: t('Ouvrir 1 booster Prestige'), evenement: 'prestige', cible: 1, recompense: { pieces: 200 } },
    { id: 'd-legendaire', niveau: 'difficile', texte: t('Obtenir une Légendaire ou une Mythique'), evenement: 'legendaire', cible: 1, recompense: { prestiges: 1 } },
    { id: 'd-defi', niveau: 'difficile', texte: t('Gagner 1 défi promo'), evenement: 'defi-gagne', cible: 1, recompense: { prestiges: 1 } },
    { id: 'd-parfait', niveau: 'difficile', texte: t('Gagner un duel 3 à 0'), evenement: 'duel-parfait', cible: 1, recompense: { pieces: 200 } },
    { id: 'd-holo', niveau: 'difficile', texte: t('Obtenir une carte holo'), evenement: 'holo', cible: 1, recompense: { pieces: 200 } },
    { id: 'd-decks', niveau: 'difficile', texte: t('Gagner un duel de decks en Difficile ou plus'), evenement: 'decks-difficile', cible: 1, recompense: { prestiges: 1 } },
];
const BONUS_QUETES = { boosters: 10 }; // les 3 quêtes du jour terminées
const queteDe = q => QUETES.find(x => x.id === q.id);

// Les quêtes d'aujourd'hui (tirées au premier appel de la journée)
function quetesDuJour() {
    if (etat.quetes.jour !== jourLocal() || etat.quetes.liste.some(q => !queteDe(q))) {
        etat.quetes = {
            jour: jourLocal(),
            liste: NIVEAUX_QUETE.map(n => ({ id: auHasard(QUETES.filter(q => q.niveau === n.id)).id, progres: 0, recuperee: false })),
            remplacee: false,
            bonus: false,
        };
        sauvegarder();
    }
    return etat.quetes;
}
const queteTerminee = q => q.progres >= queteDe(q).cible;

// Une action du joueur fait avancer les quêtes concernées ; une quête qui se termine est annoncée
function progresserQuetes(evenement, n = 1) {
    if (!n) return;
    const { liste } = quetesDuJour();
    let change = false;
    for (const q of liste) {
        const quete = queteDe(q);
        if (quete.evenement !== evenement || queteTerminee(q)) continue;
        q.progres = Math.min(quete.cible, q.progres + n);
        change = true;
        if (!queteTerminee(q)) continue;
        etat.stats.quetes++;
        toast(t('Quête terminée : {quete} ! Récupère ta récompense sur l’accueil', { quete: quete.texte }), 'gain');
        jouerSon('succes');
    }
    if (!change) return;
    if (liste.every(queteTerminee) && !etat.quetes.compteeJour) {
        etat.quetes.compteeJour = true;
        etat.stats.joursQuetes++;
    }
    sauvegarder();
    afficherQuetes();
    verifierSucces();
}

function recupererQuete(index) {
    const q = quetesDuJour().liste[index];
    if (!q || q.recuperee || !queteTerminee(q)) return;
    q.recuperee = true;
    encaisserRecompense(queteDe(q).recompense, t('Quête du jour'));
    afficherQuetes();
}

function recupererBonusQuetes() {
    const quetes = quetesDuJour();
    if (quetes.bonus || !quetes.liste.every(queteTerminee)) return;
    quetes.bonus = true;
    encaisserRecompense(BONUS_QUETES, t('Bonus des quêtes'));
    afficherQuetes();
}

// Une fois par jour : une quête pas encore terminée est remplacée par une autre du même niveau
function remplacerQuete(index) {
    const quetes = quetesDuJour();
    const q = quetes.liste[index];
    if (!q || quetes.remplacee || queteTerminee(q)) return;
    const autres = QUETES.filter(x => x.niveau === queteDe(q).niveau && !quetes.liste.some(l => l.id === x.id));
    if (!autres.length) return;
    quetes.liste[index] = { id: auHasard(autres).id, progres: 0, recuperee: false };
    quetes.remplacee = true;
    sauvegarder();
    afficherQuetes();
}

// Temps restant avant les quêtes de demain (appelé chaque seconde avec les paquets)
function majChronoQuetes() {
    const minuit = new Date();
    minuit.setHours(24, 0, 0, 0);
    const chrono = $('#quetes-chrono');
    if (chrono) chrono.textContent = t('Nouvelles quêtes dans {temps}', { temps: formatDuree(minuit - Date.now()) });
    if (etat.quetes.jour && etat.quetes.jour !== jourLocal()) afficherQuetes(); // minuit est passé
}

function afficherQuetes() {
    const bloc = $('#quetes');
    if (!bloc) return;
    const quetes = quetesDuJour();
    bloc.innerHTML = quetes.liste.map((q, index) => {
        const quete = queteDe(q);
        const finie = queteTerminee(q);
        return `
            <article class="quete quete-${quete.niveau}${finie ? ' terminee' : ''}${q.recuperee ? ' recuperee' : ''}">
                <span class="quete-niveau">${NIVEAUX_QUETE.find(n => n.id === quete.niveau).nom}</span>
                <p class="quete-texte">${quete.texte}</p>
                <span class="quete-progres"><i style="--v: ${(q.progres / quete.cible) * 100}%"></i>${nombre(q.progres)} / ${nombre(quete.cible)}</span>
                <div class="quete-pied">
                    <span class="quete-gain">${texteRecompense(quete.recompense)}</span>
                    ${q.recuperee
                        ? `<span class="quete-faite">✓ ${t('Récupérée')}</span>`
                        : finie
                            ? `<button class="btn btn-or quete-bouton" data-quete-recuperer="${index}">${t('Récupérer')}</button>`
                            : quetes.remplacee ? '' : `<button class="quete-remplacer" data-quete-remplacer="${index}" title="${t('Une fois par jour')}">↻ ${t('Remplacer')}</button>`}
                </div>
            </article>`;
    }).join('');
    const finies = quetes.liste.filter(queteTerminee).length;
    $('#quetes-bonus').innerHTML = `
        <span>${t('Bonus : termine les 3 quêtes')} · <b>${finies} / 3</b></span>
        ${quetes.bonus
            ? `<span class="quete-faite">✓ ${t('Récupéré')}</span>`
            : finies === 3
                ? `<button class="btn btn-or quete-bouton" data-quetes-bonus>${texteRecompense(BONUS_QUETES)}</button>`
                : `<span class="quete-gain">${texteRecompense(BONUS_QUETES)}</span>`}`;
    $('#quetes-bonus').classList.toggle('pret', finies === 3 && !quetes.bonus);
    majChronoQuetes();
}

// Codes secrets trouvés (les easter eggs, Konami compris), sur ce total
function codesSecretsTrouves() { return Object.keys(etat.codes).filter(code => code === 'KONAMI' || CODES_CADEAUX[btoa(code)]?.secret).length; }

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
    if (r.carteSecrete) return t('Carte secrète');
    return t('Carte Full Art');
}

// Verse une récompense (succès ou connexion) et l'annonce ; renvoie la carte Full Art gagnée, s'il y en a une
// (pas annoncée : elle arrive dans un paquet à ouvrir)
function verserRecompense(r) {
    let carte = null;
    let nouvelle = false;
    if (r.pieces) etat.pieces += r.pieces;
    // Les boosters gagnés s'ajoutent à la réserve, même au-delà de son maximum
    if (r.boosters) etat.charges.standard.charges += r.boosters;
    if (r.prestiges) etat.charges.prestige.charges += r.prestiges;
    if (r.fullArt) {
        carte = piocherNouvelle(tirerRarete('chance', HAUTES_RARETES));
        nouvelle = ajouterACollection(carte, false, true);
    }
    // La carte secrète arrive elle aussi dans un paquet à ouvrir
    if (r.carteSecrete && jeuxParId.get(ID_CARTE_SECRETE)) {
        carte = creerCarte(jeuxParId.get(ID_CARTE_SECRETE));
        nouvelle = ajouterACollection(carte, false, true);
    }
    sauvegarder();
    majEntete();
    majBadgeSucces();
    jouerSon('succes');
    if (r.pieces) toast(texteRecompense(r, false), 'gain');
    if (r.boosters) toast(tn(r.boosters, '+{n} booster ajouté à ta réserve', '+{n} boosters ajoutés à ta réserve'), 'gain');
    if (r.prestiges) toast(tn(r.prestiges, '+{n} Prestige ajouté à ta réserve', '+{n} Prestiges ajoutés à ta réserve'), 'gain');
    return { carte, nouvelle };
}

// Récompense (succès ou connexion) versée, profil et succès à jour ; une carte Full Art s'ouvre en paquet.
// Une à la fois : avec « Tout récupérer », les paquets s'ouvrent l'un après l'autre
function encaisserRecompense(r, origine) {
    const { carte, nouvelle } = verserRecompense(r);
    if (!$('#ecran-profil').hidden) afficherProfil();
    verifierSucces(); // la carte gagnée peut débloquer d'autres succès
    if (carte) fileFullArt = fileFullArt.then(() => ouvrirPaquetFullArt(carte, nouvelle, origine));
}

// Verse la récompense d'un succès obtenu (une seule fois)
function recupererSucces(id) {
    const succes = SUCCES.find(s => s.id === id);
    if (!succes || !etat.succes[id] || etat.succesRecuperes[id] || !donneesPretes()) return;
    etat.succesRecuperes[id] = Date.now();
    encaisserRecompense(succes.recompense, t('Récompense de succès'));
}

// ---------- Paquet Full Art (récompense de succès ou du 7ᵉ jour de connexion) ----------

let fileFullArt = Promise.resolve();
// Écran où revenir après l'ouverture (booster de série du Défi Promo : la partie), sinon les paquets
let retourApresOuverture = null;

// La carte arrive dans un paquet irisé à déchirer, puis se révèle face cachée, avec un peu de suspense.
// `origine` : d'où vient le paquet, rappelé devant la consigne ; `paquet`, `aide` et `classe` : pour un autre
// paquet que le Full Art (booster de série du Défi Promo)
async function ouvrirPaquetFullArt(carte, nouvelle, origine,
    { paquet = $('#paquet-full-art'), aide = t('Une carte <b>Full Art</b>… laquelle ?'), classe = '' } = {}) {
    while (ouvertureEnCours) await attendre(300);
    ouvertureEnCours = true;
    location.hash = '#accueil';
    afficherEcran('accueil');
    const tirage = [{ carte, fullArt: true, holo: false, ex: false, nouvelle }];

    debutOuverture(false);
    await dechirerPaquet(paquet, false, `${origine} · `);
    if (!seance.passer) {
        // Le dos de la carte brille de plus en plus fort… puis elle se retourne dans un éclair
        $('#ouverture-scene').innerHTML = `<div class="revelation-full-art ${classe}">${flipHTML(carte, { fullArt: true })}</div>`;
        $('#ouverture-aide').innerHTML = aide;
        await attendre(2000);
        const scene = $('#ouverture-scene .revelation-full-art');
        if (scene && !seance.passer) {
            scene.classList.add('eclair');
            scene.querySelector('.flip').classList.add('retournee');
            jouerSonRarete(carte.rarete);
            await attendre(1800);
        }
    }
    finOuverture(tirage, 1);
}

function toutRecuperer() {
    for (const s of succesARecuperer()) recupererSucces(s.id);
}

// ---------- Gains du jour ----------

// Pièces d'une victoire dans un mode ('duel', 'decks', 'draft'), selon le nombre de victoires déjà payées aujourd'hui
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

// ---------- Guide du premier lancement ----------

// Trois étapes, chacune illustrée par l'icône de son onglet
const ETAPES_GUIDE = [
    { ecran: 'accueil', titre: t('Ouvre des boosters'),
      texte: t('Chaque booster contient 5 cartes de vrais jeux Steam. Un booster gratuit arrive toutes les 5 minutes (jusqu’à 10 en réserve), et un Prestige, plus généreux, chaque jour.') },
    { ecran: 'collection', titre: t('Collectionne'),
      texte: t('Les cartes vont de Commune à Mythique, et leurs 3 stats (Qualité, Popularité, Ancienneté) viennent des vraies données Steam. Holo, EX et Full Art sont des versions rares. Revends tes doublons pour gagner des pièces.') },
    { ecran: 'duel', titre: t('Affronte l’ordinateur'),
      texte: t('Duel, duel de decks et draft rapportent des pièces, surtout ta première victoire du jour.') },
];
let etapeGuide = 0;

function afficherGuide(etape = 0) {
    etapeGuide = etape;
    etat.reglages.guideVu = true;
    sauvegarder();
    const { ecran, titre, texte } = ETAPES_GUIDE[etape];
    const icone = document.querySelector(`.menu a[data-ecran="${ecran}"] svg`)?.outerHTML ?? '';
    const derniere = etape === ETAPES_GUIDE.length - 1;
    $('#modale-contenu').innerHTML = `
        <div class="guide">
            <span class="guide-icone">${icone}</span>
            <p class="guide-etape">${t('Étape {n} / {total}', { n: etape + 1, total: ETAPES_GUIDE.length })}</p>
            <h2>${titre}</h2>
            <p>${texte}</p>
            <div class="guide-points" aria-hidden="true">${ETAPES_GUIDE.map((_, i) => `<i${i === etape ? ' class="actif"' : ''}></i>`).join('')}</div>
            <div class="guide-actions">
                ${derniere ? '' : `<button class="btn" data-guide="passer">${t('Passer')}</button>`}
                <button class="btn btn-principal" data-guide="${derniere ? 'fin' : 'suivant'}">${derniere ? t('C’est parti !') : t('Suivant')}</button>
            </div>
        </div>`;
    ouvrirModale();
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
    encaisserRecompense(RECOMPENSES_CONNEXION[jour - 1], t('Récompense du jour'));
}

// ---------- Écran profil ----------

function afficherProfil() {
    const faits = SUCCES.filter(s => etat.succes[s.id]).length;
    const stats = etat.stats;
    $('#resume-profil').textContent = t('{boosters} boosters ouverts · {duels} duels gagnés · {drafts} drafts gagnés',
        { boosters: nombre(stats.boosters), duels: nombre(stats.duelsGagnes), drafts: nombre(stats.draftsGagnes) });
    $('#succes-compte').textContent = `${faits} / ${SUCCES.length}`;
    // Ordre : à récupérer, puis en cours (les plus avancés d'abord), puis obtenus (les plus récents d'abord)
    const rang = s => (etat.succes[s.id] ? (etat.succesRecuperes[s.id] ? 2 : 0) : 1);
    const avancement = s => Math.min(s.valeur(), s.cible) / s.cible;
    const tries = [...SUCCES].sort((a, b) => rang(a) - rang(b)
        || (rang(a) === 1 ? avancement(b) - avancement(a) : (etat.succes[b.id] || 0) - (etat.succes[a.id] || 0)));
    const visibles = tousLesSucces ? tries : tries.slice(0, Math.max(SUCCES_VISIBLES, succesARecuperer().length));
    $('#btn-tous-succes').hidden = visibles.length === tries.length && !tousLesSucces;
    $('#btn-tous-succes').textContent = tousLesSucces ? t('Réduire la liste') : t('Voir tous les succès ({n})', { n: SUCCES.length });
    $('#succes-grille').innerHTML = visibles.map(succes => {
        const obtenu = etat.succes[succes.id];
        const aRecuperer = obtenu && !etat.succesRecuperes[succes.id];
        const valeur = Math.min(succes.valeur(), succes.cible);
        const cache = succes.secret && !obtenu;
        return `
            <article class="succes${obtenu ? ' obtenu' : ''}${aRecuperer ? ' a-recuperer' : ''}${cache ? ' succes-secret' : ''}">
                ${ICONES.trophee}
                <div class="succes-texte">
                    <h3>${succes.nom}</h3>
                    ${cache
                        ? `<p class="succes-flou" aria-label="${t('Succès secret')}"><span aria-hidden="true">${succes.description.replace(/\S/g, '•')}</span></p>
                    <span class="succes-cadenas">${t('Succès secret')}</span>`
                        : `<p>${succes.description}</p>`}
                    ${cache ? '' : aRecuperer
                        ? `<button class="btn btn-or succes-recuperer" data-recuperer="${succes.id}">${t('Récupérer')}</button>`
                        : obtenu
                            ? `<span class="succes-date">${t('Obtenu le {date}', { date: new Date(obtenu).toLocaleDateString(LOCALE) })}</span>`
                            : `<span class="succes-progres"><i style="--v: ${(valeur / succes.cible) * 100}%"></i>${nombre(valeur)} / ${nombre(succes.cible)}</span>`}
                </div>
                <span class="succes-gain${succes.recompense.fullArt || succes.recompense.carteSecrete ? ' gain-full-art' : ''}">${cache ? '???' : texteRecompense(succes.recompense)}</span>
            </article>`;
    }).join('');
    $('#btn-tout-recuperer').hidden = succesARecuperer().length < 2;
    $('#connexion-profil').innerHTML = calendrierConnexionHTML();
    $('#reglage-sons').checked = etat.reglages.sons;
    $('#reglage-langue').value = LANGUE;
}

// Succès affichés avant « Voir tous les succès » (tous ceux à récupérer le sont toujours)
const SUCCES_VISIBLES = 6;
let tousLesSucces = false;

// Écran « Jouer » : d'abord le choix du mode (mode = null), puis Duel, Duel de decks, Draft ou Défi Promo.
// Une partie en cours reste en mémoire : la reprendre, c'est rechoisir son mode.
// Draft et Défi Promo se jouent sur la table du duel de decks : passer de l'un à l'autre abandonne la partie en cours.
function changerModeJeu(mode) {
    $('#modes-jeu').hidden = Boolean(mode);
    $('#retour-modes').hidden = !mode;
    $('#mode-duel').hidden = mode !== 'duel';
    const surLaTable = ['decks', 'draft', 'promo'].includes(mode);
    $('#mode-decks').hidden = !surLaTable;
    if (mode === 'decks' && deckDuel.mode !== 'decks') Object.assign(deckDuel, { mode: 'decks', etape: 'niveau' });
    if (mode === 'draft' && deckDuel.mode !== 'draft') nouveauDraft();
    if (mode === 'promo' && deckDuel.mode !== 'promo') Object.assign(deckDuel, { mode: 'promo', etape: 'serie' });
    if (surLaTable) afficherDuelDecks();
    window.scrollTo(0, 0); // nouveau mode (ou retour au choix des modes) : en haut de la page
}

// ---------- Duel de decks ----------

// Chacun a un deck de 3 cartes, sous le plafond de rareté du niveau (pour toi comme pour l'ordinateur).
// À tour de rôle, l'attaquant pose une carte face cachée et annonce une stat ; le défenseur répond avec une
// de ses cartes sans voir celle de l'attaquant. Premier à 2 points. Score à égalité avant la dernière manche
// (ou à la fin) : les dernières cartes se départagent au total de leurs stats.
const TAILLE_DECK = 3;
const POINTS_VICTOIRE_DECK = Math.floor(TAILLE_DECK / 2) + 1;
// `intelligence` : probabilité que l'ordinateur joue son meilleur coup (sinon il joue au hasard)
// `elite` : son deck est tiré parmi les N meilleures cartes du jeu sous le plafond
// `deck` : sinon, la rareté de chacune de ses 3 cartes ; `meilleures` : part de la rareté où il pioche
// (0,5 = la meilleure moitié, au total des stats ; absente = toute la rareté)
// `fullArt` : une de ses Légendaires ou Mythiques est Full Art ; sinon `chanceHolo` : chance qu'une de ses cartes soit holo
const NIVEAUX_DECK = [
    { id: 'facile', nom: t('Facile'), max: 'peu-commune', gain: 5, intelligence: 0, deck: ['peu-commune', 'commune', 'commune'], chanceHolo: 0.2 },
    { id: 'normal', nom: t('Normal'), max: 'rare', gain: 10, intelligence: 0.5, deck: ['rare', 'rare', 'peu-commune'], meilleures: 0.5, chanceHolo: 0.35 },
    { id: 'difficile', nom: t('Difficile'), max: 'epique', gain: 20, intelligence: 0.8, deck: ['epique', 'epique', 'epique'], meilleures: 0.33, chanceHolo: 0.5 },
    { id: 'impossible', nom: t('Impossible'), max: 'legendaire', gain: 40, intelligence: 0.95, elite: 50, fullArt: true },
    { id: 'hardcore', nom: t('Hardcore'), max: 'mythique', gain: 80, intelligence: 1, elite: 15, fullArt: true },
];
// Draft : pas de collection ni de plafond. Chacun prend 1 carte parmi 3, trois fois (raretés selon `chanceDraft`).
// `seuil` : l'ordinateur défend comme s'il attendait une bonne Épique
const NIVEAU_DRAFT = { id: 'draft', nom: 'Draft', max: 'mythique', seuil: 'epique', gain: 15, intelligence: 0.8 };
const CHANCE_HOLO_DRAFT = 0.1;
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
    mode: 'decks',   // 'decks' (deck de ta collection), 'draft' ou 'promo' (Défi Promo)
    // Draft en cours : { propositions (les 3 cartes du choix), moi, ordi (cartes prises), exclus (jeux déjà sortis) }
    draft: null,
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

const totalStats = c => STATS_DECK.reduce((n, s) => n + valeurCombat(c, s), 0);
// Défi Promo à stat imposée : seule cette stat se joue, manche décisive comprise
const statImposee = () => (deckDuel.mode === 'promo' ? deckDuel.niveau?.stat : null) ?? null;
const statsPartie = () => (statImposee() ? [statImposee()] : STATS_DECK);
const valeurDecisive = c => (statImposee() ? valeurCombat(c, statImposee()) : totalStats(c));
const autoriseeAuNiveau = (rarete, niveau) => indexRarete(rarete === 'promo' ? PLAFOND_PROMO : rarete) >= indexRarete(niveau.max);
const cartesDuNiveau = niveau => possedees().filter(e => autoriseeAuNiveau(e.rarete, niveau));
// Cartes de ces jeux, de la meilleure à la moins bonne (total des stats)
const classerParTotal = jeux => jeux.map(j => creerCarte(j)).sort((a, b) => totalStats(b) - totalStats(a));

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

// Cartes d'une rareté, de la meilleure à la moins bonne (total des stats), calculées une seule fois
const classementParRarete = {};
function meilleuresDeRarete(rarete, part = 1) {
    classementParRarete[rarete] ??= classerParTotal(jeuxParRarete[rarete]);
    const liste = classementParRarete[rarete];
    return liste.slice(0, Math.max(TAILLE_DECK * 2, Math.round(liste.length * part)));
}

// Ce que l'ordinateur cherche dans un deck : une carte forte dans chaque stat, puis le meilleur total
const noteDeck = cartes => STATS_DECK.reduce((n, s) => n + Math.max(...cartes.map(c => c[s])), 0)
    + cartes.reduce((n, c) => n + totalStats(c), 0) / 10;

// L'ordinateur tire plus de cartes qu'il n'en faut, puis garde les 3 qui se complètent le mieux
function deckOrdinateur(niveau) {
    let combinaisons;
    if (niveau.elite) {
        meilleuresParNiveau[niveau.id] ??= classerParTotal(tousLesJeux.filter(j => autoriseeAuNiveau(j.rarete, niveau))).slice(0, niveau.elite);
        // 5 candidats : toutes les façons d'en garder 3
        const [a, b, c, d, e] = melanger(meilleuresParNiveau[niveau.id]).slice(0, 5);
        combinaisons = [[a, b, c], [a, b, d], [a, b, e], [a, c, d], [a, c, e], [a, d, e], [b, c, d], [b, c, e], [b, d, e], [c, d, e]];
    } else {
        // 2 candidats par emplacement, chacun dans la rareté prévue (et dans le haut de cette rareté)
        const exclus = new Set();
        const tirer = rarete => {
            const bac = niveau.meilleures ? meilleuresDeRarete(rarete, niveau.meilleures) : null;
            if (!bac) return piocher(indexRarete(rarete), exclus);
            let carte = auHasard(bac);
            for (let essai = 0; essai < 20 && exclus.has(carte.id); essai++) carte = auHasard(bac);
            exclus.add(carte.id);
            return carte;
        };
        const [[a1, a2], [b1, b2], [c1, c2]] = niveau.deck.map(rarete => [tirer(rarete), tirer(rarete)]);
        combinaisons = [a1, a2].flatMap(a => [b1, b2].flatMap(b => [c1, c2].map(c => [a, b, c])));
    }
    return combinaisons.reduce((meilleur, deck) => (noteDeck(deck) > noteDeck(meilleur) ? deck : meilleur));
}

// Défense : valeur que l'ordinateur s'attend à affronter dans une stat. Ton attaque vient de ta meilleure carte,
// on prend donc le haut de la rareté maximale du niveau (70 % des cartes font moins)
const seuilsDefense = {};
function seuilDefense(niveau, stat) {
    const cle = `${niveau.id}-${stat}`;
    if (seuilsDefense[cle] === undefined) {
        const valeurs = meilleuresDeRarete(niveau.seuil ?? niveau.max).map(c => c[stat]).sort((a, b) => a - b);
        seuilsDefense[cle] = valeurs[Math.floor(valeurs.length * 0.7)];
    }
    return seuilsDefense[cle];
}

// Coup de l'ordinateur : le meilleur avec la probabilité `intelligence` du niveau, sinon au hasard
function coupOrdi(role, stat) {
    const d = deckDuel;
    const malin = Math.random() < d.niveau.intelligence;
    if (role === 'attaque') {
        if (!malin) return { carte: auHasard(d.ordi), stat: auHasard(statsPartie()) };
        let meilleur = null;
        for (const carte of d.ordi) {
            for (const s of statsPartie()) {
                if (!meilleur || valeurCombat(carte, s) > valeurCombat(meilleur.carte, meilleur.stat)) meilleur = { carte, stat: s };
            }
        }
        return meilleur;
    }
    // Défense : il ne voit pas ta carte. Il répond avec sa plus petite carte qui dépasse la valeur qu'il attend ;
    // si aucune ne la dépasse, il sacrifie sa plus faible et garde ses atouts pour la suite
    if (!malin) return auHasard(d.ordi);
    const triees = [...d.ordi].sort((a, b) => valeurCombat(a, stat) - valeurCombat(b, stat));
    return triees.find(c => valeurCombat(c, stat) >= seuilDefense(d.niveau, stat)) ?? triees[0];
}

// Variantes du deck de l'ordinateur, sur des copies (ses cartes viennent d'un cache partagé) :
// une Full Art garantie en Impossible et Hardcore, au mieux une holo dans les autres niveaux
function variantesOrdi(deck, niveau) {
    const cartes = deck.map(carte => ({ ...carte }));
    if (niveau.fullArt) {
        const eligibles = cartes.filter(carte => estHauteRarete(carte.rarete));
        if (eligibles.length) auHasard(eligibles).fullArts = 1;
    } else if (Math.random() < (niveau.chanceHolo ?? 0)) {
        auHasard(cartes).holos = 1;
    }
    return cartes;
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

// ---------- Decks enregistrés ----------

const DECKS_MAX = 12;

// Les cartes d'un deck enregistré encore jouables à ce niveau (possédées, sous la rareté max)
const cartesJouables = (ids, niveau) => ids.filter(id => etat.collection[id] && autoriseeAuNiveau(etat.collection[id].rarete, niveau));

function sauverDeck() {
    const d = deckDuel;
    if (d.choix.length !== TAILLE_DECK) return;
    if (etat.decks.sauves.some(deck => deck.cartes.length === d.choix.length && deck.cartes.every(id => d.choix.includes(id)))) {
        return toast(t('Ce deck est déjà enregistré'));
    }
    if (etat.decks.sauves.length >= DECKS_MAX) return toast(t('{n} decks maximum : supprimes-en un d’abord', { n: DECKS_MAX }));
    const nom = prompt(t('Nom du deck :'), t('Deck {n}', { n: etat.decks.sauves.length + 1 }))?.trim();
    if (nom === undefined) return;
    etat.decks.sauves.push({ nom: (nom || t('Deck {n}', { n: etat.decks.sauves.length + 1 })).slice(0, 30), cartes: [...d.choix] });
    sauvegarder();
    toast(t('Deck « {nom} » enregistré', { nom: etat.decks.sauves.at(-1).nom }), 'gain');
}

function chargerDeck(ids) {
    const d = deckDuel;
    d.choix = cartesJouables(ids, d.niveau).slice(0, TAILLE_DECK);
    d.dernierAjout = null;
}

function supprimerDeck(index) {
    const deck = etat.decks.sauves[index];
    if (!deck || !confirm(t('Supprimer le deck « {nom} » ?', { nom: deck.nom }))) return;
    etat.decks.sauves.splice(index, 1);
    sauvegarder();
}

// Le dernier deck joué, puis les decks enregistrés : un clic les remet dans les emplacements.
// Un deck dont une carte manque ou dépasse la rareté max du niveau est grisé.
function decksSauvesHTML() {
    const d = deckDuel;
    const decks = [
        ...(etat.decks.dernier.length ? [{ nom: t('Dernier deck joué'), cartes: etat.decks.dernier, dernier: true }] : []),
        ...etat.decks.sauves.map((deck, index) => ({ ...deck, index })),
    ];
    if (!decks.length) return '';
    return `
        <div class="decks-sauves">${decks.map(deck => {
            const jouable = cartesJouables(deck.cartes, d.niveau).length === deck.cartes.length;
            const noms = deck.cartes.map(id => etat.collection[id]?.nom ?? '?').map(echapper).join(' · ');
            return `
            <div class="deck-sauve${deck.dernier ? ' deck-dernier' : ''}">
                <button class="deck-sauve-charger" data-deck-action="${deck.dernier ? 'charger-dernier' : 'charger'}" data-index="${deck.index ?? ''}"${jouable ? '' : ' disabled'}
                        title="${jouable ? noms : t('Une carte manque ou dépasse la rareté max de ce niveau')}">
                    <b>${deck.dernier ? '↺ ' : ''}${echapper(deck.nom)}</b><span>${noms}</span>
                </button>
                ${deck.dernier ? '' : `<button class="deck-sauve-supprimer" data-deck-action="supprimer" data-index="${deck.index}" aria-label="${t('Supprimer le deck « {nom} »', { nom: echapper(deck.nom) })}">✕</button>`}
            </div>`;
        }).join('')}</div>`;
}

function choixDeckHTML() {
    const d = deckDuel;
    const recherche = d.recherche.trim().toLowerCase();
    const valeur = c => (d.tri === 'total' ? totalStats(c) : c[d.tri]);
    // Les cartes du dernier deck joué d'abord, puis le tri choisi
    const dernier = new Set(etat.decks.dernier);
    const cartes = cartesDuNiveau(d.niveau)
        .filter(e => !recherche || e.nom.toLowerCase().includes(recherche))
        .sort((a, b) => dernier.has(b.id) - dernier.has(a.id) || valeur(b) - valeur(a) || totalStats(b) - totalStats(a));
    const choisies = d.choix.map(id => etat.collection[id]).filter(Boolean);
    return `
        <p class="duel-message">${t('Niveau {niveau} : clique sur tes cartes pour remplir les {n} emplacements de ton deck.',
            { niveau: d.niveau.nom, n: TAILLE_DECK })}</p>
        ${regleDefiHTML()}
        ${etatSynergieHTML(choisies)}
        <div class="deck-slots${tagSynergie(choisies) ? ' synergie' : ''}">${Array.from({ length: TAILLE_DECK }, (_, i) => {
            const carte = etat.collection[d.choix[i]];
            return carte
                ? `<button class="deck-slot plein${carte.id === d.dernierAjout ? ' arrive' : ''}" data-choix-deck="${carte.id}"
                        aria-label="${t('Retirer {nom} du deck', { nom: echapper(carte.nom) })}">
                        ${carteHTML(carte, { bonus: bonusCombat(carte) + bonusRegleDefi(carte) })}<span class="slot-retirer" aria-hidden="true">✕</span>
                    </button>`
                : `<div class="deck-slot"><span>${i + 1}</span></div>`;
        }).join('')}</div>
        <div class="duel-actions">
            ${d.mode === 'promo'
                ? `<button class="btn" data-deck-action="series">${t('Changer de série')}</button>`
                : `<button class="btn" data-deck-action="niveaux">${t('Changer de difficulté')}</button>`}
            <button class="btn" data-deck-action="sauver"${d.choix.length === TAILLE_DECK ? '' : ' disabled'}>💾 ${t('Enregistrer le deck')}</button>
            <button class="btn btn-principal" data-deck-action="lancer"${d.choix.length === TAILLE_DECK ? '' : ' disabled'}>${t('Lancer la partie')}${d.mode === 'promo' && !defisGratuitsRestants() ? ` · ${PRIX_DEFI} ${PIECE}` : ''}</button>
        </div>
        ${decksSauvesHTML()}
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
                ${!d.choix.includes(e.id) && completeSynergie(choisies, e) ? BADGE_SYNERGIE : ''}${carteHTML(e, { bonus: bonusCombat(e) + bonusRegleDefi(e) })}
            </button>`).join('')}</div>
        ${cartes.length > d.limite ? `<div class="plus"><button class="btn" data-deck-action="plus">${t('Afficher plus')}</button></div>` : ''}`;
}

function actionsDeckHTML() {
    const d = deckDuel;
    if (d.verrou) return '';
    if (d.attente === 'attaque' && d.carte !== null) {
        return boutonsStatsHTML(d.moi[d.carte], 'data-stat-deck', statsPartie());
    }
    if (d.actions === 'suivante') return `<button class="btn btn-principal btn-grand" data-deck-action="suivante">${t('Manche suivante')}</button>`;
    if (d.actions === 'decisive') return `<button class="btn btn-principal btn-grand" data-deck-action="decisive">${t('Révéler les dernières cartes')}</button>`;
    if (d.actions === 'fin' && d.mode === 'promo') {
        return `<button class="btn btn-principal btn-grand" data-deck-action="rejouer">${t('Rejouer')}</button>
            <button class="btn" data-deck-action="series">${t('Changer de série')}</button>`;
    }
    if (d.actions === 'fin' && d.mode === 'draft') {
        return `<button class="btn btn-principal btn-grand" data-deck-action="draft">${t('Nouveau draft')}</button>`;
    }
    if (d.actions === 'fin') {
        return `<button class="btn btn-principal btn-grand" data-deck-action="rejouer">${t('Rejouer')}</button>
            <button class="btn" data-deck-action="niveaux">${t('Changer de difficulté')}</button>`;
    }
    return '';
}

// Où en est la synergie du deck en cours de composition (duel de decks et draft)
function etatSynergieHTML(choisies) {
    const etiquette = tag => `<b class="tag-synergie">${echapper(tag)}</b>`;
    const tag = tagSynergie(choisies);
    const communs = choisies.length === TAILLE_DECK - 1 ? tagsCommuns(choisies) : [];
    const texte = tag
        ? t('Synergie {tag} : +{n} sur toutes les stats de tes {total} cartes !', { tag: etiquette(tag), n: BONUS_SYNERGIE, total: TAILLE_DECK })
        : communs.length
            ? t('Tes 2 cartes partagent {tags}. Choisis une 3ᵉ carte marquée ✦ pour la synergie : +{n} sur toutes les stats.', { tags: communs.slice(0, 4).map(etiquette).join(' '), n: BONUS_SYNERGIE })
            : t('Synergie : si tes {total} cartes partagent un genre ou un thème, elles gagnent +{n} sur toutes leurs stats.', { total: TAILLE_DECK, n: BONUS_SYNERGIE });
    return `<div class="synergie-bandeau${tag ? ' active' : communs.length ? ' proche' : ''}" role="status">
            <span class="synergie-icone" aria-hidden="true">✦</span><p>${texte}</p>
        </div>`;
}

// Bandeau au-dessus de la table : qui attaque, et sur quelle stat
function annonceStatHTML() {
    const c = deckDuel.combat;
    if (!c) return '<div class="stat-annoncee vide"></div>';
    if (c.stat === null) return `<div class="stat-annoncee">Σ <b>${statImposee() ? t('Manche décisive : {stat}', { stat: STATS[statImposee()].nom }) : t('Manche décisive : total des stats')}</b></div>`;
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
    const total = carte => (c && c.stat === null && carte ? `<span class="total-deck">Σ ${valeurDecisive(carte)}</span>` : '');
    // Sa holo ou son Full Art n'apparaissent qu'une fois la carte retournée, avec la pastille de bonus
    const variantesCarteOrdi = c?.ordi && { holo: c.ordi.holos > 0, fullArt: c.ordi.fullArts > 0, bonus: bonusCombat(c.ordi) };
    const carteOrdi = !c?.ordi ? '' : c.revele ? flipHTML(c.ordi, variantesCarteOrdi) : c.cache ? dos : carteHTML(c.ordi, variantesCarteOrdi);
    const mainOrdi = d.ordi.filter(carte => carte !== c?.ordi);
    const table = `${annonceStatHTML()}
        <div class="decks-combat${c?.ecart !== undefined ? ' compare' : ''}">
            <div class="duel-emplacement${resultat('moi')}${['moi', 'les-deux'].includes(c?.arrivee) ? ' arrivee-moi' : ''}" data-titre="${t('Ta carte')}">
                ${c?.moi ? carteHTML(c.moi, { bonus: bonusCombat(c.moi) }) : ''}${total(c?.moi)}
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
        ${synergiesPartieHTML()}
        ${regleDefiHTML()}
        <div class="decks-main decks-ordi">${mainOrdi.map(() => dos).join('')}</div>
        ${table}
        <p class="duel-message${d.actions === 'fin' ? ' resultat-final' : ''}">${d.message}</p>
        <div class="duel-actions">${actionsDeckHTML()}</div>
        <div class="decks-main">${d.moi.map((carte, i) => `
            <button class="carte-main${d.carte === i ? ' choisie' : ''}" data-carte-main="${i}"${d.attente && !d.verrou ? '' : ' disabled'}>
                ${carteHTML(carte, { bonus: bonusCombat(carte) })}
            </button>`).join('')}</div>`;
}

// Synergies de la partie, sous le score. Celle de l'ordinateur ne dit pas son thème (ce serait un indice sur ses cartes)
function synergiesPartieHTML() {
    const { moi, ordi } = deckDuel.synergies ?? {};
    if (!moi && !ordi) return '';
    return `<p class="synergies-partie">
        ${moi ? `<span class="synergie-deck active">${t('✦ Ta synergie « {tag} » : +{n}', { tag: echapper(moi), n: BONUS_SYNERGIE })}</span>` : ''}
        ${ordi ? `<span class="synergie-deck active par-ordi">${t('✦ Synergie de l’ordinateur : +{n}', { n: BONUS_SYNERGIE })}</span>` : ''}
    </p>`;
}

// Étape affichée en dernier : quand on passe à une autre (niveau, série, deck, draft, partie), on remonte en haut de la page
let etapeAffichee = null;

function afficherDuelDecks() {
    const d = deckDuel;
    if (d.etape !== etapeAffichee) window.scrollTo(0, 0);
    etapeAffichee = d.etape;
    const zone = $('#mode-decks');
    if (d.etape === 'niveau') zone.innerHTML = niveauxDeckHTML();
    else if (d.etape === 'serie') zone.innerHTML = seriesDefiHTML();
    else if (d.etape === 'deck') zone.innerHTML = choixDeckHTML();
    else if (d.etape === 'draft') zone.innerHTML = draftHTML();
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
    const moi = d.choix.map(id => ({ ...etat.collection[id] }));
    etat.decks.dernier = [...d.choix]; // proposé en premier à la prochaine composition
    sauvegarder();
    if (d.mode === 'promo') {
        if (!payerDefi()) return afficherDuelDecks();
        return demarrerPartieDecks(avecBonusRegle(moi), avecBonusRegle(deckDefiPromo(d.niveau.serie)));
    }
    demarrerPartieDecks(moi, variantesOrdi(deckOrdinateur(d.niveau), d.niveau));
}

// Début d'une partie (duel de decks ou draft) : le premier attaquant est tiré au sort,
// le gros message de la première manche l'annonce
function demarrerPartieDecks(moi, ordi) {
    // Synergie de chaque deck, posée sur des copies (les cartes de l'ordinateur viennent d'un cache partagé)
    const synergies = { moi: tagSynergie(moi), ordi: tagSynergie(ordi) };
    const avecSynergie = (deck, tag) => deck.map(carte => ({ ...carte, synergie: tag ? BONUS_SYNERGIE : 0 }));
    Object.assign(deckDuel, {
        moi: avecSynergie(moi, synergies.moi),
        ordi: avecSynergie(ordi, synergies.ordi),
        synergies,
        score: { moi: 0, ordi: 0 },
        attaquant: Math.random() < 0.5 ? 'moi' : 'ordi',
        etape: 'partie', combat: null, actions: null, attente: null, pointMarque: null,
    });
    mancheDecks(true);
}

// ---------- Draft ----------

// Une carte proposée : rareté selon `chanceDraft`, parfois holo (bonus en combat) ou EX
function carteDraft(exclus) {
    const { carte, holo } = variante(piocher(tirerRarete('chanceDraft'), exclus), CHANCE_HOLO_DRAFT, 0);
    return holo ? { ...carte, holos: 1 } : carte;
}
const propositionsDraft = exclus => Array.from({ length: 3 }, () => carteDraft(exclus));

// L'ordinateur fait son draft d'un coup, avec les mêmes chances : à chaque tour, il prend la carte
// qui complète le mieux son deck (ou, parfois, une au hasard)
function nouveauDraft() {
    if (!donneesPretes()) return;
    const exclus = new Set();
    const ordi = [];
    for (let i = 0; i < TAILLE_DECK; i++) {
        const choix = propositionsDraft(exclus);
        ordi.push(Math.random() < NIVEAU_DRAFT.intelligence
            ? choix.reduce((m, c) => (noteDeck([...ordi, c]) > noteDeck([...ordi, m]) ? c : m))
            : auHasard(choix));
    }
    Object.assign(deckDuel, {
        mode: 'draft', niveau: NIVEAU_DRAFT, etape: 'draft', actions: null,
        draft: { propositions: propositionsDraft(exclus), moi: [], ordi, exclus },
    });
}

function choisirDraft(i) {
    const draft = deckDuel.draft;
    draft.moi.push(draft.propositions[i]);
    if (draft.moi.length === TAILLE_DECK) return demarrerPartieDecks(draft.moi.map(c => ({ ...c })), draft.ordi);
    draft.propositions = propositionsDraft(draft.exclus);
    afficherDuelDecks();
}

function draftHTML() {
    const { propositions, moi } = deckDuel.draft;
    return `
        <p class="duel-message">${t('Choix {i} / {n} : prends une carte. L’ordinateur fait son draft de son côté, avec les mêmes chances.', { i: moi.length + 1, n: TAILLE_DECK })}</p>
        ${etatSynergieHTML(moi)}
        <div class="deck-slots">${Array.from({ length: TAILLE_DECK }, (_, i) => moi[i]
            ? `<div class="deck-slot plein${i === moi.length - 1 ? ' arrive' : ''}">${carteHTML(moi[i], { bonus: bonusCombat(moi[i]) })}</div>`
            : `<div class="deck-slot"><span>${i + 1}</span></div>`).join('')}</div>
        <div class="draft-choix">${propositions.map((carte, i) => `
            <button class="carte-choix" data-draft="${i}" aria-label="${t('Prendre {nom}', { nom: echapper(carte.nom) })}">
                ${completeSynergie(moi, carte) ? BADGE_SYNERGIE : ''}${carteHTML(carte, { bonus: bonusCombat(carte) })}
            </button>`).join('')}</div>`;
}

// ---------- Défi Promo ----------

// Un défi par série de promos, avec toute ta collection (pas de plafond de rareté) : une règle spéciale
// et un deck adverse propres à la série. `nom` : son thème ; `court` : la règle en quelques mots (tuile du choix de série) ;
// `stat` : la seule stat jouée ; `deck` : comment l'ordinateur compose le sien
const DEFIS_PROMO = {
    1: { nom: t('Coups de cœur'), court: t('Face aux meilleures cartes'), deck: 'top', regle: t('Pas de règle spéciale : l’ordinateur joue une des cartes les plus fortes du jeu dans chaque stat (Qualité, Popularité, Ancienneté), dont une Mythique.') },
    2: { nom: t('Hors Steam'), court: t('Popularité seule'), deck: 'synergie', stat: 'popularite', regle: t('Seule la Popularité compte. L’ordinateur joue une Mythique et 2 Légendaires qui partagent un thème (synergie +1).') },
    4: { nom: t('Rétro'), court: t('Ancienneté seule'), deck: 'anciens', stat: 'anciennete', regle: t('Seule l’Ancienneté compte. L’ordinateur joue une vieille Mythique et 2 vieilles Légendaires.') },
    // `genre` : les cartes de ce genre gagnent `bonus` sur toutes leurs stats (les tiennes comme celles de l'ordinateur)
    3: { nom: t('Pépites indé'), court: t('Indé +3'), deck: 'genre', genre: t('Indé'), bonus: 3, regle: t('Les jeux indé (et toutes les promos de la série) gagnent +3 sur toutes leurs stats, pour toi comme pour l’ordinateur. Il joue une Mythique et 2 Légendaires indé.') },
    5: { nom: t('Romance'), court: t('Romance +3'), deck: 'genre', genre: t('Romance'), bonus: 3, regle: t('Les jeux romance (et toutes les promos de la série) gagnent +3 sur toutes leurs stats, pour toi comme pour l’ordinateur. Il joue une Mythique et 2 Légendaires romance.') },
    6: { nom: t('Nintendo Switch'), court: t('Multijoueur +3'), deck: 'genre', genre: t('Multijoueur'), bonus: 3, regle: t('Les jeux multijoueur (et toutes les promos de la série) gagnent +3 sur toutes leurs stats, pour toi comme pour l’ordinateur. Il joue une Mythique et 2 Légendaires multijoueur.') },
    7: { nom: t('Science-fiction'), court: t('Science-fiction +3'), deck: 'genre', genre: t('Science-fiction'), bonus: 3, regle: t('Les jeux de science-fiction (et toutes les promos de la série) gagnent +3 sur toutes leurs stats, pour toi comme pour l’ordinateur. Il joue une Mythique et 2 Légendaires de science-fiction.') },
    8: { nom: t('Duo'), court: t('Face à une carte Duo'), deck: 'duo', regle: t('Pas de bonus : l’ordinateur joue une carte Duo de la série (la meilleure des deux jeux dans chaque stat) et 2 Légendaires.') },
    9: { nom: t('Ténèbres'), court: t('Horreur +3'), deck: 'genre', genre: t('Horreur'), bonus: 3, regle: t('Les jeux d’horreur (et toutes les promos de la série) gagnent +3 sur toutes leurs stats, pour toi comme pour l’ordinateur. Il joue une Mythique et 2 Légendaires d’horreur.') },
};
const defiDeSerie = serie => DEFIS_PROMO[serie] ?? DEFIS_PROMO[1];
// Défis gratuits chaque jour (compteur remis à zéro à minuit), puis chaque défi coûte PRIX_DEFI pièces
const DEFIS_GRATUITS = 3;
const PRIX_DEFI = 100;
function defisJour() {
    if (etat.defisJour?.jour !== jourLocal()) etat.defisJour = { jour: jourLocal(), joues: 0 };
    return etat.defisJour;
}
const defisGratuitsRestants = () => Math.max(0, DEFIS_GRATUITS - defisJour().joues);
// Compte le défi qui commence : gratuit s'il en reste, sinon payé. Renvoie false s'il manque des pièces
function payerDefi() {
    const gratuit = defisGratuitsRestants() > 0;
    if (!gratuit && etat.pieces < PRIX_DEFI) {
        toast(t('Il te faut {n} pièces pour un défi de plus aujourd’hui', { n: PRIX_DEFI }), 'erreur');
        return false;
    }
    if (!gratuit) etat.pieces -= PRIX_DEFI;
    defisJour().joues++;
    sauvegarder();
    majEntete();
    return true;
}
// Ligne d'info sous le titre du choix de série et sur le bouton de lancement
const infoDefisJourHTML = () => {
    const restants = defisGratuitsRestants();
    return restants
        ? tn(restants, 'Encore <b>{n}</b> défi gratuit aujourd’hui', 'Encore <b>{n}</b> défis gratuits aujourd’hui')
        : t('Plus de défi gratuit aujourd’hui : chaque défi coûte <b>{n}</b> {piece} (gratuits à nouveau demain)', { n: PRIX_DEFI, piece: PIECE });
};
// Récompense d'une victoire, tirée au hasard (chances en %) : un booster pour la réserve, des pièces,
// ou un booster de la série avec une de ses promos (doublons gardés)
const RECOMPENSES_DEFI = [
    { id: 'booster', chance: 10 },
    { id: 'pieces', chance: 10, pieces: 200 },
    { id: 'serie', chance: 80 },
];
const seriesPromo = () => [...new Set(Object.values(PROMOS).map(p => p.serie))].filter(n => n > 0).sort((a, b) => a - b); // sans la carte secrète
const promosDeSerie = serie => Object.keys(PROMOS).map(Number).filter(id => PROMOS[id].serie === serie && jeuxParId.get(id));
const niveauDefi = serie => ({ id: `defi-${serie}`, serie, nom: t('Série {n}', { n: serie }), max: 'mythique', intelligence: 0.67, stat: defiDeSerie(serie).stat ?? null });

// Légendaires et Mythiques du jeu, calculées une seule fois
let cartesHautesCache = null;
const cartesHautes = () => (cartesHautesCache ??= tousLesJeux.filter(j => estHauteRarete(j.rarete)).map(j => creerCarte(j)));
// Cartes des decks adverses des défis promo, calculées une seule fois : les Légendaires, et les Mythiques (une seule par deck, le « boss »)
let cartesDefiCache = null, mythiquesDefiCache = null;
const cartesDefi = () => (cartesDefiCache ??= tousLesJeux.filter(j => j.rarete === 'legendaire').map(j => creerCarte(j)));
const mythiquesDefi = () => (mythiquesDefiCache ??= tousLesJeux.filter(j => j.rarete === 'mythique').map(j => creerCarte(j)));

// Deck de l'ordinateur selon la série : une Mythique « boss » qui suit la règle de la série et 2 Légendaires
// (en série 8, la carte Duo tient le rôle du boss)
function deckDefiPromo(serie) {
    const force = c => c.attaque + c.popularite;
    const parmi = (cartes, n, combien = TAILLE_DECK - 1) => melanger(cartes.slice(0, n)).slice(0, combien);
    // Le boss : une Mythique parmi celles qui conviennent (à défaut, n'importe laquelle)
    const boss = convient => auHasard(mythiquesDefi().filter(convient).length ? mythiquesDefi().filter(convient) : mythiquesDefi());
    const regle = defiDeSerie(serie);
    if (regle.deck === 'synergie') {
        // Un genre ou thème partagé par au moins 3 des Légendaires les plus populaires : 2 de ses 30 premières,
        // et une Mythique du même thème
        const populaires = [...cartesDefi()].sort((a, b) => b.popularite - a.popularite).slice(0, 80);
        const parTag = {};
        for (const c of populaires) for (const tag of [...c.genres, ...(c.tags || [])]) (parTag[tag] ??= []).push(c);
        const [tag, groupe] = auHasard(Object.entries(parTag).filter(([, g]) => g.length >= TAILLE_DECK));
        return melanger([boss(c => aLeGenre(c, tag)), ...parmi(groupe, 30)]);
    }
    if (regle.deck === 'genre') {
        // 2 Légendaires du genre parmi ses 60 plus fortes, et une Mythique du genre (le bonus de la règle s'applique des deux côtés)
        const duGenre = cartesDefi().filter(c => aLeGenre(c, regle.genre)).sort((a, b) => force(b) - force(a));
        return melanger([boss(c => aLeGenre(c, regle.genre)), ...parmi(duGenre, 60)]);
    }
    if (regle.deck === 'duo') {
        // Une carte Duo de la série (la meilleure des deux jeux dans chaque stat) et 2 Légendaires au hasard
        const duo = creerCarte(jeuxParId.get(auHasard(promosDeSerie(serie))));
        return melanger([duo, ...melanger(cartesDefi().filter(c => c.id !== duo.id)).slice(0, TAILLE_DECK - 1)]);
    }
    if (regle.deck === 'anciens') {
        // Une des 10 plus vieilles Mythiques, et 2 Légendaires parmi les 40 plus vieilles
        const parAge = cartes => [...cartes].sort((a, b) => b.anciennete - a.anciennete || force(b) - force(a));
        return melanger([auHasard(parAge(mythiquesDefi()).slice(0, 10)), ...parmi(parAge(cartesDefi()), 40)]);
    }
    // Un spécialiste par stat (Qualité, Popularité, Ancienneté), sans prendre deux fois le même jeu : pour une stat tirée
    // au hasard, une Mythique parmi les 10 meilleures dans cette stat ; pour les deux autres, une Légendaire parmi les 60 meilleures
    const statBoss = auHasard(STATS_DECK);
    const deck = [];
    for (const stat of STATS_DECK) {
        const vivier = stat === statBoss ? mythiquesDefi() : cartesDefi();
        const meilleures = vivier.filter(c => !deck.some(d => d.id === c.id))
            .sort((a, b) => b[stat] - a[stat] || force(b) - force(a));
        deck.push(auHasard(meilleures.slice(0, stat === statBoss ? 10 : 60)));
    }
    return deck;
}

// Bonus d'une carte selon la règle du défi en cours (jeux indé de la série 3, romances de la série 5, multijoueur de la série 6, science-fiction de la série 7, horreur de la série 9, et les promos de la série), sinon 0
function bonusRegleDefi(carte) {
    const regle = deckDuel.mode === 'promo' && deckDuel.niveau ? defiDeSerie(deckDuel.niveau.serie) : null;
    const concernee = regle?.genre && (aLeGenre(carte, regle.genre) || promoDe(carte)?.serie === deckDuel.niveau.serie);
    return concernee ? regle.bonus : 0;
}
const avecBonusRegle = deck => deck.map(carte => ({ ...carte, bonusRegle: bonusRegleDefi(carte) }));

const regleDefiHTML = () => (deckDuel.mode === 'promo' && deckDuel.niveau
    ? `<p class="defi-regle">${defiDeSerie(deckDuel.niveau.serie).regle}</p>` : '');

function seriesDefiHTML() {
    const assez = possedees().length >= TAILLE_DECK;
    return `
        <p class="defis-jour">${infoDefisJourHTML()}</p>
        <div class="defis-promo">${seriesPromo().map(serie => {
            const ids = promosDeSerie(serie);
            if (!ids.length) return '';
            const possedes = ids.filter(id => etat.collection[id]).length;
            const defi = defiDeSerie(serie);
            const complete = possedes === ids.length;
            // Tuile compacte : une carte de la série, son thème, sa règle en quelques mots (en entier au survol) et la progression
            return `
            <button class="defi-promo${complete ? ' defi-complet' : ''}" data-serie="${serie}" title="${echapper(defi.regle)}"${assez ? '' : ' disabled'}>
                <span class="defi-apercu" aria-hidden="true">${carteHTML(creerCarte(jeuxParId.get(ids[0])))}</span>
                <span class="defi-texte">
                    <b class="titre-serie serie-${serie}">${t('Série {n}', { n: serie })}</b>
                    <strong class="defi-nom">${defi.nom ?? ''}</strong>
                    <span class="defi-tag">${defi.court ?? ''}</span>
                    <span class="defi-progression" aria-hidden="true"><i style="width: ${Math.round(possedes / ids.length * 100)}%"></i></span>
                    <small>${t('{a} / {b} promos', { a: possedes, b: ids.length })}${complete ? ` · ${t('Complète')} ✓` : ''}</small>
                </span>
            </button>`;
        }).join('')}</div>
        ${assez ? '' : `<p class="duel-message">${t('Il te faut au moins {n} cartes dans ta collection.', { n: TAILLE_DECK })}</p>`}`;
}

function tirerRecompenseDefi() {
    let tirage = Math.random() * 100;
    return RECOMPENSES_DEFI.find(r => (tirage -= r.chance) < 0) ?? RECOMPENSES_DEFI[0];
}

// Récompense d'une victoire, versée tout de suite (rien n'est perdu si la fenêtre est fermée) puis annoncée
// dans une fenêtre : un booster rejoint la réserve, les pièces le compte, une promo la collection.
// Renvoie la phrase du résultat
// Pas de fenêtre : la partie continue sans interruption, la récompense est écrite dans le message de fin.
// Le booster de série rejoint l'onglet Cadeaux, à ouvrir plus tard.
function recompenseDefi(serie) {
    const recompense = tirerRecompenseDefi();
    if (recompense.id === 'pieces') etat.pieces += recompense.pieces;
    else if (recompense.id === 'booster') etat.charges.standard.charges++;
    else ajouterCadeau(serie);
    sauvegarder();
    majEntete();
    verifierSucces();
    jouerSon('succes');
    const texte = {
        pieces: t('+{n} pièces', { n: recompense.pieces }),
        booster: t('+1 booster ajouté à ta réserve'),
        serie: t('🎁 Un booster Série {n}, dans tes cadeaux !', { n: serie }),
    }[recompense.id];
    return t('Récompense : <b>{texte}</b>', { texte });
}

// ---------- Cadeaux : boosters de série en attente d'ouverture ----------

// `etat.cadeaux` : la série de chaque booster reçu (Défi Promo, code cadeau), dans l'ordre d'arrivée
function ajouterCadeau(serie) {
    etat.cadeaux.push(serie);
    sauvegarder();
    majBadgeCadeaux();
    if (!$('#ecran-cadeaux').hidden) afficherCadeaux();
}

function majBadgeCadeaux() {
    const n = etat.cadeaux.length;
    $('#compte-cadeaux').textContent = n || '';
    $('#compte-cadeaux').hidden = !n;
}

// Un paquet par série, avec le nombre de boosters de cette série
function afficherCadeaux() {
    const parSerie = new Map();
    for (const serie of etat.cadeaux) parSerie.set(serie, (parSerie.get(serie) || 0) + 1);
    $('#resume-cadeaux').textContent = etat.cadeaux.length
        ? tn(etat.cadeaux.length, '{n} booster à ouvrir', '{n} boosters à ouvrir')
        : t('Aucun booster à ouvrir');
    $('#cadeaux-vide').hidden = parSerie.size > 0;
    $('#btn-ouvrir-cadeaux').hidden = etat.cadeaux.length < 2;
    $('#btn-ouvrir-cadeaux').textContent = t('Ouvrir les {n} boosters', { n: etat.cadeaux.length });
    $('#cadeaux-grille').replaceChildren(...[...parSerie].sort(([a], [b]) => a - b).map(([serie, n]) => {
        const paquet = paquetPromo(serie);
        paquet.hidden = false;
        paquet.removeAttribute('tabindex');
        paquet.removeAttribute('aria-hidden');
        paquet.dataset.cadeau = serie;
        paquet.setAttribute('aria-label', t('Ouvrir un booster Série {n}', { n: serie }));
        const caseCadeau = document.createElement('div');
        caseCadeau.className = 'cadeau';
        caseCadeau.append(paquet);
        caseCadeau.insertAdjacentHTML('beforeend', `<span class="cadeau-legende">${t('Série {n}', { n: serie })} <b>×${n}</b></span>`);
        return caseCadeau;
    }));
}

// Ouvre un booster de la série : la promo est tirée maintenant, puis le paquet se déchire.
// « Retour » ramène ensuite aux cadeaux.
function ouvrirCadeau(serie) {
    const index = etat.cadeaux.indexOf(serie);
    if (index < 0 || ouvertureEnCours || !donneesPretes()) return;
    etat.cadeaux.splice(index, 1);
    const carte = creerCarte(jeuxParId.get(auHasard(promosDeSerie(serie))));
    const nouvelle = ajouterACollection(carte, false, true); // toutes les promos sont Full Art
    sauvegarder();
    majBadgeCadeaux();
    verifierSucces();
    retourApresOuverture = '#cadeaux';
    ouvrirPaquetPromo(carte, nouvelle, serie);
}

// Tous les cadeaux d'un coup : les promos sont tirées maintenant, puis un seul paquet à déchirer
// (celui de la série la plus présente), la pile des promos à faire défiler et le récapitulatif
function ouvrirTousLesCadeaux() {
    if (etat.cadeaux.length < 2 || ouvertureEnCours || !donneesPretes()) return;
    const series = etat.cadeaux;
    etat.cadeaux = [];
    const tirage = series.map(serie => {
        const carte = creerCarte(jeuxParId.get(auHasard(promosDeSerie(serie))));
        return { carte, fullArt: true, holo: false, ex: false, nouvelle: ajouterACollection(carte, false, true) };
    });
    sauvegarder();
    majBadgeCadeaux();
    verifierSucces();
    retourApresOuverture = '#cadeaux';
    const compte = new Map();
    for (const serie of series) compte.set(serie, (compte.get(serie) || 0) + 1);
    const principale = [...compte].sort((a, b) => b[1] - a[1])[0][0];

    fileFullArt = fileFullArt.then(async () => {
        while (ouvertureEnCours) await attendre(300);
        ouvertureEnCours = true;
        location.hash = '#accueil';
        afficherEcran('accueil');
        debutOuverture(false);
        const rang = `${t('{n} boosters promo', { n: series.length })} · `;
        await dechirerPaquet(paquetPromo(principale), false, rang);
        if (!seance.passer) await defilerPile(tirage, rang);
        finOuverture(tirage, 1); // récapitulatif simple : les promos ne se rangent pas avec les autres raretés
    });
}

// Booster d'une série (onglet Cadeaux) : son paquet à déchirer, puis la promo se révèle
function ouvrirPaquetPromo(carte, nouvelle, serie) {
    fileFullArt = fileFullArt.then(() => ouvrirPaquetFullArt(carte, nouvelle, t('Booster Série {n}', { n: serie }),
        { paquet: paquetPromo(serie), aide: t('Une carte <b>Promo</b>… laquelle ?'), classe: 'sans-prisme' }));
}

// Couleurs du paquet de chaque série (pastel, bleu et or, encres de risographie, console grise, sakura, Joy-Con)
const FONDS_PAQUET_PROMO = {
    1: 'linear-gradient(160deg, #ffc6e5 0%, #e3c7ff 50%, #b9d4ff 100%)',
    2: 'linear-gradient(160deg, #0a1a5c 0%, #1c3faa 55%, #c9a24c 100%)',
    4: 'linear-gradient(160deg, #d3cfc6 0%, #8f8b82 100%)',
    3: 'linear-gradient(160deg, #f3ead8 0%, #ff6b5b 55%, #1d2b64 100%)',
    5: 'linear-gradient(160deg, #ffffff 0%, #ffd6e7 50%, #ff8fbf 100%)',
    6: 'linear-gradient(90deg, #0ab9e6 0%, #0ab9e6 22%, #2b2b30 22%, #2b2b30 78%, #ff3c28 78%)',
    7: 'linear-gradient(160deg, #10246a 0%, #060c2a 55%, #c9a24c 100%)',
    8: 'linear-gradient(110deg, #6fd3ff 0%, #6fd3ff 49%, #ffffff 49%, #ffffff 51%, #ff8fc7 51%)',
    9: 'linear-gradient(160deg, #1e1e1e 0%, #050505 55%, #000000 100%)',
};
// Paquet d'un booster de série : le modèle Full Art, recoloré et renommé
function paquetPromo(serie) {
    const paquet = $('#paquet-full-art').cloneNode(true);
    paquet.removeAttribute('id');
    paquet.classList.add('paquet-promo', `paquet-serie-${serie}`); // design propre à certaines séries (style.css)
    paquet.style.setProperty('--fond-paquet', FONDS_PAQUET_PROMO[serie] ?? FONDS_PAQUET_PROMO[1]);
    paquet.querySelector('.paquet-type').textContent = t('Promo S{n}', { n: serie });
    return paquet;
}

// `premiere` : première manche, le gros message dit qui commence
function mancheDecks(premiere = false) {
    const d = deckDuel;
    Object.assign(d, { carte: null, combat: null, actions: null, attente: null, pointMarque: null });
    if (d.moi.length === 1 && d.score.moi === d.score.ordi) {
        d.actions = 'decisive';
        d.message = statImposee()
            ? t('Égalité ! Dernière manche : vos dernières cartes se départagent en {stat}.', { stat: STATS[statImposee()].nom })
            : t('Égalité ! Dernière manche : vos dernières cartes se départagent au total de leurs stats.');
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
    const statNommee = stat ?? statImposee();
    const nomStat = statNommee ? `${STATS[statNommee].icone} ${STATS[statNommee].nom}` : t('Total des stats');
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
    const valeur = c => (stat ? valeurCombat(c, stat) : valeurDecisive(c));
    let ecart = valeur(carteMoi) - valeur(carteOrdi);
    // Égalité sur une stat annoncée : le défenseur l'emporte (la manche décisive au total reste nulle)
    const egaliteDefendue = !ecart && stat;
    if (egaliteDefendue) ecart = d.combat.par === 'moi' ? -1 : 1;
    const gagnant = ecart > 0 ? 'moi' : ecart < 0 ? 'ordi' : null;
    if (gagnant) d.score[gagnant]++;
    const resultat = (egaliteDefendue ? `${t('Égalité : le défenseur l’emporte.')} ` : '')
        + ({ moi: t('Manche gagnée !'), ordi: t('Manche perdue.') }[gagnant] ?? t('Égalité parfaite, personne ne marque.'));
    Object.assign(d, {
        combat: { moi: carteMoi, ordi: carteOrdi, stat, ecart, par: d.combat.par },
        pointMarque: gagnant,
        message: `${t('{stat} : <b>{a}</b> contre <b>{b}</b>.', { stat: nomStat, a: valeur(carteMoi), b: valeur(carteOrdi) })}${noteBonusCombat(carteMoi)} <b>${resultat}</b>`,
        verrou: false,
    });
    jouerSon({ moi: 'bonne', ordi: 'mauvaise' }[gagnant] ?? 'carte');
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
    if (d.mode === 'draft') progresserQuetes('draft-joue');
    if (gagnant === 'moi' && d.mode === 'promo') {
        etat.stats.defisGagnes++;
        progresserQuetes('defi-gagne');
        d.message += t('<br><b class="victoire">Victoire {a} à {b} !</b> {recompense}', { a: moi, b: ordi, recompense: recompenseDefi(d.niveau.serie) });
    } else if (gagnant === 'moi') {
        if (d.mode === 'draft') etat.stats.draftsGagnes++;
        else etat.stats.decksGagnes++;
        progresserQuetes(d.mode === 'draft' ? 'draft-gagne' : 'decks-gagne');
        if (d.mode === 'decks' && ['difficile', 'impossible', 'hardcore'].includes(d.niveau.id)) progresserQuetes('decks-difficile');
        if (d.niveau.id === 'hardcore') etat.stats.decksHardcore++;
        d.message += annoncerVictoire(payerVictoire(d.mode, d.niveau.gain), moi, ordi);
    } else if (gagnant === 'ordi') {
        d.message += t('<br><b class="defaite">Défaite {a} à {b}.</b> Retente ta chance !', { a: moi, b: ordi });
    } else {
        d.message += t('<br><b>Match nul.</b>');
    }
    jouerSon({ moi: 'succes', ordi: 'mauvaise' }[gagnant] ?? 'carte');
    d.actions = 'fin';
    verifierSucces();
}

function actionDuelDecks(element) {
    const d = deckDuel;
    if (d.verrou) return;
    const { niveau, serie, choixDeck, carteMain, statDeck, deckAction, draft } = element.dataset;
    if (draft !== undefined) {
        return choisirDraft(Number(draft));
    } else if (deckAction === 'draft') {
        nouveauDraft();
    } else if (niveau) {
        Object.assign(d, { niveau: NIVEAUX_DECK.find(n => n.id === niveau), choix: [], recherche: '', limite: CARTES_CHOIX_DECK, etape: 'deck' });
    } else if (serie) {
        Object.assign(d, { niveau: niveauDefi(Number(serie)), choix: [], recherche: '', limite: CARTES_CHOIX_DECK, etape: 'deck' });
    } else if (deckAction === 'series') {
        d.etape = 'serie';
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
    } else if (deckAction === 'sauver') {
        sauverDeck();
    } else if (deckAction === 'charger') {
        chargerDeck(etat.decks.sauves[Number(element.dataset.index)]?.cartes ?? []);
    } else if (deckAction === 'charger-dernier') {
        chargerDeck(etat.decks.dernier);
    } else if (deckAction === 'supprimer') {
        supprimerDeck(Number(element.dataset.index));
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
        effacerSauvegarde();
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
    RENDUS_ECRAN[nom]?.();
    if (nom === 'duel') changerModeJeu(null);
    window.scrollTo(0, 0);
}

// Écrans dont le contenu se recalcule à l'affichage (et une fois les jeux chargés)
const RENDUS_ECRAN = {
    accueil: afficherAccueil,
    collection: afficherCollection,
    catalogue: afficherCatalogue,
    profil: afficherProfil,
    cadeaux: afficherCadeaux,
};

// ---------- Démarrage ----------

function init() {
    document.addEventListener('keydown', suivreKonami);
    $('.logo').addEventListener('click', compterClicLogo);
    // Pour les curieux qui ouvrent la console (F12)
    console.log(`%cGameCards%c\n${t('Tu fouilles dans la console ? Bien vu. Code secret :')} ${atob('REVWVE9PTFM=')}`,
        'font: 900 22px sans-serif; color: #f5c542', 'font: 14px sans-serif');
    traduirePage();

    // Accueil : paquets et ouverture
    $('#paquet-gratuit').addEventListener('click', () => cliquerPaquet(TYPES_BOOSTER.standard));
    $('#paquet-prestige').addEventListener('click', () => cliquerPaquet(TYPES_BOOSTER.prestige));
    $('#btn-tout-ouvrir').addEventListener('click', () =>
        ouvrirBooster('gratuit', chargesDispo(TYPES_BOOSTER.standard), TYPES_BOOSTER.standard));
    $('#btn-tout-ouvrir-prestige').addEventListener('click', () =>
        ouvrirBooster('gratuit', chargesDispo(TYPES_BOOSTER.prestige), TYPES_BOOSTER.prestige));
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
    $('#btn-retour').addEventListener('click', () => {
        afficherAccueil();
        if (retourApresOuverture) location.hash = retourApresOuverture;
        retourApresOuverture = null;
    });
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
    $('#filtre-nom').addEventListener('input', differer(filtrerCollection));
    $('#btn-plus').addEventListener('click', () => {
        limiteCollection += CARTES_PAR_PAGE;
        afficherCollection();
    });
    $('#btn-vendre-tout').addEventListener('click', vendreTousLesDoublons);
    $('#btn-echanger').addEventListener('click', proposerEchange);
    $('#btn-reinitialiser').addEventListener('click', reinitialiser);

    // Catalogue
    $('#catalogue-raretes').addEventListener('click', e => {
        const puce = e.target.closest('[data-rarete]');
        if (!puce) return;
        filtreRareteCatalogue = puce.dataset.rarete;
        filtrerCatalogue();
    });
    for (const id of ['#catalogue-genre', '#catalogue-tri', '#catalogue-manquantes']) $(id).addEventListener('change', filtrerCatalogue);
    $('#catalogue-nom').addEventListener('input', differer(filtrerCatalogue));
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
            if ($('#modale-vente').open) $('#modale-vente').close();
            vendreDepuisFiche(id, vendre.dataset.variante);
            if ($('#modale').open) afficherFiche(id);
            return;
        }
        const marche = e.target.closest('[data-marche]');
        if (marche) return acheterMarche(Number(marche.dataset.marche));
        const fusion = e.target.closest('[data-fusion]');
        if (fusion) return fusionnerHolo(Number(fusion.dataset.fusion));
        const echange = e.target.closest('[data-echanger]');
        if (echange) return echangerDoublons(echange.dataset.echanger);
        if (e.target.closest('[data-echange-encore]')) return proposerEchange();
        const choixVente = e.target.closest('[data-choix-vente]');
        if (choixVente) return choisirVente(Number(choixVente.dataset.choixVente));
        const fiche = e.target.closest('[data-fiche]');
        if (fiche) afficherFiche(Number(fiche.dataset.fiche));
    });

    // Fiche : fermeture par le bouton ou en cliquant à côté
    $('#modale-fermer').addEventListener('click', () => $('#modale').close());
    $('#modale').addEventListener('click', e => {
        if (e.target === $('#modale')) $('#modale').close();
    });
    // Choix de l'exemplaire à vendre : fermeture par le bouton ou en cliquant à côté
    $('#modale-vente').addEventListener('click', e => {
        if (e.target === $('#modale-vente') || e.target.closest('.modale-fermer')) $('#modale-vente').close();
    });
    // Récompense du jour : depuis la fenêtre d'arrivée ou le Profil
    document.addEventListener('click', e => {
        if (e.target.closest('[data-connexion]')) recupererConnexion();
        const guide = e.target.closest('[data-guide]');
        if (guide) {
            if (guide.dataset.guide === 'suivant') afficherGuide(etapeGuide + 1);
            else $('#modale').close();
        }
    });
    // Guide fermé (fin, « Passer », croix ou clic à côté) : retour aux boosters, puis la récompense du jour
    $('#modale').addEventListener('close', () => {
        if (!$('#modale-contenu .guide')) return;
        $('#modale-contenu').innerHTML = '';
        if (location.hash && location.hash !== '#accueil') location.hash = '#accueil';
        setTimeout(proposerConnexion, 300);
    });
    $('#btn-guide').addEventListener('click', () => afficherGuide());
    // Cadeaux : un clic sur le paquet d'une série en ouvre un booster
    $('#cadeaux-grille').addEventListener('click', e => {
        const paquet = e.target.closest('[data-cadeau]');
        if (paquet) ouvrirCadeau(Number(paquet.dataset.cadeau));
    });
    $('#btn-ouvrir-cadeaux').addEventListener('click', ouvrirTousLesCadeaux);
    majBadgeCadeaux();
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

    // Jouer : choix du mode, Duel de decks et Draft
    $('#modes-jeu').addEventListener('click', e => {
        const mode = e.target.closest('[data-mode]');
        if (mode) changerModeJeu(mode.dataset.mode);
    });
    $('#retour-modes').addEventListener('click', () => changerModeJeu(null));
    $('#mode-decks').addEventListener('click', e => {
        const element = e.target.closest('[data-niveau], [data-serie], [data-choix-deck], [data-carte-main], [data-stat-deck], [data-deck-action], [data-draft]');
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
    $('#btn-tous-succes').addEventListener('click', () => {
        tousLesSucces = !tousLesSucces;
        afficherProfil();
        if (!tousLesSucces) $('#succes-grille').scrollIntoView({ block: 'nearest' });
    });
    // Quêtes du jour (accueil)
    $('#bloc-quetes').addEventListener('click', e => {
        const bouton = e.target.closest('[data-quete-recuperer], [data-quete-remplacer], [data-quetes-bonus]');
        if (!bouton || !donneesPretes()) return;
        if (bouton.dataset.queteRecuperer !== undefined) recupererQuete(Number(bouton.dataset.queteRecuperer));
        else if (bouton.dataset.queteRemplacer !== undefined) remplacerQuete(Number(bouton.dataset.queteRemplacer));
        else recupererBonusQuetes();
    });
    $('#succes-grille').addEventListener('click', e => {
        const bouton = e.target.closest('[data-recuperer]');
        if (bouton) recupererSucces(bouton.dataset.recuperer);
    });
    $('#btn-tout-recuperer').addEventListener('click', toutRecuperer);
    $('#form-code').addEventListener('submit', e => {
        e.preventDefault();
        utiliserCode();
    });
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
            RENDUS_ECRAN[location.hash.slice(1) || 'accueil']?.();
            verifierSucces(); // succès déjà atteints par une collection existante
            majBadgeSucces();
            if (!etat.reglages.guideVu && !possedees().length) afficherGuide();
            else proposerConnexion();
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
