/**
 * DevisArtisan — API Client (Phase 2)
 * Remplace les appels localStorage du frontend par des fetch() vers le backend PHP.
 *
 * Usage : importer ce fichier AVANT le script principal dans index.html
 *   <script src="api.js"></script>
 */

const API_BASE = 'http://localhost/projetOCR/API/devisArtisan/api';

// ══════════════════════════════════════════════════════════
//  GESTION DES TOKENS (localStorage pour les tokens JWT)
// ══════════════════════════════════════════════════════════
const Auth = {
    getAccessToken()  { return localStorage.getItem('da_access_token'); },
    getRefreshToken() { return localStorage.getItem('da_refresh_token'); },
    setTokens(access, refresh) {
        localStorage.setItem('da_access_token',  access);
        localStorage.setItem('da_refresh_token', refresh);
    },
    clear() {
        localStorage.removeItem('da_access_token');
        localStorage.removeItem('da_refresh_token');
        localStorage.removeItem('da_user');
    },
    isLoggedIn() { return !!this.getAccessToken(); },
};

// ══════════════════════════════════════════════════════════
//  FETCH WRAPPER — gère auth + refresh automatique
// ══════════════════════════════════════════════════════════
async function apiFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    if (Auth.isLoggedIn()) {
        headers['Authorization'] = 'Bearer ' + Auth.getAccessToken();
    }

    let response = await fetch(API_BASE + path, { ...options, headers });

    // Token expiré → tenter un refresh automatique
    if (response.status === 401 && Auth.getRefreshToken()) {
        const refreshed = await tryRefresh();
        if (refreshed) {
            headers['Authorization'] = 'Bearer ' + Auth.getAccessToken();
            response = await fetch(API_BASE + path, { ...options, headers });
        } else {
            Auth.clear();
            showAuthModal(); // afficher la modale de connexion
            throw new Error('Session expirée');
        }
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new ApiError(err.error || 'Erreur inconnue', response.status);
    }

    return response.status === 204 ? null : response.json();
}

async function tryRefresh() {
    try {
        const data = await fetch(API_BASE + '/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: Auth.getRefreshToken() }),
        }).then(r => r.ok ? r.json() : null);

        if (!data) return false;
        Auth.setTokens(data.access_token, data.refresh_token);
        return true;
    } catch {
        return false;
    }
}

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

// ══════════════════════════════════════════════════════════
//  AUTH API
// ══════════════════════════════════════════════════════════
const AuthAPI = {
    async register(email, password, prenom = '', nom = '') {
        const data = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, prenom, nom }),
        });
        Auth.setTokens(data.access_token, data.refresh_token);
        return data;
    },

    async login(email, password) {
        const data = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        Auth.setTokens(data.access_token, data.refresh_token);
        return data;
    },

    logout() {
        Auth.clear();
        showAuthModal();
    },
};

// ══════════════════════════════════════════════════════════
//  DOCUMENTS API
// ══════════════════════════════════════════════════════════
const DocumentsAPI = {
    async list(filters = {}) {
        const qs = new URLSearchParams(filters).toString();
        return apiFetch('/documents' + (qs ? '?' + qs : ''));
    },

    async get(id) {
        return apiFetch('/documents/' + id);
    },

    async save(docData) {
        // Si un id existe → update, sinon → create
        if (docData.id) {
            return apiFetch('/documents/' + docData.id, {
                method: 'PUT',
                body: JSON.stringify(docData),
            });
        }
        return apiFetch('/documents', {
            method: 'POST',
            body: JSON.stringify(docData),
        });
    },

    async delete(id) {
        return apiFetch('/documents/' + id, { method: 'DELETE' });
    },

    async convert(id) {
        return apiFetch('/documents/' + id + '/convert', { method: 'POST' });
    },

    async send(id, data) {
        return apiFetch('/documents/' + id + '/send', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
};

// ══════════════════════════════════════════════════════════
//  CLIENTS API
// ══════════════════════════════════════════════════════════
const ClientsAPI = {
    list()         { return apiFetch('/clients'); },
    create(data)   { return apiFetch('/clients',      { method: 'POST',   body: JSON.stringify(data) }); },
    update(id, d)  { return apiFetch('/clients/' + id,{ method: 'PUT',    body: JSON.stringify(d) }); },
    delete(id)     { return apiFetch('/clients/' + id,{ method: 'DELETE' }); },
};

// ══════════════════════════════════════════════════════════
//  USER / PROFIL API
// ══════════════════════════════════════════════════════════
const UserAPI = {
    me()           { return apiFetch('/me'); },
    update(data)   { return apiFetch('/me', { method: 'PUT', body: JSON.stringify(data) }); },

    async uploadLogo(file) {
        const form = new FormData();
        form.append('logo', file);
        // apiFetch ne convient pas ici (pas de Content-Type JSON)
        const resp = await fetch(API_BASE + '/me/logo', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + Auth.getAccessToken() },
            body: form,
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: 'Erreur upload' }));
            throw new ApiError(err.error, resp.status);
        }
        return resp.json(); // { logo_url: '...' }
    },
};

