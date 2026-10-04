# Minecraft Torch Planner

## XOR reference layout

- Match the standard XOR gate in the user-provided reference: output lamp on the left, two wall levers on the right, four torches in two rows, one output torch, raised white support blocks, and stepped redstone paths.
- Keep redstone dust in its own block space. End dust at the boundary of an adjacent torch block; never place dust inside a torch block.
- Keep the 3D A/B controls interactive and the displayed output equal to `A XOR B` for every input combination.

## Repository workflow

- Work directly in the existing `main` checkout when the user requests it; do not create another branch for that work.
- After a gate change, build and visually check the 3D circuit and its four input combinations, then push `main` to deploy through GitHub Pages.
