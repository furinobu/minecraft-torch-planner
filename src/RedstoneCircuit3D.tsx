import { useEffect, useRef, useState } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  GridHelper,
  Group as ThreeGroup,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera as ThreeOrthographicCamera,
  PlaneGeometry,
  Raycaster,
  Scene as ThreeScene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  WebGLRenderer as ThreeWebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Group, Material, Object3D, OrthographicCamera, Scene, WebGLRenderer } from "three";
import type { OrbitControls as OrbitControlsType } from "three/addons/controls/OrbitControls.js";
import type { CircuitDefinition } from "./redstoneCircuits";

const THREE = {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  GridHelper,
  Group: ThreeGroup,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera: ThreeOrthographicCamera,
  PlaneGeometry,
  Raycaster,
  Scene: ThreeScene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  WebGLRenderer: ThreeWebGLRenderer,
};

export type RedstoneGate = "NOT" | "OR" | "AND" | "NAND" | "NOR" | "XOR";
export type RedstoneClock = "repeater-clock" | "torch-clock" | "comparator-clock" | "hopper-clock" | "stoppable-clock";

type Props = {
  gate?: RedstoneGate;
  circuit?: CircuitDefinition;
  inputA: boolean;
  inputB: boolean;
  inputC?: boolean;
  select?: boolean;
  output: boolean;
  secondaryOutput?: boolean;
  value?: number;
  stored?: number;
  itemCount?: number;
  sentCount?: number;
  locked?: boolean;
  extended?: boolean;
  pulse?: boolean;
  onInputToggle?: (input: "A" | "B" | "C" | "SEL") => void;
  clock?: RedstoneClock;
  clockPhase?: boolean;
  clockEnabled?: boolean;
  clockStopped?: boolean;
};
type Three = typeof THREE;
type Point = [number, number];

type Engine = {
  THREE: Three;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: OrthographicCamera;
  controls: OrbitControlsType;
  root: Group;
  render: () => void;
  reset: () => void;
};

const FALLBACKS: Partial<Record<RedstoneGate, { file: string; alt: string }>> = {
  NOT: { file: "not-gate.webp", alt: "Minecraft redstone NOT gate with a lever, torch, and lamp" },
  OR: { file: "or-gate.webp", alt: "Minecraft redstone OR gate with two lever inputs and a shared output" },
  AND: { file: "and-gate.webp", alt: "Minecraft redstone AND gate made from torches and redstone dust" },
};

function box(
  THREE: Three,
  root: Group,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  color: number,
  options: { emissive?: number; intensity?: number; outline?: boolean } = {},
) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.94,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.intensity ?? 0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  root.add(mesh);

  if (options.outline !== false) {
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x141811, transparent: true, opacity: 0.72 });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial);
    edges.position.copy(mesh.position);
    root.add(edges);
  }
  return mesh;
}

function clearGroup(THREE: Three, group: Group) {
  for (const child of [...group.children]) {
    child.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) object.geometry.dispose();
      const material = (object as typeof object & { material?: Material | Material[] }).material;
      const disposeMaterial = (item: Material) => {
        if ("map" in item && item.map instanceof THREE.Texture) item.map.dispose();
        item.dispose();
      };
      if (Array.isArray(material)) material.forEach(disposeMaterial);
      else if (material) disposeMaterial(material);
    });
    group.remove(child);
  }
}

function addLabel(THREE: Three, root: Group, text: string, x: number, y: number, z: number, width = 1.05) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 72;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "rgba(20, 24, 18, .94)";
  context.fillRect(3, 5, 250, 62);
  context.strokeStyle = "#768264";
  context.lineWidth = 4;
  context.strokeRect(3, 5, 250, 62);
  context.fillStyle = "#e1e8d5";
  context.font = "bold 31px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 128, 37, 235);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.set(x, y, z);
  sprite.scale.set(width, width * 0.28, 1);
  sprite.renderOrder = 3;
  root.add(sprite);
}

function addBlock(THREE: Three, root: Group, x: number, z: number, powered = false) {
  return box(THREE, root, x, 0.48, z, 0.94, 0.96, 0.94, powered ? 0x888b77 : 0x777c77, {
    emissive: powered ? 0x723c26 : 0,
    intensity: powered ? 0.13 : 0,
  });
}

type CircuitInput = "A" | "B" | "C" | "SEL";

function addLever(THREE: Three, root: Group, x: number, z: number, powered: boolean, label: string, inputId: CircuitInput = "A") {
  const lever = new THREE.Group();
  lever.position.set(x, 0, z);
  lever.userData.input = inputId;
  root.add(lever);
  box(THREE, lever, 0, 1.0, 0, 0.38, 0.08, 0.3, powered ? 0x9b8054 : 0x62665b);
  const handle = new THREE.Group();
  handle.position.set(0, 1.07, 0);
  handle.rotation.z = powered ? -0.78 : 0.78;
  lever.add(handle);
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.052, 0.34, 6),
    new THREE.MeshStandardMaterial({ color: 0x92988a, roughness: 0.83 }),
  );
  bar.position.set(0, 0.17, 0);
  handle.add(bar);
  box(THREE, handle, 0, 0.36, 0, 0.15, 0.15, 0.15, powered ? 0xffcc68 : 0xa8afa0);
  addLabel(THREE, root, `${label} ${powered ? 1 : 0}`, x, 1.65, z, 0.82);
}

function addInput(THREE: Three, root: Group, x: number, z: number, powered: boolean, label: string, inputId: CircuitInput = "A") {
  addBlock(THREE, root, x, z, powered);
  addLever(THREE, root, x, z, powered, label, inputId);
}

function addTorch(THREE: Three, root: Group, x: number, z: number, powered: boolean, wall = false, baseY = 1) {
  const y = wall ? 0.42 : baseY + 0.18;
  const stickX = wall ? x + 0.08 : x;
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, 0.34, 6),
    new THREE.MeshStandardMaterial({ color: 0x805333, roughness: 1 }),
  );
  rod.position.set(stickX, y, z);
  rod.rotation.z = wall ? -0.38 : 0;
  root.add(rod);
  box(THREE, root, wall ? x + 0.12 : x, wall ? y + 0.2 : y + 0.2, z, 0.17, 0.12, 0.17,
    powered ? 0xff7640 : 0x693c32, { emissive: powered ? 0xff3417 : 0, intensity: powered ? 1.5 : 0 });
}

