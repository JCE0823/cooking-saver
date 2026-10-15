import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "server",
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
