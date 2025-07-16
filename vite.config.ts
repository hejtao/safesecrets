import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "src",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3744,
    host: true,
    open: true,
  },
  build: {
    outDir: "../dist",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  // Tauri expects a fixed port, fail if that port is not available
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
});