function addLamp(THREE: Three, root: Group, x: number, z: number, powered: boolean) {
  box(THREE, root, x, 0.48, z, 0.82, 0.86, 0.82, powered ? 0xffd36c : 0x66523a, {
    emissive: powered ? 0xffa829 : 0,
    intensity: powered ? 1.45 : 0,
  });
  addLabel(THREE, root, `OUT ${powered ? 1 : 0}`, x, 1.18, z, 1.08);
}

function addDustPath(THREE: Three, root: Group, points: Point[], y: number, powered: boolean) {
  const color = powered ? 0xff3828 : 0x581b1a;
  const emissive = powered ? 0xa42318 : 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x, z] = points[i];
    box(THREE, root, x, y, z, 0.17, 0.045, 0.17, color, { emissive, intensity: powered ? 0.8 : 0, outline: false });
    if (i === points.length - 1) continue;
    const [nextX, nextZ] = points[i + 1];
    const dx = nextX - x;
    const dz = nextZ - z;
    if (Math.abs(dx) > 0.001) {
      box(THREE, root, x + dx / 2, y, z, Math.abs(dx) + 0.05, 0.04, 0.1, color, { emissive, intensity: powered ? 0.8 : 0, outline: false });
    }
    if (Math.abs(dz) > 0.001) {
      box(THREE, root, nextX, y, z + dz / 2, 0.1, 0.04, Math.abs(dz) + 0.05, color, { emissive, intensity: powered ? 0.8 : 0, outline: false });
    }
  }
}

function addRepeater(THREE: Three, root: Group, x: number, z: number, powered: boolean) {
  box(THREE, root, x, 0.07, z, 0.72, 0.12, 0.44, 0x9a9b8e);
  box(THREE, root, x, 0.145, z, 0.5, 0.035, 0.08, powered ? 0xff3828 : 0x581b1a, { outline: false });
  box(THREE, root, x - 0.18, 0.21, z, 0.07, 0.1, 0.1, powered ? 0xff6938 : 0x5f382b, { emissive: powered ? 0xc72d18 : 0, intensity: 0.5 });
  box(THREE, root, x + 0.18, 0.21, z, 0.07, 0.1, 0.1, powered ? 0xff6938 : 0x5f382b, { emissive: powered ? 0xc72d18 : 0, intensity: 0.5 });
}

function addComparator(THREE: Three, root: Group, x: number, z: number, powered: boolean) {
  box(THREE, root, x, 0.08, z, 0.72, 0.13, 0.48, 0x999b8b);
  box(THREE, root, x, 0.17, z, 0.42, 0.035, 0.1, powered ? 0xff4936 : 0x5d2420, { outline: false });
  box(THREE, root, x - 0.2, 0.22, z, 0.07, 0.08, 0.08, powered ? 0xff7143 : 0x754a37);
  box(THREE, root, x + 0.2, 0.22, z, 0.07, 0.08, 0.08, powered ? 0xff7143 : 0x754a37);
}

function addHopper(THREE: Three, root: Group, x: number, y: number, z: number) {
  box(THREE, root, x, y, z, 0.7, 0.16, 0.7, 0x434941);
  box(THREE, root, x, y - 0.2, z, 0.4, 0.26, 0.4, 0x353b35);
  box(THREE, root, x, y - 0.38, z, 0.18, 0.12, 0.18, 0x252a25);
}

function addContainer(THREE: Three, root: Group, x: number, z: number, itemCount = 0) {
  box(THREE, root, x, 0.43, z, 0.86, 0.76, 0.86, 0x735a38);
  box(THREE, root, x, 0.84, z, 0.9, 0.08, 0.9, 0x9a7946);
  box(THREE, root, x, 0.43, z - 0.45, 0.9, 0.18, 0.07, 0xa1814d);
  if (itemCount > 0) {
    const visibleItems = Math.min(5, Math.ceil(itemCount / 4));
    for (let index = 0; index < visibleItems; index += 1) {
      box(THREE, root, x - 0.28 + (index % 3) * 0.28, 0.92, z - 0.22 + Math.floor(index / 3) * 0.28, 0.14, 0.14, 0.14, 0xb2a06e, { outline: false });
    }
  }
}

function addDropper(THREE: Three, root: Group, x: number, z: number, active: boolean) {
  box(THREE, root, x, 0.48, z, 0.86, 0.86, 0.86, 0x72786a, { emissive: active ? 0x693820 : 0, intensity: active ? 0.3 : 0 });
  box(THREE, root, x, 0.5, z - 0.44, 0.46, 0.38, 0.06, 0x343a32);
  addLabel(THREE, root, active ? "FIRE" : "DROP", x, 1.1, z, 0.95);
}

function addPressurePlate(THREE: Three, root: Group, x: number, z: number, pressed: boolean) {
  const plate = box(THREE, root, x, 0.06, z, 0.82, pressed ? 0.12 : 0.06, 0.82, pressed ? 0x9e8053 : 0x88806d);
  plate.userData.input = "A";
}

function addPiston(THREE: Three, root: Group, x: number, y: number, z: number, extended: boolean) {
  box(THREE, root, x, y, z, 0.72, 0.34, 0.72, 0x6f795b);
  box(THREE, root, x, y + 0.22, z, 0.38, extended ? 0.45 : 0.12, 0.38, 0x89916a);
}

function addModule(THREE: Three, root: Group, x: number, z: number, title: string, powered: boolean) {
  const color = title === "OR" ? 0x63734b : title === "NOT" ? 0x805149 : 0x897347;
  box(THREE, root, x, 0.48, z, 0.94, 0.96, 0.94, color, {
    emissive: powered ? 0x8b6124 : 0,
    intensity: powered ? 0.42 : 0,
  });
  box(THREE, root, x, 0.99, z, 0.55, 0.08, 0.55, powered ? 0xff3828 : 0x581b1a, { outline: false });
  addLabel(THREE, root, `${title} ${powered ? 1 : 0}`, x, 1.48, z, 1.22);
}

