import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist", "public"),
    emptyOutDir: true,
    sourcemap: "hidden",
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom")) return "vendor";
            if (id.includes("react/")) return "vendor";
            if (id.includes("wouter")) return "router";
            if (id.includes("@tanstack/react-query")) return "query";
            if (id.includes("@radix-ui/")) return "ui";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("recharts")) return "charts";
            if (id.includes("framer-motion")) return "animation";
            if (id.includes("dompurify") || id.includes("react-helmet")) return "seo";
          }
        },
      },
    },
  },
});
