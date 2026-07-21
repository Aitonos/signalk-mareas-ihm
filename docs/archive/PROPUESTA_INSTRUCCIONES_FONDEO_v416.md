# Propuesta de texto — Modal de Instrucciones (Rev416 → Rev417) v2

Documento para revisión del usuario ANTES de aplicar al `app/views/TidesView.tsx`.
Tras tu OK lo aplico a ES y EN del modal.

> **Versión 2** corrige el orden de la maniobra: el ancla se marca en el momento físico de soltarla (no al final del tensado), y la posición operativa real del ancla es un **círculo (swing circle / círculo de borneo)**, no un punto.

---

## 1. Eliminación

Se elimina la sub-sección redundante:

> 🗺️ **Visor cartográfico del fondeo**
> Toda la operativa del gestor se controla desde un mismo visor cartográfico al que se accede desde el botón naranja VISOR DE FONDEO de la barra principal, o directamente en `/signalk-mareas-ihm/visorfondeo`. En una sola pantalla muestra la posición del barco, el ancla echada, los círculos de borneo y alarma, el abrigo direccional, la sonda, el viento real y previsto, los AIS cercanos y la curva de marea en tiempo real.

Las otras 5 sub-secciones de Rev416 (🎯 Botones, 🌬️ Sensores, 🔊 Audio, 🗺️ Capas, ⚓ Operativa) se mantienen.

---

## 2. Sub-sección NUEVA dentro del GESTOR

Va justo después de "⚓ Operativa de fondeo en el mapa", antes del párrafo puente hacia MAREAS.

### ES

#### ⛵ Cómo fondear bien (técnica náutica recomendada)

El visor no fondea por ti — te ayuda a vigilar el fondeo. Para que las alarmas sean fiables hay que **fondear bien primero**. Maniobra clásica:

1. **Aproximación lenta contra el viento o la corriente dominante** (la que más afecte al barco). Acércate al punto elegido al ralentí.
2. **Parada total sobre el punto.** SOG = 0, proa al viento. El barco empezará a derivar lentamente hacia atrás.
3. **Echa el ancla** ↓ en ese instante y **pulsa FONDEAR AQUÍ inmediatamente.** El icono ⚓ del mapa queda fijado donde el GPS marcaba el barco en el momento de soltar el ancla.
4. **Larga cadena acompañando la deriva del barco hacia popa** (motor en muerto o un toque muy suave atrás si hace falta para tender la cadena horizontal). La cadena tiene que quedar extendida en línea sobre el fondo, no apilada encima del ancla.
5. **Lasca el scope adecuado:** 3.5:1 (provisional/espera), 5:1 (normal, recomendado), 8:1 (mal tiempo o noche). El visor te lo calcula desde la sonda actual + marea prevista + altura roldana.
6. **Tensa con motor atrás de forma progresiva** hasta dejar la cadena tensa.
7. **Comprueba el clavado:** mantén motor atrás unos segundos a régimen moderado-fuerte. Si el barco se queda inmóvil → ancla clavada. Si sigue desplazándose hacia popa → garreo: leva y repite la maniobra desde 1.
8. **Activa Vigilancia del ancla** y **ajusta el anillo rojo de alarma** un poco más allá de la popa del barco con cadena tensa. Eso te da margen para borneos sin falsos positivos.
9. Espera unos minutos antes de bajarte a tierra — confirma con el track GPS que el barco bornea estable alrededor del ancla.

#### ⚓ La posición real del ancla es un círculo de borneo, no un punto

El icono ⚓ del mapa marca el GPS del barco en el momento de echar el ancla — es una **buena aproximación**, pero el ancla puede haberse desplazado un poco al clavarse, o haber tocado fondo un par de metros delante de la roldana. Por eso en náutica nunca se habla de "punto del ancla" sino de **círculo de borneo (swing circle)**: la circunferencia alrededor del ancla por la que oscila el barco con la marea, el viento y la corriente.

