# Prompt para LLM externo — auditoría de la elección de fuente de mareas

Estoy trabajando en un plugin SignalK (`signalk-mareas-ihm`) que muestra mareas y ha crecido para soportar 4 fuentes:

1. **IHM** — servicio oficial español (Instituto Hidrográfico de la Marina), ~67 estaciones.
2. **signalk-tides** — plugin oficial (openwatersio) que embebe NEAPS y publica en `/signalk/v2/api/resources/tides`.
3. **NEAPS embebido** — dependencia `neaps@0.7.0` que usa `@neaps/tide-database` (NOAA + TICON-4, ~7600 estaciones globales).
4. **Open-Meteo** — modelo global por lat/lon.

He añadido en el paso del asistente ("wizard step") un selector Manual/Auto + motor + buscador por ciudad. Llevo **6 iteraciones fallidas** y sigo con estos síntomas:

## Síntomas actuales (después de deploy)

### Bug A — Modo salta de MANUAL a AUTOMÁTICO
El usuario elige `MANUAL` → NEAPS → busca "Portland" → aplica una estación. Instantes después el asistente muestra:
- Modo: **AUTOMÁTICO** (debería ser MANUAL)
- Fuente activa: IHM (debería ser NEAPS)
- Estación: Baiona (ciudad IHM cercana al GPS, ni Portland ni Sydney)

Debug del propio wizard tras la aplicación:
```
pref=neaps  manualOverride=false  manualStationId=∅
favoriteStationId=30  activeStationId=neaps-global  source=IHM
```

Contradicciones evidentes: `pref=neaps` pero `source=IHM`. `activeStationId=neaps-global` pero `Estación=Baiona`.

### Bug B — El dropdown de resultados no se cierra
Al aplicar una estación IHM, el dropdown de resultados sigue mostrando la lista + el input mantiene el texto que el user escribió.

### Bug C — NEAPS `search()` no encuentra "Sydney" (AU) ni "Auckland" (NZ)
Devuelve "Sydney BC" (Canadá) porque hace matching literal por nombre de estación. Sydney AU está registrada como "Fort Denison" en TICON-4.

## Arquitectura backend actual (src/index.ts + src/sources/ihm.ts)

**Estado persistente en `ihmCache`** (FileCache basado en JSON):

- `manualOverride: boolean` — el user ha forzado una estación.
- `manualStationId: string` — id de la estación manual. Puede ser IHM numérico (`"27"`), o virtual: `"openmeteo-global"`, `"neaps-global"`, `"sktides-plugin"`, o específico NEAPS `"neaps/noaa/8443970"`.
- `favoriteStationId: string` — residuo de una selección hecha desde TidesView en modo AUTO.
- `tideEnginePreference: "auto" | "ihm" | "sktides" | "neaps" | "openmeteo"` — motor por defecto forzado desde el asistente.
- `lastStation: {id, name}` — última estación IHM que se usó, para fallback offline.

**Endpoint `POST /api/manual`** (fragmento clave):
```typescript
const manualStationId = body.manualStationId != null ? String(body.manualStationId).trim() : "";
const manualOverride = manualStationId ? Boolean(body.manualOverride) : false;
const favoriteStationId = body.favoriteStationId != null ? String(body.favoriteStationId) : undefined;

await ihmCache.set("manualOverride", manualOverride);
await ihmCache.set("manualStationId", manualStationId);
if (favoriteStationId != null) await ihmCache.set("favoriteStationId", String(favoriteStationId));

// Deriva el pref para mantener coherencia con el motor forzado.
const virtualToPref = { "sktides-plugin":"sktides", "neaps-global":"neaps", "openmeteo-global":"openmeteo" };
let newPref = "auto";
if (manualOverride && manualStationId) {
  if (manualStationId.startsWith("neaps/"))        newPref = "neaps";
  else if (manualStationId.startsWith("sktides/")) newPref = "sktides";
  else                                             newPref = virtualToPref[manualStationId] || "ihm";
} else if (favoriteStationId && virtualToPref[String(favoriteStationId)]) {
  newPref = virtualToPref[String(favoriteStationId)];
  await ihmCache.set("favoriteStationId", "");
}
await ihmCache.set("tideEnginePreference", newPref);

// Publica un delta SK con el nuevo forecast.
try { await updateForecast(); } catch {}
```

