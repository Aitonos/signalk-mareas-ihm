# AUDIT K-03 — Audio Pi intermitente — Plan v3.1 aterrizado

**Estado**: aprobado por Carlos 2026-08-02 tras 3 iteraciones LLM
(GPT-5 → Gemini Pro → Fable5 primer pase → Fable5 auditoría del plan v2)
+ Fase 0 SSH read-only sobre el Pi de producción.

**Punto de recuperación**: tag `pre-k03-audio-fix` en GitHub
(commit `0a9a098`, base v2.11.2 + docs refresh). Rollback trivial con:
```
git reset --hard pre-k03-audio-fix
./deploy.ps1 -Restart
```

**Alcance de K-03**: SOLO la **Capa 1** (audio local del Pi). Capas 2-5
(browser cliente / Telegram bot / Telegram voice call / Web Push) son
tickets separados que no forman parte de este fix.

---

## Fase 0 — Hallazgos SSH (2026-08-02)

### Refutadas de la hipótesis original

- **H1 por falta de iSerial en el DAC**: el Jieli **sí reporta** iSerial
  `4150344C36313516`. Nombre del sink estable.
- **H1 por caídas de tensión**: solo 3 líneas kernel-usb en 7 días,
  todas del arranque. Cero re-enumeraciones del DAC en producción.
- **H4 (linger, socket, user services)**: `Linger=yes`, socket
  `/run/user/1000/pulse/native` presente, pipewire + pipewire-pulse +
  wireplumber los 3 activos.

### Confirmadas y agravadas

1. **Default sink del Pi = HDMI**, no el USB Jieli. Gap crítico Fable5
   activo en producción:
   ```
   66  alsa_output.usb-Jieli_...              SUSPENDED
   67  alsa_output.platform-...hdmi-stereo    SUSPENDED   ← default
   ```

2. **Bug del driver `vc4` del Pi 5** con HDMI headless. Log kernel del
   28-jul 00:47:38:
   ```
   WARNING: vc4_hdmi_write_infoframe+0x3fc/0x470 [vc4]
   Packet RAM has to be on to store the packet.
   ```
   Trigger: PipeWire (`data-loop.0`) prepara audio HDMI sin monitor
   conectado → kernel WARN.

3. **Evidencia real del bug K-03 en log del 02-ago 01:18:36**:
   ```
   01:18:36  _piAlarmStopImmediate(garreo)  ← usuario cancela
   01:18:36  _piAlarmStopImmediate(ais)     ← usuario cancela
   01:18:36  paplay OGG ais_es.ogg FAILED   ← bug C (SIGKILL) confirmado
   01:18:36  paplay siren garreo burst2 FAILED
   01:18:44  paplay OGG retry ais_es.ogg OK ← cae al HDMI muerto, retorna "OK"
   ```
   Bug A (retry falso con PULSE_SINK) + Bug C (SIGKILL levanta retry) +
   gap Fable5 (default sink HDMI) → los tres confirmados en un solo
   trazo real.

4. **120 menciones de audio-fail en 48h**. No es un caso aislado, es
   sistémico.

### Estado del entorno

- WirePlumber 0.4.13 → **sintaxis Lua obligatoria** en
  `~/.config/wireplumber/main.lua.d/` (NO `.conf`, que es 0.5+).
- PipeWire 1.2.7.
- User `pi` en grupos `adm audio` → puede leer journal + puede audio.
- Locale `es_ES` (sin UTF-8 confirmado) → **`LC_ALL=C` obligatorio en
  todos los spawn cuyo stdout se parsee**.

---

## Modelo de resolución del sink

**Modelo B como default + Modelo C como opt-in del usuario** (aprobado
por Carlos 2026-08-02):

### Modelo B — Fallback secuencial (default)

En cada disparo de alarma:

