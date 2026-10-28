'use strict';

/* =========================================================
   GameCards — chaque carte est un vrai jeu vidéo (données Steam)
   ========================================================= */

// ---------- Règles du jeu (valeurs de départ, à équilibrer) ----------

// Du plus rare au plus commun. `seuil` porte sur le nombre d'avis Steam.
const RARETES = [
    { id: 'mythique',    nom: 'Mythique',    seuil: 750000, chance: 0.5, revente: 300 },
    { id: 'legendaire',  nom: 'Légendaire',  seuil: 200000, chance: 2.5, revente: 100 },
    { id: 'epique',      nom: 'Épique',      seuil: 60000,  chance: 7,   revente: 40 },
    { id: 'rare',        nom: 'Rare',        seuil: 12000,  chance: 15,  revente: 15 },
    { id: 'peu-commune', nom: 'Peu commune', seuil: 3000,   chance: 25,  revente: 5 },
    { id: 'commune',     nom: 'Commune',     seuil: 0,      chance: 50,  revente: 2 },
];
const INDEX_RARE = RARETES.findIndex(r => r.id === 'rare');

const CARTES_PAR_BOOSTER = 5;
const PRIX_BOOSTER = 50;
const DELAI_BOOSTER = 10 * 60 * 1000;
const CHANCE_HOLO = 0.02;
const MULTIPLICATEUR_HOLO = 3;
const SEUIL_CHEF_OEUVRE = 90;
const MANCHES_GAGNANTES = 3;
const GAIN_DUEL = 30;
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

// Tous les jeux de data/jeux.json, rangés par rareté (chargés au démarrage)
const jeuxParRarete = {};

function sauvegarder() {
    for (const [nom, cle] of Object.entries(CLES)) ecrire(cle, etat[nom]);
}

// ---------- Cartes ----------

// Popularité sur une échelle logarithmique : 100 avis → 0, 1 million d'avis → 100
const popularite = avis => Math.max(0, Math.min(100, Math.round((Math.log10(avis) - 2) * 25)));

