import { defineConfig } from "vite"
import desktopPlugin from "./vite"

export default defineConfig({
  plugins: [desktopPlugin] as any,
  server: {
    host: "127.0.0.1",
    port: 3000,
  },
  build: {
    target: "esnext",
    // sourcemap: true,
  },
})
