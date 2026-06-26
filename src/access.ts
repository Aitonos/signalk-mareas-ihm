// src/access.ts — Capa de acceso (Rev575, feedback Carlos 2026-06-26).
//
// Resuelve el contexto de autorización para cada petición HTTP del plugin
// consultando al middleware oficial de Signal K vía `/skServer/loginStatus`
// (self-loop a localhost con la cookie del request).
//
// Diseño:
//   - Toggle global `securityLayerEnabled` (persistido en ihmCache,
//     default OFF). Cuando OFF → el plugin se comporta exactamente igual que
//     antes de Rev575 (compatibilidad cero-impacto para usuarios solos).
//   - Cuando ON → cada petición resuelve un AccessContext basado en
//     `/skServer/loginStatus` y `requireControlAccess` rechaza 401/403 las
//     mutaciones sin permiso.
//   - Cache en memoria por cookie con TTL 5 s para no machacar el self-call.
//   - No decodificamos JWT ni inspeccionamos sesiones — toda la decisión
//     viene del propio middleware de Signal K.

// No importamos tipos de express para no añadir @types/express como dep
// (memoria feedback_minimal_deps). Las rutas del plugin ya usan `any`
// en sus handlers — coherencia mantenida.
type Request = any;
type Response = any;
type NextFunction = (err?: any) => void;

export type AccessLevel =
  | "security-disabled"
  | "anonymous"
  | "readonly"
  | "readwrite"
  | "admin"
  | "unknown";

export interface AccessContext {
  securityEnabled: boolean;
  authenticated: boolean;
  username: string | null;
  level: AccessLevel;
  canRead: boolean;
  canControl: boolean;
}

interface SkLoginStatus {
  status?: "loggedIn" | "notLoggedIn" | string;
  type?: "readonly" | "readwrite" | "admin" | string;
  username?: string;
  readOnlyAccess?: boolean;
  authenticationRequired?: boolean;
  securityWasEnabled?: boolean;
  allowNewUserRegistration?: boolean;
  allowDeviceAccessRequests?: boolean;
}

// ── toggle persistido ────────────────────────────────────────────────────
let _securityLayerEnabled = false;
export function setSecurityLayerEnabled(v: boolean): void {
  _securityLayerEnabled = !!v;
  // Cambio del toggle invalida la cache para que la siguiente petición
  // refleje inmediatamente el nuevo estado.
  _cache.clear();
}
export function getSecurityLayerEnabled(): boolean {
  return _securityLayerEnabled;
}

// ── cache por cookie ─────────────────────────────────────────────────────
interface CacheEntry { ctx: AccessContext; expires: number; }
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000;

function cookieKey(cookieHeader: string | undefined): string {
  return cookieHeader || "_no_cookie_";
}

// ── self-call a /skServer/loginStatus ────────────────────────────────────
async function fetchLoginStatus(req: Request): Promise<SkLoginStatus | null> {
  // Puerto del servidor SK actual (el mismo donde escucha esta petición).
  const port = (req.socket as any)?.localPort ?? 3000;
  const url = `http://localhost:${port}/skServer/loginStatus`;
  const cookieHeader = req.headers.cookie as string | undefined;
  try {
    const r = await fetch(url, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    if (!r.ok) return null;
    return (await r.json()) as SkLoginStatus;
  } catch {
    return null;
  }
}

// ── normalización loginStatus → AccessContext ────────────────────────────
function mapLoginStatus(s: SkLoginStatus | null): AccessContext {
  // Error de detección → comportamiento seguro (lectura sí, mutación no).
  if (!s) {
    return {
      securityEnabled: true,
      authenticated: false,
      username: null,
      level: "unknown",
      canRead: true,
      canControl: false,
    };
  }
  // Signal K marca authenticationRequired=true cuando la seguridad está ON.
  // securityWasEnabled refleja si alguna vez se activó (no es suficiente solo).
  const securityEnabled =
    !!s.authenticationRequired || !!s.securityWasEnabled;
  if (!securityEnabled) {
    return {
      securityEnabled: false,
      authenticated: false,
      username: null,
      level: "security-disabled",
      canRead: true,
      canControl: true,
    };
  }
  if (s.status !== "loggedIn") {
    return {
      securityEnabled: true,
      authenticated: false,
      username: null,
      level: "anonymous",
      canRead: true,
      canControl: false,
    };
  }
  const type = String(s.type ?? "").toLowerCase();
  let level: AccessLevel = "unknown";
  let canControl = false;
  if (type === "admin")      { level = "admin";     canControl = true;  }
  else if (type === "readwrite") { level = "readwrite"; canControl = true;  }
  else if (type === "readonly")  { level = "readonly";  canControl = false; }
  return {
    securityEnabled: true,
    authenticated: true,
    username: s.username ?? null,
    level,
    canRead: true,
    canControl,
  };
}

// ── API pública ──────────────────────────────────────────────────────────
export async function resolveAccessContext(req: Request): Promise<AccessContext> {
  // Toggle OFF → bypass total. Comportamiento de versiones anteriores intacto.
  if (!_securityLayerEnabled) {
    return {
      securityEnabled: false,
      authenticated: false,
      username: null,
      level: "security-disabled",
      canRead: true,
      canControl: true,
    };
  }
  const cookieHeader = req.headers.cookie as string | undefined;
  const key = cookieKey(cookieHeader);
  const cached = _cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.ctx;
  const status = await fetchLoginStatus(req);
  const ctx = mapLoginStatus(status);
  _cache.set(key, { ctx, expires: Date.now() + CACHE_TTL_MS });
  return ctx;
}

/**
 * Middleware para todas las rutas mutables del plugin.
 *
 * - Si securityLayerEnabled === false → next() (cero impacto).
 * - Si toggle ON y canControl → next().
 * - Si toggle ON y !canControl → 401 (anonymous) o 403 (autenticado sin
 *   permiso) con código de error estable CONTROL_ACCESS_REQUIRED.
 */
export async function requireControlAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ctx = await resolveAccessContext(req);
    if (ctx.canControl) {
      next();
      return;
    }
    const status = ctx.authenticated ? 403 : 401;
    res.status(status).json({
      ok: false,
      error: "CONTROL_ACCESS_REQUIRED",
      access: ctx,
    });
  } catch (e) {
    // Excepción inesperada → fail-closed.
    res.status(500).json({
      ok: false,
      error: "ACCESS_RESOLVER_ERROR",
      message: (e as Error)?.message ?? "unknown",
    });
  }
}
