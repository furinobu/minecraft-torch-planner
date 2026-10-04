import { useEffect, useRef, useState } from "react";
import {
  Box3,
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
  Vector3,
  WebGLRenderer as ThreeWebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Group, Material, Object3D, OrthographicCamera, Scene, WebGLRenderer } from "three";
import type { OrbitControls as OrbitControlsType } from "three/addons/controls/OrbitControls.js";
import type { CircuitDefinition } from "./redstoneCircuits";
import { REDSTONE_LOGIC_LAYOUTS } from "./redstoneLogicLayouts";
import type { LogicLayoutPart } from "./redstoneLogicLayouts";

const THREE = {
  Box3,
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
  Vector3,
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
  fitView: () => void;
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

function addTorch(THREE: Three, root: Group, x: number, z: number, powered: boolean, wall = false, baseY = 1, facing = "east", mountOffset = 0.53) {
  const angle = logicFacingAngle(facing);
  const forwardX = Math.cos(angle);
  const forwardZ = -Math.sin(angle);
  const lean = wall ? 0.38 : 0;
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, 0.34, 6),
    new THREE.MeshStandardMaterial({ color: 0x805333, roughness: 1 }),
  );
  rod.position.set(x - forwardX * (wall ? mountOffset : 0), wall ? 0.42 : baseY + 0.17, z - forwardZ * (wall ? mountOffset : 0));
  if (wall) {
    rod.rotation.z = -forwardX * lean;
    rod.rotation.x = forwardZ * lean;
  }
  root.add(rod);
  const tipOffset = 0.17 * Math.sin(lean);
  const tipY = rod.position.y + 0.19 * Math.cos(lean);
  box(THREE, root, rod.position.x + forwardX * tipOffset, tipY, rod.position.z + forwardZ * tipOffset, 0.17, 0.12, 0.17,
    powered ? 0xff7640 : 0x693c32, { emissive: powered ? 0xff3417 : 0, intensity: powered ? 1.5 : 0 });
}

function addLamp(THREE: Three, root: Group, x: number, z: number, powered: boolean, label = "OUT") {
  box(THREE, root, x, 0.48, z, 0.82, 0.86, 0.82, powered ? 0xffd36c : 0x66523a, {
    emissive: powered ? 0xffa829 : 0,
    intensity: powered ? 1.45 : 0,
  });
  addLabel(THREE, root, `${label} ${powered ? 1 : 0}`, x, 1.18, z, 1.08);
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

const LOGIC_CELL = 1;
const LOGIC_LAYER = 0.92;
const LOGIC_WALL_TORCH_OFFSET = 0.52;

function logicFacingAngle(facing = "east") {
  if (facing === "north") return Math.PI / 2;
  if (facing === "south") return -Math.PI / 2;
  if (facing === "west") return Math.PI;
  return 0;
}

function layoutPosition(part: LogicLayoutPart, offsetX: number, offsetZ: number) {
  return {
    x: (part.x - offsetX) * LOGIC_CELL,
    y: part.layer * LOGIC_LAYER,
    z: (part.z - offsetZ) * LOGIC_CELL,
  };
}

function addLayoutStone(THREE: Three, root: Group, x: number, y: number, z: number) {
  const color = root.userData.circuitId === "XOR"
    ? y < LOGIC_LAYER / 2 ? 0xf0dfb8 : 0xd5dbc9
    : 0x777c77;
  box(THREE, root, x, y + 0.46, z, 0.96, 0.92, 0.96, color);
}

function addLayoutLever(THREE: Three, root: Group, x: number, y: number, z: number, input: "A" | "B" | "C" | "SEL", label: string, powered: boolean, facing?: string, mount?: "wall") {
  const lever = new THREE.Group();
  const angle = logicFacingAngle(facing);
  const forwardX = Math.cos(angle);
  const forwardZ = -Math.sin(angle);
  lever.position.set(x + (mount === "wall" ? forwardX * 0.5 : 0), y + (mount === "wall" ? 0.46 : 0.92), z + (mount === "wall" ? forwardZ * 0.5 : 0));
  if (mount === "wall") {
    if (facing === "north") lever.rotation.x = -Math.PI / 2;
    else if (facing === "south") lever.rotation.x = Math.PI / 2;
    else if (facing === "west") lever.rotation.z = Math.PI / 2;
    else lever.rotation.z = -Math.PI / 2;
  } else lever.rotation.y = angle;
  lever.userData.input = input;
  root.add(lever);
  box(THREE, lever, 0, 0.035, 0, 0.38, 0.07, 0.3, powered ? 0x9b8054 : 0x62665b);
  const handle = new THREE.Group();
  handle.position.set(0, 0.07, 0);
  handle.rotation.z = powered ? -0.78 : 0.78;
  lever.add(handle);
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.052, 0.34, 6),
    new THREE.MeshStandardMaterial({ color: 0x92988a, roughness: 0.83 }),
  );
  bar.position.set(0, 0.17, 0);
  handle.add(bar);
  box(THREE, handle, 0, 0.36, 0, 0.15, 0.15, 0.15, powered ? 0xffcc68 : 0xa8afa0);
  addLabel(THREE, root, `${label} ${powered ? 1 : 0}`, x, y + 1.72, z, 0.82);
}

