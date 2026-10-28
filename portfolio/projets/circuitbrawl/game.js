import { ROBOTS, FAMILLES, SEUILS_SYNERGIE, OBJETS, STATUTS, COMMANDANTS, MODULES, RARETES, familles, famille } from './data.js';
import {
    TAILLE_EQUIPE, CREDITS_PAR_TOUR, PRIX_RELANCE, VIES, VICTOIRES_BUT, EPARGNE_MAX, PRIX_RARETE, TOURS_MODULE,
    seuilsXp, reglerExperience, xpDe, palierDuTour, viesPerdues, tirerBoutique, tailleBoutique, uniteBonus, peutFusionner, fusionner,
    declencherBoutique, compterFamilles, niveauSynergie, simulerCombat, genererAdversaire, genererBoss, estTourBoss,
    tirerObjets, tailleObjets, utiliserObjet, retirerTemporaires, declencherAllieObjet,
    prixRobot, prixObjet, interets, effetsRun, proposer, festin, creerUnite, idsMythiques,
} from './moteur.js';
import { robotSVG, villeSVG, ICONE_ATK, ICONE_PV } from './svg.js';

const CLE_RECORD = 'circuit-brawl-record';
const CLE_AIDE = 'circuit-brawl-aide-vue';
const NOMS_ADVERSES = ['Unité Rouille', 'Ferraille & Fils', 'Bug Collectif', 'Les Surchauffés', 'Cortex-9',
    'Gang des Boulons', 'Protocole Oméga', 'Les Court-Circuits', 'Kernel Panic', 'Tôle Froissée'];
const ONOMATOPEES = ['POW!', 'BAM!', 'CLANG!', 'BONK!', 'ZAP!', 'CRAC!'];
const ENCRE = '#1e1b2e';

const $ = sel => document.querySelector(sel);
const attendre = ms => new Promise(r => setTimeout(r, ms));
const hasard = (a, b) => a + Math.random() * (b - a);

let S;                  // état du run
let survol = null;      // unité survolée (fiche détaillée)

// ---------- Run ----------

function nouvellePartie() {
    S = {
        tour: 0, vies: VIES, victoires: 0, credits: 0, epargne: 0, relances: 0,
        equipe: Array(TAILLE_EQUIPE).fill(null), boutique: [], objets: [], sel: null, phase: 'choix',
        commandant: null, modules: [], choixModules: 0, eff: effetsRun(null),
    };
    majEffets();
    fermerModal();
    basculerVue(false);
    rendre();
    let premiereFois = false;
    try {
        if (!localStorage.getItem(CLE_AIDE)) { localStorage.setItem(CLE_AIDE, '1'); premiereFois = true; }
    } catch { /* stockage indisponible */ }
    // La première fois, l'aide s'affiche d'abord ; le choix du commandant suit sa fermeture
    if (premiereFois) afficherAide();
    else choisirCommandant();
}

// Recalcule les effets du commandant et des modules
function majEffets() {
    S.eff = effetsRun(S.commandant, S.modules);
    reglerExperience(S.eff);
}

// Carte de choix (commandant ou module) dans une fenêtre
function carteChoix(action, id, def) {
    return `<button data-action="${action}" data-id="${id}" class="bloc flex flex-1 basis-40 flex-col items-center gap-2 p-4 text-center transition hover:-translate-y-1">
        <span class="text-5xl leading-none">${def.icone}</span>
        <span class="titre text-lg leading-tight">${def.nom}</span>
        <span class="text-sm font-medium leading-snug opacity-80">${def.desc}</span>
    </button>`;
}

function choisirCommandant() {
    const choix = proposer(Object.keys(COMMANDANTS), 3);
    ouvrirModal(`
        <p class="titre text-sm uppercase tracking-widest opacity-60">Nouveau run</p>
        <h2 class="titre contour text-3xl" style="color:#ffd23f">Choisis ton commandant</h2>
        <p class="mt-1 font-medium opacity-80">Son pouvoir dure tout le run.</p>
        <div class="mt-4 flex flex-wrap gap-3">${choix.map(id => carteChoix('commandant', id, COMMANDANTS[id])).join('')}</div>`);
}

function afficherChoixModule() {
    const choix = proposer(Object.keys(MODULES), 3, S.modules);
    if (!choix.length) { S.choixModules = 0; return; }
    S.phase = 'choix';
    ouvrirModal(`
        <p class="titre text-sm uppercase tracking-widest opacity-60">Tour ${S.tour}</p>
        <h2 class="titre contour text-3xl" style="color:#4cc3ff">Installe un module</h2>
        <p class="mt-1 font-medium opacity-80">Les modules restent jusqu’à la fin du run et s’additionnent.</p>
        <div class="mt-4 flex flex-wrap gap-3">${choix.map(id => carteChoix('module', id, MODULES[id])).join('')}</div>`);
}

function prendreModule(id) {
    S.modules.push(id);
    S.choixModules--;
    majEffets();
    fermerModal();
    S.phase = 'boutique';
    // Le tapis élargi agit tout de suite
    if (MODULES[id].effet?.tapis) {
        const palier = palierDuTour(S.tour);
        S.boutique.push(...tirerBoutique(palier, Math.random, null, MODULES[id].effet.tapis));
    }
    rendre();
    message(`${MODULES[id].icone} Module installé : ${MODULES[id].nom}`, true);
    setTimeout(choixSuivant, 400);
}

// Choix en attente après un retour en boutique : modules d'abord, puis le mythique offert par le boss du tour 10
function choixSuivant() {
    if (S.choixModules > 0) afficherChoixModule();
    else if (S.choixMythique) afficherChoixMythique();
}

function afficherChoixMythique() {
    S.phase = 'choix';
    const cartes = proposer(idsMythiques(), 3).map(id => {
        const def = ROBOTS[id];
        return `<button data-action="mythique" data-id="${id}" class="bloc flex flex-1 basis-40 flex-col items-center gap-1 p-3 text-center transition hover:-translate-y-1">
            <span class="h-20 w-20">${robotSVG(id)}</span>
            <span class="titre text-lg leading-tight">${def.nom}</span>
            <span class="titre text-sm">${def.atk} ⚔️ · ${def.hp} ❤️</span>
            <span class="text-xs font-medium leading-snug opacity-80">${def.desc(1)}</span>
        </button>`;
    }).join('');
    ouvrirModal(`
        <p class="titre text-sm uppercase tracking-widest opacity-60">Boss vaincu</p>
        <h2 class="titre contour text-3xl" style="color:#f9a8d4">Choisis un mythique</h2>
        <p class="mt-1 font-medium opacity-80">Un robot de palier VII, offert : il t’attend gelé sur le tapis.</p>
        <div class="mt-4 flex flex-wrap gap-3">${cartes}</div>`);
}

function prendreMythique(id) {
    S.choixMythique = false;
    S.boutique.unshift(creerUnite(id, { offert: true, gele: true }));
    fermerModal();
    S.phase = 'boutique';
    rendre();
    message(`🌟 ${ROBOTS[id].nom} t’attend sur le tapis !`, true);
}

function basculerVue(combat) {
    $('#vue-combat').classList.toggle('hidden', !combat);
    $('#vue-combat').classList.toggle('flex', combat);
    $('#vue-boutique').classList.toggle('hidden', combat);
    $('#actions-combat').classList.toggle('hidden', !combat);
    $('#actions-combat').classList.toggle('flex', combat);
    $('#actions-boutique').classList.toggle('hidden', combat);
    alignerSol();
}

// Cale le décor sur l'équipe : les robots se tiennent sur la route, le trottoir passe derrière eux,
// et les pointillés de la route passent sous l'équipe (entre l'équipe et la boutique en phase d'achat)
const HAUTEUR_TROTTOIR = 64;
function alignerSol() {
    requestAnimationFrame(() => {
        let pieds, tirets;
        if (!$('#vue-boutique').classList.contains('hidden')) {
            const slot = document.querySelector('#equipe [data-slot]');
            if (!slot) return;
            const r = slot.getBoundingClientRect();
            pieds = r.bottom - r.height * 0.2;
            tirets = ($('#synergies').getBoundingClientRect().bottom + $('#titre-boutique').getBoundingClientRect().top) / 2;
        } else {
            // Les robots sont posés à 22 % du bas de l'arène ; leurs pieds sont au-dessus des stats (~30 % de leur largeur)
            const r = arene.getBoundingClientRect();
            pieds = r.bottom - r.height * 0.22 - dimensions().largeur * 0.94 * 0.3;
            tirets = pieds + 90;
        }
        const haut = pieds - 40;    // bord haut de la route, un peu au-dessus des pieds
        const sol = Math.max(HAUTEUR_TROTTOIR + 40, innerHeight - haut + HAUTEUR_TROTTOIR);
        document.documentElement.style.setProperty('--sol', `${sol}px`);
        document.documentElement.style.setProperty('--tirets', `${Math.max(20, tirets - haut)}px`);
        // L'animation du sol ne s'active qu'après le premier placement
        requestAnimationFrame(() => document.body.classList.add('pret'));
    });
}

