'use strict';

/* =========================================================
   Langues : le français est la langue d'origine (tous les textes du code et de la page sont en français).
   EN donne la traduction anglaise de chaque texte français ; un texte absent reste en français.
   ========================================================= */

const LANGUES = { fr: 'Français', en: 'English' };

// Langue choisie dans le profil (réglages sauvegardés), sinon l'anglais, langue par défaut du jeu
function langueDeDepart() {
    try {
        const choisie = JSON.parse(localStorage.getItem('gameCards.reglages'))?.langue;
        if (LANGUES[choisie]) return choisie;
    } catch { /* réglages illisibles : on garde la langue par défaut */ }
    return 'en';
}
const LANGUE = langueDeDepart();
const LOCALE = LANGUE === 'en' ? 'en-US' : 'fr-FR';

// Textes manquants rencontrés (pour vérifier la traduction depuis la console : TEXTES_MANQUANTS)
const TEXTES_MANQUANTS = new Set();

// t('Il te manque {n} pièces', { n: 30 }) : le texte dans la langue choisie, {n} remplacé par sa valeur
function t(texte, valeurs = {}) {
    let traduit = texte;
    if (LANGUE === 'en') {
        traduit = EN[texte];
        if (traduit === undefined) {
            TEXTES_MANQUANTS.add(texte);
            traduit = texte;
        }
    }
    return traduit.replace(/\{(\w+)\}/g, (_, cle) => valeurs[cle] ?? '');
}

// Singulier ou pluriel selon n (règle de chaque langue : 0 est singulier en français, pluriel en anglais)
function tn(n, singulier, pluriel, valeurs = {}) {
    const auPluriel = LANGUE === 'fr' ? n > 1 : n !== 1;
    return t(auPluriel ? pluriel : singulier, { n: n.toLocaleString(LOCALE), ...valeurs });
}

// Textes de la page (index.html) :
//   data-i18n          → le contenu HTML de l'élément (espaces resserrés) est traduit avec t()
//   data-i18n="cle"    → le contenu est remplacé par EN_PAGE[cle] (longs paragraphes)
//   data-i18n-texte    → seulement le texte direct de l'élément (ses enfants, comme un interrupteur, restent)
//   data-i18n-attr="placeholder,aria-label" → ces attributs sont traduits avec t()
function traduirePage() {
    document.documentElement.lang = LANGUE;
    if (LANGUE === 'fr') return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const cle = el.dataset.i18n;
        if (cle) {
            if (EN_PAGE[cle] === undefined) TEXTES_MANQUANTS.add(cle);
            else el.innerHTML = EN_PAGE[cle];
        } else {
            el.innerHTML = t(el.innerHTML.replace(/\s+/g, ' ').trim());
        }
    });
    document.querySelectorAll('[data-i18n-texte]').forEach(el => {
        for (const noeud of el.childNodes) {
            const texte = noeud.nodeType === Node.TEXT_NODE && noeud.textContent.trim();
            if (texte) noeud.textContent = noeud.textContent.replace(texte, t(texte));
        }
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
        for (const attribut of el.dataset.i18nAttr.split(',')) el.setAttribute(attribut, t(el.getAttribute(attribut)));
    });
}

// ---------- Anglais : textes courts (page et script) ----------

