# Minecraft Tools

A browser-only collection of Minecraft utilities. It includes a torch layout planner, a Java slime chunk finder, an interactive farm range demo, and a redstone computer lesson.

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
- Drawn maps start as walls. Click or drag to fill a rectangle with the selected Floor, Wall, or Empty tile; right-click or right-drag always places walls. Empty cells are ignored as spawn targets and let light pass through.
- Load a Java world folder and select a crop from one of its region files, then mark walls with the Wall brush.
- Ask the planner to place torches. It searches for a minimum set, marks when a time limit prevents it from proving optimality, and shows each passable cell's block light level from 0 to 14.
- Use **Slime finder** to search a Java seed for the densest 16 × 16 chunk square. Set a block-coordinate center and search radius; the result shows its slime chunks, center, and northwest corner coordinates.
- Use **Farm demo** to move two sample AFK players and three farm platforms, and see which farms lie in each player's 24–128 block range.
- Use **Redstone lab** to rotate interactive 3D views of redstone logic gates, explore a small 4 × 8 RAM, and learn the architecture and example program for an 8-bit CPU.

Each utility has its own shareable path on GitHub Pages: `/minecraft-torch-planner/torch-planner/`, `/minecraft-torch-planner/slime-finder/`, `/minecraft-torch-planner/farm-overlap/`, and `/minecraft-torch-planner/redstone-lab/`. The root URL still opens the torch planner.

World data and slime chunk searches run in the browser and are not uploaded. The slime finder accepts Java numeric seeds and text seeds. Its search runs in Rust WebAssembly across up to eight browser workers, splitting independent window columns among CPU cores. Building requires Rust with the `wasm32-unknown-unknown` target. The default search radius is 256 chunks; the maximum is 1,048,576 chunks. The maximum radius checks about 4.4 trillion candidate areas, so large searches can take a very long time. Search progress is reported and searches can be cancelled.

Torch planner world-folder import currently reads Java Edition `.mca` region files with standard gzip/zlib compression and heightmaps. It imports the top surface but does not infer walls. Crops are limited to 64 × 64 cells so the exact search stays useful.

## Model limits

The planner treats the selected area as one flat 2D layer. Wall cells are full-height and opaque; empty cells let light pass through and are not spawn targets. Torch light is level 14 and propagates one grid step at a time around walls, staying inside the drawn grid. The old rule is safe at level 8+ (radius 6) and the newer rule at level 1+ (radius 13). Height changes, sky light, spawn-blocking surfaces, and other light sources are not modeled. Imported regions use the top-surface heightmap to create the floor shape; add walls with the Wall brush.

The farm range demo uses same-height horizontal positions to visualize the 24–128-block distance band. It does not simulate mob caps or predict farm rates.

The redstone lesson is for Java Edition. It teaches the design of a starter 4 × 8 RAM and an accumulator-style 8-bit CPU; linked references provide tested circuit layouts for individual gates and components.

The NOT, OR, and AND gate images in the redstone lesson are from [Redstone University](https://redstone.university/course/part-i--foundations/02_the-grammar-of-circuits/draft/) by fielding, shared under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