function debutTour() {
    S.tour++;
    // Crédits du tour + épargne du tour précédent + intérêts
    const interet = interets(S.epargne, S.eff);
    S.credits = CREDITS_PAR_TOUR + S.epargne + interet;
    const epargne = S.epargne;
    S.epargne = 0;
    S.relances = S.eff.relancesGratuites ?? 0;
    if (TOURS_MODULE.includes(S.tour)) S.choixModules++;
    remplirBoutique();
    S.sel = null;
    S.phase = 'boutique';
    // Capacités « après combat » (compteurs d'évolution), selon le résultat du combat précédent
    const apres = [];
    if (S.dernierResultat) {
        S.equipe.forEach((u, i) => {
            if (u && ROBOTS[u.id].apresCombat) apres.push(...declencherBoutique('apresCombat', S.equipe, i, Math.random, { resultat: S.dernierResultat }));
        });
        // Synergie Cuisiniers : festin après une victoire
        if (S.dernierResultat === 'victoire') {
            const plats = festin(S.equipe);
            if (plats.length) { apres.push(...plats); setTimeout(() => message('🍳 Festin de victoire !', true), 500); }
        }
        S.dernierResultat = null;
    }
    // Capacités « début du tour » (crédits bonus de l'Oracle)
    const gains = [];
    S.equipe.forEach((u, i) => {
        if (!u || !ROBOTS[u.id].debutTour) return;
        for (const e of declencherBoutique('debutTour', S.equipe, i)) if (e.credits) { S.credits += e.credits; gains.push(e); }
    });
    basculerVue(false);
    rendre();
    setTimeout(() => {
        gains.forEach(({ uid, credits }) => {
            const sp = document.querySelector(`#equipe [data-uid="${uid}"] .sprite`);
            if (!sp) return;
            const c = centreEcran(sp);
            anneau(c);
            flotter(`+${credits} 🪙`, '#ffd23f', c.x, c.y - 30, 28, 1200);
            etincelles(c.x, c.y, ['#ffd23f', '#fff'], 8);
        });
        if (apres.length && S.phase === 'boutique') rendre(apres);
        if (epargne || interet) {
            const morceaux = [epargne && `${epargne} épargnés`, interet && `+${interet} d’intérêts`].filter(Boolean);
            message(`🪙 ${morceaux.join(' · ')}`, true);
        }
        choixSuivant();
    }, 450);
    // Les nouveaux robots arrivent sur le tapis (les gelés restent en place)
    document.querySelectorAll('.article:not(.gele)').forEach((el, i) => el.animate(
        [{ transform: 'translateX(-60px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 380, delay: i * 70, easing: 'cubic-bezier(.3,1.4,.6,1)', fill: 'backwards' }));
}

// Garde les articles gelés et complète le tapis avec des nouveaux
function remplirBoutique() {
    const palier = palierDuTour(S.tour);
    const robots = S.boutique.filter(u => u.gele);
    const objets = S.objets.filter(o => o.gele);
    const taille = tailleBoutique(palier) + (S.eff.tapis ?? 0);
    S.boutique = [...robots, ...tirerBoutique(palier, Math.random, null, Math.max(0, taille - robots.length))];
    S.objets = [...objets, ...tirerObjets(palier).slice(0, Math.max(0, tailleObjets(palier) - objets.length))];
}

function articleChoisi() {
    if (S.sel?.zone === 'boutique') return S.boutique[S.sel.i];
    if (S.sel?.zone === 'objet') return S.objets[S.sel.i];
    return null;
}

function geler() {
    const a = articleChoisi();
    if (!a || S.phase !== 'boutique') return;
    a.gele = !a.gele;
    S.sel = null;
    rendre();
}

// ---------- Actions de boutique ----------

function message(texte, succes = false) {
    const el = $('#message');
    el.textContent = texte;
    el.style.background = succes ? '#4be08a' : '#ff6b6b';
    el.style.opacity = 1;
    el.animate([{ transform: 'translate(-50%, 6px) scale(.8)' }, { transform: 'translate(-50%, 0) scale(1)' }],
        { duration: 250, easing: 'cubic-bezier(.3,1.6,.6,1)' });
    clearTimeout(message.t);
    message.t = setTimeout(() => (el.style.opacity = 0), 1800);
}

function monteeDeNiveau(u) {
    const bonus = uniteBonus(palierDuTour(S.tour));
    if (bonus) S.boutique.push(bonus);
    message(`${ROBOTS[u.id].nom} passe niveau ${u.niveau} ! Robot bonus sur le tapis`, true);
}

function acheter(bi, j) {
    const u = S.boutique[bi];
    const prix = prixRobot(u, S.eff);
    if (S.credits < prix) return message(`Pas assez de crédits (${prix} 🪙)`);
    const cible = S.equipe[j];
    if (cible && !peutFusionner(cible, u)) {
        return message(cible.id === u.id ? 'Niveau maximum atteint' : 'Case occupée : vise une case vide ou un robot identique');
    }
    S.credits -= prix;
    S.boutique.splice(bi, 1);
    delete u.gele;
    delete u.offert;
    S.sel = null;
    let monte = false;
    if (cible) monte = fusionner(cible, u);
    else S.equipe[j] = u;
    const effets = declencherBoutique('achat', S.equipe, j);
    if (monte) monteeDeNiveau(S.equipe[j]);
    rendre(effets, { uid: S.equipe[j].uid, fusion: !!cible, niveau: monte ? S.equipe[j].niveau : 0 });
}

function deplacer(k, j) {
    S.sel = null;
    if (k === j) return rendre();
    const a = S.equipe[k], b = S.equipe[j];
    if (b && peutFusionner(b, a)) {
        S.equipe[k] = null;
        const monte = fusionner(b, a);
        if (monte) monteeDeNiveau(b);
        return rendre([], { uid: b.uid, fusion: true, niveau: monte ? b.niveau : 0 });
    }
    S.equipe[k] = b;
    S.equipe[j] = a;
    rendre();
}

function vendre() {
    if (S.phase !== 'boutique' || S.sel?.zone !== 'equipe') return;
    const k = S.sel.i, u = S.equipe[k];
    if (!u) return;
    const el = document.querySelector(`#equipe [data-slot="${k}"] .sprite`);
    const c = el && centreEcran(el);
    const effets = declencherBoutique('vente', S.equipe, k);
    const gain = u.niveau + (S.eff.venteBonus ?? 0);
    S.credits += gain;
    S.equipe[k] = null;
    S.sel = null;
    rendre(effets);
    if (c) {
        flotter(`+${gain} 🪙`, '#ffd23f', c.x, c.y, 26);
        etincelles(c.x, c.y, ['#ffd23f', '#ff9f1c', '#fff'], 10);
        // Food-truck : les plats partent de sa place vers chaque allié
        for (const e of effets.filter(e => e.plat)) {
            const cible = document.querySelector(`#equipe [data-uid="${e.uid}"] .sprite`);
            if (cible) lancer(OBJETS[e.plat].icone, c, centreEcran(cible), () => {});
        }
    }
}

function relancer() {
    if (S.phase !== 'boutique') return;
    // Hackeuse : la première relance du tour est gratuite
    if (S.relances > 0) S.relances--;
    else if (S.credits < PRIX_RELANCE) return message('Pas assez de crédits');
    else S.credits -= PRIX_RELANCE;
    remplirBoutique();
    if (S.sel?.zone !== 'equipe') S.sel = null;
    rendre();
    document.querySelectorAll('.article:not(.gele)').forEach((el, i) => el.animate(
        [{ transform: 'translateY(-30px) scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 320, delay: i * 50, easing: 'cubic-bezier(.3,1.6,.6,1)', fill: 'backwards' }));
}

function clicBoutique(i) {
    if (S.phase !== 'boutique') return;
    S.sel = S.sel?.zone === 'boutique' && S.sel.i === i ? null : { zone: 'boutique', i };
    rendre();
}

// Donne un objet de la boutique au robot de la case j
function donnerObjet(oi, j) {
    const o = S.objets[oi], def = OBJETS[o.id];
    const prix = prixObjet(S.eff);
    if (S.credits < prix) return message('Pas assez de crédits');
    if (!S.equipe[j]) return message('Donne l’objet à un robot de ton équipe');
    const depart = document.querySelector(`[data-objet="${oi}"] .sprite`);
    const de = depart && centreEcran(depart);
    const res = utiliserObjet(o, S.equipe, j);
    if (!res.ok) return message(res.message);
    res.effets.push(...declencherAllieObjet(S.equipe, j));
    S.credits -= prix;
    S.objets.splice(oi, 1);
    S.sel = null;
    const u = S.equipe[j];
    if (res.monte) monteeDeNiveau(u);
    // L'objet vole jusqu'au robot, puis les effets s'affichent
    rendre();
    const cible = document.querySelector(`#equipe [data-uid="${u.uid}"] .sprite`);
    if (de && cible) {
        lancer(def.icone, de, centreEcran(cible), () => {
            rendre(res.effets, { uid: u.uid, niveau: res.monte ? u.niveau : 0, objet: true });
            if (res.equipement) message(`${ROBOTS[u.id].nom} s’équipe : ${def.nom}`, true);
        });
    } else rendre(res.effets);
}

function clicObjet(i) {
    if (S.phase !== 'boutique') return;
    S.sel = S.sel?.zone === 'objet' && S.sel.i === i ? null : { zone: 'objet', i };
    rendre();
}

function clicEquipe(j) {
    if (S.phase !== 'boutique') return;
    if (S.sel?.zone === 'objet') return donnerObjet(S.sel.i, j);
    if (S.sel?.zone === 'boutique') return acheter(S.sel.i, j);
    if (S.sel?.zone === 'equipe') return deplacer(S.sel.i, j);
    if (S.equipe[j]) { S.sel = { zone: 'equipe', i: j }; rendre(); }
}

// ---------- Affichage des robots ----------

function statHTML(type, valeur) {
    return `<div class="stat-${type} relative grid aspect-square w-[40%] place-items-center">
        ${type === 'atk' ? ICONE_ATK : ICONE_PV}<span class="n titre contour stat-n relative">${Math.max(0, valeur)}</span></div>`;
}

// Un robot « debout » : niveau au-dessus, ombre au sol, stats en dessous
// Niveau + progression : 2 pastilles pour passer niveau 2, puis 3 pour le niveau 3.
// Tailles relatives au robot (équipe, combat) ou en pixels (ligne palier · niveau · prix de la boutique)
const TAILLES_NIVEAU = { cqw: { rond: '15cqw', texte: '10cqw', pastille: '10cqw' }, px: { rond: '15px', texte: '10px', pastille: '7px' } };
function niveauHTML(u, t = TAILLES_NIVEAU.cqw) {
    const s = seuilsXp();
    const total = u.niveau < 3 ? s[u.niveau] - s[u.niveau - 1] : 0;
    const fait = xpDe(u) - s[u.niveau - 1];
    const chiffre = `<span title="Niveau ${u.niveau}" class="titre grid shrink-0 place-items-center rounded-full leading-none ${u.niveau === 3 ? 'bg-[#ffd23f]' : 'bg-white'}" style="width:${t.rond};height:${t.rond};font-size:${t.texte};border:2px solid ${ENCRE}">${u.niveau}</span>`;
    return chiffre + (total
        ? Array.from({ length: total }, (_, n) => `<span class="shrink-0 rounded-full ${n < fait ? 'bg-[#4be08a]' : 'bg-white/80'}" style="width:${t.pastille};height:${t.pastille};border:2px solid ${ENCRE}"></span>`).join('')
        : `<span class="titre contour leading-none" style="font-size:${t.texte};color:#ffd23f">MAX</span>`);
}

// sansNiveau : en boutique, le niveau est affiché sur la ligne du palier et du prix
function unite(u, { ennemi = false, delai = 0, sansNiveau = false } = {}) {
    const def = ROBOTS[u.id];
    const pips = def.palier && !sansNiveau ? niveauHTML(u) : '';
    return `<div class="unite relative w-full">
        ${sansNiveau ? '' : `<div class="mb-[2%] flex h-[10cqw] items-center justify-center gap-[4%]">${pips}</div>`}
        <div class="relative mx-auto aspect-square ${def.palier ? 'w-full' : 'w-[78%]'}">
            <div class="absolute bottom-[2%] left-1/2 h-[12%] w-[62%] -translate-x-1/2 rounded-[50%] bg-black/25"></div>
            <div class="sprite idle absolute inset-0" style="animation-delay:-${delai.toFixed(2)}s">
                <div class="h-full w-full ${ennemi ? '-scale-x-100' : ''}">${robotSVG(u.id)}</div>
            </div>
            <div class="bouclier ${u.bouclier ? '' : 'hidden'}"></div>
            ${u.objet ? `<div title="${OBJETS[u.objet].nom}" class="absolute -right-[2%] top-[2%] z-10 grid aspect-square w-[34%] place-items-center rounded-full bg-white text-[17cqw] leading-none" style="border:2.5px solid ${ENCRE};box-shadow:0 2px 0 ${ENCRE}">${OBJETS[u.objet].icone}</div>` : ''}
            ${u.temp ? `<div title="Bonus temporaire +${u.temp.a}/+${u.temp.h}" class="absolute -left-[2%] top-[2%] z-10 text-[17cqw] leading-none">💾</div>` : ''}
            <div class="statuts absolute -left-[6%] top-[28%] z-10 flex flex-col gap-[3cqw]">${statutsHTML(u)}</div>
        </div>
        <div class="relative z-10 -mt-[12%] flex justify-center gap-[4%]">${statHTML('atk', u.atk)}${statHTML('hp', u.hp)}</div>
    </div>`;
}

// Petites pastilles de statut (brûlure, gel, rouille) et compteur d'évolution
function statutsHTML(u) {
    const pastilleStatut = (icone, texte, fond, titre) =>
        `<span title="${titre}" class="titre flex items-center gap-[2cqw] rounded-full px-[4cqw] text-[13cqw] leading-tight" style="background:${fond};border:2px solid ${ENCRE}">${icone}${texte ? `<span class="contour">${texte}</span>` : ''}</span>`;
    const html = [];
    if (u.brulure > 0) html.push(pastilleStatut('🔥', u.brulure, '#ffb4a2', `${STATUTS.brulure.nom} : ${STATUTS.brulure.desc(u.brulure)}`));
    if (u.gel) html.push(pastilleStatut('❄️', '', '#bae6fd', `${STATUTS.gel.nom} : ${STATUTS.gel.desc()}`));
    if (u.rouille > 0) html.push(pastilleStatut('🟤', u.rouille, '#e7c9a9', `${STATUTS.rouille.nom} : ${STATUTS.rouille.desc(u.rouille)}`));
    const evo = ROBOTS[u.id].evolution;
    if (evo) html.push(pastilleStatut('🧬', `${u.compteur ?? 0}/${evo}`, '#fff', 'Compteur d’évolution'));
    return html.join('');
}

const LARGEUR = 'w-[clamp(54px,min(17vw,12vh),112px)]';
const LARGEUR_BOUTIQUE = 'w-[clamp(50px,min(15vw,12vh),112px)]';   // un peu plus étroit : jusqu'à 6 robots sur le tapis
const FLECHE = `<div class="fleche titre contour pointer-events-none absolute -top-4 left-1/2 z-20 -translate-x-1/2 text-2xl" style="color:#ffd23f">▼</div>`;
const FLECHE_BOUTIQUE = FLECHE.replace('-top-4', '-top-8');   // plus haut, au-dessus de la ligne palier · niveau · prix

// ---------- Rendu de la boutique ----------

function pastille(icone, valeur, fond, titre) {
    return `<div title="${titre}" class="bloc flex items-center gap-1.5 py-0.5 pl-1 pr-3">
        <span class="grid h-8 w-8 place-items-center rounded-full text-base" style="background:${fond};border:2.5px solid ${ENCRE}">${icone}</span>
        <span class="titre text-xl leading-none">${valeur}</span></div>`;
}

function rendreHUD() {
    const enBoutique = S.phase !== 'combat' && S.phase !== 'resultat';
    const icones = [S.commandant && COMMANDANTS[S.commandant], ...S.modules.map(id => MODULES[id])].filter(Boolean);
    $('#hud').innerHTML = [
        enBoutique ? pastille('🪙', S.credits, '#ffd23f',
            `Crédits · ce qui n’est pas dépensé est gardé (max ${EPARGNE_MAX}) et rapporte +1 par tranche de 5`) : '',
        pastille('❤️', S.vies, '#ff8fa3', 'Vies'),
        pastille('🏆', `${S.victoires}<span class="text-sm opacity-50">/${VICTOIRES_BUT}</span>`, '#ffb547', 'Victoires'),
        pastille('⏱️', `Tour ${S.tour}`, '#7dd3fc', `Palier de boutique ${palierDuTour(S.tour)}`),
        enBoutique && S.tour && estTourBoss(S.tour)
            ? `<div title="Le prochain combat est contre un boss. Victoire = un module en plus !" class="bloc titre boss-alerte px-3 py-1 text-base" style="background:#ff6b6b"><span class="contour">⚠️ BOSS</span></div>` : '',
        icones.length ? `<div class="bloc flex items-center gap-1 px-2 py-0.5">${icones.map(d =>
            `<span title="${d.nom} : ${d.desc}" class="cursor-help text-2xl leading-none">${d.icone}</span>`).join('')}</div>` : '',
    ].join('');
}

function rendreEquipe() {
    // La case 0 est l'avant : on l'affiche à droite, face à l'adversaire
    const ordre = [...Array(TAILLE_EQUIPE).keys()].reverse();
    const selB = S.sel?.zone === 'boutique' ? S.boutique[S.sel.i] : null;
    $('#equipe').innerHTML = ordre.map(j => {
        const u = S.equipe[j];
        const choisi = S.sel?.zone === 'equipe' && S.sel.i === j;
        const etat = choisi ? 'choisi'
            : selB && peutFusionner(u, selB) ? 'fusion'
                : S.sel?.zone === 'objet' ? (u ? 'cible' : '')
                    : S.sel && !u ? 'cible' : '';
        return `<div data-slot="${j}" ${u ? `data-uid="${u.uid}"` : ''} class="emplacement relative cursor-pointer ${LARGEUR}">
            <div class="socle ${etat}"></div>
            ${choisi ? FLECHE : ''}
            <div class="relative pb-[10%]">${u ? unite(u, { delai: j * 0.5 }) : '<div class="aspect-[1/1.42]"></div>'}</div>
        </div>`;
    }).join('');
}

function rendreSynergies() {
    const n = compterFamilles(S.equipe);
    $('#synergies').innerHTML = Object.entries(FAMILLES).map(([id, f]) => {
        const niv = niveauSynergie(n[id]);
        const titre = `${f.nom} : ${SEUILS_SYNERGIE.map((s, i) => `${s} → ${f.bonus[i]}`).join(' · ')}`;
        const seuil = SEUILS_SYNERGIE[Math.min(niv, 1)];
        return `<span data-famille="${id}" tabindex="0" aria-label="${titre}" class="synergie titre flex cursor-help items-center gap-1.5 rounded-full px-3 py-0.5 text-sm"
            style="border:2.5px solid ${ENCRE};background:${niv ? f.couleur : 'rgba(255,255,255,.75)'};${niv ? 'box-shadow:0 3px 0 ' + ENCRE : ''}">
            <span class="${niv ? 'contour' : 'opacity-60'}">${f.nom} ${n[id]}/${seuil}</span>${niv === 2 ? '⭐' : ''}
        </span>`;
    }).join('');
    // Infobulle ouverte : son contenu suit l'équipe
    if (bulleFamille) afficherBulleSynergie(bulleFamille);
}

// ---------- Infobulle des synergies ----------

let bulleFamille = null;

function contenuBulleSynergie(id) {
    const f = FAMILLES[id];
    const n = compterFamilles(S.equipe)[id];
    const niv = niveauSynergie(n);
    const membres = S.equipe.filter(u => u && familles(u).includes(id));
    // Jauge en 4 cases, coupée après la 2e (premier palier)
    const jauge = [1, 2, 3, 4].map(k => `<span class="h-3 flex-1 rounded-full ${k === 2 ? 'mr-1.5' : ''}"
        style="background:${k <= n ? f.couleur : 'rgba(30,27,46,.1)'};border:2px solid ${ENCRE}"></span>`).join('');
    const paliers = SEUILS_SYNERGIE.map((s, i) => {
        const actif = niv > i;
        const manque = s - n;
        return `<div class="flex items-start gap-2 rounded-xl px-2 py-1.5 ${actif ? '' : 'opacity-55'}" style="${actif ? `background:${f.clair}` : ''}">
            <span class="titre grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm" style="background:${actif ? f.couleur : '#fff'};border:2px solid ${ENCRE}">${s}</span>
            <div class="min-w-0 text-sm font-medium leading-snug">${f.bonus[i]}
                <div class="titre text-xs" style="color:${actif ? f.sombre : ENCRE}">${actif ? '✓ Actif' : `Encore ${manque} robot${manque > 1 ? 's' : ''}`}</div>
            </div>
        </div>`;
    }).join('');
    const equipe = membres.length
        ? `<div class="flex flex-wrap gap-1">${membres.map(u => `<span title="${ROBOTS[u.id].nom}" class="h-8 w-8">${robotSVG(u.id)}</span>`).join('')}</div>`
        : '<p class="text-xs font-medium opacity-60">Aucun robot de cette famille dans ton équipe.</p>';
    return `
        <div class="titre flex items-center justify-between gap-3 rounded-t-[14px] px-3 py-1.5 text-lg" style="background:${f.couleur};border-bottom:2.5px solid ${ENCRE}">
            <span class="contour">${f.nom}</span><span class="contour text-base">${n} / ${SEUILS_SYNERGIE[1]}${niv === 2 ? ' ⭐' : ''}</span>
        </div>
        <div class="space-y-2 p-3">
            <div class="flex items-center">${jauge}</div>
            ${paliers}
            <div class="border-t-2 border-dashed pt-2" style="border-color:rgba(30,27,46,.15)">${equipe}</div>
        </div>`;
}

function afficherBulleSynergie(id) {
    const puce = document.querySelector(`#synergies [data-famille="${id}"]`);
    const bulle = $('#bulle-synergie');
    if (!puce) return cacherBulleSynergie();
    bulleFamille = id;
    bulle.innerHTML = contenuBulleSynergie(id) + '<div class="bulle-pointe"></div>';
    bulle.classList.add('visible');
    // Au-dessus de la puce si possible, sinon en dessous ; jamais hors de l'écran
    const r = puce.getBoundingClientRect(), b = bulle.getBoundingClientRect();
    const dessus = r.top - b.height - 12 > 8;
    const x = Math.max(8, Math.min(innerWidth - b.width - 8, r.left + r.width / 2 - b.width / 2));
    bulle.style.left = `${x}px`;
    bulle.style.top = `${dessus ? r.top - b.height - 12 : r.bottom + 12}px`;
    bulle.classList.toggle('dessous', !dessus);
    bulle.querySelector('.bulle-pointe').style.left = `${r.left + r.width / 2 - x}px`;
}

function cacherBulleSynergie() {
    bulleFamille = null;
    $('#bulle-synergie').classList.remove('visible');
}

function rendreBoutique() {
    // Titre : écusson du palier actuel et tour où le suivant arrive
    const p = Math.max(1, palierDuTour(S.tour));
    const suite = p < 6
        ? `<span class="opacity-70">→</span> ${ecussonPalier(p + 1)} <span class="text-sm opacity-80">au tour ${tourDuPalier(p + 1)}</span>`
        : '<span class="text-sm opacity-80">(palier max)</span>';
    $('#titre-boutique').innerHTML = `<span class="inline-flex items-center gap-1.5">Boutique · ${ecussonPalier(p)} palier ${p} ${suite}</span>`;
    $('#boutique').innerHTML = S.boutique.map((u, i) => {
        const sel = S.sel?.zone === 'boutique' && S.sel.i === i;
        const prix = prixRobot(u, S.eff);
        const off = S.credits < prix;
        return `<div data-boutique="${i}" data-uid="${u.uid}" class="article ${u.gele ? 'gele' : ''} relative cursor-pointer transition ${LARGEUR_BOUTIQUE} ${sel ? '-translate-y-3' : ''} ${off ? 'opacity-50 grayscale' : ''}">
            ${sel ? FLECHE_BOUTIQUE : ''}
            <div class="ligne-article mb-1 flex items-center justify-between gap-0.5">${ecussonPalier(ROBOTS[u.id].palier, 'relative')}<span class="niveau-ligne flex items-center gap-[2px]">${niveauHTML(u, TAILLES_NIVEAU.px)}</span>${etiquettePrix(prix, COULEURS_RARETE[ROBOTS[u.id].rarete], RARETES[ROBOTS[u.id].rarete].nom)}</div>
            ${unite(u, { delai: i * 0.37, sansNiveau: true })}${u.gele ? '<div class="glace"></div>' : ''}
        </div>`;
    }).join('') || '<p class="titre contour self-center py-10 text-lg">Tapis vide · relance !</p>';
}

// Palier d'un article : un écusson en chiffres romains, d'une couleur par palier
const COULEURS_PALIER = ['#f1f5f9', '#bbf7d0', '#bae6fd', '#e9d5ff', '#fecaca', '#fde68a', '#f9a8d4'];
const ROMAINS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const tourDuPalier = palier => 2 * palier - 1;
function ecussonPalier(palier, classes = 'relative') {
    const chiffre = ROMAINS[palier - 1];
    return `<span title="Palier ${palier} : débloqué dès le tour ${tourDuPalier(palier)}" class="ecusson ${classes}">
        <svg viewBox="0 0 40 46" class="h-full w-full overflow-visible">
            <path d="M4 5 Q20 1 36 5 V22 C36 33 29 40 20 44 C11 40 4 33 4 22 Z" fill="${COULEURS_PALIER[palier - 1]}" stroke="${ENCRE}" stroke-width="3.5" stroke-linejoin="round"/>
            <path d="M9 9 Q20 6 31 9" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="3" stroke-linecap="round"/>
            <text x="20" y="${chiffre.length > 2 ? 30 : 32}" text-anchor="middle" font-family="'Lilita One', sans-serif" font-size="${chiffre.length > 2 ? 17 : chiffre.length > 1 ? 21 : 24}" letter-spacing="-1" fill="${ENCRE}">${chiffre}</text>
        </svg></span>`;
}

// Prix d'un article ; la couleur donne la rareté
const COULEURS_RARETE = { commun: '#ffffff', rare: '#7dd3fc', epique: '#d8b4fe', legendaire: '#ffd23f', mythique: 'linear-gradient(135deg, #f9a8d4, #ffd23f)' };
function etiquettePrix(prix, fond, titre) {
    return `<div title="${titre} · ${prix} 🪙" class="prix titre pointer-events-none relative flex items-center gap-0.5 rounded-full px-1.5 text-sm leading-tight"
        style="background:${fond};border:2.5px solid ${ENCRE};box-shadow:0 2px 0 ${ENCRE}">${prix}<span class="text-xs">🪙</span></div>`;
}

function rendreObjets() {
    const prix = prixObjet(S.eff);
    $('#objets').innerHTML = S.objets.map((o, i) => {
        const sel = S.sel?.zone === 'objet' && S.sel.i === i;
        const off = S.credits < prix;
        return `<div data-objet="${i}" title="${OBJETS[o.id].nom}" class="article ${o.gele ? 'gele' : ''} unite relative cursor-pointer transition w-[clamp(44px,min(12vw,9vh),84px)] ${sel ? '-translate-y-3' : ''} ${off ? 'opacity-50 grayscale' : ''}">
            ${sel ? FLECHE_BOUTIQUE : ''}
            <div class="ligne-article mb-1 flex items-center justify-between gap-0.5">${ecussonPalier(OBJETS[o.id].palier, 'relative')}${etiquettePrix(prix, '#fff', OBJETS[o.id].nom)}</div>
            <div class="relative mb-[30%] grid aspect-square place-items-center">
                <div class="absolute bottom-[4%] left-1/2 h-[14%] w-[62%] -translate-x-1/2 rounded-[50%] bg-black/25"></div>
                <span class="sprite idle relative text-[62cqw] leading-none drop-shadow-[0_3px_0_rgba(30,27,46,.35)]" style="animation-delay:-${i * 0.6}s">${OBJETS[o.id].icone}</span>
            </div>
            ${o.gele ? '<div class="glace"></div>' : ''}

        </div>`;
    }).join('');
}

function rendreDetail() {
    const u = survol ?? articleChoisi() ?? (S.sel?.zone === 'equipe' ? S.equipe[S.sel.i] : null);
    const el = $('#detail');
    if (u?.estObjet) {
        const def = OBJETS[u.id];
        el.className = 'bloc flex min-h-[4.5rem] w-full max-w-lg items-center gap-3 px-3 py-2 text-sm';
        el.innerHTML = `
            <div class="grid h-12 w-12 shrink-0 place-items-center text-4xl">${def.icone}</div>
            <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-x-2">
                    <b class="titre text-lg leading-tight">${def.nom}</b>
                    <span class="titre rounded-full px-2 text-xs" style="background:${def.equipement ? '#ffb547' : '#4be08a'};border:2px solid ${ENCRE}"><span class="contour">${def.equipement ? 'Équipement' : 'Consommable'}</span></span>
                    ${ecussonPalier(def.palier, 'relative')}${u.gele ? '<span class="text-xs font-medium opacity-60">❄ gelé</span>' : ''}
                </div>
                <p class="font-medium leading-snug">${def.desc}</p>
            </div>`;
        return;
    }
    if (!u) {
        el.className = 'bloc flex min-h-[4.5rem] w-full max-w-lg items-center justify-center px-4 text-center text-sm font-medium opacity-80';
        el.textContent = S.equipe.some(Boolean)
            ? 'Survole un robot pour voir sa capacité. Glisse-le pour le placer, l’échanger ou le fusionner.'
            : 'Clique sur un robot du tapis puis sur un socle de ton équipe (ou glisse-le).';
        return;
    }
    const def = ROBOTS[u.id];
    const puces = familles(u).map(f => `<span class="titre rounded-full px-2 text-xs" style="background:${FAMILLES[f].couleur};border:2px solid ${ENCRE}"><span class="contour">${FAMILLES[f].nom}</span></span>`).join('');
    el.className = 'bloc flex min-h-[4.5rem] w-full max-w-lg items-center gap-3 px-3 py-2 text-sm';
    el.innerHTML = `
        <div class="h-12 w-12 shrink-0">${robotSVG(u.id)}</div>
        <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-x-2">
                <b class="titre text-lg leading-tight">${def.nom}</b>${puces}
                ${ecussonPalier(def.palier, 'relative')}<span class="text-xs font-medium opacity-60">Niv ${u.niveau}${u.niveau < 3 ? ` · ${xpDe(u) - seuilsXp()[u.niveau - 1]}/${seuilsXp()[u.niveau] - seuilsXp()[u.niveau - 1]} vers le niv ${u.niveau + 1}` : ' · max'}${u.gele ? ' · ❄ gelé' : ''}${def.evolution ? ` · évolution ${u.compteur ?? 0}/${def.evolution}` : ''}</span>
            </div>
            <p class="font-medium leading-snug">${def.desc(u.niveau)}</p>
            ${u.objet ? `<p class="text-xs font-medium opacity-70">${OBJETS[u.objet].icone} ${OBJETS[u.objet].desc}</p>` : ''}
            ${u.temp ? `<p class="text-xs font-medium opacity-70">💾 +${u.temp.a}/+${u.temp.h} pour le prochain combat</p>` : ''}
        </div>`;
}

function rendreActions() {
    const v = $('#btn-vendre');
    const u = S.sel?.zone === 'equipe' ? S.equipe[S.sel.i] : null;
    v.disabled = !u;
    v.innerHTML = `<span class="contour">${u ? `Vendre +${u.niveau + (S.eff.venteBonus ?? 0)}<span class="hidden sm:inline"> 🪙</span>` : 'Vendre'}</span>`;
    const r = $('#btn-relancer');
    r.disabled = S.credits < PRIX_RELANCE && !S.relances;
    // Sur téléphone, seuls l'icône et le prix restent visibles
    r.innerHTML = `<span class="contour">🔄<span class="hidden sm:inline"> Relancer</span> · ${S.relances ? 'gratuit' : PRIX_RELANCE}</span>`;
    const g = $('#btn-geler'), a = articleChoisi();
    g.disabled = !a;
    g.innerHTML = `<span class="contour">❄<span class="hidden sm:inline"> ${a?.gele ? 'Dégeler' : 'Geler'}</span></span>`;
    g.setAttribute('aria-label', a?.gele ? 'Dégeler' : 'Geler');
    g.title = 'Garde l’article sur le tapis au prochain tour (F ou clic droit)';
}

function rendre(effets = [], flash = null) {
    rendreHUD();
    rendreEquipe();
    rendreSynergies();
    rendreBoutique();
    rendreObjets();
    rendreDetail();
    rendreActions();
    alignerSol();
    // Petits effets sur l'équipe : bonus reçus, robot qui arrive, fusion, montée de niveau
    const evolues = new Set(effets.filter(e => e.evolution).map(e => e.uid));
    for (const { uid, a, h, compteur, evolution, deplace, festin } of effets) {
        const sp = document.querySelector(`#equipe [data-uid="${uid}"] .sprite`);
        if (!sp) continue;
        const c = centreEcran(sp);
        if (festin) {
            // Synergie Cuisiniers : un gros plat tombe sur le robot, bien distinct d'une Batterie cuisinée
            sp.animate([{ transform: 'none' }, { transform: 'translateY(-14%) scale(1.12)' }, { transform: 'none' }], { duration: 450, easing: 'ease-out' });
            flotter('🍗', '#ffa94d', c.x, c.y - 70, 36, 1300);
            flotter('Festin +1/+1', '#ffa94d', c.x, c.y - 32, 20, 1400);
            etincelles(c.x, c.y, ['#ffa94d', '#ffd23f', '#fff'], 14, 60);
            rebond(sp.closest('.unite').querySelector('.stat-atk'));
            rebond(sp.closest('.unite').querySelector('.stat-hp'));
        } else if (evolution) {
            // Évolution : flash, gros texte et pluie d'étincelles
            sp.animate([{ transform: 'scale(.4) rotate(-20deg)', filter: 'brightness(3)' }, { transform: 'scale(1.25) rotate(6deg)', filter: 'brightness(1.6)', offset: .6 }, { transform: 'none', filter: 'none' }],
                { duration: 700, easing: 'ease-out' });
            anneau(c);
            flotter('ÉVOLUTION !', '#b67cff', c.x, c.y - 60, 30, 1500);
            etincelles(c.x, c.y, ['#b67cff', '#ffd23f', '#4be08a', '#fff'], 18, 80);
        } else if (deplace) {
            // Grue : le robot est soulevé puis reposé à sa nouvelle place
            sp.animate([{ transform: 'translateY(-60%) rotate(-8deg)' }, { transform: 'translateY(5%) scale(1.1,.9)', offset: .75 }, { transform: 'none' }],
                { duration: 450, easing: 'ease-out' });
            flotter('🏗️', '#ffd23f', c.x, c.y - 70, 26, 800);
        } else if (compteur && !evolues.has(uid)) {
            flotter(`🧬 ${compteur}/${ROBOTS[S.equipe.find(u => u?.uid === uid)?.id]?.evolution ?? '?'}`, '#b67cff', c.x, c.y - 30, 20, 1000);
        } else if (a !== undefined || h !== undefined) {
            flotter(texteBuff(a, h), '#4be08a', c.x, c.y - 20);
            etincelles(c.x, c.y, ['#4be08a', '#fff'], 6);
            rebond(sp.closest('.unite').querySelector(a ? '.stat-atk' : '.stat-hp'));
        }
    }
    if (flash) {
        const sp = document.querySelector(`#equipe [data-uid="${flash.uid}"] .sprite`);
        if (!sp) return;
        sp.animate([{ transform: 'translateY(-45%) scale(.7)' }, { transform: 'translateY(4%) scale(1.15,.85)', offset: .7 }, { transform: 'none' }],
            { duration: 380, easing: 'ease-out' });
        const c = centreEcran(sp);
        etincelles(c.x, c.y, flash.fusion ? ['#ffd23f', '#4be08a', '#fff'] : ['#fff', '#7dd3fc'], flash.fusion ? 14 : 6);
        if (flash.niveau) flotter(`NIVEAU ${flash.niveau} !`, '#ffd23f', c.x, c.y - 50, 30, 1300);
    }
}

function texteBuff(a, h) {
    if (a && h) return `${a > 0 ? '+' : ''}${a}/${h > 0 ? '+' : ''}${h}`;
    if (a) return `${a > 0 ? '+' : ''}${a} ⚡`;
    return `${h > 0 ? '+' : ''}${h} ❤`;
}

// ---------- Effets visuels (calque fixe au-dessus de tout) ----------

const calque = $('#effets');

function centreEcran(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function flotter(texte, couleur, x, y, taille = 24, duree = 900) {
    const b = document.createElement('div');
    b.className = 'flottant titre contour';
    b.textContent = texte;
    b.style.cssText = `left:${x}px;top:${y}px;font-size:${taille}px;color:${couleur}`;
    calque.appendChild(b);
    b.animate([
        { transform: 'translate(-50%, -50%) scale(.3)', opacity: 0 },
        { transform: 'translate(-50%, -80%) scale(1.25)', opacity: 1, offset: .2 },
        { transform: 'translate(-50%, -100%) scale(1)', opacity: 1, offset: .6 },
        { transform: 'translate(-50%, -160%) scale(.9)', opacity: 0 },
    ], { duration: duree / vitesse, easing: 'ease-out' }).onfinish = () => b.remove();
}

function etincelles(x, y, couleurs, n = 8, rayon = 55) {
    for (let i = 0; i < n; i++) {
        const e = document.createElement('div');
        const t = hasard(6, 11);
        e.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${t}px;height:${t}px;border-radius:50%;background:${couleurs[i % couleurs.length]};border:2px solid ${ENCRE}`;
        calque.appendChild(e);
        const a = (Math.PI * 2 * i) / n + hasard(-.3, .3), r = rayon * hasard(.6, 1.2);
        e.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
            { transform: `translate(calc(-50% + ${Math.cos(a) * r}px), calc(-50% + ${Math.sin(a) * r}px)) scale(.2)`, opacity: 0 },
        ], { duration: hasard(450, 700) / vitesse, easing: 'cubic-bezier(.2,.8,.4,1)' }).onfinish = () => e.remove();
    }
}

function rebond(el) {
    el?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }, { transform: 'scale(1)' }],
        { duration: 300 / vitesse, easing: 'cubic-bezier(.3,1.6,.6,1)' });
}

// Un objet qui vole en cloche de la boutique jusqu'à un robot
function lancer(icone, de, vers, fin) {
    const e = document.createElement('div');
    e.textContent = icone;
    e.style.cssText = 'position:absolute;left:0;top:0;font-size:40px;line-height:1;filter:drop-shadow(0 3px 0 rgba(30,27,46,.4))';
    calque.appendChild(e);
    const haut = Math.min(de.y, vers.y) - 80;
    e.animate([
        { transform: `translate(${de.x - 20}px, ${de.y - 20}px) scale(1) rotate(0)` },
        { transform: `translate(${(de.x + vers.x) / 2 - 20}px, ${haut}px) scale(1.3) rotate(-20deg)` },
        { transform: `translate(${vers.x - 20}px, ${vers.y - 20}px) scale(.5) rotate(10deg)` },
    ], { duration: 420, easing: 'ease-in-out' }).onfinish = () => { e.remove(); fin(); };
}

// ---------- Combat ----------

const arene = $('#arene');
let pions = new Map();
let vitesse = 1;
let passer = false;
let etapesCourantes = [];
const D = ms => ms / vitesse;

let placesParCamp = TAILLE_EQUIPE;   // plus de 5 robots possible avec l'Essaim primordial
function dimensions() {
    const W = arene.clientWidth;
    // Les robots prennent toute la place disponible, en largeur comme en hauteur
    const largeur = Math.min(190, (W - 16) / (2 * placesParCamp + 0.4), arene.clientHeight * 0.55);
    return { W, largeur, ecart: largeur * 0.45 };
}

function positionX(camp, i) {
    const { W, largeur, ecart } = dimensions();
    return camp === 0 ? W / 2 - ecart / 2 - (i + 1) * largeur : W / 2 + ecart / 2 + i * largeur;
}

function placer(p, camp, i, instant) {
    const { largeur } = dimensions();
    p.style.width = `${largeur * 0.94}px`;
    p.style.transition = instant ? 'none' : `transform ${D(340)}ms cubic-bezier(.3,1.25,.6,1)`;
    p.style.transform = `translateX(${positionX(camp, i) + largeur * 0.03}px)`;
}

function creerPion(u, camp) {
    const p = document.createElement('div');
    p.className = 'pion';
    p.dataset.camp = camp;
    p.dataset.id = u.id;
    if (ROBOTS[u.id].boss) p.dataset.boss = '';
    p.innerHTML = `<div class="interne">${unite(u, { ennemi: camp === 1, delai: Math.random() * 2 })}</div>`;
    arene.appendChild(p);
    pions.set(u.uid, p);
    return p;
}

function majStats(p, u, animer) {
    for (const [cls, v] of [['.stat-atk', u.atk], ['.stat-hp', u.hp]]) {
        const el = p.querySelector(cls), n = el.querySelector('.n');
        const txt = String(Math.max(0, v));
        if (n.textContent !== txt) { n.textContent = txt; if (animer) rebond(el); }
    }
    const b = p.querySelector('.bouclier');
    const avait = !b.classList.contains('hidden');
    b.classList.toggle('hidden', !u.bouclier);
    if (animer && u.bouclier && !avait) b.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: D(300) });
    // Statuts : on ne réécrit que si quelque chose a changé
    const statuts = statutsHTML(u), s = p.querySelector('.statuts');
    if (s.innerHTML !== statuts) s.innerHTML = statuts;
    // Robot en feu ou gelé : teinte sur le sprite
    sprite(p).style.filter = u.gel ? 'saturate(.4) brightness(1.15) hue-rotate(160deg)' : '';
}

const sens = p => (p.dataset.camp === '0' ? 1 : -1);
const sprite = p => p.querySelector('.sprite');

function charge(p) {
    const s = sens(p);
    p.firstChild.animate([
        { transform: 'none' },
        { transform: `translateX(${-16 * s}%) rotate(${-10 * s}deg) scale(.94, 1.06)`, offset: .32 },
        { transform: `translateX(${46 * s}%) rotate(${8 * s}deg) scale(1.1, .92)`, offset: .58 },
        { transform: `translateX(${30 * s}%) rotate(${4 * s}deg)`, offset: .68 },
        { transform: 'none' },
    ], { duration: D(500), easing: 'ease-in-out' });
}

function touche(p, n) {
    const s = sens(p);
    sprite(p).animate([{ filter: 'brightness(1)' }, { filter: 'brightness(3) saturate(0)' }, { filter: 'brightness(1)' }], { duration: D(220) });
    p.firstChild.animate([{ transform: 'none' }, { transform: `translateX(${-14 * s}%) rotate(${-12 * s}deg)` }, { transform: 'none' }],
        { duration: D(320), easing: 'cubic-bezier(.3,1.4,.6,1)' });
    const c = centreEcran(sprite(p));
    flotter(`-${n}`, '#ff4d6d', c.x + hasard(-10, 10), c.y - 10, Math.min(48, 26 + n * 2), 950);
    if (n >= 5) tremblement(Math.min(14, 4 + n));
}

function boum(a, b) {
    const ca = centreEcran(sprite(a)), cb = centreEcran(sprite(b));
    const x = (ca.x + cb.x) / 2, y = (ca.y + cb.y) / 2 - 10;
    const e = document.createElement('div');
    e.className = 'flottant';
    const t = Math.max(96, dimensions().largeur * 0.95);
    e.style.cssText = `left:${x}px;top:${y}px;width:${t}px;height:${t}px;font-size:${t / 4.5}px`;
    const pics = Array.from({ length: 24 }, (_, i) => {
        const r = i % 2 ? 22 : 46, ang = (Math.PI * 2 * i) / 24;
        return `${(50 + Math.cos(ang) * r).toFixed(1)},${(50 + Math.sin(ang) * r).toFixed(1)}`;
    }).join(' ');
    e.innerHTML = `<svg viewBox="0 0 100 100" class="absolute inset-0 overflow-visible"><polygon points="${pics}" fill="#ffd23f" stroke="${ENCRE}" stroke-width="4" stroke-linejoin="round"/><polygon points="${pics}" fill="#fff" transform="translate(50 50) scale(.45) translate(-50 -50)"/></svg>
        <span class="titre contour absolute inset-0 grid place-items-center" style="transform:rotate(-8deg)">${ONOMATOPEES[Math.floor(Math.random() * ONOMATOPEES.length)]}</span>`;
    calque.appendChild(e);
    e.animate([
        { transform: 'translate(-50%, -50%) scale(.2) rotate(-20deg)', opacity: 1 },
        { transform: 'translate(-50%, -50%) scale(1.15) rotate(0deg)', opacity: 1, offset: .35 },
        { transform: 'translate(-50%, -50%) scale(1) rotate(4deg)', opacity: 1, offset: .7 },
        { transform: 'translate(-50%, -50%) scale(.6) rotate(8deg)', opacity: 0 },
    ], { duration: D(480), easing: 'ease-out' }).onfinish = () => e.remove();
    etincelles(x, y, ['#ffd23f', '#ff9f1c', '#fff'], 8, 70);
    tremblement(5);
    // Petit coup de zoom de la caméra sur le point d'impact
    const vue = $('#vue-combat');
    vue.style.transformOrigin = `${x}px ${y - vue.getBoundingClientRect().top}px`;
    vue.animate([{ transform: 'none' }, { transform: 'scale(1.045)', offset: .3 }, { transform: 'none' }],
        { duration: D(380), easing: 'ease-out' });
}

function tremblement(force) {
    arene.animate([
        { transform: 'none' },
        { transform: `translate(${-force}px, ${force / 2}px)` },
        { transform: `translate(${force * .8}px, ${-force / 2}px)` },
        { transform: `translate(${-force / 2}px, ${force / 3}px)` },
        { transform: 'none' },
    ], { duration: D(260) });
}

const COULEURS_EFFET = { buff: '#4be08a', bouclierGagne: '#4cc3ff', brulure: '#ff7a3d', gel: '#7dd3fc', rouille: '#b07a4a', soin: '#ff8fab',
    nettoye: '#b67cff', immunise: '#ff8fab' };

// Soin : petites croix roses qui montent, PV qui rebondissent
function soigne(p, n) {
    sprite(p).animate([{ filter: 'none' }, { filter: 'drop-shadow(0 0 10px #ff8fab) brightness(1.25)' }, { filter: 'none' }], { duration: D(450) });
    const c = centreEcran(sprite(p));
    flotter(`+${n} ✚`, '#ff8fab', c.x, c.y - 20, 26, 950);
    for (let i = 0; i < 5; i++) {
        const e = document.createElement('div');
        e.textContent = '✚';
        e.className = 'titre contour';
        e.style.cssText = `position:absolute;left:${c.x + hasard(-30, 30)}px;top:${c.y + hasard(-5, 25)}px;font-size:${hasard(14, 22)}px;color:#ff8fab`;
        calque.appendChild(e);
        e.animate([{ transform: 'translate(-50%,-50%) scale(.5)', opacity: 1 }, { transform: `translate(-50%, calc(-50% - ${hasard(35, 65)}px)) scale(1)`, opacity: 0 }],
            { duration: D(hasard(500, 750)), easing: 'ease-out' }).onfinish = () => e.remove();
    }
}

// Réanimation : le robot se relève dans un halo
function releve(p) {
    const c = centreEcran(sprite(p));
    p.firstChild.animate([{ transform: 'translateY(30%) rotate(-60deg) scale(.5)', opacity: 0 }, { transform: 'translateY(-12%) scale(1.15)', opacity: 1, offset: .6 }, { transform: 'none' }],
        { duration: D(600), easing: 'ease-out' });
    anneau(c);
    flotter('RANIMÉ !', '#ff8fab', c.x, c.y - 60, 26, 1100);
    etincelles(c.x, c.y, ['#ff8fab', '#fff', '#ffe3ea'], 14, 70);
}

// Dégâts de brûlure : flammes au lieu du choc
function brule(p, n) {
    sprite(p).animate([{ filter: 'none' }, { filter: 'sepia(1) saturate(4) hue-rotate(-20deg) brightness(1.2)' }, { filter: 'none' }], { duration: D(360) });
    const c = centreEcran(sprite(p));
    flotter(`🔥-${n}`, '#ff7a3d', c.x, c.y - 10, 28, 900);
    for (let i = 0; i < 6; i++) {
        const e = document.createElement('div');
        e.textContent = '🔥';
        e.style.cssText = `position:absolute;left:${c.x + hasard(-25, 25)}px;top:${c.y + hasard(0, 25)}px;font-size:${hasard(12, 20)}px`;
        calque.appendChild(e);
        e.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 1 }, { transform: `translate(-50%, calc(-50% - ${hasard(30, 60)}px)) scale(1.1)`, opacity: 0 }],
            { duration: D(hasard(450, 700)), easing: 'ease-out' }).onfinish = () => e.remove();
    }
}

// Un statut vient d'être appliqué
function afficherStatut(p, nom, valeur) {
    const c = centreEcran(sprite(p));
    const textes = { brulure: `🔥 Brûlure ${valeur}`, gel: '❄️ Gelé !', rouille: `🟤 Rouille ${valeur}` };
    flotter(textes[nom], COULEURS_EFFET[nom], c.x, c.y - 30, 20, 1000);
    etincelles(c.x, c.y, [COULEURS_EFFET[nom], '#fff'], 8, 45);
    if (nom === 'gel') sprite(p).animate([{ transform: 'none' }, { transform: 'scale(1.08, .92)' }, { transform: 'none' }], { duration: D(300) });
}

// Boule d'énergie qui part d'un robot vers sa cible (capacités)
function projectile(src, cible, couleur) {
    orbe(centreEcran(sprite(src)), centreEcran(sprite(cible)), couleur);
}

// Boule d'énergie qui vole en cloche du point a au point b
function orbe(a, b, couleur) {
    const e = document.createElement('div');
    e.style.cssText = `position:absolute;left:0;top:0;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,${couleur} 60%);border:2.5px solid ${ENCRE};box-shadow:0 0 14px ${couleur}`;
    calque.appendChild(e);
    const hauteur = Math.max(40, Math.abs(b.x - a.x) * 0.35);
    e.animate([
        { transform: `translate(${a.x - 9}px, ${a.y - 9}px) scale(.5)` },
        { transform: `translate(${(a.x + b.x) / 2 - 9}px, ${Math.min(a.y, b.y) - hauteur - 9}px) scale(1.2)` },
        { transform: `translate(${b.x - 9}px, ${b.y - 9}px) scale(.9)` },
    ], { duration: D(320), easing: 'ease-in-out' }).onfinish = () => { e.remove(); etincelles(b.x, b.y, [couleur, '#fff'], 6, 35); };
}

function declenche(p) {
    p.firstChild.animate([{ transform: 'none' }, { transform: 'translateY(-16%) scale(1.08)' }, { transform: 'none' }],
        { duration: D(320), easing: 'cubic-bezier(.3,1.5,.6,1)' });
    const c = centreEcran(sprite(p));
    anneau(c);
    flotter('!', '#ffd23f', c.x + 22, c.y - 38, 30, 600);
}

// Onde jaune autour d'un robot dont la capacité se déclenche
function anneau(c) {
    const e = document.createElement('div');
    e.style.cssText = `position:absolute;left:${c.x}px;top:${c.y}px;width:20px;height:20px;border-radius:50%;border:4px solid #ffd23f;box-shadow:0 0 12px #ffd23f`;
    calque.appendChild(e);
    e.animate([{ transform: 'translate(-50%,-50%) scale(.5)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(5)', opacity: 0 }],
        { duration: D(480), easing: 'ease-out' }).onfinish = () => e.remove();
}

// Capacités « fin du tour », de l'avant vers l'arrière, jouées une par une dans la boutique avant le combat
async function finDeTour() {
    const spriteDe = uid => document.querySelector(`#equipe [data-uid="${uid}"] .sprite`);
    // Liste figée au départ : la Grue peut changer l'ordre de l'équipe en cours de route
    for (const u of S.equipe.filter(Boolean)) {
        const i = S.equipe.indexOf(u);
        if (i < 0 || !ROBOTS[u.id].finTour) continue;
        const sp = spriteDe(u.uid);
        const c = sp && centreEcran(sp);
        if (sp) {
            sp.animate([{ transform: 'none' }, { transform: 'translateY(-18%) scale(1.1)' }, { transform: 'none' }],
                { duration: 380, easing: 'cubic-bezier(.3,1.5,.6,1)' });
            anneau(c);
            flotter('Fin du tour !', '#ffd23f', c.x, c.y - 70, 20, 1000);
        }
        await attendre(350);
        const effets = declencherBoutique('finTour', S.equipe, i);
        const plats = effets.filter(e => e.plat);
        if (plats.length && c) {
            // Cuisiniers : chaque plat vole du cuisinier jusqu'au robot servi
            flotter('Bon appétit !', '#ffa94d', c.x, c.y - 40, 20, 900);
            for (const e of plats) {
                const cible = spriteDe(e.uid);
                if (cible) lancer(OBJETS[e.plat].icone, c, centreEcran(cible), () => {});
                await attendre(200);
            }
            await attendre(300);
        } else {
            for (const e of effets) {
                if (e.a === undefined && e.h === undefined) continue;
                const cible = spriteDe(e.uid);
                if (c && cible) orbe(c, centreEcran(cible), '#4be08a');
            }
            if (effets.length) await attendre(D(320));
            // Tirage raté (cuisiniers à chance) : rien ne se passe ce tour-ci
            else if (c && familles(u).includes('cuisine')) flotter('Raté… 🎲', '#e2e8f0', c.x, c.y - 40, 18, 800);
        }
        rendre(effets);
        await attendre(500);
    }
}

function renforce(p, a, h) {
    sprite(p).animate([{ filter: 'none' }, { filter: 'drop-shadow(0 0 10px #4be08a) brightness(1.3)' }, { filter: 'none' }], { duration: D(450) });
    const c = centreEcran(sprite(p));
    flotter(texteBuff(a, h), a < 0 ? '#ff4d6d' : '#4be08a', c.x, c.y - 24);
    if (a >= 0) etincelles(c.x, c.y, ['#4be08a', '#fff'], 6, 40);
}

function apparition(p) {
    p.firstChild.animate([{ transform: 'scale(0) translateY(30%)' }, { transform: 'scale(1.2, .85)', offset: .6 }, { transform: 'none' }],
        { duration: D(420), easing: 'ease-out' });
    requestAnimationFrame(() => {
        const c = centreEcran(sprite(p));
        etincelles(c.x, c.y + 20, ['#fff', '#e2e8f0'], 8, 45);
    });
}

// Explosion en boulons et engrenages
function exploser(p) {
    const c = centreEcran(sprite(p));
    const couleur = FAMILLES[famille({ id: p.dataset.id })]?.couleur ?? '#94a3b8';
    for (let i = 0; i < 9; i++) {
        const d = document.createElement('div');
        const emoji = i < 3;
        d.style.cssText = emoji
            ? `position:absolute;left:${c.x}px;top:${c.y}px;font-size:${hasard(14, 22)}px`
            : `position:absolute;left:${c.x}px;top:${c.y}px;width:${hasard(8, 14)}px;height:${hasard(6, 12)}px;background:${i % 2 ? couleur : '#94a3b8'};border:2px solid ${ENCRE};border-radius:3px`;
        if (emoji) d.textContent = i % 2 ? '🔩' : '⚙️';
        calque.appendChild(d);
        const vx = hasard(-110, 110), vy = hasard(-120, -50);
        d.animate([
            { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
            { transform: `translate(calc(-50% + ${vx * .6}px), calc(-50% + ${vy}px)) rotate(${hasard(-200, 200)}deg)`, opacity: 1, offset: .45 },
            { transform: `translate(calc(-50% + ${vx}px), calc(-50% + ${vy + 140}px)) rotate(${hasard(-400, 400)}deg)`, opacity: 0 },
        ], { duration: D(hasard(650, 900)), easing: 'cubic-bezier(.3,.6,.6,1)' }).onfinish = () => d.remove();
    }
    const flash = document.createElement('div');
    flash.style.cssText = `position:absolute;left:${c.x}px;top:${c.y}px;width:30px;height:30px;border-radius:50%;background:#fff;box-shadow:0 0 30px #ffd23f`;
    calque.appendChild(flash);
    flash.animate([{ transform: 'translate(-50%,-50%) scale(.5)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(3.5)', opacity: 0 }],
        { duration: D(350) }).onfinish = () => flash.remove();
    p.firstChild.animate([
        { transform: 'none', opacity: 1 },
        { transform: `translateY(-20%) rotate(${-25 * sens(p)}deg) scale(1.1)`, opacity: 1, offset: .3 },
        { transform: `translateY(30%) rotate(${-70 * sens(p)}deg) scale(.4)`, opacity: 0 },
    ], { duration: D(380), easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => p.remove(), D(400));
    tremblement(4);
}

// Applique une étape : positions, stats, puis effets visuels
function appliquerEtape(etape, index, animer = true) {
    const presents = new Set();
    // Les cibles d'une capacité ne changent qu'à l'arrivée du projectile
    const retardes = new Set();
    if (animer) for (const f of etape.fx) if (f.src && f.src !== f.uid && pions.has(f.src)) retardes.add(f.uid);

    etape.eq.forEach((equipe, camp) => equipe.forEach((u, i) => {
        presents.add(u.uid);
        let p = pions.get(u.uid);
        if (!p) {
            p = creerPion(u, camp);
            if (index === 0 && animer) {
                // Entrée en scène depuis les bords
                const { W, largeur } = dimensions();
                p.style.transition = 'none';
                p.style.transform = `translateX(${camp === 0 ? -largeur * 1.6 : W + largeur * 0.6}px)`;
                setTimeout(() => placer(p, camp, i, false), D(80 + i * 90));
                return;
            }
            placer(p, camp, i, true);
            if (animer) apparition(p);
        } else placer(p, camp, i, !animer);
        if (retardes.has(u.uid)) setTimeout(() => majStats(p, u, true), D(320));
        else majStats(p, u, animer);
    }));

    for (const [uid, p] of pions) {
        if (presents.has(uid)) continue;
        pions.delete(uid);
        if (animer) exploser(p); else p.remove();
    }
    if (!animer) return;

    const frappes = [];
    for (const f of etape.fx) {
        const p = pions.get(f.uid);
        if (!p) continue;
        const src = f.src && f.src !== f.uid ? pions.get(f.src) : null;
        if (src && f.type !== 'capacite') projectile(src, p, COULEURS_EFFET[f.statut ?? f.type] ?? '#ff9f1c');
        const agir = () => {
            if (!p.isConnected) return;
            switch (f.type) {
                case 'attaque': charge(p); break;
                case 'degat': f.cause === 'brulure' ? brule(p, f.valeur) : touche(p, f.valeur); break;
                case 'statut': afficherStatut(p, f.statut, f.valeur); break;
                case 'degel': {
                    const c = centreEcran(sprite(p));
                    flotter('❄️ Gelé, raté !', '#7dd3fc', c.x, c.y - 40, 20, 900);
                    etincelles(c.x, c.y, ['#e0f2fe', '#7dd3fc', '#fff'], 10, 50);
                    break;
                }
                case 'soin': soigne(p, f.valeur); break;
                case 'ranime': releve(p); break;
                case 'prevu': {
                    // Synergie IA : bouclier violet et « Prévu ! » sur le robot qui ne prend pas le coup
                    const c = centreEcran(sprite(p));
                    flotter('🔮 Prévu !', '#b67cff', c.x, c.y - 44, 24, 1000);
                    etincelles(c.x, c.y, ['#b67cff', '#ecdcff', '#fff'], 12, 55);
                    sprite(p).animate([{ filter: 'none' }, { filter: 'drop-shadow(0 0 12px #b67cff) brightness(1.3)' }, { filter: 'none' }], { duration: D(450) });
                    break;
                }
                case 'nettoye': {
                    const c = centreEcran(sprite(p));
                    flotter('✨ Nettoyé', '#b67cff', c.x, c.y - 34, 20, 900);
                    etincelles(c.x, c.y, ['#b67cff', '#fff', '#ecdcff'], 10, 50);
                    break;
                }
                case 'vaccine': {
                    const c = centreEcran(sprite(p));
                    flotter('💉', '#ff8fab', c.x, c.y - 40, 24, 800);
                    break;
                }
                case 'immunise': {
                    const c = centreEcran(sprite(p));
                    flotter('💉 Immunisé !', '#ff8fab', c.x, c.y - 34, 20, 950);
                    etincelles(c.x, c.y, ['#ff8fab', '#fff'], 8, 45);
                    break;
                }
                case 'bouclier': {
                    p.querySelector('.bouclier').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)', filter: 'brightness(2)' }, { transform: 'scale(1)' }], { duration: D(300) });
                    const c = centreEcran(sprite(p));
                    flotter(`🛡 -${f.valeur}`, '#7dd3fc', c.x, c.y - 20);
                    break;
                }
                case 'bouclierGagne': {
                    const c = centreEcran(sprite(p));
                    flotter(`🛡 +${f.valeur}`, '#7dd3fc', c.x, c.y - 24);
                    break;
                }
                case 'buff': renforce(p, f.a, f.h); break;
                case 'capacite': declenche(p); break;
            }
        };
        if (src) setTimeout(agir, D(320)); else agir();
        if (f.type === 'degat' && !src && !f.cause) frappes.push(p);
    }
    // Choc entre les deux robots de tête
    if (frappes.length === 2) boum(frappes[0], frappes[1]);
}

async function combattre() {
    if (S.phase !== 'boutique') return;
    if (!S.equipe.some(Boolean)) return message('Ton équipe est vide !');
    S.phase = 'finTour';
    S.sel = null;
    survol = null;
    $('#actions-boutique').classList.add('pointer-events-none', 'opacity-60');
    rendre();
    await finDeTour();
    $('#actions-boutique').classList.remove('pointer-events-none', 'opacity-60');
    S.phase = 'combat';
    // Les crédits non dépensés sont gardés pour le tour suivant
    S.epargne = Math.min(EPARGNE_MAX, S.credits);

    const boss = estTourBoss(S.tour);
    const adversaire = boss ? genererBoss(S.tour) : genererAdversaire(S.tour);
    const { resultat, etapes } = simulerCombat(S.equipe, adversaire, Math.random, S.eff.combat);
    placesParCamp = Math.max(TAILLE_EQUIPE, ...etapes.flatMap(e => e.eq.map(t => t.length)));
    retirerTemporaires(S.equipe);
    etapesCourantes = etapes;

    basculerVue(true);
    $('#btn-continuer').classList.add('hidden');
    $('#btn-passer').classList.remove('hidden');
    $('#btn-vitesse').classList.remove('hidden');
    $('#nom-adversaire').textContent = boss ? `👑 BOSS · ${ROBOTS[adversaire[0].id].nom}` : NOMS_ADVERSES[Math.floor(Math.random() * NOMS_ADVERSES.length)];
    $('#resultat').innerHTML = '';
    arene.querySelectorAll('.pion').forEach(e => e.remove());
    calque.innerHTML = '';
    pions = new Map();
    passer = false;
    rendreHUD();
    majVitesse();

    for (let i = 0; i < etapes.length; i++) {
        if (passer) break;
        appliquerEtape(etapes[i], i);
        await attendre(D(etapes[i].pause + (i === 0 ? 650 : 0)));
    }
    if (passer) {
        calque.innerHTML = '';
        appliquerEtape(etapes[etapes.length - 1], etapes.length - 1, false);
    }
    finCombat(resultat);
}

function finCombat(resultat) {
    S.dernierResultat = resultat;
    let perte = 0;
    const boss = estTourBoss(S.tour);
    if (resultat === 'victoire') S.victoires++;
    // Boss vaincu : un module en plus au prochain tour
    if (resultat === 'victoire' && boss) S.choixModules++;
    if (resultat === 'victoire' && boss && S.tour === 10) S.choixMythique = true;
    if (resultat === 'defaite') { perte = Math.min(S.vies, Math.max(1, viesPerdues(S.tour) - (S.eff.assurance ?? 0))); S.vies -= perte; }
    S.phase = 'resultat';
    rendreHUD();
    const textes = {
        victoire: [boss ? 'BOSS VAINCU !' : 'VICTOIRE !', '#4be08a', `${S.victoires}/${VICTOIRES_BUT} victoires${boss ? ` · module bonus${S.tour === 10 ? ' et un mythique offert' : ''} au prochain tour` : ''}`],
        defaite: ['DÉFAITE', '#ff4d6d', `−${perte} ❤️ · il te reste ${S.vies} vie${S.vies > 1 ? 's' : ''}`],
        egalite: ['ÉGALITÉ', '#ffd23f', 'Aucune vie perdue'],
    };
    const [titre, couleur, sous] = textes[resultat];
    $('#resultat').innerHTML = `<div class="text-center">
        <div class="titre contour text-5xl sm:text-6xl" style="color:${couleur}">${titre}</div>
        <div class="titre contour mt-1 text-lg">${sous}</div></div>`;
    $('#resultat').firstChild.animate([
        { transform: 'scale(.2) rotate(-10deg)', opacity: 0 },
        { transform: 'scale(1.15) rotate(3deg)', opacity: 1, offset: .6 },
        { transform: 'none' },
    ], { duration: 500, easing: 'ease-out' });
    // Les survivants sautent de joie
    for (const p of pions.values()) {
        const gagnant = (resultat === 'victoire' && p.dataset.camp === '0') || (resultat === 'defaite' && p.dataset.camp === '1');
        if (gagnant) p.firstChild.animate([{ transform: 'none' }, { transform: 'translateY(-22%)' }, { transform: 'none' }],
            { duration: 420, iterations: 3, delay: Math.random() * 150, easing: 'ease-in-out' });
    }
    if (resultat === 'victoire') confettis();
    $('#btn-passer').classList.add('hidden');
    $('#btn-vitesse').classList.add('hidden');
    $('#btn-continuer').classList.remove('hidden');
    $('#btn-continuer').focus();
}

function confettis() {
    const couleurs = ['#ffd23f', '#4be08a', '#4cc3ff', '#ff6b6b', '#b67cff', '#fff'];
    for (let i = 0; i < 60; i++) {
        const c = document.createElement('div');
        c.style.cssText = `position:absolute;left:${hasard(0, 100)}vw;top:-20px;width:${hasard(7, 12)}px;height:${hasard(10, 18)}px;background:${couleurs[i % couleurs.length]};border:2px solid ${ENCRE};border-radius:2px`;
        calque.appendChild(c);
        c.animate([
            { transform: 'translateY(0) rotate(0)' },
            { transform: `translate(${hasard(-80, 80)}px, 105vh) rotate(${hasard(-720, 720)}deg)` },
        ], { duration: hasard(1600, 2800), delay: hasard(0, 400), easing: 'cubic-bezier(.2,.5,.5,1)', fill: 'backwards' }).onfinish = () => c.remove();
    }
}

function continuer() {
    if (S.phase !== 'resultat') return;
    calque.innerHTML = '';
    if (S.vies <= 0 || S.victoires >= VICTOIRES_BUT) return finRun(S.victoires >= VICTOIRES_BUT);
    debutTour();
}

function majVitesse() {
    $('#btn-vitesse').textContent = `x${vitesse}`;
}

// ---------- Fin de run, aide ----------

function finRun(gagne) {
    let record = 0, nouveau = false;
    try {
        record = Number(localStorage.getItem(CLE_RECORD)) || 0;
        if (S.victoires > record) { localStorage.setItem(CLE_RECORD, String(S.victoires)); record = S.victoires; nouveau = true; }
    } catch { /* stockage indisponible */ }
    if (gagne) confettis();
    ouvrirModal(`
        <p class="titre text-sm uppercase tracking-widest" style="color:${gagne ? '#1f9c55' : '#b8323a'}">${gagne ? 'Run terminé' : 'Plus de vies'}</p>
        <h2 class="titre contour mt-1 text-4xl" style="color:${gagne ? '#ffd23f' : '#ff6b6b'}">${gagne ? 'Champion du circuit !' : 'Équipe démontée…'}</h2>
        <div class="mt-5 grid grid-cols-3 gap-3 text-center">
            ${[['🏆', 'Victoires', S.victoires], ['⏱️', 'Tours', S.tour], ['❤️', 'Vies', S.vies]]
                .map(([i, l, v]) => `<div class="bloc p-2"><div class="text-sm font-medium opacity-60">${i} ${l}</div><div class="titre text-2xl">${v}</div></div>`).join('')}
        </div>
        <div class="mt-5 flex justify-center gap-1">${S.equipe.filter(Boolean).map(u => `<div class="w-16 sm:w-20">${unite(u)}</div>`).join('')}</div>
        <p class="mt-4 text-center font-medium">${nouveau ? '🏅 Nouveau record !' : `Record : ${record} victoire${record > 1 ? 's' : ''}`}</p>
        <div class="mt-5 flex justify-end">
            <button data-action="rejouer" class="bouton h-12 bg-[#4be08a] px-6 text-lg"><span class="contour">REJOUER</span></button>
        </div>`);
}

function afficherAide() {
    ouvrirModal(`
        <h2 class="titre contour text-3xl" style="color:#4cc3ff">Comment jouer</h2>
        <ul class="mt-4 space-y-2 font-medium">
            <li>🪙 Chaque tour : <b>${CREDITS_PAR_TOUR} crédits</b>. Un robot coûte selon sa rareté (${Object.values(PRIX_RARETE).join(' / ')} 🪙, la couleur de l’étiquette), relancer le tapis ${PRIX_RELANCE}, vendre rapporte son niveau.</li>
            <li>🏦 Les crédits non dépensés sont <b>gardés</b> (max ${EPARGNE_MAX}) et rapportent des <b>intérêts</b> : +1 par tranche de 5, jusqu’à +2.</li>
            <li>🎖️ Au début du run, choisis un <b>commandant</b>. Aux tours ${TOURS_MODULE.join(', ')}, installe un <b>module</b> parmi 3 (survole les icônes en haut pour les revoir).</li>
            <li>👑 Aux tours 5, 10 et 15, tu affrontes un <b>boss</b>. Le battre donne un module en plus ; celui du tour 10 offre aussi un robot <b>mythique</b> (palier VII), qu’on croise sinon très rarement en boutique.</li>
            <li>🖱️ Clique sur un robot puis sur un socle, ou <b>glisse-le</b> (aussi au doigt) : sur un socle pour l’acheter, sur Vendre ou Geler. L’avant de l’équipe est à droite.</li>
            <li>⬆️ Pose un robot sur un <b>robot identique</b> : +1/+1 et 1 point d’expérience. Il faut <b>3 exemplaires</b> pour le niveau 2 et <b>6</b> pour le niveau 3 (les pastilles vertes montrent la progression). Chaque niveau gagné ajoute un robot du palier supérieur sur le tapis.</li>
            <li>🔋 À droite du tapis, des <b>objets</b> (${prixObjet(S?.eff)} 🪙) : donne-les à un robot. Les consommables agissent tout de suite, les équipements restent sur le robot.</li>
            <li>❄ <b>Geler</b> un article (bouton, touche F ou clic droit) le garde sur le tapis quand tu relances et au tour suivant.</li>
            <li>⚔️ Le combat est automatique : les robots de tête se frappent jusqu’à ce qu’une équipe soit vide.</li>
            <li>⭐ Avec 2 puis 4 robots d’une même <b>famille</b>, tu actives un bonus (survole les familles sous ton équipe). Les <b>hybrides</b> comptent pour deux familles.</li>
            <li>➕ Les <b>Médicaux</b> soignent (jamais au-delà des PV de départ) et peuvent ranimer un allié détruit.</li>
            <li>🍳 Les <b>Cuisiniers</b> préparent des objets gratuits pour l’équipe en fin de tour (souvent avec une chance de réussite).</li>
            <li>🔥 <b>Brûlure</b> : dégâts à chaque échange · ❄️ <b>Gel</b> : la prochaine attaque est ratée · 🟤 <b>Rouille</b> : dégâts subis augmentés.</li>
            <li>🧬 Certains robots <b>évoluent</b> en cours de partie quand leur compteur est plein.</li>
            <li>🏆 Gagne <b>${VICTOIRES_BUT} combats</b> avant de perdre tes ${VIES} vies. Une défaite coûte 1 à 3 vies selon le tour.</li>
        </ul>
        <p class="mt-4 text-sm opacity-60">Raccourcis : R relancer · F geler · Entrée combattre · Échap désélectionner · Espace passer le combat</p>
        <div class="mt-5 flex justify-end">
            <button data-action="fermer" class="bouton h-12 bg-[#4be08a] px-6 text-lg"><span class="contour">C’EST PARTI !</span></button>
        </div>`);
}

function ouvrirModal(html) {
    $('#modal-contenu').innerHTML = html;
    $('#modal').classList.remove('hidden');
    $('#modal').classList.add('flex');
    $('#modal-contenu').animate([{ transform: 'scale(.7)', opacity: 0 }, { transform: 'scale(1.03)', opacity: 1, offset: .7 }, { transform: 'none' }],
        { duration: 320, easing: 'ease-out' });
    $('#modal-contenu button')?.focus();
}

function fermerModal() {
    $('#modal').classList.add('hidden');
    $('#modal').classList.remove('flex');
    $('#modal-contenu').innerHTML = '';
}

// ---------- Événements ----------

$('#boutique').addEventListener('click', e => {
    const c = e.target.closest('[data-boutique]');
    if (c) clicBoutique(+c.dataset.boutique);
});
$('#equipe').addEventListener('click', e => {
    const c = e.target.closest('[data-slot]');
    if (c) clicEquipe(+c.dataset.slot);
});

$('#objets').addEventListener('click', e => {
    const c = e.target.closest('[data-objet]');
    if (c) clicObjet(+c.dataset.objet);
});

// Clic droit sur un article : geler / dégeler
for (const zone of ['#boutique', '#objets']) {
    $(zone).addEventListener('contextmenu', e => {
        const c = e.target.closest('[data-boutique], [data-objet]');
        if (!c) return;
        e.preventDefault();
        S.sel = c.dataset.objet !== undefined ? { zone: 'objet', i: +c.dataset.objet } : { zone: 'boutique', i: +c.dataset.boutique };
        geler();
    });
}

// Infobulle des synergies : survol, focus clavier, ou toucher sur mobile
$('#synergies').addEventListener('mouseover', e => {
    const id = e.target.closest('[data-famille]')?.dataset.famille;
    if (id && id !== bulleFamille) afficherBulleSynergie(id);
});
$('#synergies').addEventListener('mouseleave', cacherBulleSynergie);
$('#synergies').addEventListener('focusin', e => { const id = e.target.closest('[data-famille]')?.dataset.famille; if (id) afficherBulleSynergie(id); });
$('#synergies').addEventListener('focusout', cacherBulleSynergie);
$('#synergies').addEventListener('click', e => {
    const id = e.target.closest('[data-famille]')?.dataset.famille;
    if (!id) return;
    if (id === bulleFamille && e.pointerType !== 'mouse') cacherBulleSynergie(); else afficherBulleSynergie(id);
});
document.addEventListener('pointerdown', e => { if (bulleFamille && !e.target.closest('#synergies')) cacherBulleSynergie(); });

// Fiche détaillée au survol
const sousPointeur = c => !c ? null
    : c.dataset.boutique !== undefined ? S.boutique[+c.dataset.boutique]
        : c.dataset.objet !== undefined ? S.objets[+c.dataset.objet]
            : S.equipe[+c.dataset.slot];
for (const zone of ['#boutique', '#objets', '#equipe']) {
    $(zone).addEventListener('mouseover', e => {
        const u = sousPointeur(e.target.closest('[data-boutique], [data-objet], [data-slot]'));
        if (u !== survol) { survol = u ?? null; rendreDetail(); }
    });
    $(zone).addEventListener('mouseleave', () => { survol = null; rendreDetail(); });
}

// Glisser-déposer (souris et tactile) : le robot suit le pointeur, les cases possibles s'allument
let glisse = null, sansClic = false;
const SEUIL_GLISSE = 8;

function sourceGlisse(el) {
    const b = el.closest('[data-boutique]'), o = el.closest('[data-objet]'), q = el.closest('#equipe [data-slot]');
    if (b) return { zone: 'boutique', i: +b.dataset.boutique, el: b };
    if (o) return { zone: 'objet', i: +o.dataset.objet, el: o };
    if (q && S.equipe[+q.dataset.slot]) return { zone: 'equipe', i: +q.dataset.slot, el: q };
    return null;
}

// Cible sous le pointeur : une case de l'équipe, ou les boutons Vendre / Geler
function cibleGlisse(g, x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const slot = el.closest('#equipe [data-slot]');
    if (slot) return { type: 'slot', j: +slot.dataset.slot, el: slot };
    if (el.closest('#btn-vendre') && g.zone === 'equipe') return { type: 'vendre', el: $('#btn-vendre') };
    if (el.closest('#btn-geler') && g.zone !== 'equipe') return { type: 'geler', el: $('#btn-geler') };
    return null;
}

// Élément d'origine de l'article glissé (recréé à chaque rendre())
function elementSource(g) {
    return document.querySelector(g.zone === 'boutique' ? `[data-boutique="${g.i}"]`
        : g.zone === 'objet' ? `[data-objet="${g.i}"]` : `#equipe [data-slot="${g.i}"] .unite`);
}

function demarrerGlisse(e) {
    const r = glisse.el.getBoundingClientRect();
    glisse.dx = glisse.x0 - r.left;
    glisse.dy = glisse.y0 - r.top;
    glisse.origine = { x: r.left, y: r.top };
    // Fantôme : copie du robot, sans socle ni flèche
    const f = glisse.el.cloneNode(true);
    f.querySelectorAll('.socle, .fleche, .glace').forEach(n => n.remove());
    for (const attr of ['data-slot', 'data-boutique', 'data-objet', 'data-uid']) f.removeAttribute(attr);
    f.classList.remove('-translate-y-3', 'transition');
    Object.assign(f.style, {
        position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', margin: 0,
        zIndex: 60, pointerEvents: 'none', transformOrigin: '50% 80%', filter: 'drop-shadow(0 14px 10px rgba(30,27,46,.35))',
    });
    document.body.appendChild(f);
    glisse.fantome = f;
    S.sel = { zone: glisse.zone, i: glisse.i };
    survol = null;
    rendre();
    elementSource(glisse)?.style.setProperty('opacity', '.3');
    deplacerFantome(e);
}

function deplacerFantome(e) {
    const vx = e.clientX - (glisse.px ?? e.clientX);
    glisse.px = e.clientX;
    glisse.inclinaison = (glisse.inclinaison ?? 0) * 0.7 + Math.max(-18, Math.min(18, vx * 1.5)) * 0.3;
    glisse.fantome.style.left = e.clientX - glisse.dx + 'px';
    glisse.fantome.style.top = e.clientY - glisse.dy + 'px';
    glisse.fantome.style.transform = `scale(1.12) rotate(${glisse.inclinaison}deg)`;
    const c = cibleGlisse(glisse, e.clientX, e.clientY);
    if (c?.el !== glisse.vise?.el) {
        glisse.vise?.el.classList.remove('vise');
        c?.el.classList.add('vise');
        glisse.vise = c;
    }
}

function finirGlisse(e) {
    const g = glisse;
    glisse = null;
    g.vise?.el.classList.remove('vise');
    const c = e.type === 'pointerup' ? cibleGlisse(g, e.clientX, e.clientY) : null;
    if (c?.type === 'slot' && !(g.zone === 'equipe' && c.j === g.i)) clicEquipe(c.j);
    else if (c?.type === 'vendre') vendre();
    else if (c?.type === 'geler') geler();
    // Les actions réussies vident la sélection ; sinon le robot retourne à sa place
    if (c && S.sel === null) return g.fantome.remove();
    S.sel = null;
    rendre();
    retourFantome(g);
}

function retourFantome(g) {
    const f = g.fantome, src = elementSource(g);
    src?.style.setProperty('opacity', '0');
    const r = (g.zone === 'equipe' ? src?.closest('[data-slot]') : src)?.getBoundingClientRect() ?? { left: g.origine.x, top: g.origine.y };
    f.animate([{ left: f.style.left, top: f.style.top, transform: f.style.transform },
        { left: r.left + 'px', top: r.top + 'px', transform: 'none' }],
        { duration: 220, easing: 'cubic-bezier(.3,1.4,.6,1)', fill: 'forwards' });
    setTimeout(() => { f.remove(); src?.style.removeProperty('opacity'); }, 240);
}

document.addEventListener('pointerdown', e => {
    if (S.phase !== 'boutique' || glisse || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const src = sourceGlisse(e.target);
    if (src) glisse = { ...src, x0: e.clientX, y0: e.clientY, id: e.pointerId, actif: false };
});
window.addEventListener('pointermove', e => {
    if (!glisse || e.pointerId !== glisse.id) return;
    if (!glisse.actif) {
        if (Math.hypot(e.clientX - glisse.x0, e.clientY - glisse.y0) < SEUIL_GLISSE) return;
        glisse.actif = true;
        demarrerGlisse(e);
    } else deplacerFantome(e);
    e.preventDefault();
}, { passive: false });
for (const type of ['pointerup', 'pointercancel']) {
    window.addEventListener(type, e => {
        if (!glisse || e.pointerId !== glisse.id) return;
        if (!glisse.actif) { glisse = null; return; }
        // Le clic qui suit un glisser ne doit pas resélectionner
        sansClic = true;
        setTimeout(() => (sansClic = false), 0);
        finirGlisse(e);
    });
}
document.addEventListener('click', e => { if (sansClic) { e.stopPropagation(); e.preventDefault(); } }, true);

$('#btn-vendre').addEventListener('click', vendre);
$('#btn-relancer').addEventListener('click', relancer);
$('#btn-geler').addEventListener('click', geler);
$('#btn-combat').addEventListener('click', combattre);
$('#btn-passer').addEventListener('click', () => (passer = true));
$('#btn-vitesse').addEventListener('click', () => { vitesse = vitesse === 1 ? 2 : 1; majVitesse(); });
$('#btn-continuer').addEventListener('click', continuer);
$('#btn-aide').addEventListener('click', afficherAide);
$('#btn-nouvelle').addEventListener('click', () => {
    if (confirm('Abandonner le run en cours ?')) nouvellePartie();
});
$('#modal').addEventListener('click', e => {
    const bouton = e.target.closest('[data-action]');
    const action = bouton?.dataset.action;
    if (action === 'fermer') {
        fermerModal();
        // L'aide a pu être ouverte par-dessus un choix en attente : on y revient
        if (!S.commandant) choisirCommandant();
        else choixSuivant();
    }
    if (action === 'rejouer') nouvellePartie();
    if (action === 'commandant') {
        S.commandant = bouton.dataset.id;
        majEffets();
        fermerModal();
        debutTour();
    }
    if (action === 'module') prendreModule(bouton.dataset.id);
    if (action === 'mythique') prendreMythique(bouton.dataset.id);
});

document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!$('#modal').classList.contains('hidden')) return;
    if (S.phase === 'boutique') {
        if (e.key === 'r' || e.key === 'R') relancer();
        else if (e.key === 'f' || e.key === 'F') geler();
        else if (e.key === 'Enter') { e.preventDefault(); combattre(); }
        else if (e.key === 'Escape' && S.sel) { S.sel = null; rendre(); }
    } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (S.phase === 'combat') passer = true;
        else continuer();
    }
});

// Garde les robots du combat bien placés si la fenêtre change de taille
window.addEventListener('resize', () => {
    alignerSol();
    if (S.phase !== 'resultat') return;
    arene.querySelectorAll('.pion').forEach(e => e.remove());
    pions = new Map();
    appliquerEtape(etapesCourantes[etapesCourantes.length - 1], etapesCourantes.length - 1, false);
});

$('#ville').innerHTML = villeSVG();
nouvellePartie();
