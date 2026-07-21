# Prompt para GPT-5 / Gemini Pro — MBtiles muestra negro en zoom out

> Pegar este archivo entero en hilos SEPARADOS en GPT-5 y en Gemini Pro 2.5.
> NO condicionar a ningún LLM con la respuesta del otro. Después comparo:
> convergencias validan; divergencias revelan decisiones.

## Lo que quiero del LLM

Una explicación CONCRETA, con código, de cómo implementar el "auto-rellenado"
de zoom-out en MBtiles que en mi versión pre-mobile-UI funcionaba pero un
cambio intermedio rompió. Detalles de la versión vieja los he perdido (no hay
git history utilizable). Quiero:

1. **Diagnóstico** de por qué mi implementación actual no funciona.
2. **Patrón estándar** Leaflet/JavaScript para "scale-down" de tiles cuando
   el zoom del usuario es menor que el `minZoom` disponible.
3. **Código TypeScript/JavaScript** completo del fix.
4. **Trade-offs** (server load, browser memory, max zoom-out soportado).

NO me deis generalidades. Quiero diagnóstico específico para este código.

---

## Contexto

PWA SignalK (`mobile.html` monolítico vanilla JS) con Leaflet 1.9.4. Soporta
varias capas tile: OSM, OpenSeaMap, ArcGIS Sat, Navionics (proxy), y **MBtiles
locales** (cartas náuticas custom en SQLite).

Los archivos MBtiles del usuario suelen tener zoom limitado (ejemplo: solo
niveles 12-16 disponibles). Cuando el usuario hace **zoom OUT** más allá de
`minZoom=12` (por ejemplo a z=8), quiere seguir viendo la carta MBtile **en
versión reducida** (mosaico de tiles del z=12 dibujadas pequeñas), NO un
fondo negro.

En la versión pre-mobile-UI esto funcionaba perfectamente — el usuario lo
recuerda. Algún cambio intermedio rompió el comportamiento. Sin git history
no puedo bisect.

---

## Comportamiento deseado

```
MBtile disponible solo en zoom 12-16.
Usuario en z=12: ve tile exacta.
Usuario en z=10: ve mosaico 4×4 de sub-tiles z=12 dibujadas en 64×64 cada una.
Usuario en z=8: ve mosaico 16×16 (o el patrón que se pueda).
Usuario en z=6: tan reducido que ve solo "manchas" de los pixeles pero algo.
Usuario en z=2: aceptable que ya no se vea nada (tile vacía).
```

Comportamiento **simétrico** con el overzoom (zoom IN más allá de maxZoom)
que SÍ funciona: en z=18 con maxZoom=16, Leaflet pide tile z=18 y mi código
hace crop sub-rect del padre z=16 estirado a 256×256.

---

## Mi implementación actual (NO funciona en zoom out)

`mobile.html`:

```javascript
// Helper functions
function nearestLower(z){
  var best=-1;
  for(var j=0;j<avail.length;j++){if(avail[j]<=z)best=avail[j];}
  return best;
}
function nearestHigher(z){
  var best=-1;
  for(var j=0;j<avail.length;j++){
    if(avail[j]>=z && (best<0 || avail[j]<best))best=avail[j];
  }
  return best;
}

// avail = array de zooms disponibles del MBtile (ej: [12,13,14,15,16])
// tileBase = '/signalk-mareas-ihm/tiles/<MBtileID>'
// fmt = 'png' | 'jpg'

var MBLayer = L.GridLayer.extend({
  createTile: function(coords, done){
    var tile = document.createElement('canvas');
    tile.width = tile.height = 256;
    var ctx = tile.getContext('2d');
    var z = coords.z, x = coords.x, y = coords.y;
    var useZ = (avail.indexOf(z) >= 0) ? z : nearestLower(z);

    // ZOOM OUT: useZ < 0 significa no hay zoom <= z disponible
    if (useZ < 0) {
      var hZ = nearestHigher(z);
      if (hZ < 0) { done(null, tile); return tile; }
      var diffOut = hZ - z;
      if (diffOut > 3) { done(null, tile); return tile; }  // catastrófico si no
      var n = 1 << diffOut;                  // sub-tiles por lado: 2/4/8
      var subSize = 256 / n;                  // tamaño cada una en el canvas destino
      var baseX = x * n, baseY = y * n;
      var loaded = 0, total = n * n;
      var fnDone1 = function(){ loaded++; if(loaded === total) done(null, tile); };
      for (var ix = 0; ix < n; ix++){
        for (var iy = 0; iy < n; iy++){
          (function(dx, dy){
            var simg = new Image();
            simg.crossOrigin = 'anonymous';
            simg.onload = function(){
              try{ ctx.drawImage(simg, 0, 0, 256, 256, dx*subSize, dy*subSize, subSize, subSize); }catch(_){}
              fnDone1();
            };
            simg.onerror = fnDone1;
            simg.src = tileBase + '/' + hZ + '/' + (baseX + dx) + '/' + (baseY + dy) + '.' + fmt;
          })(ix, iy);
        }
      }
      return tile;
    }

    // OVERZOOM / EXACT: useZ >= 0 (existe el zoom o un padre)
    var img = new Image();
    img.crossOrigin = 'anonymous';
    if (useZ === z) {
      img.onload = function(){ ctx.drawImage(img, 0, 0, 256, 256); done(null, tile); };
      img.onerror = function(){ done(null, tile); };
      img.src = tileBase + '/' + z + '/' + x + '/' + y + '.' + fmt;
    } else {
      // overzoom: useZ < z, parent tile cropped
      var diff = z - useZ;
      var factor = 1 << diff;
      var px = x >> diff, py = y >> diff;
      var ox = x - px * factor, oy = y - py * factor;
      var sw = 256 / factor, sh = 256 / factor;
      var sx = ox * sw, sy = oy * sh;
      img.onload = function(){ ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 256, 256); done(null, tile); };
      img.onerror = function(){ done(null, tile); };
      img.src = tileBase + '/' + useZ + '/' + px + '/' + py + '.' + fmt;
    }
    return tile;
  }
});

var ly = new MBLayer({
  maxZoom: 22,
  minZoom: Math.max(1, minNZ - 3),  // ← restringe a 3 niveles bajo minNZ
  tms: false,
  opacity: 0.9,
  zIndex: 10,
  updateWhenIdle: false,
  updateWhenZooming: true,
  keepBuffer: 4,
  tileSize: 256
});
```

