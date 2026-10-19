// ====================================================
// GRILLE « PROJETS RÉCENTS » (générée depuis PROJECTS)
// ====================================================
(() => {
    const grid = document.getElementById('projects-grid');
    const filtersEl = document.getElementById('project-filters');
    if (!grid || !filtersEl) return;

    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    };
    const icon = (name, className) => {
        const i = el('i', className);
        i.setAttribute('data-lucide', name);
        return i;
    };
    const iconLink = (href, name, title) => {
        const a = el('a', 'text-brand-muted hover:text-white transition-colors');
        a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.title = title;
        a.appendChild(icon(name, 'w-4 h-4'));
        return a;
    };

    function createCard(p) {
        const card = el('div', 'project-card glass-panel rounded-2xl overflow-hidden group flex flex-col justify-between');
        card.dataset.filters = p.filters.join(' ');
        card.dataset.id = p.id;

        // Visuel : capture d'écran si disponible, sinon icône sur halo aux couleurs de la planète
        const head = el('div', 'h-56 relative overflow-hidden flex items-center justify-center p-6 border-b border-brand-border cursor-pointer');
        head.style.background = `radial-gradient(circle at 50% 55%, ${hex(p.glow)}26 0%, ${hex(p.color)}14 35%, transparent 70%), linear-gradient(135deg, #111115, rgba(255,255,255,0.03))`;
        const badge = el('div', 'w-16 h-16 rounded-2xl bg-brand-bg/80 border flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-xl');
        badge.style.color = hex(p.glow);
        badge.style.borderColor = hex(p.glow) + '55';
        badge.appendChild(icon(p.icon || 'folder', 'w-8 h-8'));
        head.appendChild(badge);
        if (p.image) {
            const shot = el('img', 'absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700');
            shot.src = p.image;
            shot.alt = `Capture d'écran de ${p.name}`;
            shot.loading = 'lazy';
            const shade = el('div', 'absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none');
            // l'icône devient une petite pastille en bas à gauche
            badge.className = 'absolute left-4 bottom-4 w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md border flex items-center justify-center shadow-xl';
            badge.firstChild.setAttribute('class', 'w-5 h-5');
            shot.addEventListener('error', () => { shot.remove(); shade.remove(); badge.className = 'w-16 h-16 rounded-2xl bg-brand-bg/80 border flex items-center justify-center shadow-xl'; });
            head.prepend(shot, shade);
        }
        if (p.preview) {
            const live = el('span', 'absolute top-4 right-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-black/60 backdrop-blur-md border border-emerald-500/30 rounded-full px-2.5 py-1');
            live.append(el('span', 'w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse'), document.createTextNode('Démo jouable'));
            head.appendChild(live);
        }
        head.addEventListener('click', () => openProjectModal(p));

        // Contenu
        const body = el('div', 'p-7 space-y-4 flex-1 flex flex-col justify-between');
        const text = el('div', 'space-y-2');
        text.append(
            el('span', 'text-[11px] font-bold text-brand-gold tracking-widest uppercase', p.category),
            el('h3', 'text-xl font-bold text-white group-hover:text-brand-gold transition-colors', p.name),
            el('p', 'text-slate-300 text-sm leading-relaxed line-clamp-2', p.short)
        );

        const bottom = el('div', 'space-y-4 pt-2');
        const tags = el('div', 'flex flex-wrap gap-2');
        p.tags.slice(0, 3).forEach(t => tags.appendChild(el('span', 'text-[10px] font-medium px-2.5 py-1 rounded-md tag', t)));
        if (p.tags.length > 3) tags.appendChild(el('span', 'text-[10px] font-medium px-2.5 py-1 rounded-md text-slate-400', '+' + (p.tags.length - 3)));

        const actions = el('div', 'flex items-center justify-between pt-3 border-t border-brand-border/50 text-xs font-semibold');
        const open = el('button', 'text-white hover:text-brand-gold flex items-center gap-1.5 transition-colors');
        open.append(icon(p.preview ? 'play' : 'info', 'w-4 h-4 text-brand-gold'), el('span', '', p.preview ? 'Lancer la démo' : 'Aperçu rapide'));
        open.addEventListener('click', () => openProjectModal(p));
        const links = el('div', 'flex items-center gap-3');
        if (p.github) links.appendChild(iconLink(p.github, 'github', 'Code source'));
        if (p.download) links.appendChild(iconLink(p.download, 'download', 'Télécharger pour Windows'));
        if (p.demo) links.appendChild(iconLink(p.demo, 'external-link', 'Ouvrir le projet'));
        actions.append(open, links);

        bottom.append(tags, actions);
        body.append(text, bottom);
        card.append(head, body);
        return card;
    }

    PROJECTS.forEach(p => grid.appendChild(createCard(p)));

    // Filtres (seuls ceux qui contiennent au moins un projet sont affichés)
    const BTN = 'filter-btn px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all';
    const ON = 'bg-white text-brand-bg shadow-lg';
    const OFF = 'glass-panel text-brand-muted hover:text-white';
    const cards = grid.querySelectorAll('.project-card');

    function showCards(keep) {
        cards.forEach(card => {
            if (keep(card)) {
                card.style.display = 'flex';
                setTimeout(() => { card.style.opacity = '1'; }, 50);
            } else {
                card.style.opacity = '0';
                setTimeout(() => { card.style.display = 'none'; }, 200);
            }
        });
    }

    function applyFilter(key) {
        clearTechPill();
        filtersEl.querySelectorAll('.filter-btn').forEach(b => {
            b.className = `${BTN} ${b.dataset.filter === key ? ON : OFF}`;
        });
        showCards(card => key === 'all' || card.dataset.filters.split(' ').includes(key));
    }

    PROJECT_FILTERS
        .filter(f => f.key === 'all' || PROJECTS.some(p => p.filters.includes(f.key)))
        .forEach(f => {
            const b = el('button', `${BTN} ${f.key === 'all' ? ON : OFF}`, f.label);
            b.dataset.filter = f.key;
            b.addEventListener('click', () => applyFilter(f.key));
            filtersEl.appendChild(b);
        });

    // ----------------------------------------------------
    // FILTRE PAR TECHNOLOGIE (depuis la section Compétences)
    // ----------------------------------------------------
    // Par défaut, une compétence correspond aux projets qui ont un tag du même nom.
    // Quelques compétences portent un autre nom que les tags :
    const SKILL_MATCH = {
        'SQL': ['MySQL', 'PDO'],
        'Authentification JWT': ['JWT'],
        'API REST': ['PHP', 'PokéAPI'],
        'WebGL': ['Three.js'],
        'HTML / CSS': ['HTML / CSS', 'HTML5', 'CSS'],
        'Game design': p => p.filters.includes('jeu'),
    };
    const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();

    function projectsUsing(skill) {
        const rule = SKILL_MATCH[skill] || [skill];
        if (typeof rule === 'function') return PROJECTS.filter(rule);
        const wanted = rule.map(norm);
        return PROJECTS.filter(p => p.tags.some(t => wanted.includes(norm(t))));
    }

    let techPill = null;
    function clearTechPill() { if (techPill) { techPill.remove(); techPill = null; } }

    function filterByTech(skill) {
        const ids = projectsUsing(skill).map(p => p.id);
        filtersEl.querySelectorAll('.filter-btn').forEach(b => { b.className = `${BTN} ${OFF}`; });
        clearTechPill();
        techPill = el('button', 'tech-pill px-4 py-2 rounded-lg text-xs font-semibold tracking-wider uppercase flex items-center gap-2');
        techPill.title = 'Retirer le filtre';
        techPill.append(el('span', '', `${skill} · ${ids.length} projet${ids.length > 1 ? 's' : ''}`), icon('x', 'w-3.5 h-3.5'));
        techPill.addEventListener('click', () => applyFilter('all'));
        filtersEl.appendChild(techPill);
        if (window.lucide) lucide.createIcons();
        showCards(card => ids.includes(card.dataset.id));
    }

    // Les compétences utilisées dans au moins un projet deviennent cliquables
    document.querySelectorAll('#skills .tag').forEach(chip => {
        const skill = chip.textContent.trim();
        const count = projectsUsing(skill).length;
        if (!count) return;
        const b = el('button', chip.className + ' skill-link');
        b.type = 'button';
        b.title = `Voir ${count > 1 ? 'les ' + count + ' projets' : 'le projet'} en ${skill}`;
        b.append(document.createTextNode(skill), el('span', 'skill-count', String(count)));
        b.addEventListener('click', () => {
            if (typeof ProjectsView !== 'undefined') ProjectsView.show('grid');
            filterByTech(skill);
            document.getElementById('projects').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        chip.replaceWith(b);
    });
})();
