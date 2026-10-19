/**
 * DevisArtisan — MODE DÉMO (version portfolio)
 *
 * Simule l'API PHP directement dans le navigateur : mêmes routes, mêmes réponses,
 * mêmes règles (quota du plan gratuit, numérotation, plan Pro…), mais toutes les
 * données restent dans le localStorage du visiteur. Aucun backend nécessaire.
 *
 * À charger APRÈS api.js : remplace apiFetch() et les rares appels fetch() directs
 * (upload du logo, PDF). Pour revenir à la vraie API, il suffit de retirer ce script.
 */

const DEMO_KEY = 'da_demo_db';
const DEMO_FREE_MAX = 5;          // documents ET PDF sur le plan gratuit (comme FREE_DOCS_MAX côté PHP)
const DEMO_LATENCY = 120;         // petite latence pour garder le comportement « réseau »

// ══════════════════════════════════════════════════════════
//  BASE DE DONNÉES LOCALE
// ══════════════════════════════════════════════════════════
const DemoDB = {
    data: null,

    load() {
        try { this.data = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (e) { this.data = null; }
        if (!this.data || this.data.version !== 1) this.data = demoSeed();
        return this.data;
    },
    save() {
        try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.data)); } catch (e) {}
    },
    reset() {
        try { localStorage.removeItem(DEMO_KEY); } catch (e) {}
        this.data = demoSeed();
        this.save();
    },
    nextId(kind) { return ++this.data.seq[kind]; },
};

// Données de départ : une petite entreprise avec quelques clients et documents
function demoSeed() {
    const now = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
    const year = now.getFullYear();

    const clients = [
        { id: 1, nom: 'Mme Martin', adresse: '5 avenue des Fleurs, 69000 Lyon', telephone: '06 98 76 54 32', email: 'martin@email.fr' },
        { id: 2, nom: 'SCI Les Tilleuls', adresse: '18 rue Gambetta, 64100 Bayonne', telephone: '05 59 12 34 56', email: 'gestion@lestilleuls.fr' },
        { id: 3, nom: 'M. Etcheverry', adresse: '3 chemin d\'Arcangues, 64200 Biarritz', telephone: '06 11 22 33 44', email: 'p.etcheverry@email.fr' },
    ].map(c => ({ code_postal: '', ville: '', pays: 'France', contact: '', ...c }));

    const doc = (id, type, n, client, created, lignes, statut) => {
        const d = {
            id, type, statut,
            numero: `${type === 'facture' ? 'FAC' : 'DEV'}-${year}-${String(n).padStart(3, '0')}`,
            date_emission: iso(created),
            date_echeance: iso(new Date(created.getTime() + 30 * 864e5)),
            notes: type === 'facture' ? 'Paiement à 30 jours par virement.' : 'Devis valable 30 jours.',
            tva_taux: 20,
            client_nom: client.nom, client_adresse: client.adresse,
            client_telephone: client.telephone, client_email: client.email,
            lignes, devise: 'EUR',
            created_at: created.toISOString(), updated_at: created.toISOString(),
        };
        return Object.assign(d, demoTotaux(lignes, 20));
    };

    const docs = [
        doc(1, 'devis', 1, clients[0], daysAgo(70), [
            { desc: 'Remplacement chauffe-eau 200 L', qty: 1, pu: 890 },
            { desc: 'Main d\'œuvre (heures)', qty: 4, pu: 55 },
        ], 'accepte'),
        doc(2, 'facture', 1, clients[1], daysAgo(38), [
            { desc: 'Recherche de fuite', qty: 1, pu: 180 },
            { desc: 'Réparation canalisation cuivre', qty: 1, pu: 245 },
            { desc: 'Déplacement', qty: 1, pu: 35 },
        ], 'paye'),
        doc(3, 'devis', 2, clients[2], daysAgo(6), [
            { desc: 'Rénovation salle de bain complète', qty: 1, pu: 6400 },
            { desc: 'Fourniture faïence (m²)', qty: 18, pu: 42 },
        ], 'envoye'),
    ];

    return {
        version: 1,
        seq: { doc: docs.length, client: clients.length },
        numerotation: { [`devis-${year}`]: 2, [`facture-${year}`]: 1 },
        user: {
            id: 1, email: 'demo@devisartisan.fr', prenom: 'Visiteur', nom: 'Démo',
            plan_slug: 'free', plan_expires_at: null, pdf_count: 0,
            entreprise: {
                nom: 'Atelier Martin Plomberie', siret: '123 456 789 00012', num_tva: 'FR 12 345678901',
                adresse: '12 rue de la Paix, 64100 Bayonne', telephone: '06 12 34 56 78',
                email: 'contact@atelier-martin.fr', logo_path: null, logo_data: null,
            },
        },
        clients, docs,
    };
}

