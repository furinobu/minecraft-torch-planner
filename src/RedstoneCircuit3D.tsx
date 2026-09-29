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
  Scene as ThreeScene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  WebGLRenderer as ThreeWebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Group, Material, OrthographicCamera, Scene, WebGLRenderer } from "three";
import type { OrbitControls as OrbitControlsType } from "three/addons/controls/OrbitControls.js";

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
  Scene: ThreeScene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  WebGLRenderer: ThreeWebGLRenderer,
};

export type RedstoneGate = "NOT" | "OR" | "AND" | "NAND" | "NOR" | "XOR";

type Props = { gate: RedstoneGate; inputA: boolean; inputB: boolean; output: boolean };
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

function addLever(THREE: Three, root: Group, x: number, z: number, powered: boolean, label: string) {
  box(THREE, root, x, 1.0, z, 0.38, 0.08, 0.3, 0x62665b);
  const lever = new THREE.Group();
  lever.position.set(x, 1.04, z);
  root.add(lever);
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.052, 0.34, 6),
    new THREE.MeshStandardMaterial({ color: 0x92988a, roughness: 0.83 }),
  );
  bar.position.y = 0.17;
  bar.rotation.z = powered ? -0.48 : 0.48;
  lever.add(bar);
  box(THREE, root, x + (powered ? 0.08 : -0.08), 1.3, z, 0.12, 0.12, 0.12, powered ? 0xf1c16b : 0xa8afa0);
  addLabel(THREE, root, `${label} ${powered ? 1 : 0}`, x, 1.65, z, 0.82);
}

function addInput(THREE: Three, root: Group, x: number, z: number, powered: boolean, label: string) {
  addBlock(THREE, root, x, z, powered);
  addLever(THREE, root, x, z, powered, label);
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
      box(THREE, root, x, y, z + dz / 2, 0.1, 0.04, Math.abs(dz) + 0.05, color, { emissive, intensity: powered ? 0.8 : 0, outline: false });
    }
  }
}

function addRepeater(THREE: Three, root: Group, x: number, z: number, powered: boolean) {
  box(THREE, root, x, 0.07, z, 0.72, 0.12, 0.44, 0x9a9b8e);
  box(THREE, root, x, 0.145, z, 0.5, 0.035, 0.08, powered ? 0xff3828 : 0x581b1a, { outline: false });
  box(THREE, root, x - 0.18, 0.21, z, 0.07, 0.1, 0.1, powered ? 0xff6938 : 0x5f382b, { emissive: powered ? 0xc72d18 : 0, intensity: 0.5 });
  box(THREE, root, x + 0.18, 0.21, z, 0.07, 0.1, 0.1, powered ? 0xff6938 : 0x5f382b, { emissive: powered ? 0xc72d18 : 0, intensity: 0.5 });
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
  addDustPath(THREE, root, [[-0.9, 0], [-0.2, 0], [0.6, 0], [1.35, 0]], 0.06, output);
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
    addDustPath(THREE, root, [[1.45, 0], [2, 0]], 0.06, output);
    addLamp(THREE, root, 2.65, 0, output);
    return;
  }
  addBlock(THREE, root, 1.9, 0, orOutput);
  addTorch(THREE, root, 2.42, 0, output, true);
  addDustPath(THREE, root, [[2.55, 0], [3.2, 0], [3.85, 0]], 0.06, output);
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
  addDustPath(THREE, root, [[1.05, 0], [1.72, 0]], 0.06, andOutput);
  if (!invert) {
    addDustPath(THREE, root, [[1.72, 0], [2.32, 0]], 0.06, andOutput);
    addLamp(THREE, root, 2.95, 0, andOutput);
    return;
  }
  addBlock(THREE, root, 2.25, 0, andOutput);
  addTorch(THREE, root, 2.77, 0, output, true);
  addDustPath(THREE, root, [[2.9, 0], [3.5, 0], [4.1, 0]], 0.06, output);
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
    addDustPath(THREE, root, [[-0.42, 0], [0.25, 0]], 0.06, andOutput);
    addModule(THREE, root, 1.05, 0, "NOT", output);
    addDustPath(THREE, root, [[1.52, 0], [2.2, 0]], 0.06, output);
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
    addDustPath(THREE, root, [[-0.42, 0], [0.25, 0]], 0.06, orOutput);
    addModule(THREE, root, 1.05, 0, "NOT", output);
    addDustPath(THREE, root, [[1.52, 0], [2.2, 0]], 0.06, output);
    addLamp(THREE, root, 2.8, 0, output);
    return;
  }

  const orOutput = a || b;
  const andOutput = a && b;
  const notAnd = !andOutput;
  addInput(THREE, root, -4, -1.2, a, "A");
  addInput(THREE, root, -4, 1.2, b, "B");
  addDustPath(THREE, root, [[-3.5, -1.2], [-2.7, -1.2], [-2.1, -1.2]], 0.06, a);
  addDustPath(THREE, root, [[-3.5, 1.2], [-2.7, 1.2], [-2.1, -1.2]], 0.13, b);
  addModule(THREE, root, -1.6, -1.2, "OR", orOutput);
  addModule(THREE, root, -1.6, 1.2, "AND", andOutput);
  addDustPath(THREE, root, [[-1.12, -1.2], [-0.45, -1.2], [0.15, 0]], 0.06, orOutput);
  addDustPath(THREE, root, [[-1.12, 1.2], [-0.45, 1.2]], 0.06, andOutput);
  addModule(THREE, root, 0.55, 1.2, "NOT", notAnd);
  addDustPath(THREE, root, [[0.03, 1.2], [0.55, 1.2]], 0.06, andOutput);
  addDustPath(THREE, root, [[1.02, -1.2], [1.75, -1.2], [2.25, 0]], 0.06, orOutput);
  addDustPath(THREE, root, [[1.02, 1.2], [1.75, 1.2], [2.25, 0]], 0.13, notAnd);
  addModule(THREE, root, 2.72, 0, "AND", output);
  addDustPath(THREE, root, [[3.2, 0], [3.85, 0]], 0.06, output);
  addLamp(THREE, root, 4.45, 0, output);
}

