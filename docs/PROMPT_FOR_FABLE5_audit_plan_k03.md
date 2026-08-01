# PROMPT PARA FABLE5 — Auditar el plan v2 de K-03 Audio Pi intermitente

> **Cómo usar este archivo**: pegar el contenido íntegro en Fable5 en un
> chat nuevo. Fable5 ya nos dio un primer análisis excelente sobre este
> mismo bug; ahora le pedimos que audite **el plan sintetizado** que
> integra su feedback + el de GPT-5 + el de Gemini Pro. No queremos
> re-diagnóstico, queremos **veredicto sobre el plan de acción**.

---

## Instrucciones para Fable5

Estás actuando como **ingeniero senior de sistemas Linux + audio embebido
+ Node.js**. Ya nos diste tu análisis técnico sobre este bug (K-03 —
Audio Pi intermitente en Raspberry Pi con PipeWire). Corregiste
sustancialmente los análisis de GPT-5 y Gemini Pro, aportaste 3 puntos
que a ellos se les escaparon (Pi con HDMI → default sink incorrecto,
suspend del DAC → primeros 100-200 ms perdidos, `pw-play` como fallback
PipeWire nativo), e identificaste 3 bugs concretos en el código propuesto
por Gemini (`proc.killed`, escuchar `exit`, `unref()` en objeto
equivocado).

Ahora hemos **sintetizado** los 3 análisis (GPT + Gemini + tu primer
análisis) en un plan v2 de fix. Te pedimos que:

1. Audites el plan v2 — orden, prioridad, esfuerzo estimado, cobertura.
2. Marques qué te parece bien, qué está mal priorizado, qué falta y qué
   sobra.
3. Detectes riesgos de regresión que no estemos viendo.
4. Propongas correcciones concretas (no re-hagas el diagnóstico entero,
   ese trabajo ya lo hicimos).
5. Nos digas si estás de acuerdo con **empezar por Fase 0 de
   diagnóstico SSH** antes de codar, o si prefieres saltar directo a
   Fase 1 confiando en los bugs deterministas ya identificados.

**Restricciones no negociables del contexto operacional** (repetimos por
si arrancas fresco):

- Raspberry Pi 4 / OpenPlotter V4 / Debian 12 Bookworm.
- Plugin `signalk-mareas-ihm` corre dentro de `signalk-server` (Node.js)
  como user `pi` (UID 1000), instalado como servicio systemd de sistema
  (no user unit).
- PipeWire 0.3.x con compat PulseAudio activada.
- DAC USB Jieli en producción, sin salida analógica ni HDMI usada, Pi
  headless.
- Locale del Pi: `LANG=es_ES` (sin `.UTF-8`) — bug de encoding conocido,
  ver K-02 en KNOWN_BUGS.md.
- Solo `espeak` permitido como dependencia apt nueva. `paplay`, `pactl`,
  `aplay`, `pw-play`, `ffmpeg` ya vienen con OpenPlotter V4.
- Es **capa de seguridad primaria** — cuando ningún visor cliente está
  abierto, este audio es lo único que suena a bordo.
- No podemos correr como root ni cambiar el user del servicio SK.
- El código relevante vive en la sección `[IHM-AUDIO]` de
  `src/index.ts` (~15k líneas total; el refactor arquitectónico
  general NO forma parte de este ticket).

---

## Los 3 análisis previos (resumen)

### GPT-5 dijo (aportaciones clave)

- Identificó **5 bugs deterministas del código actual** que sobreviven a
  cualquier debate:
  - **Bug A** — Retry falso: el "retry sin --device" reinyecta
    `PULSE_SINK` porque llama a `_PA_ENV()`. El sink cacheado obsoleto
    sigue aplicándose.
  - **Bug B** — Timeout tratado como éxito: `execFile` con timeout
    envía `SIGTERM`, y el código hace `if (err.signal === "SIGTERM")
    return onDone()`. Un timeout de PipeWire colgado se computa como
    reproducción OK. Explica los fallos sin traza en logs.
  - **Bug C** — SIGKILL levanta retry y avanza fase: al silenciar, el
    callback recibe `signal:"SIGKILL"`. Como `SIGKILL !== SIGTERM`,
    entra en la rama de error → dispara retry → llama `onDone()` →
    cambia a `siren2`. **Cancelar puede reactivar el audio**.
  - **Bug D** — `_probeOggDuration()` sin `.catch()` puede parar la
    máquina de estados en fase `voice` para siempre hasta reboot.
  - **Bug E** — `_ensureGainedAudio` (ffmpeg) en el hot path introduce
    ~200 ms de latencia en el primer disparo.
- Propuso **token de generación por kind** para invalidar callbacks
  obsoletos post-cancelación (única forma limpia de resolver bug C).

### Gemini Pro dijo (aportaciones clave)

- Aportó H5 (event loop asfixiado por reconexiones de red) y H6
  (SIGKILL corrompe sockets PipeWire), **ambas parcialmente refutadas
  por Fable5**.
- Aportó H7 (ráfagas de `execFile` para 3 tonos de sirena saturan el
  DAC Jieli) — **este sí es válido y encaja con la pre-renderización**.