// Même calcul que DocumentController::computeTotaux()
function demoTotaux(lignes, tvaRate) {
    const ht = Math.round(lignes.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.pu) || 0), 0) * 100) / 100;
    const tva = Math.round(ht * tvaRate) / 100;
    return { total_ht: ht, total_tva: tva, total_ttc: Math.round((ht + tva) * 100) / 100 };
}

// ══════════════════════════════════════════════════════════
//  « SERVEUR » SIMULÉ : mêmes routes que api/index.php
// ══════════════════════════════════════════════════════════
const isPro = () => DemoDB.data.user.plan_slug === 'pro';
const fail = (message, status = 400) => { throw new ApiError(message, status); };
const findDoc = (id) => DemoDB.data.docs.find(d => d.id === id) || fail('Document introuvable', 404);
const findClient = (id) => DemoDB.data.clients.find(c => c.id === id) || fail('Client introuvable', 404);
const docSummary = ({ lignes, notes, client_adresse, client_telephone, client_email, tva_taux, ...rest }) => ({ ...rest, entreprise_nom: DemoDB.data.user.entreprise.nom });

function demoNumero(type, peek = false) {
    const year = new Date().getFullYear();
    const key = `${type}-${year}`;
    const n = (DemoDB.data.numerotation[key] || 0) + 1;
    if (!peek) DemoDB.data.numerotation[key] = n;
    return `${type === 'facture' ? 'FAC' : 'DEV'}-${year}-${String(n).padStart(3, '0')}`;
}

// Un numéro saisi ou généré (DEV-2026-007) fait avancer le compteur, pour ne jamais le proposer deux fois
function bumpNumerotation(type, numero) {
    const m = /^(?:DEV|FAC)-(\d{4})-(\d+)$/.exec(numero || '');
    if (!m) return;
    const key = `${type}-${m[1]}`;
    DemoDB.data.numerotation[key] = Math.max(DemoDB.data.numerotation[key] || 0, +m[2]);
}

function validateDoc(data) {
    if (!['devis', 'facture'].includes(data.type)) fail('type invalide (devis|facture)');
    if (!data.date_emission) fail('date_emission requise');
    if (!Array.isArray(data.lignes) || !data.lignes.length) fail('Au moins une ligne de prestation requise');
    if (data.lignes.some(l => !('desc' in l && 'qty' in l && 'pu' in l))) fail('Chaque ligne doit avoir desc, qty et pu');
}

function checkNumeroUnique(type, numero, excludeId = 0) {
    if (DemoDB.data.docs.some(d => d.type === type && d.numero === numero && d.id !== excludeId)) {
        fail(`Le numéro ${numero} existe déjà pour ce type de document`, 409);
    }
}

function checkPdfQuota() {
    const u = DemoDB.data.user;
    if (!isPro() && u.pdf_count >= DEMO_FREE_MAX) fail(`Limite de ${DEMO_FREE_MAX} PDF atteinte. Passez à Pro pour continuer.`, 403);
    u.pdf_count++;
}

