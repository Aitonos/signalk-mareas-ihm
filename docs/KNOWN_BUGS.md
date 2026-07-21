# KNOWN_BUGS — bugs vigentes en Rev761 / v2.9.0

Estado: **2026-07-21** — snapshot tras Rev761. Reescrito desde cero: los
22 bugs B-01…B-22 del archivo Rev190 están todos resueltos y viven en
`archive/KNOWN_BUGS_Rev190_snapshot.md` para referencia histórica.

Aquí solo bugs **confirmados por Carlos y aún vigentes**, o QA
pendiente de validar en agua real.

---

## Vigentes

### K-01 — Smoothing filter sonda (~30 cm de oscilación)
**Síntoma**: la lectura de sonda oscila ~30 cm de tick a tick con la
sonda quieta en fondeo (agua tranquila). Genera ruido en cálculos de
grounding aunque no dispara alarma.

**Fix esperado**: media móvil ligera (3-5 samples) en el pipeline de
`environment.depth.*` antes de comparar contra umbrales de grounding.
Cuidado de no ocultar cambios reales (media larga = alarma tardía).

**Prioridad**: baja. No dispara alarma, solo estética en el widget de
sonda del bottom-bar.

---

## QA pendiente en agua real (features nuevas 2.7.0 → 2.9.0)

Todas estas features están **implementadas y desplegadas en el Pi de
Carlos**, pero Carlos aún no las ha validado con el barco en
condiciones reales (mar, motorizando, etc.).

| Feature | Rev | QA a validar |
|---|---|---|
| Auto-lift al arrancar motor | Rev751 | Salir motorizando: `propulsion.<name>.state="started"` + SOG>0.5 kn sostenido 30 s → auto-lift. Sin path motor: fallback SOG>3 kn / 60 s. |
| Bug alarma ancla al motorizar saliendo | Rev468+ | A >3 kn sostenidos NO debe seguir vigilando (auto-desarma). Cubierto por auto-lift Rev751 y su fallback SOG-only. |
| Ghost grounding alarm al boot | Rev639/706 | Cubierto por warmup 20 s + persistencia 15 s + guard depth-quality. No re-abrir sin repro fresco. |
| AIS por internet — aisstream.io | Rev738 | Ver targets fuera de alcance VHF; dedupe VHF prevalece (60 s). |
| AIS por internet — aishub.net | Rev754 | 1 req/min. Cede a VHF (60 s) y aisstream (120 s). |
| AIS por internet — aisfriends.com | Rev756 | 1 req/min. Requiere 7 días de contribución + 10 vessels + 90% uptime antes de que el Bearer token funcione. |
| Republish AIS online al bus SK | Rev738/758 | Otros clientes SK (Freeboard, KIP, WilhelmSK) deben ver los targets aisstream/aishub/aisfriends bajo `vessels.urn:mrn:imo:mmsi:*`. Endpoint filtra los republish con $source=`mareas-ihm.*` para no auto-contaminar. |

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

## Docs relacionadas

- Bugs 2026-05 → 2026-06 archivados en
  [`archive/KNOWN_BUGS_Rev190_snapshot.md`](archive/KNOWN_BUGS_Rev190_snapshot.md).
- QA runbook por commit (una lista viva de "qué probar tras cada
  cambio") en [`QA_PENDIENTE.md`](QA_PENDIENTE.md).
- Decisiones del usuario Q-A a Q-AU en [`Q_AND_A.md`](Q_AND_A.md).
