// Données de Circuit Brawl : familles et robots.
// Chaque capacité reçoit un contexte c : c.moi, c.L (niveau 1-3), c.rng, c.buff(cible, atk, pv), c.auHasard(liste, n)
// En combat : c.allies, c.ennemis, c.index, c.degats(cible, n), c.bouclier(cible, n), c.invoquer(id, atk, pv, index), c.cible,
//             c.bruler(u, n), c.geler(u), c.rouiller(u, n), c.soigner(u, n), c.ranimer(mort, pv),
//             c.nettoyer(u) (retire les statuts), c.vacciner(u) (immunisé jusqu'à la fin du premier échange),
//             c.imiter(allie) (joue sa capacité de début de combat)
// En boutique : c.equipe (5 cases), c.devant(), c.derriere(), c.autres() (de l'avant vers l'arrière), c.gagnerCredits(n),
//               c.compteur() (+1 et renvoie la valeur), c.evoluer(id, atk, pv), c.resultat (après un combat), c.echanger(a, b)
// Déclencheurs : achat, vente, debutTour, finTour, apresCombat (boutique) · debutCombat, apresAttaque, tue, blesse, mort,
//                avantAttaque, allieInvoque, allieMort, ennemiMort, allieSoigne (c.valeur), allieBouclierBrise, apresEchange (combat)
//                · allieObjet (boutique)
// En boutique, c.cuisiner(objet, cible) donne gratuitement un objet de la boutique (famille Cuisiniers).
// famille peut être un tableau : un robot hybride compte pour ses deux familles.
// Invocations : leurs PV valent le niveau de l'invocateur (1, 2 ou 3) ; seule l'attaque grandit.

// Chance de cuisiner à chaque fin de tour pour les petits cuisiniers, selon le niveau (1 à 3)
const CHANCE_CUISINE = [0.4, 0.55, 0.7];
const chance = L => `${Math.round(CHANCE_CUISINE[L - 1] * 100)} % de chance`;
const reussit = c => c.rng() < CHANCE_CUISINE[c.L - 1];

export const FAMILLES = {
    drone: { nom: 'Drones',   couleur: '#4cc3ff', sombre: '#1d6fb8', clair: '#c9f0ff', puce: 'bg-sky-400',
             bonus: ['Après chaque échange : 1 dégât à un ennemi au hasard', 'Après chaque échange : 1 dégât à 2 ennemis au hasard'] },
    mecha: { nom: 'Méchas',   couleur: '#ff6b6b', sombre: '#b8323a', clair: '#ffd3d3', puce: 'bg-rose-400',
             bonus: ['Chaque nouveau robot de tête reçoit un bouclier de 2', 'Chaque nouveau robot de tête reçoit un bouclier de 4'] },
    nano:  { nom: 'Nanobots', couleur: '#4be08a', sombre: '#1f9c55', clair: '#c8f7dc', puce: 'bg-emerald-400',
             bonus: ['Invocations +2 attaque', 'Invocations +4 attaque'] },
    ia:    { nom: 'IA',       couleur: '#b67cff', sombre: '#6d3fc0', clair: '#ecdcff', puce: 'bg-purple-400',
             bonus: ['La première attaque ennemie du combat est annulée', 'Les 2 premières attaques ennemies du combat sont annulées'] },
    medic:   { nom: 'Médicaux',   couleur: '#ff8fab', sombre: '#c2185b', clair: '#ffe3ea', puce: 'bg-pink-400',
               bonus: ['Ton premier allié détruit revient à 1 PV', 'Ton premier allié détruit revient avec la moitié de ses PV'] },
    cuisine: { nom: 'Cuisiniers', couleur: '#ffa94d', sombre: '#c2410c', clair: '#ffe8cc', puce: 'bg-orange-400',
               bonus: ['Après chaque victoire : +1/+1 permanent à un allié au hasard', 'Après chaque victoire : +1/+1 permanent à 2 alliés au hasard'] },
};

export const SEUILS_SYNERGIE = [2, 4];

export const STATUTS = {
    brulure: { icone: '🔥', nom: 'Brûlure', desc: n => `Subit ${n} dégâts au début de chaque échange, puis la brûlure baisse de 1.` },
    gel:     { icone: '❄️', nom: 'Gel', desc: () => 'Sa prochaine attaque n’inflige aucun dégât.' },
    rouille: { icone: '🟤', nom: 'Rouille', desc: n => `Subit ${n} dégât${n > 1 ? 's' : ''} de plus à chaque coup.` },
};

// Rareté utilisée plus tard par les packs
export const RARETES = {
    commun:     { nom: 'Commun',     texte: 'text-slate-300' },
    rare:       { nom: 'Rare',       texte: 'text-sky-300' },
    epique:     { nom: 'Épique',     texte: 'text-purple-300' },
    legendaire: { nom: 'Légendaire', texte: 'text-amber-300' },
};

const s = n => (n > 1 ? 's' : '');