// ══════════════════════════════════════════════════════════
//  MODALE AUTH (connexion / inscription)
//  Injectée dynamiquement si absente du HTML
// ══════════════════════════════════════════════════════════
function showAuthModal(tab = 'login') {
    let modal = document.getElementById('auth-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.innerHTML = `
<div style="position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);
            display:grid;place-items:center;z-index:99999;">
  <div style="background:#fff;border-radius:12px;width:92%;max-width:420px;overflow:hidden;
              box-shadow:0 20px 60px rgba(0,0,0,.15);">

    <!-- Tabs -->
    <div style="display:flex;border-bottom:1px solid #e4e0da;">
      <button id="tab-login-btn" onclick="switchAuthTab('login')"
        style="flex:1;padding:16px;font-size:.88rem;font-weight:600;border:none;cursor:pointer;
               background:#f8f6f3;color:#111;border-bottom:2px solid #111;">
        Connexion
      </button>
      <button id="tab-register-btn" onclick="switchAuthTab('register')"
        style="flex:1;padding:16px;font-size:.88rem;font-weight:600;border:none;cursor:pointer;
               background:#fff;color:#888;border-bottom:2px solid transparent;">
        Créer un compte
      </button>
    </div>

    <!-- Login -->
    <div id="tab-login" style="padding:28px;">
      <p style="font-size:.82rem;color:#888;margin-bottom:20px;">
        Connectez-vous pour accéder à vos documents.
      </p>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:.7rem;font-weight:600;color:#888;
                      text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;">Email</label>
        <input id="login-email" type="email" placeholder="vous@exemple.fr"
               style="width:100%;padding:9px 12px;border:1.5px solid #e4e0da;border-radius:8px;font-size:.88rem;outline:none;">
      </div>
      <div style="margin-bottom:20px;">
        <label style="display:block;font-size:.7rem;font-weight:600;color:#888;
                      text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;">Mot de passe</label>
        <input id="login-pwd" type="password" placeholder="••••••••"
               style="width:100%;padding:9px 12px;border:1.5px solid #e4e0da;border-radius:8px;font-size:.88rem;outline:none;">
      </div>
      <button onclick="handleLogin()"
        style="width:100%;padding:11px;background:#111;color:#fff;border:none;border-radius:8px;
               font-size:.88rem;font-weight:500;cursor:pointer;">
        Se connecter
      </button>
      <div id="login-err" style="margin-top:10px;font-size:.78rem;color:#c0392b;display:none;"></div>
      <p style="margin-top:14px;text-align:center;">
        <button onclick="switchAuthTab('forgot')"
          style="background:none;border:none;cursor:pointer;font-size:.78rem;color:#888;text-decoration:underline;padding:0;">
          Mot de passe oublié ?
        </button>
      </p>
    </div>

    <!-- Forgot password -->
    <div id="tab-forgot" style="padding:28px;display:none;">
      <p style="font-size:.82rem;color:#888;margin-bottom:20px;">
        Saisissez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
      </p>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:.7rem;font-weight:600;color:#888;
                      text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;">Email</label>
        <input id="forgot-email" type="email" placeholder="vous@exemple.fr"
               style="width:100%;padding:9px 12px;border:1.5px solid #e4e0da;border-radius:8px;font-size:.88rem;outline:none;">
      </div>
      <button onclick="handleForgotPassword()"
        style="width:100%;padding:11px;background:#111;color:#fff;border:none;border-radius:8px;
               font-size:.88rem;font-weight:500;cursor:pointer;">
        Envoyer le lien
      </button>
      <div id="forgot-err" style="margin-top:10px;font-size:.78rem;color:#c0392b;display:none;"></div>
      <div id="forgot-ok"  style="margin-top:10px;font-size:.78rem;color:#16a34a;display:none;"></div>
      <p style="margin-top:14px;text-align:center;">
        <button onclick="switchAuthTab('login')"
          style="background:none;border:none;cursor:pointer;font-size:.78rem;color:#888;text-decoration:underline;padding:0;">
          ← Retour à la connexion
        </button>
      </p>
    </div>

    <!-- Register -->
    <div id="tab-register" style="padding:28px;display:none;">
      <p style="font-size:.82rem;color:#888;margin-bottom:20px;">
        Créez votre compte gratuitement — plan Free, 5 documents inclus.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div>
          <label style="display:block;font-size:.7rem;font-weight:600;color:#888;
                        text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;">Prénom</label>
          <input id="reg-prenom" type="text" placeholder="Jean"
                 style="width:100%;padding:9px 12px;border:1.5px solid #e4e0da;border-radius:8px;font-size:.88rem;outline:none;">
        </div>
        <div>
          <label style="display:block;font-size:.7rem;font-weight:600;color:#888;
                        text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;">Nom</label>
          <input id="reg-nom" type="text" placeholder="Dupont"
                 style="width:100%;padding:9px 12px;border:1.5px solid #e4e0da;border-radius:8px;font-size:.88rem;outline:none;">
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:.7rem;font-weight:600;color:#888;
                      text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;">Email</label>
        <input id="reg-email" type="email" placeholder="vous@exemple.fr"
               style="width:100%;padding:9px 12px;border:1.5px solid #e4e0da;border-radius:8px;font-size:.88rem;outline:none;">
      </div>
      <div style="margin-bottom:20px;">
        <label style="display:block;font-size:.7rem;font-weight:600;color:#888;
                      text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;">Mot de passe (8 car. min.)</label>
        <input id="reg-pwd" type="password" placeholder="••••••••"
               style="width:100%;padding:9px 12px;border:1.5px solid #e4e0da;border-radius:8px;font-size:.88rem;outline:none;">
      </div>
      <button onclick="handleRegister()"
        style="width:100%;padding:11px;background:#d4521f;color:#fff;border:none;border-radius:8px;
               font-size:.88rem;font-weight:500;cursor:pointer;">
        Créer mon compte gratuitement
      </button>
      <div id="reg-err" style="margin-top:10px;font-size:.78rem;color:#c0392b;display:none;"></div>
    </div>

  </div>
</div>`;
        document.body.appendChild(modal);
    }
    modal.style.display = 'block';
    switchAuthTab(tab);
}

function hideAuthModal() {
    const m = document.getElementById('auth-modal');
    if (m) m.style.display = 'none';
}

function switchAuthTab(tab) {
    document.getElementById('tab-login').style.display    = tab === 'login'    ? 'block' : 'none';
    document.getElementById('tab-register').style.display = tab === 'register' ? 'block' : 'none';
    document.getElementById('tab-forgot').style.display   = tab === 'forgot'   ? 'block' : 'none';
    const loginBtn = document.getElementById('tab-login-btn');
    const regBtn   = document.getElementById('tab-register-btn');
    if (loginBtn) {
        loginBtn.style.background   = tab === 'login'    ? '#f8f6f3' : '#fff';
        loginBtn.style.color        = tab === 'login'    ? '#111'    : '#888';
        loginBtn.style.borderBottom = tab === 'login'    ? '2px solid #111' : '2px solid transparent';
        regBtn.style.background     = tab === 'register' ? '#f8f6f3' : '#fff';
        regBtn.style.color          = tab === 'register' ? '#111'    : '#888';
        regBtn.style.borderBottom   = tab === 'register' ? '2px solid #111' : '2px solid transparent';
    }
}

async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pwd   = document.getElementById('login-pwd').value;
    const err   = document.getElementById('login-err');
    err.style.display = 'none';
    try {
        await AuthAPI.login(email, pwd);
        hideAuthModal();
        await initApp(); // recharger l'app après connexion
        showToast('✅ Connecté !', 'success');
    } catch (e) {
        err.textContent   = e.message;
        err.style.display = 'block';
    }
}

async function handleRegister() {
    const prenom = document.getElementById('reg-prenom').value.trim();
    const nom    = document.getElementById('reg-nom').value.trim();
    const email  = document.getElementById('reg-email').value.trim();
    const pwd    = document.getElementById('reg-pwd').value;
    const err    = document.getElementById('reg-err');
    err.style.display = 'none';
    try {
        await AuthAPI.register(email, pwd, prenom, nom);
        hideAuthModal();
        await initApp();
        showToast('🎉 Compte créé ! Bienvenue', 'success');
    } catch (e) {
        err.textContent   = e.message;
        err.style.display = 'block';
    }
}

async function handleForgotPassword() {
    const email = document.getElementById('forgot-email').value.trim();
    const err   = document.getElementById('forgot-err');
    const ok    = document.getElementById('forgot-ok');
    err.style.display = 'none';
    ok.style.display  = 'none';
    if (!email) { err.textContent = 'Saisissez votre email.'; err.style.display = 'block'; return; }
    try {
        const res = await fetch(API_BASE + '/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        // Mode dev : afficher le lien directement
        if (data.reset_url) {
            ok.innerHTML = `Lien de reset (mode dev) :<br><a href="${data.reset_url}" target="_blank" style="color:#1e40af;word-break:break-all;">${data.reset_url}</a>`;
        } else {
            ok.textContent = data.message || 'Email envoyé !';
        }
        ok.style.display = 'block';
    } catch (e) {
        err.textContent   = e.message;
        err.style.display = 'block';
    }
}

function showResetModal(token) {
    let modal = document.getElementById('reset-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'reset-modal';
        modal.innerHTML = `
<div style="position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);
            display:grid;place-items:center;z-index:99999;">
  <div style="background:#fff;border-radius:12px;width:92%;max-width:400px;overflow:hidden;
              box-shadow:0 20px 60px rgba(0,0,0,.15);">
    <div style="background:#111;padding:20px 28px;">
      <p style="margin:0;font-size:1rem;font-weight:600;color:#fff;">Nouveau mot de passe</p>
      <p style="margin:4px 0 0;font-size:.78rem;color:#aaa;">Choisissez un mot de passe sécurisé (8 caractères min.)</p>
    </div>
    <div style="padding:24px 28px;">
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:.7rem;font-weight:600;color:#888;
                      text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;">Nouveau mot de passe</label>
        <input id="reset-pwd" type="password" placeholder="••••••••"
               style="width:100%;padding:9px 12px;border:1.5px solid #e4e0da;border-radius:8px;font-size:.88rem;outline:none;">
      </div>
      <div style="margin-bottom:20px;">
        <label style="display:block;font-size:.7rem;font-weight:600;color:#888;
                      text-transform:uppercase;letter-spacing:.6px;margin-bottom:5px;">Confirmer</label>
        <input id="reset-pwd2" type="password" placeholder="••••••••"
               style="width:100%;padding:9px 12px;border:1.5px solid #e4e0da;border-radius:8px;font-size:.88rem;outline:none;">
      </div>
      <button onclick="handleResetPassword('${token}')"
        style="width:100%;padding:11px;background:#111;color:#fff;border:none;border-radius:8px;
               font-size:.88rem;font-weight:500;cursor:pointer;">
        Valider le nouveau mot de passe
      </button>
      <div id="reset-err" style="margin-top:10px;font-size:.78rem;color:#c0392b;display:none;"></div>
    </div>
  </div>
</div>`;
        document.body.appendChild(modal);
    }
    modal.style.display = 'block';
    // Retirer le token de l'URL sans recharger
    history.replaceState({}, '', window.location.pathname);
}

async function handleResetPassword(token) {
    const pwd  = document.getElementById('reset-pwd').value;
    const pwd2 = document.getElementById('reset-pwd2').value;
    const err  = document.getElementById('reset-err');
    err.style.display = 'none';
    if (pwd.length < 8) { err.textContent = 'Mot de passe trop court (8 car. min.).'; err.style.display = 'block'; return; }
    if (pwd !== pwd2)   { err.textContent = 'Les mots de passe ne correspondent pas.'; err.style.display = 'block'; return; }
    try {
        const res = await fetch(API_BASE + '/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password: pwd }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        document.getElementById('reset-modal').style.display = 'none';
        showToast('✅ Mot de passe mis à jour ! Connectez-vous.', 'success');
        showAuthModal('login');
    } catch (e) {
        err.textContent   = e.message;
        err.style.display = 'block';
    }
}

// ══════════════════════════════════════════════════════════
//  REMPLACEMENT DES FONCTIONS localStorage (compatibilité)
//  Ces fonctions remplacent celles du script original
// ══════════════════════════════════════════════════════════

// Réinitialise le formulaire pour un nouveau document vierge
function newDocument() {
    if (window._formDirty && !confirm('Des modifications non sauvegardées seront perdues. Continuer ?')) return;
    window._currentDocId = null;
    window._savedNumero  = null;
    window._formDirty    = false;
    lignes = [];
    docType = 'devis';
    ['doc-num','doc-date','doc-echeance','doc-notes','cli-nom','cli-adr','cli-tel','cli-email'].forEach(id => set(id, ''));
    set('doc-date', new Date().toISOString().slice(0, 10)); // date du jour, sinon l'API refuse (date_emission requise)
    const sel = document.getElementById('client-select');
    if (sel) sel.value = '';
    document.querySelectorAll('.doc-type-toggle button').forEach(b => b.classList.remove('active'));
    const btnDevis = document.getElementById('btn-devis');
    if (btnDevis) btnDevis.classList.add('active');
    const lbl = document.getElementById('label-ech');
    if (lbl) lbl.textContent = "Valide jusqu'au";
    if (typeof renderLignes === 'function') renderLignes();
    showTab('form', document.querySelectorAll('.tab-btn')[0]);
    showToast('📄 Nouveau document');
}

// Surcharge de saveDoc() — envoie vers l'API au lieu du localStorage
async function saveDoc() {
    if (!g('doc-num')) { showToast('⚠️ Ajoutez un numéro de document', 'error'); return; }

    const docData = buildDocPayload();
    try {
        const saved = await DocumentsAPI.save(docData);
        window._currentDocId = saved.id;
        window._savedNumero  = saved.numero;
        window._formDirty    = false;
        updateSavedCount();
        showToast('✅ Document enregistré !', 'success');
    } catch (e) {
        if (e.status === 403) {
            openPaywall(); // limite plan free atteinte
        } else {
            showToast('⚠️ ' + e.message, 'error');
        }
    }
}

// Surcharge de renderSaved() — charge depuis l'API
async function renderSaved() {
    const c = document.getElementById('saved-list');
    if (!c) return;

    c.innerHTML = '<p style="text-align:center;padding:32px;color:#888;font-size:.84rem;">Chargement…</p>';

    try {
        const docs = await DocumentsAPI.list();
        updateSavedCountFromData(docs);

        if (!docs.length) {
            c.innerHTML = `<div class="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <strong>Aucun document enregistré</strong>
              <p>Vos devis et factures apparaîtront ici après avoir cliqué sur "Enregistrer".</p>
            </div>`;
            return;
        }

        c.innerHTML = docs.map(doc => `
          <div class="saved-item">
            <div class="saved-meta">
              <span class="badge badge-${doc.type}">${doc.type}</span>
              <span class="saved-doc-num">${escHtml(doc.numero || '—')}</span>
              <span class="saved-doc-info">${escHtml(doc.client_nom || '—')}</span>
              <span class="saved-doc-info">· ${fmtDate(doc.date_emission) || '—'}</span>
              <span class="saved-doc-ttc">${parseFloat(doc.total_ttc).toFixed(2)} €</span>
            </div>
            <div class="saved-actions">
              <button class="btn btn-outline btn-sm" onclick="loadDocFromApi(${doc.id})">Charger</button>
              <button class="btn btn-success btn-sm" onclick="downloadPdf(${doc.id},'${doc.numero}')" title="Télécharger PDF">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteDocApi(${doc.id})">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
              </button>
            </div>
          </div>`).join('');
    } catch (e) {
        c.innerHTML = `<p style="text-align:center;padding:32px;color:#c0392b;font-size:.84rem;">
          Erreur : ${e.message}</p>`;
    }
}

async function loadDocFromApi(id) {
    try {
        const doc = await DocumentsAPI.get(id);

        window._currentDocId = doc.id;
        window._savedNumero  = doc.numero;
        window._formDirty    = false; // bloquer sync() pendant le remplissage

        docType = doc.type;
        lignes  = doc.lignes || [];

        // Champs texte / date
        set('doc-num',      doc.numero);
        set('doc-date',     doc.date_emission);
        set('doc-echeance', doc.date_echeance || '');
        set('doc-notes',    doc.notes || '');
        set('cli-nom',      doc.client_nom || '');
        set('cli-adr',      doc.client_adresse || '');
        set('cli-tel',      doc.client_telephone || '');
        set('cli-email',    doc.client_email || '');

        // TVA — doit être définie AVANT renderLignes() pour des totaux corrects
        // MySQL renvoie "20.00", il faut matcher les valeurs du <select> ("20", "10", "5.5", "0")
        const tvaEl = document.getElementById('tva-def');
        if (tvaEl) tvaEl.value = String(parseFloat(doc.tva_taux || 20));

        // Type de document (boutons Devis / Facture)
        document.querySelectorAll('.doc-type-toggle button').forEach(b => b.classList.remove('active'));
        document.getElementById(doc.type === 'facture' ? 'btn-facture' : 'btn-devis').classList.add('active');
        const lbl = document.getElementById('label-ech');
        if (lbl) lbl.textContent = doc.type === 'facture' ? "Date d'échéance" : "Valide jusqu'au";

        renderLignes();
        window._formDirty = false; // renderLignes() appelle sync() — on remet à false
        showTab('form', document.querySelectorAll('.tab-btn')[0]);
        showToast('📂 Document chargé');
    } catch (e) {
        showToast('⚠️ ' + e.message, 'error');
    }
}

async function deleteDocApi(id) {
    if (!confirm('Supprimer ce document définitivement ?')) return;
    try {
        await DocumentsAPI.delete(id);
        if (window._currentDocId === id) {
            window._currentDocId = null;
            window._savedNumero  = null;
        }
        showToast('🗑️ Document supprimé');
        renderSaved();
    } catch (e) {
        showToast('⚠️ ' + e.message, 'error');
    }
}

function updateSavedCount() {
    // Sera mis à jour au prochain appel renderSaved() via l'API
}
function updateSavedCountFromData(docs) {
    const badge = document.getElementById('saved-count');
    if (badge) {
        badge.style.display = docs.length ? '' : 'none';
        badge.textContent   = docs.length;
    }
}

// ── Construit le payload JSON à envoyer à l'API ──────────────────────────
function buildDocPayload() {
    const { tva } = getTotaux();
    const currentNumero = g('doc-num');
    // Si le numéro a changé depuis la dernière sauvegarde, on crée un nouveau document
    const isSameDoc = window._currentDocId && currentNumero === window._savedNumero;
    return {
        id:               isSameDoc ? window._currentDocId : null,
        type:             docType,
        numero:           g('doc-num'),
        date_emission:    g('doc-date'),
        date_echeance:    g('doc-echeance') || null,
        notes:            g('doc-notes'),
        tva_taux:         parseFloat(document.getElementById('tva-def')?.value || 20),
        client_nom:       g('cli-nom'),
        client_adresse:   g('cli-adr'),
        client_telephone: g('cli-tel'),
        client_email:     g('cli-email'),
        lignes:           lignes,
    };
}

// ══════════════════════════════════════════════════════════
//  PROFIL — surcharge saveProfil()
// ══════════════════════════════════════════════════════════
async function saveProfil() {
    try {
        await UserAPI.update({
            entreprise: {
                nom:    g('ent-nom'),
                siret:  g('ent-siret'),
                num_tva:g('ent-tva'),
                adresse:g('ent-adr'),
                telephone:g('ent-tel'),
                email:  g('ent-email'),
            }
        });
        showToast('💾 Profil sauvegardé', 'success');
    } catch (e) {
        showToast('⚠️ ' + e.message, 'error');
    }
}

// ══════════════════════════════════════════════════════════
//  INIT DE L'APP
// ══════════════════════════════════════════════════════════
async function initApp() {
    if (!Auth.isLoggedIn()) {
        showAuthModal('login');
        return;
    }
    try {
        const user = await UserAPI.me();
        // Pré-remplir le profil entreprise
        const e = user.entreprise;
        if (e) {
            set('ent-nom',   e.nom);
            set('ent-siret', e.siret);
            set('ent-tva',   e.num_tva);
            set('ent-adr',   e.adresse);
            set('ent-tel',   e.telephone);
            set('ent-email', e.email);
            // Logo
            if (e.logo_path) {
                logoB64 = null; // on utilise l'URL serveur, pas base64
                const img      = document.getElementById('logo-preview');
                const ph       = document.getElementById('logo-placeholder');
                const removeBtn= document.getElementById('logo-remove');
                const zone     = document.getElementById('logo-zone');
                if (img) { img.src = UPLOAD_URL + e.logo_path; img.style.display = 'block'; }
                if (ph)  ph.style.display = 'none';
                if (removeBtn) removeBtn.style.display = 'grid';
                if (zone) zone.classList.add('has-logo');
            }
        }
        // Stocker le plan pour les vérifications côté client
        window._userPlan = user.plan_slug;

        // Badge plan
        const planBadge = document.querySelector('.pro-badge');
        if (planBadge && user.plan_slug === 'pro') {
            planBadge.textContent = '⭐ Pro';
        }
        // Afficher le bouton déconnexion
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.style.display = '';
        updateSavedCountFromData({ length: user.docs_count });

        // Charger la liste des clients pour le sélecteur
        loadClientsList();
    } catch (e) {
        console.error("Erreur lors de l'init :", e);
        if (e.status === 401) showAuthModal();
    }
}

// Override handleLogoUpload pour utiliser l'API (plan Pro seulement)
const _origHandleLogoUpload = window.handleLogoUpload;
window.handleLogoUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        showToast('⚠️ Logo trop lourd (max 2 Mo)', 'error');
        return;
    }
    try {
        const result = await UserAPI.uploadLogo(file);
        // Afficher le logo depuis l'URL serveur
        const img = document.getElementById('logo-preview');
        if (img) { img.src = result.logo_url; img.style.display = 'block'; }
        document.getElementById('logo-placeholder').style.display = 'none';
        document.getElementById('logo-remove').style.display      = 'grid';
        document.getElementById('logo-zone').classList.add('has-logo');
        showToast('✅ Logo uploadé !', 'success');
        sync();
    } catch (e) {
        if (e.status === 403) openPaywall();
        else showToast('⚠️ ' + e.message, 'error');
    }
};

const UPLOAD_URL = 'http://localhost/projetOCR/API/devisArtisan/uploads/logos/';

// ══════════════════════════════════════════════════════════
//  SUBSCRIPTION API
// ══════════════════════════════════════════════════════════
const SubscriptionAPI = {
    get()     { return apiFetch('/subscription'); },
    upgrade() { return apiFetch('/subscription/upgrade', { method: 'POST' }); },
    cancel()  { return apiFetch('/subscription/cancel',  { method: 'POST' }); },
};

// ══════════════════════════════════════════════════════════
//  ONGLET MON COMPTE
// ══════════════════════════════════════════════════════════
async function renderSubscription() {
    try {
        const s = await SubscriptionAPI.get();
        renderPlanBlock(s);
        renderUsageBlock(s);
        renderFeaturesBlock(s);
    } catch (e) {
        document.getElementById('sub-plan-block').innerHTML =
            `<p style="color:#c0392b;font-size:.84rem;">Erreur : ${e.message}</p>`;
    }
}

function renderPlanBlock(s) {
    const isPro     = s.plan === 'pro';
    const expiresAt = s.expires_at ? new Date(s.expires_at).toLocaleDateString('fr-FR') : null;

    document.getElementById('sub-plan-block').innerHTML = `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
            <div style="width:48px;height:48px;border-radius:50%;background:${isPro ? 'linear-gradient(135deg,#d4521f,#a33c12)' : 'var(--paper-2)'};
                        display:grid;place-items:center;flex-shrink:0;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="${isPro ? '#fff' : 'var(--ink-3)'}">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
            </div>
            <div>
                <div style="font-size:1.1rem;font-weight:700;color:var(--ink);">${s.plan_label}</div>
                <div style="font-size:.78rem;color:var(--ink-3);">
                    ${isPro ? (expiresAt ? `Renouvellement le ${expiresAt}` : 'Actif') : 'Gratuit · 5 documents inclus'}
                </div>
            </div>
        </div>
        ${isPro ? `
            <button class="btn btn-outline btn-sm" style="width:100%;justify-content:center;color:#c0392b;border-color:#c0392b;"
                    onclick="handleCancel()">
                Annuler l'abonnement
            </button>
        ` : `
            <button class="btn btn-accent" style="width:100%;justify-content:center;font-size:.9rem;padding:11px;"
                    onclick="handleUpgrade()">
                ✦ Passer à DevisArtisan Pro — 19 €/mois
            </button>
            <p style="font-size:.72rem;color:var(--ink-4);text-align:center;margin-top:8px;">Sans engagement · Annulable à tout moment</p>
        `}
    `;
}

function renderUsageBlock(s) {
    const isPro  = s.plan === 'pro';
    const max    = isPro ? null : s.docs_max;
    const count  = s.docs_count;
    const pct    = max ? Math.min(100, Math.round(count / max * 100)) : 0;
    const color  = pct >= 80 ? '#c0392b' : pct >= 50 ? '#f59e0b' : 'var(--green)';

    document.getElementById('sub-usage-block').innerHTML = `
        <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:.82rem;color:var(--ink-2);">Documents</span>
                <span style="font-size:.82rem;font-weight:600;color:var(--ink);">
                    ${count} / ${isPro ? '∞' : max}
                </span>
            </div>
            ${!isPro ? `
            <div style="background:var(--paper-2);border-radius:99px;height:6px;overflow:hidden;">
                <div style="width:${pct}%;height:100%;background:${color};border-radius:99px;transition:width .4s;"></div>
            </div>
            <p style="font-size:.72rem;color:${color};margin-top:5px;">
                ${max - count <= 0 ? '⚠️ Limite atteinte' : `${max - count} document(s) restant(s)`}
            </p>` : `
            <p style="font-size:.78rem;color:var(--green);margin-top:4px;">✓ Documents illimités</p>
            `}
        </div>
        ${!isPro ? `
        <div style="margin-top:14px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:.82rem;color:var(--ink-2);">PDF téléchargés / imprimés</span>
                <span style="font-size:.82rem;font-weight:600;color:${s.pdf_count >= s.pdf_max ? '#c0392b' : 'var(--ink)'};">
                    ${s.pdf_count} / ${s.pdf_max}
                </span>
            </div>
            <div style="background:var(--paper-2);border-radius:99px;height:6px;overflow:hidden;">
                <div style="width:${Math.min(100, Math.round(s.pdf_count / s.pdf_max * 100))}%;height:100%;
                            background:${s.pdf_count >= s.pdf_max ? '#c0392b' : s.pdf_count >= s.pdf_max * 0.8 ? '#f59e0b' : 'var(--green)'};
                            border-radius:99px;transition:width .4s;"></div>
            </div>
            <p style="font-size:.72rem;color:${s.pdf_count >= s.pdf_max ? '#c0392b' : 'var(--ink-3)'};margin-top:5px;">
                ${s.pdf_count >= s.pdf_max ? '⚠️ Limite atteinte — passez Pro' : `${s.pdf_max - s.pdf_count} PDF restant(s)`}
            </p>
        </div>` : `<p style="font-size:.78rem;color:var(--green);margin-top:4px;">✓ PDF illimités</p>`}
        <div style="margin-top:14px;">
            <div style="display:flex;justify-content:space-between;">
                <span style="font-size:.82rem;color:var(--ink-2);">Logo entreprise</span>
                <span style="font-size:.82rem;font-weight:600;color:${s.logo ? 'var(--green)' : 'var(--ink-3)'};">
                    ${s.logo ? '✓ Activé' : '✗ Pro uniquement'}
                </span>
            </div>
        </div>
    `;
}

function renderFeaturesBlock(s) {
    const isPro = s.plan === 'pro';
    const features = [
        { label: 'Création de devis & factures',  free: true,  pro: true },
        { label: 'Numérotation automatique',       free: true,  pro: true },
        { label: 'Aperçu & impression PDF',        free: true,  pro: true },
        { label: 'Sauvegarde des documents',       free: '5 max', pro: 'Illimité' },
        { label: 'Logo personnalisé',              free: false, pro: true },
        { label: 'Envoi par email au client',      free: false, pro: true },
        { label: 'Tableau de bord statistiques',   free: false, pro: true },
        { label: 'Export PDF sans watermark',      free: false, pro: true },
    ];

    const rows = features.map(f => {
        const val    = isPro ? f.pro : f.free;
        const label  = val === true ? '✓' : val === false ? '✗' : val;
        const color  = val === false ? 'var(--ink-4)' : val === true ? 'var(--green)' : 'var(--blue)';
        return `<tr>
            <td style="padding:8px 0;font-size:.84rem;color:var(--ink-2);border-bottom:1px solid var(--border);">${f.label}</td>
            <td style="padding:8px 0;text-align:right;font-size:.84rem;font-weight:600;color:${color};border-bottom:1px solid var(--border);">${label}</td>
        </tr>`;
    }).join('');

    document.getElementById('sub-features-block').innerHTML = `
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
    `;
}

async function handleUpgrade() {
    const btn = document.querySelector('#sub-plan-block button');
    if (btn) { btn.disabled = true; btn.textContent = 'Activation…'; }
    try {
        await SubscriptionAPI.upgrade();
        showToast('🎉 Plan Pro activé !', 'success');
        await renderSubscription();
        // Mettre à jour le badge header
        const planBadge = document.querySelector('.pro-badge');
        if (planBadge) planBadge.innerHTML = '⭐ Pro';
    } catch (e) {
        showToast('⚠️ ' + e.message, 'error');
        await renderSubscription();
    }
}

async function handleCancel() {
    if (!confirm('Annuler votre abonnement Pro ? Vous repasserez sur le plan gratuit immédiatement.')) return;
    try {
        await SubscriptionAPI.cancel();
        showToast('Abonnement annulé. Retour au plan Free.', '');
        await renderSubscription();
        const planBadge = document.querySelector('.pro-badge');
        if (planBadge) planBadge.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> Passer Pro`;
    } catch (e) {
        showToast('⚠️ ' + e.message, 'error');
    }
}

