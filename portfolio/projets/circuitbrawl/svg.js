// Robots dessinés en SVG, style « emoji » : gros contours, gros yeux, couleurs vives.
// Les variantes (yeux, bouche, accessoires) dépendent de l'identifiant du robot.
// Si un robot a un champ image dans data.js, l'image remplace le dessin.
import { ROBOTS, FAMILLES } from './data.js';

const ENCRE = '#1e1b2e';
const cache = new Map();

// Petit hachage stable : chaque robot garde toujours la même apparence
function variantes(id) {
    let h = 2166136261;
    for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return [0, 1, 2, 3, 4, 5].map(i => ((h >>> (i * 5)) & 31) / 31);
}

// Œil d'emoji : blanc, pupille tournée vers l'avant (droite), reflet
function oeil(cx, cy, r) {
    return `<g class="oeil"><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 1.15}" fill="#fff" stroke="${ENCRE}" stroke-width="3"/>
        <circle cx="${cx + r * 0.32}" cy="${cy + r * 0.12}" r="${r * 0.56}" fill="${ENCRE}"/>
        <circle cx="${cx + r * 0.5}" cy="${cy - r * 0.18}" r="${r * 0.2}" fill="#fff"/></g>`;
}

function yeux(cx, cy, v, r = 7.5, ecart = 10) {
    return v < 0.35 ? oeil(cx + 1, cy, r * 1.45) : oeil(cx - ecart, cy, r) + oeil(cx + ecart, cy, r);
}

