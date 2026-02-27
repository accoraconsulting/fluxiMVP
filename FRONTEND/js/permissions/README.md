# 🔐 SISTEMA DE PERMISOS POR ROL - FLUXI

## 📋 Archivos del Sistema

### 1. `role-permissions.js`
**Define qué puede hacer cada rol**

```javascript
import { canAccessView, getAllowedViews } from './permissions/role-permissions.js';

// Verificar si puede acceder a una vista
canAccessView('fluxiUser', 'wallet', 'unapproved'); // false
canAccessView('fluxiUser', 'wallet', 'approved');   // true

// Obtener todas las vistas permitidas
getAllowedViews('fluxiUser', 'unapproved');
// ['dashboard', 'myAccount', 'support', 'kyc']

getAllowedViews('fluxiUser', 'approved');
// ['dashboard', 'wallet', 'send', 'withdraw', 'deposit', 'movements', 'myAccount', 'support', 'kyc', 'enrolled']
```

### 2. `route-guard.js`
**Protege las rutas/vistas de acceso no autorizado**

#### Opción A: Redirigir si no tiene acceso (RECOMENDADO)
```javascript
import { guardRoute } from './permissions/route-guard.js';

// Al inicio de wallet.html:
guardRoute('wallet');
// Si no tiene acceso: alerta + redirige a index.html
```

#### Opción B: Mostrar overlay de bloqueo
```javascript
import { showBlockOverlay } from './permissions/route-guard.js';

// Al inicio de send.html:
showBlockOverlay('send');
// Si no tiene acceso: muestra overlay bonito + redirige
```

#### Opción C: Solo verificar (sin redirigir)
```javascript
import { checkRouteAccess } from './permissions/route-guard.js';

const result = checkRouteAccess('wallet');
if (!result.allowed) {
  console.log(result.message);
  // Hacer algo custom
}
```

### 3. `navbar-updater.js`
**Actualiza el navbar mostrando solo opciones permitidas**

```javascript
import { updateNavbarByPermissions, initializePermissions } from './permissions/navbar-updater.js';

// Al cargar cada página:
initializePermissions();

// O manualmente:
updateNavbarByPermissions();
```

**ID de elementos esperados:**
- `nav-dashboard`
- `nav-wallet`
- `nav-send`
- `nav-withdraw`
- `nav-deposit`
- `nav-movements`
- `nav-account`
- `nav-support`
- `nav-kyc`
- `nav-kyc-management`
- `nav-admin`
- `nav-enrolled`

### 4. `kyc-status-monitor.js`
**Monitorea cambios de KYC en tiempo real**

```javascript
import {
  startKYCMonitoring,
  stopKYCMonitoring,
  syncKYCStatus
} from './permissions/kyc-status-monitor.js';

// Iniciar monitoreo (cada 30 segundos):
const intervalId = startKYCMonitoring(30);

// Sincronizar ahora:
await syncKYCStatus();

// Detener monitoreo:
stopKYCMonitoring(intervalId);
```

---

## 🎯 FLUJO COMPLETO DE IMPLEMENTACIÓN

### Paso 1: Agregar a cada página HTML

```html
<script type="module">
  import { guardRoute } from './js/permissions/route-guard.js';
  import { initializePermissions } from './js/permissions/navbar-updater.js';

  // Proteger esta vista
  guardRoute('wallet'); // 'wallet', 'send', 'dashboard', etc.

  // Actualizar navbar
  initializePermissions();

  // El resto de tu código...
</script>
```

### Paso 2: Actualizar navbar HTML

Asegúrate que cada opción tenga su ID:

```html
<nav class="navbar">
  <a id="nav-dashboard" href="dashboard.html">Dashboard</a>
  <a id="nav-wallet" href="wallet.html">Wallet</a>
  <a id="nav-send" href="send.html">Enviar</a>
  <a id="nav-withdraw" href="withdraw.html">Retirar</a>
  <a id="nav-deposit" href="deposit.html">Depositar</a>
  <a id="nav-movements" href="moviments.html">Movimientos</a>
  <a id="nav-account" href="myaccount.html">Mi Cuenta</a>
  <a id="nav-support" href="support.html">Soporte</a>
  <a id="nav-kyc" href="index.html">Verificación</a>
  <a id="nav-kyc-management" href="kyc-management.html">Revisar KYC</a>
  <a id="nav-admin" href="admin.html">Admin</a>
  <a id="nav-enrolled" href="enrolled.html">Afiliados</a>
</nav>
```

### Paso 3: Iniciar monitoreo KYC (OPCIONAL)

```html
<script type="module">
  import { startKYCMonitoring } from './js/permissions/kyc-status-monitor.js';

  // Habilitar en navbar.js o main.js:
  // Cada 30 segundos verifica si el KYC fue aprobado
  if (localStorage.getItem('auth_token')) {
    startKYCMonitoring(30); // 30 segundos
  }
</script>
```

---

## 📊 TABLA DE ACCESOS

