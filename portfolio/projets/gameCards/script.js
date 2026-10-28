'use strict';

/* =========================================================
   GameCards — chaque carte est un vrai jeu vidéo (données Steam)
   ========================================================= */

// ---------- Règles du jeu (valeurs de départ, à équilibrer) ----------

// Du plus rare au plus commun. `seuil` porte sur le nombre d'avis Steam.
// Chaque carte tire d'abord sa rareté selon `chance` (en %), puis un jeu au hasard dans cette rareté.
const RARETES = [
    { id: 'mythique',    nom: 'Mythique',    seuil: 750000, chance: 0.2,  revente: 300 },
    { id: 'legendaire',  nom: 'Légendaire',  seuil: 200000, chance: 1,    revente: 100 },
    { id: 'epique',      nom: 'Épique',      seuil: 60000,  chance: 3,    revente: 40 },
    { id: 'rare',        nom: 'Rare',        seuil: 12000,  chance: 8,    revente: 15 },
    { id: 'peu-commune', nom: 'Peu commune', seuil: 3000,   chance: 18,   revente: 5 },
    { id: 'commune',     nom: 'Commune',     seuil: 0,      chance: 69.8, revente: 2 },
];
const INDEX_RARE = RARETES.findIndex(r => r.id === 'rare');
const INDEX_PEU_COMMUNE = RARETES.findIndex(r => r.id === 'peu-commune');

const CARTES_PAR_BOOSTER = 5;
const BOOSTERS_PAR_LOT = 10; // ouverture ×10
const PRIX_BOOSTER = 0;
const DELAI_BOOSTER = 10 * 60 * 1000;
const CHANCE_HOLO = 0.02;
const MULTIPLICATEUR_HOLO = 3;
const SEUIL_CHEF_OEUVRE = 90;
const MANCHES_GAGNANTES = 3;
const TAILLE_DECK = 5;
const BONUS_HOLO = 5;         // duel : +5 sur toutes les stats d'une holo
const BONUS_CHEF_OEUVRE = 5;  // duel : +5 en Metacritic pour un chef-d'œuvre
const VICTOIRES_POUR_DEBLOQUER = 3;

// Adversaires du duel : raretés de leur deck, gain en cas de victoire, et finesse de l'ordinateur
// quand il attaque (forte = il joue sa meilleure carte sur sa meilleure stat)
const NIVEAUX = [
    { id: 'facile',     nom: 'Facile',     raretes: ['commune', 'peu-commune'],         gain: 15,  iaForte: false },
    { id: 'normal',     nom: 'Normal',     raretes: ['commune', 'peu-commune', 'rare'], gain: 35,  iaForte: false },
    { id: 'difficile',  nom: 'Difficile',  raretes: ['rare', 'epique'],                 gain: 70,  iaForte: true },
    { id: 'legendaire', nom: 'Légendaire', raretes: ['epique', 'legendaire', 'mythique'], gain: 150, iaForte: true },
];
const CARTES_PAR_PAGE = 60; // collection affichée par tranches
const URL_IMAGES = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';

const STATS = {
    attaque:    { nom: 'Note public',     icone: '👍' },
    defense:    { nom: 'Note Metacritic', icone: '📰' },
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
    duels: 'gameCards.duels',
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
    duels: { niveau: 'facile', deck: [], victoires: {}, ...lire(CLES.duels, {}) },
};

// Tous les jeux de data/jeux.json (chargés au démarrage), et les mêmes rangés par rareté
let tousLesJeux = [];
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

function creerCarte(jeu) {
    return {
        id: jeu.id,
        nom: jeu.nom,
        image: `${URL_IMAGES}/${jeu.id}/${jeu.image || 'header.jpg'}`,
        attaque: notePublic(jeu.note, jeu.avis),
        defense: jeu.metacritic ?? 0,
        popularite: popularite(jeu.avis),
        metacritic: jeu.metacritic,
        rarete: rareteDe(jeu.avis).id,
        annee: jeu.annee,
        genres: jeu.genres,
    };
}

