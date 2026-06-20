# Q&A — decisiones del usuario (consolidadas)

Documento fuente de verdad sobre decisiones de scope y arquitectura. Si una sesión nueva tiene duda, **se consulta aquí antes** de actuar.

Fecha de las respuestas: 2026-05-29.

## Bloque scope/arquitectura

| ID | Pregunta | Respuesta |
|---|---|---|
| Q-A | Cartas: ¿sidebar o hamburger? | **OK**, dejarlo como está (sidebar) |
| Q-B | Datos SOG/DEPTH | **OK**, ya bien, no tocar |
| Q-N | Backend = source of truth, ¿hasta qué nivel? | **A TODOS LOS NIVELES**. Backend difunde a todos los frontends para estar coordinados. Refactor de `_aisAckedMMSIs`, `_audioEnabled`, `_lang`, mute → backend authoritative. |
| Q-O | Mobile vs desktop landscape | **Mobile va bien también en desktop**. No hacer rama desktop separada. |
| Q-AQ | Multi-barco | **N/A** — un solo barco del usuario |

## Bloque AIS y multi-device

| ID | Pregunta | Respuesta |
|---|---|---|
| Q-R | AIS schema viejo, ¿qué falta? | **RECUPERAR TODO el motor AIS antiguo** (pre-mobile): backend, ventana de targets, visualización de cada target, status bar, ACK, anillos. |
| Q-S | Cross-device fondeo cancel | **Quedan mensajes fantasma en TODOS los dispositivos**. Causa: broadcast mal hecho, cada user procesa los datos como quiere. → Sprint 1 fix backend broadcast. |
| Q-T | Anillos no actualizan | A veces sí, a veces no. **Difícil de reproducir**. Investigación en Sprint 1. |

## Bloque alarmas y voces

| ID | Pregunta | Respuesta |
|---|---|---|
| Q-Q | Push móvil flujo | **Garreo** = sonido + vibración + banner (todo a la vez). **Posible colisión** = solo audio + vibración. |
| Q-U | Avisos fantasmas | Pendiente recoger 3-5 timestamps reales del usuario en operación |
| Q-V | Sonda errática | **OLVIDA** — ya arreglado |
| Q-AR | Voces TTS hombre/mujer | **OLVIDA** — ya bien |
| Q-AS | Histórico de eventos persistente | **SÍ**, incluir aparición/desaparición de targets AIS. Sección de debug interna que vea todo lo que hace el programa. → Sprint 6. |
| Q-AT | Botón "TEST ALARMA" | **Dejarlo como está** |

## Bloque idioma

| ID | Pregunta | Respuesta |
|---|---|---|
| Q-K | Audio QZ overboost 3-4 | **OLVIDA** — ya bien (hardware ceiling) |
| Lang per-device vs global | Cada user selecciona su idioma + hace polling al backend en su idioma | Lang ES PER-DEVICE local. Pi voces siguen `_currentLang` global. |
| Q-AC | Instrucciones expandidas — formato | **USAR LAS DE TIDESVIEW** tal cual (con buscador, aviso legal, créditos). Copy-paste a Mobile y luego actualizar info. NO inventar nuevo. |

## Bloque UI / visual

| ID | Pregunta | Respuesta |
|---|---|---|
| Q-G | Subir tamaño textos más | **EN MÓVIL se ve todo muy pequeño**. Seguir subiendo. "No sube" actualmente. → Sprint 4. |
| Q-H | Botones Atrás idénticos | **Sí — template CSS único** aplicado a todas las ventanas con su botón, título e icono. Está ya casi hecho. → Sprint 4. |
| Q-I | Desktop landscape fuentes | **OLVIDA** — ya bien |
| Q-J | Declutter + unificar | **OLVIDA** — completado |
| Q-AA | Modales | **Full screen** pero textos **solo izquierda no justificar ambos lados** |
| Q-AB | Declutter pantalla principal | **OLVIDA** — ya bien |
| Q-AD | Estilo Mareas referencia | Mareas (TidesView) **siempre se mostraba bien**, pero al integrarlo embebido **sale descentrado sin zoom adecuado para llenar pantalla**. Fix en TidesView embed. |
| Q-AJ | Botones flotantes | **OLVIDA** — solucionado |
| Q-AK | Zoom indicator | **OLVIDA** — quitado |
| Q-AG | Tema claro/oscuro | **Siempre dark** |

## Bloque funcionalidades

