# Minecraft Torch Planner

## XOR reference layout

- Match the classic dropper-hopper XOR: two observers pulse into an upward-facing dropper; one item moves between the dropper and the downward-facing hopper above it; a comparator reads the hopper and drives the output lamp.
- Keep the interactive A/B inputs, observer directions, moving item, comparator, and output lamp visible in the 3D view.
- Keep redstone dust in its own block space. End dust at the boundary of an adjacent torch block; never place dust inside a torch block.
- Keep the 3D A/B controls interactive and the displayed output equal to `A XOR B` for every input combination.
- Use the Redstone Lab layout editor for visual placement changes. Keep edits saved in browser storage and retain the reset-to-reference and JSON download controls.

## Repository workflow

- Work directly in the existing `main` checkout when the user requests it; do not create another branch for that work.
- After a gate change, build and visually check the 3D circuit and its four input combinations, then push `main` to deploy through GitHub Pages.
