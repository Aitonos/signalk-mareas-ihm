# Gemini prompt — ACK/Snooze/AlarmCleared no cortan la voz OGG instantáneamente

## Contexto

SignalK plugin `signalk-mareas-ihm`. UI mobile en `public/mobile.html`. Las
alarmas (garreo / AIS colisión / grounding) suenan combinando un **beep
sintetizado** (Web Audio oscillators) y un **OGG hablado** ("Atención.
Posible colisión") via tres caminos en cascada:

1. `AudioContext.createBufferSource()` con el OGG decodificado (preferido).
2. `new Audio(url).play()` si el BufferSource falla.
3. `speechSynthesis.speak(...)` como último recurso.

Quiero que al pulsar ACK (`ackAisTarget`), Snooze (`m_toggleSnooze`) o
cuando la alarma se desactiva por el backend (target out of zone), la voz
en curso se corte **al instante**, no que termine de pronunciar la frase
(3-4 segundos restantes). Hoy NO se corta — el OGG sigue hasta el final.

## Lo que ya he intentado (Rev300)

Añadí dos trackers globales:

```js
var _currentVoiceSrc=null;     // AudioBufferSourceNode actualmente en marcha
var _currentVoiceAudio=null;   // <audio> elemento creado por new Audio()

function _stopCurrentVoicePlayback(){
  try{ if(_currentVoiceSrc){ _currentVoiceSrc.stop(0); _currentVoiceSrc.disconnect&&_currentVoiceSrc.disconnect(); } }catch(_){}
  _currentVoiceSrc=null;
  try{ if(_currentVoiceAudio){ _currentVoiceAudio.pause(); _currentVoiceAudio.src=''; } }catch(_){}
  _currentVoiceAudio=null;
  try{ window.speechSynthesis && window.speechSynthesis.cancel(); }catch(_){}
}
```

En `_speakAlarm(kind)`, asigno `_currentVoiceSrc = src` ANTES de
`src.start(0)`:

```js
_ensureVoiceBuffer(kind,lng).then(function(audioBuf){
  try{
    var src=ctx.createBufferSource();
    src.buffer=audioBuf;
    var gain=ctx.createGain();
    gain.gain.value=1.0;
    src.connect(gain);gain.connect(ctx.destination);
    _currentVoiceSrc=src;
    src.onended=function(){ if(_currentVoiceSrc===src) _currentVoiceSrc=null; };
    src.start(0);
  }catch(e){ tryAudioElement(); }
}).catch(function(e){ tryAudioElement(); });
```

Y en `_stopAlarmVoiceLoop(kind)` llamo `_stopCurrentVoicePlayback()`:

```js
function _stopAlarmVoiceLoop(kind){
  if(_alarmVoiceTimers[kind]){
    if(_alarmVoiceTimerKinds[kind]==='pre') clearTimeout(_alarmVoiceTimers[kind]);
    else clearInterval(_alarmVoiceTimers[kind]);
    delete _alarmVoiceTimers[kind];
    delete _alarmVoiceTimerKinds[kind];
  }
  _stopCurrentVoicePlayback();
}
```

`ackAisTarget(mmsi)` y `m_toggleSnooze()` llaman a `_stopAlarmVoiceLoop('ais')`.

## El usuario reporta

> "Ni ACK; Ni SNOOZE NI ALARMA CORTAN instantáneamente la voz."

La voz sigue sonando 2-4 segundos hasta acabar la frase. Mi código DEBERÍA
cortar `src.stop(0)` que debería detener la reproducción inmediatamente
según la especificación de Web Audio.

## Mis hipótesis

### Hipótesis 1 — race condition asíncrona

`_speakAlarm` llama a `_ensureVoiceBuffer().then(...)` que decodifica el OGG.
Cuando se llama `_stopAlarmVoiceLoop` ANTES de que el `.then()` se resuelva,
`_currentVoiceSrc` aún es `null`. Después el `.then()` resuelve, crea el src,
hace `src.start()`, y la voz suena pese a haber pedido stop.

¿Cómo lo solucionarías?

### Hipótesis 2 — múltiples instancias en simultáneo

Si `_speakAlarm` se llama dos veces (e.g. por dos kinds distintos: ais +
grounding a la vez), `_currentVoiceSrc` se sobreescribe y la primera
`BufferSource` queda sonando sin referencia para pararla.

### Hipótesis 3 — el HTMLAudio fallback no para

Para móviles donde AudioContext requiere gesto del usuario y a veces falla,
cae a `new Audio(url).play()`. Mi código guarda `_currentVoiceAudio = a`
ANTES de `a.play()` (que devuelve una Promise). Si el usuario pulsa ACK
durante la Promise pending, mi `_stopCurrentVoicePlayback` llama `a.pause()`
ANTES de que `play()` haya empezado de verdad. Algunos navegadores ignoran
`pause()` previo a `play()` resuelto.

### Hipótesis 4 — backend re-emite y re-arma

Cuando ACK se hace, backend POST `/anchor-watch/ais-ack`. El backend procesa,
pero antes de procesar puede que envíe otro SSE con estado de alarma activo
todavía. El frontend recibe el SSE, ve `aisShouldSound = true`,
llama `setAlarmActive('ais', true)`, que arranca `_startAlarmVoiceLoop` (mi
delay de 30s o un `_speakAlarm` instantáneo según rama). Resultado: justo
después de mi stop, se re-arranca otra ronda.

## Lo que necesito

1. **Para la hipótesis 1**: ¿cuál es la forma canónica de **cancelar una
   reproducción Web Audio que está en proceso de decodificación + start
   pendiente**? ¿Una flag tipo `_voiceCancelGen` que se compara entre el
   start del decode y el src.start()? Muéstrame el patrón exacto.

2. **Para la hipótesis 2**: ¿debería mantener un `Map<kind, src>` en lugar
   de un único `_currentVoiceSrc` para no perder referencias entre kinds?

3. **Para la hipótesis 3**: ¿cómo cancelar de forma segura un `new
   Audio()` que aún no resolvió su play()? Veo varias recomendaciones
   incluyendo `a.muted = true; a.src = ''; a.load();` — ¿cuál es la
   correcta?

4. **Para la hipótesis 4**: ¿debo añadir un "supresor" local que ignore
   onsets durante un grace period tras un ACK? ¿Es esa la práctica
   estándar en visores marítimos?

5. ¿Hay alguna **mejor arquitectura** para esto — un único pipeline de
   reproducción con identificador único por instancia, control central de
   cancel, sin que el código de aplicación tenga que recordar parar tres
   cosas en orden?

## Snippet completo

`public/mobile.html` líneas 3658-3810 (funciones `_speakAlarm`,
`_startAlarmVoiceLoop`, `_stopAlarmVoiceLoop`,
`_stopCurrentVoicePlayback`). El AudioContext se crea en
`_initAudio()` por gesto de usuario (al pulsar 🔊 mute toggle).

## Repro

1. En el barco con AIS targets reales (o simular en backend) entrar en
   "borneo zone" con anchored=true + ais alarm enabled.
2. Modal `ais-pop` aparece y la voz "Atención. Posible colisión." empieza
   a sonar (tras 30s grace en Rev300).
3. Pulsar ACK en el primer segundo de la frase.
4. Esperar: voz se corta a media palabra.
5. Observado: voz sigue hasta terminar la frase entera.

## Qué espero como respuesta

- Diagnóstico de cuál de mis hipótesis 1-4 es la correcta (o si es otra).
- Código drop-in para `_speakAlarm` + `_stopCurrentVoicePlayback` que
  resuelva el corte real instantáneo.
- Si propones una rearquitectura, dame el código completo en JS (vanilla,
  no TypeScript) listo para pegar en `mobile.html`.

Gracias.
