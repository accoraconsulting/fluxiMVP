/**
 * Sidebar Module - SIMPLE & STABLE
 * Compatible con sidebar-loader por innerHTML
 */
import '../sidebar-badge.js'

export function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("toggleSidebar");

  if (!sidebar || !toggleBtn) {
    console.warn("[Sidebar] Sidebar o botón no encontrado");
    return;
  }

  // 🚪 LOGOUT BUTTON - Simple y funcional
  const sidebarLogoutBtn = document.getElementById("sidebarLogout");
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.log('[Sidebar] 🚪 Logout iniciado');

      if (confirm('¿Cerrar sesión? Tendrás que iniciar sesión de nuevo.')) {
        try {
          console.log('[Sidebar] ✅ Usuario confirmó logout');
          const { clearSession } = await import('../../auth/session.js');
          clearSession();
        } catch (err) {
          console.error('[Sidebar] ❌ Error en logout:', err);
          localStorage.clear();
          sessionStorage.clear();
          window.location.replace('./login.html');
        }
      }
    });
    console.log('[Sidebar] ✅ Logout button configurado');
  } else {
    console.warn('[Sidebar] ⚠️ #sidebarLogout no encontrado');
  }

  // 🧼 eliminar listeners previos (CLAVE)
  toggleBtn.replaceWith(toggleBtn.cloneNode(true));
  const freshToggleBtn = document.getElementById("toggleSidebar");

  // 📱 Detectar si es móvil
  const isMobile = () => window.innerWidth <= 768;

  // 🎯 listener limpio
  freshToggleBtn.addEventListener("click", () => {
    if (isMobile()) {
      // En móvil: toggle mobile-open
      sidebar.classList.toggle("mobile-open");
      const sidebarOverlay = document.getElementById("sidebarOverlay");
      if (sidebarOverlay) {
        sidebarOverlay.classList.toggle("mobile-open");
      }
      console.log("[Sidebar] Mobile toggle OK");
    } else {
      // En desktop: toggle collapsed
      sidebar.classList.toggle("collapsed");
      const isCollapsed = sidebar.classList.contains("collapsed");
      localStorage.setItem("sidebar-collapsed", isCollapsed);
      updateMainContentMargin(isCollapsed);
      console.log("[Sidebar] Toggle OK:", isCollapsed ? "collapsed" : "expanded");
    }
  });

  // 🔁 restaurar estado (solo en desktop)
  const saved = localStorage.getItem("sidebar-collapsed");
  const isCollapsedAtStart = saved === "true";
  if (!isMobile() && isCollapsedAtStart) {
    sidebar.classList.add("collapsed");
    updateMainContentMargin(true);
  } else if (!isMobile()) {
    sidebar.classList.remove("collapsed");
    updateMainContentMargin(false);
  }

  // 📐 Aplicar margin inicial (desktop only)
  if (!isMobile()) {
    updateMainContentMargin(isCollapsedAtStart);
  }

  // 📱 Cerrar sidebar en móvil cuando se clickea un link
  document.querySelectorAll(".menu-item").forEach(link => {
    link.addEventListener("click", (e) => {
      // No cerrar si es el botón logout (que abre un confirm)
      if (link.id !== "sidebarLogout") {
        if (isMobile()) {
          sidebar.classList.remove("mobile-open");
          const sidebarOverlay = document.getElementById("sidebarOverlay");
          if (sidebarOverlay) {
            sidebarOverlay.classList.remove("mobile-open");
          }
        }
      }
    });
  });

  // Cerrar al clickear overlay en móvil
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
      if (isMobile()) {
        sidebar.classList.remove("mobile-open");
        sidebarOverlay.classList.remove("mobile-open");
      }
    });
  }

  // Cerrar sidebar cuando se redimensiona a desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove("mobile-open");
      const sidebarOverlay = document.getElementById("sidebarOverlay");
      if (sidebarOverlay) {
        sidebarOverlay.classList.remove("mobile-open");
      }
    }
  });

  // 📍 item activo
  const currentPath = window.location.pathname;
  document.querySelectorAll(".menu-item").forEach(link => {
    try {
      const linkPath = new URL(link.href, location.origin).pathname;
      link.classList.toggle("active", linkPath === currentPath);
    } catch {}
  });

  console.log("[Sidebar] Inicializado correctamente (FIXED)");
}

/**
 * Actualizar margin del main-content según estado del sidebar
 */
function updateMainContentMargin(isCollapsed) {
  const mainContent = document.querySelector(".main-content");
  if (!mainContent) return;

  if (isCollapsed) {
    mainContent.style.marginLeft = "80px";
  } else {
    mainContent.style.marginLeft = "260px";
  }
}
