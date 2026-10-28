'use strict';

/* =========================================================
   GameCards — chaque carte est un vrai jeu vidéo (données Steam)
   ========================================================= */

// ---------- Règles du jeu (valeurs de départ, à équilibrer) ----------

// Du plus rare au plus commun. `seuil` porte sur le nombre d'avis Steam.
// Chaque carte tire d'abord sa rareté selon `chance` (en %), puis un jeu au hasard dans cette rareté.
// `prix` : achat direct dans le catalogue, volontairement bien plus cher que la chance en boosters.
const RARETES = [
    { id: 'mythique',    nom: 'Mythique',    seuil: 750000, chance: 0.2,  revente: 300, prix: 10000 },
    { id: 'legendaire',  nom: 'Légendaire',  seuil: 200000, chance: 1,    revente: 100, prix: 4000 },
    { id: 'epique',      nom: 'Épique',      seuil: 60000,  chance: 3,    revente: 40,  prix: 1500 },
    { id: 'rare',        nom: 'Rare',        seuil: 12000,  chance: 8,    revente: 15,  prix: 600 },
    { id: 'peu-commune', nom: 'Peu commune', seuil: 3000,   chance: 18,   revente: 5,   prix: 250 },
    { id: 'commune',     nom: 'Commune',     seuil: 0,      chance: 69.8, revente: 2,   prix: 100 },
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
const GAIN_DUEL = 30;
const BONUS_HOLO = 5;         // duel : +5 sur toutes les stats d'une holo
const BONUS_CHEF_OEUVRE = 5;  // duel : +5 en Metacritic pour un chef-d'œuvre
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
        tags: jeu.tags,
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
        + groupe('Genres', genresCatalogue)
        + Object.entries(groupesTags).map(([titre, liste]) => groupe(titre, liste)).join('');
}

const aLeGenre = (carte, valeur) => carte.genres.includes(valeur) || (carte.tags || []).includes(valeur);

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
    genresCatalogue = genres;
    majCollectionDepuisDonnees();
}

// Les cartes déjà obtenues gardent une copie de leurs stats : on les recalcule
// pour qu'elles suivent les règles actuelles (exemplaires, holos et date sont conservés)
function majCollectionDepuisDonnees() {
    for (const entree of Object.values(etat.collection)) {
        const jeu = jeuxParId.get(entree.id);
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
    selGenre.innerHTML = optionsGenresHTML(genreChoisi, new Set(entrees.flatMap(e => [...e.genres, ...(e.tags || [])])));

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
            ${carte.tags?.length ? `<p class="fiche-tags">${carte.tags.map(t => `<span${(groupesTags['Contenu sensible'] || []).includes(t)
                ? ' class="tag-sensible"' : ''}>${echapper(t)}</span>`).join('')}</p>` : ''}
            <dl class="fiche-stats">
                <div><dt>👍 Note public</dt><dd>${carte.attaque} %</dd></div>
                <div><dt>📰 Metacritic</dt><dd>${carte.metacritic ?? '<span class="gris">aucune · 0</span>'}</dd></div>
                <div><dt>★ Popularité</dt><dd>${carte.popularite} / 100</dd></div>
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

// Valeur d'une stat en duel, bonus compris
function bonusDuel(carte, stat) {
    let bonus = 0;
    if (carte.holos > 0) bonus += BONUS_HOLO;
    if (stat === 'defense' && carte.metacritic >= SEUIL_CHEF_OEUVRE) bonus += BONUS_CHEF_OEUVRE;
    return bonus;
}
const valeurDuel = (carte, stat) => carte[stat] + bonusDuel(carte, stat);

// Tirage d'une carte de duel : une rareté au hasard (même chance pour chacune), puis une carte dedans.
// Une Mythique sort donc aussi souvent qu'une Commune.
function tirerCarteJoueur() {
    const parRarete = {};
    for (const e of Object.values(etat.collection)) (parRarete[e.rarete] ??= []).push(e);
    return auHasard(parRarete[auHasard(Object.keys(parRarete))]);
}
const tirerCarteOrdi = exclus => piocher(Math.floor(Math.random() * RARETES.length), exclus);

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
    actionsDuel(Object.entries(STATS).map(([cle, stat]) => {
        const bonus = bonusDuel(duel.carteJoueur, cle);
        return `
            <button class="btn-stat" data-stat="${cle}">
                <span>${stat.icone} ${stat.nom}</span><b>${valeurDuel(duel.carteJoueur, cle)}</b>
                ${bonus ? `<small>dont +${bonus} de bonus</small>` : ''}
            </button>`;
    }).join(''));
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
    const mienne = valeurDuel(duel.carteJoueur, stat);
    const sienne = valeurDuel(duel.carteOrdi, stat);
    let ecart = mienne - sienne;
    let departage = '';
    if (!ecart && stat !== 'popularite') {
        const pm = valeurDuel(duel.carteJoueur, 'popularite');
        const ps = valeurDuel(duel.carteOrdi, 'popularite');
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
