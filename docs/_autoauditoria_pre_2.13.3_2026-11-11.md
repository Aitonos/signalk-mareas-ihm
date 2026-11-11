# Autoauditoría antes de 2.13.3 (Rev895-896) — 2026-11-11

Único cambio: B-A2 (ver `docs/KNOWN_BUGS.md`). Cuatro lectores de
`design.length` / `design.draft` no desenvolvían el objeto de SK.
- Cálculo de fondeo: eslora y `draftEffective`.
- Deslizador de cadena: eslora y calado.
- Publicación de `environment.tide.vessel.draft`.

## Lista (feedback_self_audit_before_publish)

1. **Qué cambia durante cada await o temporizador.** Nada nuevo: son
   lecturas síncronas de `getSelfPath`.
2. **Retorno de cada escritura.** No hay escrituras nuevas. El radio
   calculado sigue sembrando `swingRadiusOverride` solo si no había uno
   (sin cambios).
3. **Dato que falta.**
   - Sin eslora en SK: `loa` sigue `null` en el cálculo (como antes) y 12 m
     en el deslizador (como antes).
   - Sin calado: `null`, o el de la caché.
4. **Reinicio.** Sin estado nuevo.
5. **Cambio visible.**
   - El radio de borneo y el radio de la alarma salen 1 eslora más grandes
     en el próximo fondeo. Es el diseño documentado (radio total = radio
     desde la proa + eslora), que ya usaba el borneo predictivo.
   - Un fondeo en curso con radio guardado no cambia hasta que se
     recalcula o se mueve el deslizador.
6. **Permiso.** Sin cambios.
7. **Bucles.** Ninguno.
8. **Tests.**
   - 93/93.
   - En la Pi, con el ancla arriba y sonda manual de 5 m: `loa` 9,
     `swingRadiusMax` de 29,42 a 38,42, radio por popa y diámetro
     rellenos, `draftEffective` 1,85.
   - El `swingRadiusOverride` que dejaron las pruebas se devolvió a
     `null` con SK parado.

**Pendiente de QA en agua:** `docs/QA_PENDIENTE.md` (QA Rev896).