function writeDoc(target, data) {
    Object.assign(target, {
        type: data.type, numero: data.numero,
        date_emission: data.date_emission, date_echeance: data.date_echeance || null,
        notes: data.notes || '', tva_taux: parseFloat(data.tva_taux ?? 20),
        client_nom: data.client_nom || '', client_adresse: data.client_adresse || '',
        client_telephone: data.client_telephone || '', client_email: data.client_email || '',
        lignes: data.lignes, updated_at: new Date().toISOString(),
    }, demoTotaux(data.lignes, parseFloat(data.tva_taux ?? 20)));
    return target;
}

function demoDashboard() {
    const docs = DemoDB.data.docs;
    const labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const docs_par_mois = [];
    for (let i = 5; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
        docs_par_mois.push({ label: labels[m.getMonth()], nb: docs.filter(d => d.created_at.startsWith(key)).length });
    }
    const recent = [...docs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)
        .map(({ id, type, numero, client_nom, date_emission, total_ttc, statut }) => ({ id, type, numero, client_nom, date_emission, total_ttc, statut }));
    return {
        total_docs: docs.length,
        nb_devis: docs.filter(d => d.type === 'devis').length,
        nb_factures: docs.filter(d => d.type === 'facture').length,
        nb_clients: new Set(docs.map(d => d.client_nom).filter(Boolean)).size,
        docs_par_mois, recent,
    };
}