---

## Backend handler (Node.js Express, sirve las tiles)

```typescript
expressApp.get("/signalk-mareas-ihm/tiles/:set/:z/:x/:y.:ext", (req, res) => {
  const ts = tilesets.get(req.params.set);
  if (!ts) return res.status(404).send("Tileset not found");
  const z = parseInt(req.params.z), x = parseInt(req.params.x);
  let y = parseInt(req.params.y);
  if (isNaN(z) || isNaN(x) || isNaN(y)) return res.status(400).send("Invalid coords");
  const tmsY = ts.meta.tms ? (1 << z) - 1 - y : y;
  const fmt = ts.meta.format === "jpg" ? "jpeg" : ts.meta.format;
  try {
    const row = ts.db.prepare(
      "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?"
    ).get(z, x, tmsY);
    if (row) {
      res.set("Content-Type", `image/${fmt}`);
      res.set("Cache-Control", "public, max-age=15552000, immutable");
      return res.send(row.tile_data);
    }
    // Missing tile — TRANSPARENT_PNG (no 404)
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=3600");
    return res.send(TRANSPARENT_PNG);
  } catch (e) { res.status(500).send("Tile read error"); }
});
```

**Importante**: el handler NUNCA devuelve 404 para tiles inexistentes. Siempre
200 con `TRANSPARENT_PNG` (PNG transparente de 1×1). Eso significa que mi
`img.onerror` JAMÁS se dispara en sub-tiles del cluster — siempre `onload`
con una imagen transparente.

---

## Lo que observa el usuario en QA

1. Activa solo 1 MBtile en el visor, NO activa OSM/sat/IHM (caso aislado).
2. Posicionado en zona dentro del bounds del MBtile (zona donde sí hay tiles).
3. Zoom dentro del rango (12-16): ve la carta perfectamente.
4. **Zoom OUT** más allá de minZoom (z=10, 9, 8, ...): **fondo NEGRO uniforme**.
   No ve el mosaico esperado.
5. En DevTools Network filtrando por `/tiles/`: **NINGUNA request** al hacer
   zoom out a niveles negros. Eso significa que Leaflet NO está llamando a
   `createTile` para esos niveles.
6. Causa probable identificada: `minZoom: Math.max(1, minNZ-3)` restringe la
   layer. Si MBtile tiene `minNZ=14`, layer queda con `minZoom=11`. En z=10
   Leaflet no carga la layer.

Pero el usuario dice "antes funcionaba con la versión pre-mobile UI", así que
hubo una implementación que sí permitía bajar más en zoom out y dibujaba
mosaico. Quizá usaba `minZoom: 0` u otra estrategia.

---

## Lo que he probado (todo falla o es contraproducente)

