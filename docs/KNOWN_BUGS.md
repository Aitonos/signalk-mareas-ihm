# BUGS ACTIVOS — fuente única de verdad para empezar Sprint 1

Status a 2026-05-29, tras Rev190. Cualquier bug aquí está **confirmado por el usuario en testing real**.

---

## CRÍTICOS (sprint 1)

### B-01 — Mute no actúa en backend
**Síntoma**: pulsar 🔊 → 🔇 no silencia las alarmas en otros devices ni en el propio Pi audio.
**Cita usuario**: *"tampoco va ahora el mute"* / *"sin que Snook o mute actue sobre el backend"*
**Hipótesis**: el mute es solo local del visor (`_audioEnabled`), no hay endpoint backend ni broadcast.
**Repro**: visor A pulsa 🔊→🔇. Visor B sigue oyendo alarma. Pi audio sigue.
**Fix esperado**: endpoint `POST /api/audio-enable {enabled}`, persiste en backend, broadcast SSE, todos los visores lo aplican.

### B-02 — Snooze no sincroniza con backend
**Síntoma**: snooze en device A no muta audio en device B ni stop Pi audio inmediato.
**Cita**: *"Snooze no se sincronixa, debe ser que no va por backend?"*
**Estado actual Rev188v2**: m_toggleSnooze llama a `/api/snooze` + `/silence-alarm` (garreo, ais). **NO verificado** que el state:normal SK delta llegue al visor remoto y que el Pi audio se calle inmediato.
**Fix esperado**:
- Verificar `emitNotificationClear()` realmente broadcasta a todos los visores
- Visor B debe ver `_snoozedUntilMs` actualizado y mutar audio local
- Pi audio (paplay actual) debe matar el proceso, no esperar fin del burst

### B-03 — AIS ACK no funciona / modelo viejo no restaurado
**Síntoma**: ACK desde un visor no se refleja en otros. Botón a veces no aparece. Usuario quiere el motor AIS pre-mobile completo.
**Cita**: *"sin los AIS como siempre sin poder hacer ACK"* / *"AIS, sigue version mala"* / *"Vuelve a usar todo el motor de mostrar AIS como lo teníamos antes de la versión Mobile"*
**Decisión usuario (Q-R)**: **RECUPERAR TODO el motor AIS antiguo** (pre-mobile): backend, ventana de targets, visualización individual.
**Repro**: target dentro del borneo. Tap → popup. Pulsar ACK. Otro visor sigue viendo el target en alarma.
**Fix esperado**: 
- Backend authoritative en `aisAckedMMSIs`
- Broadcast SSE post-ACK a todos
- Visores B reciben SSE y deshacen el badge de alarma
- UI: status bar + popup individual + anillos persistentes + botón Quitar ACK (todo el schema viejo)

### B-04 — Cancelar fondeo no propaga a otros devices
**Síntoma**: lift en device A → device B sigue con "possible collision" o ancla en mapa.
**Cita**: *"cancelo el fondeo en un dispositivo y otro sigue aun con possible colision"*
**Cita arquitectónica**: *"Se quedan mensajes fantasma en todos los dispositivos, eso es porque el broadcast se hace mal y cada user recibe los datos y los procesa según le de la gana"*
**Fix esperado**: 
- `POST /api/anchor-watch/lift` debe broadcast SSE 'lift' Y limpiar `_lastAisNotifSig` y `aisAckedMMSIs` Y emit state:normal de notifications.aisAnchorAlarm + anchorDrag + grounding
- Visor B en SSE 'lift' debe limpiar UI: quitar ancla del mapa, borrar alerts AIS, reset radius circles, cerrar popup AIS si abierto

### B-05 — "Ancla fondeada" voz fantasma en tablet (sin echar)
**Síntoma**: tablet anuncia "Ancla fondeada" sin que el usuario haya pulsado Echar.
**Cita**: *"en la tablet me ha dicho ancla fondeada (sin estar echada)"*
**Estado Rev188+v2**: dedupe 30s + guard `_prevAnch !== undefined`. **No suficiente**.
**Hipótesis**: la primera SSE tras carga de página trae `anch:true` y `_prevAnch` se queda en false (initialState), entonces se interpreta como transición.
**Fix definitivo esperado**:
- Backend solo dispara voz drop si el endpoint `/drop` fue llamado en los últimos N segundos
- Frontend solo dispara voz si tiene confirmación de un drop "fresco" via SSE event explícito 'drop', no por diff de state
- Request-ID en endpoint /drop, propagado en SSE event, dedupe por request-id

