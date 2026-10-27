// Règles pures de Circuit Brawl (aucun accès au DOM) : boutique, fusion, combat, adversaire IA.
import { ROBOTS, FAMILLES, SEUILS_SYNERGIE, OBJETS, COMMANDANTS, MODULES, BOSS, familles, aFamille } from './data.js';

export const TAILLE_EQUIPE = 5;
export const CREDITS_PAR_TOUR = 10;
export const PRIX_ACHAT = 3;
export const PRIX_RELANCE = 1;
export const VIES = 10;
export const VICTOIRES_BUT = 10;
const STAT_MAX = 50;

let prochainUid = 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function creerUnite(id, extra = {}) {
    const d = ROBOTS[id];
    return { uid: prochainUid++, id, atk: d.atk, hp: d.hp, niveau: 1, xp: 0, ...extra };
}

// Expérience : chaque exemplaire fusionné donne 1 point. Niveau 2 à 2 points (3 exemplaires), niveau 3 à 5 (6 exemplaires).
export const XP_NIVEAU = [0, 2, 5];
export const XP_MAX = XP_NIVEAU[2];
export const xpDe = u => u.xp ?? XP_NIVEAU[u.niveau - 1];
export const niveauDeXp = xp => (xp >= XP_NIVEAU[2] ? 3 : xp >= XP_NIVEAU[1] ? 2 : 1);

export const palierDuTour = tour => Math.min(6, Math.ceil(tour / 2));
export const viesPerdues = tour => (tour <= 2 ? 1 : tour <= 4 ? 2 : 3);
export const tailleBoutique = palier => (palier <= 2 ? 3 : palier <= 4 ? 4 : 5);

export function auHasard(liste, n = 1, rng = Math.random) {
    const copie = liste.filter(Boolean);
    const res = [];
    while (res.length < n && copie.length) res.push(copie.splice(Math.floor(rng() * copie.length), 1)[0]);
    return res;
}

// ---------- Synergies ----------

export function compterFamilles(unites) {
    const n = Object.fromEntries(Object.keys(FAMILLES).map(f => [f, 0]));
    for (const u of unites) if (u) for (const f of familles(u)) n[f]++;
    return n;
}

// 0 = inactif, 1 = premier seuil, 2 = second seuil
export const niveauSynergie = n => SEUILS_SYNERGIE.filter(s => n >= s).length;

// ---------- Boutique ----------

export function tirerBoutique(palier, rng = Math.random, pool = null, n = tailleBoutique(palier)) {
    const ids = idsDisponibles(palier, pool);
    return Array.from({ length: n }, () => creerUnite(ids[Math.floor(rng() * ids.length)]));
}

// ---------- Prix, épargne, commandant et modules ----------

export const PRIX_RARETE = { commun: 3, rare: 4, epique: 5, legendaire: 6 };
export const EPARGNE_MAX = 10;

// eff : effets cumulés du commandant et des modules (voir effetsRun)
export const prixRobot = (u, eff = {}) =>
    Math.max(1, PRIX_RARETE[ROBOTS[u.id].rarete] - (ROBOTS[u.id].rarete !== 'commun' ? eff.reducRare ?? 0 : 0));
export const prixObjet = (eff = {}) => Math.max(1, PRIX_ACHAT - (eff.reducObjet ?? 0));

// Crédits bonus du tour : un bonus fractionnaire (0.5) tombe un tour sur deux
export const creditsBonus = (tour, eff = {}) => {
    const c = eff.creditsTour ?? 0;
    return Math.floor(tour * c) - Math.floor((tour - 1) * c);
};

// Intérêts : +1 crédit par tranche de 5 crédits gardés, plafonné
export const interets = (epargne, eff = {}) => Math.min(2 + (eff.interetMax ?? 0), Math.floor(epargne / 5));

// Additionne les effets du commandant et des modules ; les bonus de combat sont regroupés dans eff.combat
export function effetsRun(commandant, modules = []) {
    const eff = { combat: {} };
    for (const def of [COMMANDANTS[commandant], ...modules.map(id => MODULES[id])]) {
        if (!def) continue;
        for (const [k, v] of Object.entries(def.effet ?? {})) eff[k] = (eff[k] ?? 0) + v;
        for (const [k, v] of Object.entries(def.combat ?? {})) eff.combat[k] = (eff.combat[k] ?? 0) + v;
    }
    return eff;
}