**Endpoint `GET /api/manual`** resuelve `activeStationId` con esta precedencia:
```typescript
if (manualOverride && manualStationId) activeStationId = manualStationId;
else if (prefVirtualId) activeStationId = prefVirtualId;   // pref="neaps" → "neaps-global"
else if (favoriteStationId) activeStationId = favoriteStationId;
else /* nearest by GPS or lastStation.id */;
```

**Provider IHM (src/sources/ihm.ts)** — decide qué servir:
```typescript
const effSynId = (manualOverride && manualStationId)
  ? manualStationId
  : (prefSynId || favoriteStationIdEarly);

if (effSynId.startsWith("neaps/")) {
  return await neapsTideForecastByStationId(app, cache, effSynId);
}
if (effSynId === "neaps-global")   return await neapsTideForecast(app, cache, lat, lon);
if (effSynId === "openmeteo-global") return await openmeteoTideForecast(app, cache, lat, lon);
if (isSyntheticStationId(effSynId)) return syntheticForecast(...);

// ...IHM AUTO fallback offshore → sktides → NEAPS → openmeteo si estamos lejos.
```

## Frontend (public/mobile.html — vanilla JS + inline HTML)

El wizard step `m_wizardStep_tides(body)`:
1. Fetch a `/tide/fetch-status`, `/wizard/system-check`, `/tide/providers-status`, `/tide/engine-pref`, `/manual` en paralelo.
2. Pinta bloque "Estado actual" con Modo, Fuente, Estación, y línea debug.
3. Pinta selector Auto/Manual + selector motor + buscador.
4. Un timer polea `/manual` + `/tide/fetch-status` cada 15s y re-renderiza SOLO el bloque estado.

Aplicar estación en el picker:
```javascript
window.m_wizardPickerApply = function(stationId, stationName){
  var s = window._wizardPickerState;
  s.pendingMode = null; s.q = ''; s.results = []; s.geocodeHint = null; s.justApplied = true;
  fetch(A+'/manual', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({manualOverride:true, manualStationId:stationId})})
    .then(function(){
      setTimeout(function(){
        var body = document.getElementById('m-wizard-body');
        if (body && typeof m_wizardStep_tides==='function') m_wizardStep_tides(body);
      }, 500);
    });
};
```

Encoding del onclick (para evitar problemas con `/` en `neaps/noaa/xxx` y apóstrofes en nombres):
```javascript
var b64 = btoa(unescape(encodeURIComponent(JSON.stringify({id:String(r.id), name:String(r.name)}))));
'<button onclick="m_wizardPickerApplyB64(\''+b64+'\')" ...>'
```

## Sospechas mías (que no consigo cerrar)

1. Puede haber **otro POST /api/manual** que llegue después del mío y lo sobrescriba (¿TidesView polea `loadSettings` cada 20 s pero solo hace GET… o hay un POST implícito que no he visto?).
2. `updateForecast()` al final del POST puede tardar más que los 500 ms de espera del re-render, y el frontend lee un estado inconsistente.
3. El `justApplied` flag es solo local; si el polling parcial (`m_wizardTidesRefreshStatus`) corre entre el POST y el re-render, puede llamar a `m_wizardTidesRenderPicker` con `man.enginePref=neaps` pero `man.manualOverride=false` (ese es el snapshot que ve el screenshot).

## Lo que necesito de ti

1. **¿Dónde está el bug que hace que `manualOverride` termine en `false` justo después de aplicar una estación NEAPS?** Miras el flujo POST → GET del backend y del frontend arriba. ¿Hay una race condition, un `await` que falla silenciosamente, un valor por defecto que se cuela?
2. **¿Es sensato el modelo `manualOverride` + `manualStationId` + `favoriteStationId` + `tideEnginePreference`?** ¿O deberíamos colapsarlo a un solo campo `activeSelection = {mode: "auto"|"manual", stationId: string}` y derivar el resto?
3. **Sugerencia concreta de cómo redibujar el picker** (frontend) para que:
   - Al aplicar una estación no re-lance auto-fetch de "más cercanas".
   - El polling parcial nunca contradiga el estado del backend.
   - La UI muestre siempre el nombre humano, nunca el ID crudo.

Sé directo. Puedes reescribir las funciones enteras si consideras que hay un problema estructural. Mi objetivo es tener este selector estable con el mismo comportamiento que el dropdown del componente `TidesView` (React) que no puedo tocar por decisión del cliente.
