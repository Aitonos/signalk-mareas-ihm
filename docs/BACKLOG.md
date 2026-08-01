# BACKLOG — items abiertos en Rev843 / v2.11.2

Estado: **2026-08-02** — actualizado tras la aprobación del ciclo QA de
Carlos. Los sprints 1-6 originales (B-01…B-22, Rev190) están todos
resueltos y archivados en
[`archive/BACKLOG_Rev190_snapshot.md`](archive/BACKLOG_Rev190_snapshot.md).

Nota: no hay estructura de sprints activa. Trabajamos por feature
request de Carlos + bug hunt reactivo. Los sprints I/J/K de las
memorias están completados y viven como snapshot histórico en
[`SPRINTS.md`](SPRINTS.md).

---

## ACTIVE — a acometer cuando toque

| Item | Prio | Ref |
|---|---|---|
| **Audio Pi intermitente (probable stack VPN)** | Alta | [K-03 en KNOWN_BUGS.md](KNOWN_BUGS.md#k-03--audio-pi-intermitente-probable-stack-vpn) |
| **UTF-8 doble-codificación (Moaña → MoaÃ±a)** | Media | [K-02 en KNOWN_BUGS.md](KNOWN_BUGS.md#k-02--utf-8-doble-codificación-en-textos-con-acentos) |
| **Llamada de teléfono por Telegram** (nueva idea Carlos 2026-08-02) | Media | Ver sección "Ideas en incubación" abajo |

---

## PAUSED — buenas ideas para versión futura

| Item | Razón pausa |
|---|---|
| **AIS Friends forwarder embebido (Fase 2)** | El plugin actúa como AIS Dispatcher: lee NMEA `!AIVDM` del bus SK y lo reenvía por UDP a `ais.aisfriends.com:<port>`. Elimina la necesidad de instalar AIS Catcher/SDRAngel externo. Mismo mecanismo serviría para aishub. Complejidad media, pendiente feature de Carlos. |
| **AIS Hub forwarder embebido (Fase 2)** | Análogo al de AIS Friends. Se hace conjunto con el anterior. |
| **Unificar motores IMU v1 (fondeo) + v2 (nav)** | v1 lee SK deltas, v2 socket TCP pypilot. En modo "solo IMU" de OpenPlotter, v2 muestra 0 samples (bug Pablo). Plan: canalizar todo por un canal SK común. Memoria `project_imu_dual_engine_v1_v2`. |

---

## Ideas en incubación (exploración pendiente)

### Llamada de teléfono por Telegram (Carlos 2026-08-02)
En vez de solo mensaje Telegram, hacer una **llamada real** (Telegram
Voice Call) al chat del usuario cuando salta una alarma crítica
(garreo, colisión AIS, varada). Argumento de Carlos: *"es mucho más
incisivo que un mensaje — el teléfono suena y no puedes ignorarlo,
un mensaje puede perderse entre notificaciones"*.

**A explorar antes de planificar**:
- ¿La Bot API oficial de Telegram permite iniciar llamadas de voz?
  Actualmente `sendVoice` envía un audio, pero **iniciar una llamada
  VoIP a un chat** no está expuesto en la Bot API pública.
- Alternativas:
  - **MTProto** (biblioteca `mtcute`, `gramjs`) — permite llamadas
    pero requiere credenciales de usuario, no de bot, así que hay que
    autenticar la sesión como usuario.
  - **Telegram Calls via webhook + tercer servicio** (Twilio, etc.) —
    fuera del ecosistema Telegram puro, coste asociado.
  - **Push notification silenciosa + app dedicada** — menor fricción,
    pero requiere app instalada.
- Escenario mínimo viable: en la alarma de garreo/colisión/varada,
  además del mensaje ya existente, disparar un audio-mensaje corto
  con `sendVoice` (ya en Bot API) y ver si eso es suficientemente
  incisivo antes de meterse en MTProto.

**Estado**: exploración de viabilidad pendiente. No arrancar código
hasta decidir la vía (MTProto vs alternativa).

---

## DROPPED — descartados por Carlos (no re-abrir sin repro fresco)

| Item | Decisión |
|---|---|
| Telegram bot UI ampliada (bot commands, chat groups) | Q-C: token/chat_id ya guardables desde wizard; el resto en pausa (2026-07-21). Carlos 2026-08-02: quitado del paused, no interesa. |
| Compartir/exportar fondeo (coords+radio por Telegram/email/QR) | Q-AP: baja demanda. Carlos 2026-08-02: descartado. |
| NOAA NCDS chart layer (US) | Sustituido por NOAA ENC en el bloque Cartas por Países (2.11.0). |
| Cartas hidrográficas de otros países como layers hardcoded | Sustituido por el sistema Cartas por Países configurable (2.11.0). |
| Desktop landscape font scaling | Q-I |
| Cálc Varada = Cálc Sonda (era confusión) | Q-D |
| Voces TTS hombre/mujer | Q-AR |
| Audio QZ overboost 3-4 | Q-K |
| Declutter visor | Q-J: completado |
| Unificar TODOS los botones a estilo Mareas | Q-J: completado |
| Persona junior dev tone | Q-AH |
| Offline banner / pantalla blanca | Q-AL |
| Ad blocker leak | Q-AM: out of scope |
| IMU + pypilot phase 2 avanzado | Q-X: ya bien |
| USB routing + chart defaults + mobile audio backlog | Q-Y: ya bien |
| Tema claro/oscuro switch | Q-AG: siempre dark |
| Zoom indicator | Q-AK |
| Botones flotantes refactor | Q-AJ |
| Build counter custom | Q-AO |
| Datos SOG/DEPTH refinado | Q-B |
| Cartas en hamburger | Q-A: sidebar es el sitio |
| Botón "TEST ALARMA" en menú | Q-AT (test-alarm ya vive en wizard) |

---

## INVARIANTES — nunca cambiar sin permiso explícito de Carlos

- Backend = single source of truth (Q-N). Toda acción con múltiples
  controles POSTea al mismo endpoint y lee del SSE.
- `mobile.html` como UI única (Q-O). No hay rama desktop separada.
- Tema dark only (Q-AG).
- Predictive swing ring siempre ON (Q-AF).
- Pi audio sin más software gain (memoria `project_audio_hardware_ceiling`).
- Branch único `main` (sin develop/staging).
- Solo `espeak` mandatorio en deps externas (memoria `feedback_minimal_deps`).
- Cero referencias comerciales en código/UI (memoria `feedback_no_commercial_refs`).
- Localhost en ejemplos URL, no `<pi-ip>` (memoria `feedback_use_localhost`).
- No re-abrir Q-R / B-03 / AIS engine (memoria `project_ais_engine_resolved`).
- No mencionar "Hoekens" en changelogs/README/PRs (memoria
  `feedback_no_hoekens_reference`).
- Publish incluye deploy al Pi (memoria
  `feedback_publish_also_deploys_pi`).