En el visor:
- El **círculo azul** = swing circle / círculo de borneo máximo teórico, centrado en el icono ⚓, calculado por catenaria con la sonda actual + marea prevista + altura de la roldana.
- El **círculo rojo** = alarma. Mayor que el azul porque añade un margen configurable + la eslora del barco. Si el barco sale del rojo → garreo.
- El "extra" entre azul y rojo es tu colchón para borneos algo más amplios de lo previsto (rachas, mareas vivas, oleaje) sin disparar alarmas falsas.

La regla operativa: lo importante no es que el ⚓ esté en el centímetro exacto, sino que el **círculo azul englobe todos los borneos reales del barco** durante la estancia. Si ves que el barco roza la frontera azul, lasca más cadena (más scope = más radio).

#### 🔎 Si te olvidaste de pulsar FONDEAR AQUÍ en el momento exacto

No pasa nada — puedes corregirlo a posteriori:

- **Por el track GPS:** el track muestra todo el recorrido del barco. Justo después de fondear y dar atrás, dibuja una curva que se tensa hacia popa. El punto donde se inicia esa tensión está muy cerca de donde tocó fondo el ancla.
- **Por inferencia con la cadena lascada:** con la cadena tensa, el ancla queda aproximadamente a la longitud horizontal de la cadena por delante de la proa, en el rumbo de la línea de fondeo. Marca ese punto en el mapa.
- **Arrastra el icono ⚓** sobre el mapa al punto correcto (mantén pulsado y mueve).
- O introduce coordenadas exactas a mano desde el panel de fondeo.

Al mover el ancla, los círculos azul y rojo se recentran instantáneamente.

#### 🔧 Si vuelves a tensar o largas más cadena durante el fondeo

Si entra mal tiempo o marea más viva, larga más cadena y vuelve a tensar marcha atrás. Después abre el panel **⚓ Calc. Fondeo** y actualiza la longitud de cadena → el círculo azul se ajustará al nuevo radio de borneo. Si el círculo rojo te queda corto, súbelo con el slider del panel de alarmas.

---

### EN

#### ⛵ How to anchor properly (recommended seamanship)

The viewer does not anchor for you — it helps you watch the anchorage. For the alarms to be reliable you have to **anchor properly first**. Classic manoeuvre:

1. **Slow approach into the dominant wind or current** (whichever affects the boat most). Drift into the chosen spot at idle.
2. **Full stop on the spot.** SOG = 0, bow into the wind. The boat will start drifting slowly astern.
3. **Drop the anchor** ↓ at that instant and **press DROP ANCHOR immediately.** The ⚓ icon on the map gets fixed where the boat's GPS was at the moment of release.
4. **Pay out chain following the boat's astern drift** (engine in neutral or a very gentle reverse touch if needed to lay the chain flat). The chain must extend in a line on the seabed, never piled on top of the anchor.
5. **Pay out the proper scope:** 3.5:1 (provisional/waiting), 5:1 (normal, recommended), 8:1 (bad weather or overnight). The viewer computes it from current depth + tide forecast + bow roller height.
6. **Tension with reverse engine progressively** until the chain is taut.
7. **Check the set:** keep reverse a few seconds at moderate-to-strong RPM. If the boat stays still → anchor set. If it keeps moving aft → dragging: lift and start over from 1.
8. **Enable Anchor Watch** and **adjust the red alarm ring** a bit past the boat's stern at maximum tension. That margin avoids false drag alarms.
9. Wait a few minutes before going ashore — confirm with the GPS track that the boat swings steadily around the anchor.

#### ⚓ The real anchor position is a swing circle, not a point

The ⚓ icon on the map marks the boat's GPS at the moment of releasing the anchor — a **good approximation**, but the anchor may have shifted slightly while setting or touched bottom a couple of metres ahead of the bow roller. That is why seamanship never talks about "the anchor point" but about the **swing circle**: the circumference around the anchor described by the boat as it swings with tide, wind and current.

