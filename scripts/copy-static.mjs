import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Ensure runtime data files are available in the compiled output.
// Signal K runs the compiled JS from /dist, so __dirname points there.

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDataDir = path.join(projectRoot, 'src', 'data');
const outDir = path.join(projectRoot, 'dist', 'data');

fs.mkdirSync(outDir, { recursive: true });

// Always copy station reference table
for (const fname of ['stationRef.json']) {
  const srcFile = path.join(srcDataDir, fname);
  const outFile = path.join(outDir, fname);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, outFile);
    console.log(`[copy-static] Copied ${path.relative(projectRoot, srcFile)} -> ${path.relative(projectRoot, outFile)}`);
  }
}

// Copy any IHM coefficient tables shipped with the plugin (coefficients_<year>.json)
try {
  const entries = fs.readdirSync(srcDataDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!/^coefficients_\d{4}\.json$/.test(e.name)) continue;
    const srcFile = path.join(srcDataDir, e.name);
    const outFile = path.join(outDir, e.name);
    fs.copyFileSync(srcFile, outFile);
    console.log(`[copy-static] Copied ${path.relative(projectRoot, srcFile)} -> ${path.relative(projectRoot, outFile)}`);
  }
} catch {
  // ignore
}

// Rev541: mapafondeo.html ELIMINADO (visor desktop legacy). Ya no se copia
// a dist/, ya no existe en public/. El handler de /mapafondeo redirige 308
// a /visorfondeo. Solo mobile.html como visor.

// Rev166: Copy mobile.html to dist/ (touch-first frontend for phone/tablet)
const mobileSrc = path.join(projectRoot, 'public', 'mobile.html');
const mobileDst = path.join(outDir, '..', 'mobile.html');
if (fs.existsSync(mobileSrc)) {
  fs.copyFileSync(mobileSrc, mobileDst);
  console.log(`[copy-static] Copied mobile.html -> dist/mobile.html`);
}

// Rev178: Copy README.md to dist/ for the in-app Instrucciones modal
const readmeSrc = path.join(projectRoot, 'README.md');
const readmeDst = path.join(outDir, '..', 'README.md');
if (fs.existsSync(readmeSrc)) {
  fs.copyFileSync(readmeSrc, readmeDst);
  console.log(`[copy-static] Copied README.md -> dist/README.md`);
}

// Rev522: copy CHANGELOG.md to dist/ so el botón "Versiones" del modal
// Instrucciones (TidesView) lo lea en runtime y siempre coincida con el plugin
// instalado. Antes el changelog vivía hardcoded dentro de TidesView y quedaba
// huerfano entre releases.
const changelogSrc2 = path.join(projectRoot, 'CHANGELOG.md');
const changelogDst2 = path.join(outDir, '..', 'CHANGELOG.md');
if (fs.existsSync(changelogSrc2)) {
  fs.copyFileSync(changelogSrc2, changelogDst2);
  console.log(`[copy-static] Copied CHANGELOG.md -> dist/CHANGELOG.md`);
}

// Rev527: copy public/instrucciones_es.html (fragmento ES del manual) a dist/.
// Cuando el idioma del visor es ES, TidesView lo fetchea y lo renderiza inline
// en lugar del JSX hardcoded EN. Así el manual español deja de estar huérfano.
const instrEsSrc = path.join(projectRoot, 'public', 'instrucciones_es.html');
const instrEsDst = path.join(outDir, '..', 'instrucciones_es.html');
if (fs.existsSync(instrEsSrc)) {
  fs.copyFileSync(instrEsSrc, instrEsDst);
  console.log(`[copy-static] Copied instrucciones_es.html -> dist/instrucciones_es.html`);
}


// Rev146 (audit fix): limpia bundles JS/CSS antiguos de public/assets/. Vite
// se configura con emptyOutDir:false para no borrar mapafondeo.html y compañía,
// pero eso deja acumulados los hashes viejos (index-XXX.js / index-YYY.css)
// de builds anteriores. Resultado: el directorio publicado crece sin freno
// y el bundle huérfano queda referenciable. Limpiamos a mano antes del build
// de Vite (que emite el nuevo hash y reemplaza index.html).
const publicAssetsDir = path.join(projectRoot, 'public', 'assets');
if (fs.existsSync(publicAssetsDir)) {
  try {
    const entries = fs.readdirSync(publicAssetsDir);
    let removed = 0;
    for (const f of entries) {
      if (/^index-[A-Za-z0-9_-]+\.(js|css)$/.test(f)) {
        fs.unlinkSync(path.join(publicAssetsDir, f));
        removed++;
      }
    }
    if (removed > 0) console.log(`[copy-static] Pruned ${removed} stale hashed bundle(s) in public/assets/`);
  } catch (e) {
    console.log(`[copy-static] assets prune failed: ${e.message}`);
  }
}

// Copy webapp static assets into dist/ so the express handlers in dist/index.js
// always find them next to the running JS, even if public/ is missing or stripped.
const distDir = path.join(outDir, '..'); // dist/
const staticAssets = [
  { src: path.join(projectRoot, 'public', 'icon.svg'),            dst: path.join(distDir, 'icon.svg') },
  { src: path.join(projectRoot, 'public', 'boat-cenital.svg'),    dst: path.join(distDir, 'boat-cenital.svg') },
  /* Rev332: icono mercante AIS Class A — distinto del genérico para que
     buques grandes se vean diferenciados en el mapa. */
  { src: path.join(projectRoot, 'public', 'ais-classA-icon.svg'), dst: path.join(distDir, 'ais-classA-icon.svg') },
];