// ══════════════════════════════════════════════════════════
//  IMPRESSION & TÉLÉCHARGEMENT PDF
// ══════════════════════════════════════════════════════════
async function handlePrint() {
    if (!window._currentDocId) {
        showToast('⚠️ Enregistrez le document avant d\'imprimer', 'error');
        return;
    }
    if (window._formDirty) {
        showToast('⚠️ Sauvegardez vos modifications avant d\'imprimer', 'error');
        return;
    }
    try {
        await apiFetch('/documents/' + window._currentDocId + '/track-print', { method: 'POST' });
        window.print();
    } catch (e) {
        if (e.status === 403) { openPaywall(); }
        showToast('⚠️ ' + e.message, 'error');
    }
}

async function downloadPdf(docId, numero) {
    try {
        const response = await fetch(API_BASE + '/documents/' + docId + '/pdf', {
            headers: { 'Authorization': 'Bearer ' + Auth.getAccessToken() },
        });

        if (response.status === 403) {
            const err = await response.json().catch(() => ({}));
            openPaywall();
            showToast('⚠️ ' + (err.error || 'Limite PDF atteinte'), 'error');
            return;
        }
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Erreur serveur' }));
            showToast('⚠️ ' + err.error, 'error');
            return;
        }

        const blob = await response.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = (numero || 'document') + '.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('✅ PDF téléchargé !', 'success');
    } catch (e) {
        showToast('⚠️ ' + e.message, 'error');
    }
}