export const ROBOTS = {
    // ---------- Palier 1 ----------
    eclaireur: {
        nom: 'Éclaireur', famille: 'drone', palier: 1, atk: 2, hp: 3, rarete: 'commun',
        desc: L => `Début du combat : inflige ${L} dégât${s(L)} à un ennemi au hasard.`,
        debutCombat: c => c.degats(c.auHasard(c.ennemis)[0], c.L),
    },
    kamikaze: {
        nom: 'Kamikaze', famille: 'drone', palier: 1, atk: 3, hp: 2, rarete: 'commun',
        desc: L => `Destruction : inflige ${2 * L} dégâts au robot ennemi de tête et lui met Brûlure ${L}.`,
        mort: c => { c.degats(c.ennemis[0], 2 * c.L); c.bruler(c.ennemis[0], c.L); },
    },
    replicateur: {
        nom: 'Réplicateur', famille: 'nano', palier: 1, atk: 3, hp: 5, rarete: 'commun',
        desc: L => `Destruction : invoque un nano ${L}/${L}.`,
        mort: c => c.invoquer('nano', c.L, c.L, c.index),
    },
    recycleur: {
        nom: 'Recycleur', famille: 'mecha', palier: 1, atk: 2, hp: 4, rarete: 'commun',
        desc: L => `Vente : donne +${L} PV à 2 alliés au hasard.`,
        vente: c => c.auHasard(c.autres(), 2).forEach(u => c.buff(u, 0, c.L)),
    },
    ping: {
        nom: 'Ping', famille: 'ia', palier: 1, atk: 2, hp: 4, rarete: 'commun',
        desc: L => `Fin du tour : donne +${L} attaque au robot devant lui.`,
        finTour: c => c.buff(c.devant(), c.L, 0),
    },
    plaqueur: {
        nom: 'Plaqueur', famille: 'mecha', palier: 1, atk: 2, hp: 4, rarete: 'commun',
        desc: L => `Début du combat : gagne un bouclier de ${2 * L}.`,
        debutCombat: c => c.bouclier(c.moi, 2 * c.L),
    },
    nanite: {
        nom: 'Nanite', famille: 'nano', palier: 1, atk: 3, hp: 5, rarete: 'commun',
        desc: L => `Vente : donne +${L}/+${L} au robot de tête.`,
        vente: c => c.buff(c.autres()[0], c.L, c.L),
    },

    // ---------- Palier 2 ----------
    overclock: {
        nom: 'Overclock', famille: 'ia', palier: 2, atk: 3, hp: 4, rarete: 'commun',
        desc: L => `Achat : donne +${L}/+${L} au robot derrière lui.`,
        achat: c => c.buff(c.derriere(), c.L, c.L),
    },
    ruche: {
        nom: 'Ruche', famille: 'drone', palier: 2, atk: 2, hp: 4, rarete: 'commun',
        desc: L => `Destruction : invoque ${L + 1} mini-drones 1/1.`,
        mort: c => { for (let i = 0; i <= c.L; i++) c.invoquer('minidrone', 1, 1, c.index); },
    },
    soudeur: {
        nom: 'Soudeur', famille: 'mecha', palier: 2, atk: 2, hp: 5, rarete: 'commun',
        desc: L => `Fin du tour : donne +${L} PV au robot devant lui.`,
        finTour: c => c.buff(c.devant(), 0, c.L),
    },
    assembleur: {
        nom: 'Assembleur', famille: 'nano', palier: 2, atk: 3, hp: 6, rarete: 'commun',
        desc: L => `Quand un allié est invoqué : lui donne +${L + 1} attaque.`,
        allieInvoque: c => c.buff(c.cible, c.L + 1, 0),
    },
    frelon: {
        nom: 'Frelon', famille: 'drone', palier: 2, atk: 3, hp: 3, rarete: 'commun',
        desc: L => `Début du combat : gagne +${L} attaque par autre Drone allié.`,
        debutCombat: c => {
            const n = c.allies.filter(u => u !== c.moi && aFamille(u, 'drone')).length;
            if (n) c.buff(c.moi, n * c.L, 0);
        },
    },
    depanneuse: {
        nom: 'Dépanneuse', famille: 'mecha', palier: 2, atk: 2, hp: 4, rarete: 'commun',
        desc: L => `Destruction : donne +${L}/+${L} aux 2 robots derrière elle.`,
        mort: c => c.allies.slice(c.index, c.index + 2).forEach(u => c.buff(u, c.L, c.L)),
    },
    parefeu: {
        nom: 'Pare-feu', famille: 'ia', palier: 2, atk: 3, hp: 4, rarete: 'commun',
        desc: L => `Début du combat : donne un bouclier de ${2 * L} aux 2 robots de tête.`,
        debutCombat: c => c.allies.slice(0, 2).forEach(u => c.bouclier(u, 2 * c.L)),
    },

    // ---------- Palier 3 ----------
    bulldozer: {
        nom: 'Bulldozer', famille: 'mecha', palier: 3, atk: 2, hp: 6, rarete: 'rare',
        desc: L => `Dégâts subis : gagne +${L} attaque.`,
        blesse: c => c.buff(c.moi, c.L, 0),
    },
    intercepteur: {
        nom: 'Intercepteur', famille: 'drone', palier: 3, atk: 4, hp: 3, rarete: 'rare',
        desc: L => `Début du combat : inflige ${2 * L} dégâts à l’ennemi le plus fragile.`,
        debutCombat: c => c.degats([...c.ennemis].sort((a, b) => a.hp - b.hp)[0], 2 * c.L),
    },
    mitose: {
        nom: 'Mitose', famille: 'nano', palier: 3, atk: 4, hp: 6, rarete: 'rare',
        desc: L => `Destruction : invoque un nano ${3 * L}/${L}.`,
        mort: c => c.invoquer('nano', 3 * c.L, c.L, c.index),
    },
    routeur: {
        nom: 'Routeur', famille: 'ia', palier: 3, atk: 3, hp: 5, rarete: 'rare',
        desc: L => `Début du combat : donne +${L} attaque aux robots juste devant et derrière lui.`,
        debutCombat: c => [c.allies[c.index - 1], c.allies[c.index + 1]].forEach(u => c.buff(u, c.L, 0)),
    },
    cocon: {
        nom: 'Cocon', famille: 'nano', palier: 3, atk: 2, hp: 8, rarete: 'rare',
        desc: L => `Premiers dégâts subis : invoque un nano ${2 * L}/${L} derrière lui.`,
        blesse: c => {
            if (c.moi.coconOuvert) return;
            c.moi.coconOuvert = true;
            c.invoquer('nano', 2 * c.L, c.L, c.index + 1);
        },
    },
    forgeron: {
        nom: 'Forgeron', famille: 'mecha', palier: 3, atk: 2, hp: 5, rarete: 'rare',
        desc: L => `Fin du tour : donne +${L} attaque aux autres Méchas alliés.`,
        finTour: c => c.autres().filter(u => aFamille(u, 'mecha')).forEach(u => c.buff(u, c.L, 0)),
    },
    oracle: {
        nom: 'Oracle', famille: 'ia', palier: 3, atk: 3, hp: 4, rarete: 'rare',
        desc: L => `Début du tour : gagne ${L} crédit${s(L)} supplémentaire${s(L)}.`,
        debutTour: c => c.gagnerCredits(c.L),
    },

    // ---------- Palier 4 ----------
    hacker: {
        nom: 'Hacker', famille: 'ia', palier: 4, atk: 4, hp: 5, rarete: 'rare',
        desc: L => `Début du combat : vole ${2 * L} attaque à l’ennemi le plus fort.`,
        debutCombat: c => {
            const cible = [...c.ennemis].sort((a, b) => b.atk - a.atk)[0];
            if (!cible) return;
            const vol = Math.min(2 * c.L, cible.atk);
            c.buff(cible, -vol, 0);
            c.buff(c.moi, vol, 0);
        },
    },
    canonnier: {
        nom: 'Canonnier', famille: 'mecha', palier: 4, atk: 4, hp: 6, rarete: 'rare',
        desc: L => `Après son attaque : inflige ${2 * L} dégâts au robot derrière sa cible.`,
        apresAttaque: c => c.degats(c.ennemis[c.ennemis.indexOf(c.cible) + 1], 2 * c.L),
    },
    chef: {
        nom: 'Chef d’escadrille', famille: 'drone', palier: 4, atk: 3, hp: 4, rarete: 'rare',
        desc: L => `Début du combat : donne +${L}/+${L} aux autres Drones alliés.`,
        debutCombat: c => c.allies.filter(u => u !== c.moi && aFamille(u, 'drone')).forEach(u => c.buff(u, c.L, c.L)),
    },
    absorbeur: {
        nom: 'Absorbeur', famille: 'nano', palier: 4, atk: 4, hp: 7, rarete: 'rare',
        desc: L => `Quand un allié est détruit : gagne +${L}/+${L}.`,
        allieMort: c => c.buff(c.moi, c.L, c.L),
    },
    sniper: {
        nom: 'Sniper', famille: 'drone', palier: 4, atk: 5, hp: 3, rarete: 'rare',
        desc: L => `Début du combat : inflige ${3 * L} dégâts au robot ennemi le plus en arrière.`,
        debutCombat: c => c.degats(c.ennemis[c.ennemis.length - 1], 3 * c.L),
    },
    nanoforge: {
        nom: 'Nano-forge', famille: 'nano', palier: 4, atk: 3, hp: 6, rarete: 'rare',
        desc: L => `Avant chacune de ses attaques : gagne +${L}/+${L} jusqu’à la fin du combat.`,
        avantAttaque: c => c.buff(c.moi, c.L, c.L),
    },
    virus: {
        nom: 'Virus', famille: 'ia', palier: 4, atk: 4, hp: 4, rarete: 'rare',
        desc: L => `Début du combat : met Rouille ${L} à tous les ennemis (ils subissent +${L} dégât${s(L)} par coup).`,
        debutCombat: c => [...c.ennemis].forEach(u => c.rouiller(u, c.L)),
    },

    // ---------- Palier 5 ----------
    matrice: {
        nom: 'Matrice', famille: 'nano', palier: 5, atk: 5, hp: 8, rarete: 'epique',
        desc: L => `Début du combat : invoque un nano ${3 * L}/${L} derrière elle.`,
        debutCombat: c => c.invoquer('nano', 3 * c.L, c.L, c.index + 1),
    },
    noyau: {
        nom: 'Noyau central', famille: 'ia', palier: 5, atk: 5, hp: 7, rarete: 'epique',
        desc: L => `Fin du tour : donne +${L}/+${L} à 2 autres alliés au hasard.`,
        finTour: c => c.auHasard(c.autres(), 2).forEach(u => c.buff(u, c.L, c.L)),
    },
    rempart: {
        nom: 'Rempart', famille: 'mecha', palier: 5, atk: 3, hp: 9, rarete: 'epique',
        desc: L => `Début du combat : donne un bouclier de ${3 * L} au robot de tête.`,
        debutCombat: c => c.bouclier(c.allies[0], 3 * c.L),
    },
    faucheur: {
        nom: 'Faucheur', famille: 'drone', palier: 5, atk: 5, hp: 5, rarete: 'epique',
        desc: L => `Quand il détruit un ennemi : gagne +${2 * L}/+${L}.`,
        tue: c => c.buff(c.moi, 2 * c.L, c.L),
    },
    bombardier: {
        nom: 'Bombardier', famille: 'drone', palier: 5, atk: 4, hp: 6, rarete: 'epique',
        desc: L => `Début du combat : inflige ${2 * L} dégâts aux 2 robots ennemis de tête.`,
        debutCombat: c => c.ennemis.slice(0, 2).forEach(u => c.degats(u, 2 * c.L)),
    },
    colonie: {
        nom: 'Colonie', famille: 'nano', palier: 5, atk: 4, hp: 9, rarete: 'epique',
        desc: L => `Destruction : invoque 3 nanos ${2 * L}/${L}.`,
        mort: c => { for (let i = 0; i < 3; i++) c.invoquer('nano', 2 * c.L, c.L, c.index); },
    },

    // ---------- Palier 6 ----------
    titan: {
        nom: 'Titan', famille: 'mecha', palier: 6, atk: 6, hp: 11, rarete: 'legendaire',
        desc: L => `Destruction : inflige ${5 * L} dégâts à tous les ennemis.`,
        mort: c => [...c.ennemis].forEach(u => c.degats(u, 5 * c.L)),
    },
    portedrones: {
        nom: 'Porte-drones', famille: 'drone', palier: 6, atk: 5, hp: 8, rarete: 'legendaire',
        desc: L => `Dégâts subis : invoque un mini-drone ${2 * L}/${L}.`,
        blesse: c => c.invoquer('minidrone', 2 * c.L, c.L, c.index + 1),
    },
    singularite: {
        nom: 'Singularité', famille: 'ia', palier: 6, atk: 5, hp: 9, rarete: 'legendaire',
        desc: L => `Début du combat : donne +${L}/+${L} à tous les autres alliés.`,
        debutCombat: c => c.allies.filter(u => u !== c.moi).forEach(u => c.buff(u, c.L, c.L)),
    },
    essaimgris: {
        nom: 'Essaim gris', famille: 'nano', palier: 6, atk: 7, hp: 9, rarete: 'legendaire',
        desc: L => `Destruction : invoque 2 nanos ${4 * L}/${L}.`,
        mort: c => { c.invoquer('nano', 4 * c.L, c.L, c.index); c.invoquer('nano', 4 * c.L, c.L, c.index); },
    },
    forteresse: {
        nom: 'Forteresse', famille: 'mecha', palier: 6, atk: 5, hp: 13, rarete: 'legendaire',
        desc: L => `Début du combat : donne un bouclier de ${3 * L} à toute l’équipe.`,
        debutCombat: c => [...c.allies].forEach(u => c.bouclier(u, 3 * c.L)),
    },
    hyperviseur: {
        nom: 'Hyperviseur', famille: 'ia', palier: 6, atk: 6, hp: 8, rarete: 'legendaire',
        desc: L => `Fin du tour : donne +${L}/+${L} à tous les autres alliés.`,
        finTour: c => c.autres().forEach(u => c.buff(u, c.L, c.L)),
    },

    // ---------- Famille Médicaux : soins (jamais au-delà des PV de départ) et réanimations ----------
    infirmier: {
        nom: 'Infirmier', famille: 'medic', palier: 1, atk: 2, hp: 4, rarete: 'commun',
        desc: L => `Après chaque échange : soigne ${L} PV au robot de tête.`,
        apresEchange: c => c.soigner(c.allies[0], c.L),
    },
    rustine: {
        nom: 'Rustine', famille: 'medic', palier: 1, atk: 1, hp: 3, rarete: 'commun',
        desc: L => `Dégâts subis : se soigne de ${L} PV.`,
        blesse: c => c.soigner(c.moi, c.L),
    },
    ambulance: {
        nom: 'Ambulance', famille: 'medic', palier: 2, atk: 3, hp: 5, rarete: 'commun',
        desc: L => `Quand un allié est détruit : soigne ${L} PV à toute l’équipe.`,
        allieMort: c => [...c.allies].forEach(u => c.soigner(u, c.L)),
    },
    chirurgien: {
        nom: 'Chirurgien', famille: 'medic', palier: 3, atk: 3, hp: 6, rarete: 'rare',
        desc: L => `Après chaque échange : soigne ${2 * L} PV à l’allié le plus blessé.`,
        apresEchange: c => {
            const blesse = [...c.allies].sort((a, b) => (b.pvMax - b.hp) - (a.pvMax - a.hp))[0];
            if (blesse && blesse.hp < blesse.pvMax) c.soigner(blesse, 2 * c.L);
        },
    },
    defibrillateur: {
        nom: 'Défibrillateur', famille: 'medic', palier: 3, atk: 4, hp: 4, rarete: 'rare',
        desc: L => `La première fois qu’un allié est détruit : le ranime avec ${2 * L} PV.`,
        allieMort: c => {
            if (c.moi.defibUtilise || c.cible.ranime) return;
            c.moi.defibUtilise = true;
            c.ranimer(c.cible, 2 * c.L);
        },
    },
    hopital: {
        nom: 'Hôpital mobile', famille: 'medic', palier: 4, atk: 4, hp: 8, rarete: 'rare',
        desc: L => `Après chaque échange : soigne ${L} PV à toute l’équipe.`,
        apresEchange: c => [...c.allies].forEach(u => c.soigner(u, c.L)),
    },
    medecinchef: {
        nom: 'Médecin-chef', famille: 'medic', palier: 5, atk: 5, hp: 7, rarete: 'epique',
        desc: L => `Quand un allié est soigné : il gagne aussi +${L} attaque.`,
        allieSoigne: c => c.buff(c.cible, c.L, 0),
    },
    phenix: {
        nom: 'Phénix médical', famille: 'medic', palier: 6, atk: 6, hp: 10, rarete: 'legendaire',
        desc: () => 'Destruction : revient une fois avec toutes ses stats et soigne toute l’équipe de 3 PV.',
        mort: c => {
            if (c.moi.ranime) return;
            c.ranimer(c.moi, c.moi.pvMax);
            [...c.allies].forEach(u => c.soigner(u, 3));
        },
    },

    // ---------- Famille Cuisiniers : cuisinent des objets gratuits pour l'équipe en fin de tour ----------
    grillepain: {
        nom: 'Grille-pain', famille: 'cuisine', palier: 1, atk: 2, hp: 2, rarete: 'commun',
        desc: L => `Fin du tour, ${chance(L)} : cuisine une Batterie 🔋 (+1/+1) pour le robot devant lui.`,
        finTour: c => { if (reussit(c)) c.cuisiner('batterie', c.devant() ?? c.moi); },
    },
    mixeur: {
        nom: 'Mixeur', famille: 'cuisine', palier: 1, atk: 1, hp: 3, rarete: 'commun',
        desc: L => `Fin du tour, ${chance(L)} : cuisine une Batterie 🔋 (+1/+1) pour un allié au hasard.`,
        finTour: c => { if (reussit(c)) c.cuisiner('batterie', c.auHasard(c.autres(), 1)[0] ?? c.moi); },
    },
    microondes: {
        nom: 'Micro-ondes', famille: 'cuisine', palier: 2, atk: 3, hp: 2, rarete: 'commun',
        desc: L => `Début du combat : réchauffe l’ennemi de tête (Brûlure ${L + 1}).`,
        debutCombat: c => c.bruler(c.ennemis[0], c.L + 1),
    },
    frigo: {
        nom: 'Frigo', famille: 'cuisine', palier: 2, atk: 1, hp: 5, rarete: 'commun',
        desc: L => `Fin du tour, ${chance(L)} : cuisine une Puce turbo 💾 (+3/+3 pour le prochain combat) pour le robot de tête.`,
        finTour: c => { if (reussit(c)) c.cuisiner('puce', c.equipe.find(Boolean)); },
    },
    chefcuistot: {
        nom: 'Chef cuistot', famille: 'cuisine', palier: 3, atk: 3, hp: 4, rarete: 'rare',
        desc: L => `Le premier objet reçu par un allié chaque tour (boutique ou cuisine) : lui donne +${L} PV en plus.`,
        debutTour: c => { c.moi.servi = false; },
        allieObjet: c => { if (!c.moi.servi) { c.moi.servi = true; c.buff(c.cible, 0, c.L); } },
    },
    four: {
        nom: 'Four', famille: 'cuisine', palier: 4, atk: 3, hp: 6, rarete: 'rare',
        desc: L => `Fin du tour : cuisine un Kit de secours 🧰 pour le premier allié sans équipement et lui donne +${L} PV.`,
        finTour: c => {
            const cible = c.equipe.find(u => u && !u.objet);
            if (!cible) return;
            c.cuisiner('kit', cible);
            c.buff(cible, 0, c.L);
        },
    },
    traiteur: {
        nom: 'Traiteur', famille: 'cuisine', palier: 5, atk: 4, hp: 6, rarete: 'epique',
        desc: L => `Un tour sur deux, en fin de tour : cuisine ${L === 1 ? 'un Pack de batteries 🔌' : `${L} Packs de batteries 🔌`} (+1/+1 à 3 robots au hasard).`,
        finTour: c => {
            c.moi.cuisson = !c.moi.cuisson;
            if (c.moi.cuisson) for (let i = 0; i < c.L; i++) c.cuisiner('pack', c.moi);
        },
    },
    grandchef: {
        nom: 'Grand chef', famille: 'cuisine', palier: 6, atk: 5, hp: 8, rarete: 'legendaire',
        desc: L => `Un tour sur deux, en fin de tour : cuisine un Réacteur ☢️ (+2/+2 à toute l’équipe)${L > 1 ? ` et ${L - 1} Batterie${s(L - 1)} 🔋 pour lui-même` : ''}.`,
        finTour: c => {
            c.moi.cuisson = !c.moi.cuisson;
            if (!c.moi.cuisson) return;
            c.cuisiner('reacteur', c.moi);
            for (let i = 1; i < c.L; i++) c.cuisiner('batterie', c.moi);
        },
    },

    // ---------- Statuts : brûlure, gel, rouille ----------
    cryodrone: {
        nom: 'Cryo-drone', famille: 'drone', palier: 2, atk: 2, hp: 4, rarete: 'commun',
        desc: L => `Début du combat : gèle ${L === 1 ? 'le robot ennemi de tête' : `les ${L} robots ennemis de tête`} (leur prochaine attaque est annulée).`,
        debutCombat: c => c.ennemis.slice(0, c.L).forEach(u => c.geler(u)),
    },
    lanceflammes: {
        nom: 'Lance-flammes', famille: 'mecha', palier: 3, atk: 3, hp: 5, rarete: 'rare',
        desc: L => `Après son attaque : met Brûlure ${2 * L} à sa cible.`,
        apresAttaque: c => c.bruler(c.cible, 2 * c.L),
    },
    nanorouille: {
        nom: 'Nano-rouille', famille: 'nano', palier: 2, atk: 3, hp: 6, rarete: 'commun',
        desc: L => `Destruction : met Rouille ${L} à tous les ennemis.`,
        mort: c => [...c.ennemis].forEach(u => c.rouiller(u, c.L)),
    },

    // ---------- Hybrides : comptent pour deux familles ----------
    droneambulance: {
        nom: 'Drone-ambulance', famille: ['drone', 'medic'], palier: 3, atk: 3, hp: 3, rarete: 'rare',
        desc: L => `Après son attaque : soigne ${2 * L} PV à l’allié le plus blessé.`,
        apresAttaque: c => {
            const blesse = [...c.allies].filter(u => u.hp > 0).sort((a, b) => (b.pvMax - b.hp) - (a.pvMax - a.hp))[0];
            if (blesse && blesse.hp < blesse.pvMax) c.soigner(blesse, 2 * c.L);
        },
    },
    golem: {
        nom: 'Golem nano', famille: ['mecha', 'nano'], palier: 4, atk: 3, hp: 6, rarete: 'rare',
        desc: L => `Destruction : invoque un nano ${3 * L}/${L} avec un bouclier de ${2 * L}.`,
        mort: c => { const n = c.invoquer('nano', 3 * c.L, c.L, c.index); if (n) c.bouclier(n, 2 * c.L); },
    },
    essaimconnecte: {
        nom: 'Essaim connecté', famille: ['ia', 'drone'], palier: 4, atk: 3, hp: 3, rarete: 'rare',
        desc: L => `Début du combat : donne +${L} attaque aux autres Drones et IA alliés.`,
        debutCombat: c => c.allies.filter(u => u !== c.moi && (aFamille(u, 'drone') || aFamille(u, 'ia'))).forEach(u => c.buff(u, c.L, 0)),
    },
    cantine: {
        nom: 'Cantine blindée', famille: ['mecha', 'cuisine'], palier: 5, atk: 3, hp: 7, rarete: 'epique',
        desc: L => `Fin du tour : cuisine un Blindage 🛡️ pour le premier allié sans équipement et lui donne +${L} PV.`,
        finTour: c => {
            const cible = c.equipe.find(u => u && !u.objet);
            if (!cible) return;
            c.cuisiner('blindage', cible);
            c.buff(cible, 0, c.L);
        },
    },
    rucheneuronale: {
        nom: 'Ruche neuronale', famille: ['ia', 'nano'], palier: 5, atk: 4, hp: 5, rarete: 'epique',
        desc: L => `Quand un allié est invoqué : donne +${L}/+${L} à tous les IA et Nanobots alliés.`,
        allieInvoque: c => c.allies.filter(u => aFamille(u, 'ia') || aFamille(u, 'nano')).forEach(u => c.buff(u, c.L, c.L)),
    },

    // ---------- Évolutions en cours de run ----------
    prototype: {
        nom: 'Prototype', famille: 'ia', palier: 1, atk: 2, hp: 3, rarete: 'commun', evolution: 3,
        desc: () => 'Après chaque victoire : compteur +1. À 3, évolue en Prototype Ω (+3/+3).',
        apresCombat: c => { if (c.resultat === 'victoire' && c.compteur() >= 3) c.evoluer('prototypeomega', 3, 3); },
    },
    prototypeomega: {
        nom: 'Prototype Ω', famille: 'ia', palier: 1, atk: 5, hp: 6, rarete: 'epique', horsBoutique: true,
        desc: L => `Évolué. Début du combat : donne +${L}/+${L} à tous les autres alliés.`,
        debutCombat: c => c.allies.filter(u => u !== c.moi).forEach(u => c.buff(u, c.L, c.L)),
    },
    chrysalide: {
        nom: 'Chrysalide', famille: 'nano', palier: 2, atk: 2, hp: 6, rarete: 'commun', evolution: 4,
        desc: () => 'Fin du tour : compteur +1. À 4, éclot en Papillon nano (+2/+2).',
        finTour: c => { if (c.compteur() >= 4) c.evoluer('papillon', 2, 2); },
    },
    papillon: {
        nom: 'Papillon nano', famille: 'nano', palier: 2, atk: 4, hp: 8, rarete: 'epique', horsBoutique: true,
        desc: L => `Évolué. Début du combat : invoque 2 nanos ${L + 1}/${L} derrière lui.`,
        debutCombat: c => { c.invoquer('nano', c.L + 1, c.L, c.index + 1); c.invoquer('nano', c.L + 1, c.L, c.index + 1); },
    },

    // ---------- Renforts : Médicaux ----------
    pansebot: {
        nom: 'Pansebot', famille: 'medic', palier: 1, atk: 2, hp: 4, rarete: 'commun',
        desc: L => `Fin du tour : met un pansement au robot de tête (+${2 * L} PV pour le prochain combat).`,
        finTour: c => c.buffTemp(c.equipe.find(Boolean), 0, 2 * c.L),
    },
    brancardier: {
        nom: 'Brancardier', famille: 'medic', palier: 2, atk: 3, hp: 5, rarete: 'commun',
        desc: L => `Quand l’allié juste devant lui est détruit : prend sa place et gagne un bouclier de ${2 * L}.`,
        allieMort: c => { if (c.index === c.cible.indexMort) c.bouclier(c.moi, 2 * c.L); },
    },
    vaccin: {
        nom: 'Vaccin', famille: 'medic', palier: 4, atk: 3, hp: 6, rarete: 'rare', prioritaire: true,
        desc: L => `Début du combat, avant tout le monde : les alliés sont immunisés aux statuts jusqu’à la fin du premier échange${L > 1 ? ` et gagnent +${L - 1} PV` : ''}.`,
        debutCombat: c => [...c.allies].forEach(u => { c.vacciner(u); if (c.L > 1) c.buff(u, 0, c.L - 1); }),
    },

    // ---------- Renforts : Cuisiniers ----------
    barista: {
        nom: 'Barista', famille: 'cuisine', palier: 1, atk: 2, hp: 2, rarete: 'commun',
        desc: L => `Fin du tour, ${chance(L)} : cuisine une Batterie 🔋 (+1/+1) pour l’allié le plus faible (le moins de stats).`,
        finTour: c => {
            if (!reussit(c)) return;
            const faible = c.equipe.filter(Boolean).sort((a, b) => a.atk + a.hp - (b.atk + b.hp))[0];
            c.cuisiner('batterie', faible);
        },
    },
    glacier: {
        nom: 'Glacier', famille: 'cuisine', palier: 3, atk: 2, hp: 4, rarete: 'rare',
        desc: L => `Début du combat : gèle ${L === 1 ? 'l’ennemi le plus fort' : `les ${L} ennemis les plus forts`}.`,
        debutCombat: c => [...c.ennemis].sort((a, b) => b.atk - a.atk).slice(0, c.L).forEach(u => c.geler(u)),
    },
    foodtruck: {
        nom: 'Food-truck', famille: 'cuisine', palier: 4, atk: 3, hp: 5, rarete: 'rare',
        desc: L => `Vente : cuisine ${L === 1 ? 'une Batterie 🔋' : `${L} Batteries 🔋`} pour chaque allié.`,
        vente: c => c.autres().forEach(u => { for (let i = 0; i < c.L; i++) c.cuisiner('batterie', u); }),
    },

    // ---------- Renforts : Drones ----------
    moustique: {
        nom: 'Moustique', famille: 'drone', palier: 1, atk: 2, hp: 3, rarete: 'commun',
        desc: L => `Après son attaque : met Brûlure ${L} à sa cible.`,
        apresAttaque: c => c.bruler(c.cible, c.L),
    },
    escadrille: {
        nom: 'Escadrille', famille: 'drone', palier: 3, atk: 3, hp: 5, rarete: 'rare',
        desc: L => `Début du combat : invoque un mini-drone ${L + 1}/${L} par emplacement vide.`,
        debutCombat: c => {
            const vides = 5 - c.allies.length;
            for (let i = 0; i < vides; i++) c.invoquer('minidrone', c.L + 1, c.L, c.allies.indexOf(c.moi) + 1);
        },
    },
    dronemiroir: {
        nom: 'Drone-miroir', famille: 'drone', palier: 5, atk: 5, hp: 6, rarete: 'epique',
        desc: L => `Début du combat : copie la capacité de début de combat de l’allié devant lui (à son niveau à lui). Sinon, gagne +${2 * L}/+${2 * L}.`,
        debutCombat: c => { if (!c.imiter(c.allies[c.index - 1])) c.buff(c.moi, 2 * c.L, 2 * c.L); },
    },

    // ---------- Renforts : Méchas ----------
    grue: {
        nom: 'Grue', famille: 'mecha', palier: 2, atk: 2, hp: 5, rarete: 'commun',
        desc: L => `Fin du tour : met le robot le plus robuste en tête de l’équipe et donne +${L} PV aux deux robots déplacés.`,
        finTour: c => {
            const tete = c.equipe.find(Boolean);
            const robuste = c.equipe.filter(Boolean).sort((a, b) => b.hp - a.hp)[0];
            if (robuste === tete) return c.buff(tete, 0, c.L);
            c.echanger(tete, robuste);
            c.buff(tete, 0, c.L);
            c.buff(robuste, 0, c.L);
        },
    },
    parechocs: {
        nom: 'Pare-chocs', famille: 'mecha', palier: 4, atk: 3, hp: 7, rarete: 'rare',
        desc: L => `Quand le bouclier d’un allié se brise : gagne +${2 * L} attaque.`,
        allieBouclierBrise: c => c.buff(c.moi, 2 * c.L, 0),
    },

    // ---------- Renforts : Nanobots ----------
    nanoessaim: {
        nom: 'Nano-essaim', famille: 'nano', palier: 2, atk: 2, hp: 5, rarete: 'commun',
        desc: L => `Quand un allié est invoqué : gagne +${L} attaque.`,
        allieInvoque: c => c.buff(c.moi, c.L, 0),
    },
    recombinant: {
        nom: 'Recombinant', famille: 'nano', palier: 6, atk: 6, hp: 8, rarete: 'legendaire',
        desc: L => `Quand un allié est détruit : ${L === 1 ? 'la moitié de ses' : L === 2 ? 'les trois quarts de ses' : 'toutes ses'} stats vont à un nano recombiné, invoqué la première fois, qui grossit pendant tout le combat.`,
        allieMort: c => {
            if (c.cible.recombine) return;
            const part = [0.5, 0.75, 1][c.L - 1];
            const a = Math.ceil(c.cible.atk * part), h = Math.ceil(c.cible.pvMax * part);
            const lie = c.allies.find(u => u.uid === c.moi.nanoLie && u.hp > 0);
            if (lie) return c.buff(lie, a, h);
            const n = c.invoquer('nano', a, h, c.allies.indexOf(c.moi) + 1);
            if (n) { n.recombine = true; c.moi.nanoLie = n.uid; }
        },
    },

    // ---------- Renforts : IA ----------
    antivirus: {
        nom: 'Antivirus', famille: 'ia', palier: 3, atk: 4, hp: 4, rarete: 'rare',
        desc: L => `Après chaque échange : retire tous les statuts (brûlure, gel, rouille) des alliés${L > 1 ? ` et soigne de ${L - 1} PV chaque allié nettoyé` : ''}.`,
        apresEchange: c => [...c.allies].forEach(u => { if (c.nettoyer(u) && c.L > 1) c.soigner(u, c.L - 1); }),
    },
    stratege: {
        nom: 'Stratège', famille: 'ia', palier: 5, atk: 4, hp: 7, rarete: 'epique',
        desc: L => `Fin du tour : si l’équipe compte au moins 3 familles différentes, donne +1/+1 à ${L === 3 ? 'toute l’équipe' : `${2 * L} alliés au hasard`}.`,
        finTour: c => {
            const f = new Set(c.equipe.filter(Boolean).flatMap(u => familles(u)));
            if (f.size < 3) return;
            c.auHasard(c.equipe, c.L === 3 ? 5 : 2 * c.L).forEach(u => c.buff(u, 1, 1));
        },
    },

    // ---------- Renforts : hybrides ----------
    infirmierechef: {
        nom: 'Infirmière-chef', famille: ['medic', 'cuisine'], palier: 4, atk: 3, hp: 5, rarete: 'rare',
        desc: L => `Fin du tour : cuisine une Batterie 🔋 pour l’allié le plus faible. En combat, après chaque échange : soigne ${L} PV aux alliés qui ont reçu un plat ce tour.`,
        finTour: c => c.cuisiner('batterie', c.equipe.filter(Boolean).sort((a, b) => a.atk + a.hp - b.atk - b.hp)[0]),
        apresEchange: c => [...c.allies].filter(u => u.nourri).forEach(u => c.soigner(u, c.L)),
    },
    mechachirurgien: {
        nom: 'Mécha-chirurgien', famille: ['mecha', 'medic'], palier: 5, atk: 4, hp: 7, rarete: 'epique',
        desc: L => `Après chaque échange : soigne ${L} PV au robot de tête. Chaque soin reçu par un allié lui donne aussi un bouclier du même montant.`,
        apresEchange: c => c.soigner(c.allies[0], c.L),
        allieSoigne: c => c.bouclier(c.cible, c.valeur),
    },

    // ---------- Invocations (jamais en boutique) ----------
    minidrone: {
        nom: 'Mini-drone', famille: 'drone', palier: null, atk: 1, hp: 1,
        desc: () => 'Invocation.',
    },
    nano: {
        nom: 'Nano', famille: 'nano', palier: null, atk: 1, hp: 1,
        desc: () => 'Invocation.',
    },

    // ---------- Boss (tours 5, 10, 15) : jamais en boutique. Stats = force au tour 10 (voir genererBoss) ----------
    broyeur: {
        nom: 'Le Broyeur', famille: 'mecha', palier: null, atk: 12, hp: 48, rarete: 'legendaire', boss: true,
        desc: () => 'Boss. Après son attaque : frappe aussi le robot derrière sa cible (moitié des dégâts).',
        apresAttaque: c => {
            const derriere = c.ennemis[c.ennemis.indexOf(c.cible) + 1];
            if (derriere) c.degats(derriere, Math.ceil(c.moi.atk / 2));
        },
    },
    reinemere: {
        nom: 'La Reine-mère', famille: 'drone', palier: null, atk: 9, hp: 40, rarete: 'legendaire', boss: true,
        desc: L => `Boss. Après chaque échange : invoque un drone garde du corps ${2 * L}/${2 * L} devant elle (${L + 2} au maximum). Chaque garde détruit lui inflige 3 dégâts.`,
        apresEchange: c => {
            if ((c.moi.gardes ?? 0) >= c.L + 2) return;
            const g = c.invoquer('minidrone', 2 * c.L, 2 * c.L, 0);
            if (g) { g.gardeDe = c.moi.uid; c.moi.gardes = (c.moi.gardes ?? 0) + 1; }
        },
        allieMort: c => { if (c.cible.gardeDe === c.moi.uid) c.degats(c.moi, 3); },
    },
    hydre: {
        nom: 'L’Hydre', famille: 'nano', palier: null, atk: 11, hp: 36, rarete: 'legendaire', boss: true,
        desc: () => 'Boss. Destruction : se divise en 2 têtes avec la moitié de son attaque et de ses PV de départ.',
        mort: c => {
            for (let i = 0; i < 2; i++) c.invoquer('hydretete', Math.ceil(c.moi.atk / 2), Math.ceil(c.moi.pvMax / 2), c.index);
        },
    },
    hydretete: {
        nom: 'Tête d’Hydre', famille: 'nano', palier: null, atk: 1, hp: 1,
        desc: () => 'Invocation de l’Hydre.',
    },
};

