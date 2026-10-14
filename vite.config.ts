import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

export default defineConfig({
  plugins: [solidPlugin(), cssInjectedByJsPlugin()],
  css: {
    modules: {
      generateScopedName: "[hash:base64:5]"
    }
  },
  resolve: {
    alias: [{ find: "~", replacement: "/src/" }]
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 3000
  }
});