```
1. ¿Hay preferencia guardada del usuario en ihmCache "preferredSinkName"?
     Sí → ¿existe todavía en la lista actual de `pactl list sinks short`?
              Sí → USAR ese sink.
              No → notification "preferred sink desapareció, usando fallback".

2. Auto-detección con heurística (patrón actual, reforzado):
     USB (alsa_output.usb-*) > analog jack > HDMI > cualquier otro.
     Si encuentra → USAR + guardar como preferencia inicial.

3. Retry solo dentro de la lista de sinks resueltos, SECUENCIALMENTE.
     NUNCA usar el default de PipeWire ciego (evita caer a HDMI muerto).

4. Si TODOS los sinks fallan → notifications.security.audioPipelineDegraded
     + NO reproducir (fallo visible, no silencioso).
```

### Modelo C — Combine-sink simultáneo (opt-in)

Usuario avanzado activa en Config → Audio → "Reproducir por todas las
salidas". Al arrancar el plugin:

```
pactl load-module module-combine-sink \
   sink_name=ihm_alarm \
   slaves=<lista de sinks resueltos>
```

Todos los `paplay` van a `--device ihm_alarm`. Redundancia física real:
si un backend cae, el otro sigue sonando.

**En el Pi de Carlos hoy**: NO usar C (spamearía kernel log con el bug
vc4 del HDMI headless). En otros Pi con HDMI a altavoz legítimo: sí
tiene sentido.

---

## Plan por fases

### Fase 1 — Fixes deterministas del código (P0, ~300-400 líneas)

Todos los bugs A-E de GPT + corrección Fable5.

**1.1 Helper `_spawnAudio(cmd, args, env)`** — wraps `execFile` con:
- `{ ...env, LC_ALL: 'C' }` explícito.
- Return de un objeto discriminado: `{ outcome, err, stdout, stderr, elapsedMs }`.
- Todos los `pactl`, `paplay`, `ffmpeg` pasan por este helper.

**1.2 Discriminante tipado**:
```
generación obsoleta            → 'cancelled' (cleanup, NO transición)
err.killed && signal===SIGTERM → 'timeout' (FALLO, nunca éxito)
err.code === 'ENOENT'          → 'spawn_error'
exitCode !== 0                 → 'exit_error'
sin error                      → 'ok'
```

**1.3 Token de generación** `_piAudioGeneration[kind]`:
- Capturado en variable local ANTES del primer `await`.
- Incrementado en un único punto por transición.
- **Kill-all bumpea TODOS los kinds**, no solo el activo.
- Callbacks obsoletos ejecutan cleanup (temp files, timers) aunque
  no transicionen — evita fuga lenta.

**1.4 `_safeKill(proc)` corregido**:
- SIGTERM → 200 ms → SIGKILL de rescate.
- Escuchar evento `exit` para cancelar el timer del rescate.
- Tracking manual del estado con variable local `killed = false`.
- `unref()` sobre el **timer**, no sobre proc.

**1.5 Resolución del sink (modelo B)**:
- Nuevo `_resolveSink()` que devuelve `Promise<string|null>`.
- `_PA_ENV_UNPINNED()`: `const { PULSE_SINK, ...rest } = process.env; return rest;`.
- Re-probe fresco con `pactl list sinks short` (con `LC_ALL=C`).
- Preferencia del usuario > heurística USB > analog > HDMI > cualquier.
- Retry secuencial en la lista de sinks resueltos, nunca a default ciego.
- Si `null` → SK notification degradada + no reproducir.

**1.6 `_probeOggDuration` con manejo de fallo**:
- `.catch()` propagado.
- `Number.isFinite(durSec)` + duración de reserva 5 s.
- Máquina de estados nunca queda colgada en fase `voice`.

**Criterios de aceptación Fase 1** (verificables en banco):
- ✅ Cancelar durante voz → NO se dispara siren2 (bug C fixed).
- ✅ Timeout de paplay simulado → outcome `timeout`, retry en siguiente
  sink, si todos fallan → notification degradada.
- ✅ `_probeOggDuration` falseado → arranca con duración de reserva.
- ✅ Locale `es_ES.UTF-8` restaurado en el Pi → `pactl` parsing sigue OK.

---

### Fase 2 — Robustez del sink (P1, ~250 líneas)

