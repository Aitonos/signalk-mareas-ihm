/*
 * Boat-global UI language resolution (Rev766+).
 * Same source-of-truth as Pi voice and Telegram push copy.
 */

export type BoatLang = "es" | "en";

export const DEFAULT_BOAT_LANG: BoatLang = "es";

export interface LangStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

function isBoatLang(value: unknown): value is BoatLang {
  return value === "es" || value === "en";
}

/**
 * Resolve language from plugin props, persisted cache, or config file.
 * Priority: props > cache > config > default ("es").
 */
export async function resolveBoatLang(
  storage: LangStorage | null | undefined,
  options: {
    propsLang?: unknown;
    configLang?: unknown;
  } = {},
): Promise<BoatLang> {
  const propLang = String(options.propsLang ?? "").toLowerCase();
  if (isBoatLang(propLang)) return propLang;

  if (storage) {
    try {
      const cached = await storage.get("lang");
      if (isBoatLang(cached)) return cached;
    } catch {
      /* ignore */
    }
  }

  if (isBoatLang(options.configLang)) return options.configLang;

  return DEFAULT_BOAT_LANG;
}
