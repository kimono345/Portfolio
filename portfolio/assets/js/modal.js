// ====================================================
// MODALE PROJET (partagée grille + planètes)
// ====================================================
// Moment d'ouverture : au doigt, le « clic » qui suit le toucher tombe sur le fond
// de la modale qui vient d'apparaître et la refermerait aussitôt.
let modalOpenedAt = 0;

function openProjectModal(p) {
    const modal = document.getElementById('project-modal');
    document.getElementById('modal-category').textContent = p.category;
    document.getElementById('modal-title').textContent = p.name;
    document.getElementById('modal-desc').textContent = p.desc;
    const tagsEl = document.getElementById('modal-tags');
    tagsEl.innerHTML = '';
    p.tags.forEach(t => {
        const el = document.createElement('span');
        el.className = 'text-xs font-semibold px-3 py-1 rounded-md tag';
        el.textContent = t;
        tagsEl.appendChild(el);
    });
    const box = document.getElementById('modal-box');
    const prev = document.getElementById('modal-preview');
    const iframe = document.getElementById('modal-iframe');
    const loader = document.getElementById('modal-preview-loader');
    box.classList.toggle('max-w-2xl', !p.preview);
    box.classList.toggle('max-w-6xl', !!p.preview);
    prev.classList.toggle('hidden', !p.preview);
    if (p.preview) {
        loader.style.display = '';
        iframe.style.opacity = '0';
        iframe.onload = () => { loader.style.display = 'none'; iframe.style.opacity = '1'; };
        iframe.src = p.preview;
        document.getElementById('modal-fullscreen').href = p.preview;
    }
    const demo = document.getElementById('modal-demo');
    const gh = document.getElementById('modal-github');
    demo.style.display = p.demo ? '' : 'none';
    gh.style.display = p.github ? '' : 'none';
    if (p.demo) demo.href = p.demo;
    if (p.github) gh.href = p.github;
    const dl = document.getElementById('modal-download');
    dl.style.display = p.download ? '' : 'none';
    if (p.download) dl.href = p.download;
    modal.classList.remove('hidden');
    modalOpenedAt = performance.now();
    document.body.classList.add('modal-active');
}

// Quand la modale se ferme : on coupe la démo (libère la mémoire)
(() => {
    const modal = document.getElementById('project-modal');
    new MutationObserver(() => {
        if (modal.classList.contains('hidden')) {
            const f = document.getElementById('modal-iframe');
            if (f && f.getAttribute('src')) f.removeAttribute('src');
        }
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
})();

// Échap ferme aussi la modale
window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
        const m = document.getElementById('project-modal');
        if (!m.classList.contains('hidden')) {
            m.classList.add('hidden');
            document.body.classList.remove('modal-active');
        }
    }
});

// Fermeture : bouton ✕ ou clic en dehors de la boîte
const modal = document.getElementById('project-modal');
const closeModal = document.getElementById('close-modal');

closeModal.addEventListener('click', () => {
    modal.classList.add('hidden');
    document.body.classList.remove('modal-active');
});

modal.addEventListener('click', (e) => {
    if (e.target === modal && performance.now() - modalOpenedAt > 400) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-active');
    }
});