export const TOURS_MODULE = [3, 6, 9];
export const estTourBoss = tour => tour % 5 === 0;

// Tire n choix différents parmi une liste d'ids, sans ceux à exclure
export const proposer = (ids, n, exclure = [], rng = Math.random) => auHasard(ids.filter(id => !exclure.includes(id)), n, rng);

export function idsDisponibles(palierMax, pool = null, palierMin = 1) {
    return Object.keys(ROBOTS).filter(id => {
        const p = ROBOTS[id].palier;
        return p && !ROBOTS[id].horsBoutique && p >= palierMin && p <= palierMax && (!pool || pool.includes(id));
    });
}

// Robot bonus offert quand une unité monte de niveau (palier au-dessus)
export function uniteBonus(palier, rng = Math.random, pool = null) {
    const p = Math.min(6, palier + 1);
    const ids = idsDisponibles(p, pool, p);
    return ids.length ? creerUnite(ids[Math.floor(rng() * ids.length)]) : null;
}

// ---------- Objets ----------

export const tailleObjets = palier => (palier <= 2 ? 1 : 2);
export const creerObjet = id => ({ uid: prochainUid++, id, estObjet: true });
export const EQUIPEMENTS = Object.keys(OBJETS).filter(id => OBJETS[id].equipement);

export function tirerObjets(palier, rng = Math.random) {
    const ids = Object.keys(OBJETS).filter(id => OBJETS[id].palier <= palier);
    return Array.from({ length: tailleObjets(palier) }, () => creerObjet(ids[Math.floor(rng() * ids.length)]));
}

// Donne un objet au robot equipe[index]. Renvoie { ok, message, effets, monte, equipement }
export function utiliserObjet(objet, equipe, index, rng = Math.random) {
    const def = OBJETS[objet.id], cible = equipe[index];
    if (!cible) return { ok: false, message: 'Choisis un robot de ton équipe' };
    if (def.equipement) {
        cible.objet = objet.id;
        return { ok: true, effets: [], equipement: true };
    }
    const effets = [];
    let monte = false;
    const buff = (u, a, h) => {
        if (!u) return;
        u.atk = clamp(u.atk + a, 0, STAT_MAX);
        u.hp = clamp(u.hp + h, 1, STAT_MAX);
        effets.push({ uid: u.uid, a, h });
    };
    const c = {
        cible, equipe, rng, buff,
        robots: () => equipe.filter(Boolean),
        auHasard: (l, n) => auHasard(l, n, rng),
        buffTemp: (u, a, h) => {
            buff(u, a, h);
            u.temp = { a: (u.temp?.a ?? 0) + a, h: (u.temp?.h ?? 0) + h };
        },
        niveauPlus: u => { u.xp = XP_NIVEAU[Math.min(2, u.niveau)]; u.niveau = niveauDeXp(u.xp); buff(u, 1, 1); monte = true; },
    };
    const refus = def.condition?.(c);
    if (refus) return { ok: false, message: refus };
    def.effet(c);
    return { ok: true, effets, monte };
}

// Retire les bonus « pour le prochain combat » une fois le combat joué
export function retirerTemporaires(equipe) {
    for (const u of equipe) {
        if (u) delete u.nourri;
        if (!u?.temp) continue;
        u.atk = Math.max(0, u.atk - u.temp.a);
        u.hp = Math.max(1, u.hp - u.temp.h);
        delete u.temp;
    }
}

export const peutFusionner = (a, b) => a && b && a.id === b.id && xpDe(a) < XP_MAX;

