# Prompt para GPT / Gemini — Detección de olas EN NAVEGACIÓN desde IMU + GPS

## Contexto

Soy desarrollador del plugin SignalK **`signalk-mareas-ihm`** para barcos
recreativos. Corre sobre Raspberry Pi 4/5 con SignalK + Node.js.

Tengo ya un motor de detección de olas **funcionando bien con barco FONDEADO**
(sin propulsión, sin gobernar). Quiero **extenderlo a NAVEGACIÓN** y publicar
los datos como **SignalK deltas** para que se puedan visualizar en KIP /
Freeboard / WilhelmSK.

Necesito ideas / algoritmos / referencias para que sea **fiable** (no
exigentemente lab-grade — sí útil para tripulación a bordo).

---

## Hardware disponible

- **IMU**: pypilot (ICM-20948 / MPU-9250 vía pypilot daemon en otra Pi), o
  conexión I2C directa al ICM-20948 / MPU-9250 en la misma Pi.
- **Datos disponibles del IMU**:
  - `attitude.pitch` y `attitude.roll` (en grados, frame del barco, ya
    compensados por pypilot — "boat is flat" calibrado).
  - `acceleration.x, y, z` (m/s², en frame del chip → necesitamos rotar al
    frame del barco con la calibración).
  - `magneticHeading` y `headingTrue` (compass).
  - Frecuencia: ~10-20 Hz típico.
- **GPS**: SOG (m/s), COG (deg true), latitud/longitud.
- **Viento aparente**: AWA, AWS (de anemómetro NMEA0183/2000).
- **Viento real**: TWA, TWS, TWD (calculado por SignalK).
- **Speed through water (STW)**: si hay log, vía paddle wheel.

---

## Algoritmo ACTUAL (anclado) — funciona bien

### 1) Intensidad cualitativa (pitch/roll RMS)
```typescript
function _waveIntensityBand(rmsDeg: number): string {
  if (rmsDeg < 0.5) return "calma";
  if (rmsDeg < 1.5) return "rizada";
  if (rmsDeg < 3.0) return "moderada";
  if (rmsDeg < 6.0) return "agitada";
  return "fuerte";
}

// Sampling pitch & roll en buffer rolling de ~120 s.
// Calcula media y RMS de pitch & roll:
const rmsP = Math.sqrt(Σ(pitch - meanP)² / n);
const rmsR = Math.sqrt(Σ(roll  - meanR)² / n);
const rmsCombined = Math.sqrt(rmsP² + rmsR²);
return _waveIntensityBand(rmsCombined);
```

### 2) Dirección del eje dominante (frame barco)
```typescript
const axisRad = Math.atan2(rmsR, rmsP);
const axisDegBoat = axisRad * 180 / Math.PI;  // 0°=head/stern, 90°=abeam
// Para compass:
const compassDeg = (meanHeading + axisDegBoat + 360) % 360;
// AMBIGUO: es un eje (línea), no un sentido — no distingo proa↔popa, babor↔estribor.
```

### 3) Período por zero-crossings
```typescript
// Eje dominante (el que tiene más RMS, pitch o roll).
// Remove DC, contar zero-crossings:
let crossings = 0;
let prevV = signal[0] - meanSignal;
for (i = 1; i < n; i++) {
  const v = signal[i] - meanSignal;
  if ((v > 0 && prevV <= 0) || (v < 0 && prevV >= 0)) {
    crossings++;
    if (firstCrossTs === 0) firstCrossTs = ts[i];
    lastCrossTs = ts[i];
  }
  prevV = v;
}
periodSec = (lastCrossTs - firstCrossTs) / 1000 / (crossings / 2);
```

### 4) Altura significativa Hs (doble integración accel — Fase 2)
```typescript
// Buffer rolling 60 s de posición vertical estimada.
// EMA low-pass de accel → componente gravedad. Resto = lineal.
// Detecto eje vertical = max |mean accel| (no asumo Z).
// Integro lineal → vel → pos con HP filter (fc = 0.05 Hz, T = 20 s) en cada etapa.
// Hs ≈ 4 × σ(pos_vertical en ventana 60 s).
const alpha = Math.min(1, 2 * Math.PI * 0.05 * dt);
meanA = (1 - alpha) * meanA + alpha * a;
const linA = a - meanA;
vel += linA * dt;
meanVel = (1 - alpha) * meanVel + alpha * vel;
const hpVel = vel - meanVel;
pos += hpVel * dt;
meanPos = (1 - alpha) * meanPos + alpha * pos;
const hpPos = pos - meanPos;
// Hs = 4 * sigma(hpPos en ventana 60 s)
```