// Télécharge le PDF du document actuellement ouvert dans l'aperçu
async function downloadCurrentPdf() {
    if (!window._currentDocId) {
        showToast('⚠️ Enregistrez le document avant de télécharger le PDF', 'error');
        return;
    }
    if (window._formDirty) {
        showToast('⚠️ Sauvegardez vos modifications avant de télécharger le PDF', 'error');
        return;
    }
    const numero = document.getElementById('doc-num')?.value || 'document';
    await downloadPdf(window._currentDocId, numero);
}

// ══════════════════════════════════════════════════════════
//  CLIENTS — sélecteur dans le formulaire
// ══════════════════════════════════════════════════════════
let _clients = [];

async function loadClientsList() {
    try {
        _clients = await ClientsAPI.list();
        refreshClientSelect();
    } catch (e) {
        // Silencieux si non connecté
    }
}

function refreshClientSelect() {
    const sel = document.getElementById('client-select');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Sélectionner ou saisir manuellement —</option>'
        + _clients.map(c => `<option value="${c.id}">${escHtml(c.nom)}${c.ville ? ' — ' + escHtml(c.ville) : ''}</option>`).join('');
    sel.value = current;
}

function applyClient(id) {
    if (!id) return;
    const c = _clients.find(c => c.id == id);
    if (!c) return;

    const parts = [c.adresse, c.code_postal, c.ville].filter(Boolean);
    set('cli-nom',   c.nom        || '');
    set('cli-adr',   parts.join(', '));
    set('cli-tel',   c.telephone  || '');
    set('cli-email', c.email      || '');
    if (typeof sync === 'function') sync();
    showToast('👤 Client chargé');
}

