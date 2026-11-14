import { join } from "path";
import { open, readFile, mkdir, rename } from "fs/promises";

// Rev900 (auditoría 2026-11-14, A3): una escritura directa sobre el fichero
// lo dejaba cortado si la Pi se apagaba a mitad (desconectador de baterías),
// y get() lo daba por vacío: el plugin arrancaba sin fondeo, o sin PINs.
// Ahora se escribe a un .tmp, se fuerza a disco y se renombra (atómico en
// Linux), y las escrituras a un mismo fichero van en cola. La cola es por
// ruta y del módulo porque hay dos FileCache sobre la misma carpeta.
const _writeQueue = new Map<string, Promise<void>>();

export default class FileCache {
  constructor(public readonly path: string) {}

  async get(key: string): Promise<unknown | undefined> {
    const file = this.getKey(key);
    let content: string;
    try {
      content = await readFile(file, "utf-8");
    } catch {
      return undefined; // no existe
    }
    try {
      return JSON.parse(content);
    } catch (e: any) {
      // Roto (de antes de Rev900, o tarjeta SD mala): se aparta para poder
      // mirarlo y se avisa en el log en vez de callar.
      const kept = `${file}.corrupt-${Date.now()}`;
      try { await rename(file, kept); } catch { /* ignore */ }
      console.error(`[IHM-CACHE] ${key}.json corrupt (${e?.message ?? e}); kept as ${kept}`);
      return undefined;
    }
  }

  set(key: string, value: unknown): Promise<void> {
    const file = this.getKey(key);
    const data = JSON.stringify(value);
    const prev = _writeQueue.get(file) ?? Promise.resolve();
    const next = prev.catch(() => { /* the previous write already reported */ }).then(async () => {
      await mkdir(this.path, { recursive: true });
      const tmp = `${file}.tmp`;
      const fh = await open(tmp, "w");
      try {
        await fh.writeFile(data);
        await fh.sync();
      } finally {
        await fh.close();
      }
      await rename(tmp, file);
    });
    _writeQueue.set(file, next);
    next.then(
      () => { if (_writeQueue.get(file) === next) _writeQueue.delete(file); },
      () => { if (_writeQueue.get(file) === next) _writeQueue.delete(file); },
    );
    return next;
  }

  getKey(key: string): string {
    return join(this.path, `${key}.json`);
  }
}