### B-06 — Avisos fantasmas (alarmas sin causa)
**Síntoma**: alarmas saltan sin causa.
**Cita**: *"seguimos con los avisos fantasmas"*
**Datos pendientes del usuario**: 3-5 timestamps reales + device + tipo de aviso.
**Fix esperado**: instrumentar logs antes de fix; pedir al usuario datos cuando ocurra.

### B-07 — Anillos no actualizan ("a veces sí, a veces no")
**Síntoma**: tras mover bolita o slider, el círculo del mapa no actualiza.
**Cita**: *"los anillos que no actualizan (a veces si)"*
**Estado Rev190**: fix de `swingRadiusOverride` prioridad. **No suficiente**.
**Hipótesis**: race condition entre state poll + SSE updates.
**Fix esperado**: idempotent updates en `updC()`, log de cuándo no actualiza.

### B-08 — Preview slider modal da saltos
**Síntoma**: arrastrando slider modal cadena/alarma, el círculo da saltos en lugar de moverse continuo.
**Cita Rev190 QA**: *"No funciona bien da saltos"*
**Estado Rev190**: añadí `m_modalChainSlider` con preview, pero la fórmula `ratio = swMax/chainDep` se recalcula entre frames y puede dar inconsistencias.
**Fix esperado**: preview directo sin depender de chainDep ratio; usar `requestAnimationFrame`.

### B-09 — Bolitas drag no persiste todavía bien
**Síntoma**: a veces drag de bolita en mapa se pierde tras un rato.
**Cita Rev190 QA**: *"no funciona aun bien"*
**Estado Rev190**: cambié prioridad a `s.swingRadiusOverride`. **Sigue fallando intermitente**.
**Hipótesis**: SSE event de calc puede recalcular y pisar el override.
**Fix esperado**: backend NO debe pisar swingRadiusOverride en evaluateAnchorWatch.

---

## ALTA (sprint 1 — UI/UX)

### B-10 — Meteo transpose ROTO: scroll vertical en lugar de horizontal
**Síntoma**: tras Rev190 transpose, las horas avanzan con scroll vertical en lugar de horizontal.
**Cita Rev190 QA**: *"NO esta bien, seguimos teniendo scroll vertical cuando al cambiar los ejes solo avanzamos la hora, pero con el mismo diseño"*
**Decisión usuario (resoluciones desambiguar)**: horas en línea horizontal con **scroll horizontal**, datos en filas verticales múltiples. **Exactamente Rev188 era el layout bueno** (rows=métricas, cols=horas, scroll-X).
**Fix**: **REVERTIR `m_transposeMeteoTable()` de Rev190**. Layout final: rows=métricas, cols=horas, scroll-X.

### B-11 — Previsión Abrigo ventana solo ocupa la mitad
**Síntoma**: la ventana del popup Abrigo solo ocupa la mitad del ancho. El strip debería scrollear pero la ventana completa todo el ancho.
**Cita Rev190 QA**: *"Prevision abrigo esta roto porque la ventana solo ocupa la mitad, es el strip lo que debe hacer scroll pero la ventana todo el ancho"*
**Fix**: popup-box width 100vw, strip horas scroll-X interno, evitar break en mitad.

### B-12 — TidesView embebido descentrado, sin zoom adecuado
**Síntoma**: TidesView dentro del visor mobile sale descentrado, sin llenar pantalla.
**Cita Q-AD**: *"Mareas siempre se mostraba bien, ahora al integrarlo se carga mal, descentrado sin el zoom adecuado para llenar la pantalla"*
**Fix Rev190 status**: header iOS de 64px + padding-top documentElement. **Insuficiente**.
**Fix**: revisar layout TidesView en embed mode. Probablemente quitar margin/padding fijos del root.

### B-13 — TidesView row2 con buscador/instrucciones — debe ir al hamburger
**Cita usuario Rev190 QA**: *"Bien pero esos contenidos deben ir en el menu Hamburger. Solo dejar el botón de curvas y en Curvas el botón a Mareas"*
**Fix**:
- En TidesView embed: **solo botón Curvas** visible
- Versión, buscador, instrucciones, idiomas → al hamburger del visor mobile (que ya tiene Mareas)
- En popup Curvas: botón **🌊 Mareas** (cross-link, ya hecho Rev188v2)

### B-14 — Caja hora seleccionada Abrigo detrás de resumen
**Rev190 status**: z-index:100 aplicado. Usuario reporta: ventana mitad → bug B-11 lo enmascara. Después de B-11 verificar B-14.

---

## MEDIA (sprint 2)

