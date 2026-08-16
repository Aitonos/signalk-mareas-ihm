/**
 * Rev875 (issue #40 follow-up refactor): patrón de backoff exponencial
 * con dos regímenes (normal y rate-limit) más jitter, extraído de los
 * 3 clientes AIS online (aisstream, aishub, aisfriends) que lo tenían
 * duplicado en ~120 líneas por fichero.
 *
 * Diseño validado en producción por el fix del issue #40 (2.11.5): un
 * único régimen agresivo (retry cada 60 s tras HTTP 429) causaba que la
 * ventana rate-limit del servidor se autoperpetuase, dejando al cliente
 * silencioso durante días. La solución es un backoff separado y mucho
 * más largo (60 s → 30 min) que se activa al detectar 429/403/5xx y se
 * resetea solo al primer éxito real end-to-end.
 *
 * Uso típico:
 *
 *     const b = new BackoffScheduler({
 *       normalMinMs: 5_000, normalMaxMs: 60_000,
 *       rateLimitMinMs: 60_000, rateLimitMaxMs: 30 * 60_000,
 *     });
 *
 *     async function loop() {
 *       const res = await tryOnce();
 *       if (res.ok) b.onSuccess();
 *       else if (res.rateLimited) b.onRateLimit();
 *       else b.onTransientError();
 *       setTimeout(loop, b.nextDelay());
 *     }
 *
 * El scheduler es puro: no gestiona el timer por ti (el llamante
 * decide setTimeout / setInterval / event-driven). Solo devuelve el
 * delay que debería usarse para el próximo intento y mantiene el
 * estado interno.
 */

export interface BackoffOptions {
  /** Delay base (ms) para el régimen normal — se dobla ante errores
   *  transitorios hasta normalMaxMs. */
  normalMinMs: number;
  /** Cap para el régimen normal. */
  normalMaxMs: number;
  /** Delay base (ms) al entrar en rate-limit backoff (primer 429). */
  rateLimitMinMs: number;
  /** Cap para el régimen rate-limit. */
  rateLimitMaxMs: number;
  /** Jitter como fracción (±). Default 0.2 (±20%). Poner 0 para
   *  desactivar (útil en tests deterministas). */
  jitterFraction?: number;
  /** Suelo mínimo del delay tras aplicar jitter. Default 1_000 ms.
   *  Evita spam accidental si el min queda muy bajo con jitter negativo. */
  minDelayMs?: number;
  /** Fuente de aleatoriedad para el jitter. Default Math.random.
   *  Inyectable para tests determinísticos. */
  random?: () => number;
}

export interface BackoffSnapshot {
  /** ¿Está el scheduler en régimen rate-limit? */
  rateLimitBackoffActive: boolean;
  /** Delay actual (sin jitter aplicado todavía). */
  currentMs: number;
  /** ms hasta el próximo intento programado (o 0 si no hay). */
  nextAttemptInMs: number;
}

export class BackoffScheduler {
  private readonly normalMinMs: number;
  private readonly normalMaxMs: number;
  private readonly rateLimitMinMs: number;
  private readonly rateLimitMaxMs: number;
  private readonly jitterFraction: number;
  private readonly minDelayMs: number;
  private readonly random: () => number;

  private currentMs: number;
  private inRateLimit = false;
  private nextAttemptAtMs = 0;

  constructor(opts: BackoffOptions) {
    this.normalMinMs = opts.normalMinMs;
    this.normalMaxMs = opts.normalMaxMs;
    this.rateLimitMinMs = opts.rateLimitMinMs;
    this.rateLimitMaxMs = opts.rateLimitMaxMs;
    this.jitterFraction = opts.jitterFraction ?? 0.2;
    this.minDelayMs = opts.minDelayMs ?? 1_000;
    this.random = opts.random ?? Math.random;
    this.currentMs = this.normalMinMs;
  }

  /** Marca el intento actual como exitoso. Resetea a régimen normal min. */
  onSuccess(): void {
    this.inRateLimit = false;
    this.currentMs = this.normalMinMs;
  }

  /** Marca detección de rate-limit (HTTP 429, WebSocket handshake rechazado
   *  con 429, etc.). Cambia a régimen rate-limit. Llamadas subsiguientes
   *  doblan el delay hasta rateLimitMaxMs. */
  onRateLimit(): void {
    if (!this.inRateLimit) {
      this.inRateLimit = true;
      this.currentMs = this.rateLimitMinMs;
    } else {
      this.currentMs = Math.min(this.rateLimitMaxMs, this.currentMs * 2);
    }
  }

  /** Marca error transitorio no relacionado con rate-limit (red caída,
   *  DNS, TCP timeout). Dobla el delay dentro del régimen actual. */
  onTransientError(): void {
    const cap = this.inRateLimit ? this.rateLimitMaxMs : this.normalMaxMs;
    this.currentMs = Math.min(cap, this.currentMs * 2);
  }

  /** Calcula el delay a usar para el próximo intento (con jitter aplicado)
   *  y actualiza el estado nextAttemptAtMs. */
  nextDelay(now: number = Date.now()): number {
    const j = this.jitterFraction;
    const jitter = j === 0 ? 1 : (1 + (this.random() * 2 * j - j));
    const wait = Math.max(this.minDelayMs, Math.round(this.currentMs * jitter));
    this.nextAttemptAtMs = now + wait;
    return wait;
  }

  /** Snapshot para diagnóstico / getStats(). */
  getSnapshot(now: number = Date.now()): BackoffSnapshot {
    return {
      rateLimitBackoffActive: this.inRateLimit,
      currentMs: this.currentMs,
      nextAttemptInMs: Math.max(0, this.nextAttemptAtMs - now),
    };
  }
}
