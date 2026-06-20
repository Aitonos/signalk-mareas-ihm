# ARCHITECTURE — signalk-mareas-ihm

## 1. Principio rector: BACKEND ES LA FUENTE DE LA VERDAD

Cita literal del usuario:
> *"que el backened es TODA la fuente de la verdad"*
> *"siempre hemos de trabajar sobre backend que es el que difunde los datos a los diovwersos usuarios de frontend asi siempre estan coordinados"*

### Implicaciones concretas

- **Todo state crítico vive en el backend** (`anchorWatch`, `aisAckedMMSIs`, `alarmSnoozeUntil`, `lang` global, `audioEnabled` global, `_currentAlarmaEnabled`, `_currentGroundingRisk`, `_garreoSilencedUntil`, `_aisSilencedUntil`).
- **El frontend es una vista**: lee state via state poll (`/state`) + SSE deltas (`broadcastSSE`), nunca tiene su propia verdad divergente.
- **Cualquier acción del frontend va a backend INMEDIATAMENTE** (POST endpoint) y el backend hace el broadcast a TODOS los visores.
- **Estado por device permitido**: solo `_lang` per-device (cada user su idioma — Q-K respuesta). El idioma se pone en el backend via `/api/settings` para que las voces del Pi se sincronicen, pero la UI del visor responde al `_lang` local hasta el siguiente poll.

### Audit checklist antes de modificar state cualquier feature

- [ ] ¿Hay un endpoint backend POST que persista el cambio?
- [ ] ¿El cambio dispara `broadcastSSE(...)` para notificar a otros visores?
- [ ] ¿El visor remoto recoge el SSE y actualiza su UI?
- [ ] Si el usuario cierra el visor y vuelve a abrirlo en otro device, ¿ve el state correcto?

Si alguna respuesta es NO → el feature está mal arquitecturado.

## 2. UI unificada: mobile.html como default

Desde **Rev184** el visor de fondeo usa **SOLO** `public/mobile.html`. No hay UA dispatch.

Rutas Express en `src/index.ts`:
- `/signalk-mareas-ihm/visorfondeo` → `mobile.html` (cualquier dispositivo)
- `/signalk-mareas-ihm/visorfondeo?desktop=1` → `mapafondeo.html` legacy (inspección/debug)
- `/signalk-mareas-ihm/mobile` → `mobile.html`
- `/signalk-mareas-ihm/mapafondeo` → `mapafondeo.html` (legacy)
- `/signalk-mareas-ihm/mareas` → React TidesView standalone
- `/signalk-mareas-ihm/` → redirect a `/visorfondeo` (landing eliminado Rev182)

**Reglas**:
- Todos los fixes UX/UI van en `public/mobile.html` (4000+ líneas, copia grande de `mapafondeo.html` con overrides via `body.mobile-ui` + JS hooks).
- NO editar `mapafondeo.html` salvo bugs críticos del backend.
- En desktop, mobile.html se ve bien y de momento es la única vista oficial (Q-O respuesta).

## 3. Distinción mobile / Pi browser / desktop

Body classes aplicadas en JS (UA detection en `mobile.html`):
- `body.mobile-ui` → SIEMPRE en mobile.html
- `body.m-pi-browser` → navegador en la Pi (`Linux + armv/aarch64/raspberry` o `X11; Linux` sin Mobile/Tablet)
- `body.m-desktop-landscape` → reservado para desktop (clase añadida pero **sin reglas CSS** actualmente — usuario dijo "no escala texto desktop, ya bien")

**Pi browser ajustes**:
- Fuentes globalmente más grandes
- Animaciones SVG y `backdrop-filter` desactivados (peces/cangrejos congelaban CPU)
- Polls más lentos para reducir lag

## 4. State stores backend

```ts
// src/index.ts — type AnchorWatchState
{
  anchored: boolean,
  anchorPosition: { lat, lng } | null,
  alarmRadiusExtra: number,           // metros sobre swing
  enabled: boolean,
  chainDeployed: number | null,
  swingRadiusOverride: number | null, // override manual del usuario (PRIORIDAD)
  anchorHistory: [{ lat, lng, ts }],
  aisAlarmEnabled: boolean,
  garreoAlarmEnabled: boolean,
  aisAckedMMSIs: string[],            // ACKs persistidos
  predictiveRingEnabled: true,        // SIEMPRE on (Q-AF respuesta)
  lookaheadHours: number,
  shelterMask: ShelterMask,
}
```

Persistencia: `ihmCache` (sqlite via better-sqlite3) en `~/.signalk/plugin-config-data/signalk-mareas-ihm/`.