function demoRoute(method, path, query, body) {
    const db = DemoDB.data;
    const u = db.user;
    let m;

    // ── Profil ───────────────────────────────────────────
    if (path === '/me' && method === 'GET') {
        const { logo_data, ...entreprise } = u.entreprise;
        return { id: u.id, email: u.email, prenom: u.prenom, nom: u.nom, plan_slug: u.plan_slug, entreprise, docs_count: db.docs.length };
    }
    if (path === '/me' && method === 'PUT') {
        if (body.entreprise) Object.assign(u.entreprise, body.entreprise);
        return { message: 'Profil mis à jour' };
    }

    // ── Abonnement (simulé, sans paiement) ───────────────
    if (path === '/subscription' && method === 'GET') {
        return {
            plan: u.plan_slug, plan_label: isPro() ? 'Pro' : 'Gratuit',
            docs_max: isPro() ? -1 : DEMO_FREE_MAX, docs_count: db.docs.length,
            pdf_count: u.pdf_count, pdf_max: DEMO_FREE_MAX, logo: isPro(),
            expires_at: u.plan_expires_at, abonnement: null,
        };
    }
    if (path === '/subscription/upgrade' && method === 'POST') {
        if (isPro()) fail('Vous êtes déjà sur le plan Pro', 409);
        u.plan_slug = 'pro';
        u.plan_expires_at = new Date(Date.now() + 30 * 864e5).toISOString();
        window._userPlan = 'pro';
        return { message: 'Bienvenue sur le plan Pro !', plan: 'pro', expires_at: u.plan_expires_at };
    }
    if (path === '/subscription/cancel' && method === 'POST') {
        if (!isPro()) fail('Vous êtes déjà sur le plan gratuit', 409);
        u.plan_slug = 'free';
        u.plan_expires_at = null;
        window._userPlan = 'free';
        return { message: 'Abonnement annulé' };
    }

    // ── Tableau de bord ──────────────────────────────────
    if (path === '/dashboard' && method === 'GET') return demoDashboard();

    // ── Clients ──────────────────────────────────────────
    if (path === '/clients' && method === 'GET') {
        return [...db.clients].sort((a, b) => a.nom.localeCompare(b.nom));
    }
    if (path === '/clients' && method === 'POST') {
        if (!body.nom) fail('Le nom du client est requis');
        const c = { code_postal: '', ville: '', pays: 'France', contact: '', ...body, id: DemoDB.nextId('client') };
        db.clients.push(c);
        return c;
    }
    if ((m = path.match(/^\/clients\/(\d+)$/))) {
        const c = findClient(+m[1]);
        if (method === 'PUT') return Object.assign(c, body, { id: c.id });
        if (method === 'DELETE') { db.clients = db.clients.filter(x => x !== c); return null; }
    }

    // ── Documents ────────────────────────────────────────
    if (path === '/documents' && method === 'GET') {
        return db.docs
            .filter(d => (!query.get('type') || d.type === query.get('type')) && (!query.get('statut') || d.statut === query.get('statut')))
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .map(docSummary);
    }
    if (path === '/documents' && method === 'POST') {
        validateDoc(body);
        if (!isPro() && db.docs.length >= DEMO_FREE_MAX) {
            fail(`Limite de ${DEMO_FREE_MAX} documents atteinte. Passez au plan Pro pour continuer.`, 403);
        }
        if (!body.numero) body.numero = demoNumero(body.type);
        checkNumeroUnique(body.type, body.numero);
        bumpNumerotation(body.type, body.numero);
        const now = new Date().toISOString();
        const d = writeDoc({ id: DemoDB.nextId('doc'), statut: 'brouillon', devise: 'EUR', created_at: now }, body);
        db.docs.push(d);
        return d;
    }
    if ((m = path.match(/^\/documents\/(\d+)\/([a-z-]+)$/))) {
        const d = findDoc(+m[1]);
        const action = m[2];
        if (action === 'track-print' && method === 'POST') { checkPdfQuota(); return { message: 'OK' }; }
        if (action === 'send' && method === 'POST') {
            if (!isPro()) fail('L\'envoi par email est réservé au plan Pro.', 403);
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.to || '')) fail('Adresse email destinataire invalide ou manquante', 422);
            if (d.statut === 'brouillon') d.statut = 'envoye';
            return { message: `Document envoyé à ${body.to}` };
        }
        if (action === 'convert' && method === 'POST') {
            if (d.type !== 'devis') fail('Seul un devis peut être converti');
            d.statut = 'converti';
            const now = new Date().toISOString();
            const f = writeDoc({ id: DemoDB.nextId('doc'), statut: 'en_attente', devise: 'EUR', created_at: now },
                { ...d, type: 'facture', numero: demoNumero('facture'), date_emission: now.slice(0, 10) });
            db.docs.push(f);
            return f;
        }
    }
    if ((m = path.match(/^\/documents\/(\d+)$/))) {
        const d = findDoc(+m[1]);
        if (method === 'GET') return d;
        if (method === 'PUT') {
            validateDoc(body);
            if (body.numero !== d.numero) checkNumeroUnique(body.type, body.numero, d.id);
            bumpNumerotation(body.type, body.numero);
            return writeDoc(d, body);
        }
        if (method === 'DELETE') { db.docs = db.docs.filter(x => x !== d); return null; }
    }

    fail('Route introuvable', 404);
}

// ══════════════════════════════════════════════════════════
//  BRANCHEMENT SUR LE FRONT (remplace les appels réseau d'api.js)
// ══════════════════════════════════════════════════════════
apiFetch = async function (path, options = {}) {
    await new Promise(r => setTimeout(r, DEMO_LATENCY));
    const [p, qs] = path.split('?');
    const body = options.body ? JSON.parse(options.body) : {};
    // Copie profonde : le front ne doit jamais modifier la « base » par référence
    const result = demoRoute((options.method || 'GET').toUpperCase(), p.replace(/\/+$/, '') || '/', new URLSearchParams(qs || ''), body);
    DemoDB.save();
    return result === null ? null : JSON.parse(JSON.stringify(result));
};

// Toujours « connecté » sur le compte de démonstration
Auth.isLoggedIn = () => true;
Auth.getAccessToken = () => 'demo';

// « Déconnexion » → réinitialiser la démo
AuthAPI.logout = () => {
    if (!confirm('Réinitialiser la démo ? Vos documents, clients et réglages de démonstration seront effacés.')) return;
    DemoDB.reset();
    location.reload();
};