// Fusionne b dans a : stats max +1/+1, b apporte 1 point d'expérience (plus la sienne). Renvoie true si a monte de niveau.
// bonus : stats en plus quand il atteint le niveau 3 (Tacticienne)
export function fusionner(a, b, bonus = 0) {
    const avant = a.niveau;
    a.atk = Math.min(STAT_MAX, Math.max(a.atk, b.atk) + 1);
    a.hp = Math.min(STAT_MAX, Math.max(a.hp, b.hp) + 1);
    a.xp = Math.min(XP_MAX, xpDe(a) + xpDe(b) + 1);
    a.niveau = niveauDeXp(a.xp);
    if (a.niveau === 3 && avant < 3 && bonus) {
        a.atk = Math.min(STAT_MAX, a.atk + bonus);
        a.hp = Math.min(STAT_MAX, a.hp + bonus);
    }
    return a.niveau > avant;
}

// Déclenche une capacité hors combat (achat, vente, début/fin de tour, après combat). Renvoie la liste des effets.
export function declencherBoutique(nom, equipe, index, rng = Math.random, extra = {}) {
    const moi = equipe[index];
    const effets = [];
    const f = moi && ROBOTS[moi.id][nom];
    if (!f) return effets;
    const chercher = pas => {
        for (let i = index + pas; i >= 0 && i < equipe.length; i += pas) if (equipe[i]) return equipe[i];
        return null;
    };
    const buff = (cible, a, h) => {
        if (!cible) return;
        cible.atk = clamp(cible.atk + a, 0, STAT_MAX);
        cible.hp = clamp(cible.hp + h, 1, STAT_MAX);
        effets.push({ uid: cible.uid, a, h });
    };
    f({
        moi, L: moi.niveau, equipe, rng, buff,
        devant: () => chercher(-1),
        derriere: () => chercher(1),
        autres: () => equipe.filter(u => u && u !== moi),
        auHasard: (l, n) => auHasard(l, n, rng),
        gagnerCredits: n => effets.push({ uid: moi.uid, credits: n }),
        // Bonus retiré après le prochain combat (comme la Puce turbo)
        buffTemp: (cible, a, h) => {
            if (!cible) return;
            buff(cible, a, h);
            cible.temp = { a: (cible.temp?.a ?? 0) + a, h: (cible.temp?.h ?? 0) + h };
        },
        echanger: (a, b) => {
            const i = equipe.indexOf(a), j = equipe.indexOf(b);
            if (i < 0 || j < 0) return;
            [equipe[i], equipe[j]] = [b, a];
            effets.push({ uid: a.uid, deplace: true }, { uid: b.uid, deplace: true });
        },
        // Cuisiniers : donne gratuitement un objet de la boutique
        cuisiner: (id, cible) => {
            const i = equipe.indexOf(cible);
            if (!cible || i < 0) return;
            effets.push({ uid: cible.uid, plat: id, src: moi.uid });
            cible.nourri = true;
            const res = utiliserObjet({ id }, equipe, i, rng);
            if (res.ok) effets.push(...res.effets);
            effets.push(...declencherAllieObjet(equipe, i, rng));
        },
        // Évolution : compteur propre au robot, puis transformation en une autre forme (garde niveau et bonus)
        compteur: () => {
            moi.compteur = (moi.compteur ?? 0) + 1;
            effets.push({ uid: moi.uid, compteur: moi.compteur });
            return moi.compteur;
        },
        evoluer: (id, a, h) => {
            moi.id = id;
            moi.atk = clamp(moi.atk + a, 0, STAT_MAX);
            moi.hp = clamp(moi.hp + h, 1, STAT_MAX);
            delete moi.compteur;
            effets.push({ uid: moi.uid, evolution: id });
        },
        ...extra,
    });
    return effets;
}

// Un allié vient de recevoir un objet (acheté ou cuisiné) : capacités « allieObjet » (Chef cuistot)
export function declencherAllieObjet(equipe, index, rng = Math.random) {
    const effets = [];
    equipe.forEach((u, k) => {
        if (u && ROBOTS[u.id].allieObjet) effets.push(...declencherBoutique('allieObjet', equipe, k, rng, { cible: equipe[index] }));
    });
    return effets;
}

// ---------- Combat ----------

