# RECORDATORIO — APK Hydra Móvil · Sesión 15/10/2026

> Memoria de la sesión del 15/10/2026. Repo: `apk/hydra-movil` (remote `jofrestroms/hydra_arm_apk_v2`).
> Trabajo realizado: geolocalización en segundo plano real, auto-login y BPM por SSE en el APK del paciente.

## 1. Objetivo de la sesión

1. Que el APK siga enviando ubicación aunque la pantalla esté apagada o la app se cierre desde "recientes".
2. Auto-login: entrar directo según `hydra_sesion` (paciente y familiar).
3. Recibir BPM por SSE (igual que el escritorio), sin polling.
4. Plugin gratuito para debug: transistorsoft (release requiere licencia).

## 2. Implementación (compilada y verificada ✅)

### Plugin nuevo
- `@transistorsoft/capacitor-background-geolocation@9.7.0` (v9, peer `@capacitor/core ^8.0.0` — OK).
- **OJO v9**: config **anidada** (`geolocation`, `http`, `app`, `persistence`, `logger`), distinta a v8. Claves de licencia v8 ≠ v9. Debug funciona sin licencia; release necesitará licencia v9.

### Archivos nuevos
- **`src/app/Services/ubicacion.ts`** — `UbicacionService`:
  - `iniciar(runPaciente)` / `detener()`.
  - URL: `https://geolocalizaci-n-1.onrender.com/api/geolocalizacion/actualizar` (POST).
  - `geolocation`: `desiredAccuracy: High`, `distanceFilter: 0`, `locationUpdateInterval: 30000` (muestreo ~30 s), `locationAuthorizationRequest: 'Always'`.
  - `http`: `autoSync: true`, `method: 'POST'`, `rootProperty: '.'` → body plano en la raíz.
  - `app`: `stopOnTerminate: false`, `startOnBoot: true`, `enableHeadless: true`, `heartbeatInterval: 60` (mín. Android), `backgroundPermissionRationale` en español, notificación sticky "Hydra monitoreando".
  - `persistence`: template ERB `{"latitud":<%= latitude %>,"longitud":<%= longitude %>}`, `extras: { rutPaciente: <RUN cifrado> }` (los extras se fusionan en el JSON final), `maxDaysToPersist: 3`.
  - `requestPermission()` retorna `AuthorizationStatus` (Always = 3); luego `getState()`/`start()`.
  - El envío lo hace el SDK **nativo**, sin pasar por el WebView.
- **`src/app/auth.guard.ts`** — `leerSesion()`, `rutaInicial()` (paciente→`/corazon`; familiar con `runPaciente`→`/dashboard-familiar`; sin selección→`/seleccionar-paciente`), `authGuard` (`CanActivateFn`).

### Archivos modificados
- **`app.component.ts`** — auto-login: `setTimeout(0)` + `router.navigateByUrl(rutaInicial(sesion))`.
- **`app-routing.module.ts`** — `canActivate: [authGuard]` en `/corazon` y `/dashboard-familiar`.
- **`login.page.ts`** — fallback en `ngOnInit` (si hay sesión, redirige; anti-carrera del auto-login).
- **`seleccionar-paciente.page.ts`** — fallback `cargarDesdeSesion()` con `getPacientesDeFamiliar(runFamiliar)` + descifrado, cuando se llega sin navigation state.
- **`corazon.page.ts`**:
  - BPM por SSE: `iniciarRealtimeBpm()` y `procesarDatosRealtime(fila)` (filtra `fila.paciente_run_p === dbId`; suscripción guardada para desuscribir).
  - Eliminado el envío JS de geolocalización (`enviarGeolocalizacion`) y la inyección de `ApiService`.
  - Eliminado el auto-connect BLE/WiFi (métodos y simulación se mantienen manuales).
  - `ubicacion.iniciar(this.runP)` en `ngOnInit`; `ngOnDestroy` desuscribe + `realtime.desconectar()`.
  - `modoConexion` acepta `'realtime'`; guard `if (!this.heartChart) return` en `actualizarGrafico`.
- **`chat-paciente.page.ts`** — `cerrarSesion()` llama `ubicacion.detener()` antes de borrar `hydra_sesion`.
- **`android/app/src/main/AndroidManifest.xml`** — permisos agregados: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `RECEIVE_BOOT_COMPLETED`.
- **`package.json`** — plugin transistorsoft; Capacitor alineado a **8.5.3** (`core`/`cli`); agregados `@capacitor/app`, `haptics`, `keyboard`, `status-bar`.

## 3. Verificación (todo ✅)

- `npm run build` sin errores.
- `npx cap sync android` OK — 8 plugins detectados (incluido transistorsoft 9.7.0).
- `gradlew assembleDebug` OK — manifest fusionado incluye los permisos + servicios FGS del SDK (`TrackingService`, `BootReceiver`, etc.).
- APK instalado por adb en el teléfono conectado (device `RFCY30MPBDL`); la app abre sin crash.

## 4. Pendientes al cierre de la sesión

1. **Render (bloqueante para login y POST de ubicación)**: setear `APP_CRYPTO_PASSWORD` y `APP_CRYPTO_SALT` en **hydra-arm-security** y en **geolocalizaci-n**. Son las claves originales (están en el historial git de `hydra_arm_security`, commit `917d1bf^`, `application.properties`; no van al repo). Deben quedar **idénticas** en ambos servicios. Verificar: `GET https://hydra-arm-security.onrender.com/api/user/cripto/encrypt?texto=hola` → 200.
2. **Prueba en dispositivo**: login paciente → aceptar "Permitir todo el tiempo" + quitar restricción de batería → ver notificación sticky y BPM/gráfico en Corazón (SSE) → minimizar/apagar pantalla/deslizar fuera de recientes → confirmar filas nuevas en `historial_geolocalizacion` (~30 s en movimiento, heartbeat ~60 s detenido) → reabrir (auto-login directo a Corazón).
3. **Git**: todos los demás repos ya están al día con GitHub. El APK tiene los cambios de esta sesión **sin commitear** (el push se canceló en esta sesión). `android/` sigue sin trackear; `formula.txt` es ajeno al proyecto (no commitear).

## 5. Limitaciones conocidas

- Al deslizar la app fuera de recientes muere el WebView → el SSE/BPM se detiene; **solo sigue la geolocalización nativa**. BPM con app 100 % cerrada = fase futura.
- JWT sigue fuera de alcance ("Sin JWT por ahora", fase 2). Referencia: `app-escritorio-hydra/preload.js`.
- El POST geo depende del backend: sin las claves crypto en geolocalizaci-n no puede descifrar el RUN y responde 400.

## 6. Aprendizajes técnicos de la sesión (v9 transistorsoft)

- `rootProperty` por defecto es `"location"`; con `"."` el JSON queda plano en la raíz.
- `extras` se fusionan directamente en el JSON renderizado (sirven para mandar `rutPaciente`).
- `autoSync` es `true` por defecto; `method` por defecto POST con `Content-Type: application/json`.
- `heartbeatInterval` está en segundos y en Android el mínimo real es 60.
- `requestPermission()` con `locationAuthorizationRequest: 'Always'` muestra `backgroundPermissionRationale` y luego abre los ajustes para elegir "Permitir todo el tiempo".
- `startOnBoot` + `enableHeadless` permiten que el tracking siga tras reiniciar el teléfono.
