# Prompt para Gemini / ChatGPT — Audio alarmas SignalK Mareas IHM

> **Cómo usar este prompt**: cópialo entero al chat de Gemini o ChatGPT.
> Adjunta los archivos listados al final (los más grandes Gemini los acepta
> directamente; si ChatGPT pone un límite, sube el archivo relevante a la
> función "Attach" o pega secciones por trozos).

---

## Contexto

Soy un usuario navegante con un plugin **SignalK** (Node.js + TypeScript) que
vigila el fondeo de mi barco. El plugin se llama `signalk-mareas-ihm` y corre
en una **Raspberry Pi con OpenPlotter V4**. Tiene dos salidas de audio
independientes:

1. **Pi sink USB (backend)** — `paplay` + `espeak`/OGG independientes del
   navegador. Es la "red de seguridad" que suena con monitor apagado o
   navegador cerrado.
2. **Visor browser (frontend mobile.html)** — WebAudio + speechSynthesis,
   per-tab, sujeto a la *autoplay rule* del browser (cada tab necesita un
   gesture user inicial).

Tres tipos de alarma:
- **garreo** (anchor dragging) — máxima prioridad safety.
- **AIS** (target en zona de borneo) — colisión potencial.
- **grounding** (riesgo de varada).

Ciclo de cada alarma en Pi: `siren → voice → siren2 → silence` con setTimeout
encadenado. Cada fase trackea procesos `paplay`/`espeak` en `_piActivePlay[kind]`
y burst setTimeouts en `_piBurstTimers[kind]`. El frontend tiene sus propios
loops WebAudio en paralelo.

## El problema concreto

He intentado durante ~10 iteraciones (Rev191 a Rev201) implementar un
**mute cross-device global** que silencie tanto Pi como todos los visores
con un solo tap, propagado por SSE. **Acabo de revertir/neutralizar todo
porque tuve un incidente de alarma atascada que tardó ~2 minutos en
silenciarse incluso tras `systemctl restart signalk`**.

Estado actual (**Rev202 neutralizada**, similar a Rev190 pre-B-01):
- El endpoint `POST /api/anchor-watch/audio-enable` solo persiste un boolean
  y broadcast SSE.
- El Pi audio engine **NO** consulta `anchorWatch.audioEnabled`. Suena cuando
  detecta garreo/AIS/grounding y solo se silencia por sus canales legítimos:
  snooze, lift, alarma-off por kind, plugin stop.
- El visor browser sí sincroniza el icono 🔊/🔇 entre tabs.

## Síntomas observados durante las iteraciones (con el código de mute activo)

1. **Alarma atascada durante minutos** que no se silenció ni con `pkill`, ni
   tras `systemctl restart signalk`. Tardó ~2 minutos en cesar.
2. **Mute desde un device no apagaba el Pi** aunque el endpoint llegaba al
   backend y `_piAlarmStopAll()` se ejecutaba — la sirena en curso seguía
   sonando.
3. **Unmute desde un device** solo activaba audio en ese device, no en otros
   tabs sin gesture-unlock (esto es autoplay rule del browser, **inevitable**).
4. **Tap del botón a veces no cambiaba el icono** (probablemente doble-fire
   touchstart+click en iOS; añadí debounce 300ms).
5. **Cascada de sirenas acumuladas al desmutear** cuando había usado
   `_audioCtx.suspend()` — los oscillators encolados se descomprimían.
6. Después del fix con tracking de oscillators y `_burstActive[kind]` flags,
   el visor SÍ se calla al instante, pero el **Pi seguía sonando con SIGKILL**
   en `proc.kill("SIGKILL")` de los paplay/espeak trackeados.

## Lo que se ha intentado

| Intento | Cambio | Resultado |
|---|---|---|
| Rev191 | `audioEnabled` booleano backend + SSE broadcast + guard en `_piAlarmStart` | Icono sync OK, sonido mute no funcionaba bien |
| Rev192 | Debounce 300ms + `_audioCtx.suspend()` para corte instantáneo | Causó "tropel" al desmutar (oscillators acumulados) |
| Rev193 | Revertí `suspend()`, `_autoEnableAudio` hace POST al backend para evitar fight loop | Fight loop solucionado pero Pi seguía sonando |
| Rev194 | Refactor para tratar mute como drop/lift (espejo del state backend) | Icono cross-device 100% OK; Pi mute fallaba |
| Rev195 | `ctx.resume()` automático en remote unmute | No resolvía autoplay rule |
| Rev196 | Banner "Toca para oír" en tabs sin gesture | Funcionalmente OK pero confuso para usuario |
| Rev197 | Pi sigue muteo + safety timer 30s que reactiva si garreo persiste muteado | Mute Pi sigue sin funcionar bien |
| Rev198 | Tracking explícito de oscillators visor + flag `_burstActive` | Visor OK, Pi sigue mal |
| Rev199 | Trackear procesos `espeak` (estaban sin track) | Mejor pero no completo |
| Rev200 | Guards `audioEnabled` en cada fase del Pi state machine (`_piAlarmTick`, `_piPlaySirenBurst`, `_piPlayVoiceForKindWithCallback`) | Sigue mal |
| Rev201 | Guards adicionales tras cada `await` y cada `setTimeout` interno | **Incidente alarma atascada** |
| Rev202 | **Neutralizado**: Pi vuelve a ser independiente del booleano, banner fuera | Estable, mute cross-device queda WONTFIX |

## Pregunta concreta

Adjunto el archivo `docs/AUDIO_FLOW.md` con un diagrama ASCII del flujo de
audio, y los archivos `src/index.ts` (~7900 líneas) y `public/mobile.html`
(~8000 líneas). Las funciones clave para el caso de audio están en:

