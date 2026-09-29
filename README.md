# Minecraft Torch Planner

A browser-only planner for finding a compact torch layout over a flat Minecraft floor plan.

## Run locally

```sh
npm install
npm run dev
```

## Deploy to GitHub Pages

Push this repository to GitHub. In **Settings → Pages → Build and deployment**, set the source to **GitHub Actions**. The workflow in `.github/workflows/deploy.yml` builds and deploys on every push to `main`, or can be started manually from the Actions tab.

The production build uses the project-site base path `/minecraft-torch-planner/`. If you rename the GitHub repository or publish it at a custom domain, update `base` in `vite.config.ts` to match the Pages URL.

## Use

- Choose the old safe-light threshold (8+) or the modern threshold (1+).
- Left-click to add the selected floor or wall tile; right-click to erase. Touchscreens can select the Erase brush.
- Load a Java world folder and select a crop from one of its region files, then mark walls with the Wall brush.
- Ask the planner to place torches. It searches for a minimum set and marks when a time limit prevents it from proving optimality.

World data is read in the browser and is not uploaded. Folder import currently reads Java Edition `.mca` region files with standard gzip/zlib compression and heightmaps. It imports the top surface but does not infer walls. Crops are limited to 64 × 64 cells so the exact search stays useful.

## Model limits

The planner treats the selected area as one flat 2D layer. Wall cells are full-height and opaque; empty cells let light pass through. Torch light is level 14 and propagates one grid step at a time around walls, staying inside the drawn grid. The old rule is safe at level 8+ (radius 6) and the newer rule at level 1+ (radius 13). Height changes, sky light, spawn-blocking surfaces, and other light sources are not modeled. Imported regions use the top-surface heightmap to create the floor shape; add walls with the Wall brush.
