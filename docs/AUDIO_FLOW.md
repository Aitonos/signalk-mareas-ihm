# AUDIO_FLOW — gestión de audio en signalk-mareas-ihm

Estado: **Rev761 / v2.9.0** (revisado 2026-07-21 — arquitectura estable
desde Rev202, sin cambios de fondo desde entonces).

## Dos salidas de audio independientes

```
                       ┌─────────────────────────────┐
                       │   ANCHOR WATCH EVALUATOR    │
                       │   (backend, tick cada 5s)   │
                       │                             │
                       │   detecta:                  │
                       │    · garreo (dragging)      │
                       │    · AIS target en zona     │
                       │    · grounding risk         │
                       └──────────────┬──────────────┘
                                      │
                                      │ condición activa
                                      ▼
                       ┌─────────────────────────────┐
                       │     broadcastSSE("state")   │
                       │     (cada 3s) + por evento  │
                       └──────────┬──────────────────┘
                                  │
                       ┌──────────┴──────────┐
                       │                     │
                       ▼                     ▼
            ┌──────────────────┐   ┌──────────────────────┐
            │  CANAL Pi sink   │   │  CANAL visor browser │
            │  (independiente) │   │  (per-tab gesture)   │
            └────────┬─────────┘   └─────────┬────────────┘
                     │                       │
                     ▼                       ▼
            ┌──────────────────┐   ┌──────────────────────┐
            │  _piAlarmStart   │   │  setAlarmActive(kind)│
            │  ↓               │   │  ↓                   │
            │  _piAlarmTick    │   │  _startAlarmLoop +   │
            │  loop 4 fases    │   │  _startAlarmVoiceLoop│
            │  · siren paplay  │   │  ↓                   │
            │  · voice paplay  │   │  WebAudio oscillators│
            │    (OGG) o       │   │  + OGG decoded + TTS │
            │    espeak fallbk │   │                      │
            │  · siren2 paplay │   │  ⚠ requiere gesture  │
            │  · silence (gap) │   │    user en cada tab  │
            └────────┬─────────┘   └─────────┬────────────┘
                     │                       │
                     ▼                       ▼
            ┌──────────────────┐   ┌──────────────────────┐
            │  PulseAudio →    │   │  navegador →         │
            │  USB DAC Jieli   │   │  altavoz del device  │
            └──────────────────┘   └──────────────────────┘
```

## Canal 1 — Pi sink USB (backend)

**Características**:
- Independiente del navegador. Suena con monitor apagado, navegador cerrado, etc.
- Hardware: USB DAC Jieli con techo de amplificación (ver `project_audio_hardware_ceiling`).
- Voces OGG pre-grabadas en `~/Audio_OGGs/` + fallback espeak.

**Pipeline**:
```
evaluateAnchorWatch detecta condición
  │
  ▼
_piAlarmStart(kind)          ── arranca loop si no estaba
  │
  ▼
_piAlarmTick(kind)           ── state machine 4 fases
  │
  ├─ phase "siren":   _piPlaySirenBurst → execFile("paplay", ...)
  │                                       (3 bursts trackeados)
  │
  ├─ phase "voice":   _piPlayVoiceForKindWithCallback
  │                     │
  │                     ├─ si OGG existe: execFile("paplay", oggFile)
  │                     └─ sin OGG: _piPlayVoice → execFile("espeak", phrase)
  │
  ├─ phase "siren2":  _piPlaySirenBurst (igual que siren)
  │
  └─ phase "silence": setTimeout para próximo ciclo
```

**Cómo se silencia**:
```
┌─────────────────────────────────────────────────────────┐
│ Mecanismo              │ Efecto                         │
├────────────────────────┼────────────────────────────────┤
│ POST /api/anchor-      │ _silenceGarreo(5min)           │
│   watch/silence-alarm  │ _silenceAis(5min)              │
│   {kind, minutes}      │ → evaluateAnchorWatch skip     │
│                        │   _piAlarmStart (silenced=true)│
├────────────────────────┼────────────────────────────────┤
│ POST /api/snooze       │ Igual silence-alarm, kinds=todo│
├────────────────────────┼────────────────────────────────┤
│ POST /api/anchor-      │ anchorWatch.anchored=false     │
│   watch/lift           │ clearDragAlarm + _piAlarmStopAll│
├────────────────────────┼────────────────────────────────┤
│ POST /api/anchor-      │ anchorWatch.garreoAlarmEnabled │
│   watch/garreo-alarm-  │   = false → no nuevos disparos │
│   status {enabled}     │                                │
├────────────────────────┼────────────────────────────────┤
│ ACK individual AIS     │ aisAckedMMSIs filter, no warn  │
│                        │ para ese MMSI                  │
├────────────────────────┼────────────────────────────────┤
│ Plugin stop / disable  │ _piAlarmStopAll en stop()      │
└────────────────────────┴────────────────────────────────┘
```

**Rev202 (neutralizado)**: el endpoint `POST /audio-enable` **NO afecta a este
canal**. El intento de mute global (B-01) causó un incidente de alarma
atascada — revertido.

## Canal 2 — Visor browser (frontend mobile.html)

**Características**:
- Per-tab gesture-locked (browser autoplay rule, sin solución).
- WebAudio API + OGG decoded + speechSynthesis TTS fallback.
- Cada tab necesita un tap inicial para "desbloquear" su AudioContext.

