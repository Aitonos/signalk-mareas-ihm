# KNOWN_BUGS — bugs vigentes en Rev866 / v2.11.5

Estado: **2026-08-16** — snapshot tras publicar 2.11.5 con backoff
rate-limit en los 3 clientes AIS online (Rev865, fix #40). Sin bugs
abiertos confirmados hoy.
Los 22 bugs B-01…B-22 del archivo Rev190 están todos resueltos y
viven en `archive/KNOWN_BUGS_Rev190_snapshot.md` para referencia
histórica.

Aquí solo bugs **confirmados por Carlos y aún vigentes** hoy.

---

## Vigentes

_(vacío — sin bugs abiertos confirmados con caso reproducible en Rev860 / v2.11.3)_

---

## Bugs de sistema externos (no arreglables desde aquí)

### S-01 — `@signalk/set-system-time` corrompe IMU cada 60 s
**Origen**: plugin oficial SK ajusta el reloj cada minuto → RTIMULib
integra `dt` corrupto → bandazo attitude ±150° → "oleaje fuerte"
fantasma.

**Confirmado por**: Pablo + ChatGPT (2026-07-05). Afecta a media flota
OpenPlotter con internet.

**Fix**: **desactivar `@signalk/set-system-time` en la UI de SK**
(admin → plugins). No podemos parchar el otro plugin desde aquí; el
wizard J-2 lo advierte al usuario.

---

## Limitaciones conocidas (no son bugs — aceptadas por Carlos)

### L-01 — Shelter en dársena cerrada de puerto → 16/16 abrigado
El algoritmo de auto-detect de la rosa (Overpass API sobre OSM +
raycast desde el barco a los 16 sectores con umbral 0.3 nm ~ 556 m)
detecta muros/breakwaters/coastline en todas las direcciones cuando
el barco está atracado dentro de una dársena.

Matemáticamente el resultado ES correcto (hay estructura sólida en
todos los rayos), pero contra-intuitivo para el usuario que espera
"por lo menos el sector hacia la bocana debería salir abierto".

Validado con GPT + Gemini como una limitación intrínseca al algoritmo
simple. Cambiar el umbral o el algoritmo rompía más casos de los que
arreglaba (Carlos 2026-07-31: "va de culo… todas mal"). Aceptado
como limitación.

---

## Bugs y features resueltos recientemente (para no volver a abrir)

- **AIS online rate-limit self-perpetuating loop** (Rev865 / v2.11.5,
  issue #40) — los 3 clientes AIS online (aisstream WebSocket, aishub
  y aisfriends HTTP polling) usaban interval/retry fijo cada ~60 s.
  Un solo HTTP 429 dejaba al cliente rate-limitado indefinidamente
  porque los reintentos cada 60 s mantenían la ventana rate-limit del
  server siempre activa. @ABS0lute-1 reportó 2.7 días sin mensajes
  aisstream tras un 429. Fix: backoff exponencial 60 s → 30 min con
  jitter ±20 %, reset solo al primer mensaje real end-to-end (no en
  handshake). Refactor de setInterval a setTimeout auto-rearmable en
  aishub/aisfriends. Zero cambio en el happy path.
- **Memory leak AIS republish 'name'** (Rev861 / v2.11.4) — publicábamos
  `{path:"name", value:<string>}` para cada vessel AIS republicado.
  SignalK server-api reventaba con `TypeError: Cannot create property
  'meta' on string 'AURORA'` en strict mode, generando 3914 errores/hora
  con ~80 vessels en la Ría de Vigo. Heap creció de ~450 MB a 2.5 GB
  en 4 días 15h. Fix: quitar el push (name es top-level property, no
  delta). Post-fix RSS = 484 MB estable.
- **IMU watchdog auto-recuperación** (Rev862 / v2.11.4) — `ImuManager.
  _autoDetect()` corría 1 sola vez al arranque. Si peer pypilot estaba
  muerto en ese instante, todas las fuentes quedaban `disabled` para
  siempre — widget IMU congelado hasta reboot SK. Fix: watchdog en
  `_tick()` que re-lanza auto-detect cada 60s si `active===null`.
  Recuperación en <2 min cuando el peer vuelve.
- **K-02 UTF-8 doble-codificación** — verificado no reproducible en
  Rev860 / v2.11.3. El fichero `~/.signalk/plugin-config-data/mareas-ihm/ihm/favorites.json`
  del Pi tiene los strings con acentos ("Moaña") perfectamente
  codificados en UTF-8 (bytes 0xC3 0xB1 correctos). Los favoritos
  corruptos vistos en sesión antigua ("Moañ~a", `Ã³a`) ya
  no existen — o Carlos los borró y re-creó, o algún fix entre
  Rev735 y Rev860 los arregló como side-effect. Si alguna vez
  reaparece con caso concreto, reabrir K-02 con evidencia (path,
  string original y bytes en disco).
- **K-03 Audio Pi intermitente** — resuelto en 3 fases (v2.11.3):
  - Fase 1: 5 bugs deterministas del pipeline (cancelled vs failed,
    timeout tipado, sink resolution con `--device` explícito, safe kill,
    probe con `.catch()` red).
  - Fase 2: observability + `/api/audio-health` + badge en Panel de
    Alarmas + wizard system-check (linger + pipewire user services).
  - Fase 3: sirena pre-renderizada con 250 ms de silencio inicial +
    gain pre-computado en background.
- **K-04 Voz "Ancla fondeada" no sonaba en el cliente que fondeaba** —
  timestamp de dedupe se marcaba ANTES de `_speakAlarm`, bloqueando la
  llamada 300 ms después. Fix: marcar después del retorno + bajar
  dedupe 30→5 s (v2.11.3).
- **K-01 Smoothing sonda** — aprobado en agua real (Carlos 2026-08-02).
- **`_lastAutoDetectMs` no se actualiza en cache hit** — arreglado.
- **Tunatunes en la lista AIS** — filtrado en las 4 rutas de ingesta
  (v2.11.2).
- **README y screenshots ausentes en SK App Store** — deploy.ps1 ahora
  sincroniza también estos assets (v2.11.2).
- **SK admin UI no reflejaba cambios de Vessel Base Data sin restart** —
  ahora usa `baseDeltaEditor + sendBaseDeltas` internos de SK (v2.11.2).

---

## Docs relacionadas

- Bugs 2026-05 → 2026-06 archivados en
  [`archive/KNOWN_BUGS_Rev190_snapshot.md`](archive/KNOWN_BUGS_Rev190_snapshot.md).
- QA runbook por commit en [`QA_PENDIENTE.md`](QA_PENDIENTE.md).
- Decisiones del usuario Q-A a Q-AU en [`Q_AND_A.md`](Q_AND_A.md).
