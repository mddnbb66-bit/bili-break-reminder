import { defineConfig } from "vite";
import wails from "@wailsio/runtime/plugins/vite";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        overlay: resolve(__dirname, "overlay.html"),
      },
    },
  },
  plugins: [wails("./bindings")],
});