function addLayoutTorch(THREE: Three, root: Group, x: number, y: number, z: number, powered: boolean, wall: boolean, facing?: string) {
  const angle = logicFacingAngle(facing);
  const forwardX = Math.cos(angle);
  const forwardZ = -Math.sin(angle);
  const offset = wall ? LOGIC_WALL_TORCH_OFFSET : 0;
  const lean = wall ? 0.38 : 0;
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, 0.34, 6),
    new THREE.MeshStandardMaterial({ color: 0x805333, roughness: 1 }),
  );
  rod.position.set(x - forwardX * offset, y + (wall ? 0.34 : 0.17), z - forwardZ * offset);
  if (wall) {
    rod.rotation.z = -forwardX * lean;
    rod.rotation.x = forwardZ * lean;
  }
  root.add(rod);
  const tipOffset = 0.17 * Math.sin(lean);
  const tipY = rod.position.y + 0.19 * Math.cos(lean);
  box(THREE, root, rod.position.x + forwardX * tipOffset, tipY, rod.position.z + forwardZ * tipOffset, 0.17, 0.12, 0.17,
    powered ? 0xff7640 : 0x693c32, { emissive: powered ? 0xff3417 : 0, intensity: powered ? 1.2 : 0 });
}

function addLayoutRepeater(THREE: Three, root: Group, x: number, y: number, z: number, facing: string | undefined, powered: boolean, comparator = false) {
  const component = new THREE.Group();
  component.position.set(x, y + 0.06, z);
  component.rotation.y = logicFacingAngle(facing);
  root.add(component);
  box(THREE, component, 0, 0.035, 0, 0.96, 0.12, 0.48, 0x9a9b8e);
  box(THREE, component, 0, 0.105, 0, comparator ? 0.42 : 0.5, 0.035, 0.09,
    powered ? 0xff4936 : 0x5d2420, { outline: false });
  const postXs = comparator ? [-0.2, 0, 0.2] : [-0.18, 0.18];
  for (const postX of postXs) {
    box(THREE, component, postX, 0.17, 0, 0.07, 0.08, 0.08,
      powered ? 0xff7143 : 0x754a37, { emissive: powered ? 0xc72d18 : 0, intensity: powered ? 0.35 : 0 });
  }
}

function logicOutputValues(id: string, props: Props, lampCount: number) {
  if (id === "decoder") {
    const address = Number(props.inputA) * 2 + Number(props.inputB);
    return Array.from({ length: lampCount }, (_, index) => address === index);
  }
  if (id === "demux") return [props.inputA && !props.select, props.inputA && Boolean(props.select)];
  if (id === "half-adder" || id === "full-adder") {
    const sum = Number(props.inputA) + Number(props.inputB) + (id === "full-adder" ? Number(props.inputC) : 0);
    return [sum % 2 === 1, sum >= 2];
  }
  return [props.output];
}