// Numéro suivant basé sur la numérotation de la démo (l'original lisait l'ancien stockage local)
genNumero = function () {
    set('doc-num', demoNumero(docType, true));
    sync();
    showToast('🔢 Numéro généré');
};

// Compteur de documents enregistrés dans l'onglet
updateSavedCount = () => updateSavedCountFromData(DemoDB.data.docs);

// Logo : réservé au plan Pro, comme sur le serveur, mais stocké en base64 localement
window.handleLogoUpload = function (event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!isPro()) { openPaywall(); showToast('⚠️ Le logo est réservé au plan Pro', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { showToast('⚠️ Logo trop lourd (max 2 Mo)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
        logoB64 = ev.target.result;
        DemoDB.data.user.entreprise.logo_data = logoB64;
        DemoDB.save();
        showLogoPreview(logoB64);
        sync();
        showToast('✅ Logo ajouté !', 'success');
    };
    reader.readAsDataURL(file);
};
const _demoRemoveLogo = removeLogo;
removeLogo = function (e) {
    _demoRemoveLogo(e);
    DemoDB.data.user.entreprise.logo_data = null;
    DemoDB.save();
};

// PDF : pas de génération serveur (dompdf) dans la démo → impression du document via le navigateur
downloadPdf = async function (docId) {
    try {
        await apiFetch('/documents/' + docId + '/track-print', { method: 'POST' });
    } catch (e) {
        if (e.status === 403) openPaywall();
        showToast('⚠️ ' + e.message, 'error');
        return;
    }
    if (window._currentDocId !== docId) await loadDocFromApi(docId);
    showTab('apercu', document.querySelectorAll('.tab-btn')[1]);
    showToast('🖨️ Démo : choisissez « Enregistrer au format PDF » dans la fenêtre d\'impression', 'success');
    setTimeout(() => window.print(), 400);
};

// Envoi d'email simulé : on le précise au visiteur (uniquement si l'envoi a réussi)
const _demoSend = DocumentsAPI.send;
let _demoSent = false;
DocumentsAPI.send = async (id, data) => { const r = await _demoSend(id, data); _demoSent = true; return r; };
const _demoSubmitSendEmail = submitSendEmail;
submitSendEmail = async function () {
    _demoSent = false;
    await _demoSubmitSendEmail();
    if (_demoSent) showToast('✅ Envoi simulé : en démo, aucun email n\'est réellement envoyé', 'success');
};

// ══════════════════════════════════════════════════════════
//  INTERFACE : bandeau « Mode démo » + logo restauré au chargement
// ══════════════════════════════════════════════════════════
DemoDB.load();
DemoDB.save();

document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
      .demo-banner { display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap;
        padding:8px 16px; background:var(--accent-lt); color:var(--accent-dk); border-bottom:1px solid var(--border);
        font-size:.78rem; text-align:center; }
      .demo-banner strong { font-weight:700; }
      .demo-banner button { background:none; border:0; padding:0; color:inherit; font:inherit; text-decoration:underline; cursor:pointer; }
      @media print { .demo-banner { display:none !important; } }`;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.className = 'demo-banner';
    banner.innerHTML = '<span><strong>Mode démo</strong> · tout est enregistré dans votre navigateur, aucun serveur. Le passage Pro et l\'envoi d\'emails sont simulés.</span>';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Réinitialiser la démo';
    reset.addEventListener('click', AuthAPI.logout);
    banner.appendChild(reset);
    document.body.prepend(banner);

    // Le bouton « Déconnexion » n'a pas de sens ici
    const logout = document.getElementById('btn-logout');
    if (logout) logout.remove();

    // Logo et date du jour
    const logo = DemoDB.data.user.entreprise.logo_data;
    if (logo) { logoB64 = logo; showLogoPreview(logo); }
    if (isPro()) window._userPlan = 'pro';
});
