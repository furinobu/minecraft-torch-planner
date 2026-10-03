import { lazy, Suspense, useEffect, useState } from "react";
import type { RedstoneClock, RedstoneGate } from "./RedstoneCircuit3D";
import CircuitBehaviorDemo from "./CircuitBehaviorDemo";
import { CIRCUIT_CATEGORIES, REDSTONE_CIRCUITS } from "./redstoneCircuits";

const RedstoneCircuit3D = lazy(() => import("./RedstoneCircuit3D"));

const GATES: RedstoneGate[] = ["NOT", "OR", "AND", "NAND", "NOR", "XOR"];

const CLOCKS: Array<{
  id: RedstoneClock;
  title: string;
  period: number;
  high: number;
  low: number;
  footprint: string;
  blocks: number;
  description: string;
  source: string;
}> = REDSTONE_CIRCUITS.filter((circuit) => circuit.clock).map((circuit) => ({
  id: circuit.id as RedstoneClock,
  title: circuit.title,
  period: circuit.clock!.period,
  high: circuit.clock!.high,
  low: circuit.clock!.low,
  footprint: `${circuit.width} × ${circuit.depth} · ${circuit.layers} ${circuit.layers === 1 ? "layer" : "layers"}`,
  blocks: circuit.blocks ?? 0,
  description: circuit.summary,
  source: `https://redstonery.com/circuits/${circuit.path}/`,
}));

const LEARNING_ITEMS = [
  { id: "ram", title: "4 × 8 RAM", summary: "Write and read four 8-bit words." },
  { id: "cpu", title: "8-bit CPU", summary: "Trace a tiny program through the datapath." },
];

const CIRCUIT_GROUPS = [
  ...CIRCUIT_CATEGORIES.map((name) => ({
    name,
    items: REDSTONE_CIRCUITS.filter((circuit) => circuit.category === name).map(({ id, title, summary }) => ({ id, title, summary })),
  })),
  { name: "Learning", items: LEARNING_ITEMS },
];

const DEDICATED_DEMOS = new Set([
  "NOT", "OR", "AND", "NAND", "NOR", "XOR",
  "repeater-clock", "torch-clock", "comparator-clock", "hopper-clock", "stoppable-clock", "ram", "cpu",
]);

function selectionFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const gate = params.get("gate");
  if (GATES.includes(gate as RedstoneGate)) return gate as RedstoneGate;
  const circuit = params.get("circuit");
  return circuit && (REDSTONE_CIRCUITS.some((item) => item.id === circuit) || LEARNING_ITEMS.some((item) => item.id === circuit))
    ? circuit
    : "AND";
}

function selectionHref(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.delete("gate");
  url.searchParams.delete("circuit");
  url.searchParams.set(GATES.includes(id as RedstoneGate) ? "gate" : "circuit", id);
  url.hash = "";
  return `${url.pathname}${url.search}`;
}