function logicDustPowered(part: LogicLayoutPart, props: Props, circuitId: string) {
  const { x, z, layer } = part;
  const a = props.inputA;
  const b = props.inputB;
  const output = props.output;

  if (circuitId === "implication") {
    if (layer !== 0) return false;
    if (x === 2 && z === 0) return !a;
    return (x === 2 || x === 3) && z === 2 && output;
  }

  if (circuitId === "NOT") {
    return layer === 0 && z === 0 && ((x === 1 && a) || (x === 4 && output));
  }
  if (circuitId === "OR") return layer === 0 && output;
  if (circuitId === "NOR") {
    if (layer !== 0) return false;
    if (x >= 1 && x <= 3 && z >= 0 && z <= 2) return a || b;
    return x === 6 && z === 1 && output;
  }
  if (circuitId === "AND") {
    if (layer === 0 && x === 1 && z === 0) return a;
    if (layer === 0 && x === 1 && z === 2) return b;
    if (layer === 0 && x === 4 && z === 1) return output;
    return layer === 1 && x === 2 && z === 1 && (!a || !b);
  }
  if (circuitId === "NAND") {
    if (layer === 0 && x === 1 && z === 0) return a;
    if (layer === 0 && x === 1 && z === 2) return b;
    return layer === 1 && (x === 2 || x === 3) && z === 1 && output;
  }

  if (circuitId === "XOR") {
    if (part.signal === "A") return a;
    if (part.signal === "B") return b;
    if (part.signal === "A_ONLY") return a && !b;
    if (part.signal === "B_ONLY") return !a && b;
    return part.signal === "OUTPUT" && output;
  }
  if (circuitId === "XNOR") {
    const leftTerm = a && b;
    const rightTerm = !a && !b;
    if (layer === 0 && z === 0) return a;
    if (layer === 3 && z === 0) return b;
    if (layer === 0 && z >= 10) return output;
    if (layer === 0 && x <= 4) return leftTerm;
    if (layer === 0 && x >= 8) return rightTerm;
    if ((layer === 1 || layer === 2) && x === 4) return leftTerm;
    if ((layer === 1 || layer === 2) && x === 10) return rightTerm;
    if (layer === 3 && x <= 4) return leftTerm;
    if (layer === 3 && x >= 8) return rightTerm;
  }

  return false;
}

function logicTorchPowered(part: LogicLayoutPart, props: Props, circuitId: string) {
  const { x, z, layer } = part;
  if (circuitId === "implication") return layer === 0 && x === 1 && z === 0 && !props.inputA;
  if (circuitId === "XOR" && layer === 2) {
    if (part.signal === "A_ONLY") return props.inputA && !props.inputB;
    if (part.signal === "B_ONLY") return !props.inputA && props.inputB;
  }
  if (circuitId === "NOT" || circuitId === "NOR" || circuitId === "AND") {
    if (part.kind === "wall-torch") return props.output;
  }
  if (circuitId === "AND" || circuitId === "NAND") {
    return layer === 1 && x === 2 && (z === 0 ? !props.inputA : z === 2 && !props.inputB);
  }
  if (circuitId === "XNOR") {
    const leftTerm = props.inputA && props.inputB;
    const rightTerm = !props.inputA && !props.inputB;
    if (z === 9 && (x === 2 || x === 8)) return !props.inputA;
    if (z === 9 && x === 10) return !props.inputB;
    if (z === 13 && x === 3) return !leftTerm;
    if (z === 13 && x === 9) return !rightTerm;
  }
  return false;
}

function logicComponentPowered(part: LogicLayoutPart, props: Props, circuitId: string) {
  const { x, z, layer } = part;
  if (circuitId === "implication") {
    if (layer !== 0) return false;
    if (x === 2 && z === 1) return !props.inputA;
    return x === 1 && z === 2 && props.inputB;
  }
  if ((circuitId === "OR" || circuitId === "NOR") && layer === 0) {
    if (x === 1 && z === 0) return props.inputA;
    if (x === 1 && z === 2) return props.inputB;
  }
  if (circuitId === "XOR") {
    if (layer !== 0) return false;
    if (part.kind === "comparator" && x === 2 && z === 1) return props.inputA && !props.inputB;
    if (part.kind === "comparator" && x === 2 && z === 4) return !props.inputA && props.inputB;
    if (part.kind === "repeater" && x === 4 && z === 2) return props.output;
  }
  if (circuitId === "XNOR") {
    const leftTerm = props.inputA && props.inputB;
    const rightTerm = !props.inputA && !props.inputB;
    if (z === 0 && layer === 0) return props.inputA;
    if (z === 0 && layer === 3) return props.inputB;
    if (layer === 0 && z === 16 && x === 5) return props.output;
    if (x <= 4) return leftTerm;
    if (x >= 8) return rightTerm;
  }
  return false;
}

