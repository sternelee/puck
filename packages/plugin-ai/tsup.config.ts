import { defineConfig } from "tsup";
import tsupconfig from "../tsup-config";

export default defineConfig({
  ...tsupconfig,
  minify: false,
  sourcemap: true,
});
