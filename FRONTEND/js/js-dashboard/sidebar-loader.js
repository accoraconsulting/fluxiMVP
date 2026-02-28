// ===============================
// SESIÓN
// ===============================
function getSession() {
  try {
    const token = localStorage.getItem("auth_token");
    const user = localStorage.getItem("auth_user");
    if (!token || !user) return null;
    return {
      token,
      user: JSON.parse(user)
    };
  } catch (err) {
    console.error("[SidebarLoader] Error obteniendo sesión:", err);
    return null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("sidebar-container");
  if (!container) return;

  try {
    // 1️⃣ Cargar HTML del sidebar
    const res = await fetch("/partials/sidebar.html");
    const html = await res.text();
    container.innerHTML = html;

    // 2️⃣ Obtener sesión
    const session = getSession();
    const userRole = session?.user?.role ?? null;
    
    console.log("[SidebarLoader] Usuario detectado:", {
      session,
      role: userRole
    });

    // 3️⃣ Inicializar sidebar base
    const sidebarModule = await import("./sidebar.js");
    sidebarModule.initSidebar();

    // 4️⃣ 🔥 NUEVO: Panel de Admin SOLO para fluxiAdmin
    const adminPanel = document.querySelector("[data-admin-panel]");

    if (userRole === "fluxiAdmin" && adminPanel) {
      adminPanel.style.display = "flex";
      console.log("[SidebarLoader] ✓ Mostrando Panel Admin para fluxiAdmin");

      // 💳 Mostrar Payins (Crear y Pendientes)
      const payinsSeparator = document.getElementById("sidebar-payins-separator");
      const payinsAdmin = document.getElementById("sidebar-payins-admin");
      const payinsPending = document.getElementById("sidebar-payins-pending");

      if (payinsSeparator) payinsSeparator.style.display = "";
      if (payinsAdmin) payinsAdmin.style.display = "";
      if (payinsPending) payinsPending.style.display = "";

      console.log("[SidebarLoader] ✓ Mostrando Sistema de Payins para fluxiAdmin");
    } else if (adminPanel) {
      adminPanel.style.display = "none";
      console.log("[SidebarLoader] ✗ Ocultando Panel Admin");

      // 💳 Ocultar Payins si no es admin
      const payinsSeparator = document.getElementById("sidebar-payins-separator");
      const payinsAdmin = document.getElementById("sidebar-payins-admin");
      const payinsPending = document.getElementById("sidebar-payins-pending");

      if (payinsSeparator) payinsSeparator.style.display = "none";
      if (payinsAdmin) payinsAdmin.style.display = "none";
      if (payinsPending) payinsPending.style.display = "none";
    }

    // 5️⃣ Gestión KYC SOLO fluxiDocs
    const kycManagement = document.querySelector("[data-kyc-management]");
    
    if (userRole === "fluxiDocs" && kycManagement) {
      kycManagement.style.display = "flex";
      console.log("[SidebarLoader] ✓ Mostrando Gestión KYC para fluxiDocs");
    } else if (kycManagement) {
      kycManagement.style.display = "none";
      console.log("[SidebarLoader] ✗ Ocultando Gestión KYC");
    }

    // 6️⃣ Reglas KYC (si existen)
    try {
      const kycModule = await import("./sidebar-kyc.js");
      kycModule.applyKycRules();
    } catch (err) {
      console.log("[SidebarLoader] sidebar-kyc.js no encontrado");
    }

    // 7️⃣ 🔐 APLICAR PERMISOS DE SIDEBAR según rol y KYC
    try {
      const permModule = await import("../permissions/sidebar-permissions.js");
      permModule.updateSidebarWithPermissions();
      console.log("[SidebarLoader] ✅ Permisos de sidebar aplicados");
    } catch (err) {
      console.warn("[SidebarLoader] ⚠️ No se pudieron aplicar permisos:", err.message);
    }

    // 8️⃣ HAMBURGER BUTTON para móvil - inyectar en el navbar
    injectMobileHamburger();

    document.dispatchEvent(new Event("sidebar:loaded"));

  } catch (err) {
    console.error("[SidebarLoader] Error cargando sidebar:", err);
  }
});

/**
 * Inyecta un botón hamburguesa en el navbar para abrir/cerrar el sidebar en móvil
 */
function injectMobileHamburger() {
  // Buscar navbar en vistas dashboard o navbar en admin panel
  const navbarLeft = document.querySelector('.fluxi-navbar-left') || document.querySelector('.admin-topbar-left');
  if (!navbarLeft) return;

  // Crear botón hamburguesa
  const btn = document.createElement('button');
  btn.className = 'sidebar-hamburger-btn';
  btn.id = 'sidebarHamburgerBtn';
  btn.setAttribute('aria-label', 'Menú');
  btn.innerHTML = '<i class="bx bx-menu"></i>';

  // Insertar al inicio del navbar-left
  navbarLeft.insertBefore(btn, navbarLeft.firstChild);

  // Lógica de toggle
  btn.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar) return;

    const isOpen = sidebar.classList.contains('mobile-open');
    sidebar.classList.toggle('mobile-open', !isOpen);
    if (overlay) overlay.classList.toggle('mobile-open', !isOpen);
    btn.classList.toggle('active', !isOpen);
  });

  // Función para cerrar sidebar
  function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('mobile-open');
    btn.classList.remove('active');
  }

  // Cerrar cuando se clickea el overlay
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) {
    overlay.addEventListener('click', closeMobileSidebar);
  }

  // Cerrar cuando se clickea un link del sidebar
  document.querySelectorAll('.menu-item').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768 && link.id !== 'sidebarLogout') {
        closeMobileSidebar();
      }
    });
  });

  // Cerrar al hacer resize a desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMobileSidebar();
    }
  });

  console.log('[SidebarLoader] ✅ Hamburger button inyectado');
}