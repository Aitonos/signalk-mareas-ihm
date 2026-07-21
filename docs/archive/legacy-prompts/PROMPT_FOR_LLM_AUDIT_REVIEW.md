# Prompt para GPT-5 / Gemini Pro — Revisión cruzada de auditoría de seguridad

## Contexto

Soy mantenedor del plugin SignalK **`signalk-mareas-ihm`**, un asistente de fondeo para barcos recreativos que vigila:
- Garreo del ancla (drift)
- Riesgo de varada (grounding) por marea bajando
- Colisión AIS
- Meteo extremo
- Pérdida de GPS
- Estimación de olas IMU

Es **software de seguridad náutica** en el sentido amplio: si una alarma silencia, el usuario puede perder el barco.

He encontrado recientemente dos bugs graves que jamás deberían haber pasado QA:

1. La celda SONDA del bottom-bar **NUNCA disparaba alerta visual** porque comparaba `s.groundingAlarm.risk` cuando `s.groundingAlarm` era una STRING (no objeto). `.risk` siempre era `undefined` → falsy → "OK · sin riesgo de varada" mostrado siempre, aunque otros paneles gritaran "RIESGO DE VARADA".

2. El cálculo de grounding leía la sonda sin convertir de frame (belowKeel/belowSurface/belowTransducer mezclados con `effectiveDraft` que está en belowSurface). False positives o false negatives según qué publique la sonda del usuario.

3. El modal Cálculo Sonda usaba `risk` (criterio de alarma configurable) mientras el resto del UI usa `physicalRisk` (realidad). Incoherencia visible entre paneles.

He preparado una auditoría exhaustiva (`docs/AUDIT_CRITICAL_PATHS.md`) con hallazgos categorizados 🔴/🟠/🟡 cubriendo:
- Alarmas (garreo, varada, AIS, meteo, GPS)
- Lectura de datos multi-source
- Cálculos derivados (effectiveDraft, expectedMinDepth, predictiveSwing)
- Multi-device sync (R6 / Q-N)
- Persistencia y reinicio
- Edge cases (sin GPS, sin sonda, sin marea, sin IMU, network drop)
- Frontend ↔ Backend coherencia
- Validación de inputs

## Lo que te pido

### Q1 — Revisar lo que YO he encontrado
Lee `AUDIT_CRITICAL_PATHS.md` (o pega su contenido aquí) y dime:
- ¿Hay hallazgos mal categorizados? (¿algo 🟡 que debería ser 🔴?)
- ¿Hay fixes sugeridos que no son los más limpios? Sugiere alternativas.
- ¿Hay dependencias entre hallazgos que no he visto? (¿fixear A1 antes de A2 cambia el approach?)

### Q2 — Hallazgos que YO HE PASADO POR ALTO
**Esto es lo más importante**. Razona desde primeros principios sobre los failure modes de un plugin SK de seguridad náutica, pensando en:

- **Race conditions**: cambios concurrentes desde múltiples devices/handlers.
- **State drift**: backend reinicia pero clientes no se enteran.
- **Data drift**: SK paths cambian de tipo entre versiones SK.
- **Type confusion**: object/string/array/number ambigüedad en runtime.
- **Time/timezone bugs**: alarma de garreo basada en `Date.now()` cuando el reloj del Pi está desfasado.
- **Unit confusion**: m vs ft, kn vs m/s, °C vs °F, mbar vs inHg, rad vs deg.
- **Validation gaps**: endpoints PUT/POST que aceptan body sin validar.
- **Silent failures**: try/catch que tragan errores críticos sin log.
- **CSS/JS frontend bugs** que silencian alertas (ej. `display:none` por accidente).
- **Multi-frame physics**: sonda below keel vs surface, viento apparent vs true, heading magnetic vs true sin variación.

Genera una **lista nueva** de failure modes que crees que yo NO he detectado, con:
- Descripción
- Por qué es peligroso
- Cómo reproducirlo (si sabes)
- Fix sugerido

### Q3 — Top 10 acciones a tomar AHORA
Si fueras yo, con un usuario activo que reporta bugs, ¿qué 10 cosas harías HOY antes de cualquier otra cosa? Ordena por impacto × esfuerzo.

### Q4 — Tests unitarios mínimos
Para los paths críticos (sonda multi-frame, alarma garreo, expectedMinDepth, Doppler), ¿qué 10 tests unitarios añadirías para que un bug como el del bottom-bar JAMÁS pueda reaparecer? Dame los nombres y el caso de prueba en pseudocódigo.

### Q5 — Refactor estructural a medio plazo
- ¿Vale la pena migrar a tipos branded de TypeScript para frames de profundidad / unidades?
- ¿Vale la pena adoptar zod o similar para validación de I/O?
- ¿Hay un patrón arquitectónico (event sourcing, FSM para alarmas, etc.) que me ahorraría esta clase de bugs?

---

## Información técnica del proyecto

- **Stack**: TypeScript backend (Node.js, Express, SQLite), HTML/JS frontend monolítico (`mobile.html`), React para vista Mareas (`app/views/TidesView.tsx`).
- **Despliegue**: Raspberry Pi (OpenPlotter V4 + SignalK), portátil para development.
- **Distribución**: SignalK App Store via NPM (`signalk-mareas-ihm`).
- **LOC**: ~13k líneas mobile.html, ~10k líneas src/index.ts.
- **Tests**: mínimos, no cubren paths críticos.
- **Multi-device**: SSE para state delta cada ~3s; PUT handlers para acciones; ihmCache persistente entre restarts.

## Restricciones

- **No quiero rewrite total**. Cambios estructurales OK pero incrementales.
- **No quiero añadir dependencias pesadas** (zod es OK si justifica).
- **Cualquier cambio debe ser testeable** sin estar en el barco (a ser posible).

## Output esperado

Markdown estructurado, citable, con secciones Q1/Q2/Q3/Q4/Q5. Ejemplos concretos siempre que puedas (pseudocódigo, paths SK, mensajes log).

Gracias.