- Propuso `_safeKill` con SIGTERM+200ms→SIGKILL — **con 3 bugs
  identificados por Fable5** (`proc.killed` no significa muerto, falta
  `exit` handler, `unref()` en objeto equivocado).
- Recomendó `Date.now()` para duraciones críticas — Fable5 dijo "buena
  práctica sí, pero no por VPN".

### Fable5 (tú) dijo (aportaciones únicas)

1. **Gap del retry sin --device** — el mejor fallo posible es fallar
   silenciosamente por HDMI post re-enumeración. Nunca caer a default
   sink; siempre re-probe con match `usb|Jieli`.
2. **Suspend del DAC como bug latente** — primera alarma tras horas de
   silencio pierde 100-200 ms. Fix: `session.suspend-timeout-seconds =
   0` en WirePlumber para el nodo del DAC. Elimina pops y garantiza
   inicio íntegro.
3. **`pw-play` como fallback nativo PipeWire** — funciona incluso si
   `pipewire-pulse` está caído. Mejor que "retry sin device".
4. **Origen físico de H1** — DAC Jieli sin serial USB → colisión de
   nombre al re-enumerar → WirePlumber añade sufijo `.2`. Confirmable
   con `journalctl -k | grep -i usb`.
5. **Fase 0 de diagnóstico previo** — 10 min de SSH antes de codar
   confirma o refuta la hipótesis primaria.
6. **Causa raíz física** — re-enumeraciones USB por caídas de tensión
   del VHF. Hub USB alimentado podría eliminar H1 de raíz.
7. **`loginctl enable-linger pi`** — si SK corre como servicio de
   sistema, sin linger `/run/user/1000` puede no existir.
8. **Simplificar sirena** — 3 tonos + silencios pre-renderizados como
   un solo archivo con ffmpeg al arranque. Elimina H7, elimina
   sensibilidad a timers.

---

## Plan v2 sintetizado (auditar esto)

### Fase 0 — Diagnóstico SSH previo (sin código, ~10 min)

Sin esto disparamos a ciegas. Todo esto SIN reiniciar nada:

```bash
# ¿Hay re-enumeraciones USB históricas?
journalctl -k --since "7 days ago" | grep -iE \
  "usb.*(disconnect|reset|reject|error)|xrun|snd_usb"

# Estado sinks + default actual
pactl list sinks short && pactl get-default-sink

# ¿Está el linger activo?
loginctl show-user pi -p Linger

# Servicios de usuario reales
systemctl --user is-active pipewire pipewire-pulse wireplumber

# Socket presente y usable
ls -la /run/user/1000/pulse/native

# ¿Hay HDMI sink presente?
pactl list sinks short | grep -i hdmi

# Correlación con timestamp del último fallo si el usuario lo recuerda
journalctl --since "2h ago" | grep -iE "IHM-AUDIO|paplay|pipewire"
```

Si NO correlacionamos re-enumeración USB con el timestamp del fallo, la
causa primaria es otra (linger, WirePlumber degradado, alimentación
del DAC) y ajustamos.

### Fase 1 — Fixes deterministas del código (P0, ~150 líneas)

Todos los bugs de GPT sobreviven a las críticas de Fable5:

1. **Discriminante tipado en callbacks**: `ok | cancelled | timeout |
   spawn_error | exit_error`. Fin del "err.signal === SIGTERM ==
   éxito".
2. **Token de generación por kind**: `_piAudioGeneration[kind]`
   incrementado en start y en kill. Callbacks capturan la generación
   de origen y se auto-cancelan si obsoletos. Resuelve bug C.
3. **`_safeKill` con las correcciones de Fable5**:
   - Escuchar `exit` para cancelar el timer de rescate.
   - Tracking manual del estado (no confiar en `proc.killed`).
   - `unref()` sobre el timer, no sobre proc.
4. **Retry con re-probe fresco + validación de match**: `pactl list
   sinks short`, buscar `usb|Jieli|C-Media`. Si no hay match →
   `notifications.security.audioPipelineDegraded` en SK + NO
   reproducir a default sink. Nunca fallar silenciosamente a HDMI.
5. **`.catch()` + `Number.isFinite(durSec)` + duración de reserva
   (5 s)** en `_probeOggDuration`. Máquina de estados nunca se cuelga
   en `voice`.
6. **Timeout explícito distinguido de SIGTERM manual**: usar
   `AbortController` en vez de la opción `timeout` de `execFile`, o
   trackear manualmente si el kill fue por nosotros (cancelación) o
   por Node (timeout).

### Fase 2 — Robustez del sink (P1, ~120 líneas)

7. **Config WirePlumber user-level** en
   `~/.config/wireplumber/wireplumber.conf.d/50-mareas-ihm-usbsink.conf`
   desactivando suspend del sink USB (Fable5). Escrita por el plugin
   en el arranque si detecta el sink Jieli. Bloque WirePlumber:

   ```
   monitor.alsa.rules = [
     {
       matches = [ { node.name = "~alsa_output.usb-.*" } ]
       actions = {
         update-props = {
           session.suspend-timeout-seconds = 0
           node.pause-on-idle = false
         }
       }
     }
   ]
   ```

   Solo si el user linger está activo. Necesita `systemctl --user
   restart wireplumber` una vez tras escribirlo (una única vez al
   detectarlo, no cada arranque).