In the viewer:
- The **blue circle** = swing circle / maximum theoretical swing radius, centred on the ⚓ icon, computed by catenary from current depth + tide forecast + bow roller height.
- The **red circle** = alarm. Larger than blue because it adds a configurable margin + the boat's LOA. If the boat exits the red → drag alarm.
- The "extra" between blue and red is your cushion for slightly wider swings than predicted (gusts, spring tides, swell) without false alarms.

Operative rule: what matters is not that the ⚓ icon is on the exact centimetre, but that the **blue circle envelops every real swing of the boat** during the stay. If the boat brushes the blue boundary, pay out more chain (more scope = more radius).

#### 🔎 If you forgot to press DROP ANCHOR at the exact moment

No problem — you can fix it afterwards:

- **From the GPS track:** the track shows the full boat path. Right after anchoring and reversing, it draws a curve that tightens sternward. The point where that tension begins is very close to where the anchor hit bottom.
- **By inferring from paid-out chain:** with the chain taut, the anchor sits roughly the horizontal chain length ahead of the bow, along the rode bearing. Mark that point on the map.
- **Drag the ⚓ icon** on the map to the correct point (long-press and move).
- Or enter exact coordinates manually from the anchor panel.

When you move the anchor, the blue and red circles instantly recentre.

#### 🔧 Re-tensioning or paying out more chain mid-anchor

If bad weather or a spring tide is coming, let more chain out and re-tension with reverse. Then open **⚓ Anchor Calc** and update chain length → the blue circle will adjust to the new swing radius. If the red ring is now too tight, raise it with the slider on the alarm panel.

---

## 3. Bloque FAQ ampliado

Las preguntas actuales se mantienen. Se AÑADEN al final del bloque ❓ Preguntas frecuentes:

### ES — añadidas al FAQ

