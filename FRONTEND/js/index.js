/* ===== FLUXI LANDING PAGE SCRIPTS ===== */

document.addEventListener('DOMContentLoaded', function() {
    initSmoothScroll();
    initHamburgerMenu();
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
                closeNavMenu();
            }
        });
    });
}

/**
 * Initialize hamburger menu
 */
function initHamburgerMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navOverlay = document.getElementById('navOverlay');

    if (!hamburgerBtn) return;

    // En móvil: mover los botones dentro del nav-menu para tener UN solo dropdown
    setupMobileMenu();

    // Toggle
    hamburgerBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const navMenu = document.querySelector('.nav-menu');
        const isOpen = navMenu?.classList.contains('open');
        isOpen ? closeNavMenu() : openNavMenu();
    });

    // Cerrar al clickear overlay
    navOverlay?.addEventListener('click', closeNavMenu);

    // Cerrar al resize a desktop
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeNavMenu();
        }
        setupMobileMenu();
    });
}

/**
 * Mover los botones dentro del nav-menu en móvil
 */
function setupMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const navButtons = document.querySelector('.nav-buttons');
    if (!navMenu || !navButtons) return;

    if (window.innerWidth <= 768) {
        // Ocultar nav-buttons completamente (se movieron al menú)
        navButtons.style.display = 'none';

        // Si aún no se han movido los botones al menú
        if (!navMenu.querySelector('.mobile-buttons')) {
            const mobileButtonsDiv = document.createElement('div');
            mobileButtonsDiv.className = 'mobile-buttons';

            // Clonar los links de botones
            navButtons.querySelectorAll('a').forEach(link => {
                const clone = link.cloneNode(true);
                clone.addEventListener('click', closeNavMenu);
                mobileButtonsDiv.appendChild(clone);
            });

            navMenu.appendChild(mobileButtonsDiv);
        }
    } else {
        // En desktop: mostrar nav-buttons y eliminar clones
        navButtons.style.display = '';
        const mobileButtons = navMenu.querySelector('.mobile-buttons');
        if (mobileButtons) {
            mobileButtons.remove();
        }
    }
}

function openNavMenu() {
    document.getElementById('hamburgerBtn')?.classList.add('active');
    document.querySelector('.nav-menu')?.classList.add('open');
    document.getElementById('navOverlay')?.classList.add('open');
}

function closeNavMenu() {
    document.getElementById('hamburgerBtn')?.classList.remove('active');
    document.querySelector('.nav-menu')?.classList.remove('open');
    document.getElementById('navOverlay')?.classList.remove('open');
}
