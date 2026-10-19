// ====================================================
// MODE D'AFFICHAGE : « espace » (coloré) ou « pro » (noir et or)
// L'attribut data-mode est posé dès le <head> pour éviter un flash au chargement.
// ====================================================
const SiteMode = {
    KEY: 'portfolio-mode',
    isPro() { return document.documentElement.dataset.mode === 'pro'; },
    set(mode) {
        if (mode === 'pro') document.documentElement.dataset.mode = 'pro';
        else delete document.documentElement.dataset.mode;
        try { localStorage.setItem(this.KEY, mode); } catch (e) {}
        this.syncButtons();
    },
    syncButtons() {
        const current = this.isPro() ? 'pro' : 'space';
        document.querySelectorAll('[data-mode-set]').forEach(b => {
            b.setAttribute('aria-pressed', String(b.dataset.modeSet === current));
        });
    }
};

document.querySelectorAll('[data-mode-set]').forEach(b => {
    b.addEventListener('click', () => SiteMode.set(b.dataset.modeSet));
});
SiteMode.syncButtons();

// Transition douce entre les deux ambiances pour les scènes Three.js (0 = espace, 1 = pro)
function modeBlend(current, dt) {
    const target = SiteMode.isPro() ? 1 : 0;
    return current + (target - current) * (1 - Math.pow(0.05, dt));
}
