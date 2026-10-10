// Copia el lector WebAssembly de ZXing a /public para servirlo desde la app
// (en lugar de bajarlo de un CDN). Lo usa el escáner en navegadores sin
// BarcodeDetector nativo (por ejemplo, Safari en iPhone). Corre en postinstall.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let origen;
try {
  origen = join(
    dirname(require.resolve("zxing-wasm/package.json")),
    "dist/reader/zxing_reader.wasm",
  );
} catch {
  origen = join(raiz, "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm");
}
if (!existsSync(origen)) {
  console.warn("[copiar-zxing] No se encontró zxing_reader.wasm; el escáner usará el CDN.");
  process.exit(0);
}
const destino = join(raiz, "public/vendor");
mkdirSync(destino, { recursive: true });
copyFileSync(origen, join(destino, "zxing_reader.wasm"));
console.log("[copiar-zxing] public/vendor/zxing_reader.wasm listo.");
