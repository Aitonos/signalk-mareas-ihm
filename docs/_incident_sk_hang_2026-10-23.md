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
