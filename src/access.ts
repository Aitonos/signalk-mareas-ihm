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

// ── middleware ───────────────────────────────────────────────────────────
//   - Capa OFF → next().
//   - Capa ON + cookie PIN válida → next().
//   - Capa ON sin cookie → 401 LOCKED.
export function requireControlAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!_securityLayerEnabled) { next(); return; }
  const pinCheck = (globalThis as any)._ihmPinSessionCheck;
  if (typeof pinCheck === "function") {
    const r = pinCheck(req);
    if (r && r.valid) { next(); return; }
  }
  res.status(401).json({ ok: false, error: "LOCKED" });
}
