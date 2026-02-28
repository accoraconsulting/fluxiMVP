/* ===== FLUXI LANDING PAGE SCRIPTS ===== */

document.addEventListener('DOMContentLoaded', function() {
    initSmoothScroll();
});

/**
 * Initialize smooth scroll for anchor links
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                // Cerrar menú si está abierto
                closeNavMenu();
            }
        });
    });
}

/**
 * Initialize hamburger menu toggle
 */
function initHamburgerMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navMenu = document.querySelector('.nav-menu');
    const navButtons = document.querySelector('.nav-buttons');
    const navOverlay = document.getElementById('navOverlay');

    if (!hamburgerBtn || !navMenu || !navButtons) return;

    // Toggle menú al clickear hamburguesa
    hamburgerBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleNavMenu();
    });

    // Cerrar menú al clickear overlay
    if (navOverlay) {
        navOverlay.addEventListener('click', closeNavMenu);
    }

    // Cerrar menú al clickear en un link del menú o botón
    const allMenuItems = document.querySelectorAll('.nav-menu a, .nav-buttons a, .nav-buttons button');
    allMenuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // No cerrar si es un botón que abre un menú desplegable
            if (this.classList.contains('btn-primary') || this.classList.contains('btn-secondary')) {
                closeNavMenu();
            } else if (this.tagName === 'A') {
                closeNavMenu();
            }
        });
    });

    // Cerrar menú si el viewport cambia a desktop
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeNavMenu();
        }
    });
}

/**
 * Toggle del estado del menú
 */
function toggleNavMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navMenu = document.querySelector('.nav-menu');
    const navButtons = document.querySelector('.nav-buttons');
    const navOverlay = document.getElementById('navOverlay');

    const isOpen = navMenu.classList.contains('open');

    if (isOpen) {
        closeNavMenu();
    } else {
        openNavMenu();
    }
}

/**
 * Abrir menú
 */
function openNavMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navMenu = document.querySelector('.nav-menu');
    const navButtons = document.querySelector('.nav-buttons');
    const navOverlay = document.getElementById('navOverlay');

    hamburgerBtn?.classList.add('active');
    navMenu?.classList.add('open');
    navButtons?.classList.add('open');
    navOverlay?.classList.add('open');
}

/**
 * Cerrar menú
 */
function closeNavMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navMenu = document.querySelector('.nav-menu');
    const navButtons = document.querySelector('.nav-buttons');
    const navOverlay = document.getElementById('navOverlay');

    hamburgerBtn?.classList.remove('active');
    navMenu?.classList.remove('open');
    navButtons?.classList.remove('open');
    navOverlay?.classList.remove('open');
}

// Inicializar cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    initSmoothScroll();
    initHamburgerMenu();
});
