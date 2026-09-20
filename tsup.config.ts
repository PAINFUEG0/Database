/** @format */

import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  outDir: "lib",

  dts: true,
  sourcemap: false,

  minify: false,
  treeshake: false,

  target: "esnext",
  platform: "node",
  format: ["cjs", "esm"],

  entry: ["src/index.ts"],

  removeNodeProtocol: false,
  skipNodeModulesBundle: true
});
