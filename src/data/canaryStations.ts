// Deterministic Canary Islands station list (IHM getlist ids)
// Source: IHM /getmarea?request=getlist&format=json
// Keep hardcoded to ensure correct TZ even when lat/lon parsing fails or when offline.

export const CANARY_STATION_IDS = new Set<string>([
  "53", // Arrecife (Lanzarote)
  "54", // Puerto del Rosario (Fuerteventura)
  "55", // Morro Jable (Fuerteventura)
  "56", // Puerto de la Luz (Gran Canaria)
  "57", // Arinaga (Gran Canaria)
  "58", // Pasito Blanco (Gran Canaria)
  "59", // Puerto de las Nieves (Gran Canaria)
  "60", // Santa Cruz de Tenerife
  "61", // Los Gigantes (Tenerife)
  "62", // Puerto de la Cruz (Tenerife)
  "63", // Los Cristianos (Tenerife)
  "64", // Granadilla (Tenerife)
  "65", // San Sebastián de la Gomera
  "66", // Santa Cruz de La Palma
  "67", // Puerto de la Estaca (El Hierro)
]);

export const isCanaryStationId = (id?: string) =>
  !!id && CANARY_STATION_IDS.has(String(id).trim());
