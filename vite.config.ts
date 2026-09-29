import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/minecraft-torch-planner/" : "/",
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        main: "index.html",
        torchPlanner: "torch-planner/index.html",
        slimeFinder: "slime-finder/index.html",
      },
    },
  },
}));
