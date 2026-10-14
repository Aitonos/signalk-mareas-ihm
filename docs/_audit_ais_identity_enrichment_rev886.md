# Audit — enriquecer el árbol SK `vessels.*` con la identidad AIS de `_aisKnownDB` (pre-Rev886)

Fecha: 2026-10-14. Origen: petición de Carlos desde pypilot-newui ("tirar
del motor de nombres AIS de Mareas para no dar MMSI en crudo") con un
requisito explícito: **"que sea compatible con cualquier otra app de SK"**.
Publish solo cuando funcione.

Relacionado: `signalk-pypilot-newui/docs/_feature_mareas_ihm_integration.md`.

## Problema medido (Pi5, 2026-10-14 22:2x, SK reiniciado a las 22:13)

| | |
|---|---|
| Vessels MMSI en SK | 77 |
| **Sin `name` en SK** | **43 (56 %)** |
| De esos, con nombre en `_aisKnownDB` | **42** |

Causa: SK **no persiste** el árbol `vessels.*`. Tras cada reinicio (cron
cada 3 días, deploys, cortes) el nombre solo vuelve cuando llega el
mensaje estático del target: AIS tipo 5 (clase A) o 24 (clase B), cada
~6 min y solo si se recibe bien. Los targets online (aisstream / aishub)
nunca lo reciben, porque nuestro republish deja la identidad fuera desde
Rev861. Resultado: Freeboard muestra "244060024", collision-alerts dice
"Collision risk: 244060024" y pypilot-newui dice "objetivo".

`_aisKnownDB` (323 entradas, 322 con nombre) persiste en disco y ya tiene
los datos.

## Por qué fallaron Rev861 / Rev879 / Rev880 y cómo hacerlo bien

Se publicaba la identidad como **path con puntos**:
`{path:"name", value:"AURORA"}`, `{path:"communication.callsignVhf", …}`,
`{path:"registrations.imo", …}`. `fullsignalk.js:190` intenta colgar
`.meta` de un string → `TypeError` → miles por hora → leak.

Los parsers **integrados de SK** usan otra forma, verificada en el Pi5
(`/usr/lib/node_modules/signalk-server/node_modules/@signalk/`):

- `n2k-signalk/dist/pgns/129794.js`: `node: ''`, value `{ name }`
- `nmea0183-signalk/dist/hooks/VDM.js`:
  - `path: ''`, value `{ communication: { callsignVhf } }`
  - `path: ''`, value `{ registrations: { imo: "IMO <n>" } }`

**Con `path: ""` y un objeto, SK fusiona las claves en la raíz del vessel
sin crear `.meta`.** Es la forma canónica. Si emitimos exactamente esa
forma, no hay riesgo del tipo Rev861 y cualquier app que lea SK
(Freeboard, KIP, collision-alerts, pypilot-newui, WilhelmSK…) ve el
nombre sin saber que existe Mareas.

## Diseño propuesto

Módulo puro nuevo `src/sources/aisIdentityEnrich.ts`, en la línea de
`aisRepublish.ts`:

```ts
buildAisIdentityDeltas(busVessel, dbEntry, selfMmsi): {path:"", value:object}[]
```

Reglas:
1. Si es el propio MMSI → `[]` (Rev834/835).
2. Solo se rellena lo que **falta en el bus**. Nunca se pisa un valor que
   SK ya tiene (el VHF fresco manda).
3. `name` → `{path:"", value:{name}}`, solo si el `name` de la DB es real
   (no numérico, no `urn:`; mismo criterio `isRealName` que hoy).
4. `callsign` → `{path:"", value:{communication:{callsignVhf}}}`.
5. `imo` → `{path:"", value:{registrations:{imo:"IMO "+imo}}}` (con el
   mismo prefijo que VDM.js, para que coincida con el parser).
6. `length` / `beam`: **fuera de Rev886** (menos es más). Ya se publican
   en el republish para los targets online; para VHF se valorará después.
7. **NO se publica `design.aisShipType`** en esta fase (Rev881: el formato
   `{id, name}` requiere la tabla de nombres de SK; se deja para luego).

Wiring en `index.ts`: un **timer de 30 s** en `start()` (se limpia en
`stop()`):
- `app.getPath("vessels")` → para cada vessel MMSI sin `name` (o sin
  callsign / imo) con entrada en la DB (`_aisDBLookup`) → deltas.
- Un `handleMessage(plugin.id + ".aisdb", {context, updates:[{values}]})`
  por vessel. `$source` propio, así se distingue en Data Browser.
- **Tope de 50 vessels por tick** (la ría da 77; un arranque en un puerto
  grande no satura el bus).
- `Map<mmsi, lastPublishMs>`: no se republica el mismo MMSI más de una
  vez cada 10 min aunque SK siga sin nombre (protege contra el bucle
  "SK lo descarta → lo volvemos a mandar").

Interacción con el código existente:
- El handler `GET /api/anchor-watch/ais` (L~14760) salta los vessels cuyo
  `position.$source` empieza por `plugin.id + "."` (Rev758). Esto
  **no cambia**: nosotros no tocamos `position`, solo la identidad.
- Ese mismo handler lee `v.name` del bus y llama a `_aisDBUpdate(...,
  {name})` marcando `source:"vhf"`. Con el enriquecimiento leerá el
  nombre que hemos publicado nosotros, que es el mismo de la DB, así que
  es idempotente. **Ojo**: hoy `_aisDBUpdate` fuerza `source:"vhf"`, lo
  que puede afectar al dedupe de online. Solo pasa si el vessel ya
  estaba en el bus con position VHF, así que no cambia el comportamiento
  actual.
- collision-alerts lee `name` de SK → su mensaje pasa a "Collision risk:
  PELAGOS…" sin tocar ese plugin.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Repetir Rev861 | Forma canónica `path:""` + **test de regresión** que falla si `buildAisIdentityDeltas` emite alguna vez un path distinto de `""` |
| Nombre obsoleto (MMSI reasignado, barco renombrado) | Solo se rellena cuando el bus no tiene nombre; el primer estático VHF lo pisa. TTL de la DB vigente |
| Nombre de otro barco por MMSI mal configurado (clase B) | Igual que hoy en el visor de Mareas: es la misma DB que ya se muestra |
| Carga del bus | 30 s, tope de 50 y throttle de 10 min por MMSI → < 2 deltas/s en el peor caso |
| B-A1 (`FG8274`) | No relacionado: es `setSelfValue` de nuestro propio callsign. Se mantiene aparte |

## Plan

1. **Rev886**: módulo puro + tests (`tests/aisIdentityEnrich.test.js`,
   incluido el REGRESSION path-only-empty) + timer + `$source .aisdb` +
   contadores en `/api/diagnostic` (`aisIdentityEnrich: {ticks,
   published, lastTickMs}`).
2. Deploy al Pi5 → QA → **publish solo con OK de Carlos** (minor 2.13.0,
   porque es una feature visible para otras apps).

## QA Rev886

1. Tras `systemctl restart signalk`, en menos de 1 min el Data Browser
   muestra `name` en los vessels que antes salían sin nombre
   (`$source: signalk-mareas-ihm.aisdb`).
2. En Freeboard, los targets que salían con MMSI ("244060024") muestran
   nombre.
3. `journalctl -u signalk | grep "Cannot create property 'meta'"`: no
   aparece ningún nombre de barco nuevo (solo el `FG8274` de B-A1, una
   vez).
4. `/api/diagnostic` → `aisIdentityEnrich.published` sube en el primer
   tick y luego se estabiliza.
5. Heap: la curva de `heapAudit` no cambia respecto a la de 2026-09-23.

## Resultado QA (2026-10-14)

- Tras el reinicio: 3 de 106 vessels sin nombre en SK (antes 43 de 77). Sin
  errores `meta` nuevos en el journal (solo B-A1 `FG8274`).
- Freeboard abierto 30 s después del reinicio pintaba MMSI: Mareas aún no
  había hecho el primer tick (30 s) y el VHF tarda ~6 min. Al mirar de
  nuevo, Carlos confirma que **todos los nombres salen en Freeboard**.
- **Rev887**: tick bajado a 10 s para acortar esa ventana.

## Rev888 — Freeboard tardaba en mostrar nombres en vivo

Medido 2026-10-14 con una suscripción idéntica a la de Freeboard
(`vessels.*`, `path: ""`, `policy: "fixed"`, `period: 1000`): con `fixed`, SK
entrega por periodo solo el **último** valor de cada path. En 60 s, el `{mmsi}`
que el VHF manda con cada posición aparece 86 veces frente a 4 `{name}`.
Rev886 mandaba tres valores `""` en el mismo update (name, callsign, IMO) y
el nombre siempre se perdía en vivo. Los clientes que se conectan después
lo reciben bien (cache fusionada de SK); los ya conectados, no.

Fix Rev888:
1. Un único delta `path: ""` con la identidad fusionada.
2. Heartbeat: se reenvía el mismo valor cada 2 min durante 15 min desde la
   primera publicación (solo si el nombre del bus sigue siendo el nuestro).
   Contador `heartbeats` en `heapAudit.aisIdentityEnrich`.