async function saveCurrentClient() {
    const nom = g('cli-nom');
    if (!nom) { showToast('⚠️ Saisissez d\'abord un nom de client', 'error'); return; }

    // Vérifier si un client avec ce nom existe déjà
    const exists = _clients.find(c => c.nom.toLowerCase() === nom.toLowerCase());
    if (exists && !confirm(`Un client "${nom}" existe déjà. Créer quand même ?`)) return;

    try {
        const adr = g('cli-adr');
        const created = await ClientsAPI.create({
            nom,
            adresse:   adr,
            telephone: g('cli-tel'),
            email:     g('cli-email'),
        });
        _clients.push(created);
        _clients.sort((a, b) => a.nom.localeCompare(b.nom));
        refreshClientSelect();
        document.getElementById('client-select').value = created.id;
        showToast('✅ Client enregistré', 'success');
    } catch (e) {
        showToast('⚠️ ' + e.message, 'error');
    }
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD API
// ══════════════════════════════════════════════════════════
const DashboardAPI = {
    get() { return apiFetch('/dashboard'); },
};

const _statutLabels = {
    brouillon:  'Brouillon',
    envoye:     'Envoyé',
    accepte:    'Accepté',
    refuse:     'Refusé',
    converti:   'Converti',
    en_attente: 'En attente',
    paye:       'Payé',
    annule:     'Annulé',
};

async function renderDashboard() {
    ['kpi-total','kpi-devis','kpi-factures','kpi-clients'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '…';
    });

    try {
        const d = await DashboardAPI.get();

        // ── KPI ───────────────────────────────────────────────────────
        document.getElementById('kpi-total').textContent    = d.total_docs;
        document.getElementById('kpi-devis').textContent    = d.nb_devis;
        document.getElementById('kpi-factures').textContent = d.nb_factures;
        document.getElementById('kpi-clients').textContent  = d.nb_clients;

        // ── Bar chart documents par mois ──────────────────────────────
        const chart = document.getElementById('chart-ca');
        if (chart) {
            const max = Math.max(...d.docs_par_mois.map(m => m.nb), 1);
            chart.innerHTML = d.docs_par_mois.map(m => {
                const pct   = Math.round((m.nb / max) * 100);
                const empty = m.nb === 0;
                return `<div class="bar-col">
                    <div class="bar-val">${m.nb > 0 ? m.nb : ''}</div>
                    <div class="bar-fill${empty ? ' empty' : ''}" style="height:${Math.max(pct, empty ? 8 : 6)}%"></div>
                    <div class="bar-label">${m.label}</div>
                </div>`;
            }).join('');
        }

        // ── Documents récents ─────────────────────────────────────────
        const recent = document.getElementById('dash-recent');
        if (recent) {
            if (!d.recent.length) {
                recent.innerHTML = '<p style="color:var(--ink-3);font-size:.82rem;text-align:center;padding:16px 0;">Aucun document</p>';
            } else {
                recent.innerHTML = d.recent.map(doc => `
                    <div class="dash-doc-row">
                        <div class="dash-doc-info">
                            <span class="badge badge-${doc.type}">${doc.type}</span>
                            <div>
                                <div class="dash-doc-num">${escHtml(doc.numero)}</div>
                                <div class="dash-doc-cli">${escHtml(doc.client_nom || '—')}</div>
                            </div>
                        </div>
                        <div class="dash-doc-right">
                            <span class="dash-doc-ttc">${fmtDate(doc.date_emission)}</span>
                            <button class="btn btn-ghost btn-xs" onclick="loadDocFromApi(${doc.id});showTab('form',document.querySelectorAll('.tab-btn')[0])">Ouvrir</button>
                        </div>
                    </div>`).join('');
            }
        }
    } catch (e) {
        ['kpi-total','kpi-devis','kpi-factures','kpi-clients'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
        });
        const chart = document.getElementById('chart-ca');
        if (chart) chart.innerHTML = `<p style="color:#c0392b;font-size:.8rem;">Erreur : ${e.message}</p>`;
    }
}