- **¿Qué plugins de Signal K conviene tener instalados?**
  El imprescindible es uno que provea **posición GPS** (`navigation.position`) — cualquier driver NMEA0183/NMEA2000 sirve. Muy recomendados:
  - **[signalk-derived-data](https://www.npmjs.com/package/signalk-derived-data)** — calcula la posición del Sol (necesario para amaneceres/puestas en el visor), variación magnética, etc.
  - Para **AIS**: cualquier conexión NMEA0183/NMEA2000 con receptor AIS. El servidor lo procesa.
  - Para **sonda, viento real, viento aparente**: el driver del transductor correspondiente. El plugin lee directamente los paths estándar SK.
  - **Olas/IMU** opcional: si tienes pypilot o IMU instalado, sus datos de `navigation.attitude` y `environment.outside.acceleration` activan el modo "ola medida a bordo".
- **¿Qué tengo que configurar en Signal K antes de fondear?**
  Define las **dimensiones del barco** en *Signal K → Server → Settings → Vessel*:
  - **Draft** (calado) — alarma de varada y calado efectivo +15%.
  - **Length / LOA** (eslora) — margen del anillo de alarma de garreo.
  - **Beam** (manga) — opcional pero útil para el dibujo del barco a escala.
  Si tienes roldana de proa por encima del agua, el visor te pregunta su **altura** en el panel de fondeo (se guarda para el cálculo de catenaria).
- **¿Dónde está exactamente el ancla en el mapa?**
  El icono ⚓ marca el punto donde estaba el GPS del barco cuando pulsaste FONDEAR AQUÍ. La posición REAL del ancla en el fondo está dentro del **círculo de borneo (swing circle)** dibujado en azul. Lo que importa operativamente es que el círculo azul englobe todos los borneos reales del barco.
- **¿Para qué sirve el anillo rojo de alarma si ya tengo el azul de borneo?**
  El **azul** es el círculo de borneo máximo teórico (catenaria + marea). El **rojo** añade un margen + la eslora del barco — es la zona de alarma. Si el barco sale del rojo → garreo. El "extra" entre azul y rojo te protege de falsos positivos por rachas, mareas vivas o pequeños deslizamientos del ancla que aún no son garreo real.
- **¿Puedo mover la posición del ancla si la marqué mal?**
  Sí. Arrastra el icono ⚓ sobre el mapa, o introduce coordenadas a mano desde el panel de fondeo. Los círculos de borneo y alarma se recentran al instante.
- **¿Y si quiero cambiar el scope o la cadena en mitad del fondeo?**
  Abre el panel ⚓ Calc. Fondeo. Cambia modo (provisional/normal/seguro) o longitud de cadena. El círculo azul se actualiza al nuevo borneo. Ajusta el rojo con el slider si necesitas más margen.
- **¿Funciona la alarma de garreo si cierro el navegador o apago el móvil?**
  Sí — la vigilancia corre en el backend del plugin (servidor Signal K). El sonido suena en el Pi del barco aunque el visor esté cerrado. Las notificaciones SK también siguen activas. Los dispositivos cliente conectados también suenan en paralelo si su pestaña está abierta.

### EN — added to FAQ

- **Which Signal K plugins should I have installed?**
  Essential: anything providing **GPS position** (`navigation.position`) — any NMEA0183/NMEA2000 driver does. Strongly recommended:
  - **[signalk-derived-data](https://www.npmjs.com/package/signalk-derived-data)** — Sun position (needed for sunrise/sunset), magnetic variation, etc.
  - **AIS**: any NMEA0183/NMEA2000 connection with AIS receiver. The server processes it.
  - **Depth, real wind, apparent wind**: the transducer driver. The plugin reads standard SK paths directly.
  - Optional **waves/IMU**: pypilot or IMU `navigation.attitude` and `environment.outside.acceleration` enable on-board wave mode.
- **What do I need to configure in Signal K before anchoring?**
  Set **boat dimensions** in *Signal K → Server → Settings → Vessel*:
  - **Draft** — grounding alarm and effective draft +15%.
  - **Length / LOA** — drag-alarm ring margin.
  - **Beam** — optional but useful for to-scale boat drawing.
  Above-water bow roller: the viewer asks for its **height** in the anchor panel (saved for catenary).
- **Where exactly is the anchor on the map?**
  The ⚓ icon marks the GPS position of the boat at the moment you pressed DROP ANCHOR. The REAL anchor location on the seabed lies within the **swing circle** drawn in blue. What matters operatively is that the blue circle envelops every real boat swing.
- **What is the red alarm ring for if I already have the blue swing ring?**
  The **blue** is the maximum theoretical swing circle (catenary + tide). The **red** adds a margin + boat LOA — the alarm zone. If the boat exits the red → drag alarm. The "extra" between blue and red protects from false positives due to gusts, spring tides or small anchor slips that are not yet real dragging.
- **Can I move the anchor position if I marked it wrong?**
  Yes. Drag the ⚓ icon on the map, or enter coordinates manually from the anchor panel. Swing and alarm circles recentre instantly.
- **What if I want to change the scope or chain mid-anchor?**
  Open ⚓ Anchor Calc. Switch mode (provisional/normal/safe) or change chain length. The blue circle updates to the new swing. Adjust the red with the slider if you need more margin.
- **Does the drag alarm work if I close the browser or turn off my phone?**
  Yes — the watch runs in the plugin's backend (Signal K server). Sound plays on the boat's Pi even with the viewer closed. SK notifications also stay active. Connected client devices ring in parallel if their tab is open.

---

## Resumen de cambios respecto a v1

| | v1 (incorrecto) | v2 (corregido) |
|---|---|---|
| Momento de pulsar FONDEAR AQUÍ | Al final del tensado | En el instante físico de echar el ancla |
| Posición del ancla | Punto exacto donde está el ⚓ | **Círculo de borneo (swing circle)** centrado aproximadamente en el ⚓ |
| Maniobra | Echar → atrás → lascar → tensar → marcar | Parar → echar y marcar → largar cadena → lascar scope → tensar → comprobar clavado |

## Pregunta pendiente

Has mencionado que el anillo tiene un **nombre técnico** concreto. Estoy usando **círculo de borneo (swing circle)** — si tienes en mente otro término más correcto o más usado en tu entorno (p.ej. *círculo de fondeo*, *yaw circle*, *watch circle*, *radio de seguridad*…), dímelo y lo sustituyo en todo el doc antes de meterlo al modal.