function scrollToSelection(id: string) {
  const section = id === "ram" ? document.getElementById("memory")
    : id === "cpu" ? document.getElementById("cpu")
      : GATES.includes(id as RedstoneGate) ? document.getElementById("gates")
        : document.querySelector<HTMLElement>(`[data-circuit-id="${id}"]`);
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function evaluate(gate: RedstoneGate, a: boolean, b: boolean) {
  switch (gate) {
    case "NOT": return !a;
    case "OR": return a || b;
    case "AND": return a && b;
    case "NAND": return !(a && b);
    case "NOR": return !(a || b);
    case "XOR": return a !== b;
  }
}

export default function RedstoneLearning() {
  const [gate, setGate] = useState<RedstoneGate>(() => {
    const selection = selectionFromUrl();
    return GATES.includes(selection as RedstoneGate) ? selection as RedstoneGate : "AND";
  });
  const [activeCircuit, setActiveCircuit] = useState(() => selectionFromUrl());
  const [circuitSearch, setCircuitSearch] = useState("");
  const [circuitCategory, setCircuitCategory] = useState("All circuits");
  const [inputA, setInputA] = useState(false);
  const [inputB, setInputB] = useState(false);
  const [clockPhase, setClockPhase] = useState(false);
  const [clockRunning, setClockRunning] = useState(true);
  const [clockSpeed, setClockSpeed] = useState(20);
  const [clockEnabled, setClockEnabled] = useState(true);
  const [clockStopped, setClockStopped] = useState(false);
  const [address, setAddress] = useState(0);
  const [dataIn, setDataIn] = useState(5);
  const [memory, setMemory] = useState([0, 0, 0, 0]);
  const output = evaluate(gate, inputA, inputB);
  const activeClock = CLOCKS.find((item) => item.id === activeCircuit) ?? null;
  const activeCircuitDefinition = REDSTONE_CIRCUITS.find((circuit) => circuit.id === activeCircuit);
  const clockOutput = Boolean(clockPhase && (activeClock?.id === "hopper-clock" || clockEnabled) && !(activeClock?.id === "stoppable-clock" && clockStopped));
  const visibleCircuitGroups = CIRCUIT_GROUPS
    .filter((group) => circuitCategory === "All circuits" || group.name === circuitCategory)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(circuitSearch.trim().toLowerCase())),
    }))
    .filter((group) => group.items.length > 0);
  const tableRows: Array<[number, number | null]> = gate === "NOT" ? [[0, null], [1, null]] : [[0, 0], [0, 1], [1, 0], [1, 1]];

  const selectCircuit = (id: string) => {
    const nextUrl = selectionHref(id);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentUrl !== nextUrl) window.history.pushState({ redstoneSelection: id }, "", nextUrl);
    setActiveCircuit(id);
    if (GATES.includes(id as RedstoneGate)) setGate(id as RedstoneGate);
    if (CLOCKS.some((item) => item.id === id)) {
      setClockPhase(false);
      setClockRunning(true);
      setClockEnabled(true);
      setClockStopped(false);
    }
    window.setTimeout(() => scrollToSelection(id), 0);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("gate") && !params.has("circuit")) return;
    window.setTimeout(() => scrollToSelection(selectionFromUrl()), 0);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const selection = selectionFromUrl();
      setActiveCircuit(selection);
      if (GATES.includes(selection as RedstoneGate)) setGate(selection as RedstoneGate);
      if (CLOCKS.some((item) => item.id === selection)) {
        setClockPhase(false);
        setClockRunning(true);
        setClockEnabled(true);
        setClockStopped(false);
      }
      window.setTimeout(() => scrollToSelection(selection), 0);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const stopLeverOn = activeClock?.id === "stoppable-clock" && clockStopped;
    const forceLow = activeClock && (!clockEnabled && activeClock.id !== "hopper-clock" || stopLeverOn);
    if (!activeClock || !clockRunning || !clockEnabled || stopLeverOn) {
      if (forceLow) setClockPhase(false);
      return;
    }
    let phase = clockPhase;
    let timer = 0;
    const schedulePhase = () => {
      const nextPhase = !phase;
      const ticks = phase ? activeClock.high : activeClock.low;
      timer = window.setTimeout(() => {
        phase = nextPhase;
        setClockPhase(nextPhase);
        schedulePhase();
      }, Math.max(25, (ticks * 1000) / clockSpeed));
    };
    schedulePhase();
    return () => window.clearTimeout(timer);
  }, [activeClock, clockRunning, clockSpeed, clockEnabled, clockStopped, clockPhase]);

  const writeMemory = () => {
    setMemory((current) => current.map((value, index) => index === address ? dataIn : value));
  };

  return (
    <div className="redstone-workspace">
      <aside className="redstone-library" aria-label="Redstone circuit library">
        <div className="redstone-library-title"><span className="redstone-kicker">CIRCUIT LIBRARY</span><strong>Explore circuits</strong></div>
        <label className="redstone-search-label">
          <span className="sr-only">Search circuits</span>
          <input type="search" value={circuitSearch} onChange={(event) => setCircuitSearch(event.target.value)} placeholder="Search circuits…" />
        </label>
        <label className="redstone-category-label">
          <span className="sr-only">Circuit category</span>
          <select value={circuitCategory} onChange={(event) => setCircuitCategory(event.target.value)}>
            <option>All circuits</option>
            {CIRCUIT_GROUPS.map((group) => <option key={group.name}>{group.name}</option>)}
          </select>
        </label>
        <p className="redstone-library-count">{visibleCircuitGroups.reduce((total, group) => total + group.items.length, 0)} shown · {REDSTONE_CIRCUITS.length} circuits + 2 lessons</p>
        <nav className="redstone-library-list" aria-label="Circuits">
          {visibleCircuitGroups.map((group) => <section className="redstone-library-group" key={group.name}>
            <h2>{group.name}</h2>
            {group.items.map((item) => <button
              className={`redstone-library-item ${activeCircuit === item.id ? "selected" : ""}`}
              type="button"
              key={item.id}
              onClick={() => selectCircuit(item.id)}
              aria-pressed={activeCircuit === item.id}
            ><strong>{item.title}</strong><small>{item.summary}</small></button>)}
          </section>)}
          {visibleCircuitGroups.length === 0 && <p className="redstone-library-empty">No circuits match this search.</p>}
        </nav>
        <a className="redstone-library-source" href="https://redstonery.com/circuits/" target="_blank" rel="noreferrer">Browse Redstonery’s full library ↗</a>
      </aside>

      <main className="redstone-course">
      <section className="redstone-intro panel">
        <div className="redstone-intro-copy">
          <span className="redstone-kicker">JAVA REDSTONE · BUILDING COURSE</span>
          <h2>From one signal<br /><em>to a tiny computer.</em></h2>
          <p>Explore {REDSTONE_CIRCUITS.length} signal, logic, pulse, clock, memory, detection, transport, storage, and piston circuits. Each local preview shows the behavior; open its tested layout when you are ready to build.</p>
        </div>
        <nav className="redstone-lesson-nav" aria-label="Course lessons">
          <a href={selectionHref("AND")} onClick={(event) => { event.preventDefault(); selectCircuit("AND"); }}><span>01</span>Logic gates</a>
          <a href={selectionHref("ram")} onClick={(event) => { event.preventDefault(); selectCircuit("ram"); }}><span>02</span>8-bit RAM</a>
          <a href={selectionHref("cpu")} onClick={(event) => { event.preventDefault(); selectCircuit("cpu"); }}><span>03</span>8-bit CPU</a>
        </nav>
      </section>

      {GATES.includes(activeCircuit as RedstoneGate) && <section className="redstone-section panel" id="gates" data-circuit-id={activeCircuit}>
        <div className="redstone-section-title"><span className="redstone-step">01</span><div><span className="redstone-kicker">MAKE DECISIONS</span><h2>Logic gates</h2></div></div>
        <p className="redstone-copy">A gate takes powered (1) or unpowered (0) inputs and produces one output. Choose a gate, flip the levers, and compare the result with its truth table.</p>
        <div className="gate-lab">
          <div className="gate-controls">
            <div className="gate-switches">
              <button className={`gate-switch ${inputA ? "on" : ""}`} onClick={() => setInputA((value) => !value)} aria-pressed={inputA}><span>A</span><b>{inputA ? "1 · ON" : "0 · OFF"}</b></button>
              {gate !== "NOT" && <button className={`gate-switch ${inputB ? "on" : ""}`} onClick={() => setInputB((value) => !value)} aria-pressed={inputB}><span>B</span><b>{inputB ? "1 · ON" : "0 · OFF"}</b></button>}
            </div>
            <div className="gate-result"><span>{gate} output</span><strong className={output ? "lit" : ""}>{output ? "1 · ON" : "0 · OFF"}</strong></div>
          </div>
          <div className="truth-table-wrap">
            <table className="truth-table">
              <thead><tr><th>A</th>{gate !== "NOT" && <th>B</th>}<th>{gate}</th></tr></thead>
              <tbody>
                {tableRows.map(([a, b]) => {
                  const result = evaluate(gate, a === 1, b === 1);
                  const active = inputA === (a === 1) && (gate === "NOT" || inputB === (b === 1));
                  return <tr className={active ? "current-row" : ""} key={`${a}-${b}`}><td>{a}</td>{gate !== "NOT" && <td>{b}</td>}<td>{result ? 1 : 0}</td></tr>;
                })}
              </tbody>
            </table>
            <p className="gate-definition">{gate === "NOT" ? "NOT flips its input." : gate === "OR" ? "OR is on when at least one input is on." : gate === "AND" ? "AND is on only when both inputs are on." : gate === "NAND" ? "NAND is off only when both inputs are on." : gate === "NOR" ? "NOR is on only when both inputs are off." : "XOR is on when the inputs are different."}</p>
          </div>
        </div>

        <div className="redstone-build-card">
          <div><span className="redstone-kicker">BUILD IT IN YOUR WORLD</span><h3>{gate === "OR" ? "OR gate (isolated)" : `${gate} gate`}</h3><p>{gate === "NOT" ? "Power a solid block with a lever. A redstone torch on the block turns off when the input turns on." : gate === "OR" ? "Repeaters isolate both lever inputs before they meet at the shared output." : gate === "AND" ? "Each input turns off its own torch. A central torch lights only when both input torches are off." : gate === "NAND" ? "Build an AND gate, then invert its output with a redstone torch." : gate === "NOR" ? "Build an OR gate, then invert its output with a redstone torch." : "This compact, tileable XOR has a lamp beside each input lever, two torch paths, and a separate output lamp. Flip A and B above to see the input lamps and active path update."}</p></div>
          <div className="redstone-build-preview">
          <Suspense fallback={<div className="redstone-3d-loading">Loading 3D viewer…</div>}>
            <RedstoneCircuit3D
              gate={gate}
              inputA={inputA}
              inputB={inputB}
              output={output}
              onInputToggle={(input) => input === "A" ? setInputA((value) => !value) : setInputB((value) => !value)}
            />
          </Suspense>
          {gate === "XOR" && activeCircuitDefinition?.sourceImageUrl && <figure className="redstone-xor-reference">
            <a href={activeCircuitDefinition.sourceUrl} target="_blank" rel="noreferrer"><img src={activeCircuitDefinition.sourceImageUrl} alt="Compact tileable torch-based XOR build reference" /></a>
            <figcaption><span>Layout reference · Redstone University</span><a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a></figcaption>
          </figure>}
          </div>
          <div className="redstone-reference-links">
            {activeCircuitDefinition && <a href={activeCircuitDefinition.sourceUrl ?? `https://redstonery.com/circuits/${activeCircuitDefinition.path}/`} target="_blank" rel="noreferrer">{activeCircuitDefinition.sourceUrl ? "Open the common tileable XOR build ↗" : activeCircuitDefinition.id === "implication" ? "View original Java layout ↗" : activeCircuitDefinition.id === "OR" ? "Open the original OR layout ↗" : `Open the tested ${gate} layout ↗`}</a>}
          </div>
        </div>
      </section>}

      {activeClock && <section className="redstone-section panel clock-section" data-circuit-id={activeCircuit}>
        <div className="redstone-section-title"><span className="redstone-step">CLOCK</span><div><span className="redstone-kicker">JAVA REDSTONE · LIVE TIMING</span><h2>{activeClock.title}</h2></div></div>
        <p className="redstone-copy">{activeClock.description} The reference layout measures a {activeClock.period}-tick cycle ({(activeClock.period / 20).toFixed(2)} s), with {activeClock.high} ticks high and {activeClock.low} ticks low.</p>
        <div className="clock-specs"><span>{activeClock.footprint}</span><span>{activeClock.blocks} blocks</span><span>20 game ticks / second</span></div>
        <div className="clock-demo-grid">
          <Suspense fallback={<div className="redstone-3d-loading">Loading 3D clock…</div>}>
            <RedstoneCircuit3D
              gate={gate}
              inputA={inputA}
              inputB={inputB}
              output={clockOutput}
              clock={activeClock.id}
              clockPhase={clockPhase}
              clockEnabled={clockEnabled}
              clockStopped={clockStopped}
              onInputToggle={(input) => {
                if (input !== "A") return;
                if (activeClock.id === "stoppable-clock") setClockStopped((value) => !value);
                else setClockEnabled((value) => !value);
              }}
            />
          </Suspense>
          <div className="clock-control-panel">
            <span className="redstone-kicker">CLOCK CONTROLS</span>
            <div className={`clock-output ${clockOutput ? "on" : ""}`}><span>Output</span><strong>{clockOutput ? "1 · HIGH" : "0 · LOW"}</strong></div>
            <div className="clock-transport">
              <button className="small-button" type="button" onClick={() => setClockRunning((running) => !running)}>{clockRunning ? "Pause time" : "Resume time"}</button>
              <button className="small-button" type="button" disabled={clockRunning} onClick={() => setClockPhase((phase) => !phase)}>Step phase</button>
            </div>
            <label className="field-label">Simulation speed<select value={clockSpeed} onChange={(event) => setClockSpeed(Number(event.target.value))}><option value={10}>10 ticks / second</option><option value={20}>20 ticks / second</option><option value={40}>40 ticks / second</option></select></label>
            {(activeClock.id === "comparator-clock" || activeClock.id === "hopper-clock") && <button className={`gate-switch ${clockEnabled ? "on" : ""}`} type="button" onClick={() => setClockEnabled((value) => !value)} aria-pressed={clockEnabled}><span>{activeClock.id === "hopper-clock" ? "P" : "E"}</span><b>{clockEnabled ? activeClock.id === "hopper-clock" ? "RUNNING" : "ENABLED" : activeClock.id === "hopper-clock" ? "PAUSED" : "DISABLED"}</b></button>}
            {activeClock.id === "stoppable-clock" && <button className={`gate-switch ${clockStopped ? "on" : ""}`} type="button" onClick={() => setClockStopped((value) => !value)} aria-pressed={clockStopped}><span>S</span><b>{clockStopped ? "STOPPED" : "STOP LEVER OFF"}</b></button>}
            <p className="clock-explanation">{activeClock.id === "stoppable-clock" ? "The Stop lever forces the output low; release it to start another cycle." : activeClock.id === "comparator-clock" ? "Disable the input to hold the output low, or pause time to freeze the current phase." : activeClock.id === "hopper-clock" ? "Pause locks item transfer and holds the current phase; resume to continue the cycle." : "Pause time to hold the current phase, or step one phase while paused."}</p>
            <a href={activeClock.source} target="_blank" rel="noreferrer">Open the tested layout ↗</a>
          </div>
        </div>
      </section>}

      {activeCircuitDefinition && !DEDICATED_DEMOS.has(activeCircuit) && <section className="redstone-section panel circuit-detail-section" data-circuit-id={activeCircuit}>
        <div className="redstone-section-title"><span className="redstone-step circuit-category-step">{activeCircuitDefinition.category.toUpperCase()}</span><div><span className="redstone-kicker">CIRCUIT EXPLORER · JAVA</span><h2>{activeCircuitDefinition.title}</h2></div></div>
        <p className="redstone-copy">{activeCircuitDefinition.summary} The 3D view expands the full Java block layout; toggle its inputs to see the logical outputs.</p>
        <div className="clock-specs circuit-specs">{activeCircuitDefinition.width !== undefined && activeCircuitDefinition.depth !== undefined && <span>{activeCircuitDefinition.width} × {activeCircuitDefinition.depth} blocks</span>}{activeCircuitDefinition.layers !== undefined && <span>{activeCircuitDefinition.layers} {activeCircuitDefinition.layers === 1 ? "layer" : "layers"}</span>}{activeCircuitDefinition.blocks !== undefined && <span>{activeCircuitDefinition.blocks} blocks</span>}</div>
        <CircuitBehaviorDemo key={activeCircuit} circuit={activeCircuitDefinition} />
        <div className="redstone-reference-links"><a href={`https://redstonery.com/circuits/${activeCircuitDefinition.path}/`} target="_blank" rel="noreferrer">{activeCircuitDefinition.id === "implication" ? "View original Minecraft layout ↗" : "Open the tested Minecraft layout ↗"}</a><a href="https://redstonery.com/circuits/" target="_blank" rel="noreferrer">Browse the original Redstonery catalog ↗</a></div>
      </section>}

      <section className="redstone-section panel" id="memory">
        <div className="redstone-section-title"><span className="redstone-step">02</span><div><span className="redstone-kicker">STORE DATA</span><h2>Build a 4 × 8 RAM</h2></div></div>
        <p className="redstone-copy">This starter RAM has four addresses, each holding one 8-bit value: 32 memory cells total. The controls below show how an address selects a word to read or write.</p>
        <div className="ram-demo">
          <div className="ram-controls">
            <label className="field-label">Address<select value={address} onChange={(event) => setAddress(Number(event.target.value))}>{memory.map((_, index) => <option value={index} key={index}>{index.toString(2).padStart(2, "0")} · {index}</option>)}</select></label>
            <label className="field-label">Data in (0–255)<input type="number" min="0" max="255" value={dataIn} onChange={(event) => setDataIn(Math.max(0, Math.min(255, Number(event.target.value) || 0)))} /></label>
            <button className="small-button ram-write" onClick={writeMemory}>Write selected word</button>
          </div>
          <div className="ram-words" aria-label="Four words of eight-bit memory">
            {memory.map((value, index) => <button key={index} className={`ram-word ${address === index ? "selected" : ""}`} onClick={() => setAddress(index)} aria-pressed={address === index}>
              <span>Address {index.toString(2).padStart(2, "0")}</span><strong>{value.toString(2).padStart(8, "0")}</strong><small>{value}</small>
            </button>)}
          </div>
          <div className="ram-readout"><span>Read at address {address}</span><strong>{memory[address].toString(2).padStart(8, "0")} <small>({memory[address]})</small></strong></div>
        </div>

        <div className="memory-build-grid">
          <article className="memory-concept">
            <h3>One cell remembers one bit</h3>
            <p>Start with two NOR gates whose outputs feed back into each other. Pulse <b>Set</b> to store 1; pulse <b>Reset</b> to store 0. With both inputs released, feedback keeps the last value.</p>
            <div className="latch-equations"><code>Q = NOT (Reset OR Q̅)</code><code>Q̅ = NOT (Set OR Q)</code></div>
          </article>
          <article className="memory-concept">
            <h3>Turn cells into a RAM</h3>
            <ol>
              <li>Build eight gated latch cells side by side. Together they form one 8-bit word.</li>
              <li>Copy that word four times. Give each row its own write-enable line.</li>
              <li>Use the two address bits and a 2-to-4 decoder so only one row is selected.</li>
              <li>Connect selected outputs to an 8-line read bus; connect the data-in bus to the selected row for writes.</li>
            </ol>
          </article>
        </div>
        <div className="redstone-reference-links"><a href="https://redstonery.com/circuits/rs-latch/" target="_blank" rel="noreferrer">See a tested RS-latch layout ↗</a><a href="https://minecraft.wiki/w/Tutorial:Redstone_computers" target="_blank" rel="noreferrer">Read the redstone computer tutorial ↗</a></div>
      </section>

      <section className="redstone-section panel" id="cpu">
        <div className="redstone-section-title"><span className="redstone-step">03</span><div><span className="redstone-kicker">RUN INSTRUCTIONS</span><h2>Connect an 8-bit CPU</h2></div></div>
        <p className="redstone-copy">An 8-bit CPU moves one byte at a time. A small address bus keeps the first build manageable: four address bits can select 16 bytes of memory.</p>
        <div className="cpu-flow" aria-label="CPU data path">
          <div><span>4-bit address</span><strong>Program counter</strong></div><i>→</i>
          <div><span>read / write</span><strong>16 × 8 RAM</strong></div><i>→</i>
          <div><span>opcode + operand</span><strong>Instruction register</strong></div><i>→</i>
          <div><span>control lines</span><strong>Decoder</strong></div>
        </div>
        <div className="cpu-datapath">
          <div className="cpu-register"><span>8-bit register</span><strong>A</strong></div><b>↔</b>
          <div className="cpu-alu"><span>8 full-adder stages</span><strong>ALU · add</strong></div><b>→</b>
          <div className="cpu-register"><span>8-bit register</span><strong>Output lamps</strong></div>
        </div>
        <div className="cpu-details">
          <article className="memory-concept">
            <h3>Build in modules</h3>
            <ol>
              <li>Make an 8-line data bus. Test it with eight levers in and eight lamps out.</li>
              <li>Build register A from eight gated latch cells. Add a load-enable line.</li>
              <li>Chain eight full adders for an 8-bit ripple-carry ALU. Connect each carry-out to the next bit.</li>
              <li>Add the 16 × 8 RAM, a 4-bit program counter, and an 8-bit instruction register.</li>
              <li>Decode the instruction's upper four bits into control lines. Let a clock step the fetch, decode, and execute stages.</li>
            </ol>
          </article>
          <article className="memory-concept instruction-card">
            <h3>A tiny instruction set</h3>
            <p>Each byte uses its top four bits for the operation and bottom four for a value or address.</p>
            <div><code>1n</code><span>Load number n into A</span></div>
            <div><code>2a</code><span>Load A from memory address a</span></div>
            <div><code>3a</code><span>Add memory[a] to A</span></div>
            <div><code>4a</code><span>Store A at memory address a</span></div>
            <div><code>5-</code><span>Copy A to output lamps</span></div>
            <div><code>F-</code><span>Halt the clock</span></div>
          </article>
        </div>
        <div className="cpu-program">
          <div><span className="redstone-kicker">FIRST PROGRAM · ADD 5 + 3</span><p>Enter these bytes into RAM, then step the clock. The output lamps finish at <b>00001000</b> (8).</p></div>
          <pre>{`Address   Byte     Meaning\n0000      0001 0101   Load 5 into A\n0001      0011 0110   Add RAM[6] to A\n0010      0101 0000   Copy A to output\n0011      1111 0000   Halt\n0110      0000 0011   Data value 3`}</pre>
        </div>
        <div className="redstone-reference-links"><a href="https://redstonery.com/circuits/full-adder/" target="_blank" rel="noreferrer">See a full-adder circuit layout ↗</a><a href="https://minecraft.wiki/w/Tutorial:Redstone_computers" target="_blank" rel="noreferrer">Follow a complete redstone CPU tutorial ↗</a></div>
      </section>
      </main>
    </div>
  );
}
