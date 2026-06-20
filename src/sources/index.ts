import { SignalKApp, TideSource } from "../types.js";
import ihm from "./ihm.js";

export default function createSources(app: SignalKApp): TideSource[] {
  return [ihm(app)];
}
