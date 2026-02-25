(function () {
    var path = window.location.pathname.split('/').pop();
    if (!path || path === '') path = 'index.html';

    // Usa el título de la página para el nombre en el topbar móvil
    var pageName = document.title.split(' \u00b7 ')[0].trim();

    var links = [
        { href: 'index.html',            icon: 'bi-house-door',       label: 'Inicio',               section: 'Blog' },
        { href: 'convertUnits.html',     icon: 'bi-arrow-left-right', label: 'Conversor Ci\u2013Bq', section: 'Aplicaciones' },
        { href: 'decayCalculator.html',  icon: 'bi-clock-history',    label: 'Decay Calculator',     section: 'Aplicaciones' },
        { href: 'RestricionesLu177.html',icon: 'bi-activity',         label: 'Lu-177 Restricciones', section: 'Aplicaciones' }
    ];

    function buildNavHTML() {
        var sections = ['Blog', 'Aplicaciones'];
        return sections.map(function (sec) {
            var items = links.filter(function (l) { return l.section === sec; });
            return '<div class="nav-section">' +
                '<span class="nav-section-label">' + sec + '</span>' +
                items.map(function (l) {
                    var active = l.href === path ? ' active' : '';
                    return '<a href="' + l.href + '" class="nav-link-item' + active + '">' +
                        '<i class="bi ' + l.icon + '"></i> ' + l.label + '</a>';
                }).join('') +
                '</div>';
        }).join('');
    }

    var navHTML = buildNavHTML();

    var sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.innerHTML =
        '<a href="index.html" class="sidebar-brand">' +
            '<div class="s-avatar"></div>' +
            '<span class="s-name">Falken\'s Maze<span class="cursor">_</span></span>' +
        '</a>' +
        '<nav class="sidebar-nav">' + navHTML + '</nav>' +
        '<div class="sidebar-footer">F\u00edsica M\u00e9dica &amp; Medicina Nuclear</div>';

    var topbar = document.createElement('header');
    topbar.className = 'topbar';
    topbar.innerHTML =
        '<button class="topbar-toggle" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileNav" aria-label="Abrir men\u00fa">' +
            '<i class="bi bi-list"></i>' +
        '</button>' +
        '<div class="topbar-logo"></div>' +
        '<span class="topbar-name">' + pageName + '</span>';

    var offcanvas = document.createElement('div');
    offcanvas.className = 'offcanvas offcanvas-start';
    offcanvas.id = 'mobileNav';
    offcanvas.setAttribute('tabindex', '-1');
    offcanvas.innerHTML =
        '<div class="offcanvas-header">' +
            '<div style="display:flex;align-items:center;gap:12px;">' +
                '<div class="s-avatar"></div>' +
                '<span class="s-name">Falken\'s Maze</span>' +
            '</div>' +
            '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>' +
        '</div>' +
        '<div class="offcanvas-body p-0">' +
            '<nav class="sidebar-nav">' + navHTML + '</nav>' +
        '</div>';

    document.body.prepend(sidebar, topbar, offcanvas);
})();