function addGround(THREE: Three, scene: Scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 8),
    new THREE.MeshStandardMaterial({ color: 0x283427, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.13;
  scene.add(ground);
  const grid = new THREE.GridHelper(12, 12, 0x58634b, 0x394433);
  grid.position.y = -0.115;
  scene.add(grid);
}

function buildNot(THREE: Three, root: Group, a: boolean, output: boolean) {
  addInput(THREE, root, -1.8, 0, a, "A");
  addTorch(THREE, root, -1.28, 0, output, true);
  addDustPath(THREE, root, [[-0.99, 0], [-0.2, 0], [0.6, 0], [1.58, 0]], 0.06, output);
  addLamp(THREE, root, 2.05, 0, output);
}

function buildOr(THREE: Three, root: Group, a: boolean, b: boolean, output: boolean, invert = false) {
  const orOutput = a || b;
  const za = -1.25;
  const zb = 1.25;
  addInput(THREE, root, -3.1, za, a, "A");
  addInput(THREE, root, -3.1, zb, b, "B");
  addRepeater(THREE, root, -1.55, za, a);
  addRepeater(THREE, root, -1.55, zb, b);
  const branchA = [[-2.6, za], [-1.55, za], [-0.55, za], [0, za], [0, 0], [0.75, 0], [1.45, 0]] as Point[];
  const branchB = [[-2.6, zb], [-1.55, zb], [-0.55, zb], [0, zb], [0, 0], [0.75, 0], [1.45, 0]] as Point[];
  addDustPath(THREE, root, branchA, 0.06, a);
  addDustPath(THREE, root, branchB, 0.06, b);
  if (!invert) {
    addDustPath(THREE, root, [[1.45, 0], [2.2, 0]], 0.06, output);
    addLamp(THREE, root, 2.65, 0, output);
    return;
  }
  addBlock(THREE, root, 1.9, 0, orOutput);
  addTorch(THREE, root, 2.42, 0, output, true);
  addDustPath(THREE, root, [[2.55, 0], [3.2, 0], [4, 0]], 0.06, output);
  addLamp(THREE, root, 4.45, 0, output);
}

function buildAnd(THREE: Three, root: Group, a: boolean, b: boolean, output: boolean, invert = false) {
  const andOutput = a && b;
  const za = -1.2;
  const zb = 1.2;
  addInput(THREE, root, -2.6, za, a, "A");
  addInput(THREE, root, -2.6, zb, b, "B");
  addDustPath(THREE, root, [[-2.1, za], [-1.15, za], [-0.45, za], [0, za]], 0.06, a);
  addDustPath(THREE, root, [[-2.1, zb], [-1.15, zb], [-0.45, zb], [0, zb]], 0.06, b);
  addBlock(THREE, root, 0, za);
  addBlock(THREE, root, 0, 0);
  addBlock(THREE, root, 0, zb);
  addTorch(THREE, root, 0, za, !a, false, 0.98);
  addTorch(THREE, root, 0, zb, !b, false, 0.98);
  addDustPath(THREE, root, [[0, za], [0, 0], [0, zb]], 1.04, !a || !b);
  addTorch(THREE, root, 0.54, 0, andOutput, true);
  addDustPath(THREE, root, [[0.82, 0], [1.72, 0]], 0.06, andOutput);
  if (!invert) {
    addDustPath(THREE, root, [[1.72, 0], [2.46, 0]], 0.06, andOutput);
    addLamp(THREE, root, 2.95, 0, andOutput);
    return;
  }
  addBlock(THREE, root, 2.25, 0, andOutput);
  addTorch(THREE, root, 2.77, 0, output, true);
  addDustPath(THREE, root, [[2.9, 0], [3.5, 0], [4.22, 0]], 0.06, output);
  addLamp(THREE, root, 4.7, 0, output);
}

function buildComposite(THREE: Three, root: Group, gate: "NAND" | "NOR" | "XOR", a: boolean, b: boolean, output: boolean) {
  if (gate === "NAND") {
    const andOutput = a && b;
    addInput(THREE, root, -3.7, -1.1, a, "A");
    addInput(THREE, root, -3.7, 1.1, b, "B");
    addDustPath(THREE, root, [[-3.2, -1.1], [-2.4, -1.1], [-1.7, 0]], 0.06, a);
    addDustPath(THREE, root, [[-3.2, 1.1], [-2.4, 1.1], [-1.7, 0]], 0.06, b);
    addModule(THREE, root, -0.9, 0, "AND", andOutput);
    addDustPath(THREE, root, [[-0.42, 0], [0.58, 0]], 0.06, andOutput);
    addModule(THREE, root, 1.05, 0, "NOT", output);
    addDustPath(THREE, root, [[1.52, 0], [2.32, 0]], 0.06, output);
    addLamp(THREE, root, 2.8, 0, output);
    return;
  }
  if (gate === "NOR") {
    const orOutput = a || b;
    addInput(THREE, root, -3.7, -1.1, a, "A");
    addInput(THREE, root, -3.7, 1.1, b, "B");
    addDustPath(THREE, root, [[-3.2, -1.1], [-2.4, -1.1], [-1.7, 0]], 0.06, a);
    addDustPath(THREE, root, [[-3.2, 1.1], [-2.4, 1.1], [-1.7, 0]], 0.06, b);
    addModule(THREE, root, -0.9, 0, "OR", orOutput);
    addDustPath(THREE, root, [[-0.42, 0], [0.58, 0]], 0.06, orOutput);
    addModule(THREE, root, 1.05, 0, "NOT", output);
    addDustPath(THREE, root, [[1.52, 0], [2.32, 0]], 0.06, output);
    addLamp(THREE, root, 2.8, 0, output);
    return;
  }

  const orOutput = a || b;
  const andOutput = a && b;
  const notAnd = !andOutput;
  addInput(THREE, root, -4, -1.2, a, "A");
  addInput(THREE, root, -4, 1.2, b, "B");
  addDustPath(THREE, root, [[-3.5, -1.2], [-2.7, -1.2], [-2.1, -1.2]], 0.06, a);
  addDustPath(THREE, root, [[-3.5, 1.2], [-2.7, 1.2], [-2.1, 1.2]], 0.06, b);
  addModule(THREE, root, -1.6, -1.2, "OR", orOutput);
  addModule(THREE, root, -1.6, 1.2, "AND", andOutput);
  addDustPath(THREE, root, [[-1.12, -1.2], [-0.45, -1.2], [0.15, -0.25], [0.95, -0.25], [2.25, -0.25]], 0.06, orOutput);
  addDustPath(THREE, root, [[-1.12, 1.2], [0.08, 1.2]], 0.06, andOutput);
  addModule(THREE, root, 0.55, 1.2, "NOT", notAnd);
  addDustPath(THREE, root, [[1.02, 1.2], [1.75, 1.2], [2.25, 0.25]], 0.13, notAnd);
  addModule(THREE, root, 2.72, 0, "AND", output);
  addDustPath(THREE, root, [[3.2, 0], [3.97, 0]], 0.06, output);
  addLamp(THREE, root, 4.45, 0, output);
}

function buildClockCircuit(THREE: Three, root: Group, props: Props) {
  const clock = props.clock;
  if (!clock) return;
  const running = Boolean(props.clockPhase && (clock === "hopper-clock" || props.clockEnabled !== false) && !props.clockStopped);

  if (clock === "repeater-clock" || clock === "stoppable-clock") {
    addBlock(THREE, root, -2, 0);
    addTorch(THREE, root, -1, 0, running, true);
    addDustPath(THREE, root, [[-0.5, 0], [0, 0], [0.75, 0], [1.5, 0], [2, 0]], 0.06, running);
    addRepeater(THREE, root, 0.75, 0, running);
    addDustPath(THREE, root, [[2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [-1, 2], [-2, 2], [-2, 1]], 0.06, !running);
    addLabel(THREE, root, "4-TICK REPEATER", 0.75, 0.78, -0.46, 1.7);
    if (clock === "stoppable-clock") {
      addInput(THREE, root, -2, 2, Boolean(props.clockStopped), "A");
      addLabel(THREE, root, `STOP ${props.clockStopped ? 1 : 0}`, -2, 1.9, 2, 1.15);
    }
    addLabel(THREE, root, `OUT ${running ? 1 : 0}`, 2, 1.35, 0, 1.05);
    return;
  }

  if (clock === "torch-clock") {
    addBlock(THREE, root, -3, -2);
    addBlock(THREE, root, 1, -2);
    addBlock(THREE, root, 3, 1);
    addTorch(THREE, root, -2, -2, running, true);
    addTorch(THREE, root, 2, -2, !running, true);
    addTorch(THREE, root, 3, 2, running, true);
    addDustPath(THREE, root, [[-1.5, -2], [-1, -2], [0, -2], [1, -2]], 0.06, running);
    addDustPath(THREE, root, [[2.5, -2], [3, -2], [3, -1], [3, 0], [3, 0.5]], 0.06, !running);
    addDustPath(THREE, root, [[2.5, 2], [2, 2], [1, 2], [0, 2], [-1, 2], [-2, 2], [-3, 2], [-3, 1], [-3, 0], [-3, -1], [-3, -2]], 0.06, running);
    addLabel(THREE, root, "3 TORCH RING", 0, 1.8, 0, 1.55);
    addLabel(THREE, root, `OUT ${running ? 1 : 0}`, -2, 1.35, -2, 1.05);
    return;
  }

  if (clock === "comparator-clock") {
    addInput(THREE, root, -2.3, 0, props.clockEnabled !== false, "A");
    addDustPath(THREE, root, [[-1.8, 0], [-1.2, 0]], 0.06, running);
    addComparator(THREE, root, -0.8, 0, running);
    addDustPath(THREE, root, [[-0.35, 0], [0, 0], [0.75, 0], [1.4, 0]], 0.06, running);
    addRepeater(THREE, root, 0.75, 1.15, running);
    addDustPath(THREE, root, [[0.75, 0.55], [0.75, 0], [0.75, -0.5], [0, -0.5], [-0.8, -0.5], [-0.8, 0]], 0.06, !running);
    addLamp(THREE, root, 2, 0, running);
    addLabel(THREE, root, "SUBTRACT", -0.8, 0.76, -0.42, 1.15);
    addLabel(THREE, root, "ENABLE", -2.3, 1.8, 0, 1.05);
    return;
  }

  addHopper(THREE, root, -0.48, 0.62, 0);
  addHopper(THREE, root, 0.48, 0.62, 0);
  addPiston(THREE, root, -1.25, 1.25, 0, running);
  addPiston(THREE, root, 1.25, 1.25, 0, !running);
  addComparator(THREE, root, -2.15, 0, running);
  addComparator(THREE, root, 2.15, 0, !running);
  box(THREE, root, running ? 0.52 : -0.52, 1.95, 0, 0.46, 0.42, 0.46, 0xb33b32, { emissive: running ? 0x941d19 : 0, intensity: 0.45 });
  addInput(THREE, root, 0, 2.5, props.clockEnabled === false, "A");
  addLabel(THREE, root, "4 ITEMS", 0, 2.5, -0.7, 1.05);
  addLabel(THREE, root, `OUT ${running ? 1 : 0}`, -2.15, 1.05, 0, 1.05);
}

function buildCatalogCircuit(THREE: Three, root: Group, props: Props) {
  const circuit = props.circuit;
  if (!circuit) return;
  const { inputA: a, inputB: b, output } = props;
  const c = Boolean(props.inputC);
  const selected = Boolean(props.select);
  const secondary = Boolean(props.secondaryOutput);
  const value = props.value ?? 0;
  const stored = props.stored ?? 0;
  const itemCount = props.itemCount ?? 0;
  const sentCount = props.sentCount ?? 0;

  if (circuit.category === "Signal") {
    if (circuit.id === "dust-staircase") {
      addInput(THREE, root, -3, 0, a, "A");
      for (let step = 0; step < 5; step += 1) {
        const x = -1.8 + step * 0.8;
        const y = 0.25 + step * 0.46;
        box(THREE, root, x, y, 0, 0.78, 0.7, 0.78, 0x777c77);
        box(THREE, root, x, y + 0.37, 0, 0.18, 0.045, 0.18, output ? 0xff3828 : 0x581b1a, { outline: false, emissive: output ? 0xa42318 : 0, intensity: output ? 0.7 : 0 });
      }
      addLamp(THREE, root, 2.7, 0, output);
      addLabel(THREE, root, "5 LEVELS", 0, 3.1, -0.3, 1.2);
      return;
    }
    if (circuit.id === "torch-tower") {
      for (let level = 0; level < 4; level += 1) {
        const y = 0.55 + level * 0.65;
        addTorch(THREE, root, level % 2 === 0 ? -0.45 : 0.45, 0, level % 2 === 0 ? output : !output, false, y);
        box(THREE, root, 0, y, 0, 0.94, 0.96, 0.94, 0x777c77);
      }
      addInput(THREE, root, -2.6, 0, a, "A");
      addLabel(THREE, root, "INVERT", 1.25, 3.45, 0, 1.05);
      return;
    }
    if (circuit.id === "wire-bridge") {
      addInput(THREE, root, -3.4, -1.6, a, "A");
      addInput(THREE, root, -3.4, 1.6, b, "B");
      addDustPath(THREE, root, [[-2.9, -1.6], [-1.6, -1.6], [0, -1.6], [1.6, -1.6], [2.8, -1.6]], 0.06, a);
      addDustPath(THREE, root, [[-2.9, 1.6], [-1.6, 1.6], [0, 1.6], [1.6, 1.6], [2.8, 1.6]], 1.06, b);
      addBlock(THREE, root, 0, 0);
      addLabel(THREE, root, "CROSSING · ISOLATED", 0, 1.6, 0, 2.25);
      return;
    }
    if (circuit.id === "diode-branch") {
      addInput(THREE, root, -3.1, -1.1, a, "A");
      addInput(THREE, root, -3.1, 1.1, b, "B");
      addRepeater(THREE, root, -1.45, -1.1, a);
      addRepeater(THREE, root, -1.45, 1.1, b);
      addDustPath(THREE, root, [[-1, -1.1], [0, -1.1], [0.75, 0]], 0.06, a);
      addDustPath(THREE, root, [[-1, 1.1], [0, 1.1], [0.75, 0]], 0.06, b);
      addDustPath(THREE, root, [[0.75, 0], [1.7, 0]], 0.06, output);
      addLamp(THREE, root, 2.3, 0, output);
      return;
    }
    addInput(THREE, root, -3.2, 0, a, "A");
    if (circuit.id === "strong-power") addBlock(THREE, root, -0.8, 0, output);
    else addRepeater(THREE, root, -1.4, 0, output);
    addDustPath(THREE, root, [[-2.7, 0], [-1.4, 0], [-0.45, 0], [0.5, 0], [1.6, 0]], 0.06, output);
    addLamp(THREE, root, 2.3, 0, output);
    if (circuit.id === "repeater-line") addLabel(THREE, root, "SIGNAL RESTORED", 0, 1.15, -0.4, 1.65);
    return;
  }

  if (circuit.category === "Logic") {
    if (circuit.id === "half-adder" || circuit.id === "full-adder") {
      addInput(THREE, root, -3.4, -1.15, a, "A");
      addInput(THREE, root, -3.4, 1.15, b, "B");
      if (circuit.id === "full-adder") addInput(THREE, root, -1.7, 2.25, c, "C", "C");
      addDustPath(THREE, root, [[-2.9, -1.15], [-1.9, -1.15], [-1.05, -1.15]], 0.06, a);
      addDustPath(THREE, root, [[-2.9, 1.15], [-1.9, 1.15], [-1.05, 1.15]], 0.06, b);
      addModule(THREE, root, -0.45, -1.15, "XOR", output);
      addModule(THREE, root, -0.45, 1.15, "AND", secondary);
      if (circuit.id === "full-adder") addModule(THREE, root, 1.0, 0, "CARRY", secondary);
      addLamp(THREE, root, 2.55, -1.15, output);
      addLamp(THREE, root, 2.55, 1.15, secondary);
      addLabel(THREE, root, "SUM", 2.55, 1.25, -1.15, 0.8);
      addLabel(THREE, root, "CARRY", 2.55, 1.25, 1.15, 0.95);
      return;
    }
    if (circuit.id === "decoder") {
      addInput(THREE, root, -3.2, -0.8, a, "A");
      addInput(THREE, root, -3.2, 0.8, b, "B");
      const address = Number(a) * 2 + Number(b);
      for (let line = 0; line < 4; line += 1) {
        const z = -1.8 + line * 1.2;
        addDustPath(THREE, root, [[-2.7, 0], [-1.7, 0], [-0.8, z], [0.3, z]], 0.06, address === line);
        addLamp(THREE, root, 1.25, z, address === line);
        addLabel(THREE, root, `Y${line}`, 1.25, 1.2, z, 0.55);
      }
      return;
    }
    if (circuit.id === "demux") {
      addInput(THREE, root, -3.2, 0, a, "A");
      addInput(THREE, root, -1.9, 2.0, selected, "SEL", "SEL");
      addDustPath(THREE, root, [[-2.7, 0], [-1.2, 0], [0, 0], [0.7, selected ? 1.2 : -1.2], [1.3, selected ? 1.2 : -1.2]], 0.06, a);
      addLamp(THREE, root, 1.9, -1.2, a && !selected);
      addLamp(THREE, root, 1.9, 1.2, a && selected);
      addLabel(THREE, root, "Y0", 1.9, 1.15, -1.2, 0.6);
      addLabel(THREE, root, "Y1", 1.9, 1.15, 1.2, 0.6);
      return;
    }
    addInput(THREE, root, -3.2, -1.1, a, circuit.id === "mux" ? "D0" : "A", "A");
    addInput(THREE, root, -3.2, 1.1, b, circuit.id === "mux" ? "D1" : "B", "B");
    if (circuit.id === "majority") addInput(THREE, root, -1.9, 2.4, c, "C", "C");
    if (circuit.id === "mux") addInput(THREE, root, -1.9, 2.4, selected, "SEL", "SEL");
    const logicName = circuit.id === "implication" ? "A→B" : circuit.title.replace(" gate", "").slice(0, 8).toUpperCase();
    addDustPath(THREE, root, [[-2.7, -1.1], [-1.5, -1.1], [-0.7, 0]], 0.06, a);
    addDustPath(THREE, root, [[-2.7, 1.1], [-1.5, 1.1], [-0.7, 0]], 0.06, b);
    addModule(THREE, root, 0.1, 0, logicName, output);
    addDustPath(THREE, root, [[0.58, 0], [1.45, 0]], 0.06, output);
    addLamp(THREE, root, 2.1, 0, output);
    return;
  }

  if (circuit.category === "Pulse") {
    const lit = Boolean(props.pulse ?? output);
    addInput(THREE, root, -3, 0, a || lit, "A");
    if (circuit.id === "hopper-timer") {
      addHopper(THREE, root, -1.1, 0.6, 0);
      addComparator(THREE, root, 0.1, 0.14, lit);
    } else if (circuit.id === "retriggerable-timer") {
      addComparator(THREE, root, -0.9, 0.14, lit);
      addRepeater(THREE, root, 0.35, 0, lit);
    } else {
      addRepeater(THREE, root, -0.9, 0, lit);
      if (circuit.id === "observer-edge") addBlock(THREE, root, 0.3, 0, lit);
    }
    addDustPath(THREE, root, [[-2.5, 0], [-1.5, 0], [-0.5, 0], [0.75, 0], [1.5, 0]], 0.06, lit);
    addLamp(THREE, root, 2.2, 0, lit);
    addLabel(THREE, root, lit ? "PULSE" : "WAIT", 0.3, 1.25, -0.4, 0.85);
    return;
  }

  if (circuit.category === "Memory") {
    if (circuit.id === "register-4bit") {
      addInput(THREE, root, -3.1, 0, a, "WRITE");
      for (let bit = 0; bit < 4; bit += 1) {
        const powered = Boolean(stored & (1 << bit));
        const z = -1.8 + bit * 1.2;
        addBlock(THREE, root, 0, z, powered);
        addTorch(THREE, root, 0.7, z, powered, true);
        addLamp(THREE, root, 2, z, powered);
        addLabel(THREE, root, `BIT ${bit}`, 2, 1.15, z, 0.9);
      }
      return;
    }
    if (circuit.id === "analog-memory") {
      addComparator(THREE, root, -0.3, 0, output);
      for (let level = 0; level < 5; level += 1) {
        const powered = level < Math.ceil(stored / 3);
        box(THREE, root, 1.0 + level * 0.38, 0.1 + level * 0.2, 0, 0.28, 0.16, 0.32, powered ? 0xff4936 : 0x581b1a, { outline: false, emissive: powered ? 0xa42318 : 0, intensity: powered ? 0.6 : 0 });
      }
      addLabel(THREE, root, `PEAK ${stored}`, 1.5, 1.8, -0.35, 1.15);
      return;
    }
    if (circuit.id === "piston-toggle") {
      addInput(THREE, root, -2.8, 0, a, "T");
      addPiston(THREE, root, 0, 0.28, 0, Boolean(stored));
      addBlock(THREE, root, 1.2 + (stored ? 0.8 : 0), 0, Boolean(stored));
      addLamp(THREE, root, 2.7, 0, Boolean(stored));
      return;
    }
    if (circuit.id === "copper-bulb") {
      addInput(THREE, root, -2.8, 0, a, "T");
      box(THREE, root, 0, 0.52, 0, 0.94, 0.94, 0.94, stored ? 0xf0ba69 : 0x996342, { emissive: stored ? 0xa35f26 : 0, intensity: stored ? 0.6 : 0 });
      addDustPath(THREE, root, [[-2.3, 0], [-1.4, 0], [-0.5, 0]], 0.06, a);
      addLabel(THREE, root, stored ? "LIT · ON" : "LIT · OFF", 0, 1.55, 0, 1.2);
      return;
    }
    addInput(THREE, root, -3, -1.1, a, circuit.id === "rs-latch" ? "SET" : "D", "A");
    addInput(THREE, root, -3, 1.1, b, circuit.id === "rs-latch" ? "RESET" : "CLK", "B");
    addDustPath(THREE, root, [[-2.5, -1.1], [-1.6, -1.1], [-0.6, -1.1], [0.2, 0]], 0.06, output);
    addDustPath(THREE, root, [[-2.5, 1.1], [-1.6, 1.1], [-0.6, 1.1], [0.2, 0]], 0.06, !output);
    addBlock(THREE, root, 0.5, 0, output);
    addTorch(THREE, root, 1.0, -0.2, !output, true);
    addLamp(THREE, root, 2.2, -1, output);
    addLamp(THREE, root, 2.2, 1, !output);
    addLabel(THREE, root, output ? "Q 1" : "Q 0", 2.2, 1.4, -1, 0.85);
    return;
  }

  if (circuit.category === "Detection") {
    if (circuit.id === "pressure-plate") {
      addPressurePlate(THREE, root, -1.5, 0, output);
      addDustPath(THREE, root, [[-1.0, 0], [0, 0], [1.1, 0]], 0.06, output);
      addLamp(THREE, root, 1.8, 0, output);
      addLabel(THREE, root, output ? "PRESSED" : "IDLE", -1.5, 1.1, 0, 1.0);
      return;
    }
    addContainer(THREE, root, -2.2, 0, value);
    addDustPath(THREE, root, [[-1.7, 0], [-0.9, 0]], 0.06, output);
    addComparator(THREE, root, -0.3, 0, output);
    addDustPath(THREE, root, [[0.1, 0], [0.9, 0], [1.4, 0]], 0.06, output);
    addLamp(THREE, root, 2, 0, output);
    addLabel(THREE, root, `FILL ${value}%`, -2.2, 1.3, 0, 1.05);
    return;
  }

  if (circuit.category === "Transport" || circuit.category === "Storage") {
    addContainer(THREE, root, -2.5, 0, itemCount);
    if (circuit.id.includes("dropper")) addDropper(THREE, root, -0.7, 0, sentCount > 0);
    else addHopper(THREE, root, -0.7, 0.62, 0);
    if (circuit.id === "dropper-elevator") {
      addDropper(THREE, root, -0.7, -1.0, sentCount > 1);
      addDropper(THREE, root, -0.7, 1.0, sentCount > 2);
    }
    if (circuit.id === "hopper-lock") addBlock(THREE, root, -0.7, -0.9, Boolean(props.locked));
    addDustPath(THREE, root, [[-2.0, 0], [-1.35, 0], [-0.2, 0], [0.9, 0]], 0.06, sentCount > 0);
    addContainer(THREE, root, 1.6, 0, sentCount);
    addLabel(THREE, root, `${sentCount} MOVED`, 1.6, 1.35, 0, 1.05);
    if (circuit.category === "Storage") {
      addContainer(THREE, root, 1.6, -1.2, itemCount > 8 ? itemCount - 8 : 0);
      addLabel(THREE, root, "OVERFLOW", 1.6, 1.25, -1.2, 1.0);
    }
    return;
  }

  if (circuit.category === "Pistons") {
    addInput(THREE, root, -3, 0, Boolean(props.extended), "A");
    const extended = Boolean(props.extended);
    const isWideDoor = circuit.id === "piston-door-2x2";
    const count = isWideDoor ? 4 : circuit.id === "slime-pusher" || circuit.id === "honey-separation" ? 3 : 1;
    addPiston(THREE, root, -0.6, 0.28, 0, extended);
    if (circuit.id === "honey-separation") {
      box(THREE, root, 0.55 + (extended ? 0.45 : 0), 0.48, -0.55, 0.62, 0.62, 0.62, 0x91b660);
      box(THREE, root, 0.55 + (extended ? 0.45 : 0), 0.48, 0.55, 0.62, 0.62, 0.62, 0xdaa84d);
    } else {
      for (let block = 0; block < count; block += 1) {
        const dx = extended ? 1.35 + block * 0.7 : 0.55 + block * 0.7;
        const z = isWideDoor ? -0.55 + (block % 2) * 1.1 : circuit.id === "slime-pusher" ? -0.8 + block * 0.8 : 0;
        const y = isWideDoor ? 0.4 + Math.floor(block / 2) * 0.85 : 0.48;
        const color = circuit.id === "slime-pusher" ? 0x91b660 : 0x7c826f;
        box(THREE, root, dx, y, z, 0.72, 0.72, 0.72, color, { emissive: extended ? 0x334d27 : 0, intensity: extended ? 0.35 : 0 });
      }
    }
    addLabel(THREE, root, extended ? "EXTENDED" : "RETRACTED", 1.2, 2.3, 0, 1.5);
  }
}

function updateCircuit(engine: Engine, props: Props) {
  const { THREE, root } = engine;
  const gate = props.gate ?? "AND";
  clearGroup(THREE, root);
  if (props.circuit) buildCatalogCircuit(THREE, root, props);
  else if (props.clock) buildClockCircuit(THREE, root, props);
  else if (gate === "NOT") buildNot(THREE, root, props.inputA, props.output);
  else if (gate === "OR") buildOr(THREE, root, props.inputA, props.inputB, props.output);
  else if (gate === "AND") buildAnd(THREE, root, props.inputA, props.inputB, props.output);
  else if (gate === "NAND") buildAnd(THREE, root, props.inputA, props.inputB, props.output, true);
  else if (gate === "NOR") buildOr(THREE, root, props.inputA, props.inputB, props.output, true);
  else buildComposite(THREE, root, gate as "NAND" | "NOR" | "XOR", props.inputA, props.inputB, props.output);
  engine.render();
}

export default function RedstoneCircuit3D(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onInputToggleRef = useRef(props.onInputToggle);

  useEffect(() => {
    onInputToggleRef.current = props.onInputToggle;
  }, [props.onInputToggle]);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let engine: Engine | undefined;
    let cleanupCanvasInteraction: (() => void) | undefined;

    const initialize = () => {
      try {
        if (disposed || !canvasRef.current || !hostRef.current) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x151913);
        scene.add(new THREE.HemisphereLight(0xe8efdc, 0x283023, 2.15));
        const keyLight = new THREE.DirectionalLight(0xffedc8, 2.3);
        keyLight.position.set(-5, 10, 7);
        scene.add(keyLight);
        addGround(THREE, scene);

        const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 80);
        camera.position.set(8, 8, 8);
        camera.lookAt(0, 0.45, 0);
        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 0.45, 0);
        controls.enableDamping = false;
        controls.enablePan = false;
        controls.minZoom = 0.72;
        controls.maxZoom = 2.4;

        const root = new THREE.Group();
        scene.add(root);
        const render = () => renderer.render(scene, camera);
        controls.addEventListener("change", render);
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let pointerStart: { id: number; x: number; y: number } | undefined;
        const inputAt = (event: PointerEvent): CircuitInput | null => {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
          raycaster.setFromCamera(pointer, camera);
          for (const intersection of raycaster.intersectObjects(root.children, true)) {
            let current: Object3D | null = intersection.object;
            while (current && current !== root) {
              const input = current.userData.input;
              if (input === "A" || input === "B" || input === "C" || input === "SEL") return input;
              current = current.parent;
            }
          }
          return null;
        };
        const onPointerDown = (event: PointerEvent) => {
          if (event.button !== 0) return;
          pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
        };
        const onPointerUp = (event: PointerEvent) => {
          if (!pointerStart || pointerStart.id !== event.pointerId) return;
          const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
          pointerStart = undefined;
          if (moved > 7) return;
          const input = inputAt(event);
          if (input) onInputToggleRef.current?.(input);
        };
        const onPointerMove = (event: PointerEvent) => {
          if (pointerStart) return;
          renderer.domElement.style.cursor = inputAt(event) ? "pointer" : "grab";
        };
        const onPointerCancel = () => { pointerStart = undefined; };
        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointerup", onPointerUp);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointercancel", onPointerCancel);
        cleanupCanvasInteraction = () => {
          renderer.domElement.removeEventListener("pointerdown", onPointerDown);
          renderer.domElement.removeEventListener("pointerup", onPointerUp);
          renderer.domElement.removeEventListener("pointermove", onPointerMove);
          renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
        };
        const reset = () => {
          camera.position.set(8, 8, 8);
          camera.zoom = 1;
          camera.lookAt(0, 0.45, 0);
          camera.updateProjectionMatrix();
          controls.target.set(0, 0.45, 0);
          controls.update();
          render();
        };

        engine = { THREE, renderer, scene, camera, controls, root, render, reset };
        engineRef.current = engine;

        const resize = () => {
          const host = hostRef.current;
          if (!host || !engine) return;
          const width = host.clientWidth;
          const height = host.clientHeight;
          if (!width || !height) return;
          const viewWidth = 12;
          const viewHeight = viewWidth / (width / height);
          camera.left = -viewWidth / 2;
          camera.right = viewWidth / 2;
          camera.top = viewHeight / 2;
          camera.bottom = -viewHeight / 2;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
          render();
        };
        observer = new ResizeObserver(resize);
        observer.observe(hostRef.current);
        resize();
        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    };

    initialize();
    return () => {
      disposed = true;
      observer?.disconnect();
      cleanupCanvasInteraction?.();
      if (engine) {
        engine.controls.dispose();
        clearGroup(engine.THREE, engine.root);
        engine.renderer.dispose();
      }
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (ready && engineRef.current) updateCircuit(engineRef.current, props);
  }, [ready, props.gate, props.circuit?.id, props.inputA, props.inputB, props.inputC, props.select, props.output, props.secondaryOutput, props.value, props.stored, props.itemCount, props.sentCount, props.locked, props.extended, props.pulse, props.clock, props.clockPhase, props.clockEnabled, props.clockStopped]);

  const fallback = props.gate ? FALLBACKS[props.gate] : undefined;
  const circuitName = props.circuit?.title ?? (props.clock ? ({
    "repeater-clock": "Repeater clock",
    "torch-clock": "Torch clock",
    "comparator-clock": "Comparator clock",
    "hopper-clock": "Two-hopper piston clock",
    "stoppable-clock": "Stoppable repeater clock",
  } satisfies Record<RedstoneClock, string>)[props.clock] : props.gate ?? "Redstone circuit");
  const gate = props.gate ?? "AND";
  const formula = gate === "XOR" ? "(A OR B) AND NOT(A AND B)" : gate === "NAND" ? "AND → NOT" : "OR → NOT";

  return (
    <div className="redstone-3d-viewer">
      <div className="redstone-3d-toolbar">
        <span className="redstone-kicker">LIVE WEB 3D · {circuitName}{!props.circuit && !props.clock && (gate === "XOR" || gate === "NAND" || gate === "NOR") ? ` · ${formula}` : ""}</span>
        <button className="small-button" type="button" onClick={() => engineRef.current?.reset()}>Reset view</button>
      </div>
      <div className="redstone-3d-frame" ref={hostRef}>
        <canvas ref={canvasRef} className={failed ? "redstone-3d-canvas hidden" : "redstone-3d-canvas"} aria-label={`Interactive 3D ${circuitName} circuit`} />
        {!ready && !failed && <div className="redstone-3d-overlay">Loading 3D circuit…</div>}
        {failed && <div className="redstone-3d-fallback">
          {fallback ? <img src={`${import.meta.env.BASE_URL}redstone/${fallback.file}`} alt={fallback.alt} /> : <strong>{props.circuit ? `${circuitName} · ${props.circuit.category}` : props.clock ? `${circuitName} preview` : formula}</strong>}
          <span>3D is unavailable in this browser. This is a static circuit reference.</span>
        </div>}
      </div>
      <div className="redstone-3d-legend">
        <span><i className="signal-dot" /> powered redstone dust</span>
        {props.clock ? <span><b>PHASE</b> {props.clockPhase ? "HIGH" : "LOW"}</span> : props.circuit ? <span><b>MODEL</b> {props.circuit.category}</span> : <>
          <span><b>A</b> {props.inputA ? "1 · ON" : "0 · OFF"}</span>
          {gate !== "NOT" && <span><b>B</b> {props.inputB ? "1 · ON" : "0 · OFF"}</span>}
        </>}
        <span><b>OUT</b> {props.output ? "1 · ON" : "0 · OFF"}</span>
        {(props.circuit?.id === "half-adder" || props.circuit?.id === "full-adder") && <span><b>CARRY</b> {props.secondaryOutput ? "1 · ON" : "0 · OFF"}</span>}
      </div>
      <p className="redstone-3d-note">{props.circuit ? "Drag to rotate · scroll to zoom · click an in-scene input or use the controls below. This 3D model illustrates the circuit; the linked layout gives exact tested block positions." : props.clock ? "Drag to rotate · scroll to zoom. The adjacent controls show the clock phase and timing." : "Click an in-scene lever or use A/B above · drag to rotate · scroll to zoom."} {!props.circuit && <>Static fallback art: <a href="https://redstone.university/course/part-i--foundations/02_the-grammar-of-circuits/draft/" target="_blank" rel="noreferrer">Redstone University (fielding)</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>.</>}</p>
    </div>
  );
}