// `cachee` masque les stats (et le badge qui trahirait la défense) : carte adverse en duel
function carteHTML(carte, { holo = false, compteur = 0, cachee = false } = {}) {
    const rarete = RARETES[indexRarete(carte.rarete)];
    const infos = [carte.annee, carte.genres[0]].filter(Boolean).join(' · ');
    return `
        <article class="carte rarete-${rarete.id}${holo ? ' holo' : ''}${cachee ? ' stats-cachees' : ''}">
            <div class="carte-corps">
                <header class="carte-haut">
                    <span class="carte-rarete">${rarete.nom}${holo ? ' · Holo' : ''}</span>
                    ${compteur > 1 ? `<span class="carte-compteur">×${compteur}</span>` : ''}
                </header>
                <div class="carte-image">
                    ${carte.image ? `<img src="${echapper(carte.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
                    ${!cachee && carte.metacritic >= SEUIL_CHEF_OEUVRE ? '<span class="badge-chef" title="Metacritic 90 ou plus">Chef-d’œuvre</span>' : ''}
                </div>
                <h3 class="carte-nom">${echapper(carte.nom)}</h3>
                <p class="carte-infos">${echapper(infos) || '&nbsp;'}</p>
                <ul class="carte-stats">
                    ${Object.entries(STATS).map(([cle, stat]) => `
                        <li data-stat="${cle}"${!cachee && cle === 'defense' && carte.metacritic == null
                            ? ' class="par-defaut" title="Pas de note Metacritic : vaut 0"' : ''}>
                            <span>${stat.icone} ${stat.nom}</span><b>${cachee ? '?' : cle === 'defense' && carte.metacritic == null ? '—' : carte[cle]}</b>
                            <i style="--v:${cachee ? 0 : Math.min(100, carte[cle])}%"></i>
                        </li>`).join('')}
                </ul>
            </div>
        </article>`;
}

// Carte retournable (dos / face), pour les boosters et le duel
function flipHTML(carte, { holo = false, retournee = false, nouvelle = false, cachee = false } = {}) {
    return `
        <div class="flip${retournee ? ' retournee' : ''}" data-rarete="${carte.rarete}">
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
function pucesRaretesHTML({ boutons = false, actif = '' } = {}) {
    const entrees = Object.values(etat.collection);
    const puce = (id, nom, possedees, total) => {
        const contenu = `<i></i>${nom} <b>${nombre(possedees)}${total ? ` / ${nombre(total)}` : ''}</b>`;
        const classe = `puce${id ? ` rarete-${id}` : ''}${boutons && actif === id ? ' active' : ''}`;
        return boutons
            ? `<button class="${classe}" data-rarete="${id}" aria-pressed="${actif === id}">${contenu}</button>`
            : `<span class="${classe}">${contenu}</span>`;
    };
    return (boutons ? puce('', 'Toutes', entrees.length) : '')
        + RARETES.map(r => puce(r.id, r.nom,
            entrees.filter(e => e.rarete === r.id).length,
            boutons ? 0 : jeuxParRarete[r.id]?.length || 0)).join('');
}

// ---------- Données ----------

async function chargerJeux() {
    const reponse = await fetch('data/jeux.json?v=2');
    if (!reponse.ok) throw new Error(`data/jeux.json introuvable (${reponse.status})`);
    // Format compact (voir outils/convertir-csv.js) : un tableau par jeu, genres en chiffres
    const { genres, jeux } = await reponse.json();
    for (const r of RARETES) jeuxParRarete[r.id] = [];
    tousLesJeux = jeux.map(([id, nom, annee, avis, note, metacritic, chiffresGenres, image]) =>
        ({ id, nom, annee, avis, note, metacritic, genres: [...chiffresGenres].map(i => genres[i]), image }));
    for (const jeu of tousLesJeux) jeuxParRarete[rareteDe(jeu.avis).id].push(jeu);
    majCollectionDepuisDonnees();
}

// Les cartes déjà obtenues gardent une copie de leurs stats : on les recalcule
// pour qu'elles suivent les règles actuelles (exemplaires, holos et date sont conservés)
function majCollectionDepuisDonnees() {
    const parId = new Map();
    for (const jeu of tousLesJeux) parId.set(jeu.id, jeu);
    for (const entree of Object.values(etat.collection)) {
        const jeu = parId.get(entree.id);
        if (jeu) Object.assign(entree, creerCarte(jeu));
    }
    sauvegarder();
}

const donneesPretes = () => tousLesJeux.length > 0;
const totalJeux = () => tousLesJeux.length;

// Tire un index de rareté selon les chances ; indexMax limite aux raretés >= celle-ci
function tirerRarete(indexMax = RARETES.length - 1) {
    const possibles = RARETES.slice(0, indexMax + 1);
    let t = Math.random() * possibles.reduce((s, r) => s + r.chance, 0);
    for (let i = 0; i < possibles.length; i++) {
        t -= possibles[i].chance;
        if (t < 0) return i;
    }
    return indexMax;
}

// Pioche un jeu au hasard dans la rareté demandée, tous avec la même chance (sans doublon dans `exclus`)
function piocher(index, exclus = new Set()) {
    const bac = jeuxParRarete[RARETES[index].id];
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

    // "Ouvrir un autre" : le gratuit s'il est prêt, sinon un booster payant
    const autre = $('#btn-autre');
    autre.disabled = reste > 0 && manque > 0;
    autre.innerHTML = reste === 0 ? 'Ouvrir un autre booster · gratuit'
        : autre.disabled ? `Booster gratuit dans ${formatDuree(reste)}`
        : `Ouvrir un autre booster · ${PRIX_BOOSTER} ${PIECE}`;

    $('#lien-accueil').classList.toggle('pret', reste === 0);
}

// ---------- Ouverture de boosters ----------

// Les 5 cartes d'un booster : 4 au hasard + la dernière Peu commune ou mieux
function tirerBooster() {
    const indices = Array.from({ length: CARTES_PAR_BOOSTER - 1 }, () => tirerRarete());
    indices.push(tirerRarete(INDEX_PEU_COMMUNE));
    const exclus = new Set();
    return indices.map(index => {
        const carte = piocher(index, exclus);
        exclus.add(carte.id);
        return { carte, holo: Math.random() < CHANCE_HOLO };
    });
}

async function ouvrirBooster(mode, nombreBoosters = 1) {
    if (ouvertureEnCours || !donneesPretes()) return;
    const prix = PRIX_BOOSTER * nombreBoosters;
    if (mode === 'gratuit' && tempsRestant() > 0) {
        return toast(`Prochain booster gratuit dans ${formatDuree(tempsRestant())}`);
    }
    if (mode === 'achat' && etat.pieces < prix) {
        return toast(`Il te manque ${prix - etat.pieces} pièces. Revends des doublons ou gagne un duel !`);
    }
    ouvertureEnCours = true;

    const tirage = Array.from({ length: nombreBoosters }, tirerBooster).flat();
    if (mode === 'gratuit') etat.dernierBooster = Date.now();
    else etat.pieces -= prix;
    for (const t of tirage) t.nouvelle = ajouterACollection(t.carte, t.holo);
    sauvegarder();
    majEntete();

    // Le paquet passe au centre, tremble, puis se déchire
    const paquet = $(mode === 'gratuit' ? '#paquet-gratuit' : '#paquet-achat').cloneNode(true);
    paquet.removeAttribute('id');
    paquet.removeAttribute('data-incline');
    paquet.removeAttribute('style');
    paquet.classList.remove('verrouille');
    paquet.classList.add('paquet-seul');
    paquet.tabIndex = -1;
    paquet.querySelector('.paquet-verrou')?.remove();
    if (nombreBoosters > 1) paquet.insertAdjacentHTML('beforeend', `<span class="paquet-multiple">×${nombreBoosters}</span>`);

    $('#choix').hidden = true;
    $('#ouverture').hidden = false;
    $('#ouverture').classList.toggle('multiple', nombreBoosters > 1);
    $('#tirage').innerHTML = '';
    $('#ouverture-scene').replaceChildren(paquet);
    for (const id of ['#ouverture-aide', '#btn-tout-retourner', '#bilan', '#btn-autre', '#btn-autre-x10', '#btn-voir-collection']) {
        $(id).hidden = true;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    paquet.classList.add('secoue');
    await attendre(750);
    paquet.classList.replace('secoue', 'dechire');
    await attendre(600);
    $('#ouverture-scene').replaceChildren();

    // La plus rare arrive en dernier
    tirage.sort((a, b) => indexRarete(b.carte.rarete) - indexRarete(a.carte.rarete));
    dernierTirage = tirage;
    if (nombreBoosters > 1) {
        // ×10 : on ne retourne que les Rares et mieux, le reste est déjà visible en petit.
        // Les plus rares sont en haut, et se retournent en dernier (de bas en haut).
        const parRarete = [...tirage].reverse();
        const vedettes = parRarete.filter(t => indexRarete(t.carte.rarete) <= INDEX_RARE);
        const reste = parRarete.filter(t => indexRarete(t.carte.rarete) > INDEX_RARE);
        $('#tirage').innerHTML = `
            ${vedettes.length ? `
                <h2 class="tirage-titre">Tes meilleures cartes <span>Rare et plus · ${vedettes.length}</span></h2>
                <div class="tirage-grille tirage-vedettes">${vedettes.map(t => flipHTML(t.carte, t)).join('')}</div>` : ''}
            ${reste.length ? `
                <h2 class="tirage-titre">Le reste <span>Communes et peu communes · ${reste.length}</span></h2>
                <div class="tirage-grille tirage-reste">${reste.map(t => flipHTML(t.carte, { ...t, retournee: true })).join('')}</div>` : ''}`;
    } else {
        $('#tirage').innerHTML = tirage.map(t => flipHTML(t.carte, t)).join('');
    }
    $('#tirage').querySelectorAll('.flip').forEach((flip, i) => {
        flip.style.animationDelay = `${Math.min(i * (nombreBoosters > 1 ? 20 : 90), 600)}ms`;
        if (flip.classList.contains('retournee')) return;
        flip.tabIndex = 0;
        flip.setAttribute('role', 'button');
        flip.setAttribute('aria-label', `Retourner la carte ${i + 1}`);
    });
    $('#ouverture-aide').hidden = false;
    $('#btn-tout-retourner').hidden = false;
    majAideTirage();
    ouvertureEnCours = false;
    if (!$('#tirage .flip:not(.retournee)')) finTirage(); // ×10 sans aucune carte à retourner
}

let dernierTirage = [];

function majAideTirage() {
    const aRetourner = document.querySelectorAll('#tirage .flip[tabindex]').length;
    const faites = document.querySelectorAll('#tirage .flip[tabindex].retournee').length;
    $('#ouverture-aide').innerHTML = $('#ouverture').classList.contains('multiple')
        ? `Retourne tes meilleures cartes <b>${faites} / ${aRetourner}</b>`
        : 'Clique sur les cartes pour les retourner';
}

function retourner(flip) {
    if (!flip || flip.classList.contains('retournee')) return;
    flip.classList.add('retournee');
    flip.removeAttribute('role');
    flip.removeAttribute('aria-label');
    majAideTirage();
    if (!$('#tirage .flip:not(.retournee)')) finTirage();
}

async function toutRetourner() {
    $('#btn-tout-retourner').hidden = true;
    // Vague rapide : quelques dixièmes de seconde, même pour un ×10
    const multiple = $('#ouverture').classList.contains('multiple');
    const delai = multiple ? 45 : 260;
    const aRetourner = [...document.querySelectorAll('#tirage .flip:not(.retournee)')];
    // ×10 : de bas en haut, pour finir sur les plus rares
    if (multiple) aRetourner.reverse();
    for (const flip of aRetourner) {
        retourner(flip);
        await attendre(delai);
    }
}

function finTirage() {
    const nouvelles = dernierTirage.filter(t => t.nouvelle).length;
    const meilleure = RARETES[Math.min(...dernierTirage.map(t => indexRarete(t.carte.rarete)))];
    const holos = dernierTirage.filter(t => t.holo).length;
    $('#ouverture-aide').hidden = true;
    $('#btn-tout-retourner').hidden = true;
    $('#bilan').innerHTML = `
        <span><b>${nouvelles}</b> nouvelle${nouvelles > 1 ? 's' : ''}</span>
        <span class="rarete-${meilleure.id}">Meilleure : <b class="texte-rarete">${meilleure.nom}</b></span>
        ${holos ? `<span>✨ <b>${holos}</b> holo${holos > 1 ? 's' : ''}</span>` : ''}`;
    majPaquets();
    for (const id of ['#bilan', '#btn-autre', '#btn-autre-x10', '#btn-voir-collection']) $(id).hidden = false;
}

// ---------- Écran accueil ----------

function afficherAccueil() {
    // Une ouverture pas encore entièrement retournée reste affichée
    if (!$('#ouverture').hidden && (ouvertureEnCours || $('#tirage .flip:not(.retournee)'))) return;
    $('#ouverture').hidden = true;
    $('#choix').hidden = false;

    const entrees = Object.values(etat.collection);
    const total = totalJeux();
    $('#progression-texte').innerHTML = total
        ? `<b>${nombre(entrees.length)}</b> / ${nombre(total)} jeux découverts`
        : 'Chargement des jeux…';
    $('#progression-barre').style.width = total ? `${Math.max(0.5, (entrees.length / total) * 100)}%` : '0';
    $('#progression-raretes').innerHTML = pucesRaretesHTML();

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
    defense: (a, b) => b.defense - a.defense,
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
    const genres = [...new Set(entrees.flatMap(e => e.genres))].sort((a, b) => a.localeCompare(b, 'fr'));
    selGenre.innerHTML = '<option value="">Tous les genres</option>'
        + genres.map(g => `<option value="${echapper(g)}"${g === genreChoisi ? ' selected' : ''}>${echapper(g)}</option>`).join('');

    const recherche = $('#filtre-nom').value.trim().toLowerCase();
    const doublons = $('#filtre-doublons').checked;
    const visibles = entrees
        .filter(e => !recherche || e.nom.toLowerCase().includes(recherche))
        .filter(e => !filtreRarete || e.rarete === filtreRarete)
        .filter(e => !genreChoisi || e.genres.includes(genreChoisi))
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
    if (!e) return;
    const rarete = RARETES[indexRarete(e.rarete)];
    $('#modale-contenu').innerHTML = `
        <div class="fiche-visuel" data-incline>${carteHTML(e, { holo: e.holos > 0 })}</div>
        <div class="fiche-infos rarete-${rarete.id}">
            <span class="fiche-rarete">${rarete.nom}${e.holos ? ' · ✨ Holo' : ''}</span>
            <h2>${echapper(e.nom)}</h2>
            <p class="fiche-meta">${[e.annee, ...e.genres].filter(Boolean).map(echapper).join(' · ')}</p>
            <dl class="fiche-stats">
                <div><dt>👍 Note public</dt><dd>${e.attaque} %</dd></div>
                <div><dt>📰 Metacritic</dt><dd>${e.metacritic ?? '<span class="gris">aucune · 0</span>'}</dd></div>
                <div><dt>★ Popularité</dt><dd>${e.popularite} / 100</dd></div>
            </dl>
            <p class="fiche-exemplaires">
                ${e.exemplaires} exemplaire${e.exemplaires > 1 ? 's' : ''}${e.holos ? ` dont ${e.holos} holo` : ''}
                · obtenue le ${new Date(e.obtenue).toLocaleDateString('fr-FR')}
            </p>
            <div class="fiche-actions">
                ${e.exemplaires > 1
                    ? `<button class="btn btn-or" data-vendre="${e.id}">Revendre un doublon · +${prixRevente(e)} ${PIECE}</button>`
                    : ''}
                <a class="btn" href="https://store.steampowered.com/app/${e.id}" target="_blank" rel="noopener">Voir sur Steam ↗</a>
            </div>
        </div>`;
    if (!$('#modale').open) $('#modale').showModal();
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
            <td>${r.revente} ${PIECE}</td>
            <td>${entrees.filter(e => e.rarete === r.id).length} / ${nombre(jeuxParRarete[r.id]?.length || 0)}</td>
        </tr>`).join('');
}

// ---------- Duel ----------

// Valeur d'une stat en duel, bonus compris
function bonusDuel(carte, stat) {
    let bonus = 0;
    if (carte.holos > 0) bonus += BONUS_HOLO;
    if (stat === 'defense' && carte.metacritic >= SEUIL_CHEF_OEUVRE) bonus += BONUS_CHEF_OEUVRE;
    return bonus;
}
const valeurDuel = (carte, stat) => carte[stat] + bonusDuel(carte, stat);
const forceDuel = carte => Object.keys(STATS).reduce((s, stat) => s + valeurDuel(carte, stat), 0);

const niveauDuel = () => NIVEAUX.find(n => n.id === etat.duels.niveau) || NIVEAUX[0];
const victoiresDuel = id => etat.duels.victoires[id] || 0;
const niveauDebloque = i => i === 0 || victoiresDuel(NIVEAUX[i - 1].id) >= VICTOIRES_POUR_DEBLOQUER;

const duel = {
    enCours: false,
    mainJoueur: [], mainOrdi: [],
    utilisees: new Set(), utiliseesOrdi: new Set(),
    joueur: 0, ordi: 0, manche: 0,
    attaqueJoueur: true, carteOrdi: null, statOrdi: null,
    choix: null,      // id de la carte sélectionnée dans la main
    verrou: false,    // pendant la révélation d'une manche
};

function afficherDuel() {
    if (duel.enCours) return;
    $('#duel-preparation').hidden = false;
    $('#duel-combat').hidden = true;
    // Le deck ne garde que des cartes encore dans la collection
    etat.duels.deck = etat.duels.deck.filter(id => etat.collection[id]).slice(0, TAILLE_DECK);
    afficherNiveaux();
    afficherDeck();
    afficherChoixDeck();
}

function afficherNiveaux() {
    $('#niveaux').innerHTML = NIVEAUX.map((n, i) => {
        const ouvert = niveauDebloque(i);
        const precedent = NIVEAUX[i - 1];
        return `
            <button class="niveau niveau-${n.id}${n.id === etat.duels.niveau ? ' actif' : ''}${ouvert ? '' : ' verrouille'}"
                    data-niveau="${n.id}" aria-pressed="${n.id === etat.duels.niveau}">
                <span class="niveau-nom">${ouvert ? '' : '🔒 '}${n.nom}</span>
                <span class="niveau-raretes">${n.raretes.map(id => `<i class="rarete-${id}" title="${RARETES[indexRarete(id)].nom}"></i>`).join('')}</span>
                <span class="niveau-gain">+${n.gain} ${PIECE}</span>
                <span class="niveau-etat">${ouvert
                    ? `${victoiresDuel(n.id)} victoire${victoiresDuel(n.id) > 1 ? 's' : ''}`
                    : `${victoiresDuel(precedent.id)} / ${VICTOIRES_POUR_DEBLOQUER} victoires en ${precedent.nom}`}</span>
            </button>`;
    }).join('');
}

function afficherDeck() {
    const deck = etat.duels.deck;
    $('#deck-slots').innerHTML = Array.from({ length: TAILLE_DECK }, (_, i) => {
        const carte = etat.collection[deck[i]];
        return carte
            ? `<button class="deck-slot" data-deck="${carte.id}" aria-label="Retirer ${echapper(carte.nom)} du deck">${carteHTML(carte, { holo: carte.holos > 0 })}</button>`
            : `<div class="deck-slot deck-slot-vide"><span>${i + 1}</span></div>`;
    }).join('');
    $('#deck-compte').textContent = `${deck.length} / ${TAILLE_DECK}`;
    $('#btn-lancer-duel').disabled = deck.length < TAILLE_DECK || !donneesPretes();
}

function afficherChoixDeck() {
    const entrees = Object.values(etat.collection);
    if (entrees.length < TAILLE_DECK) {
        $('#deck-choix').innerHTML = `<p class="vide">Il te faut au moins ${TAILLE_DECK} cartes pour composer un deck (tu en as ${entrees.length}).<br>
            <a class="btn btn-principal" href="#accueil">Ouvrir des boosters</a></p>`;
        return;
    }
    const recherche = $('#deck-recherche').value.trim().toLowerCase();
    const deck = new Set(etat.duels.deck);
    $('#deck-choix').innerHTML = entrees
        .filter(e => !recherche || e.nom.toLowerCase().includes(recherche))
        .sort((a, b) => forceDuel(b) - forceDuel(a))
        .slice(0, CARTES_PAR_PAGE)
        .map(e => `
            <button class="case-carte deck-carte${deck.has(e.id) ? ' choisie' : ''}" data-deck="${e.id}"
                    aria-pressed="${deck.has(e.id)}" aria-label="${echapper(e.nom)}">
                ${carteHTML(e, { holo: e.holos > 0 })}
            </button>`).join('') || '<p class="vide">Aucune carte ne correspond.</p>';
}

function basculerDeck(id) {
    const deck = etat.duels.deck;
    if (deck.includes(id)) deck.splice(deck.indexOf(id), 1);
    else if (deck.length < TAILLE_DECK) deck.push(id);
    else return toast(`Ton deck est complet : retire une carte d’abord`);
    sauvegarder();
    afficherDeck();
    afficherChoixDeck();
}

function deckAuto() {
    etat.duels.deck = Object.values(etat.collection)
        .sort((a, b) => forceDuel(b) - forceDuel(a))
        .slice(0, TAILLE_DECK)
        .map(e => e.id);
    sauvegarder();
    afficherDeck();
    afficherChoixDeck();
}

function choisirNiveau(id) {
    const i = NIVEAUX.findIndex(n => n.id === id);
    if (!niveauDebloque(i)) {
        return toast(`Gagne ${VICTOIRES_POUR_DEBLOQUER} duels en ${NIVEAUX[i - 1].nom} pour débloquer ce niveau`);
    }
    etat.duels.niveau = id;
    sauvegarder();
    afficherNiveaux();
}

function lancerDuel() {
    if (etat.duels.deck.length < TAILLE_DECK || !donneesPretes()) return;
    const niveau = niveauDuel();
    duel.mainJoueur = etat.duels.deck.map(id => etat.collection[id]);
    // Deck adverse : 5 jeux pris dans les raretés du niveau
    const exclus = new Set(etat.duels.deck);
    duel.mainOrdi = Array.from({ length: TAILLE_DECK }, () => {
        const carte = piocher(indexRarete(auHasard(niveau.raretes)), exclus);
        exclus.add(carte.id);
        return carte;
    });
    Object.assign(duel, { enCours: true, joueur: 0, ordi: 0, manche: 0, utilisees: new Set(), utiliseesOrdi: new Set() });
    $('#duel-preparation').hidden = true;
    $('#duel-combat').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    nouvelleManche();
}

// L'ordinateur attaque : sa meilleure stat, sur une carte au hasard ou sur sa meilleure carte
function attaqueOrdi(cartes) {
    const meilleureStat = carte => Object.keys(STATS).reduce((a, b) => valeurDuel(carte, a) >= valeurDuel(carte, b) ? a : b);
    const carte = niveauDuel().iaForte
        ? cartes.reduce((a, b) => valeurDuel(a, meilleureStat(a)) >= valeurDuel(b, meilleureStat(b)) ? a : b)
        : auHasard(cartes);
    return { carte, stat: meilleureStat(carte) };
}

function nouvelleManche() {
    duel.manche++;
    duel.choix = null;
    duel.verrou = false;
    duel.attaqueJoueur = duel.manche % 2 === 1;
    const restantes = duel.mainOrdi.filter(c => !duel.utiliseesOrdi.has(c.id));
    if (duel.attaqueJoueur) {
        duel.carteOrdi = auHasard(restantes);
        duel.statOrdi = null;
    } else {
        ({ carte: duel.carteOrdi, stat: duel.statOrdi } = attaqueOrdi(restantes));
    }

    $('#duel-joueur').className = 'duel-emplacement';
    $('#duel-ordi').className = 'duel-emplacement';
    $('#duel-joueur').innerHTML = '<p class="emplacement-vide">Choisis une carte<br>dans ta main</p>';
    // On voit le jeu adverse, pas ses stats
    $('#duel-ordi').innerHTML = flipHTML(duel.carteOrdi, { retournee: true, cachee: true });
    const nomOrdi = `<b>${echapper(duel.carteOrdi.nom)}</b>`;
    if (duel.attaqueJoueur) {
        $('#duel-message').innerHTML = `<b class="tag-attaque">Tu attaques</b> L’ordinateur joue ${nomOrdi}. Choisis ta carte, puis la stat.`;
    } else {
        const stat = STATS[duel.statOrdi];
        $('#duel-ordi').querySelector(`li[data-stat="${duel.statOrdi}"]`).classList.add('stat-choisie');
        $('#duel-message').innerHTML = `<b class="tag-defense">Tu défends</b> L’ordinateur attaque avec ${nomOrdi} en <b>${stat.icone} ${stat.nom}</b>. Choisis la carte qui défend.`;
    }
    $('#duel-manche').textContent = `Manche ${duel.manche}`;
    $('#duel-actions').innerHTML = '';
    afficherMain();
    majScoreDuel();
}

function afficherMain() {
    $('#duel-main').innerHTML = duel.mainJoueur.map(carte => {
        const utilisee = duel.utilisees.has(carte.id);
        return `
            <button class="main-carte${utilisee ? ' utilisee' : ''}${duel.choix === carte.id && !utilisee ? ' selectionnee' : ''}"
                    data-jouer="${carte.id}"${utilisee || duel.verrou ? ' disabled' : ''} aria-label="Jouer ${echapper(carte.nom)}">
                ${carteHTML(carte, { holo: carte.holos > 0 })}
            </button>`;
    }).join('');
}

const libelleBonus = (carte, stat) => bonusDuel(carte, stat) ? `<small>dont +${bonusDuel(carte, stat)} de bonus</small>` : '';

function selectionnerCarte(id) {
    if (duel.verrou || duel.utilisees.has(id)) return;
    const carte = duel.mainJoueur.find(c => c.id === id);
    duel.choix = id;
    $('#duel-joueur').innerHTML = flipHTML(carte, { holo: carte.holos > 0, retournee: true });
    afficherMain();

    if (duel.attaqueJoueur) {
        $('#duel-actions').innerHTML = Object.entries(STATS).map(([cle, stat]) => `
            <button class="btn-stat" data-stat="${cle}">
                <span>${stat.icone} ${stat.nom}</span><b>${valeurDuel(carte, cle)}</b>${libelleBonus(carte, cle)}
            </button>`).join('');
    } else {
        const stat = STATS[duel.statOrdi];
        $('#duel-joueur').querySelector(`li[data-stat="${duel.statOrdi}"]`).classList.add('stat-choisie');
        $('#duel-actions').innerHTML = `
            <button class="btn-stat btn-defendre" data-stat="${duel.statOrdi}">
                <span>Défendre en ${stat.icone} ${stat.nom}</span><b>${valeurDuel(carte, duel.statOrdi)}</b>${libelleBonus(carte, duel.statOrdi)}
            </button>`;
    }
}

async function jouerManche(stat) {
    if (duel.verrou || !duel.choix) return;
    duel.verrou = true;
    const mienne = duel.mainJoueur.find(c => c.id === duel.choix);
    const sienne = duel.carteOrdi;
    duel.utilisees.add(mienne.id);
    duel.utiliseesOrdi.add(sienne.id);
    $('#duel-actions').querySelectorAll('button').forEach(b => (b.disabled = true));
    $(`#duel-actions [data-stat="${stat}"]`).classList.add('choisie');
    $('#duel-joueur').querySelector(`li[data-stat="${stat}"]`).classList.add('stat-choisie');
    afficherMain();
    await attendre(400);

    // Révélation des stats adverses
    $('#duel-ordi').innerHTML = flipHTML(sienne, { retournee: true });
    $('#duel-ordi .carte').classList.add('revelation');
    $('#duel-ordi').querySelector(`li[data-stat="${stat}"]`).classList.add('stat-choisie');
    await attendre(700);

    // En cas d'égalité, la Popularité départage
    const a = valeurDuel(mienne, stat);
    const b = valeurDuel(sienne, stat);
    let ecart = a - b;
    let departage = '';
    if (!ecart && stat !== 'popularite') {
        const pa = valeurDuel(mienne, 'popularite');
        const pb = valeurDuel(sienne, 'popularite');
        ecart = pa - pb;
        if (ecart) departage = ` Égalité, départagée par la Popularité (${pa} contre ${pb}).`;
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
    $('#duel-message').innerHTML = `${STATS[stat].icone} ${STATS[stat].nom} : <b>${a}</b> contre <b>${b}</b>.${departage} <b>${resultat}</b>`;

    const fini = duel.joueur >= MANCHES_GAGNANTES || duel.ordi >= MANCHES_GAGNANTES || duel.manche >= TAILLE_DECK;
    if (fini) finDuel();
    else $('#duel-actions').innerHTML = '<button class="btn btn-principal btn-grand" data-action="manche">Manche suivante</button>';
}

function finDuel() {
    duel.enCours = false;
    const niveau = niveauDuel();
    const i = NIVEAUX.indexOf(niveau);
    const score = `${duel.joueur} à ${duel.ordi}`;
    let message;
    if (duel.joueur > duel.ordi) {
        const dejaDebloque = niveauDebloque(i + 1);
        etat.pieces += niveau.gain;
        etat.duels.victoires[niveau.id] = victoiresDuel(niveau.id) + 1;
        sauvegarder();
        majEntete();
        toast(`Victoire ! +${niveau.gain} pièces`, 'gain');
        message = `<b class="victoire">Victoire ${score} !</b> Tu gagnes ${niveau.gain} pièces.`;
        if (NIVEAUX[i + 1] && !dejaDebloque && niveauDebloque(i + 1)) {
            message += ` <b class="victoire">Niveau ${NIVEAUX[i + 1].nom} débloqué !</b>`;
        }
    } else if (duel.joueur < duel.ordi) {
        message = `<b class="defaite">Défaite ${score}.</b> Change ton deck ou retente ta chance !`;
    } else {
        message = `<b>Match nul ${score}.</b> Personne ne gagne de pièces.`;
    }
    // Le détail de la dernière manche reste affiché au-dessus du résultat
    $('#duel-message').innerHTML += `<br>${message}`;
    $('#duel-actions').innerHTML = `
        <button class="btn btn-principal btn-grand" data-action="rejouer">Rejouer avec ce deck</button>
        <button class="btn btn-grand" data-action="preparer">Changer de deck ou d’adversaire</button>`;
}

function majScoreDuel() {
    const pips = n => Array.from({ length: MANCHES_GAGNANTES }, (_, i) => `<i${i < n ? ' class="plein"' : ''}></i>`).join('');
    $('#pips-joueur').innerHTML = pips(duel.joueur);
    $('#pips-ordi').innerHTML = pips(duel.ordi);
    $('#pips-joueur').setAttribute('aria-label', `${duel.joueur} manche(s) gagnée(s)`);
    $('#pips-ordi').setAttribute('aria-label', `${duel.ordi} manche(s) gagnée(s)`);
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
    if (nom === 'duel') afficherDuel();
    window.scrollTo(0, 0);
}

// ---------- Démarrage ----------

function init() {
    // Accueil : paquets et ouverture
    $('#paquet-gratuit').addEventListener('click', () => ouvrirBooster('gratuit'));
    $('#paquet-achat').addEventListener('click', () => ouvrirBooster('achat'));
    $('#btn-tout-retourner').addEventListener('click', toutRetourner);
    $('#btn-autre').addEventListener('click', () => ouvrirBooster(tempsRestant() === 0 ? 'gratuit' : 'achat'));
    $('#btn-x10').addEventListener('click', () => ouvrirBooster('achat', BOOSTERS_PAR_LOT));
    $('#btn-autre-x10').addEventListener('click', () => ouvrirBooster('achat', BOOSTERS_PAR_LOT));
    $('#tirage').addEventListener('click', e => retourner(e.target.closest('.flip')));
    $('#tirage').addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            retourner(e.target.closest('.flip'));
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

    // Clics partagés : ouvrir une fiche, revendre un doublon
    document.addEventListener('click', e => {
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

    // Duel : préparation
    $('#niveaux').addEventListener('click', e => {
        const niveau = e.target.closest('[data-niveau]');
        if (niveau) choisirNiveau(niveau.dataset.niveau);
    });
    for (const id of ['#deck-slots', '#deck-choix']) {
        $(id).addEventListener('click', e => {
            const carte = e.target.closest('[data-deck]');
            if (carte) basculerDeck(Number(carte.dataset.deck));
        });
    }
    $('#deck-recherche').addEventListener('input', afficherChoixDeck);
    $('#btn-deck-auto').addEventListener('click', deckAuto);
    $('#btn-lancer-duel').addEventListener('click', lancerDuel);

    // Duel : combat
    $('#duel-main').addEventListener('click', e => {
        const carte = e.target.closest('[data-jouer]');
        if (carte) selectionnerCarte(Number(carte.dataset.jouer));
    });
    $('#duel-actions').addEventListener('click', e => {
        const bouton = e.target.closest('button');
        if (!bouton) return;
        if (bouton.dataset.stat) jouerManche(bouton.dataset.stat);
        else if (bouton.dataset.action === 'manche') nouvelleManche();
        else if (bouton.dataset.action === 'rejouer') lancerDuel();
        else if (bouton.dataset.action === 'preparer') afficherDuel();
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
            if (ecran === 'duel') afficherDuel();
        })
        .catch(e => {
            console.error(e);
            toast('Impossible de charger les jeux (lance le site via WAMP ou Live Server)', 'erreur');
        });
}

init();