function buildLogicLayout(THREE: Three, root: Group, props: Props, circuitId: string) {
  const parts = REDSTONE_LOGIC_LAYOUTS[circuitId];
  if (!parts) return false;
  root.userData.circuitId = circuitId;
  const maxX = Math.max(...parts.map((part) => part.x));
  const maxZ = Math.max(...parts.map((part) => part.z));
  const offsetX = maxX / 2 - (maxX % 2 === 0 ? 0.5 : 0);
  const offsetZ = maxZ / 2 - (maxZ % 2 === 0 ? 0.5 : 0);
  const stoneCells = new Set(parts.filter((part) => part.kind === "stone").map((part) => `${part.layer}:${part.x}:${part.z}`));
  const lampCells = new Set(parts.filter((part) => part.kind === "lamp").map((part) => `${part.layer}:${part.x}:${part.z}`));
  const dustByCell = new Map(parts.filter((part) => part.kind === "dust").map((part) => [`${part.layer}:${part.x}:${part.z}`, part]));
  const partsByCell = new Map<string, LogicLayoutPart[]>();
  for (const part of parts) {
    const key = `${part.layer}:${part.x}:${part.z}`;
    partsByCell.set(key, [...(partsByCell.get(key) ?? []), part]);
  }
  const wireContactLength = (key: string, dx: number, dz: number) => {
    const contacts = partsByCell.get(key) ?? [];
    if (contacts.some((part) => part.kind === "stone" || part.kind === "lever" || part.kind === "lamp")) return 0.52;
    if (contacts.some((part) => part.kind === "wall-torch" || part.kind === "torch")) {
      // Half a cell from the dust center ends at the adjacent torch block's boundary.
      return LOGIC_CELL / 2;
    }
    const component = contacts.find((part) => part.kind === "repeater" || part.kind === "comparator");
    if (!component) return null;
    const runsAlongX = component.facing !== "north" && component.facing !== "south";
    const alongComponent = dx !== 0 ? runsAlongX : dz !== 0 && !runsAlongX;
    return 1 - (alongComponent ? 0.48 : 0.24);
  };
  const inputs: Record<string, boolean> = {
    A: props.inputA,
    B: props.inputB,
    C: Boolean(props.inputC),
    SEL: Boolean(props.select),
  };
  const inputLabels: Record<string, string> = circuitId === "mux" ? { A: "D0", B: "D1", SEL: "SEL" }
    : circuitId === "demux" ? { A: "DATA", SEL: "SEL" }
      : circuitId === "full-adder" ? { A: "A", B: "B", C: "CIN" }
        : { A: "A", B: "B", C: "C", SEL: "SEL" };
  const lamps = parts.filter((part) => part.kind === "lamp").sort((a, b) => a.x - b.x || a.z - b.z);
  const outputValues = logicOutputValues(circuitId, props, lamps.length);
  const lampStates = new Map(lamps.map((part, index) => [`${part.layer}:${part.x}:${part.z}`, outputValues[index] ?? false]));

  for (const part of parts) {
    const { x, y, z } = layoutPosition(part, offsetX, offsetZ);
    if (part.kind === "stone") addLayoutStone(THREE, root, x, y, z);
    if (part.kind === "lever") {
      const cell = `${part.layer}:${part.x}:${part.z}`;
      if (!stoneCells.has(cell) && !lampCells.has(cell)) addLayoutStone(THREE, root, x, y, z);
      const id = part.input ?? "A";
      addLayoutLever(THREE, root, x, y, z, id, inputLabels[id] ?? id, inputs[id], part.facing, part.mount);
    }
    if (part.kind === "wall-torch" || part.kind === "torch") {
      const powered = logicTorchPowered(part, props, circuitId);
      addLayoutTorch(THREE, root, x, y, z, powered, part.kind === "wall-torch", part.facing);
    }
    if (part.kind === "repeater" || part.kind === "comparator") {
      const powered = logicComponentPowered(part, props, circuitId);
      addLayoutRepeater(THREE, root, x, y, z, part.facing, powered, part.kind === "comparator");
    }
    if (part.kind === "lamp") {
      const powered = circuitId === "XOR"
        ? part.label === "A" ? props.inputA : part.label === "B" ? props.inputB : props.output
        : lampStates.get(`${part.layer}:${part.x}:${part.z}`) ?? false;
      box(THREE, root, x, y + 0.46, z, 0.96, 0.92, 0.96, powered ? 0xffd36c : 0x66523a, {
        emissive: powered ? 0xffa829 : 0,
        intensity: powered ? 1.45 : 0,
      });
      if (circuitId !== "XOR" || (part.label !== "A" && part.label !== "B")) {
        addLabel(THREE, root, `${part.label ?? "OUT"} ${powered ? 1 : 0}`, x, y + 1.18, z, 0.9);
      }
    }
  }

  for (const part of dustByCell.values()) {
    const { x, y, z } = layoutPosition(part, offsetX, offsetZ);
    const wireY = y + 0.06;
    const powered = logicDustPowered(part, props, circuitId);
    const color = powered ? 0xff493d : 0x581b1a;
    const wireOptions = { emissive: powered ? 0xff2117 : 0, intensity: powered ? 1.2 : 0, outline: false };
    const segment = (dx: number, dz: number, length: number, segmentPowered = powered) => {
      const segmentColor = segmentPowered ? 0xff493d : 0x581b1a;
      box(THREE, root, x + dx * LOGIC_CELL * length / 2, wireY, z + dz * LOGIC_CELL * length / 2,
        dx ? LOGIC_CELL * length : LOGIC_CELL * 0.13, 0.04, dz ? LOGIC_CELL * length : LOGIC_CELL * 0.13, segmentColor,
        { emissive: segmentPowered ? 0xff2117 : 0, intensity: segmentPowered ? 1.2 : 0, outline: false });
    };
    const connectionPowered = (neighbor: LogicLayoutPart) => {
      const neighborPowered = logicDustPowered(neighbor, props, circuitId);
      return circuitId === "XOR" ? powered && neighborPowered : powered || neighborPowered;
    };
    const steppedSegment = (neighbor: LogicLayoutPart, dx: number, dz: number) => {
      const highPart = part.layer > neighbor.layer ? part : neighbor;
      const lowPart = part.layer > neighbor.layer ? neighbor : part;
      const high = layoutPosition(highPart, offsetX, offsetZ);
      const low = layoutPosition(lowPart, offsetX, offsetZ);
      const towardsLowX = Math.sign(lowPart.x - highPart.x);
      const towardsLowZ = Math.sign(lowPart.z - highPart.z);
      const faceX = dx ? high.x + towardsLowX * 0.49 : high.x;
      const faceZ = dz ? high.z + towardsLowZ * 0.49 : high.z;
      const segmentPowered = connectionPowered(neighbor);
      const segmentColor = segmentPowered ? 0xff493d : 0x581b1a;
      const height = Math.abs(high.y - low.y);
      box(THREE, root, faceX, (high.y + low.y) / 2 + 0.06, faceZ,
        dx ? 0.035 : 0.2, height, dz ? 0.035 : 0.2, segmentColor,
        { emissive: segmentPowered ? 0xff2117 : 0, intensity: segmentPowered ? 1.2 : 0, outline: false });
    };
    box(THREE, root, x, wireY, z, LOGIC_CELL * 0.2, 0.045, LOGIC_CELL * 0.2, color, wireOptions);
    const eastKey = `${part.layer}:${part.x + 1}:${part.z}`;
    const southKey = `${part.layer}:${part.x}:${part.z + 1}`;
    if (dustByCell.has(eastKey)) {
      segment(1, 0, 1, connectionPowered(dustByCell.get(eastKey)!));
    }
    else {
      const eastHigher = dustByCell.get(`${part.layer + 1}:${part.x + 1}:${part.z}`);
      const eastLower = dustByCell.get(`${part.layer - 1}:${part.x + 1}:${part.z}`);
      if (eastHigher) steppedSegment(eastHigher, 1, 0);
      else if (eastLower) steppedSegment(eastLower, 1, 0);
      else {
        const contactLength = wireContactLength(eastKey, 1, 0);
        if (contactLength !== null) segment(1, 0, contactLength);
      }
    }
    const westKey = `${part.layer}:${part.x - 1}:${part.z}`;
    if (!dustByCell.has(westKey)) {
      const contactLength = wireContactLength(westKey, -1, 0);
      if (contactLength !== null) segment(-1, 0, contactLength);
    }
    if (dustByCell.has(southKey)) {
      segment(0, 1, 1, connectionPowered(dustByCell.get(southKey)!));
    }
    else {
      const southHigher = dustByCell.get(`${part.layer + 1}:${part.x}:${part.z + 1}`);
      const southLower = dustByCell.get(`${part.layer - 1}:${part.x}:${part.z + 1}`);
      if (southHigher) steppedSegment(southHigher, 0, 1);
      else if (southLower) steppedSegment(southLower, 0, 1);
      else {
        const contactLength = wireContactLength(southKey, 0, 1);
        if (contactLength !== null) segment(0, 1, contactLength);
      }
    }
    const northKey = `${part.layer}:${part.x}:${part.z - 1}`;
    if (!dustByCell.has(northKey)) {
      const contactLength = wireContactLength(northKey, 0, -1);
      if (contactLength !== null) segment(0, -1, contactLength);
    }
  }
  return true;
}