8. **Fallback opcional a `pw-play`** si `paplay` falla en el disparo Y
   `pipewire-pulse` reporta no activo. `pw-play` habla PipeWire
   nativo (Fable5).

9. **`GET /api/audio-health` pasivo**: `pactl info`, socket, sinks,
   `consecutiveFailures`, `lastSuccessMs`, ring buffer 20 intentos,
   `eventLoopP99` con `monitorEventLoopDelay()`.

10. **Botón "Probar audio del Pi"** en Config del visor — usa la pipe
    real, no versión simulada. Test manual iniciado por usuario.

11. **Aviso en wizard J-2** si `loginctl show-user pi -p Linger`
    devuelve `Linger=no` — mostrar el comando `sudo loginctl
    enable-linger pi` para que Carlos lo copie.

### Fase 3 — Latencia y estabilidad (P2, ~80 líneas)

12. **Pre-renderizar la sirena entera** (3 tonos + silencios) como un
    solo archivo WAV con ffmpeg al arranque (Fable5 fusiona Gemini H7
    + GPT desacoplo latencia). Un solo `paplay` por burst en vez de 3.

13. **Pre-amplificación con `alarmVolumePct`** en background al arranque
    y en cada cambio de volumen. Nunca ffmpeg en hot path.

14. **`Date.now()` para duraciones críticas**. Buena práctica general.

### Descartados definitivamente

- Fallback `aplay` directo (los 3 LLMs desaconsejan por `EBUSY` con
  PipeWire vivo).
- Heartbeat con audio silencioso (GPT y Gemini — pops en corneta;
  Fable5 lo remata).
- Refactor arquitectónico del monolito `src/index.ts`.
- Culpar Tailscale sin evidencia de `PULSE_SERVER` o CPU o event loop
  delay (los 3 LLMs coinciden).

---

## Preguntas concretas para Fable5

1. **Orden de fases**: ¿está bien Fase 0 → 1 → 2 → 3? ¿Hay algo de
   Fase 2 que debería subir a Fase 1 por criticidad? En particular,
   el punto 7 (WirePlumber no-suspend) — ¿es lo suficientemente
   impactante para hacerlo antes que los fixes deterministas del
   código?
2. **Fase 0 vs saltar a Fase 1**: si tuvieras que elegir entre gastar
   10 min en el diagnóstico SSH o arrancar los fixes deterministas ya
   (que son bugs demostrables independientemente de la causa raíz),
   ¿qué eliges? ¿Por qué?
3. **Estimación de esfuerzo**: ¿150 líneas para Fase 1 es realista o
   subestimado? ¿120 para Fase 2? El token de generación (punto 2 de
   Fase 1) suele generar más código del previsto.
4. **Coste del punto 7 (WirePlumber config)**: ¿escribir el archivo
   en `~/.config/wireplumber/` desde el plugin es seguro? ¿Rompe algo
   si el usuario ya tiene un archivo ahí (mergeamos o sobreescribimos)?
   ¿Necesita realmente `systemctl --user restart wireplumber` una vez
   o hot-reload es suficiente?
5. **Punto 8 (`pw-play` fallback)**: ¿es realmente útil si tras el
   punto 4 ya validamos el sink con match? ¿O es redundante y
   podríamos ahorrárnoslo?
6. **Punto 6 (AbortController vs timeout)**: ¿qué recomiendas? El
   patrón actual (`execFile` con opción `timeout`) es el que introduce
   el bug B. ¿Migrar a `spawn` + `AbortController` es proporcional al
   fix?
7. **Riesgos de regresión**: ¿qué se puede romper con el token de
   generación si un callback tarda mucho? ¿Y con la validación de
   match del sink (podríamos rechazar un sink válido con nombre no
   estándar)?
8. **Instrumentación (Fase 2 punto 9)**: ¿qué campos considerarías
   imprescindibles? El endpoint pasivo `pactl info` — ¿coste?
   ¿frecuencia razonable si añadimos poll cada N segundos?
9. **Falta algo**: ¿algún fix o robustecimiento que no esté en el
   plan? ¿Alguna cosa que hayamos aceptado como "aceptable" que en
   realidad debería estar en el plan?
10. **Sobra algo**: ¿algún punto que sea gold-plating o que traiga más
    complejidad que valor?

---

## Formato de respuesta esperado

1. **Veredicto rápido** — ¿el plan es implementable tal cual, o pide
   una revisión antes de tocar código?
2. **Por cada Fase**: qué está bien, qué está mal priorizado, qué
   sobra, qué falta.
3. **Correcciones concretas** en el plan — no re-diagnóstico.
4. **Riesgos de regresión** — 3-5 puntos concretos con mitigación.
5. **Recomendación final** — Fase 0 primero o saltar a Fase 1?

Contesta duro. Prefiero una crítica afilada a una educada. El plan es
una síntesis y sabemos que puede tener costuras.

Fin del prompt.