### Intento 1 (Rev344) — Mi cluster con `minZoom: Math.max(1, minNZ-3)`
Implementé el cluster pero la layer está restringida a 3 niveles abajo. Mi
código `createTile` se dispara solo para z entre `minNZ-3` y `maxNZ`. Para z
fuera de ese rango Leaflet ni llama. Resultado: solo cubre diff hasta 3 con
mosaico de 8×8 máximo, y solo en esos 3 niveles concretos. Más abajo: negro.

### Intento 2 (Rev344b) — `minZoom: 1`
Le digo a Leaflet que cargue la layer en TODOS los niveles. Para z muy bajo
(diff > 3), mi código devuelve canvas vacío. Resultado: el usuario reporta
"mucho peor" — porque ahora Leaflet pide MUCHAS tiles a niveles muy bajos,
todas vacías, máximo CPU del browser para nada. Y el comportamiento sigue
siendo negro en todos esos niveles.

### Intento 3 (cualquier diff > 3)
2^diff × 2^diff sub-tiles. Para diff=6 = 4096 requests por tile destino. Para
diff=10 = 1M requests. Inviable.

---

## Mis sospechas no validadas

### Sospecha A — La versión vieja usaba `maxNativeZoom` / `minNativeZoom`

Leaflet tiene opciones nativas `maxNativeZoom` y `minNativeZoom`. Si las pongo,
Leaflet pide solo tiles dentro de [minNative, maxNative] y los renderiza
estirados (zoom in) o reducidos (zoom out) AUTOMÁTICAMENTE. ¿Es esa la
solución? Pregunta: ¿`minNativeZoom` hace auto-cluster de sub-tiles en zoom
out, o solo escala una sola tile (lo cual sería visualmente borroso/blocky)?

### Sospecha B — La versión vieja servía las tiles diferentes

Quizá el handler backend antes hacía algo distinto cuando la tile no existía:
en lugar de TRANSPARENT_PNG, hacía un fallback server-side al zoom higher
disponible, cropeado para la posición pedida. Eso da una tile siempre con
contenido, aunque sea redibujada server-side. Costoso en CPU server pero
elegante.

### Sospecha C — Estrategia "escalado clásico"

En lugar de cluster, simplemente pedir UNA tile del higher zoom y estirarla
al canvas entero. Eso da imagen borrosa/blocky pero NO negro. Costo: 1
request por tile destino, no 2^(2*diff).

```
Para diff=2, n=4: en lugar de 16 sub-tiles 64×64, una sola sub-tile del
   higher zoom estirada de 64×64 (porción) a 256×256 (canvas).
```

Pero ojo: para zoom OUT, una sub-tile del higher zoom cubre solo 1/n² del
viewport actual. Estirarla a 256×256 muestra solo esa fracción del MBtile,
no el viewport entero. Esto no es lo deseado.

---

## Lo que necesito del LLM

### Bloque A — Diagnóstico

¿Cuál es el patrón estándar en Leaflet 1.9.4 para implementar **auto-rellenado
en zoom OUT** cuando el MBtile tiene un rango limitado de zooms? ¿Qué opciones
de `L.TileLayer` / `L.GridLayer` usar? ¿`minNativeZoom` resuelve esto solo, o
hace falta `createTile` custom?

Pista importante: la versión "pre-mobile UI" del usuario lo hacía bien. ¿Cuál
es el patrón de buenas prácticas?

### Bloque B — Código

Dame el código TypeScript/JavaScript completo del `MBLayer` y las opciones
del constructor que resuelvan ESTE problema concreto. Asume que:

- `avail: number[]` = array ordenado de zooms disponibles (e.g. `[12,13,14,15,16]`).
- `tileBase: string` = URL base `'/signalk-mareas-ihm/tiles/<id>'`.
- `fmt: string` = `'png'` o `'jpg'`.
- El backend handler NO se va a tocar (devuelve transparent en miss).
- El usuario quiere ver la carta reducida hasta zoom out razonable (5-6
  niveles abajo del minNZ, dentro de lo que sea sostenible para el browser).
- El usuario tiene Raspberry Pi 4/5 con Firefox ESR aarch64, NO máquina potente.

### Bloque C — Trade-offs

¿Qué pierdes? CPU browser, requests al server, calidad visual del scale-down,
máximo zoom-out razonable. Cuantifica.

### Bloque D — Validación

¿Cómo testeo que el fix funciona? Lista de pasos concretos para QA.

---

## Restricciones

- NO migración a Mapbox/Mapnik/MapLibre. Mantener Leaflet 1.9.4 + `<canvas>`.
- NO añadir biblioteca server-side de canvas/imagen (sharp/canvas) salvo que
  sea estrictamente necesario.
- El handler backend ya devuelve transparent en miss, asume eso.
- Mantener compatibilidad con el resto del visor (overzoom que sí funciona).

---

Fin. Responder en español técnico (o inglés si lo preferís — usuario bilingüe).
