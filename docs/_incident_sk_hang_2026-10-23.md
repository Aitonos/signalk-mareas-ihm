# Incidente 2026-10-23 — Signal K colgado 5 h (mareas Rev888, fuente IMU pypilot)

## Síntoma
Signal K dejó de responder (HTTP sin respuesta) desde las **05:01:25** del
23/10 hasta el reinicio manual a las 10:21. El servicio seguía "active",
el proceso Node al **100 % de un núcleo**, el log parado.

## Evidencia (inspector de Node sobre el proceso colgado)
- Pila: `PypilotKeyValueSource.poll()` → `dist/imu/sources/pypilot.js:175`
  (`ImuManager._tick` → `setInterval`).
- Código:
  `while (this._recentTs.length > 0 && now - this._recentTs[0] > 30_000) this._recentTs.shift();`
- `this._recentTs.length` = **8 749 247**; primera marca 22/10 ~06:47,
  última 23/10 05:01:15 (≈110 marcas/s durante 22 h).
- `now` dentro del bucle = 05:01:25; `Date.now()` real = 10:19.

## Causa
1. La fuente IMU de pypilot hace `push` de una marca de tiempo en cada
   variable IMU recibida (heading, pitch, roll, heel…).
2. Solo podaba en `poll()`, y `ImuManager._tick` solo llama a `poll()`
   de la fuente **activa**. Con la fuente Signal K activa, la de pypilot
   seguía conectada y acumulando sin podar: fuga de memoria (~70 MB) y
   array de 8.7 M.
3. A las 05:01 la fuente pypilot pasó a activa (failover). Su primer
   `poll()` intentó quitar 8.7 M entradas con `shift()` en bucle:
   cada `shift()` mueve el array entero → O(n²) ≈ 10¹³ operaciones →
   event loop bloqueado, Signal K entero sin servicio.

## Arreglo (Rev889)
- `pypilot.ts`: poda también en cada `push`; poda de una vez con
  `splice` (O(n)) y tope de 6000 entradas (30 s a 200/s), que además
  aguanta un salto atrás del reloj.
- `signalk.ts`: mismo tope en sus dos arrays de 30 s.
- Prueba: `poll()` sobre un array de 8.7 M entradas → **68 ms** (antes: horas).
- Tests mareas 93/93. Desplegado en la Pi 10:24, Signal K respondiendo.

## Acciones hechas
- AP comprobado desconectado **directamente en pypilot** (TCP 23322:
  `ap.enabled=false`) antes de reiniciar, porque Signal K no respondía.
- `systemctl restart signalk`: el proceso colgado no paró y systemd lo
  mató con SIGKILL.

## Pendiente
- Por qué la fuente activa cambió a pypilot a las 05:01 (¿la fuente SK
  dejó de dar datos? relacionado con `set-system-time`?). Con el arreglo
  ya no puede colgar, pero conviene mirarlo.
- El cron de reinicio cada 3 días (04:00) **no** protege de esto: el
  cuelgue fue 25 h después del último reinicio.

---

## Auditoría de mareas tras el incidente (Rev890)

Objetivo: encontrar todo lo que pueda volver a bloquear Signal K o hacer
crecer la memoria sin límite. Inventario de las ~40 colecciones de larga
vida (arrays, Map, Set, diccionarios) y de los timers.

### Por qué cambió de fuente IMU a las 05:01
`ImuManager` solo llama `poll()` de la fuente ACTIVA, pero las demás siguen
conectadas recibiendo datos. Secuencia probable:
1. 22/10 04:00 (cron): al arrancar, la actitud SK aún no está → se elige
   pypilot (TinyPilot) como activa.
2. 22/10 ~06:47: pypilot sin datos un rato → failover a la fuente SK. La de
   pypilot sigue conectada; al volver los datos acumula sin podar (primera
   marca del array: 06:47).
3. 23/10 05:01: la actitud SK para unos segundos → failover a pypilot →
   primer `poll()` sobre 8.7 M → cuelgue.

### Hallazgos

| # | Gravedad | Dónde | Fallo | Arreglo |
|---|---|---|---|---|
| 1 | CRÍTICO (causó el incidente) | `imu/sources/pypilot.ts` | Ventana de 30 s podada solo en `poll()` (fuente activa) y con `shift()` en bucle. | Rev889: poda al recibir, `splice` único, tope 6000. |
| 2 | **CRÍTICO (mismo patrón, latente)** | `_skPathsRateWindow` | Una entrada por cada delta publicado; podada SOLO al abrir `/api/sk-paths/stats` (página de paths del wizard). Crecía sin límite y la primera apertura habría congelado Signal K igual. Probable parte del +30 MB/h de RSS medido el 18-20/10. | Rev890: un cubo por segundo, poda en cada alta (máx ~61). |
| 3 | Medio (fuga lenta) | `_aisOnlineSeen` | Una entrada por MMSI visto online (aisstream/aishub/aisfriends), nunca borrada. | Rev890: barrido cada minuto, borra los no vistos en 10 min. |
| 4 | Medio (latente) | buffers por tiempo: racha, olas (x2), acelerómetro, posición, contexto nav, profundidad, auditoría IMU | Podan por edad al añadir; con el reloj atrasado (saltos de `set-system-time`) no podan y el recorte posterior es O(n²). | Rev890: tope de tamaño en todos (`_capArr`). |
| 5 | Bajo | búfer TCP del bridge pypilot y de la fuente IMU | Sin tope si no llega `\n`. | Rev890: tope 256 KB. |
| 6 | Diagnóstico | `heapAudit` | No vigilaba los arrays de las fuentes IMU ni la ventana de rate: el incidente no se veía venir. | Rev890: los incluye. |

Revisado sin fallo: `_aisKnownDB` (podado), `_aisIdentityLastPub` (podado),
`_aisFirstInZoneAt` (podado), `_navtileRamCache` (tope), `sseClients`
(borrado al cerrar), `PUBLISHED_PATHS` (solo nombres de path),
`COEF_TABLE_CACHE` (por año), cachés de audio (finitas), `trackPoints`
(tope 12000), `_activityLog` / `_audioAttemptHistory` (tope), E/S síncrona
(solo en rutas y arranque), caché en disco (48 MB, escritura asíncrona).

### Pendiente (no es cuelgue)
- mareas abre **2 conexiones TCP** a la TinyPilot (fuente IMU remota y
  bridge de olas) además de la de pypilot-newui: 3 sockets a la Pi Zero.
  Unificar o parar la fuente IMU en reserva.
- La fuente pypilot se marca `status = "active"` al recibir datos aunque no
  sea la activa del gestor: estados confusos en `/api/imu/status`.
- Sin histéresis en el failover IMU: un corte breve de la actitud SK cambia
  de fuente y no vuelve hasta que la nueva falla.