export const BOSS = ['broyeur', 'reinemere', 'hydre'];

// Commandants : un seul, choisi au début du run. effet = règles de boutique, combat = bonus en combat (voir effetsRun).
// Aucun n'est lié à une famille précise (la Docteure aide tous les soins : Médicaux, hybrides, Antivirus…).
export const COMMANDANTS = {
    mecano:          { nom: 'Mécano',          icone: '🔧', desc: 'Vendre un robot rapporte +1 🪙.', effet: { venteBonus: 1 } },
    hackeuse:        { nom: 'Hackeuse',        icone: '💻', desc: 'La première relance de chaque tour est gratuite.', effet: { relancesGratuites: 1 } },
    general:         { nom: 'Général',         icone: '🎖️', desc: 'En combat, ton robot de tête a +1/+1.', combat: { teteA: 1, teteH: 1 } },
    banquiere:       { nom: 'Banquière',       icone: '💰', desc: '+1 🪙 un tour sur deux.', effet: { creditsTour: 0.5 } },
    docteure:        { nom: 'Docteure',        icone: '🩺', desc: 'Tous tes soins font +1.', combat: { soin: 1 } },
    gardienne:       { nom: 'Gardienne',       icone: '🛡️', desc: 'Pendant les 3 premiers échanges, les attaques ennemies font 1 dégât de moins (minimum 1).', combat: { reducDegats: 1 } },
    ingenieure:      { nom: 'Ingénieure',      icone: '🔩', desc: 'Début du combat : bouclier de 2 à tes 2 premiers robots.', combat: { bouclierAvant: 2 } },
    survivante:      { nom: 'Survivante',      icone: '🫀', desc: 'Le premier de tes robots détruit à chaque combat survit avec 1 PV.', combat: { survie: 1 } },
    collectionneuse: { nom: 'Collectionneuse', icone: '🎁', desc: 'Les robots rares, épiques et légendaires coûtent 1 🪙 de moins.', effet: { reducRare: 1 } },
    dresseur:        { nom: 'Dresseur',        icone: '🐝', desc: 'Tes invocations ont +3 attaque.', combat: { invoc: 3 } },
    marionnettiste:  { nom: 'Marionnettiste',  icone: '🎭', desc: 'Ton premier robot détruit laisse un mini-drone 1/1 à sa place.', combat: { relaisMort: 1 } },
    tacticienne:     { nom: 'Tacticienne',     icone: '🧭', desc: 'Un robot qui atteint le niveau 3 gagne +1/+1 de plus.', effet: { bonusFusion: 1 } },
    duelliste:       { nom: 'Duelliste',       icone: '⚔️', desc: 'La première attaque de ton robot de tête fait +50 % de dégâts.', combat: { premierCoup: 1 } },
};

