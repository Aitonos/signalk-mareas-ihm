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
/** Rev901: after a failed send, the same kind may try again this soon. */
export const TELEGRAM_FAIL_RETRY_MS = 20_000;

export type TelegramLang = "es" | "en";

export type TelegramKind =
  | "startup"
  | "startup_autodetect"
  | "startup_connected"
  | "gps_lost"
  | "autolift"
  | "garreo"
  | "ais"
  | "grounding"
  | "test"
  | "test_alarm";

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
  /** Rev897: Telegram's answer (ok, HTTP status, its error text), so a test
   *  can tell the user why nothing arrived instead of "OK". */
  onResult?: (r: TelegramResult) => void;
  /** Injectable clock for throttle tests. */
  nowMs?: () => number;
  /** Rev899: wait before the single retry after a connection error. */
  retryDelayMs?: number;
  /** Rev901: how soon the same kind may try again after a failed send. */
  failRetryMs?: number;
}

export interface TelegramResult {
  ok: boolean;
  status: number | null;
  description: string | null;
}

/** Escape user/sensor text for legacy Markdown (an unpaired _ or * makes
 *  Telegram reject the whole message with HTTP 400). */
export function escapeTelegramMarkdown(s: string): string {
  return String(s).replace(/([_*`[])/g, "\\$1");
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
  // Rev901 (auditoría D08 + Gemini #3): the throttle is set now so two sends
  // of one kind never overlap, but a failed send only holds the kind for
  // failRetryMs instead of the full minute.
  opts.lastSent[opts.kind] = now;
  const failRetryMs = opts.failRetryMs ?? TELEGRAM_FAIL_RETRY_MS;

  const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
  const payload = JSON.stringify({
    chat_id: chatId,
    text: opts.text,
    parse_mode: "Markdown",
  });
  const request = opts.httpsRequest || (https.request.bind(https) as TelegramHttpsRequest);
  const debug = opts.onDebug || (() => { /* no-op */ });
  let reported = false;
  const report = (r: TelegramResult) => {
    if (reported) return;
    reported = true;
    if (!r.ok && opts.lastSent[opts.kind] === now) {
      opts.lastSent[opts.kind] = now - throttleMs + failRetryMs;
    }
    try { opts.onResult?.(r); } catch { /* caller bug — ignore */ }
  };

  const attempt = (retry: boolean): void => {
    let gotResponse = false;
    let failed = false; // this attempt already handled (timeout, then error)
    // Rev899: on the boat's 4G the first connection sometimes fails at once
    // and the next one works. Retry once if Telegram never answered.
    // Rev901: a timeout too: the message may arrive twice, but an alarm must
    // not be lost.
    const fail = (description: string): void => {
      if (failed) return;
      failed = true;
      if (retry && !gotResponse && !reported) {
        setTimeout(() => attempt(false), opts.retryDelayMs ?? 2000);
        return;
      }
      report({ ok: false, status: null, description });
    };
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
        gotResponse = true;
        const status = res.statusCode ?? 0;
        let body = "";
        res.on("data", (c: Buffer | string) => { if (body.length < 2000) body += c; });
        res.on("end", () => {
          let description: string | null = null;
          try { description = JSON.parse(body)?.description ?? null; } catch { /* not JSON */ }
          if (status >= 400) debug(`[IHM-TELEGRAM] sendMessage HTTP ${status}: ${description ?? ""}`);
          report({ ok: status > 0 && status < 400, status, description });
        });
      },
    );
    req.on("error", (e: Error) => {
      debug(`[IHM-TELEGRAM] send failed: ${e?.message || e}`);
      fail(String(e?.message || e));
    });
    req.on("timeout", () => {
      debug("[IHM-TELEGRAM] send timed out");
      fail("timeout");
      try { req.destroy(); } catch { /* ignore */ }
    });
    req.write(payload);
    req.end();
  };
  attempt(true);
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
  /** grounding: alarm text from the depth/tide evaluation (escaped here). */
  detail?: string;
  /** test_alarm: which alarm was simulated (garreo / grounding / ais). */
  alarm?: string;
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
        ? `🔗 Chat connected to Mareas IHM. Chat ID: \`${chatId}\``
        : `🔗 Chat conectado a Mareas IHM. Chat ID: \`${chatId}\``;
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
    case "grounding": {
      const detail = params.detail ? `\n${escapeTelegramMarkdown(params.detail)}` : "";
      return en
        ? `⚠️ *GROUNDING RISK*.${detail}`
        : `⚠️ *RIESGO DE VARADA*.${detail}`;
    }
    case "test_alarm": {
      const a = params.alarm ?? "";
      const name = en
        ? (a === "garreo" ? "anchor drag" : a === "grounding" ? "grounding" : "AIS")
        : (a === "garreo" ? "garreo" : a === "grounding" ? "varada" : "AIS");
      return en
        ? `🧪 *Alarm test* (${name}) from Mareas IHM ${revision}.\nReal alarms will arrive here too.`
        : `🧪 *Prueba de alarma* (${name}) desde Mareas IHM ${revision}.\nLas alarmas reales también llegarán aquí.`;
    }
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