const EN = {
    // Raretés, stats, variantes, boosters
    'Mythique': 'Mythic',
    'Légendaire': 'Legendary',
    'Épique': 'Epic',
    'Rare': 'Rare',
    'Peu commune': 'Uncommon',
    'Commune': 'Common',
    'Qualité': 'Quality',
    'Popularité': 'Popularity',
    'Ancienneté': 'Age',
    'Normale': 'Regular',
    'booster': 'booster',
    '5 cartes': '5 cards',

    // Menu, en-tête, pied de page
    'Jeu de cartes à collectionner où chaque carte est un vrai jeu vidéo.': 'A collectible card game where every card is a real video game.',
    'GameCards, accueil': 'GameCards, home',
    'Menu principal': 'Main menu',
    'Boosters': 'Boosters',
    'Collection': 'Collection',
    'Catalogue': 'Catalog',
    'Jouer': 'Play',
    'Règles': 'Rules',
    'Profil': 'Profile',
    'Tes pièces': 'Your coins',
    'Fermer': 'Close',
    'Données : <a href="https://www.kaggle.com/datasets/fronkongames/steam-games-dataset" target="_blank" rel="noopener">Steam Games Dataset</a> (Kaggle) · images © Steam · GameCards, projet personnel':
        'Data: <a href="https://www.kaggle.com/datasets/fronkongames/steam-games-dataset" target="_blank" rel="noopener">Steam Games Dataset</a> (Kaggle) · images © Steam · GameCards, personal project',

    // Accueil
    'Ouvre un booster': 'Open a booster',
    '5 vrais jeux vidéo par paquet, dont au moins une carte <b class="texte-peu-commune">Peu commune</b>.':
        '5 real video games per pack, including at least one <b class="texte-peu-commune">Uncommon</b> card.',
    'Ta progression': 'Your progress',
    'Dernières trouvailles': 'Latest finds',
    'Toute la collection →': 'Whole collection →',
    'Attrape le haut du paquet et glisse le long pour le déchirer': 'Grab the top of the pack and slide along it to tear it open',
    'Passer': 'Skip',
    'Tout passer': 'Skip all',
    'Retour': 'Back',
    'Voir ma collection': 'See my collection',
    'Ouvrir un {type} gratuit ({n} disponible)': 'Open a free {type} ({n} available)',
    'Ouvrir un {type} gratuit ({n} disponibles)': 'Open a free {type} ({n} available)',
    'Plus de {type} gratuit, prochain dans {duree}. Cliquer pour en acheter': 'No free {type} left, next one in {duree}. Click to buy one',
    'gratuit': 'free',
    'gratuits': 'free',
    'prochain dans {duree}': 'next in {duree}',
    'réserve pleine': 'reserve full',
    'Prochain gratuit dans {duree}<br>Clique pour en acheter': 'Next free one in {duree}<br>Click to buy one',
    'Ouvrir les {n} boosters gratuits': 'Open all {n} free boosters',
    'Plus de {type} gratuit': 'No free {type} left',
    'Le prochain arrive dans <b>{duree}</b>. En attendant, tu peux en acheter :': 'The next one arrives in <b>{duree}</b>. Meanwhile, you can buy some:',
    'Acheter 1 {type}': 'Buy 1 {type}',
    'Ouvrir': 'Open',
    'Tu as': 'You have',
    ' : revends des doublons ou gagne des duels pour en avoir plus.': ': sell duplicates or win duels to earn more.',
    'Il te manque {n} pièces. Revends des doublons ou gagne un duel !': 'You need {n} more coins. Sell duplicates or win a duel!',
    'Paquet {i} / {n}': 'Pack {i} / {n}',
    '<b>{n}</b> god pack ouvert': '<b>{n}</b> god pack opened',
    '<b>{n}</b> god packs ouverts': '<b>{n}</b> god packs opened',
    'le premier le {date}': 'the first on {date}',
    'Ouvrir le paquet': 'Open the pack',
    'Carte <b>{i} / {n}</b> · glisse-la pour voir la suivante': 'Card <b>{i} / {n}</b> · swipe it to see the next one',
    'Nouvelle !': 'New!',
    '{n} cartes divines': '{n} divine cards',
    'Tes meilleures cartes': 'Your best cards',
    'Rare et plus': 'Rare and above',
    'Le reste': 'The rest',
    'Communes et peu communes': 'Commons and uncommons',
    'Voir le détail de la carte': 'See card details',
    '<b class="texte-rarete">{n}</b> Mythique': '<b class="texte-rarete">{n}</b> Mythic',
    '<b class="texte-rarete">{n}</b> Mythiques': '<b class="texte-rarete">{n}</b> Mythics',
    '<b>{n}</b> nouvelle': '<b>{n}</b> new',
    '<b>{n}</b> nouvelles': '<b>{n}</b> new',
    'Meilleure :': 'Best:',
    '<b>{n}</b> holo': '<b>{n}</b> holo',
    '<b>{n}</b> holos': '<b>{n}</b> holos',
    '<b>{n}</b> / {total} jeux découverts': '<b>{n}</b> / {total} games discovered',
    'Chargement des jeux…': 'Loading games…',
    'Voir {nom}': 'See {nom}',
    '<b>Prochain booster : Légendaire garantie !</b>': '<b>Next booster: guaranteed Legendary!</b>',
    'Légendaire garantie au plus tard dans <b>{n}</b> boosters': 'Guaranteed Legendary within <b>{n}</b> boosters at most',

    // Collection
    'Filtrer par rareté': 'Filter by rarity',
    'Rechercher un jeu…': 'Search for a game…',
    'Rechercher un jeu': 'Search for a game',
    'Filtrer par genre ou thème': 'Filter by genre or theme',
    'Trier': 'Sort',
    'Tri : rareté': 'Sort: rarity',
    'Tri : obtenues récemment': 'Sort: recently obtained',
    'Tri : qualité': 'Sort: quality',
    'Tri : ancienneté': 'Sort: age',
    'Tri : popularité': 'Sort: popularity',
    'Tri : année': 'Sort: year',
    'Tri : nom': 'Sort: name',
    'Tri : exemplaires': 'Sort: copies',
    'Doublons': 'Duplicates',
    'Revendre les doublons': 'Sell duplicates',
    'Aucun doublon': 'No duplicates',
    'Afficher plus': 'Show more',
    'Toutes': 'All',
    'Tous les genres et thèmes': 'All genres and themes',
    'Distinctions': 'Awards',
    'Genres': 'Genres',
    'GOTY (jeu de l’année)': 'GOTY (game of the year)',
    'Chef-d’œuvre (Metacritic 90+)': 'Masterpiece (Metacritic 90+)',
    'Ta collection est vide.': 'Your collection is empty.',
    'Ouvre ton premier booster': 'Open your first booster',
    'Aucune carte ne correspond à ces filtres.': 'No card matches these filters.',
    'Afficher plus ({n} restantes)': 'Show more ({n} left)',
    '{jeux} jeux différents · {cartes} cartes · {doublons} doublons': '{jeux} different games · {cartes} cards · {doublons} duplicates',
    'C’est ton seul exemplaire de « {nom} » : la carte quittera ta collection. La vendre quand même ?':
        'This is your only copy of “{nom}”: the card will leave your collection. Sell it anyway?',
    '+{n} pièces': '+{n} coins',
    'Revendre tous tes doublons pour {n} pièces ? Tu gardes un exemplaire de chaque jeu (la holo en priorité).':
        'Sell all your duplicates for {n} coins? You keep one copy of each game (the holo first).',

    // Fiche d'une carte
    'Chef-d’œuvre': 'Masterpiece',
    'Metacritic : {n} / 100': 'Metacritic: {n} / 100',
    'Jeu de l’année {annee}': 'Game of the Year {annee}',
    'Mythique : l’un des 22 jeux les plus cultes du jeu vidéo': 'Mythic: one of the 22 most iconic video games ever',
    'Rang {n} au score de prestige': 'Rank {n} in prestige score',
    'chef-d’œuvre': 'masterpiece',
    'adoré des joueurs': 'loved by players',
    'mal noté': 'poorly rated',
    'classique culte': 'cult classic',
    'plafonné à Épique': 'capped at Epic',
    'plafonné à Rare': 'capped at Rare',
    'Vendre': 'Sell',
    'Vendre…': 'Sell…',
    'Quel exemplaire veux-tu vendre ?': 'Which copy do you want to sell?',
    'Annuler': 'Cancel',
    'noté {n}/100 par la presse (Metacritic)': 'rated {n}/100 by critics (Metacritic)',
    'note estimée': 'estimated rating',
    '{n} % d’avis positifs': '{n}% positive reviews',
    '≈ {n} avis (estimés)': '≈ {n} reviews (estimated)',
    'pas encore d’avis Steam': 'no Steam reviews yet',
    '{n} avis Steam': '{n} Steam reviews',
    'sorti en {annee}': 'released in {annee}',
    '{annee} (sur Steam en {steam})': '{annee} (on Steam in {steam})',
    'Joueurs estimés': 'Estimated players',
    'aucune': 'none',
    'ID Steam': 'Steam ID',
    '{n} exemplaire': '{n} copy',
    '{n} exemplaires': '{n} copies',
    'obtenue le {date}': 'obtained on {date}',
    'Pas encore dans ta collection.': 'Not in your collection yet.',
    'Il te manque {n} pièces': 'You need {n} more coins',
    'Il te manque {n} pièces.': 'You need {n} more coins.',
    'Acheter': 'Buy',
    'Voir sur Steam ↗': 'View on Steam ↗',

    // Catalogue
    'Rechercher parmi tous les jeux…': 'Search all games…',
    'Rechercher un jeu dans le catalogue': 'Search for a game in the catalog',
    'Tri : note des joueurs': 'Sort: player rating',
    'Tri : note Metacritic': 'Sort: Metacritic score',
    'Tri : plus récents': 'Sort: newest',
    'Tri : plus anciens': 'Sort: oldest',
    'Pas encore possédées': 'Not owned yet',
    '(dans ta collection)': '(in your collection)',
    'Dans ta collection': 'In your collection',
    'Aucun jeu ne correspond à ces filtres.': 'No game matches these filters.',
    'Afficher plus ({n} restants)': 'Show more ({n} left)',
    '{total} jeux · tu en possèdes {n}': '{total} games · you own {n}',
    '{n} avec ces filtres': '{n} with these filters',
    'Il te manque {n} pièces pour acheter {nom}': 'You need {n} more coins to buy {nom}',
    'Acheter {nom} pour {n} pièces ?': 'Buy {nom} for {n} coins?',
    '{nom} rejoint ta collection !': '{nom} joins your collection!',

    // Règles
    'Rareté': 'Rarity',
    'Jeux': 'Games',
    'Chance': 'Chance',
    '5ᵉ carte': '5th card',
    'Duel': 'Duel',
    'Revente': 'Resale',
    'Achat': 'Purchase',
    'Possédées': 'Owned',
    'choisis à la main': 'hand-picked',
    '{n} suivants': 'next {n}',
    'tous les autres': 'all the others',
    '★ Popularité': '★ Popularity',
    '📊 Stats et rareté': '📊 Stats and rarity',
    '👑 Prestige': '👑 Prestige',
    '🎨 Full Art': '🎨 Full Art',
    '✨ Holo': '✨ Holo',
    '⭐ EX': '⭐ EX',
    'Version EX : jeu adoré des joueurs mais peu connu, sa Qualité est calculée comme une rareté au-dessus.':
        'EX version: a game players love but few know, its Quality is computed one rarity higher.',
    'Ce jeu existe en version EX (5 % de chance quand il est tiré) : sa Qualité y est calculée comme une rareté au-dessus.':
        'This game has an EX version (5% chance when drawn): its Quality is computed one rarity higher there.',
    '🏆 Chef-d’œuvre': '🏆 Masterpiece',
    '⚔ Duel': '⚔ Duel',
    '✨ God pack': '✨ God pack',
    '🏅 GOTY': '🏅 GOTY',
    '🛒 Catalogue': '🛒 Catalog',
    '🏆 Succès': '🏆 Achievements',
    '🍀 Compteur de malchance': '🍀 Bad luck counter',
    '❓ Plus ou moins': '❓ Higher or lower',
    '💰 Revente': '💰 Resale',

    // Jouer : duel
    'Plus ou moins': 'Higher or lower',
    'Duel de decks': 'Deck duel',
    'Facile': 'Easy',
    'Normal': 'Normal',
    'Difficile': 'Hard',
    'Impossible': 'Impossible',
    'Hardcore': 'Hardcore',
    'Choisis la difficulté. Elle fixe la rareté maximale des cartes, pour toi comme pour l’ordinateur.': 'Choose the difficulty. It sets the maximum card rarity, for you and for the computer.',
    'Rareté max : {rarete}': 'Max rarity: {rarete}',
    'Il te faut au moins {n} cartes {rarete} ou moins': 'You need at least {n} cards of {rarete} rarity or lower',
    'Niveau {niveau} : choisis {n} cartes de ta collection ({choisies} / {n}).': '{niveau} level: pick {n} cards from your collection ({choisies} / {n}).',
    'Changer de difficulté': 'Change difficulty',
    'Lancer la partie': 'Start the game',
    'Égalité ! Dernière manche : vos dernières cartes se départagent au total de leurs stats.': 'Tie! Last round: your last cards are compared on their total stats.',
    'À toi d’attaquer : choisis une carte, puis la stat sur laquelle tu l’engages.': 'Your turn to attack: pick a card, then the stat you play it on.',
    'L’ordinateur pose une carte face cachée et attaque en {stat}. Choisis ta carte pour défendre.': 'The computer plays a face-down card and attacks on {stat}. Pick your card to defend.',
    'Total des stats': 'Total stats',
    'Tri : total des stats': 'Sort: total stats',
    'Pile ou face…': 'Coin toss…',
    'Tu commences !': 'You go first!',
    'L’ordinateur commence !': 'The computer goes first!',
    'À toi d’attaquer !': 'Your turn to attack!',
    'L’ordinateur attaque !': 'The computer attacks!',
    'Manche décisive !': 'Deciding round!',
    'Manche décisive : total des stats': 'Deciding round: total stats',
    'Attaque de l’ordinateur :': 'Computer attack:',
    'Ton attaque :': 'Your attack:',
    '{stat} : qui l’emporte ?': '{stat}: who wins?',
    'Révéler les dernières cartes': 'Reveal the last cards',
    'Score à égalité : départage au total des stats des dernières cartes ({a} contre {b}).': 'Tied score: decided by the total stats of the last cards ({a} vs {b}).',
    '<br><b>Match nul.</b>': '<br><b>Draw.</b>',
    'Stratège': 'Strategist',
    'Gagner un duel de decks': 'Win a deck duel',
    'Invincible': 'Invincible',
    'Gagner un duel de decks en Hardcore': 'Win a deck duel on Hardcore',
    '🃏 Duel de decks': '🃏 Deck duel',
    'Toi': 'You',
    'Ordi': 'CPU',
    'Ta carte': 'Your card',
    'Ordinateur': 'Computer',
    'Lance un duel : chaque manche, une carte de ta collection contre une carte adverse.': 'Start a duel: each round, a card from your collection against an opposing card.',
    'Lancer un duel': 'Start a duel',
    '{n} manche(s) gagnée(s)': '{n} round(s) won',
    'Ouvre d’abord un booster pour avoir des cartes': 'Open a booster first to get some cards',
    'Manche {n}': 'Round {n}',
    'L’ordinateur joue <b>{nom}</b>. Sur quelle stat penses-tu le battre ?': 'The computer plays <b>{nom}</b>. Which stat do you think beats it?',
    'Égalité, départagée par la Popularité ({a} contre {b}).': 'Tie, broken by Popularity ({a} vs {b}).',
    'Égalité parfaite, personne ne marque.': 'Perfect tie, nobody scores.',
    'Manche gagnée !': 'Round won!',
    'Manche perdue.': 'Round lost.',
    '{stat} : <b>{a}</b> contre <b>{b}</b>.': '{stat}: <b>{a}</b> vs <b>{b}</b>.',
    'Manche suivante': 'Next round',
    'Victoire ! +{n} pièces': 'Victory! +{n} coins',
    '<br><b class="victoire">Victoire {a} à {b} !</b> Tu gagnes {n} pièces.': '<br><b class="victoire">Victory {a} to {b}!</b> You win {n} coins.',
    '<br><b class="defaite">Défaite {a} à {b}.</b> Retente ta chance !': '<br><b class="defaite">Defeat {a} to {b}.</b> Try again!',
    'Rejouer': 'Play again',

    // Jouer : Plus ou moins
    'Chargement…': 'Loading…',
    'Série <b id="pom-serie">0</b> · Record <b id="pom-record">0</b> · +2 pièces par bonne réponse': 'Streak <b id="pom-serie">0</b> · Best <b id="pom-record">0</b> · +2 coins per right answer',
    'Lequel a le plus d’avis Steam ?': 'Which one has more Steam reviews?',
    'Lequel est le mieux noté par les joueurs ?': 'Which one is rated higher by players?',
    'Lequel est sorti en premier ?': 'Which one came out first?',
    '{n} avis': '{n} reviews',
    'OU': 'OR',
    'Clique sur la bonne carte.': 'Click the right card.',
    '<b class="victoire">Bonne réponse !</b> +{n} pièces': '<b class="victoire">Right answer!</b> +{n} coins',
    'Question suivante': 'Next question',
    '<b class="defaite">Raté !</b> Série terminée : {n} bonne réponse.': '<b class="defaite">Wrong!</b> Streak over: {n} right answer.',
    '<b class="defaite">Raté !</b> Série terminée : {n} bonnes réponses.': '<b class="defaite">Wrong!</b> Streak over: {n} right answers.',

    // Profil
    'Succès': 'Achievements',
    'Réglages': 'Settings',
    'Sons (ouverture des boosters, cartes rares, succès, jeux)': 'Sounds (opening boosters, rare cards, achievements, games)',
    'Langue': 'Language',
    'Sauvegarde': 'Save',
    'Télécharger ma sauvegarde': 'Download my save',
    'Importer une sauvegarde': 'Import a save',
    'Recommencer à zéro': 'Start over',
    'Supprimer ma sauvegarde': 'Delete my save',
    '{boosters} boosters ouverts · {duels} duels gagnés · record au Plus ou moins : {record}': '{boosters} boosters opened · {duels} duels won · Higher or lower best: {record}',
    'Obtenu le {date}': 'Unlocked on {date}',
    '{n} succès débloqués ! Récupère tes récompenses dans le Profil': '{n} achievements unlocked! Claim your rewards in your Profile',
    'Succès « {nom} » débloqué ! Récupère ta récompense dans le Profil': 'Achievement “{nom}” unlocked! Claim your reward in your Profile',
    'Récupérer': 'Claim',
    'Tout récupérer': 'Claim all',
    '+{n} booster': '+{n} booster',
    '+{n} boosters': '+{n} boosters',
    '+{n} Prestige': '+{n} Prestige',
    '+{n} Prestiges': '+{n} Prestiges',
    'Carte Full Art': 'Full Art card',
    '+{n} booster ajouté à ta réserve': '+{n} booster added to your reserve',
    '+{n} boosters ajoutés à ta réserve': '+{n} boosters added to your reserve',
    '+{n} Prestige ajouté à ta réserve': '+{n} Prestige added to your reserve',
    '+{n} Prestiges ajoutés à ta réserve': '+{n} Prestiges added to your reserve',
    '{nom} en Full Art rejoint ta collection !': '{nom} joins your collection as a Full Art!',
    'Supprimer définitivement ta sauvegarde ?\n\nTu perdras tes {cartes} cartes et tes {pieces} pièces. Cette action ne peut pas être annulée.':
        'Permanently delete your save?\n\nYou will lose your {cartes} cards and your {pieces} coins. This cannot be undone.',
    'Sauvegarde téléchargée': 'Save downloaded',
    'Remplacer ta progression actuelle par la sauvegarde du {date} ?': 'Replace your current progress with the save from {date}?',
    'Ce fichier n’est pas une sauvegarde GameCards valide': 'This file is not a valid GameCards save',
    'Impossible de charger les jeux (lance le site via WAMP ou Live Server)': 'Could not load the games (run the site through WAMP or Live Server)',

    // Succès : noms et descriptions
    'Premier pas': 'First step',
    'Obtenir ta première carte': 'Get your first card',
    'Collectionneur': 'Collector',
    'Posséder 100 jeux différents': 'Own 100 different games',
    'Archiviste': 'Archivist',
    'Posséder 500 jeux différents': 'Own 500 different games',
    'Conservateur de musée': 'Museum curator',
    'Posséder 1 000 jeux différents': 'Own 1,000 different games',
    'Ça devient rare': 'Getting rare',
    'Obtenir une carte Rare': 'Get a Rare card',
    'Épique !': 'Epic!',
    'Obtenir une carte Épique': 'Get an Epic card',
    'Une légende': 'A legend',
    'Obtenir une carte Légendaire': 'Get a Legendary card',
    'Mythe vivant': 'Living myth',
    'Obtenir une carte Mythique': 'Get a Mythic card',
    'Salle des légendes': 'Hall of legends',
    'Posséder 25 Légendaires différentes': 'Own 25 different Legendaries',
    'Panthéon': 'Pantheon',
    'Posséder 5 Mythiques différentes': 'Own 5 different Mythics',
    'Olympe': 'Olympus',
    'Posséder toutes les Mythiques': 'Own every Mythic',
    'Palmarès': 'Hall of fame',
    'Posséder 5 jeux de l’année (années différentes)': 'Own 5 games of the year (different years)',
    'Toutes les cérémonies': 'Every ceremony',
    'Posséder un jeu de l’année pour chaque année': 'Own a game of the year for every year',
    'Critique avisé': 'Seasoned critic',
    'Posséder 10 chefs-d’œuvre (Metacritic 90+)': 'Own 10 masterpieces (Metacritic 90+)',
    'Tout ce qui brille': 'All that glitters',
    'Obtenir une carte holo': 'Get a holo card',
    'Galerie des glaces': 'Hall of mirrors',
    'Posséder 10 cartes holo différentes': 'Own 10 different holo cards',
    'Pépite dénichée': 'Gem unearthed',
    'Obtenir une carte EX': 'Get an EX card',
    'Chercheur de pépites': 'Gem hunter',
    'Posséder 10 cartes EX différentes': 'Own 10 different EX cards',
    'Œuvre d’art': 'Work of art',
    'Obtenir une carte Full Art': 'Get a Full Art card',
    'Galerie privée': 'Private gallery',
    'Posséder 5 cartes Full Art différentes': 'Own 5 different Full Art cards',
    'Intervention divine': 'Divine intervention',
    'Ouvrir un god pack': 'Open a god pack',
    'Déchireur': 'Ripper',
    'Ouvrir 10 boosters': 'Open 10 boosters',
    'Accro aux boosters': 'Booster addict',
    'Ouvrir 100 boosters': 'Open 100 boosters',
    'Usine à cartes': 'Card factory',
    'Ouvrir 500 boosters': 'Open 500 boosters',
    'Mille paquets': 'A thousand packs',
    'Ouvrir 1 000 boosters': 'Open 1,000 boosters',
    'Grand luxe': 'Luxury',
    'Ouvrir un booster Prestige': 'Open a Prestige booster',
    'Habitué du Prestige': 'Prestige regular',
    'Ouvrir 30 boosters Prestige': 'Open 30 Prestige boosters',
    'Premier sang': 'First blood',
    'Gagner un duel': 'Win a duel',
    'Duelliste': 'Duelist',
    'Gagner 10 duels': 'Win 10 duels',
    'Champion': 'Champion',
    'Gagner 50 duels': 'Win 50 duels',
    'Sans appel': 'Flawless',
    'Gagner un duel 3 à 0': 'Win a duel 3 to 0',
    'Bon instinct': 'Good instinct',
    'Enchaîner 5 bonnes réponses au Plus ou moins': 'Get 5 right answers in a row in Higher or lower',
    'Encyclopédie': 'Encyclopedia',
    'Enchaîner 15 bonnes réponses au Plus ou moins': 'Get 15 right answers in a row in Higher or lower',
    'Oracle': 'Oracle',
    'Enchaîner 30 bonnes réponses au Plus ou moins': 'Get 30 right answers in a row in Higher or lower',
    'Marchand': 'Merchant',
    'Revendre un doublon': 'Sell a duplicate',
    'Grossiste': 'Wholesaler',
    'Revendre 100 doublons': 'Sell 100 duplicates',

    // Genres et thèmes (données Steam)
    'Action': 'Action',
    'Aventure': 'Adventure',
    'Casual': 'Casual',
    'Indé': 'Indie',
    'RPG': 'RPG',
    'Simulation': 'Simulation',
    'Stratégie': 'Strategy',
    'MMO': 'MMO',
    'Course': 'Racing',
    'Sport': 'Sports',
    'Free-to-play': 'Free-to-play',
    'Accès anticipé': 'Early access',
    'Gameplay': 'Gameplay',
    'Modes': 'Modes',
    'Univers': 'Setting',
    'Contenu sensible': 'Sensitive content',
    'Réflexion': 'Puzzle',
    'Plateforme': 'Platformer',
    'Tir': 'Shooter',
    'Survie': 'Survival',
    'Monde ouvert': 'Open world',
    'Roguelike': 'Roguelike',
    'Visual novel': 'Visual novel',
    'Point & click': 'Point & click',
    'Combat en duel': 'Fighting',
    'Bac à sable': 'Sandbox',
    'Gestion': 'Management',
    'Tower defense': 'Tower defense',
    'Metroidvania': 'Metroidvania',
    'Battle royale': 'Battle royale',
    'Rythme': 'Rhythm',
    'Jeu de cartes': 'Card game',
    'Infiltration': 'Stealth',
    'Beat\'em all': 'Beat \'em up',
    'Souls-like': 'Souls-like',
    'Tour par tour': 'Turn-based',
    'Objets cachés': 'Hidden objects',
    'Bullet hell': 'Bullet hell',
    'Dungeon crawler': 'Dungeon crawler',
    'JRPG': 'JRPG',
    'Simulation de vie': 'Life sim',
    'Romance': 'Romance',
    'Multijoueur': 'Multiplayer',
    'Coopération': 'Co-op',
    'Réalité virtuelle': 'Virtual reality',
    'Horreur': 'Horror',
    'Science-fiction': 'Sci-fi',
    'Fantasy': 'Fantasy',
    'Post-apocalyptique': 'Post-apocalyptic',
    'Guerre': 'War',
    'Anime': 'Anime',
    'Pixel art': 'Pixel art',
    'Narratif': 'Story-rich',
    'Enquête': 'Detective',
    'Comédie': 'Comedy',
    'Relaxant': 'Relaxing',
    'Contenu sexuel': 'Sexual content',
    'Nudité': 'Nudity',
    'Violence': 'Violence',
    'Gore': 'Gore',
};