// Modules : un choix parmi 3 aux tours 3, 6 et 9, et après chaque boss vaincu. Ils s'additionnent.
export const MODULES = {
    blindageavant: { nom: 'Blindage avant',     icone: '🛡️', desc: 'En combat, ton robot de tête commence avec un bouclier de 4.', combat: { bouclierTete: 4 } },
    overclock:     { nom: 'Overclock',          icone: '⚡', desc: 'En combat, toute ton équipe a +1 attaque.', combat: { atkTous: 1 } },
    batteriexl:    { nom: 'Batterie XL',        icone: '🔋', desc: 'En combat, toute ton équipe a +2 PV.', combat: { pvTous: 2 } },
    tapis:         { nom: 'Tapis élargi',       icone: '🛒', desc: '+1 robot sur le tapis de la boutique.', effet: { tapis: 1 } },
    coffre:        { nom: 'Coffre-fort',        icone: '🏦', desc: 'Les intérêts peuvent monter jusqu’à +4 🪙 par tour.', effet: { interetMax: 2 } },
    flammes:       { nom: 'Flammes éternelles', icone: '🔥', desc: 'Les brûlures que tu infliges font +1.', combat: { brulure: 1 } },
    cryo:          { nom: 'Cryogénie',          icone: '❄️', desc: 'Début du combat : gèle le robot ennemi de tête.', combat: { gelTete: 1 } },
    gardearriere:  { nom: 'Garde arrière',      icone: '🐢', desc: 'En combat, ton dernier robot a +3/+3.', combat: { arriereA: 3, arriereH: 3 } },
    bons:          { nom: 'Bons d’achat',       icone: '🎟️', desc: 'Les objets coûtent 1 🪙 de moins.', effet: { reducObjet: 1 } },
    assurance:     { nom: 'Assurance',          icone: '❤️‍🩹', desc: 'Les défaites coûtent 1 vie de moins (minimum 1).', effet: { assurance: 1 } },
};