Endpoints clave:
- `POST /api/anchor-watch/drop`
- `POST /api/anchor-watch/lift`
- `POST /api/anchor-watch/toggle`
- `POST /api/anchor-watch/swing-radius` { swingRadius }
- `POST /api/anchor-watch/alarm-margin` { extra }
- `POST /api/anchor-watch/chain-deployed` { meters }
- `POST /api/anchor-watch/ais-alarm-status` { enabled }
- `POST /api/anchor-watch/garreo-alarm-status` { enabled }
- `POST /api/anchor-watch/ais-ack` { mmsi }
- `POST /api/anchor-watch/ais-unack` { mmsi }
- `POST /api/anchor-watch/silence-alarm` { kind: 'garreo'|'ais', minutes } — NO acepta `'all'`
- `POST /api/anchor-watch/cancel-silence` { kind: 'garreo'|'ais'|'all' }
- `POST /api/snooze` { minutes } — global, dispara `emitNotificationClear()`
- `POST /api/alarma/off`
- `POST /api/settings` { lang } — persiste lang global del Pi
- `POST /anchor/calc` — cálculo cadena/swing
- `GET /state` — snapshot completo
- `GET /events` — SSE stream

## 5. Audio architecture (3 capas)

1. **Pi audio (USB DAC Jieli)** — `paplay` + `ffmpeg` para amplificación. **Hardware ceiling alcanzado** (memoria) — no iterar más en gain. Voces OGG en `~/Audio_OGGs/`. Espeak fallback.
2. **Browser audio del visor** — WebAudio (`_audioCtx`) + `AudioBufferSourceNode`. Fallback a `new Audio()` y a `speechSynthesis` TTS.
3. **TTS Sintetizado fallback** — last resort, voz Windows/Mac.

Ciclo de alarma (30s por kind):
- Fase 1: siren (~3.6s)
- Fase 2: voice (~3-4s)
- Fase 3: silence (~22s)

## 6. SSE broadcast (clave para multi-device sync)

```ts
broadcastSSE(eventKind: string)
```

Eventos: `drop`, `lift`, `chain`, `swing`, `ais-alarm`, `garreo-alarm`, `calc`, `ais-ack`, etc.

Cada visor:
- Mantiene EventSource a `/events`
- En cada SSE event re-pide `/state` y rerenderiza
- Mantiene `_prevAnch` para detectar transiciones (drop/lift)

**Bug recurrente**: cancelar fondeo en device A no propaga a device B. Causa probable: el `notifications.signalk-mareas-ihm.*` delta sí se emite pero los visores no normalizan correctamente. Fix en Sprint 1.

## 7. Lang per-device + voces Pi sincronizadas (Q-K respuesta)

- Cada device tiene `_lang` local en `localStorage('ihm-visor-lang')`
- Al hacer `setLang(l)`:
  - Update local UI con `applyLang()`
  - POST a `/api/settings` con `{lang: l}` que persiste el `_currentLang` del backend
  - El backend usa `_currentLang` para las voces del Pi (`PI_DROP_CONFIRM`, `PI_ALARM_PHRASES`)
- **Problema actual**: la Pi voice puede tardar en cambiar si una alarma ya está sonando con el lang anterior. Sprint 3 lo arregla.

## 8. Persistencia en el cliente (justificada)

- `localStorage('ihm-visor-lang')` — idioma per-device (intencional)
- `localStorage('ihm-ais-acked')` — espejo del backend con grace period 5s para ops pendientes
- `localStorage('ihm-favorites')` — favoritos locales (UI)
- `localStorage('ihm-trk-dismissed')` — flag de dismiss
- `localStorage('ihm-ais-alarm')`, `'ihm-garreo-alarm'` — flags de alarmas, **deberían venir del backend** (refactor candidato)

## 9. Memorias proyecto que constriñen decisiones

- `feedback_minimal_deps`: minimal external deps. Solo `espeak` es mandatorio. No proponer `sudo apt install X` sin alternativa.
- `feedback_no_commercial_refs`: nunca referencias a apps comerciales en código, identificadores, UI o commits. **Acción concreta pendiente: quitar "Sonarchart" y dejar "Batimetría"** (respuesta Q-AN).
- `feedback_use_localhost`: ejemplos URL siempre con `localhost`, no `<pi-ip>`.
- `feedback_stay_focused`: calcular geometría antes de tocar. "Como en RevN" = exacto, no aproximado.
- `project_audio_hardware_ceiling`: USB DAC peak-limited. No iterar más en software gain.
- `project_pi_connectivity`: 4G + EMI fragil. Deploy debe ser robusto.
- `project_adblocker_leak`: out of scope.
- `feedback_nordvpn_breaks_tailscale`: NordVPN rompe Tailscale en el portátil.

## 10. Lo que NO se toca

- Servidor SignalK core
- `mapafondeo.html` salvo bugs backend
- IMU + pypilot integration (memoria `project_imu_setup`) — phase 2 fuera de esta release
- Software audio gain Pi — hardware ceiling
- Service worker en mobile no existe aún — Sprint 5 lo añade
