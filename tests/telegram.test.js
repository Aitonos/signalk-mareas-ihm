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

// Rev901 (audit D08): a timeout is retried too; a failed send holds the
// kind only for failRetryMs, a delivered one for the full throttle.
function timeoutRequest() {
  return (_url, _opts, _cb) => {
    const req = new EventEmitter();
    req.write = () => {};
    req.destroy = () => {};
    req.end = () => setImmediate(() => req.emit('timeout'));
    return req;
  };
}

test('telegram: a timeout is retried once and the retry can succeed', async () => {
  const { sendTelegram } = await loadTelegram();
  let calls = 0;
  const slowThenOk = (url, opts, cb) => {
    calls++;
    return calls === 1 ? timeoutRequest()(url, opts, cb) : mockRequest(200, '{"ok":true}')(url, opts, cb);
  };
  const r = await send(sendTelegram, slowThenOk);
  assert.equal(r.ok, true);
  assert.equal(calls, 2);
});

test('telegram: a failed send lets the same kind try again sooner', async () => {
  const { sendTelegram } = await loadTelegram();
  const lastSent = {};
  let t = 1_000_000;
  const go = (httpsRequest) => new Promise((resolve) => {
    const issued = sendTelegram({
      botToken: 't', chatId: '1', kind: 'garreo', text: 'x', lastSent,
      httpsRequest, retryDelayMs: 0, nowMs: () => t,
      throttleMs: 60_000, failRetryMs: 20_000, onResult: resolve,
    });
    if (!issued) resolve(null);
  });
  const fail = mockRequest(0, '', { error: 'ENETUNREACH' });
  assert.equal((await go(fail)).ok, false);
  t += 19_000;
  assert.equal(await go(fail), null, 'still held right after the failure');
  t += 2_000;
  assert.equal((await go(mockRequest(200, '{"ok":true}'))).ok, true);
  t += 30_000;
  assert.equal(await go(mockRequest(200, '{"ok":true}')), null, 'a delivered send holds the full minute');
});

// Rev903 (Carlos, after audit A1): one rule. Outside the alarm circle and
// moving bow first above 0.5 kt for 15 s, engine or not, also while the drag
// alarm sounds. A dragging boat never moves bow first; at anchor a boat can,
// but inside the circle. Without heading/COG: 3 kt for 60 s.
test('auto-lift: outside the circle and moving bow first', () => {
  const src = readFileSync(indexTs, 'utf8');
  const start = src.indexOf('function _checkIntentionalDeparture(');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  assert.ok(start >= 0, 'expected _checkIntentionalDeparture');
  assert.match(body, /if \(bowFirst === true\) \{\n\s*if \(distM > alarmRadiusM && sogKt > _INTENTIONAL_BOW_FIRST_MIN_SOG_KT\)/);
  assert.match(body, /\} else if \(bowFirst === null\) \{\n\s*if \(sogKt > _INTENTIONAL_DEP_SOG_KT\)/);
  assert.doesNotMatch(src, /_isAnyMotorRunning/);
  assert.match(src, /const _INTENTIONAL_BOW_FIRST_DUR_MS = 15_000;/);
  assert.match(src, /const _INTENTIONAL_BOW_FIRST_MAX_DEG = 45;/);
});

// Rev901 (audit D02, D03, D10, D11, Gemini #8): static checks on the alarm
// paths that live inside the plugin closure.
test('gps lost: counted from the first tick without a fix after a restart', () => {
  const src = readFileSync(indexTs, 'utf8');
  assert.doesNotMatch(src, /if \(_gpsLastValidMs === 0\) return;/);
  assert.match(src, /now - \(_gpsLastValidMs \|\| _gpsNoFixSinceMs\)/);
});

test('grounding: real alarm starts and stops Pi audio, no tide data never clears it', () => {
  const src = readFileSync(indexTs, 'utf8');
  assert.match(src, /lastGroundingNotifState = "alarm";\n[^]*?_groundingAlarmRef\?\.start\(\)/);
  assert.match(src, /!\(tideUnknown && lastGroundingNotifState === "alarm" && enabled && !isSnoozed\)/);
  assert.doesNotMatch(src, /If we can't compute, treat as no risk/);
});

test('grounding: the alarm-button silence is the same state the evaluator reads', () => {
  const src = readFileSync(indexTs, 'utf8');
  const start = src.indexOf('function _silenceGrounding(');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  assert.match(body, /emitNotificationClear\(\)/);
  assert.match(src, /_silenceActive\(snoozeUntilMs, GROUNDING_SNOOZE_MAX_MIN\) \|\| \(_groundingAlarmRef\?\.silenced\(\) \?\? false\)/);
});

test('silences: bounded against a clock jumping backwards, snooze max 2 h', () => {
  const src = readFileSync(indexTs, 'utf8');
  assert.match(src, /const GROUNDING_SNOOZE_MAX_MIN = 120;/);
  assert.match(src, /return left > 0 && left <= maxMin \* 60_000;/);
  assert.doesNotMatch(src, /Math\.min\(24 \* 60, Number\(req\.body\?\.minutes\)/);
});

// Rev904 (GPT suspicion, confirmed): routes registered in start() survive a
// stop()/start(); handlers from earlier starts must hand over to the
// current one.
test('routes: handlers from an earlier start pass the request on', () => {
  const src = readFileSync(indexTs, 'utf8');
  assert.match(src, /myGen === _routeGeneration \? fn\(req, res, next\) : next\("route"\)/);
  assert.match(src, /const expressApp = _routesForThisStart\(app as any\);/);
  assert.doesNotMatch(src, /const expressApp = app as any;/);
});

// Rev905 (audit zone 1, D1/D2): an AIS ACK is dropped when the boat gets
// 15 m closer to the anchor or stays out of the circle 2 min; a sounder is
// "frozen" only after 10 min without a 2 cm change.
// Rev908: the ACK lasts the whole anchorage; it drops only when the boat
// gets 15 m closer to the anchor than the own boat has meanwhile (a rafted
// friend or a neighbour swinging alongside moves like the own boat).
test('ais: ACK dropped only when the target closes in more than the own boat', () => {
  const src = readFileSync(indexTs, 'utf8');
  assert.match(src, /const AIS_ACK_CLOSER_M = 15;/);
  assert.match(src, /const closer = \(base\.target - t\.dAis\) - \(base\.own - dist\);/);
  assert.match(src, /if \(closer >= AIS_ACK_CLOSER_M\) why = /);
  assert.doesNotMatch(src, /AIS_ACK_OUT_MS/, 'no more expiry for being out of the circle');
  assert.doesNotMatch(readFileSync(new URL('../public/mobile.html', import.meta.url), 'utf8'), /_AIS_ACK_TTL_MS=/, 'no more 15 min expiry in the viewer');
});

test('depth: frozen only after 10 min without a 2 cm change', () => {
  const src = readFileSync(indexTs, 'utf8');
  assert.match(src, /const DEPTH_FROZEN_MIN_SPAN_MS = 10 \* 60_000;/);
  assert.match(src, /if \(now - _depthLastChange\.ts >= DEPTH_FROZEN_MIN_SPAN_MS\)/);
});
