// Characterization tests for Telegram message formatting and language settings.
// Uses node:test. Locks ES + EN copy; startup wiring must load lang before send.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const telegramJs = resolve(root, 'dist/telegram.js');
const langSettingsJs = resolve(root, 'dist/langSettings.js');
const indexTs = resolve(root, 'src/index.ts');

/** Production message kind for anchor drag (Spanish key kept until i18n rename). */
const DRAGGING_KIND = 'garreo';

const EXPECTED_DRAGGING_TEXT_ES =
  '⚠️ *GARREO* detectado.\nDistancia: 80 m (radio alarma: 50 m).\nEl barco se mueve fuera del fondeo.';

const EXPECTED_DRAGGING_TEXT_EN =
  '⚠️ *ANCHOR DRAG* detected.\nDistance: 80 m (alarm radius: 50 m).\nVessel is moving outside the swing circle.';

const STARTUP_REVISION = 'Rev878';

const EXPECTED_STARTUP_TEXT_ES =
  `🚀 Mareas IHM ${STARTUP_REVISION} arrancado. ` +
  'Las alarmas garreo/AIS/varada llegarán aquí cuando se disparen en el barco.';

const EXPECTED_STARTUP_TEXT_EN =
  `🚀 Mareas IHM ${STARTUP_REVISION} started. ` +
  'Drag/AIS/grounding alarms will arrive here when they fire on the boat.';

async function loadTelegram() {
  assert.ok(
    existsSync(telegramJs),
    'dist/telegram.js missing — run `npx tsc -b tsconfig.node.json` (or npm run build) first',
  );
  return import(pathToFileURL(telegramJs).href);
}

async function loadLangSettings() {
  assert.ok(
    existsSync(langSettingsJs),
    'dist/langSettings.js missing — run `npx tsc -b tsconfig.node.json` (or npm run build) first',
  );
  return import(pathToFileURL(langSettingsJs).href);
}

function mockLangStorage(lang) {
  return {
    async get(key) {
      return key === 'lang' ? lang : null;
    },
    async set() {},
  };
}

test('dragging: formatTelegramMessage returns the Spanish garreo text', async () => {
  const { formatTelegramMessage } = await loadTelegram();
  const draggingText = formatTelegramMessage(
    DRAGGING_KIND,
    { distM: 80, radM: 50 },
    'es',
  );
  assert.equal(draggingText, EXPECTED_DRAGGING_TEXT_ES);
});

test('dragging: formatTelegramMessage returns the English drag text', async () => {
  const { formatTelegramMessage } = await loadTelegram();
  const draggingText = formatTelegramMessage(
    DRAGGING_KIND,
    { distM: 80, radM: 50 },
    'en',
  );
  assert.equal(draggingText, EXPECTED_DRAGGING_TEXT_EN);
});

test('startup: formatTelegramMessage returns the Spanish startup text', async () => {
  const { formatTelegramMessage } = await loadTelegram();
  const startupText = formatTelegramMessage(
    'startup',
    { revision: STARTUP_REVISION },
    'es',
  );
  assert.equal(startupText, EXPECTED_STARTUP_TEXT_ES);
});

test('startup: formatTelegramMessage returns the English startup text', async () => {
  const { formatTelegramMessage } = await loadTelegram();
  const startupText = formatTelegramMessage(
    'startup',
    { revision: STARTUP_REVISION },
    'en',
  );
  assert.equal(startupText, EXPECTED_STARTUP_TEXT_EN);
});

test('language settings: resolveBoatLang reads persisted en from storage', async () => {
  const { resolveBoatLang, DEFAULT_BOAT_LANG } = await loadLangSettings();
  const lang = await resolveBoatLang(mockLangStorage('en'), {});
  assert.equal(lang, 'en');
  assert.notEqual(lang, DEFAULT_BOAT_LANG);
});

test('startup: Telegram text follows persisted en lang at plugin boot', async () => {
  const { resolveBoatLang, DEFAULT_BOAT_LANG } = await loadLangSettings();
  const { formatTelegramMessage } = await loadTelegram();

  // Simulates plugin boot: in-memory lang starts as default es until refresh.
  let currentLang = DEFAULT_BOAT_LANG;
  currentLang = await resolveBoatLang(mockLangStorage('en'), {});

  const startupText = formatTelegramMessage(
    'startup',
    { revision: STARTUP_REVISION },
    currentLang,
  );

  assert.equal(startupText, EXPECTED_STARTUP_TEXT_EN);
  assert.notEqual(
    formatTelegramMessage('startup', { revision: STARTUP_REVISION }, DEFAULT_BOAT_LANG),
    startupText,
    'without lang refresh the startup message would stay Spanish',
  );
});

test('plugin start loads persisted lang before Telegram startup send', () => {
  const src = readFileSync(indexTs, 'utf8');
  const aisFriendsInit = src.indexOf('_aisfriendsStartIfConfigured(props);');
  const langRefresh = src.indexOf('await _refreshCurrentLang(props);', aisFriendsInit);
  const telegramInit = src.indexOf(
    '_telegramBotToken = String((props as any)?.telegramBotToken',
    aisFriendsInit,
  );

  assert.ok(aisFriendsInit >= 0, 'expected AIS friends init in plugin start()');
  assert.ok(langRefresh > aisFriendsInit, 'plugin start must await lang refresh from settings');
  assert.ok(
    telegramInit > langRefresh,
    'Telegram init must run after lang refresh so startup message uses the setting',
  );
});
