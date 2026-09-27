import { build } from "esbuild";
import { copyFile, mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/ha-openfreemap-card.js"],
  outfile: "dist/ha-openfreemap-card.js",
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2022"],
  loader: { ".css": "text" },
  legalComments: "none"
});
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(`node_modules/maplibre-gl/dist/${file}`, `dist/${file}`);
}
