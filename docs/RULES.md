# RULES — Reglas del asistente (Claude Code) para este repo

Leer estas reglas SIEMPRE antes de actuar. Lecciones aprendidas de fallos previos.

## Reglas de conducta — para no volver a cagarla

### R1 — NO marcar tarea ✓ sin verificación end-to-end

- Una tarea no se "termina" hasta haber abierto el navegador en al menos un device y haber visto la feature funcionar.
- Si la feature involucra varios devices (multi-device sync), abrir DOS ventanas / o pedir al usuario QA en su tablet+portátil.
- Si no se puede verificar end-to-end por restricción técnica, marcar **⚠️ NO VERIFICADO** explícito y decirlo al usuario.

### R2 — NO decir "done" si el state delta no llegó al otro device

- En features de multi-device sync, confirmar visualmente o por logs que el SSE event llega al device B.
- No vale "el endpoint backend funciona y devuelve 200 OK".

### R3 — Auditar TODAS las instrucciones antes de actuar

- Antes de tocar código, leer `docs/Q_AND_A.md`, `docs/KNOWN_BUGS.md`, `docs/BACKLOG.md`.
- Revisar los memory files relevantes para no romper invariantes.
- Si una instrucción del usuario es ambigua, **preguntar antes de codear** — no "interpretar".

### R4 — "Como en RevN" = EXACTO, no aproximado

- Si el usuario dice "como estaba antes" o "como en RevX", buscar el código de esa rev en git history o backup y reproducir EXACTAMENTE.
- No mejorar "creativamente" sin permiso.

### R5 — Una sola cosa por commit, testable individualmente

- Si un commit toca dos features, partirlo en dos commits.
- Cada commit debe tener QA verificable en una sola dimensión.

### R6 — Backend es la fuente de la verdad (Q-N)

- Cualquier state crítico va en backend. Frontend solo lee + reenvía acciones.
- Si añades un campo de state local en el visor, JUSTIFICAR por qué no va en backend.

### R7 — No interpretar "olvida" como "déjalo y haz otra cosa"

- "Olvida" = **descarte definitivo**. Quitar de TODOS los listados de pendientes.
- Si vuelvo a listar algo descartado, el usuario se cabrea con razón.

### R8 — No romper lo que funciona "por limpiar"

- Si una feature está marcada como DONE en `BACKLOG.md`, no tocarla salvo orden explícita.
- Caso histórico: Rev190 quité botones de TidesView "por limpiar" cuando ya funcionaban → se rompió.

### R9 — Persona, tono y comunicación

- Tono: profesional directo, sin emojis en el chat (salvo en la UI del producto).
- Sin "voy a hacer X y luego Y" verbose: hacer X, reportar resultado.
- Si un sprint tiene 5 commits, no escribir un essay de 800 líneas explicando — hacer commit 1, decir "commit 1 done, QA: pulsa X verifica Y", esperar OK.
- Memoria `feedback_persona` decía "junior dev enthusiastic" pero el usuario descartó (Q-AH "OLVIDA"). Tono actual: serio, eficiente, sin chácharas.

### R10 — Errores comunes que tengo que dejar de cometer

| Error | Cómo evitarlo |
|---|---|
| Marcar como DONE sin abrir browser | Aplicar R1, R2 |
| Decir "X intact" sin verificar | Buscar en código + abrir y testar |
| Mover features sin permiso explícito | Releer instrucción 2 veces, preguntar si ambigüedad |
| Listar items descartados como "pendientes" | Aplicar R7 |
| Romper features funcionando "por limpiar" | Aplicar R8 |
| Hacer batches de 15 cambios sin testar ninguno | Aplicar R5 |
| Inventar interpretaciones de frases del usuario | Aplicar R3 — preguntar |

## Reglas técnicas — repo-específicas

### Toolchain

