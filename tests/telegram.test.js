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

// Rev897 (feedback Diego): Telegram answers are reported, Markdown is safe.
import { EventEmitter } from 'node:events';

function mockRequest(statusCode, body, { error } = {}) {
  return (_url, _opts, cb) => {
    const req = new EventEmitter();
    req.write = () => {};
    req.destroy = () => {};
    req.end = () => setImmediate(() => {
      if (error) { req.emit('error', new Error(error)); return; }
      const res = new EventEmitter();
      res.statusCode = statusCode;
      cb(res);
      res.emit('data', body);
      res.emit('end');
    });
    return req;
  };
}

function send(sendTelegram, httpsRequest) {
  return new Promise((resolve) => {
    sendTelegram({
      botToken: 't', chatId: '1', kind: 'test', text: 'x', lastSent: {},
      httpsRequest, onResult: resolve, retryDelayMs: 0,
    });
  });
}

test('telegram: a rejected send reports Telegram\'s error text', async () => {
  const { sendTelegram } = await loadTelegram();
  const r = await send(sendTelegram, mockRequest(400, '{"ok":false,"description":"Bad Request: chat not found"}'));
  assert.deepEqual(r, { ok: false, status: 400, description: 'Bad Request: chat not found' });
});

test('telegram: an accepted send reports ok', async () => {
  const { sendTelegram } = await loadTelegram();
  const r = await send(sendTelegram, mockRequest(200, '{"ok":true}'));
  assert.equal(r.ok, true);
});

test('telegram: a network error reports the error', async () => {
  const { sendTelegram } = await loadTelegram();
  const r = await send(sendTelegram, mockRequest(0, '', { error: 'ENOTFOUND api.telegram.org' }));
  assert.equal(r.ok, false);
  assert.match(r.description, /ENOTFOUND/);
});

test('telegram: no unpaired underscore outside code in the connected message', async () => {
  const { formatTelegramMessage } = await loadTelegram();
  for (const lang of ['es', 'en']) {
    const t = formatTelegramMessage('startup_connected', { chatId: '12345' }, lang).replace(/`[^`]*`/g, '');
    assert.ok(!t.includes('_'), t);
  }
});

test('telegram: grounding detail is escaped for Markdown', async () => {
  const { formatTelegramMessage } = await loadTelegram();
  const t = formatTelegramMessage('grounding', { detail: 'depth_now *1.2 m*' }, 'es');
  assert.equal(t, '⚠️ *RIESGO DE VARADA*.\ndepth\\_now \\*1.2 m\\*');
});

test('telegram: alarm test names the simulated alarm', async () => {
  const { formatTelegramMessage } = await loadTelegram();
  assert.match(formatTelegramMessage('test_alarm', { revision: 'Rev897', alarm: 'grounding' }, 'es'), /\(varada\).*Rev897/);
  assert.match(formatTelegramMessage('test_alarm', { revision: 'Rev897', alarm: 'garreo' }, 'en'), /\(anchor drag\)/);
});

test('telegram: a connection error is retried once and the retry can succeed', async () => {
  const { sendTelegram } = await loadTelegram();
  let calls = 0;
  const flaky = (url, opts, cb) => {
    calls++;
    return mockRequest(200, '{"ok":true}', calls === 1 ? { error: 'ETIMEDOUT' } : {})(url, opts, cb);
  };
  const r = await send(sendTelegram, flaky);
  assert.equal(r.ok, true);
  assert.equal(calls, 2);
});

test('telegram: an HTTP error from Telegram is not retried', async () => {
  const { sendTelegram } = await loadTelegram();
  let calls = 0;
  const counted = (url, opts, cb) => { calls++; return mockRequest(400, '{"ok":false,"description":"x"}')(url, opts, cb); };
  await send(sendTelegram, counted);
  assert.equal(calls, 1);
});

// Rev900 (audit A1): auto-lift must not silence a real drag. No speed-only
// trigger (a dragging boat drifts at 3-4 kn in a gale), and no auto-lift
// while the drag alarm is sounding or silenced.
test('auto-lift: motor only, never during a drag alarm', () => {
  const src = readFileSync(indexTs, 'utf8');
  const start = src.indexOf('function _checkIntentionalDeparture(');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  assert.ok(start >= 0, 'expected _checkIntentionalDeparture');
  assert.match(body, /anchorDragAlarmActive/);
  assert.match(body, /_isGarreoSilenced\(\)/);
  assert.match(body, /_isAnyMotorRunning\(\) === true/);
  assert.doesNotMatch(src, /_INTENTIONAL_DEP_SOG_KT/);
});
