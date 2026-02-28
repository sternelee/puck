import { defineConfig } from "tsup";

export default defineConfig({
  format: ["cjs", "esm"],
  dts: true,
  external: ["react", "react-dom", "@puckeditor/core"],
  injectStyle: true,
  minify: false,
  sourcemap: true,
});