// Rev332: copia Leaflet local desde node_modules para servirlo desde el
// propio plugin en vez de cargar desde unpkg.com (que añade hasta 25s en
// la primera carga sin cache del browser, especialmente en mobile/tablet
// con red lenta). Reportado por usuario tras pruebas reales en barco.
try {
  const leafletSrcDir = path.join(projectRoot, 'node_modules', 'leaflet', 'dist');
  const leafletDstDir = path.join(distDir, 'vendor', 'leaflet');
  if (fs.existsSync(leafletSrcDir)) {
    fs.mkdirSync(leafletDstDir, { recursive: true });
    // Copia los assets esenciales (.js, .css, images/)
    const filesToCopy = ['leaflet.js', 'leaflet.css'];
    for (const f of filesToCopy) {
      const src = path.join(leafletSrcDir, f);
      const dst = path.join(leafletDstDir, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst);
        console.log(`[copy-static] Copied node_modules/leaflet/dist/${f} -> dist/vendor/leaflet/${f}`);
      }
    }
    // Copia carpeta images/ entera (marker icons, etc.)
    const imgSrc = path.join(leafletSrcDir, 'images');
    const imgDst = path.join(leafletDstDir, 'images');
    if (fs.existsSync(imgSrc)) {
      fs.mkdirSync(imgDst, { recursive: true });
      for (const f of fs.readdirSync(imgSrc)) {
        fs.copyFileSync(path.join(imgSrc, f), path.join(imgDst, f));
      }
      console.log(`[copy-static] Copied node_modules/leaflet/dist/images/ -> dist/vendor/leaflet/images/`);
    }
  }
} catch (e) {
  console.log(`[copy-static] leaflet copy failed: ${e.message}`);
}
for (const a of staticAssets) {
  if (fs.existsSync(a.src)) {
    fs.copyFileSync(a.src, a.dst);
    console.log(`[copy-static] Copied ${path.relative(projectRoot, a.src)} -> ${path.relative(projectRoot, a.dst)}`);
  }
}

// Rev101 / Rev150: copy pre-recorded voice OGG/WAV files to dist/sounds/ for
// the Pi audio engine. Each file is named <kind>_<lang>.ogg; runtime falls
// back to espeak if the file is missing for a given kind+lang.
//
// Rev150 — dos fuentes válidas (en orden de prioridad):
//   1. src/sounds/        canónico, versionado en git
//   2. OGG Voices/        carpeta de trabajo del usuario (drop'n'build)
// Si el usuario deja OGGs nuevos en "OGG Voices/", los copiamos como si
// estuvieran en src/sounds/. Quita la fricción de tener que mover archivos
// manualmente entre carpetas.
const soundsDst = path.join(distDir, 'sounds');
const soundsSrcDirs = [
  path.join(projectRoot, 'src', 'sounds'),
  path.join(projectRoot, 'OGG Voices'),
];
let copiedTotal = 0;
for (const soundsSrc of soundsSrcDirs) {
  if (!fs.existsSync(soundsSrc)) continue;
  fs.mkdirSync(soundsDst, { recursive: true });
  try {
    const entries = fs.readdirSync(soundsSrc, { withFileTypes: true });
    let copied = 0;
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (!/\.(ogg|wav|mp3)$/i.test(e.name)) continue;
      const src = path.join(soundsSrc, e.name);
      const dst = path.join(soundsDst, e.name);
      fs.copyFileSync(src, dst);
      copied++;
    }
    if (copied > 0) {
      copiedTotal += copied;
      console.log(`[copy-static] Copied ${copied} voice file(s) from ${path.relative(projectRoot, soundsSrc)}/ → dist/sounds/`);
    }
  } catch (e) {
    console.log(`[copy-static] sounds dir ${path.relative(projectRoot, soundsSrc)} read failed: ${e.message}`);
  }
}
if (copiedTotal === 0) {
  console.log(`[copy-static] No .ogg/.wav/.mp3 voices found (espeak TTS fallback active). Drop files in src/sounds/ or OGG Voices/.`);
}

// === build-info.json (Deploy 3a v5, 2026-05-09) ===
// Auto-generated each build. Carries timestamp + git hash + version so the
// running plugin and the deploy log can confirm which iteration is live on
// the Pi. Avoids "qué versión tengo cargada?" doubts.
function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: projectRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { return null; }
}
function getGitDirty() {
  try {
    const out = execSync('git status --porcelain', { cwd: projectRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return out.length > 0;
  } catch { return false; }
}
const pkgJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const gitHash = getGitHash();
const gitDirty = getGitDirty();
const buildInfo = {
  version: pkgJson.version,
  timestamp,
  gitHash: gitHash || null,
  gitDirty,
  builtAt: now.toISOString(),
};
fs.writeFileSync(path.join(distDir, 'build-info.json'), JSON.stringify(buildInfo, null, 2));
const dirtyTag = gitDirty ? '+dirty' : '';
const gitTag = gitHash ? `+${gitHash}${dirtyTag}` : dirtyTag;
console.log(`[copy-static] Build info: ${pkgJson.version} build-${timestamp}${gitTag}`);
