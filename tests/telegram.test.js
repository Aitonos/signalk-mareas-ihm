// Characterization test for Telegram message formatting — dragging
// (production kind: "garreo"). Uses node:test. Locks Spanish baseline;
// does not exercise sendTelegram.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const telegramJs = resolve(root, 'dist/telegram.js');

/** Production message kind for anchor drag (Spanish key kept until i18n rename). */
const DRAGGING_KIND = 'garreo';

const EXPECTED_DRAGGING_TEXT_ES =
  '⚠️ *GARREO* detectado.\nDistancia: 80 m (radio alarma: 50 m).\nEl barco se mueve fuera del fondeo.';

const EXPECTED_DRAGGING_TEXT_EN =
  '⚠️ *ANCHOR DRAG* detected.\nDistance: 80 m (alarm radius: 50 m).\nVessel is moving outside the swing circle.';

async function loadTelegram() {
  assert.ok(
    existsSync(telegramJs),
    'dist/telegram.js missing — run `npx tsc -b tsconfig.node.json` (or npm run build) first',
  );
  return import(pathToFileURL(telegramJs).href);
}

test('dragging: formatTelegramMessage returns the Spanish garreo text', async () => {
  // --- Arrange ---
  const { formatTelegramMessage } = await loadTelegram();
  const distanceM = 80;
  const alarmRadiusM = 50;
  const lang = 'es';

  // --- Act ---
  const draggingText = formatTelegramMessage(
    DRAGGING_KIND,
    { distM: distanceM, radM: alarmRadiusM },
    lang,
  );

  // --- Assert ---
  assert.equal(draggingText, EXPECTED_DRAGGING_TEXT_ES);
});

test('dragging: formatTelegramMessage returns the English drag text', async () => {
  // --- Arrange ---
  const { formatTelegramMessage } = await loadTelegram();
  const distanceM = 80;
  const alarmRadiusM = 50;
  const lang = 'en';

  // --- Act ---
  const draggingText = formatTelegramMessage(
    DRAGGING_KIND,
    { distM: distanceM, radM: alarmRadiusM },
    lang,
  );

  // --- Assert ---
  assert.equal(draggingText, EXPECTED_DRAGGING_TEXT_EN);
});