**Limitación documentada en código**: válido SOLO con barco anclado.

---

## El reto: misma medida EN NAVEGACIÓN

Quiero publicar como SK deltas algo similar incluso cuando el barco está en
movimiento. Confounders conocidos:

### C1) Encounter period ≠ true period (Doppler de olas)
Si la ola se propaga a celeridad `c` y el barco va a velocidad `V` con
ángulo `μ` respecto a la dirección de la ola:
```
T_encounter = T_true / |1 − (V · cos(μ)) / c|
```
A 6 kt yendo contra mar de 8 s, encuentro olas cada ~5.5 s. Si la
publicamos como 5.5 s, está mal.

### C2) Heeling bajo vela contamina pitch/roll
Heel constante (e.g. 15° banda estribor en ceñida) sesga la media. Mientras
no cambie de banda, el RMS se mantiene "limpio" (solo varía la oscilación).
Pero si vira y cambia el heel, contamina.

### C3) Vibración del motor
Motor diesel a 1500 RPM = 25 Hz → muy lejos de ola (0.05-0.5 Hz). HP filter
a 1 Hz lo elimina. **Pero** turbulencias propeller/casco pueden tener
componentes en banda de ola.

### C4) Acción del timonel
Correcciones de rumbo añaden picos de yaw que se acoplan a roll/pitch (no
significativos pero visibles).

### C5) Aceleración horizontal por surge/sway
En navegación tenemos surge (avance) y sway (deriva) significativos.
Necesitamos AISLAR la heave (vertical en frame del MAR, no del barco) de
estos.

### C6) Rotación del frame barco → frame mar
El acelerómetro mide en frame chip → rotado al frame barco con calibración
"boat is flat". Pero las olas son en frame MAR (NED — North-East-Down).
Para extraer heave real, debo rotar accel(boat) → accel(mar) usando pitch,
roll y heading instantáneos.

### C7) Surf en planeo / aceleraciones de viento
Veleros con poca inercia surfean ola, lo cual mete componentes lentas
artificiales.

---

## Qué quiero publicar como SignalK deltas

Idea: **prefijo `.estimate`** para que se sepa que es estimación IMU, no
boya certificada:

```
environment.outside.waves.estimate.intensity              "moderada"
environment.outside.waves.estimate.intensityBand          "0.5-1.5deg" (RMS band)
environment.outside.waves.estimate.periodEncountered      6.2  (s)
environment.outside.waves.estimate.periodTrue             8.1  (s, corregido Doppler)
environment.outside.waves.estimate.relativeBearing        45   (deg from bow, ambiguo)
environment.outside.waves.estimate.directionTrue          315  (deg true, si confianza alta)
environment.outside.waves.estimate.heightSigEstimateM     1.2  (Hs, con disclaimer)
environment.outside.waves.estimate.heightRange            "1.0-2.0m"  (banda conservadora)
environment.outside.waves.estimate.confidence             0.65  (0-1)
environment.outside.waves.estimate.algorithm              "imu-v2-navigation"
```

KIP tiene widgets de gauge y de string, perfectos para mostrar esto.

---

## Preguntas concretas

### Q1 — Algoritmo robusto para extraer heave EN frame mar
¿Cuál es la pipeline mínima para sacar la componente vertical EN FRAME MAR
de un accel(boat) + attitude(pitch,roll,heading) a 10-20 Hz, sin necesidad
de tener un filtro de Kalman 9-DOF completo?

Pseudocódigo apreciado.

### Q2 — Estimación de período TRUE corrigiendo Doppler
Dado `T_encounter` medido, `V` (SOG), heading del barco y dirección
RELATIVA estimada de la ola (Q3), ¿la corrección
`T_true = T_encounter × (1 − V·cos(μ)/c)` con `c = g·T_true/(2π)` se
resuelve iterativamente? ¿Hay forma cerrada? ¿Casos degenerados (ola
viajando con el barco, head sea exacto)?