### fluxiUser (Cliente)

#### SIN KYC APROBADO ❌
```
✅ Dashboard (básico)
✅ Mi Cuenta
✅ Soporte
✅ Verificación
❌ Wallet
❌ Enviar
❌ Retirar
❌ Depositar
❌ Movimientos
❌ Afiliados
```

#### CON KYC APROBADO ✅
```
✅ Dashboard (completo)
✅ Wallet
✅ Enviar
✅ Retirar
✅ Depositar
✅ Movimientos
✅ Mi Cuenta
✅ Soporte
✅ Verificación
✅ Afiliados
```

### fluxiDocs (Inspector)
```
✅ Dashboard
✅ Revisar KYC (SOLO ESTA)
```

### fluxiDev (Developer)
```
✅ Acceso a TODO excepto Admin
```

### fluxiAdmin (Admin)
```
✅ Acceso a TODO
```

---

## 🔄 FLUJO DE LOGIN

1. Usuario hace LOGIN
2. Backend responde con:
   ```json
   {
     "username": "juan",
     "email": "juan@example.com",
     "role": "fluxiUser",
     "kycStatus": "unapproved",
     "avatar": "..."
   }
   ```

3. Frontend guarda en localStorage:
   ```javascript
   localStorage.setItem('auth_user', JSON.stringify(user));
   ```

4. En cada página:
   ```javascript
   guardRoute('wallet'); // Verifica role + kycStatus
   initializePermissions(); // Actualiza navbar
   ```

5. Si `kycStatus` cambia a `approved`:
   - KYC Monitor lo detecta
   - Actualiza localStorage
   - Dispara evento `kycStatusChanged`
   - Navbar se actualiza automáticamente
   - Usuario ve nuevas opciones

---

## 🎨 EJEMPLOS DE USO

### Bloquear acceso a wallet.html
```html
<!DOCTYPE html>
<html>
<head>
  <title>Wallet</title>
</head>
<body>
  <script type="module">
    import { guardRoute } from './js/permissions/route-guard.js';
    import { initializePermissions } from './js/permissions/navbar-updater.js';

    // Verificar acceso - Si no, redirige y muestra alerta
    guardRoute('wallet');

    // Actualizar navbar según permisos
    initializePermissions();

    // El resto de tu código de wallet...
    console.log('✅ Acceso permitido a wallet');
  </script>
</body>
</html>
```

### Mostrar solo si tiene acceso
```html
<script type="module">
  import { canAccessView } from './js/permissions/role-permissions.js';

  const user = JSON.parse(localStorage.getItem('auth_user'));

  // Mostrar u ocultar botón dinámicamente
  const sendButton = document.getElementById('send-btn');
  if (canAccessView(user.role, 'send', user.kycStatus)) {
    sendButton.style.display = 'block';
  } else {
    sendButton.style.display = 'none';
  }
</script>
```

### Verificar antes de hacer acción
```javascript
import { checkRouteAccess } from './js/permissions/route-guard.js';

async function handleWithdraw() {
  const result = checkRouteAccess('withdraw');

  if (!result.allowed) {
    alert(result.message);
    return;
  }

  // Proceder con el retiro
  console.log('Retirando dinero...');
}
```

---

## ⚡ TIPS PRO

1. **Sincronizar KYC automáticamente**:
   ```javascript
   import { startKYCMonitoring } from './permissions/kyc-status-monitor.js';
   startKYCMonitoring(30); // Cada 30 segundos
   ```

2. **Mostrar estado en navbar**:
   ```html
   <span id="user-kyc-status"></span>
   ```
   ```javascript
   const user = JSON.parse(localStorage.getItem('auth_user'));
   document.getElementById('user-kyc-status').textContent =
     `KYC: ${user.kycStatus}`;
   ```

3. **Agregar permisos nuevos**: Editar `ROLE_PERMISSIONS` en `role-permissions.js`

4. **Crear nuevas vistas**: Agregar entrada a `ROLE_PERMISSIONS` + `VIEW_TO_NAVBAR_MAP`

---

## 🐛 DEBUGGING

```javascript
// Ver qué puede hacer un usuario
import { getAllowedViews, canAccessView } from './permissions/role-permissions.js';

const user = JSON.parse(localStorage.getItem('auth_user'));
console.log('Vistas permitidas:', getAllowedViews(user.role, user.kycStatus));
console.log('¿Puede wallet?', canAccessView(user.role, 'wallet', user.kycStatus));
```

---

## ✅ CHECKLIST

- [ ] Agregar scripts de permisos a cada página
- [ ] Actualizar navbar con IDs correctos
- [ ] Proteger vistas con `guardRoute()`
- [ ] Inicializar permisos con `initializePermissions()`
- [ ] Activar monitoreo KYC (opcional)
- [ ] Probar con usuario sin KYC
- [ ] Probar con usuario con KYC aprobado
- [ ] Probar con otros roles (Docs, Dev, Admin)

---

**¡Sistema de permisos completamente funcional! 🚀**