// ══════════════════════════════════════════════════════════
//  ENVOI PAR EMAIL
// ══════════════════════════════════════════════════════════
function openSendModal() {
    if (window._userPlan !== 'pro') {
        openPaywall();
        return;
    }
    if (!window._currentDocId) {
        showToast('⚠️ Enregistrez le document avant de l\'envoyer', 'error');
        return;
    }
    if (window._formDirty) {
        showToast('⚠️ Sauvegardez vos modifications avant d\'envoyer', 'error');
        return;
    }
    // Pré-remplir l'email du client si disponible
    const emailInput = document.getElementById('send-email-to');
    if (emailInput && !emailInput.value) {
        emailInput.value = g('cli-email') || '';
    }
    document.getElementById('modal-send-email').classList.add('open');
    if (emailInput) emailInput.focus();
}

function closeSendModal() {
    document.getElementById('modal-send-email').classList.remove('open');
    document.getElementById('send-email-to').value  = '';
    document.getElementById('send-email-msg').value = '';
}

async function submitSendEmail() {
    const to      = document.getElementById('send-email-to').value.trim();
    const message = document.getElementById('send-email-msg').value.trim();
    const btn     = document.querySelector('#modal-send-email .btn-primary');

    if (!to) {
        showToast('⚠️ Saisissez une adresse email', 'error');
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Envoi en cours…'; }
    try {
        await DocumentsAPI.send(window._currentDocId, { to, message });
        closeSendModal();
        showToast('✅ Document envoyé par email !', 'success');
    } catch (e) {
        if (e.status === 403) { closeSendModal(); openPaywall(); }
        else showToast('⚠️ ' + e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Envoyer';
        }
    }
}

// Lancer l'app dès que le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    const resetToken = new URLSearchParams(window.location.search).get('reset_token');
    if (resetToken) {
        showResetModal(resetToken);
    } else {
        initApp();
    }
});