### Q3 — Dirección relativa de la ola con dirección ambigua
Si solo tengo el eje dominante (pitch/roll), la dirección es una LÍNEA
(ambigua proa/popa, port/stb). ¿Cómo desambiguar con:
- (a) Asimetría temporal (la ola pasa de proa a popa → primero pitch up
  luego pitch down con cierto desfase respecto al roll).
- (b) Correlación con viento real (las olas suelen ir con el viento).
- (c) GPS heave (si tuviera RTK).

¿Cuál es el método más sencillo y robusto para el ~80% de casos?

### Q4 — Hs en navegación: ¿es factible o conviene reportar BANDA?
Para no engañar al usuario, ¿es mejor publicar siempre BANDA conservadora
(p.ej. "0.5-1.5m", "1.0-2.0m", etc.) con confidence en lugar de número
único? ¿Cómo elegir umbrales conservadores cuando hay motor / heel / surf?

### Q5 — Detectores de "señal contaminada"
Quiero **NO publicar** datos si están claramente contaminados. ¿Qué
detectores rápidos puedo añadir?
- Motor on/off (RPM disponible vía NMEA / SK propulsion).
- Heel rápido cambiando (virada en curso).
- Acción del timonel muy alta (yaw rate sostenido).
- Surf (SOG anómalamente alto vs polar).

### Q6 — Bandas de RMS para intensidad EN navegación
Mis bandas anclado: <0.5°/1.5°/3.0°/6.0°/+. En navegación con heel cíclico
de virada y olas, ¿qué bandas tienen sentido? ¿O debería medir Hs
estimado en lugar de RMS pitch/roll?

### Q7 — Sensor fusion mínimo con GPS para heave
GPS de bajo coste (no RTK) tiene heave noise alto. ¿Vale la pena fusionar
GPS-vertical con IMU-vertical para reducir drift del integrador? Si sí,
¿con qué complementary filter o Kalman simple?

### Q8 — Validación / ground truth
¿Cómo puedo VALIDAR los resultados en el mar sin boya certificada?
Ideas: comparar con previsión Open-Meteo de Hs en mar abierto, contra
otros barcos, contra observación visual con escala Douglas/Beaufort, etc.

### Q9 — Bandera de calidad (confidence)
¿Qué inputs entran en el cálculo de `confidence` 0-1? Propongo:
- Tiempo desde último cambio de rumbo > 60s
- |COG - heading| coherente (no estamos en abatimiento brutal)
- RPM motor < umbral o cero
- Buffer lleno > 80%
- Heel constante (var pitch < umbral)

### Q10 — Referencias académicas / opensource
¿Qué papers o repos puedo mirar? Tengo en mente:
- Sofar Spotter buoy whitepaper (algo abierto)
- Mahdi/Trygve "Real-time wave estimation from ship motions" — refs académicas
- VesselFinder / OpenCPN — ¿alguno hace esto?
- Repos GitHub con "marine wave imu navigation"?

---

## Restricciones del proyecto

- **Node.js TypeScript** corriendo en SignalK plugin.
- **Pi 4/5** — no quiero saturar CPU. Algoritmo debe correr en ~100 ms /
  sample max.
- **Sin internet en alta mar** — todo el cálculo on-board.
- **No quiero requerir hardware extra** — solo IMU + GPS estándar.
- **Falsos negativos > falsos positivos** — prefiero "no sé" que dar un
  número alegre.

---

## Lo que NO quiero

- "Usa Kalman 9-DOF" sin explicar el filtro de medida y las covarianzas.
- "Compra una boya" — claro que es lo correcto, pero no es el objetivo.
- Algoritmos que requieren > 5 min de ventana sin cambios de rumbo.
- "Esto no es fiable" — quiero algo que sea ÚTIL aun no siendo perfecto.

## Lo que SÍ quiero

- **Pipelines concretos** (pseudo-código) que pueda traducir a TypeScript.
- **Umbrales numéricos** que tengan sentido físico (con orden de magnitud).
- **Tests de validación** que pueda correr sin material de laboratorio.
- **Trade-offs** explícitos: cuándo estimar Hs vs cuándo reportar solo banda.
- **Lista priorizada** de qué implementar primero para 80% del valor.

¡Gracias!