**Pipeline**:
```
processPollData(state)
  │
  │ detecta s.dragging / s.aisAlarmEnabled / etc
  ▼
setAlarmActive(kind, true)
  │
  │ si kind === 'garreo' || 'grounding':
  │   _autoEnableAudio('alarm-' + kind)   ── safety: ignora mute local
  ▼
_startAlarmLoop(kind, burstFn, intervalMs)
_startAlarmVoiceLoop(kind, intervalMs)
  │
  ▼
cada interval (3-5s):
  _alarmBurstGarreo/Ais/Grounding → _playSirenSweep / _playTone / _playFallingTone
  _speakAlarm(kind) → AudioBufferSourceNode (OGG) o new Audio() o speechSynthesis
```

**`_audioEnabled` per-tab** (booleano del visor, separado de Pi):
```
true:  loops corriendo, oscillators producen sonido (si AudioContext running)
false: _stopAllAlarmLoops, _stopAllAlarmVoiceLoops, _stopKeepAlive
```

**Cómo se silencia un visor**:
```
USER tap 🔊 → 🔇 en el visor
  │
  ▼
toggleAudioEnable()
  │
  ├─ _audioEnabled = false (per-tab)
  ├─ _stopAllAlarmLoops()                ── mata timers periódicos
  ├─ _stopAllAlarmVoiceLoops()           ── mata speechSynthesis
  ├─ _stopKeepAlive()                    ── deja morir el AudioContext keep-alive
  └─ POST /audio-enable {enabled:false}  ── sincroniza ICONO en otros visores
```

**Cross-device icon sync** (lo que sí funciona):
```
Visor A tap mute
  │
  ▼
POST /audio-enable {enabled:false}
  │
  ▼
backend: anchorWatch.audioEnabled = false → broadcastSSE("audio")
  │
  ▼
Visor B (y todos los demás): processPollData ve s.audioEnabled=false
  ├─ _audioEnabled = false
  ├─ _stopAllAlarmLoops, etc.
  └─ _updateAudioBtnUI → icono 🔇
```

⚠ **No propaga unmute remoto** entre tabs sin gesture: si visor B nunca tape'ó,
recibe s.audioEnabled=true pero su AudioContext está suspended → no sonido
local. Solución: usuario debe tape'ar en cada tab al menos una vez.

## Disyunciones críticas

```
┌─────────────────────────────────────────────────────────────┐
│ ¿Qué silencia QUÉ?                                          │
├─────────────────────────────────────────────────────────────┤
│ Acción                          │ Pi sink  │ Visor local   │
├─────────────────────────────────┼──────────┼───────────────┤
│ Tap 🔇 en este visor            │   no     │     sí        │
│ Tap 🔇 en otro visor (SSE)      │   no     │  sí (sync)    │
│ Botón snooze 💤 (5 min)         │   sí     │  sí (loops)   │
│ POST /silence-alarm {kind}      │   sí     │  no directo*  │
│ Levar ancla (/lift)             │   sí     │  sí           │
│ Toggle alarma garreo OFF        │   sí     │  sí           │
│ ACK individual AIS              │ para MMSI│ para MMSI     │
│ Cerrar tab del navegador        │   no     │  sí (tab)     │
│ Apagar monitor / navegador      │   no     │  N/A          │
│ sudo pkill -KILL paplay         │   sí 🚨  │  no           │
│ sudo systemctl restart signalk  │   sí (15s│  reconecta SSE│
│                                 │   gap)   │               │
└─────────────────────────────────┴──────────┴───────────────┘

* El SSE periódico llega ~3s después con anchorWatch.* actualizado, los visores
  se enteran indirectamente.
```

## State persistido

```
ihmCache (sqlite, ~/.signalk/plugin-config-data/signalk-mareas-ihm/):
  · anchorWatch          ── {anchored, audioEnabled, garreoAlarmEnabled, ...}
  · alarmSnoozeUntil     ── timestamp ms hasta cuándo está snooze
  · alarmaConfig         ── grounding/sonda config
  · groundingRisk        ── último riesgo de varada

Estado en memoria solo (no persiste):
  · _garreoSilencedUntil ── timestamp ms (silence-alarm)
  · _aisSilencedUntil    ── timestamp ms (silence-alarm)
  · _piAlarmTimers       ── timers activos del state machine
  · _piActivePlay        ── procs paplay/espeak en curso
  · _piBurstTimers       ── setTimeouts encolados del burst
```

## Conocido / WONTFIX

- **B-01 (mute cross-device global Pi)**: WONTFIX, Rev191-201 lo intentaron,
  incidente con alarma atascada → Rev202 neutralizado. El icono sí
  sincroniza; el sonido Pi es independiente y se silencia por sus canales
  legítimos (snooze, lift, alarmas-off).
- **Browser autoplay rule**: tabs sin gesture no pueden producir audio aunque
  `_audioEnabled=true`. Inevitable per browser spec. Usuario debe tape'ar
  en cada tab al menos una vez para "primarla".
- **Audio hardware ceiling Pi**: USB DAC Jieli peak-limited (ver
  `project_audio_hardware_ceiling`). No iterar más en software gain.
- **Doble voz Windows (OGG + TTS)**: si OGG no se reproduce a tiempo, fallback
  TTS dispara → ambos suenan. Pendiente B-16/B-17 (Sprint 3 i18n).