function addGround(THREE: Three, scene: Scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 64),
    new THREE.MeshStandardMaterial({ color: 0x283427, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);
  const grid = new THREE.GridHelper(64, 64, 0x58634b, 0x394433);
  grid.position.y = -0.01;
  scene.add(grid);
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
    addTorch(THREE, root, 3, 2, running, true, 1, "south");
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
        addTorch(THREE, root, level % 2 === 0 ? -0.45 : 0.45, 0, level % 2 === 0 ? output : !output, false, y + 0.48);
        box(THREE, root, 0, y, 0, 0.94, 0.96, 0.94, 0x777c77);
      }
      addInput(THREE, root, -2.6, 0, a, "A");
      addLabel(THREE, root, "INVERT", 1.25, 3.45, 0, 1.05);
      return;
    }
    if (circuit.id === "wire-bridge") {
      addInput(THREE, root, -3.4, -1.6, a, "A");
      addInput(THREE, root, -3.4, 1.6, b, "B", "B");
      addDustPath(THREE, root, [[-2.9, -1.6], [-1.6, -1.6], [0, -1.6], [1.6, -1.6], [2.8, -1.6]], 0.06, a);
      addDustPath(THREE, root, [[-2.9, 1.6], [-1.6, 1.6], [0, 1.6], [1.6, 1.6], [2.8, 1.6]], 1.06, b);
      addBlock(THREE, root, 0, 0);
      addLabel(THREE, root, "CROSSING · ISOLATED", 0, 1.6, 0, 2.25);
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
        addTorch(THREE, root, 0.7, z, powered, true, 1, "east", 0.23);
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
    addTorch(THREE, root, 1.0, -0.2, !output, true, 1, "east", 0.03);
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

function updateCircuit(engine: Engine, props: Props, shouldFitView: boolean) {
  const { THREE, root } = engine;
  const gate = props.gate ?? "AND";
  clearGroup(THREE, root);
  if (props.circuit?.category === "Logic") buildLogicLayout(THREE, root, props, props.circuit.id);
  else if (props.circuit) buildCatalogCircuit(THREE, root, props);
  else if (props.clock) buildClockCircuit(THREE, root, props);
  else buildLogicLayout(THREE, root, props, gate);
  if (shouldFitView) engine.fitView();
  else engine.render();
}

export default function RedstoneCircuit3D(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onInputToggleRef = useRef(props.onInputToggle);
  const sceneKeyRef = useRef<string | undefined>(undefined);

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
        controls.minZoom = 0.02;
        controls.maxZoom = 2.4;

        const root = new THREE.Group();
        scene.add(root);
        const render = () => renderer.render(scene, camera);
        controls.addEventListener("change", render);
        const fitView = () => {
          camera.zoom = 1;
          const bounds = new THREE.Box3().setFromObject(root);
          if (bounds.isEmpty()) {
            controls.target.set(0, 0.45, 0);
            camera.position.set(8, 8, 8);
            camera.lookAt(controls.target);
            camera.updateProjectionMatrix();
            render();
            return;
          }

          const center = bounds.getCenter(new THREE.Vector3());
          camera.position.set(center.x + 8, center.y + 8, center.z + 8);
          camera.lookAt(center);
          controls.target.copy(center);
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld();
          const corners = [
            new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
            new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
            new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
            new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
            new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
            new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
            new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
            new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
          ];
          const maxX = Math.max(...corners.map((point) => Math.abs(point.project(camera).x)));
          const maxY = Math.max(...corners.map((point) => Math.abs(point.project(camera).y)));
          const boundsSize = bounds.getSize(new THREE.Vector3());
          const fitMargin = props.circuit?.id === "implication" ? 0.52 : Math.max(boundsSize.x, boundsSize.z) > 8 ? 0.5 : 0.72;
          camera.zoom = Math.max(controls.minZoom, Math.min(controls.maxZoom, fitMargin / maxX, fitMargin / maxY));
          camera.updateProjectionMatrix();
          controls.update();
          render();
        };
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
        const reset = fitView;

        engine = { THREE, renderer, scene, camera, controls, root, render, fitView, reset };
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
          if (root.children.length) fitView();
          else render();
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
    if (ready && engineRef.current) {
      const sceneKey = props.circuit?.id ?? props.clock ?? props.gate ?? "AND";
      const shouldFitView = sceneKeyRef.current !== sceneKey;
      sceneKeyRef.current = sceneKey;
      updateCircuit(engineRef.current, props, shouldFitView);
    }
  }, [ready, props.gate, props.circuit?.id, props.inputA, props.inputB, props.inputC, props.select, props.output, props.secondaryOutput, props.value, props.stored, props.itemCount, props.sentCount, props.locked, props.extended, props.pulse, props.clock, props.clockPhase, props.clockEnabled, props.clockStopped]);

  const fallback = props.gate ? FALLBACKS[props.gate] : undefined;
  const circuitName = props.circuit?.title ?? (props.clock ? ({
    "repeater-clock": "Repeater clock",
    "torch-clock": "Torch clock",
    "comparator-clock": "Comparator clock",
    "hopper-clock": "Two-hopper piston clock",
    "stoppable-clock": "Stoppable repeater clock",
  } satisfies Record<RedstoneClock, string>)[props.clock] : props.gate === "OR" ? "OR gate (isolated)" : props.gate ?? "Redstone circuit");
  const gate = props.gate ?? "AND";
  const formula = gate === "XOR" ? "(A AND NOT B) OR (NOT A AND B)" : gate === "NAND" ? "AND → NOT" : "OR → NOT";

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
        {props.clock || (props.circuit && props.circuit.category !== "Logic")
          ? <span><i className="signal-dot" /> powered redstone dust</span>
          : <span><b>LAYOUT</b> full block-by-block circuit</span>}
        {props.clock ? <span><b>PHASE</b> {props.clockPhase ? "HIGH" : "LOW"}</span> : props.circuit ? <span><b>MODEL</b> {props.circuit.category}</span> : <>
          <span><b>A</b> {props.inputA ? "1 · ON" : "0 · OFF"}</span>
          {gate !== "NOT" && <span><b>B</b> {props.inputB ? "1 · ON" : "0 · OFF"}</span>}
        </>}
        <span><b>OUT</b> {props.output ? "1 · ON" : "0 · OFF"}</span>
        {(props.circuit?.id === "half-adder" || props.circuit?.id === "full-adder") && <span><b>CARRY</b> {props.secondaryOutput ? "1 · ON" : "0 · OFF"}</span>}
      </div>
      <p className="redstone-3d-note">{props.circuit ? "Drag to rotate · scroll to zoom · click an in-scene input or use the controls below. The full Java block layout is shown." : props.clock ? "Drag to rotate · scroll to zoom. The adjacent controls show the clock phase and timing." : "Click an in-scene lever or use A/B above · drag to rotate · scroll to zoom."} {!props.circuit && <>Reference layouts: <a href="https://redstone.university/course/part-i--foundations/02_the-grammar-of-circuits/draft/" target="_blank" rel="noreferrer">Redstone University (fielding)</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>.</>}</p>
    </div>
  );
}
