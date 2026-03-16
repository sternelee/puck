import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  output: "server",
  vite: {
    ssr: {
      /**
       * Bundle @puckeditor/core and its tiptap dependencies into the SSR build
       * rather than loading them as external CJS Node modules. This avoids the
       * "Named export 'ReactNode' not found" Vite error that occurs when Vite's
       * SSR module runner analyses CJS React and finds that TypeScript-only
       * named exports (like ReactNode) are missing from module.exports.
       */
      noExternal: [/^@puckeditor\//, /^@tiptap\//],
    },
  },
});
