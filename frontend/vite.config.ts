import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load .env variables so the config itself can reference them
  const env = loadEnv(mode, process.cwd(), "VITE_");

  const backendPort = env.VITE_BACKEND_PORT || "8001";
  const devPort = parseInt(env.VITE_DEV_PORT || "5173", 10);
  const backendUrl = env.VITE_API_BASE_URL || `http://localhost:${backendPort}`;

  return {
    plugins: [react()],
    server: {
      port: devPort,
      strictPort: false,
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  };
});