// ---------- Anglais : longs paragraphes de la page (data-i18n="cle") ----------

const EN_PAGE = {
    'intro-catalogue': 'Every card in the game. You can buy the one you are missing directly, but it costs much more than trying your luck with boosters.',
    'duel-intro': 'First to 3 rounds. Each round, a card from your collection faces an opposing card: you see the opposing game but neither its rarity nor its stats, it is up to you to pick the stat that beats it.',
    'regles-intro': `Every card is a real Steam game. The 22 Mythics are the most iconic games, hand-picked.
        The others are ranked by prestige score: 85% popularity (Steam reviews and estimated players), 15% quality
        (player and critic ratings), plus bonuses (GOTY +3, masterpiece +2, loved +1, poorly rated −3).
        GOTY winners and giants (750,000 reviews or more) are at least Legendary. About sixty cult classics, less present on Steam, are placed by hand in Legendary or Epic. Games without reviews in the Steam data are included too: their reviews and rating are estimated (shown on their card details).`,
    'regle-qualite': 'Comes from the share of positive Steam reviews (pulled toward the average for games with few reviews: 1 review at 100% is not worth 10,000 reviews at 95%).',
    'regle-anciennete': 'The older the game, the higher it is: 2025 gives 0, 2010 about 76, 1998 about 98. It is the only stat that does not depend on rarity: an old Common can beat a recent Mythic. In a duel, the opposing card’s year stays hidden.',
    'regle-popularite': 'Comes from the number of Steam reviews (logarithmic scale: 1,000 reviews are worth half of a million).',
    'regle-stats': 'The real data places Quality and Popularity within their rarity’s range: Common 5–75, Uncommon 15–80, Rare 25–85, Epic 35–90, Legendary 45–95, Mythic 55–100. The ranges overlap: a rarer card is usually stronger, but an excellent Legendary can beat an average Mythic. The real values stay shown on the card details.',
    'regle-boosters': '5 cards. The first 4 follow the “Chance” column, the 5th is guaranteed Uncommon or better and follows the “5th card” column. One free booster every 10 minutes, up to 10 in reserve. When none are left, you can buy one (or 10 at once). Each booster opened earns 5 coins.',
    'regle-prestige': 'A free Prestige every 24 hours, otherwise 250 coins. The first 4 cards are Uncommon or better (0.2% Mythic, 1% Legendary, 6% Epic, 22.8% Rare), the 5th Epic or better (1% Mythic, 5% Legendary). 8% holos. Each Prestige opened earns 25 coins.',
    'regle-fullart': 'Each Legendary or Mythic drawn has a 5% chance of being Full Art (30% in a god pack): the cover art fills the whole card. A Full Art is never holo, and sells for 5 times more.',
    'regle-ex': 'Games players love (93% positive reviews or more, over at least 1,000 reviews) but ranked Rare or below have an EX version: a 5% chance when drawn. Their Quality is computed one rarity higher (a Rare EX uses the Epic range). An EX is never holo and sells for 4 times more.',
    'regle-holo': '2% chance per card. A holo sells for 3 times more.',
    'regle-chef': 'Games rated 90 or more on Metacritic get a museum presentation: golden plaque, double champagne border, name in classic lettering.',
    'regle-duel': 'First to 3 rounds, 30 coins at stake. Each card is drawn using the “Duel” column odds, then at random within its rarity. You see the opposing game but neither its rarity nor its stats (revealed after your choice). In case of a tie, Popularity decides.',
    'regle-decks': 'Choose a difficulty (it caps card rarity for you and for the computer: Uncommon on Easy, Rare on Normal, Epic on Hard, Legendary on Impossible, Mythic on Hardcore), then 3 cards from your collection. A coin toss decides who goes first. Taking turns, the attacker plays a face-down card and calls a stat, the defender answers with one of their cards: the higher value scores 1 point. First to 2 points. On a tie, the last cards are compared on their total stats. From 20 to 300 coins to win depending on the difficulty. On Impossible and Hardcore, the computer plays with the best cards in the game.',
    'regle-godpack': 'One booster in 2,000 is a god pack: 5 Legendaries or Mythics (at least one Mythic), with a 25% chance per card of being holo instead of 2%. The pack turns golden when opened, impossible to miss.',
    'regle-goty': 'Games named game of the year at The Game Awards (since 2014) or the Spike Video Game Awards (before) carry a golden “GOTY” ribbon with the year in the card’s corner, and a laurel wreath watermark.',
    'regle-catalogue': 'Every card in the game, viewable at any time. You can buy a specific card, at a high price: from 100 coins for a Common to 10,000 for a Mythic.',
    'regle-succes': 'About thirty goals (collection, boosters, duels, Higher or lower). When you reach one, go to the Profile tab to claim its reward: coins, boosters, Prestiges, and even a random Full Art card.',
    'regle-malchance': 'After 50 boosters without a Legendary or Mythic, the next one is guaranteed to contain one. The counter is shown on the home screen.',
    'regle-pom': 'Two games, one question: which one has more reviews, is better rated, is older? 2 coins per right answer, the streak ends at the first mistake.',
    'regle-revente': 'Open a card’s details to sell it, based on its rarity (holo ×3, Full Art ×5). If you have several versions, you choose which one. Selling your last copy removes the card from your collection; “Sell duplicates” always keeps one copy of each game.',
    'sauvegarde-texte': 'Your progress is saved in this browser. Download it to a file to keep it safe or continue on another device.',
    'reinitialiser-texte': 'Deletes your collection, coins, achievements and booster reserve. Remember to download your save first: otherwise it cannot be recovered.',
};
