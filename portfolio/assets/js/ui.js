// Interface : année du footer, en-tête, lien actif, apparitions, menu mobile, formulaire de contact
document.getElementById('year').textContent = new Date().getFullYear();

// EN-TÊTE : fond flouté dès qu'on quitte le haut de page (sinon le nom passe sur le contenu)
const navbar = document.getElementById('navbar');
const updateNavbar = () => navbar.classList.toggle('is-scrolled', window.scrollY > 24);
window.addEventListener('scroll', updateNavbar, { passive: true });
updateNavbar();

// LIEN ACTIF : la section au centre de l'écran est mise en avant dans le menu
const navLinks = document.querySelectorAll('.nav-link, .mobile-link');
const spyObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + entry.target.id));
    });
}, { rootMargin: '-45% 0px -50% 0px' });
document.querySelectorAll('main section[id]').forEach(s => spyObserver.observe(s));

// APPARITIONS AU DÉFILEMENT : fondu + léger glissement, en cascade dans un même groupe.
// Les classes sont posées en JS : sans JS, tout reste visible.
if (!REDUCED_MOTION && 'IntersectionObserver' in window) {
    const groups = [
        'main section:not(#hero) > .text-center',       // titres de section
        '#about .md\\:col-span-5, #about .md\\:col-span-7',
        '#experience .relative.group',
        '#skills .grid > .glass-panel, #skills > .glass-panel',
        '.view-switch, #project-filters, .project-card',
        '#contact .lg\\:col-span-5, #contact .lg\\:col-span-7',
    ];
    const revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            el.classList.add('is-visible');
            revealObserver.unobserve(el);
            // une fois apparu, on rend la main aux transitions normales (survol des cartes)
            setTimeout(() => { el.classList.remove('reveal', 'is-visible'); el.style.transitionDelay = ''; }, 1200);
        });
    }, { rootMargin: '0px 0px -8% 0px' });
    groups.forEach(sel => {
        document.querySelectorAll(sel).forEach((el, i) => {
            el.classList.add('reveal');
            el.style.transitionDelay = Math.min(i, 5) * 80 + 'ms';
            revealObserver.observe(el);
        });
    });
}

// RETOUR EN HAUT
document.getElementById('back-to-top')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// MENU MOBILE
const mobileBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

mobileBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
    mobileMenu.classList.toggle('flex');
});

document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        mobileMenu.classList.remove('flex');
    });
});

// FORMULAIRE DE CONTACT → ouvre la messagerie du visiteur (mailto)
const CONTACT_EMAIL = 'killianrocherodriguez@gmail.com';
const contactForm = document.getElementById('contact-form');

contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('cf-name').value.trim();
    const subject = document.getElementById('cf-subject').value.trim();
    const message = document.getElementById('cf-message').value.trim();
    const body = `${message}\n\n— ${name}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
