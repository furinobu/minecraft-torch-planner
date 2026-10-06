# Minecraft Torch Planner

## XOR reference layouts

- Match the classic dropper-hopper XOR: two observers pulse into an upward-facing dropper; one item moves between the dropper and the downward-facing hopper above it; a comparator reads the hopper and drives the output lamp.
- Keep the classic piston XOR as a separate selectable 3 × 5 × 2 layout: a three-block input wall, two wall levers, three sticky pistons, eight conductive blocks, and six to eight redstone dust. The back input is B, the front input is A, and the middle piston is staggered one block farther right than the outer pistons. Route the output dust around the front-right corner and onto the raised far-right block.
- Keep the piston XOR free of extra torch, repeater, or lamp components; its output is the raised redstone line.
- Save each editable XOR layout under its own browser-storage key and reset it to its matching reference layout.
- Keep the interactive A/B inputs and variant-specific components visible in the 3D view. The dropper-hopper variant reads its output at the lamp; the piston variant reads it from the raised redstone line.
- Keep redstone dust in its own block space. End dust at the boundary of an adjacent torch block; never place dust inside a torch block.
- Keep the 3D A/B controls interactive and the displayed output equal to `A XOR B` for every input combination.
- Use the Redstone Lab layout editor for visual placement changes. Keep edits saved in browser storage and retain the reset-to-reference and JSON download controls.

## Repository workflow

- Work directly in the existing `main` checkout when the user requests it; do not create another branch for that work.
- After a gate change, build and visually check the 3D circuit and its four input combinations, then push `main` to deploy through GitHub Pages.