function updateCircuit(engine: Engine, { gate, inputA, inputB, output }: Props) {
  const { THREE, root } = engine;
  clearGroup(THREE, root);
  if (gate === "NOT") buildNot(THREE, root, inputA, output);
  else if (gate === "OR") buildOr(THREE, root, inputA, inputB, output);
  else if (gate === "AND") buildAnd(THREE, root, inputA, inputB, output);
  else if (gate === "NAND") buildAnd(THREE, root, inputA, inputB, output, true);
  else if (gate === "NOR") buildOr(THREE, root, inputA, inputB, output, true);
  else buildComposite(THREE, root, gate, inputA, inputB, output);
  engine.render();
}

export default function RedstoneCircuit3D(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let engine: Engine | undefined;

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
  }, [ready, props.gate, props.inputA, props.inputB, props.output]);

  const fallback = FALLBACKS[props.gate];
  const formula = props.gate === "XOR" ? "(A OR B) AND NOT(A AND B)" : props.gate === "NAND" ? "AND → NOT" : "OR → NOT";

  return (
    <div className="redstone-3d-viewer">
      <div className="redstone-3d-toolbar">
        <span className="redstone-kicker">LIVE WEB 3D · {props.gate}{props.gate === "XOR" || props.gate === "NAND" || props.gate === "NOR" ? ` · ${formula}` : ""}</span>
        <button className="small-button" type="button" onClick={() => engineRef.current?.reset()}>Reset view</button>
      </div>
      <div className="redstone-3d-frame" ref={hostRef}>
        <canvas ref={canvasRef} className={failed ? "redstone-3d-canvas hidden" : "redstone-3d-canvas"} aria-label={`Interactive 3D ${props.gate} gate circuit`} />
        {!ready && !failed && <div className="redstone-3d-overlay">Loading 3D circuit…</div>}
        {failed && <div className="redstone-3d-fallback">
          {fallback ? <img src={`${import.meta.env.BASE_URL}redstone/${fallback.file}`} alt={fallback.alt} /> : <strong>{formula}</strong>}
          <span>3D is unavailable in this browser. This is a static circuit reference.</span>
        </div>}
      </div>
      <div className="redstone-3d-legend">
        <span><i className="signal-dot" /> powered redstone dust</span>
        <span><b>A</b> {props.inputA ? "1 · ON" : "0 · OFF"}</span>
        {props.gate !== "NOT" && <span><b>B</b> {props.inputB ? "1 · ON" : "0 · OFF"}</span>}
        <span><b>OUT</b> {props.output ? "1 · ON" : "0 · OFF"}</span>
      </div>
      <p className="redstone-3d-note">Drag to rotate · scroll to zoom. The 3D scene teaches signal flow; use the circuit link below for exact tested block placement. Static fallback art: <a href="https://redstone.university/course/part-i--foundations/02_the-grammar-of-circuits/draft/" target="_blank" rel="noreferrer">Redstone University (fielding)</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>.</p>
    </div>
  );
}