- **Plataforma**: Windows 11, PowerShell 5.1 (no PowerShell 7+).
- **Shell scripts**: ASCII-only en `.ps1` (PS 5.1 lee Windows-1252).
- **Check `$LASTEXITCODE`** después de cada ejecutable nativo (npm, git, ssh, scp, rsync). `$ErrorActionPreference=Stop` NO cubre exe nativos.
- **Build local**: `npm run build` en el portátil. NO en la Pi.
- **Deploy default**: `.\deploy.ps1 -Restart`.

### Git

- Branch único `main`. No develop, no staging.
- Commits descriptivos: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`.
- NUNCA `--no-verify`, `--no-gpg-sign` salvo orden explícita.
- NUNCA force push a main.
- Solo commitear cuando el usuario lo pida.

### NPM publish

- Solo cuando el usuario lo pida explícitamente.
- Pre-flight: bump `package.json` version + `PLUGIN_REVISION` en `src/index.ts`.
- Smoke test con `.\deploy.ps1 -Restart` antes de `npm publish`.

### Memoria de proyecto

- Leer todos los memory files en `C:\Users\bybek\.claude\projects\c--Users-bybek-Downloads-signalk-mareas-ihm-Beta1-3-1-Rev40-signalk-mareas-ihm\memory\` al inicio de cada sesión.
- Si una observación nueva contradice memoria existente, ACTUALIZAR la memoria.
- No iterar en áreas marcadas con `hardware ceiling` u `out of scope`.

### Tono al hablar con el usuario

- Español por defecto, el código en inglés salvo strings UI.
- Sin "Voy a hacer X..." narrativas. Hacer X, reportar.
- Si pido QA, dar pasos numerados claros, no parrafadas.

### Convenciones de código

- TypeScript ESM (`module: nodenext`).
- React + Vite para TidesView.
- HTML/JS vanilla para mobile.html y mapafondeo.html.
- Sin Tailwind en mobile.html (CSS inline + media queries).
- Body classes para variantes: `body.mobile-ui`, `body.m-pi-browser`, `body.m-desktop-landscape`.

### Antes de tocar features ya marcadas DONE

1. Releer `docs/BACKLOG.md` sección "Confirmados DONE".
2. Releer la sección correspondiente en `docs/KNOWN_BUGS.md` para confirmar no es bug activo.
3. Si hay duda, preguntar al usuario.

### NUNCA hacer

- `sudo apt install X` desde código del plugin (memoria minimal_deps).
- Referenciar apps comerciales en código/comentarios/UI/commits (memoria no_commercial_refs).
- Iterar más en software gain del Pi audio (memoria audio_hardware_ceiling).
- Usar `<pi-ip>` en URLs de ejemplo — siempre `localhost` (memoria use_localhost).

### CUANDO un fix toque src/index.ts (backend)

1. Bump `PLUGIN_REVISION` a la siguiente Rev (e.g. `Rev191`).
2. `.\deploy.ps1 -Restart`.
3. Esperar ~15s reinicio SK.
4. Verificar `journalctl -u signalk -f` no muestra errors en startup del plugin.
5. Verificar `http://localhost:3000/signalk-mareas-ihm/visorfondeo` carga.

## Reglas de comunicación con el usuario

### Al pedir QA al usuario

- Dar pasos NUMERADOS claros.
- Decir QUÉ dispositivo usar (tablet, portátil, Pi local).
- Decir QUÉ esperar como resultado.
- Pedir reporte por NÚMERO (e.g. "1 OK / 2 KO descripción").

### Al reportar progreso

- Resumen al final de cada commit en 1-2 frases.
- Diff link / file:line links Markdown clickables.
- Próximo paso explícito.

### Al recibir feedback negativo

- NO defenderse. Aceptar.
- Releer instrucción original.
- Pedir clarificación si ambigüedad.
- Aplicar R10 (errores comunes).

### Al hacer review/audit

- Pedir verificación dispositivo a dispositivo (tablet, portátil, Pi local).
- No asumir nada está bien sin haberlo testado.