### B-15 — Cálc Fondeo dinámico NO calcula
**Síntoma**: el bloque "Cálc Fondeo" no recalcula al mover inputs. Se queda en misma cifra.
**Cita**: *"Horizonte de fondeo ha de ir arriba. No calcula nada, se queda siempre en misma cifra. Los textos en selector no se ven letra blanca sobre blanco."*
**Tres sub-bugs**:
- **B-15a**: horizonte de fondeo (Días/Horas extra) debe ir ARRIBA en el formulario
- **B-15b**: inputs no disparan `calcFondeo()` auto pese al observer `m_wireFondeoAutoCalc`
- **B-15c**: textos en selector blanco sobre blanco — CSS no aplicado en mobile-ui
**Fix**: reordenar HTML, debug observer, override CSS.

---

## MEDIA-BAJA (sprint 3)

### B-16 — Botón EN no cambia muchas etiquetas
**Síntoma**: tras pulsar 🇬🇧, varias etiquetas siguen en castellano.
**Áreas no cubiertas por Rev189 i18n**:
- Popups dinámicos generados por JS (m_renderMeteoWindy, m_renderShelterStrip, fetchSondaData, etc.)
- `alert()` y `confirm()` JS
- Labels del bottom-bar (SOG/SONDA/CADENA chips, wx-bar)
- Modal Cálc Fondeo
- Voces TTS si idioma cambia mid-burst

### B-17 — Audio EN no cambia las voces
**Cita**: *"4 si, pero no se cambian muchas cosas, ni siquiera los audios"*
**Causa**: `_currentLang` backend se actualiza con `/api/settings` pero la próxima voice ya estaba queued. Y per-device users pueden tener langs distintos pero el backend solo respeta el último seteado.
**Fix**:
- Backend escucha cambios de lang y aborta cualquier paplay/ffmpeg en curso para re-emitir en el nuevo lang
- Visor local usa `_lang` para su propio audio sin pasar por backend

---

## CRÍTICO (sprint 5)

### B-18 — Service Worker / Push móvil con navegador cerrado
**Síntoma**: si cierras la pestaña del navegador, no hay aviso de alarma en el móvil.
**Cita**: *"Los avisos siguen sin sonar en movil por suscripcion (abrir al menos una vez aunque cierres programa navegador del movil)"*
**Status actual**: cero implementación de SW.
**Decisión usuario (Q-Q)**:
- Garreo = sonido + vibración + banner persistente
- Posible colisión = solo audio + vibración

---

## MEDIA-ALTA (sprint 6)

### B-19 — Instrucciones muy básicas
**Cita**: *"las instrucciones son muy basicas"*
**Decisión (Q-AC)**: **copy-paste de las de TidesView** tal cual (con buscador, aviso legal, créditos). Actualizar info luego.

---

## CAMBIOS DE PROYECTO (sprint 4 lite)

### B-20 — Botones "Atrás" no unificados
**Decisión (Q-H)**: template CSS único con su botón, título e icono.
**Fix**: clase `.m-back-btn-unified` aplicable a todos los modales.

### B-21 — "Sigue subiendo tamaño textos" en móvil
**Cita Q-G**: *"En el mobil se ve todo muy pequeño, es ahí donde debes poner el tiro, hay que seguir subiendo tamaño de letras, me da la sensacion que no sube"*
**Fix**: barrer todos los `font-size` en `body.mobile-ui` y subir 2-4px más. Validar visualmente.

### B-22 — Quitar "Sonarchart", dejar "Batimetría"
**Cita Q-AN**: *"Quita Sonarchart y di solo Batimetria"*
**Memoria**: `feedback_no_commercial_refs` — no referencias comerciales en código/UI.
**Fix**: grep -rn "Sonarchart\|sonarchart" → renombrar a "Batimetría" en strings, labels, comentarios.

---

## CONFIRMADOS OK por usuario en Rev190 (no abrir)

- Voces OGG restore
- Audio QZ 1-5 dB
- Sidebar y hamburger order
- Hamburger icono
- Snooze countdown UI
- Info modal título + botones
- Strip Abrigo OLA portrait
- Sliders Info fondeo
- Hamburger aviso legal + versión
- Build con número
- TidesView idiomas/instrucciones existen (mover al hamburger)

## A VECES FALLA (verificar en sprint 4)

- Centrar zoom-fit: *"a veces no"*

## DESCARTADOS por usuario (NO tocar)

- Sonda errática (ya arreglado)
- Voces TTS hombre/mujer
- Cálc Varada (era confusión)
- Compartir/exportar fondeo (pausa)
- Telegram bot UI (pausa)
- Offline / banner OFFLINE
- IMU + pypilot phase 2
- USB routing / chart defaults
- Desktop landscape font scale
- Declutter visor
- Unificar TODOS los botones (más allá del Atrás)
- Audio overboost QZ 3-4