// Simule un combat complet. Renvoie le résultat et la liste des étapes à animer.
// bonus : effets de combat du commandant et des modules du joueur (eff.combat), voir effetsRun
export function simulerCombat(equipeJoueur, equipeAdverse, rng = Math.random, bonus = {}) {
    const nouveau = (u, camp) => ({ ...u, uid: prochainUid++, pvMax: u.hp, bouclier: 0, brulure: 0, gel: false, rouille: 0, camp });
    const eq = [equipeJoueur, equipeAdverse].map((t, camp) => t.filter(Boolean).map(u => nouveau(u, camp)));
    const bonusInvoc = [0, 0];
    const bonusSoin = [0, 0];
    const bombardement = [0, 0];          // synergie Drones : ennemis touchés après chaque échange
    const prediction = [0, 0];            // synergie IA : attaques ennemies encore à annuler
    const bouclierRelais = [0, 0];        // synergie Méchas : bouclier donné à chaque nouveau robot de tête
    const tete = [null, null];            // dernier robot de tête qui a reçu ce bouclier
    const reanimation = [0, 0];           // synergie Médicaux : niveau de réanimation du premier allié détruit (0 = déjà utilisée)
    let relais = bonus.relaisMort ?? 0;   // Marionnettiste : robots détruits remplacés par un mini-drone
    let survie = bonus.survie ?? 0;       // Survivante : le premier robot détruit tient à 1 PV
    let echange = 0;                      // numéro de l’échange en cours (Gardienne)
    const etapes = [];
    let fx = [];
    const blesses = [];

    const snap = pause => {
        etapes.push({
            eq: eq.map(t => t.map(u => ({
                uid: u.uid, id: u.id, atk: u.atk, hp: u.hp, niveau: u.niveau, bouclier: u.bouclier, objet: u.objet,
                brulure: u.brulure, gel: u.gel, rouille: u.rouille,
            }))),
            fx, pause,
        });
        fx = [];
    };

    // src = robot à l'origine d'une capacité (pour animer un projectile), absent pour une attaque normale
    // opts.cause = 'brulure' pour les dégâts de brûlure
    function degats(cible, n, src = null, opts = {}) {
        if (!cible || n <= 0 || cible.hp <= 0) return;
        // Gardienne : seulement contre les attaques des 3 premiers échanges (pas les capacités ni la brûlure)
        const attaque = !src && !opts.cause && echange < 3;
        const reduction = (cible.objet === 'blindage' ? 2 : cible.objet === 'armure' ? 1 : 0) + (cible.camp === 0 && attaque ? bonus.reducDegats ?? 0 : 0);
        let reste = (reduction ? Math.max(1, n - reduction) : n) + cible.rouille;
        if (cible.bouclier > 0) {
            const absorbe = Math.min(cible.bouclier, reste);
            cible.bouclier -= absorbe;
            reste -= absorbe;
            fx.push({ type: 'bouclier', uid: cible.uid, valeur: absorbe, src: src?.uid, ...opts });
            if (cible.bouclier === 0) {
                for (const allie of [...eq[cible.camp]]) if (allie.hp > 0) declencher(allie, 'allieBouclierBrise', { cible });
            }
        }
        if (reste > 0) {
            cible.hp -= reste;
            fx.push({ type: 'degat', uid: cible.uid, valeur: reste, src: src?.uid, ...opts });
            blesses.push(cible);
        }
    }

    // Soin : jamais au-delà des PV de départ (pvMax), bonus de la synergie Médicaux
    function soigner(cible, n, src = null) {
        if (!cible || cible.hp <= 0 || n <= 0) return;
        const avant = cible.hp;
        cible.hp = Math.min(cible.pvMax, cible.hp + n + bonusSoin[cible.camp]);
        const gain = cible.hp - avant;
        if (gain <= 0) return;
        fx.push({ type: 'soin', uid: cible.uid, valeur: gain, src: src?.uid });
        for (const allie of [...eq[cible.camp]]) if (allie.hp > 0) declencher(allie, 'allieSoigne', { cible, valeur: gain });
    }

    // Ramène un robot détruit à sa place d'origine (une seule fois par robot)
    function ranimer(mort, pv, index) {
        const u = invoquer(mort.camp, mort.id, mort.atk, pv, index, true);
        if (!u) return null;
        Object.assign(u, { niveau: mort.niveau, objet: mort.objet, pvMax: mort.pvMax, ranime: true });
        fx.push({ type: 'ranime', uid: u.uid });
        return u;
    }

    function statut(cible, nom, valeur, src) {
        if (!cible || cible.hp <= 0) return;
        if (cible.immunise) return fx.push({ type: 'immunise', uid: cible.uid, src: src?.uid });
        // Module Flammes éternelles : les brûlures du joueur sont plus fortes
        if (nom === 'brulure' && src?.camp === 0) valeur += bonus.brulure ?? 0;
        if (nom === 'gel') cible.gel = true;
        else cible[nom] += valeur;
        fx.push({ type: 'statut', uid: cible.uid, statut: nom, valeur, src: src?.uid });
    }

    function buff(cible, a, h, src = null) {
        if (!cible || cible.hp <= 0) return;
        cible.atk = clamp(cible.atk + a, 0, STAT_MAX);
        cible.hp = Math.min(STAT_MAX, cible.hp + h);
        if (h > 0) cible.pvMax += h;
        fx.push({ type: 'buff', uid: cible.uid, a, h, src: src?.uid });
    }

    function bouclier(cible, n, src = null) {
        if (!cible) return;
        cible.bouclier += n;
        fx.push({ type: 'bouclierGagne', uid: cible.uid, valeur: n, src: src?.uid });
    }

    // sansBonus : une réanimation ne profite pas du bonus d'invocation des Nanobots
    function invoquer(camp, id, atk, hp, index, sansBonus = false) {
        const t = eq[camp];
        if (t.length >= TAILLE_EQUIPE) return null;
        const b = sansBonus ? 0 : bonusInvoc[camp];
        // Les bonus d'invocation (synergie Nanobots, Dresseur) ne renforcent que l'attaque
        const u = nouveau({ id, atk: atk + b, hp, niveau: 1 }, camp);
        t.splice(clamp(index, 0, t.length), 0, u);
        fx.push({ type: 'invoque', uid: u.uid });
        for (const allie of [...t]) if (allie !== u && allie.hp > 0) declencher(allie, 'allieInvoque', { cible: u });
        return u;
    }

    function contexte(u, extra) {
        const allies = eq[u.camp];
        return {
            moi: u, L: u.niveau, rng, allies, ennemis: eq[1 - u.camp], index: allies.indexOf(u),
            degats: (c, n) => degats(c, n, u),
            buff: (c, a, h) => buff(c, a, h, u),
            bouclier: (c, n) => bouclier(c, n, u),
            invoquer: (id, a, h, i) => invoquer(u.camp, id, a, h, i),
            soigner: (c, n) => soigner(c, n, u),
            ranimer: (mort, pv) => ranimer(mort, pv, mort.indexMort ?? 0),
            bruler: (c, n) => statut(c, 'brulure', n, u),
            geler: c => statut(c, 'gel', 1, u),
            rouiller: (c, n) => statut(c, 'rouille', n, u),
            // Retire brûlure, gel et rouille ; renvoie true s'il y avait quelque chose à retirer
            nettoyer: c => {
                if (!c || c.hp <= 0 || !(c.brulure || c.gel || c.rouille)) return false;
                Object.assign(c, { brulure: 0, gel: false, rouille: 0 });
                fx.push({ type: 'nettoye', uid: c.uid, src: u.uid });
                return true;
            },
            vacciner: c => { if (c && c.hp > 0) { c.immunise = true; fx.push({ type: 'vaccine', uid: c.uid }); } },
            // Joue la capacité de début de combat d'un allié comme si c'était la sienne
            imiter: autre => {
                const f = autre && autre.id !== u.id && ROBOTS[autre.id].debutCombat;
                if (!f) return false;
                f(contexte(u, extra));
                return true;
            },
            auHasard: (l, n) => auHasard(l.filter(x => x.hp > 0), n, rng),
            ...extra,
        };
    }

    function declencher(u, nom, extra = {}) {
        const f = ROBOTS[u.id][nom];
        if (!f) return false;
        fx.push({ type: 'capacite', uid: u.uid });
        f(contexte(u, extra));
        return true;
    }

    // Applique les « dégâts subis » puis retire les robots détruits, en boucle jusqu'à stabilité
    function resoudre() {
        for (let garde = 0; garde < 40; garde++) {
            while (blesses.length) {
                const u = blesses.shift();
                if (u.hp > 0) declencher(u, 'blesse');
            }
            // Synergie Médicaux : le premier allié détruit du combat se relève
            for (let camp = 0; camp < 2; camp++) {
                const tombe = reanimation[camp] && eq[camp].find(u => u.hp <= 0);
                // Avec 2 Médicaux il revient à 1 PV, avec 4 à la moitié de ses PV de départ
                if (tombe) { tombe.hp = reanimation[camp] === 2 ? Math.ceil(tombe.pvMax / 2) : 1; reanimation[camp] = 0; fx.push({ type: 'ranime', uid: tombe.uid }); }
            }
            const survivant = survie > 0 && eq[0].find(u => u.hp <= 0);
            if (survivant) { survivant.hp = 1; survie--; fx.push({ type: 'ranime', uid: survivant.uid }); }
            if (fx.length) snap(450);

            const morts = [];
            eq.forEach((t, camp) => t.forEach((u, i) => {
                if (u.hp <= 0) morts.push({ u, camp, index: t.slice(0, i).filter(v => v.hp > 0).length });
            }));
            if (!morts.length) return;
            for (let camp = 0; camp < 2; camp++) eq[camp] = eq[camp].filter(u => u.hp > 0);
            for (const m of morts) { fx.push({ type: 'mort', uid: m.u.uid }); m.u.indexMort = m.index; }
            snap(420);

            morts.sort((a, b) => b.u.atk - a.u.atk);
            for (const m of morts) {
                declencher(m.u, 'mort', { index: m.index, allies: eq[m.camp], ennemis: eq[1 - m.camp] });
                if (m.u.objet === 'kit') invoquer(m.camp, 'minidrone', 1, 1, m.index);
                if (m.u.objet === 'reboot') {
                    const r = invoquer(m.camp, m.u.id, 1, 1, m.index, true);
                    if (r) { Object.assign(r, { niveau: m.u.niveau, ranime: true }); fx.push({ type: 'ranime', uid: r.uid }); }
                }
                if (m.camp === 0 && relais > 0) { relais--; invoquer(0, 'minidrone', 1, 1, m.index); }
                for (const allie of [...eq[m.camp]]) if (allie.hp > 0) declencher(allie, 'allieMort', { cible: m.u });
                for (const ennemi of [...eq[1 - m.camp]]) if (ennemi.hp > 0) declencher(ennemi, 'ennemiMort', { cible: m.u });
            }
            if (fx.length) snap(450);
        }
    }

    // Synergie Méchas : un robot qui arrive en tête reçoit le bouclier du relais
    function relaisBouclier() {
        for (let camp = 0; camp < 2; camp++) {
            const t0 = eq[camp][0];
            if (!bouclierRelais[camp] || !t0 || t0.uid === tete[camp]) continue;
            tete[camp] = t0.uid;
            bouclier(t0, bouclierRelais[camp]);
        }
    }

    snap(600);

    // Synergies de familles
    eq.forEach((t, camp) => {
        const n = compterFamilles(t);
        const drone = niveauSynergie(n.drone), mecha = niveauSynergie(n.mecha);
        const nano = niveauSynergie(n.nano), ia = niveauSynergie(n.ia), medic = niveauSynergie(n.medic);
        bombardement[camp] = drone;
        bouclierRelais[camp] = mecha * 2;  // bouclier 2 puis 4
        bonusInvoc[camp] = nano * 2;  // +2 puis +4 attaque
        prediction[camp] = ia;
        reanimation[camp] = medic;
        t.filter(u => u.objet === 'champ').forEach(u => bouclier(u, 10));
    });
    // Commandant et modules du joueur
    const [moi, eux] = eq;
    const b = k => bonus[k] ?? 0;
    if (moi.length) {
        if (b('atkTous') || b('pvTous')) moi.forEach(u => buff(u, b('atkTous'), b('pvTous')));
        if (b('teteA') || b('teteH')) buff(moi[0], b('teteA'), b('teteH'));
        if (b('arriereA') || b('arriereH')) buff(moi[moi.length - 1], b('arriereA'), b('arriereH'));
        if (b('bouclierTete')) bouclier(moi[0], b('bouclierTete'));
        if (b('bouclierAvant')) moi.slice(0, 2).forEach(u => bouclier(u, b('bouclierAvant')));
        if (b('gelTete') && eux[0]) statut(eux[0], 'gel', 1, null);
    }
    bonusInvoc[0] += b('invoc');
    relaisBouclier();
    bonusSoin[0] += b('soin');
    if (fx.length) snap(700);

    // Capacités de début de combat : les prioritaires (Vaccin) d'abord, puis par attaque décroissante
    const prio = u => (ROBOTS[u.id].prioritaire ? 1 : 0);
    const ordre = [...eq[0], ...eq[1]].sort((a, b) => prio(b) - prio(a) || b.atk - a.atk || rng() - 0.5);
    for (const u of ordre) {
        if (u.hp <= 0 || !eq[u.camp].includes(u)) continue;
        if (declencher(u, 'debutCombat')) { snap(500); resoudre(); }
    }

    for (let tour = 0; tour < 80 && eq[0].length && eq[1].length; tour++) {
        echange = tour;
        // Brûlures : chaque robot en feu subit ses dégâts, puis la brûlure baisse
        for (const u of [...eq[0], ...eq[1]]) {
            if (u.brulure > 0 && u.hp > 0) { degats(u, u.brulure, null, { cause: 'brulure' }); u.brulure--; }
        }
        if (fx.length) { snap(380); resoudre(); }
        if (!eq[0].length || !eq[1].length) break;
        relaisBouclier();
        if (fx.length) snap(380);

        const a = eq[0][0], b = eq[1][0];
        // Capacités « avant son attaque » (Nano-forge) : les bonus ne durent que le temps du combat
        for (const u of [a, b]) declencher(u, 'avantAttaque');
        if (fx.some(f => f.type !== 'capacite')) snap(380); else fx = [];
        fx.push({ type: 'attaque', uid: a.uid, camp: 0 }, { type: 'attaque', uid: b.uid, camp: 1 });
        snap(280);
        // Un robot gelé rate son attaque, puis dégèle
        const force = u => {
            if (u.gel) { u.gel = false; fx.push({ type: 'degel', uid: u.uid }); return 0; }
            return u.atk + (u.objet === 'lame' ? 3 : 0);
        };
        // Duelliste : la première attaque du joueur fait +50 % de dégâts
        let atkA = Math.ceil(force(a) * (tour === 0 && bonus.premierCoup ? 1.5 : 1)), atkB = force(b);
        // Synergie IA : l’attaque ennemie était prévue, elle est annulée (une attaque déjà ratée par le gel ne compte pas)
        if (atkB > 0 && prediction[0] > 0) { atkB = 0; prediction[0]--; fx.push({ type: 'prevu', uid: a.uid }); }
        if (atkA > 0 && prediction[1] > 0) { atkA = 0; prediction[1]--; fx.push({ type: 'prevu', uid: b.uid }); }
        degats(b, atkA);
        degats(a, atkB);
        for (const [att, cible] of [[a, b], [b, a]]) declencher(att, 'apresAttaque', { cible });
        for (const [att, cible] of [[a, b], [b, a]]) if (cible.hp <= 0 && att.hp > 0) declencher(att, 'tue', { cible });
        snap(420);
        resoudre();

        // Fin de l'échange : soins et effets des survivants
        for (const u of [...eq[0], ...eq[1]]) if (u.hp > 0) declencher(u, 'apresEchange');
        if (fx.some(f => f.type !== 'capacite')) { snap(420); resoudre(); } else fx = [];
        // Synergie Drones : un Drone encore en vie bombarde 1 ou 2 ennemis au hasard
        for (let camp = 0; camp < 2; camp++) {
            const tireurs = eq[camp].filter(u => u.hp > 0 && aFamille(u, 'drone'));
            if (!bombardement[camp] || !tireurs.length) continue;
            for (const cible of auHasard(eq[1 - camp].filter(u => u.hp > 0), bombardement[camp], rng)) {
                degats(cible, 1, tireurs[Math.floor(rng() * tireurs.length)]);
            }
        }
        if (fx.length) { snap(420); resoudre(); }
        // Le vaccin ne protège que jusqu'à la fin du premier échange
        if (tour === 0) for (const u of [...eq[0], ...eq[1]]) delete u.immunise;
    }

    const resultat = eq[0].length && !eq[1].length ? 'victoire'
        : !eq[0].length && eq[1].length ? 'defaite' : 'egalite';
    snap(300);
    return { resultat, etapes };
}

