/*
 * Telegram push alerts (Rev166+).
 *
 * sendTelegram() is language-agnostic: it only POSTs a ready-made Markdown
 * string. formatTelegramMessage() picks ES/EN copy from the caller's lang
 * (typically _currentLang in index.ts — same boat-global setting as Pi voice).
 */

import https from "https";
import type { ClientRequest, IncomingMessage, RequestOptions } from "http";

export const TELEGRAM_THROTTLE_MS = 60_000;

export type TelegramLang = "es" | "en";

export type TelegramKind =
  | "startup"
  | "startup_autodetect"
  | "startup_connected"
  | "gps_lost"
  | "autolift"
  | "garreo"
  | "ais"
  | "test";

/** Injectable https.request for tests. */
export type TelegramHttpsRequest = (
  url: string | URL,
  options: RequestOptions,
  callback?: (res: IncomingMessage) => void,
) => ClientRequest;

export interface TelegramSendOptions {
  botToken: string;
  chatId: string;
  kind: string;
  text: string;
  lastSent: Record<string, number>;
  throttleMs?: number;
  /** Defaults to https.request. Pass a mock in unit tests. */
  httpsRequest?: TelegramHttpsRequest;
  onDebug?: (msg: string) => void;
  /** Injectable clock for throttle tests. */
  nowMs?: () => number;
}

/**
 * POST a Markdown message to Telegram sendMessage.
 * Returns true if a request was issued, false if skipped (missing creds / throttle).
 * No language dependency — pass an already-localized `text`.
 */
export function sendTelegram(opts: TelegramSendOptions): boolean {
  const botToken = String(opts.botToken || "").trim();
  const chatId = String(opts.chatId || "").trim();
  if (!botToken || !chatId) return false;

  const now = (opts.nowMs || Date.now)();
  const throttleMs = opts.throttleMs ?? TELEGRAM_THROTTLE_MS;
  if (now - (opts.lastSent[opts.kind] || 0) < throttleMs) {
    return false;
  }
  opts.lastSent[opts.kind] = now;

  const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
  const payload = JSON.stringify({
    chat_id: chatId,
    text: opts.text,
    parse_mode: "Markdown",
  });
  const request = opts.httpsRequest || (https.request.bind(https) as TelegramHttpsRequest);
  const debug = opts.onDebug || (() => { /* no-op */ });

  const req = request(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload).toString(),
      },
      timeout: 8000,
    },
    (res: IncomingMessage) => {
      if ((res.statusCode ?? 0) >= 400) {
        debug(`[IHM-TELEGRAM] sendMessage HTTP ${res.statusCode}`);
      }
      res.on("data", () => { /* drain */ });
    },
  );
  req.on("error", (e: Error) => debug(`[IHM-TELEGRAM] send failed: ${e?.message || e}`));
  req.on("timeout", () => {
    try { req.destroy(); } catch { /* ignore */ }
  });
  req.write(payload);
  req.end();
  return true;
}

/** Params used by Telegram message templates. */
export type TelegramMessageParams = {
  revision?: string;
  chatId?: string;
  elapsedSec?: number;
  sogKt?: number;
  distM?: number;
  radM?: number;
};

/**
 * Build localized Telegram Markdown for a given kind.
 * Default lang is "es" (historical production baseline).
 */
export function formatTelegramMessage(
  kind: TelegramKind,
  params: TelegramMessageParams = {},
  lang: TelegramLang = "es",
): string {
  const en = lang === "en";
  const revision = params.revision ?? "";
  const chatId = params.chatId ?? "";
  const elapsedSec = params.elapsedSec ?? 0;
  const sogKt = (params.sogKt ?? 0).toFixed(1);
  const distM = params.distM ?? 0;
  const radM = params.radM ?? 0;

  switch (kind) {
    case "startup_autodetect":
      return en
        ? (
          `🚀 *Bot connected* — Mareas IHM ${revision}.\n` +
          `Chat ID auto-detected: \`${chatId}\`.\n` +
          `Alarms (drag / AIS / grounding) will arrive here when they fire.`
        )
        : (
          `🚀 *Bot conectado* — Mareas IHM ${revision}.\n` +
          `Chat ID auto-detectado: \`${chatId}\`.\n` +
          `Las alarmas (garreo / AIS / varada) llegarán aquí cuando se disparen.`
        );
    case "startup":
      return en
        ? (
          `🚀 Mareas IHM ${revision} started. ` +
          `Drag/AIS/grounding alarms will arrive here when they fire on the boat.`
        )
        : (
          `🚀 Mareas IHM ${revision} arrancado. ` +
          `Las alarmas garreo/AIS/varada llegarán aquí cuando se disparen en el barco.`
        );
    case "startup_connected":
      return en
        ? `🔗 Chat connected to Mareas IHM. chat_id=\`${chatId}\``
        : `🔗 Chat conectado a Mareas IHM. chat_id=\`${chatId}\``;
    case "gps_lost":
      return en
        ? (
          `⚠️ *GPS LOST* — no position for ${elapsedSec}s. ` +
          `Vessel is anchored; drag cannot be detected without GPS.`
        )
        : (
          `⚠️ *PÉRDIDA DE GPS* — sin posición durante ${elapsedSec}s. ` +
          `El barco está fondeado; no se puede detectar garreo sin GPS.`
        );
    case "autolift":
      return en
        ? (
          `⚓ Auto-lift on powered departure: SOG ${sogKt} kn ` +
          `sustained for 1 min. If this was real drag, re-enable the anchor watch.`
        )
        : (
          `⚓ Auto-lift por salida motorizada: SOG ${sogKt} kn ` +
          `sostenido durante 1 min. Si fue garreo real, vuelve al fondeo.`
        );
    case "garreo":
      return en
        ? (
          `⚠️ *ANCHOR DRAG* detected.\n` +
          `Distance: ${distM} m (alarm radius: ${radM} m).\n` +
          `Vessel is moving outside the swing circle.`
        )
        : (
          `⚠️ *GARREO* detectado.\n` +
          `Distancia: ${distM} m (radio alarma: ${radM} m).\n` +
          `El barco se mueve fuera del fondeo.`
        );
    case "ais":
      return en
        ? `🚢 *AIS target* inside the swing circle. Possible collision.`
        : `🚢 *Target AIS* dentro del radio de fondeo. Posible colisión.`;
    case "test":
      return en
        ? (
          `🧪 *Telegram test* from Mareas IHM ${revision}.\n` +
          `If you receive this, the bot is configured correctly and real alarms will arrive too.`
        )
        : (
          `🧪 *Test Telegram* desde Mareas IHM ${revision}.\n` +
          `Si recibes este mensaje, el bot está bien configurado y las alarmas reales también llegarán.`
        );
    default: {
      const _exhaustive: never = kind;
      return String(_exhaustive);
    }
  }
}