function bouche(cx, cy, v) {
    if (v < 0.33) return `<path d="M${cx - 7} ${cy} Q${cx} ${cy + 7} ${cx + 7} ${cy}" stroke="${ENCRE}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    if (v < 0.66) return `<rect x="${cx - 8}" y="${cy - 3}" width="16" height="7" rx="3" fill="#fff" stroke="${ENCRE}" stroke-width="2.5"/><line x1="${cx - 3}" y1="${cy - 3}" x2="${cx - 3}" y2="${cy + 4}" stroke="${ENCRE}" stroke-width="1.5"/><line x1="${cx + 3}" y1="${cy - 3}" x2="${cx + 3}" y2="${cy + 4}" stroke="${ENCRE}" stroke-width="1.5"/>`;
    return `<ellipse cx="${cx}" cy="${cy + 1}" rx="3.5" ry="4.5" fill="${ENCRE}"/>`;
}

const reflet = (cx, cy, rx, ry, rot = -30) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".55" transform="rotate(${rot} ${cx} ${cy})"/>`;

function drone(f, v) {
    const deuxHelices = v[0] > 0.55;
    const helice = (x, y) => `
        <line x1="${x}" y1="${y + 14}" x2="${x}" y2="${y + 2}" stroke="${ENCRE}" stroke-width="4" stroke-linecap="round"/>
        <g class="helice"><ellipse cx="${x}" cy="${y}" rx="${deuxHelices ? 15 : 22}" ry="4.5" fill="${f.clair}" stroke="${ENCRE}" stroke-width="3"/></g>
        <circle cx="${x}" cy="${y + 1}" r="4" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="2.5"/>`;
    const helices = deuxHelices ? helice(32, 18) + helice(68, 18) : helice(50, 16);
    const bras = v[3] > 0.5
        ? `<circle cx="18" cy="64" r="7" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="3"/><circle cx="82" cy="64" r="7" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="3"/>`
        : `<path d="M22 58 L12 52" stroke="${ENCRE}" stroke-width="4" stroke-linecap="round"/><path d="M78 58 L88 52" stroke="${ENCRE}" stroke-width="4" stroke-linecap="round"/>`;
    return `${helices}${bras}
        <path d="M40 84 L60 84 L56 93 L44 93 Z" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="50" cy="58" r="28" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="4"/>
        <path d="M28 66 Q50 84 72 66 Q66 80 50 82 Q34 80 28 66 Z" fill="${f.sombre}" opacity=".35"/>
        ${reflet(37, 42, 9, 5)}
        ${yeux(51, 54, v[2])}
        ${bouche(52, 70, v[1])}`;
}

function mecha(f, v) {
    const bras = v[0] < 0.5
        ? `<rect x="10" y="50" width="14" height="22" rx="6" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="3"/><circle cx="17" cy="76" r="8" fill="#94a3b8" stroke="${ENCRE}" stroke-width="3"/>
           <rect x="76" y="50" width="14" height="22" rx="6" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="3"/><circle cx="83" cy="76" r="8" fill="#94a3b8" stroke="${ENCRE}" stroke-width="3"/>`
        : `<rect x="4" y="54" width="24" height="12" rx="4" fill="#94a3b8" stroke="${ENCRE}" stroke-width="3"/><rect x="72" y="54" width="24" height="12" rx="4" fill="#94a3b8" stroke="${ENCRE}" stroke-width="3"/>
           <circle cx="96" cy="60" r="3" fill="#fde047" stroke="${ENCRE}" stroke-width="2"/>`;
    const deco = v[3] < 0.4
        ? `<path d="M32 14 L26 2 L40 10 Z" fill="#fde047" stroke="${ENCRE}" stroke-width="2.5" stroke-linejoin="round"/><path d="M68 14 L74 2 L60 10 Z" fill="#fde047" stroke="${ENCRE}" stroke-width="2.5" stroke-linejoin="round"/>`
        : v[3] < 0.75
            ? `<line x1="50" y1="12" x2="50" y2="3" stroke="${ENCRE}" stroke-width="3"/><circle class="ampoule" cx="50" cy="3" r="4" fill="#fde047" stroke="${ENCRE}" stroke-width="2.5"/>`
            : `<rect x="40" y="4" width="20" height="9" rx="4" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="2.5"/>`;
    const visiere = v[2] < 0.5
        ? `<ellipse cx="42" cy="26" rx="5" ry="6" fill="${f.clair}"/><ellipse cx="60" cy="26" rx="5" ry="6" fill="${f.clair}"/><circle cx="44" cy="24" r="1.8" fill="#fff"/><circle cx="62" cy="24" r="1.8" fill="#fff"/>`
        : `<rect x="38" y="23" width="26" height="6" rx="3" fill="${f.clair}"/><rect x="54" y="23" width="8" height="6" rx="3" fill="#fff"/>`;
    return `
        <rect x="31" y="76" width="14" height="14" rx="3" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="3"/>
        <rect x="55" y="76" width="14" height="14" rx="3" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="3"/>
        <rect x="26" y="87" width="22" height="9" rx="4.5" fill="#64748b" stroke="${ENCRE}" stroke-width="3"/>
        <rect x="52" y="87" width="22" height="9" rx="4.5" fill="#64748b" stroke="${ENCRE}" stroke-width="3"/>
        ${bras}
        <rect x="22" y="40" width="56" height="40" rx="13" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="4"/>
        <rect x="36" y="52" width="28" height="18" rx="6" fill="${f.clair}" stroke="${ENCRE}" stroke-width="3"/>
        <circle class="ampoule" cx="50" cy="61" r="4.5" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="2"/>
        ${reflet(32, 47, 6, 3.5, -20)}
        ${deco}
        <rect x="28" y="10" width="44" height="32" rx="11" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="4"/>
        <rect x="33" y="16" width="36" height="20" rx="8" fill="${ENCRE}"/>
        ${visiere}`;
}

function hexagone(cx, cy, r) {
    return Array.from({ length: 6 }, (_, i) => {
        const a = Math.PI / 3 * i + Math.PI / 6;
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
}

function nano(f, v) {
    const nb = 3 + Math.round(v[0] * 2);
    const satellites = Array.from({ length: nb }, (_, i) => {
        const a = (Math.PI * 2 / nb) * i + v[1] * 2;
        return `<polygon points="${hexagone(50 + Math.cos(a) * 37, 54 + Math.sin(a) * 37, 7)}" fill="${f.clair}" stroke="${ENCRE}" stroke-width="2.5" stroke-linejoin="round"/>`;
    }).join('');
    const pointes = v[3] > 0.5 ? Array.from({ length: 6 }, (_, i) => {
        const a = Math.PI / 3 * i;
        const x = 50 + Math.cos(a) * 29, y = 54 + Math.sin(a) * 29;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="2.5"/>`;
    }).join('') : '';
    return `<g class="orbite">${satellites}</g>${pointes}
        <polygon points="${hexagone(50, 54, 28)}" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="4" stroke-linejoin="round"/>
        <polygon points="${hexagone(50, 58, 18)}" fill="${f.sombre}" opacity=".25"/>
        ${reflet(38, 38, 8, 4.5)}
        ${yeux(51, 51, v[2], 7, 9.5)}
        ${bouche(52, 67, v[4])}`;
}

function ia(f, v) {
    const antennes = v[0] < 0.5
        ? `<line x1="50" y1="22" x2="50" y2="9" stroke="${ENCRE}" stroke-width="3.5"/><circle class="ampoule" cx="50" cy="7" r="5.5" fill="#fde047" stroke="${ENCRE}" stroke-width="2.5"/>`
        : `<line x1="34" y1="22" x2="26" y2="9" stroke="${ENCRE}" stroke-width="3.5"/><circle class="ampoule" cx="25" cy="7" r="4.5" fill="#fde047" stroke="${ENCRE}" stroke-width="2.5"/>
           <line x1="66" y1="22" x2="74" y2="9" stroke="${ENCRE}" stroke-width="3.5"/><circle class="ampoule" cx="75" cy="7" r="4.5" fill="#fde047" stroke="${ENCRE}" stroke-width="2.5"/>`;
    const lueur = f.clair;
    const visage = v[2] < 0.33
        ? `<path d="M34 46 Q40 38 46 46" stroke="${lueur}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M56 46 Q62 38 68 46" stroke="${lueur}" stroke-width="4" fill="none" stroke-linecap="round"/>`
        : v[2] < 0.66
            ? `<g class="oeil"><rect x="35" y="37" width="10" height="13" rx="3" fill="${lueur}"/><rect x="57" y="37" width="10" height="13" rx="3" fill="${lueur}"/></g>`
            : `<g class="oeil"><circle cx="41" cy="44" r="6.5" fill="${lueur}"/><circle cx="62" cy="44" r="6.5" fill="${lueur}"/><circle cx="43" cy="42" r="2" fill="#fff"/><circle cx="64" cy="42" r="2" fill="#fff"/></g>`;
    const bouches = [
        `<path d="M44 55 Q51 61 58 55" stroke="${lueur}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
        `<path d="M40 56 L45 53 L50 58 L55 53 L60 56" stroke="${lueur}" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`,
        `<rect x="44" y="54" width="14" height="4" rx="2" fill="${lueur}"/>`,
    ];
    return `${antennes}
        <rect x="40" y="70" width="20" height="8" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="3"/>
        <rect x="28" y="76" width="44" height="18" rx="9" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="3.5"/>
        <path d="M28 84 L16 78" stroke="${ENCRE}" stroke-width="4" stroke-linecap="round"/><path d="M72 84 L84 78" stroke="${ENCRE}" stroke-width="4" stroke-linecap="round"/>
        <rect x="14" y="20" width="72" height="52" rx="14" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="4"/>
        <rect x="21" y="27" width="58" height="38" rx="9" fill="#151229" stroke="${ENCRE}" stroke-width="3"/>
        ${visage}${bouches[Math.floor(v[4] * 2.99)]}
        ${reflet(26, 31, 5, 2.5, -35)}`;
}

// Médicaux : corps blanc arrondi, croix sur le ventre, coiffe d'infirmier
function medic(f, v) {
    const croix = (cx, cy, t) => `<path d="M${cx - t / 3} ${cy - t} h${t * 2 / 3} v${t * 2 / 3} h${t * 2 / 3} v${t * 2 / 3} h${-t * 2 / 3} v${t * 2 / 3} h${-t * 2 / 3} v${-t * 2 / 3} h${-t * 2 / 3} v${-t * 2 / 3} h${t * 2 / 3} Z" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="2.5" stroke-linejoin="round"/>`;
    const accessoire = v[0] < 0.5
        // Stéthoscope autour du cou
        ? `<path d="M36 46 Q34 64 46 66 M64 46 Q66 64 54 66" stroke="${ENCRE}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="50" cy="68" r="4" fill="#94a3b8" stroke="${ENCRE}" stroke-width="2.5"/>`
        // Trousse de soin tenue à la main
        : `<rect x="76" y="62" width="18" height="14" rx="3" fill="#fff" stroke="${ENCRE}" stroke-width="3"/><path d="M81 62 v-3 h8 v3" stroke="${ENCRE}" stroke-width="2.5" fill="none"/>${croix(85, 69, 4)}`;
    const coiffe = v[3] < 0.5
        ? `<path d="M30 26 Q50 6 70 26 L66 32 L34 32 Z" fill="#fff" stroke="${ENCRE}" stroke-width="3.5" stroke-linejoin="round"/>${croix(50, 21, 5)}`
        : `<rect x="32" y="20" width="36" height="12" rx="5" fill="#fff" stroke="${ENCRE}" stroke-width="3.5"/>${croix(50, 26, 4)}`;
    return `
        <rect x="35" y="82" width="12" height="11" rx="5" fill="#cbd5e1" stroke="${ENCRE}" stroke-width="3"/>
        <rect x="53" y="82" width="12" height="11" rx="5" fill="#cbd5e1" stroke="${ENCRE}" stroke-width="3"/>
        <path d="M24 58 L14 66" stroke="${ENCRE}" stroke-width="4" stroke-linecap="round"/>
        ${v[0] < 0.5 ? `<path d="M76 58 L86 66" stroke="${ENCRE}" stroke-width="4" stroke-linecap="round"/>` : ''}
        <rect x="22" y="30" width="56" height="56" rx="24" fill="#f8fafc" stroke="${ENCRE}" stroke-width="4"/>
        <rect x="28" y="70" width="44" height="10" rx="5" fill="${f.clair}"/>
        ${reflet(34, 40, 8, 4.5)}
        ${croix(50, 75, 5)}
        ${accessoire}${coiffe}
        ${yeux(51, 47, v[2], 7, 9.5)}
        ${bouche(52, 58, v[4])}`;
}

// Cuisiniers : un appareil de cuisine (grille-pain, four ou mixeur) coiffé d'une toque
function cuisine(f, v) {
    const type = Math.floor(v[0] * 2.99);
    const corps = [
        // Grille-pain : deux fentes avec des tartines qui dépassent
        `<rect x="32" y="30" width="12" height="10" rx="3" fill="#f4c27a" stroke="${ENCRE}" stroke-width="2.5"/>
         <rect x="56" y="30" width="12" height="10" rx="3" fill="#f4c27a" stroke="${ENCRE}" stroke-width="2.5"/>
         <rect x="20" y="36" width="60" height="48" rx="14" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="4"/>
         <rect x="82" y="56" width="6" height="12" rx="2" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="2.5"/>`,
        // Four : grande vitre avec un plat
        `<rect x="18" y="32" width="64" height="54" rx="10" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="4"/>
         <rect x="28" y="62" width="44" height="18" rx="5" fill="#3b2a24" stroke="${ENCRE}" stroke-width="3"/>
         <ellipse cx="50" cy="73" rx="14" ry="4" fill="#ffd23f" opacity=".85"/>
         <circle cx="30" cy="40" r="3" fill="${f.sombre}"/><circle cx="40" cy="40" r="3" fill="${f.sombre}"/>`,
        // Mixeur : bol transparent sur un socle
        `<path d="M30 34 L70 34 L64 64 L36 64 Z" fill="${f.clair}" opacity=".9" stroke="${ENCRE}" stroke-width="4" stroke-linejoin="round"/>
         <rect x="26" y="62" width="48" height="24" rx="8" fill="${f.couleur}" stroke="${ENCRE}" stroke-width="4"/>
         <circle cx="50" cy="76" r="4" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="2"/>`,
    ][type];
    const yeuxY = [56, 48, 46][type], boucheY = [70, 56, 54][type];
    const outil = v[3] < 0.5
        // Spatule
        ? `<path d="M22 60 L10 48" stroke="${ENCRE}" stroke-width="4" stroke-linecap="round"/><rect x="2" y="36" width="12" height="14" rx="3" fill="#cbd5e1" stroke="${ENCRE}" stroke-width="3" transform="rotate(-45 8 43)"/>`
        // Louche
        : `<path d="M22 60 L12 46" stroke="${ENCRE}" stroke-width="4" stroke-linecap="round"/><circle cx="10" cy="42" r="6" fill="#cbd5e1" stroke="${ENCRE}" stroke-width="3"/>`;
    return `
        <rect x="32" y="84" width="10" height="9" rx="3" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="3"/>
        <rect x="58" y="84" width="10" height="9" rx="3" fill="${f.sombre}" stroke="${ENCRE}" stroke-width="3"/>
        ${outil}${corps}
        ${reflet(30, 44, 6, 3.5)}
        <path d="M36 30 Q30 18 40 16 Q44 6 50 10 Q56 6 60 16 Q70 18 64 30 Z" fill="#fff" stroke="${ENCRE}" stroke-width="3.5" stroke-linejoin="round"/>
        <rect x="36" y="26" width="28" height="7" rx="2" fill="#fff" stroke="${ENCRE}" stroke-width="3"/>
        ${yeux(51, yeuxY, v[2], 6.5, 9)}
        ${bouche(52, boucheY, v[4])}`;
}

const DESSINS = { drone, mecha, nano, ia, medic, cuisine };

export function robotSVG(id) {
    if (cache.has(id)) return cache.get(id);
    const def = ROBOTS[id];
    // Un hybride prend la forme de sa première famille, avec les détails à la couleur de la seconde
    const [f1, f2] = [].concat(def.famille);
    const couleurs = f2 ? { ...FAMILLES[f1], clair: FAMILLES[f2].couleur } : FAMILLES[f1];
    const html = def.image
        ? `<img src="${def.image}" alt="${def.nom}" class="h-full w-full object-contain" draggable="false">`
        : `<svg viewBox="0 0 100 100" class="h-full w-full overflow-visible" aria-label="${def.nom}">${DESSINS[f1](couleurs, variantes(id))}</svg>`;
    cache.set(id, html);
    return html;
}

// Décor : silhouette de ville (immeubles lointains + immeubles colorés au premier plan + lampadaires)
export function villeSVG() {
    let graine = 12345;
    const r = () => ((graine = (Math.imul(graine, 1664525) + 1013904223) >>> 0) / 4294967296);
    const W = 1800, H = 620;
    let lointains = '', proches = '', lampadaires = '';

    for (let x = -20; x < W;) {
        const w = 60 + r() * 90, h = 220 + r() * 300;
        lointains += `<rect x="${x.toFixed(0)}" y="${(H - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="#b9d6f2"/>`;
        if (r() < 0.3) lointains += `<rect x="${(x + w / 2 - 2).toFixed(0)}" y="${(H - h - 30).toFixed(0)}" width="4" height="30" fill="#b9d6f2"/>`;
        x += w - 4;
    }

    const couleurs = ['#ff9f9f', '#ffc97a', '#9ee6a8', '#8fc8ff', '#c9a8ff', '#ffe17a', '#7fd8d0'];
    let derniere = '';
    for (let x = -40; x < W;) {
        const w = 120 + r() * 130, h = 150 + r() * 260, y = H - h;
        let c = couleurs[Math.floor(r() * couleurs.length)];
        if (c === derniere) c = couleurs[(couleurs.indexOf(c) + 1) % couleurs.length];
        derniere = c;
        proches += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h + 10}" rx="6" fill="${c}" stroke="${ENCRE}" stroke-width="4"/>`;
        proches += `<rect x="${(x - 6).toFixed(0)}" y="${(y - 12).toFixed(0)}" width="${(w + 12).toFixed(0)}" height="16" rx="5" fill="${c}" stroke="${ENCRE}" stroke-width="4"/>`;
        proches += `<rect x="${(x + 4).toFixed(0)}" y="${(y - 9).toFixed(0)}" width="${(w - 8).toFixed(0)}" height="5" rx="2" fill="#fff" opacity=".35"/>`;
        // Fenêtres, certaines allumées
        const cols = Math.floor((w - 24) / 32), rangs = Math.floor((h - 50) / 40);
        const marge = (w - cols * 32 + 12) / 2;
        for (let i = 0; i < rangs; i++) {
            for (let j = 0; j < cols; j++) {
                const allumee = r() < 0.32;
                proches += `<rect x="${(x + marge + j * 32).toFixed(0)}" y="${(y + 22 + i * 40).toFixed(0)}" width="20" height="26" rx="4" fill="${allumee ? '#fff3b0' : '#4f6a96'}" stroke="${ENCRE}" stroke-width="2.5"/>`;
            }
        }
        // Toits : antenne, château d'eau ou enseigne lumineuse
        const deco = r();
        if (deco < 0.3) {
            proches += `<line x1="${(x + w * 0.7).toFixed(0)}" y1="${(y - 10).toFixed(0)}" x2="${(x + w * 0.7).toFixed(0)}" y2="${(y - 60).toFixed(0)}" stroke="${ENCRE}" stroke-width="4"/><circle cx="${(x + w * 0.7).toFixed(0)}" cy="${(y - 62).toFixed(0)}" r="6" fill="#ff6b6b" stroke="${ENCRE}" stroke-width="3"/>`;
        } else if (deco < 0.55) {
            const cx = x + w * 0.3;
            proches += `<rect x="${(cx - 18).toFixed(0)}" y="${(y - 56).toFixed(0)}" width="36" height="34" rx="8" fill="#c9a37a" stroke="${ENCRE}" stroke-width="3.5"/><line x1="${(cx - 12).toFixed(0)}" y1="${(y - 22).toFixed(0)}" x2="${(cx - 12).toFixed(0)}" y2="${(y - 10).toFixed(0)}" stroke="${ENCRE}" stroke-width="4"/><line x1="${(cx + 12).toFixed(0)}" y1="${(y - 22).toFixed(0)}" x2="${(cx + 12).toFixed(0)}" y2="${(y - 10).toFixed(0)}" stroke="${ENCRE}" stroke-width="4"/>`;
        } else if (deco < 0.75 && w > 150) {
            const textes = ['ROBO', 'BOLT', 'VOLT', '24/7', 'ZAP'];
            proches += `<rect x="${(x + w / 2 - 44).toFixed(0)}" y="${(y - 52).toFixed(0)}" width="88" height="36" rx="8" fill="#2b2540" stroke="${ENCRE}" stroke-width="3.5"/><text x="${(x + w / 2).toFixed(0)}" y="${(y - 26).toFixed(0)}" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="22" fill="#ffd23f">${textes[Math.floor(r() * textes.length)]}</text>`;
        }
        x += w + 10 + r() * 40;
    }

    // Lampadaires au bord du trottoir
    for (let x = 140; x < W; x += 420) {
        lampadaires += `<rect x="${x - 4}" y="${H - 230}" width="8" height="230" fill="#3d4559" stroke="${ENCRE}" stroke-width="3"/>
            <path d="M${x} ${H - 226} Q${x} ${H - 262} ${x + 34} ${H - 258}" stroke="${ENCRE}" stroke-width="9" fill="none" stroke-linecap="round"/>
            <path d="M${x} ${H - 226} Q${x} ${H - 262} ${x + 34} ${H - 258}" stroke="#3d4559" stroke-width="4" fill="none" stroke-linecap="round"/>
            <rect x="${x + 22}" y="${H - 262}" width="34" height="14" rx="5" fill="#fff3b0" stroke="${ENCRE}" stroke-width="3"/>`;
    }

    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" class="h-full w-full">
        <g opacity=".85">${lointains}</g>${proches}${lampadaires}</svg>`;
}

// Icônes de stats (attaque = éclair orange, PV = cœur rouge)
export const ICONE_ATK = `<svg viewBox="0 0 40 40" class="absolute inset-0 h-full w-full overflow-visible"><path d="M8 6 H32 Q36 6 36 10 V30 Q36 34 32 34 H8 Q4 34 4 30 V10 Q4 6 8 6 Z" transform="rotate(-6 20 20)" fill="#ff9f1c" stroke="${ENCRE}" stroke-width="3.5"/><path d="M10 12 H24" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round" transform="rotate(-6 20 20)"/></svg>`;
export const ICONE_PV = `<svg viewBox="0 0 40 40" class="absolute inset-0 h-full w-full overflow-visible"><path d="M20 36 C7 28 1 20 3.5 11.5 C6 3.5 15.5 2.5 20 9.5 C24.5 2.5 34 3.5 36.5 11.5 C39 20 33 28 20 36 Z" fill="#ff4d6d" stroke="${ENCRE}" stroke-width="3.5" stroke-linejoin="round"/><ellipse cx="11" cy="12" rx="4" ry="2.5" fill="#fff" opacity=".55" transform="rotate(-35 11 12)"/></svg>`;
