import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Kotwal Agents app. Port 8082 (uiapp = 8080, owner = 5174) so all three can
// run locally at once against the same API. Auth is shared with uiapp via the
// httpOnly refresh cookie on the API domain (see src/context/AuthContext.tsx).
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8082,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
