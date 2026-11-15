// src/access.ts — Capa de acceso simplificada (Rev586, feedback Carlos
// "desactiva CUALQUIER referencia a usuario de SignalK").
//
// Modelo final:
//   - Toggle global `securityLayerEnabled` (default OFF).
//   - Cuando OFF → bypass total, comportamiento pre-Rev575.
//   - Cuando ON → cada mutación requiere cookie PIN válida (cualquier nivel,
//     maestro o invitado). NO se consulta loginStatus de Signal K, NO hay
//     self-call, NO hay cache de cookies. La verificación es síncrona contra
//     el Map de sesiones expuesto por src/index.ts vía
//     `(globalThis as any)._ihmPinSessionCheck`.
//
// Rev901 (auditoría A2/D04, decisión Carlos): si Signal K tiene la seguridad
// activada, además hace falta sesión de Signal K con permiso de escritura.
// Signal K no protege /signalk-mareas-ihm/..., así que sin esto cualquiera
// en la red podía levar el ancla o silenciar el garreo. No hay self-call:
// el middleware global de Signal K (`http_authorize(false, true)` sobre '/')
// ya ha leído el token y deja req.skIsAuthenticated y req.skPrincipal.
// Sin seguridad en Signal K (estrategia dummy) todo sigue como antes.

type Request = any;
type Response = any;
type NextFunction = (err?: any) => void;

// ── toggle persistido ────────────────────────────────────────────────────
let _securityLayerEnabled = false;
export function setSecurityLayerEnabled(v: boolean): void {
  _securityLayerEnabled = !!v;
}
export function getSecurityLayerEnabled(): boolean {
  return _securityLayerEnabled;
}

// ── Signal K security ────────────────────────────────────────────────────
let _skSecurity: any = null;
export function setSkSecurityStrategy(strategy: any): void {
  _skSecurity = strategy ?? null;
}
export function skSecurityEnabled(): boolean {
  return !!_skSecurity && typeof _skSecurity.isDummy === "function" && _skSecurity.isDummy() === false;
}
export function skWriteAllowed(req: Request): boolean {
  if (!skSecurityEnabled()) return true;
  const perm = req?.skPrincipal?.permissions;
  return req?.skIsAuthenticated === true && (perm === "admin" || perm === "readwrite");
}
/** Only the Signal K check, for routes with their own PIN logic. */
export function requireSkWrite(req: Request, res: Response, next: NextFunction): void {
  if (skWriteAllowed(req)) { next(); return; }
  res.status(403).json({ ok: false, error: "SK_LOGIN_REQUIRED" });
}

// ── middleware ───────────────────────────────────────────────────────────
//   - Capa OFF → next().
//   - Capa ON + cookie PIN válida → next().
//   - Capa ON sin cookie → 401 LOCKED.
//   - Rev901: antes de todo, Signal K con seguridad y sin sesión de
//     escritura → 403 SK_LOGIN_REQUIRED.
export function requireControlAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!skWriteAllowed(req)) { res.status(403).json({ ok: false, error: "SK_LOGIN_REQUIRED" }); return; }
  if (!_securityLayerEnabled) { next(); return; }
  const pinCheck = (globalThis as any)._ihmPinSessionCheck;
  if (typeof pinCheck === "function") {
    const r = pinCheck(req);
    if (r && r.valid) { next(); return; }
  }
  res.status(401).json({ ok: false, error: "LOCKED" });
}
