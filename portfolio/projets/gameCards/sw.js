// Service worker de GameCards : garde en cache les fichiers du jeu pour pouvoir y rejouer hors ligne.
//   Page (navigation) : le réseau d'abord, la copie en cache si on est hors ligne.
//   Autres fichiers du jeu et polices : la copie en cache tout de suite, mise à jour en arrière-plan.
//   Les images Steam ne sont pas gardées (des dizaines de milliers possibles).
const CACHE = 'gamecards-v1';

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(cache => cache.add('./')).then(() => self.skipWaiting()));
});

// Nouvelle version du service worker : on supprime les anciens caches
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys()
        .then(noms => Promise.all(noms.filter(nom => nom !== CACHE).map(nom => caches.delete(nom))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    const requete = e.request;
    if (requete.method !== 'GET') return;
    const url = new URL(requete.url);
    const aGarder = url.origin === location.origin || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
    if (!aGarder) return;

    if (requete.mode === 'navigate') {
        e.respondWith(fetch(requete)
            .then(reponse => {
                caches.open(CACHE).then(cache => cache.put('./', reponse.clone()));
                return reponse;
            })
            .catch(() => caches.match('./')));
        return;
    }

    e.respondWith(caches.open(CACHE).then(async cache => {
        const enCache = await cache.match(requete);
        const reseau = fetch(requete)
            .then(reponse => {
                if (reponse.ok || reponse.type === 'opaque') cache.put(requete, reponse.clone());
                return reponse;
            })
            .catch(() => enCache);
        return enCache || reseau;
    }));
});