function creerCarte(jeu) {
    return {
        id: jeu.id,
        nom: jeu.nom,
        image: `${URL_IMAGES}/${jeu.id}/${jeu.image || 'header.jpg'}`,
        attaque: jeu.note,
        defense: jeu.metacritic ?? 50,
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
                    ${carte.image ? `<img src="${echapper(carte.image)}" alt="" loading="lazy">` : ''}
                    ${!cachee && carte.metacritic >= SEUIL_CHEF_OEUVRE ? '<span class="badge-chef" title="Metacritic 90 ou plus">Chef-d’œuvre</span>' : ''}
                </div>
                <h3 class="carte-nom">${echapper(carte.nom)}</h3>
                <p class="carte-infos">${echapper(infos) || '&nbsp;'}</p>
                <ul class="carte-stats">
                    ${Object.entries(STATS).map(([cle, stat]) => `
                        <li data-stat="${cle}"${!cachee && cle === 'defense' && carte.metacritic == null
                            ? ' class="par-defaut" title="Pas de note Metacritic : 50 par défaut"' : ''}>
                            <span>${stat.icone} ${stat.nom}</span><b>${cachee ? '?' : carte[cle]}</b>
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

// ---------- Données ----------

async function chargerJeux() {
    const reponse = await fetch('data/jeux.json?v=1');
    if (!reponse.ok) throw new Error(`data/jeux.json introuvable (${reponse.status})`);
    for (const r of RARETES) jeuxParRarete[r.id] = [];
    for (const jeu of await reponse.json()) jeuxParRarete[rareteDe(jeu.avis).id].push(jeu);
}

const donneesPretes = () => RARETES.some(r => jeuxParRarete[r.id]?.length);

// Pioche une carte de la rareté demandée (sans doublon dans `exclus`)
function piocher(index, exclus = new Set()) {
    const bac = jeuxParRarete[RARETES[index].id];
    for (let essai = 0; essai < 20; essai++) {
        const jeu = auHasard(bac);
        if (!exclus.has(jeu.id)) return creerCarte(jeu);
    }
    return creerCarte(auHasard(bac));
}

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

// ---------- En-tête et minuteur ----------

let ouvertureEnCours = false;
const tempsRestant = () => Math.max(0, etat.dernierBooster + DELAI_BOOSTER - Date.now());

function majEntete() {
    $('#solde').textContent = etat.pieces;
    majBoutonsBooster();
}

function majBoutonsBooster() {
    const reste = tempsRestant();
    const bloque = ouvertureEnCours || !donneesPretes();
    $('#btn-gratuit').disabled = bloque || reste > 0;
    $('#etat-gratuit').textContent = reste > 0 ? `Prochain dans ${formatDuree(reste)}` : 'Disponible !';
    $('#btn-acheter').disabled = bloque || etat.pieces < PRIX_BOOSTER;
    $('#lien-boosters').classList.toggle('pret', reste === 0);
}

// ---------- Boosters ----------

async function ouvrirBooster(mode) {
    if (ouvertureEnCours || !donneesPretes()) return;
    if (mode === 'gratuit' && tempsRestant() > 0) return;
    if (mode === 'achat' && etat.pieces < PRIX_BOOSTER) return toast('Pas assez de pièces', 'erreur');

    ouvertureEnCours = true;
    majBoutonsBooster();

    // 4 cartes au hasard + la dernière Rare ou mieux
    const indices = Array.from({ length: CARTES_PAR_BOOSTER - 1 }, () => tirerRarete());
    indices.push(tirerRarete(INDEX_RARE));
    const exclus = new Set();
    const tirage = indices.map(index => {
        const carte = piocher(index, exclus);
        exclus.add(carte.id);
        return { carte, holo: Math.random() < CHANCE_HOLO };
    });

    if (mode === 'gratuit') etat.dernierBooster = Date.now();
    else etat.pieces -= PRIX_BOOSTER;
    for (const t of tirage) t.nouvelle = ajouterACollection(t.carte, t.holo);
    sauvegarder();
    majEntete();

    // Le paquet tremble un instant, puis la plus rare se retourne en dernier
    const paquet = $('#paquet');
    $('#tirage').innerHTML = '';
    $('#tirage-actions').hidden = true;
    paquet.hidden = false;
    paquet.classList.add('secoue');
    await attendre(800);
    tirage.sort((a, b) => indexRarete(b.carte.rarete) - indexRarete(a.carte.rarete));
    await afficherTirage(tirage);

    ouvertureEnCours = false;
    majBoutonsBooster();
}

async function afficherTirage(tirage) {
    const paquet = $('#paquet');
    paquet.classList.remove('secoue');
    paquet.classList.add('ouvre');
    await attendre(450);
    paquet.hidden = true;
    paquet.classList.remove('ouvre');

    $('#tirage').innerHTML = tirage.map(t => flipHTML(t.carte, t)).join('');
    $('#tirage').querySelectorAll('.flip').forEach((flip, i) => {
        flip.tabIndex = 0;
        flip.setAttribute('role', 'button');
        flip.setAttribute('aria-label', `Retourner la carte ${i + 1}`);
        flip.style.animationDelay = `${i * 80}ms`;
    });
    $('#tirage-actions').hidden = false;
}

function retourner(flip) {
    if (!flip || flip.classList.contains('retournee')) return;
    flip.classList.add('retournee');
    flip.removeAttribute('role');
    flip.removeAttribute('aria-label');
    if (!$('#tirage .flip:not(.retournee)')) $('#tirage-actions').hidden = true;
}

async function toutRetourner() {
    for (const flip of document.querySelectorAll('#tirage .flip:not(.retournee)')) {
        retourner(flip);
        await attendre(280);
    }
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

function caseCollectionHTML(entree) {
    return `
        <div class="case" data-id="${entree.id}">
            ${carteHTML(entree, { holo: entree.holos > 0, compteur: entree.exemplaires })}
            ${entree.exemplaires > 1
                ? `<button class="btn-vendre" data-vendre="${entree.id}">Revendre un doublon · +${prixRevente(entree)} 🪙</button>`
                : ''}
        </div>`;
}

function afficherCollection() {
    const entrees = Object.values(etat.collection);

    // Le menu des genres se construit à partir de la collection
    const selGenre = $('#filtre-genre');
    const genreChoisi = selGenre.value;
    const genres = [...new Set(entrees.flatMap(e => e.genres))].sort((a, b) => a.localeCompare(b, 'fr'));
    selGenre.innerHTML = '<option value="">Tous les genres</option>'
        + genres.map(g => `<option value="${echapper(g)}"${g === genreChoisi ? ' selected' : ''}>${echapper(g)}</option>`).join('');

    const recherche = $('#filtre-nom').value.trim().toLowerCase();
    const rarete = $('#filtre-rarete').value;
    const doublons = $('#filtre-doublons').checked;
    const visibles = entrees
        .filter(e => !recherche || e.nom.toLowerCase().includes(recherche))
        .filter(e => !rarete || e.rarete === rarete)
        .filter(e => !genreChoisi || e.genres.includes(genreChoisi))
        .filter(e => !doublons || e.exemplaires > 1)
        .sort(TRIS[$('#tri').value]);

    const grille = $('#grille-collection');
    if (!entrees.length) {
        grille.innerHTML = '<p class="vide">Ta collection est vide. <a href="#boosters">Ouvre ton premier booster !</a></p>';
    } else if (!visibles.length) {
        grille.innerHTML = '<p class="vide">Aucune carte ne correspond à ces filtres.</p>';
    } else {
        grille.innerHTML = visibles.map(caseCollectionHTML).join('');
    }
    majResumeCollection();
}

function majResumeCollection() {
    const entrees = Object.values(etat.collection);
    const total = entrees.reduce((n, e) => n + e.exemplaires, 0);
    const valeur = entrees.reduce((n, e) => n + valeurDoublons(e), 0);
    $('#resume-collection').textContent =
        `${entrees.length} jeux différents · ${total} cartes · ${total - entrees.length} doublons`;
    const bouton = $('#btn-vendre-tout');
    bouton.disabled = valeur === 0;
    bouton.textContent = valeur ? `Revendre tous les doublons · +${valeur} 🪙` : 'Aucun doublon à revendre';
}

function vendreDepuisCollection(id) {
    const prix = vendreDoublon(id);
    if (!prix) return;
    sauvegarder();
    majEntete();
    const caseCarte = document.querySelector(`.case[data-id="${id}"]`);
    if ($('#filtre-doublons').checked && etat.collection[id].exemplaires < 2) caseCarte.remove();
    else caseCarte.outerHTML = caseCollectionHTML(etat.collection[id]);
    majResumeCollection();
    toast(`+${prix} 🪙`, 'gain');
}

function vendreTousLesDoublons() {
    const entrees = Object.values(etat.collection);
    const valeur = entrees.reduce((n, e) => n + valeurDoublons(e), 0);
    if (!valeur || !confirm(`Revendre tous tes doublons pour ${valeur} pièces ? Tu gardes un exemplaire de chaque jeu (la holo en priorité).`)) return;
    for (const e of entrees) while (e.exemplaires > 1) vendreDoublon(e.id);
    sauvegarder();
    majEntete();
    afficherCollection();
    toast(`+${valeur} 🪙`, 'gain');
}

// ---------- Écran accueil ----------

function afficherAccueil() {
    const entrees = Object.values(etat.collection);
    $('#stat-uniques').textContent = entrees.length;
    $('#stat-total').textContent = entrees.reduce((n, e) => n + e.exemplaires, 0);
    $('#stat-holo').textContent = entrees.reduce((n, e) => n + e.holos, 0);
    $('#stat-pieces').textContent = etat.pieces;
    $('#legende-raretes').innerHTML = RARETES.map((r, i) => `
        <tr class="rarete-${r.id}">
            <td><span class="pastille"></span>${r.nom}</td>
            <td>${r.seuil ? `≥ ${r.seuil.toLocaleString('fr-FR')}` : `< ${RARETES[i - 1].seuil.toLocaleString('fr-FR')}`}</td>
            <td>${r.chance.toLocaleString('fr-FR')} %</td>
            <td>${r.revente} 🪙</td>
            <td>${entrees.filter(e => e.rarete === r.id).length}</td>
        </tr>`).join('');
}

// ---------- Duel ----------

const duel = { joueur: 0, ordi: 0, carteJoueur: null, carteOrdi: null };

function actionsDuel(html) {
    $('#duel-actions').innerHTML = html;
}

function majScoreDuel() {
    $('#score-joueur').textContent = duel.joueur;
    $('#score-ordi').textContent = duel.ordi;
}

function demarrerDuel() {
    if (!donneesPretes()) return;
    if (!Object.keys(etat.collection).length) {
        toast('Ouvre d’abord un booster pour avoir des cartes', 'erreur');
        return;
    }
    duel.joueur = 0;
    duel.ordi = 0;
    nouvelleManche();
}

function nouvelleManche() {
    const collection = Object.values(etat.collection);
    duel.carteJoueur = auHasard(collection);
    // L'ordinateur pioche parmi tous les jeux, avec les mêmes chances qu'un booster
    duel.carteOrdi = piocher(tirerRarete(), new Set([duel.carteJoueur.id]));

    $('#duel-joueur').className = 'duel-emplacement';
    $('#duel-ordi').className = 'duel-emplacement';
    $('#duel-joueur').innerHTML = flipHTML(duel.carteJoueur, { holo: duel.carteJoueur.holos > 0, retournee: true });
    // On voit le jeu adverse, pas ses stats : à toi de deviner où il est faible
    $('#duel-ordi').innerHTML = flipHTML(duel.carteOrdi, { retournee: true, cachee: true });
    $('#duel-message').textContent = `L’ordinateur joue ${duel.carteOrdi.nom}. Sur quelle stat penses-tu le battre ?`;
    actionsDuel(Object.entries(STATS).map(([cle, stat]) =>
        `<button class="btn btn-stat" data-stat="${cle}">${stat.icone} ${stat.nom} · ${duel.carteJoueur[cle]}</button>`).join(''));
    majScoreDuel();
}

async function choisirStat(stat) {
    $('#duel-actions').querySelectorAll('button').forEach(b => (b.disabled = true));
    const mienne = duel.carteJoueur[stat];
    const sienne = duel.carteOrdi[stat];

    document.querySelectorAll(`#duel-joueur li[data-stat="${stat}"]`).forEach(li => li.classList.add('stat-choisie'));
    await attendre(400);

    // Révélation des stats adverses
    $('#duel-ordi').innerHTML = flipHTML(duel.carteOrdi, { retournee: true });
    $('#duel-ordi .carte').classList.add('revelation');
    $('#duel-ordi').querySelector(`li[data-stat="${stat}"]`).classList.add('stat-choisie');
    await attendre(700);

    let resultat = 'égalité, personne ne marque.';
    if (mienne > sienne) {
        duel.joueur++;
        resultat = 'manche gagnée !';
        $('#duel-joueur').classList.add('gagne');
        $('#duel-ordi').classList.add('perd');
    } else if (sienne > mienne) {
        duel.ordi++;
        resultat = 'manche perdue.';
        $('#duel-joueur').classList.add('perd');
        $('#duel-ordi').classList.add('gagne');
    }
    majScoreDuel();
    $('#duel-message').textContent = `${STATS[stat].nom} : ${mienne} contre ${sienne}, ${resultat}`;

    if (duel.joueur >= MANCHES_GAGNANTES || duel.ordi >= MANCHES_GAGNANTES) finDuel();
    else actionsDuel('<button class="btn btn-principal" data-action="manche">Manche suivante</button>');
}

function finDuel() {
    const victoire = duel.joueur >= MANCHES_GAGNANTES;
    if (victoire) {
        etat.pieces += GAIN_DUEL;
        sauvegarder();
        majEntete();
        toast(`Victoire ! +${GAIN_DUEL} 🪙`, 'gain');
    }
    $('#duel-message').textContent = victoire
        ? `Victoire ${duel.joueur} à ${duel.ordi} ! Tu gagnes ${GAIN_DUEL} pièces.`
        : `Défaite ${duel.joueur} à ${duel.ordi}. Retente ta chance !`;
    actionsDuel('<button class="btn btn-principal" data-action="demarrer">Rejouer</button>');
}

// ---------- Navigation ----------

function afficherEcran(nom) {
    if (!document.getElementById(`ecran-${nom}`)) nom = 'accueil';
    document.querySelectorAll('.ecran').forEach(e => (e.hidden = e.id !== `ecran-${nom}`));
    document.querySelectorAll('.menu a').forEach(a => {
        if (a.dataset.ecran === nom) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
    });
    if (nom === 'accueil') afficherAccueil();
    if (nom === 'collection') afficherCollection();
    window.scrollTo(0, 0);
}

// ---------- Démarrage ----------

function init() {
    $('#filtre-rarete').innerHTML = '<option value="">Toutes les raretés</option>'
        + RARETES.map(r => `<option value="${r.id}">${r.nom}</option>`).join('');

    $('#btn-gratuit').addEventListener('click', () => ouvrirBooster('gratuit'));
    $('#btn-acheter').addEventListener('click', () => ouvrirBooster('achat'));
    $('#btn-tout-retourner').addEventListener('click', toutRetourner);
    $('#tirage').addEventListener('click', e => retourner(e.target.closest('.flip')));
    $('#tirage').addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            retourner(e.target.closest('.flip'));
        }
    });

    for (const id of ['#filtre-rarete', '#filtre-genre', '#tri', '#filtre-doublons']) {
        $(id).addEventListener('change', afficherCollection);
    }
    $('#filtre-nom').addEventListener('input', afficherCollection);
    $('#grille-collection').addEventListener('click', e => {
        const bouton = e.target.closest('[data-vendre]');
        if (bouton) vendreDepuisCollection(Number(bouton.dataset.vendre));
    });
    $('#btn-vendre-tout').addEventListener('click', vendreTousLesDoublons);

    $('#duel-actions').addEventListener('click', e => {
        const bouton = e.target.closest('button');
        if (!bouton) return;
        if (bouton.dataset.stat) choisirStat(bouton.dataset.stat);
        else if (bouton.dataset.action === 'demarrer') demarrerDuel();
        else if (bouton.dataset.action === 'manche') nouvelleManche();
    });

    window.addEventListener('hashchange', () => afficherEcran(location.hash.slice(1)));
    afficherEcran(location.hash.slice(1));
    majEntete();
    setInterval(majBoutonsBooster, 1000);

    chargerJeux()
        .then(majBoutonsBooster)
        .catch(e => {
            console.error(e);
            toast('Impossible de charger les jeux (lance le site via WAMP ou Live Server)', 'erreur');
        });
}

init();