// Familles d'un robot (deux pour un hybride), et la principale pour les couleurs
export const familles = u => [].concat(ROBOTS[u.id].famille);
export const aFamille = (u, f) => familles(u).includes(f);
export const famille = u => familles(u)[0];

// Objets de la boutique : consommables (effet immédiat) ou équipements (un seul par robot, gardé tant qu'on ne le remplace pas).
// Contexte : c.cible, c.robots(), c.auHasard(liste, n), c.buff(u, atk, pv), c.buffTemp(u, atk, pv), c.niveauPlus(u)
export const OBJETS = {
    batterie: {
        nom: 'Batterie', icone: '🔋', palier: 1,
        desc: 'Donne +1/+1 à un robot.',
        effet: c => c.buff(c.cible, 1, 1),
    },
    kit: {
        nom: 'Kit de secours', icone: '🧰', palier: 1, equipement: true,
        desc: 'Équipement. Destruction : invoque un mini-drone 1/1.',
    },
    titane: {
        nom: 'Plaque de titane', icone: '🔩', palier: 1,
        desc: 'Donne +3 PV à un robot.',
        effet: c => c.buff(c.cible, 0, 3),
    },
    armure: {
        nom: 'Armure', icone: '🦺', palier: 2, equipement: true,
        desc: 'Équipement. Subit 1 dégât de moins (minimum 1).',
    },
    surcharge: {
        nom: 'Surcharge', icone: '⚡', palier: 2,
        desc: 'Donne +1/+1 à 2 robots au hasard.',
        effet: c => c.auHasard(c.robots(), 2).forEach(u => c.buff(u, 1, 1)),
    },
    puce: {
        nom: 'Puce turbo', icone: '💾', palier: 2,
        desc: 'Donne +3/+3 pour le prochain combat seulement.',
        effet: c => c.buffTemp(c.cible, 3, 3),
    },
    lame: {
        nom: 'Lame', icone: '🗡️', palier: 3, equipement: true,
        desc: 'Équipement. Ses attaques infligent +3 dégâts.',
    },
    reboot: {
        nom: 'Reboot', icone: '🔁', palier: 3, equipement: true,
        desc: 'Équipement. Détruit : redémarre une fois par combat avec 1/1 (sans l’équipement).',
    },
    upgrade: {
        nom: 'Module d’upgrade', icone: '📀', palier: 3,
        desc: 'Fait gagner un niveau (+1/+1) à un robot.',
        condition: c => (c.cible.niveau >= 3 ? 'Niveau maximum atteint' : null),
        effet: c => c.niveauPlus(c.cible),
    },
    blindage: {
        nom: 'Blindage', icone: '🛡️', palier: 4, equipement: true,
        desc: 'Équipement. Subit 2 dégâts de moins (minimum 1).',
    },
    pack: {
        nom: 'Pack de batteries', icone: '🔌', palier: 4,
        desc: 'Donne +1/+1 à 3 robots au hasard.',
        effet: c => c.auHasard(c.robots(), 3).forEach(u => c.buff(u, 1, 1)),
    },
    champ: {
        nom: 'Champ de force', icone: '🫧', palier: 5, equipement: true,
        desc: 'Équipement. Début du combat : bouclier de 10.',
    },
    carburant: {
        nom: 'Super-carburant', icone: '🧪', palier: 5,
        desc: 'Donne +3/+3 à un robot.',
        effet: c => c.buff(c.cible, 3, 3),
    },
    reacteur: {
        nom: 'Réacteur', icone: '☢️', palier: 6,
        desc: 'Donne +2/+2 à toute l’équipe.',
        effet: c => c.robots().forEach(u => c.buff(u, 2, 2)),
    },
};
