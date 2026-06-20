# SPRINTS PENDIENTES — Post Rev 39

## Sprint A — Bienvenida + WebApp unificada
**Modifica:** `public/index.html`, `app/App.tsx`
- Al abrir la WebApp, mostrar ventana inicial de bienvenida con selector: "Ir a Mareas" / "Ir a Visor de Fondeo"
- Elimina necesidad de webapp independiente; una sola entrada
- **Riesgo:** Bajo

## Sprint B — Sincronización multi-dispositivo (SSE/WebSocket)
**Modifica:** `src/index.ts`, `public/mapafondeo.html`
- Implementar Server-Sent Events (SSE) en backend para propagar cambios en tiempo real
- Todos los clientes conectados reciben actualizaciones instantáneas de: alarmas, ancla, cadena, radios
- Reemplazar polling 5s por SSE para datos críticos
- **Riesgo:** Alto — cambio arquitectónico significativo

## Sprint C — Cadena ↔ Borneo bidireccional
**Modifica:** `src/index.ts`, `public/mapafondeo.html`, `app/views/TidesView.tsx`
- Slider borneo en visor actualiza cálculo de fondeo en TidesView y viceversa
- Backend persiste valor único, ambos frontends leen/escriben
- **Riesgo:** Medio

## Sprint D — Responsive profundo TidesView (React)
**Modifica:** `app/views/TidesView.tsx`, `app/App.css`
- Media queries para móvil/tablet
- Restructuración de layout para pantallas estrechas
- Scroll donde sea necesario, sin solapamientos
- **Riesgo:** Medio

## Sprint E — Trigger ancla para domótica
**Modifica:** `src/index.ts`, instrucciones
- Definir endpoints REST claros para fondear/levar: `POST /api/anchor-watch/drop` y `/lift`
- Documentar como triggers para: Zigbee/MQTT, Alexa, Google/Gemini, mandos a distancia
- Formato de petición simple para integración fácil
- **Riesgo:** Bajo

## Sprint F — Selector idioma en visor de fondeo
**Modifica:** `public/mapafondeo.html`
- Dos banderas (ES/EN) a la derecha de la barra de escala
- Cambiar todos los textos del visor según idioma seleccionado
- Persistir en localStorage
- **Riesgo:** Medio

## Sprint G — Instrucciones actualizadas
**Modifica:** `app/views/TidesView.tsx` (instrucciones)
- Actualizar toda la documentación a la nueva posición de botones
- Documentar: Panel de Alarmas unificado, 3 botones superiores (Calc Sonda/Fondeo/Curvas)
- Documentar: capas online (Esri, Bing, SonarChart, Google, IHM)
- Documentar: trigger domótica para fondear/levar
- **Riesgo:** Bajo

## Sprint H — Actualizar documentación de proyecto
**Modifica:** `ARCHITECTURE.md`, `ROADMAP.md`, `PENDIENTES_CONSOLIDADO.md`, `PROJECT_RULES.md`
- Actualizar a Rev 39+ con todas las nuevas funcionalidades
- Checkpoints de verificación por sprint
- Comandos de instalación actualizados
- **Riesgo:** Bajo

## Futuro — Anchoring Tool (APP independiente internacional)
- Spinoff del visor de fondeo como app independiente
- Nombre: "Anchoring Tool" (versión internacional)
- Requiere instalar Mareas-IHM como backend, pero UI propia
- Datos de mareas internacionales (fuentes globales, no solo IHM)
- Análisis de viabilidad en proyecto separado
- **Riesgo:** Alto — proyecto nuevo

## Orden recomendado
| Orden | Sprint | Qué resuelve | Riesgo |
|-------|--------|--------------|--------|
| 1º | Sprint A | Bienvenida unificada | Bajo |
| 2º | Sprint G | Instrucciones actualizadas | Bajo |
| 3º | Sprint H | Docs de proyecto | Bajo |
| 4º | Sprint E | Trigger domótica | Bajo |
| 5º | Sprint F | Idioma visor fondeo | Medio |
| 6º | Sprint C | Cadena bidireccional | Medio |
| 7º | Sprint D | Responsive React | Medio |
| 8º | Sprint B | SSE multi-dispositivo | Alto |
