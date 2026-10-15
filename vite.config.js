import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000"
    }
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          fileParallelism: false,
          include: ["test/**/*.test.js"],
          environment: "node",
          setupFiles: ["./test/setup.js"]
        }
      },
      {
        extends: true,
        test: {
          name: "components",
          include: ["test/**/*.test.jsx"],
          environment: "jsdom",
          setupFiles: ["./test/setup.js"]
        }
      }
    ]
  }
});