// Synergie Cuisiniers : après une victoire, +1/+1 permanent à 1 ou 2 alliés au hasard. Renvoie les effets.
export function festin(equipe, rng = Math.random) {
    const niv = niveauSynergie(compterFamilles(equipe).cuisine);
    const effets = [];
    for (const u of auHasard(equipe, niv, rng)) {
        u.atk = Math.min(STAT_MAX, u.atk + 1);
        u.hp = Math.min(STAT_MAX, u.hp + 1);
        effets.push({ uid: u.uid, a: 1, h: 1, festin: true });
    }
    return effets;
}

// ---------- Adversaire IA ----------

// Construit une équipe dont la force suit le numéro du tour
export function genererAdversaire(tour, rng = Math.random) {
    const palier = palierDuTour(tour);
    const nb = Math.min(TAILLE_EQUIPE, tour + 1);
    const noms = Object.keys(FAMILLES);
    const principale = noms[Math.floor(rng() * noms.length)];
    const ids = idsDisponibles(palier);
    const equipe = [];
    for (let i = 0; i < nb; i++) {
        const deFamille = ids.filter(id => [].concat(ROBOTS[id].famille).includes(principale));
        const candidats = rng() < 0.55 && deFamille.length ? deFamille : ids;
        // Les paliers élevés sont plus fréquents
        const poids = candidats.map(id => 1 + ROBOTS[id].palier * 0.8);
        let t = rng() * poids.reduce((a, b) => a + b, 0), choix = candidats[0];
        for (let k = 0; k < candidats.length; k++) { t -= poids[k]; if (t <= 0) { choix = candidats[k]; break; } }
        const u = creerUnite(choix);
        if (rng() < (tour - 5) * 0.1) u.niveau = 2;
        if (u.niveau === 2 && rng() < (tour - 10) * 0.08) u.niveau = 3;
        u.atk += u.niveau - 1;
        u.hp += u.niveau - 1;
        // Bonus de stats réparti au hasard, comme les améliorations d'un vrai joueur
        let bonus = Math.round((tour - 1) * (0.75 + rng() * 0.5));
        while (bonus-- > 0) rng() < 0.5 ? u.atk++ : u.hp++;
        // À partir du tour 3, certains robots adverses portent un équipement
        const equipables = EQUIPEMENTS.filter(id => OBJETS[id].palier <= palier);
        if (rng() < Math.min(0.5, (tour - 2) * 0.08)) u.objet = equipables[Math.floor(rng() * equipables.length)];
        equipe.push(u);
    }
    // Les robots robustes devant, les fragiles derrière
    equipe.sort((a, b) => b.hp - a.hp);
    return equipe;
}

// Boss des tours 5, 10 et 15 : un seul robot géant, plus fort et de plus haut niveau à chaque fois
export function genererBoss(tour, rng = Math.random) {
    const id = BOSS[Math.floor(rng() * BOSS.length)];
    const niveau = Math.min(3, Math.max(1, Math.floor(tour / 5)));
    // Stats de base = force au tour 10 ; plus faible au premier boss, plus fort ensuite
    const force = [0.65, 1.2, 2][niveau - 1] + Math.max(0, tour - 15) * 0.15;
    return [creerUnite(id, { niveau, atk: Math.round(ROBOTS[id].atk * force), hp: Math.round(ROBOTS[id].hp * force) })];
}