**Backend (`src/index.ts`)**:
- `evaluateAnchorWatch` — la función que detecta garreo/AIS/grounding y
  dispara `_piAlarmStart`. Corre cada 5s.
- `_piAlarmStart` / `_piAlarmTick` / `_piPlaySirenBurst` — state machine Pi.
- `_piPlayVoiceForKindWithCallback` / `_piPlayVoice` — voz Pi (OGG/espeak).
- `_piTrackProc` / `_piKillActive` / `_piAlarmStopImmediate` / `_piAlarmStopAll`
  — gestión de procesos `paplay`/`espeak`.
- `_silenceGarreo` / `_silenceAis` / `_isGarreoSilenced` / `_isAisSilenced`
  — silenciado temporal (snooze).
- `broadcastSSE` + endpoint SSE `/api/sse`.
- Endpoints REST: `/api/anchor-watch/drop`, `/lift`, `/silence-alarm`,
  `/snooze`, `/audio-enable`.

**Frontend (`public/mobile.html`)**:
- `processPollData` — recibe state del backend (SSE/poll) y reacciona.
- `_audioEnabled`, `toggleAudioEnable`, `_autoEnableAudio`.
- `setAlarmActive` / `_startAlarmLoop` / `_stopAllAlarmLoops` /
  `_stopAlarmVoiceLoop`.
- `_alarmBurstGarreo` / `_alarmBurstAis` / `_alarmBurstGrounding`.
- `_playTone` / `_playSirenSweep` / `_playFallingTone` — WebAudio
  oscillators.
- `_speakAlarm` — voz frontend (OGG buffer source o speechSynthesis).
- EventSource listeners `'state'` y `'audio'`.

**Pregunta principal**:

¿Por qué cuando intento silenciar el Pi audio engine via `_piAlarmStopAll()`
o vía guards `audioEnabled` en cada fase, **la alarma sigue sonando 1-2
segundos o se queda atascada minutos**? Específicamente:

1. **¿Qué race conditions o paths asíncronos** estoy pasando por alto entre
   el momento en que se llama `_piAlarmStopAll()` y el momento en que
   PulseAudio realmente deja de emitir sonido?

2. **¿Existe algún proceso paplay/espeak hijo** del Node.js de SignalK que
   pueda sobrevivir a un `proc.kill("SIGKILL")` o a un `systemctl restart
   signalk`? ¿Es posible que paplay se "desconecte" del Node parent y siga
   corriendo como huérfano hasta que PulseAudio drene su buffer?

3. **PulseAudio buffer**: ¿es esperable que tarde minutos en drenar un buffer
   tras matar `paplay`, o eso indicaría que algo está reescribiendo al sink?
   ¿Cómo aseguro un silencio inmediato a nivel de **sink**, no solo de
   proceso?

4. **¿La arquitectura es la equivocada?** Mi diseño actual es: state machine
   con setTimeout encadenado por fases, tracking de procesos en arrays
   indexados por kind, kill manual. ¿Hay un patrón mejor para alarmas
   sonoras críticas en Node.js + PulseAudio? Por ejemplo, ¿debería usar
   `child_process.spawn` con `detached:false` y `kill(-pid, signal)` para
   matar process groups, o un sink controllable via `pactl`?

5. **El usuario propuso "tratarlo como drop/lift"**: drop/lift solo cambian
   un booleano y disparan UNA voz, sin loops. Funciona perfecto. Mi mute
   tiene que ADEMÁS matar loops en curso, y eso es donde falla. **¿Es
   posible rediseñar el mute para que sea puramente declarativo** (cada
   fase del state machine consulta el booleano antes de actuar) **y prescindir
   completamente del `_piAlarmStopAll()` activo**? ¿Qué patrones de
   "graceful state machine cancellation" recomendarías?

6. **Comando de emergencia**: si la alarma se atasca, ¿hay un comando
   sistémico más fuerte que `sudo pkill -9 paplay; sudo systemctl restart
   signalk` que garantice silencio inmediato? ¿`pactl exit` reinicia
   PulseAudio? ¿Es seguro hacerlo en OpenPlotter V4?

**Por favor analiza el código adjunto y dame**:
- Diagnóstico raíz: qué exactamente puede causar la alarma atascada
  (hipótesis ordenadas por probabilidad).
- Para cada hipótesis, una **prueba ejecutable** (comando o snippet) que
  confirme/descarte.
- Una propuesta de **rediseño minimalista** del mute cross-device que sea
  *fail-safe* (si algo va mal, la alarma sigue sonando — nunca se atasca
  silenciosa, nunca se atasca sonando).
- Patrones de Node.js + child_process para matar procesos audio de forma
  agresiva pero segura en Raspberry Pi OS.

## Archivos a adjuntar al chat de la LLM

1. `docs/AUDIO_FLOW.md` — diagrama del flujo (texto, ~150 líneas).
2. `src/index.ts` — backend completo (~7900 líneas, TypeScript).
3. `public/mobile.html` — frontend completo (~8000 líneas, HTML+JS vanilla).
4. `docs/RULES.md` — reglas del proyecto (para que la LLM entienda
   restricciones como "minimal deps", "no commercial refs").
5. `docs/KNOWN_BUGS.md` — bugs activos.
6. Opcional: el log de `journalctl -u signalk -f | grep IHM-AUDIO` durante
   un mute fallido.

Si la LLM no acepta tantos archivos, prioriza `src/index.ts` y
`public/mobile.html` — ahí está toda la lógica de audio.