| ID | Pregunta | Respuesta |
|---|---|---|
| Q-C | Telegram UI | **PAUSA** |
| Q-D | Cálc Varada = Cálc Sonda | **OLVIDA** — me equivoqué, era cálculo de sonda, ya bien |
| Q-E | Cálc Fondeo dinámico | **Horizonte de fondeo arriba**. **No calcula nada, se queda en misma cifra**. **Textos en selector NO se ven (letra blanca sobre fondo blanco)**. → Sprint 2. |
| Q-L | Voces OGG distorsionadas | **OK** tras Restore |
| Q-M | Build con número | **OK** |
| Q-AE | Cálc Fondeo inputs auto-calc | **NO funciona**. → Sprint 2. |
| Q-AF | Predictive swing ring | **Siempre ON** |
| Q-AO | Build counter | **OK** |
| Q-AP | Compartir/exportar fondeo | **PAUSA** (buena idea) |
| Q-AU | Edit-in-place desde UI | **Sí, siempre que lo que haga el frontend modifique INMEDIATAMENTE el backend**. Eslora y calado: en SK design.* con **fallback a caja de datos en app**. |

## Bloque memoria proyecto

| ID | Pregunta | Respuesta |
|---|---|---|
| Q-X | IMU + pypilot phase 2 | **OLVIDA** — ya bien |
| Q-Y | USB routing / chart defaults / mobile audio | **OLVIDA** — ya bien |
| Q-Z | Wake lock | **Solo con alarma activa en Pi** OK. **Verificar en móvil/tablet** (Sprint 5). |
| Q-AM | Ad blocker leak | "No entiendo" — **descartar el tema** |
| Q-AN | No commercial refs | **QUITAR "Sonarchart"** y dejar solo "Batimetría" |

## Bloque histórico (todo descartado, no perder tiempo)

| ID | Pregunta | Respuesta |
|---|---|---|
| Q-F | q12 "no dejalo hasta abajo visible" | **OLVIDA** |
| Q-P | Q3 hasta Q11 macro | **OLVIDA** |
| Q-AI | Macro screenshots "Sigue subiendo textos" items | **OLVIDA** |
| Q-AH | Persona tone junior dev | **OLVIDA** |
| Q-AL | Offline / sin conexión | **OLVIDA** |

## Desambiguación de frases ambiguas

| Frase | Resolución |
|---|---|
| "q12, no dejalo hasta abajo visible" | **DESCARTAR** — ya está hecho |
| "haz pero no rompas" (AIS) | **Volver a usar todo el motor AIS** como lo teníamos antes de la versión Mobile |
| "como ya estaba" (Meteo Q6) | **DESCARTAR** |
| Meteo Q8 ejes | **OK**, horas en línea horizontal con **scroll horizontal**, datos en línea vertical en múltiples filas. **Exactamente lo que ya tenemos pero cambiando los ejes**. *(Es decir: rows=métricas, cols=horas, scroll-X para más horas. Layout Rev188 era el correcto. Rev190 transpose Y rompió esto — REVERTIR.)* |

## Status QA confirmado por usuario en Rev190

| Item | Status |
|---|---|
| Voces OGG restore | OK |
| Audio QZ 1-5 dB | OK |
| Sidebar y hamburger order | OK |
| Hamburger icono | OK |
| Snooze countdown UI / icono 💤 | OK |
| Info modal título + botones | OK |
| Strip Abrigo OLA portrait | OK |
| Sliders Info fondeo | OK |
| Hamburger aviso legal + versión | OK |
| Centrar zoom-fit | **A VECES NO** — Sprint 4 revisar |
| Cartas y capas texto grande | **SEGUIR AUMENTANDO** todas las letras |
| Donut/olas grande info-window | (sin comentario, asumido OK) |
| Preview en vivo slider | **NO funciona, da saltos** — Sprint 1 |
| Bolitas persisten | **NO funciona aún bien** — Sprint 1 |
| TidesView row2 | Bien **pero contenidos deben ir al hamburger**. Dejar solo botón Curvas. En Curvas, botón a Mareas. |
| Meteo transpose portrait | **NO está bien**. Sigue scroll vertical. **DEBE SER HORIZONTAL** (avanzar hora) **con mismo diseño**. Sprint 1 revertir a layout Rev188. |
| Caja hora seleccionada | **Previsión Abrigo ROTA**: la ventana solo ocupa la mitad. El **strip** debe scrollear, pero la **ventana todo el ancho**. → Sprint 1. |
| AIS ACK botón touch | A veces sale. **Vamos a volver al modelo anterior** — Sprint 1. |

## Decisión sobre infra y branding

| Item | Valor |
|---|---|
| Autor / NPM | Aitonos |
| Boat name | Tunatunes |
| Plugin publica a | NPM |
| Branches | Solo `main` |
| Colaboradores externos | No |
| Tema visual | Siempre dark |
| Mobile vs desktop | Mobile (que también va bien en desktop) |