**2.7 WirePlumber Lua config para USB DAC** (opcional / condicionado):
- Solo si preferencia del usuario es un `alsa_output.usb-*` Y linger=yes.
- Escrita **una sola vez** al arranque, antes de armar alarmas.
- Formato Lua para 0.4.x (con detección de versión):
  ```lua
  -- ~/.config/wireplumber/main.lua.d/51-mareas-ihm-usbsink.lua
  table.insert(alsa_monitor.rules, {
    matches = {
      { { "node.name", "matches", "alsa_output.usb-*" } },
    },
    apply_properties = {
      ["session.suspend-timeout-seconds"] = 0,
      ["node.pause-on-idle"] = false,
    },
  })
  ```
- **Rollback automático** obligatorio: tras `systemctl --user restart
  wireplumber`, verificar `is-active` + re-probe. Si falla: borrar
  archivo, reiniciar de nuevo, `notifications.security.wireplumberConfigReverted`.
- Con el padding de silencio de 3.12 este punto baja de prioridad,
  se puede diferir tras validar en banco.

**2.8 Selector visible de output** en Config → Audio:
- Listado de sinks visibles con etiqueta legible ("USB (Jieli
  Technology UACDemoV1.0)", "HDMI (Pi5 built-in)", etc.).
- Radio button para elegir.
- Botón "Probar audio" que reproduce fanfarria corta en el sink
  elegido.
- Botón "Auto-detectar" que restaura la heurística.
- Warning amarillo si el sink elegido es HDMI en Pi 5 headless.
- Toggle "Reproducir por todas las salidas" (modelo C opt-in).

**2.9 `GET /api/audio-health` pasivo**:
- Snapshot: default sink, sinks visibles último probe,
  `consecutiveFailures`, `lastSuccessMs`, estado 3 user services.
- Ring buffer últimos 20 intentos con:
  `ts, kind, sinkUsado, outcome, durationMs, generation, retryCount`.
- **Cache 5 s** — sin poll periódico.
- `monitorEventLoopDelay()` histograma nativo, coste cero.

**2.10 Botón "Probar audio del Pi"** en Config del visor → pipe real
(no simulada).

**2.11 Aviso en wizard J-2** si `Linger=no` → comando `sudo loginctl
enable-linger pi` para copiar.

---

### Fase 3 — Latencia y estabilidad (P2, ~100 líneas)

**3.12 Sirena pre-renderizada** como un solo archivo WAV al arranque:
- **Con 250 ms de silencio prepended** (Fable5 — alternativa elegante
  al problema de wakeup del DAC).
- **Fallback obligatorio**: si render falla o artefacto <umbral →
  caer a ruta actual de 3 `execFile`. Un fallo de render al boot
  NO puede dejar al barco sin sirena.

**3.13 Pre-amplificación con `alarmVolumePct`** en background al
arranque + al cambio de volumen. Con fallback al original sin gain
si ffmpeg falla.

**3.14 `Date.now()` para duraciones críticas** — buena práctica.

---

## Descartados definitivamente

- Fallback `aplay` (los 3 LLMs: `EBUSY` con PipeWire vivo).
- Heartbeat con audio silencioso (los 3 LLMs: pops en corneta,
  no prueba nada del hardware).
- `pw-play` como fallback (Fable5 v2: redundante tras 1.5).
- `AbortController` (Fable5 v2: token de generación ya cubre).
- Refactor arquitectónico del monolito `src/index.ts`.
- Culpar Tailscale sin evidencia de `PULSE_SERVER` o CPU alta.
- Match hardcoded `usb|Jieli|C-Media` (Carlos: multi-dispositivo).

---

## Acciones fuera de código

- **Hub USB alimentado o alimentación separada** del DAC — si las
  caídas de tensión del VHF re-enumeran el DAC (no confirmado en
  Fase 0 pero recomendación preventiva de Fable5).
- **`sudo loginctl enable-linger pi`** — ya activo en el Pi de Carlos,
  Fase 0 lo confirmó (para otros usuarios sí es válido).

---

## Referencias

- Prompts LLM (gitignoreados por diseño):
  - `docs/PROMPT_FOR_LLM_audio_pi_intermittent.md` (autocontenido).
- Prompt para auditar plan v2 (commited):
  - `docs/PROMPT_FOR_FABLE5_audit_plan_k03.md`.
- Rollback tag: `pre-k03-audio-fix` en GitHub, commit `0a9a098`.
