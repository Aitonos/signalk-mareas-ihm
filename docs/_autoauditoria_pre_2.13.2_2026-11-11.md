# Autoauditoría antes de 2.13.2 (Rev893-894) — 2026-11-11

Único cambio de código desde v2.13.1: B-A1 (ver `docs/KNOWN_BUGS.md`).
- El indicativo se escribe como el admin de SK (en el objeto raíz).
- Eslora, calado y tipo AIS van en forma canónica.
- Migración en el arranque de las entradas antiguas de `baseDeltas.json`.

## Lista (feedback_self_audit_before_publish)

1. **Qué cambia durante cada await o temporizador.**
   - La migración es síncrona, una sola vez al arrancar.
   - El POST no añade awaits nuevos.
2. **Retorno de cada escritura.**
   - Migración en try/catch, con un mensaje de depuración si falla.
   - `saveSync` solo si `baseDeltas.json` existe en la ruta calculada.
3. **Dato que falta.**
   - Sin editor de deltas base (SK antiguo): no hace nada.
   - Si la forma buena ya existe, no se pisa: solo se borra la entrada
     antigua.
4. **Reinicio.**
   - Hay que arrancar dos veces para que desaparezca el error: SK carga el
     fichero antes de que arranque el plugin. Verificado así en la Pi.
5. **Identidad.**
   - Indicativo en el objeto raíz `communication: {callsignVhf}`; en vivo,
     `path: ""` + objeto (memoria `project_sk_identity_path_empty`).
   - Nombre y MMSI sin cambios.
6. **Permiso.** El POST mantiene `requireControlAccess`.
7. **Bucles.** Ninguno.
8. **Tests.**
   - 93/93.
   - En la Pi:
     - copia previa en `~/.signalk/baseDeltas.json.bak-rev893`;
     - primer arranque: fichero corregido (log `[IHM-VBD] ... moved`);
     - segundo arranque: 0 `TypeError`, y el indicativo sigue en
       `/signalk/v1/api/vessels/self/communication`.

**POST vessel-base probado en la Pi (Rev894):**
- Con los mismos valores (indicativo, eslora, calado, tipo 36): `applied`
  de los 4 campos y 0 `TypeError`.
- `baseDeltas.json` queda con la forma del admin.
- El GET del wizard devuelve los mismos valores.
