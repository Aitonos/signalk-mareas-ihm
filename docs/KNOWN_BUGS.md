# KNOWN_BUGS — bugs vigentes en Rev843 / v2.11.2

Estado: **2026-08-02** — snapshot tras el pase de Carlos aprobando el
QA en agua del ciclo 2.7 → 2.11. Los 22 bugs B-01…B-22 del archivo
Rev190 están todos resueltos y viven en
`archive/KNOWN_BUGS_Rev190_snapshot.md` para referencia histórica.

Aquí solo bugs **confirmados por Carlos y aún vigentes** hoy.

---

## Vigentes

### K-02 — UTF-8 doble-codificación en textos con acentos
**Síntoma**: "Moaña" aparece como "MoaÃ±a" en logs / activity log /
algún endpoint que reserializa strings. La causa es un pipeline que
lee UTF-8 y lo re-empaqueta asumiendo Latin-1.

**Fix esperado**: auditar dónde reserializamos strings del bus SK,
locales `.json`, textos de plugin config. Forzar `utf8` explícito en
`readFile` / `writeFile` y en el response Content-Type.

**Prioridad**: media — visual pero degradante.

### K-03 — Audio Pi intermitente (probable stack VPN)
**Síntoma**: alarmas del Pi (sirena, voz OGG) fallan con más
frecuencia de lo aceptable para una capa de seguridad.

**Hipótesis en investigación**: relación con VPN (Tailscale) — quizás
el stack de red o dependencias del backend se cuelgan cuando la ruta
cambia. Pasos de diagnóstico:
- ¿Falla con VPN off?
- ¿Falla más cuando el 4G se degrada?
- Correlación con `journalctl -u signalk` alrededor del fallo.

**Prioridad**: **alta** — es capa de seguridad primaria.

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
