import { useEffect, useRef, useState } from "react";
import type { CircuitDefinition } from "./redstoneCircuits";

function logicResult(id: string, a: boolean, b: boolean, c: boolean, select: boolean) {
  if (id === "NOT") return !a;
  if (id === "OR") return a || b;
  if (id === "AND") return a && b;
  if (id === "NAND") return !(a && b);
  if (id === "NOR") return !(a || b);
  if (id === "XOR") return a !== b;
  if (id === "XNOR") return a === b;
  if (id === "implication") return !a || b;
  if (id === "mux") return select ? b : a;
  if (id === "majority") return Number(a) + Number(b) + Number(c) >= 2;
  return false;
}

function Toggle({ label, value, onClick }: { label: string; value: boolean; onClick: () => void }) {
  return <button className={`gate-switch ${value ? "on" : ""}`} type="button" onClick={onClick} aria-pressed={value}><span>{label}</span><b>{value ? "1 · ON" : "0 · OFF"}</b></button>;
}

export default function CircuitBehaviorDemo({ circuit }: { circuit: CircuitDefinition }) {
  const [a, setA] = useState(false);
  const [b, setB] = useState(false);
  const [c, setC] = useState(false);
  const [select, setSelect] = useState(false);
  const [pulseOn, setPulseOn] = useState(false);
  const pulseTimer = useRef<number | undefined>(undefined);
  const [value, setValue] = useState(0);
  const [stored, setStored] = useState(0);
  const [itemCount, setItemCount] = useState(8);
  const [sentCount, setSentCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [extended, setExtended] = useState(false);

  useEffect(() => () => window.clearTimeout(pulseTimer.current), []);

  const firePulse = () => {
    setPulseOn(true);
    window.clearTimeout(pulseTimer.current);
    const duration = circuit.id === "pulse-extender" || circuit.id === "retriggerable-timer" ? 1100 : 500;
    pulseTimer.current = window.setTimeout(() => setPulseOn(false), duration);
  };

  const isBinaryLogic = ["NOT", "OR", "AND", "NAND", "NOR", "XOR", "XNOR", "implication", "mux", "demux", "decoder", "majority", "full-adder"].includes(circuit.id);
  const result = logicResult(circuit.id, a, b, c, select);
  const sum = Number(a) + Number(b) + Number(c);
  const decoderAddress = Number(a) * 2 + Number(b);
  const isMemory = circuit.category === "Memory";
  const isDetection = circuit.category === "Detection";
  const isTransfer = circuit.category === "Transport" || circuit.category === "Storage";
  const isPiston = circuit.category === "Pistons";
  const lockedTransfer = circuit.id === "hopper-lock" && locked;
  const fullAlarm = value >= 90;
  const emptyAlarm = value === 0;
  const comparatorOutput = circuit.id === "comparator-subtract" ? Math.max(0, value - 50) : Math.max(0, value - 40);

  return <div className="circuit-explorer-demo">
    <div className="circuit-demo-heading"><div><span className="redstone-kicker">INTERACTIVE BEHAVIOR MODEL</span><h3>{circuit.title}</h3><p>{circuit.summary}</p></div><span className="circuit-demo-badge">{circuit.category.toUpperCase()}</span></div>

    {isBinaryLogic && <div className="circuit-sim-content">
      <div className="gate-switches">
        <Toggle label={circuit.id === "mux" ? "D0" : circuit.id === "demux" ? "DATA" : "A"} value={a} onClick={() => setA((v) => !v)} />
        {circuit.id !== "NOT" && <Toggle label={circuit.id === "mux" ? "D1" : "B"} value={b} onClick={() => setB((v) => !v)} />}
        {(circuit.id === "majority" || circuit.id === "full-adder") && <Toggle label="CIN" value={c} onClick={() => setC((v) => !v)} />}
        {circuit.id === "mux" && <Toggle label="SEL" value={select} onClick={() => setSelect((v) => !v)} />}
        {circuit.id === "demux" && <Toggle label="SEL" value={select} onClick={() => setSelect((v) => !v)} />}
      </div>
      {circuit.id === "decoder" ? <div className="circuit-output-pair circuit-four-outputs">{[0, 1, 2, 3].map((index) => <div className={decoderAddress === index ? "lit" : ""} key={index}><span>LINE {index.toString(2).padStart(2, "0")}</span><strong>{decoderAddress === index ? 1 : 0}</strong></div>)}</div>
        : circuit.id === "demux" ? <div className="circuit-output-pair"><div className={!select && a ? "lit" : ""}><span>Y0</span><strong>{!select && a ? 1 : 0}</strong></div><div className={select && a ? "lit" : ""}><span>Y1</span><strong>{select && a ? 1 : 0}</strong></div></div>
          : circuit.id === "full-adder" ? <div className="circuit-output-pair"><div className={(sum % 2) === 1 ? "lit" : ""}><span>SUM</span><strong>{sum % 2}</strong></div><div className={sum >= 2 ? "lit" : ""}><span>CARRY OUT</span><strong>{sum >= 2 ? 1 : 0}</strong></div></div>
            : <div className={`circuit-model-output ${result ? "lit" : ""}`}><span>{circuit.id === "mux" ? `OUTPUT · D${select ? 1 : 0}` : "OUTPUT"}</span><strong>{result ? 1 : 0}</strong></div>}
      <p className="circuit-model-note">Toggle the inputs to see the circuit's logical result. This model shows behavior; use the linked layout for Minecraft block placement.</p>
    </div>}

    {circuit.category === "Signal" && <div className="circuit-sim-content">
      <label className="field-label circuit-range-label">Source strength · {value}<input type="range" min="0" max="15" value={value} onChange={(event) => setValue(Number(event.target.value))} /></label>
      <div className="signal-strength-track" aria-label={`Signal strength ${value} out of 15`}>{Array.from({ length: 15 }, (_, index) => <i key={index} className={index < value ? "powered" : ""} />)}</div>
      <div className="circuit-model-output"><span>ROUTED STRENGTH</span><strong>{circuit.id === "repeater-line" ? value === 0 ? 0 : 15 : Math.max(0, value - 1)}</strong></div>
      <p className="circuit-model-note">Adjust source power to explore signal loss and restoration. The visual track is conceptual, not a block-by-block replica.</p>
    </div>}

    {circuit.category === "Pulse" && <div className="circuit-sim-content pulse-model">
      <button className="small-button" type="button" onClick={firePulse}>{circuit.id === "button-pulse" ? "Press button" : "Trigger input"}</button>
      <div className={`pulse-lamp ${pulseOn ? "lit" : ""}`}><span>{circuit.id.includes("edge") ? "EDGE EVENT" : "OUTPUT"}</span><strong>{pulseOn ? "1 · PULSE" : "0 · OFF"}</strong></div>
      <p className="circuit-model-note">Send an event to see a temporary output pulse. Re-trigger the input to observe how the selected circuit responds.</p>
    </div>}

    {isMemory && <div className="circuit-sim-content">
      {(circuit.id === "register-4bit" || circuit.id === "analog-memory") && <label className="field-label circuit-range-label">Input value · {value}<input type="range" min="0" max={circuit.id === "register-4bit" ? 15 : 15} value={value} onChange={(event) => setValue(Number(event.target.value))} /></label>}
      <div className="circuit-memory-readout"><span>{circuit.id === "ripple-counter" ? "COUNT · MOD 4" : circuit.id === "register-4bit" ? "STORED WORD" : circuit.id === "analog-memory" ? "HIGHEST SIGNAL HELD" : "REMEMBERED STATE"}</span><strong>{circuit.id === "ripple-counter" ? (stored % 4).toString(2).padStart(2, "0") : circuit.id === "register-4bit" ? stored.toString(2).padStart(4, "0") : circuit.id === "analog-memory" ? stored : stored ? "1 · ON" : "0 · OFF"}</strong></div>
      <div className="circuit-demo-actions">
        {circuit.id === "ripple-counter" && <button className="small-button" type="button" onClick={() => setStored((current) => (current + 1) % 4)}>Send count pulse</button>}
        {circuit.id === "copper-bulb" || circuit.id === "piston-toggle" ? <button className="small-button" type="button" onClick={() => setStored((current) => current ? 0 : 1)}>Toggle state</button> : null}
        {circuit.id === "d-flip-flop" || circuit.id === "data-latch" ? <><Toggle label="D" value={a} onClick={() => setA((current) => !current)} />{circuit.id === "data-latch" && <Toggle label="LOCK" value={locked} onClick={() => setLocked((current) => !current)} />}<button className="small-button" type="button" disabled={circuit.id === "data-latch" && locked} onClick={() => setStored(a ? 1 : 0)}>{circuit.id === "data-latch" ? "Sample / release" : "Sample on edge"}</button></> : null}
        {circuit.id === "register-4bit" && <button className="small-button" type="button" onClick={() => setStored(value)}>Store input</button>}
        {circuit.id === "analog-memory" && <><button className="small-button" type="button" onClick={() => setStored((current) => Math.max(current, value))}>Sample peak</button><button className="clear-button" type="button" onClick={() => setStored(0)}>Clear peak</button></>}
        {circuit.id === "rs-latch" && <><button className="small-button" type="button" onClick={() => setStored(1)}>Set Q</button><button className="clear-button" type="button" onClick={() => setStored(0)}>Reset Q</button></>}
      </div>
      <p className="circuit-model-note">Use the controls to change stored state. The circuit keeps its value until another input changes it.</p>
    </div>}

    {isDetection && circuit.id === "pressure-plate" && <div className="circuit-sim-content pulse-model">
      <button className="small-button" type="button" onClick={() => setValue((current) => current ? 0 : 15)}>{value ? "Step off plate" : "Step on plate"}</button>
      <div className={`pulse-lamp ${value ? "lit" : ""}`}><span>REDSTONE OUTPUT</span><strong>{value ? "1 · POWERED" : "0 · IDLE"}</strong></div>
      <p className="circuit-model-note">The plate sends a signal while an entity stands on it. Toggle the preview to model stepping on and off.</p>
    </div>}

    {isDetection && circuit.id !== "pressure-plate" && <div className="circuit-sim-content">
      <label className="field-label circuit-range-label">Container fill · {value}%<input type="range" min="0" max="100" value={value} onChange={(event) => setValue(Number(event.target.value))} /></label>
      <div className="circuit-detection-visual"><div className="container-fill"><i style={{ height: `${value}%` }} /></div><div className="circuit-detection-readout"><span>{circuit.id === "container-empty" ? "EMPTY ALARM" : circuit.id === "container-full" ? "FULL ALARM" : circuit.id === "comparator-subtract" ? "SUBTRACT OUTPUT" : circuit.id === "comparator-threshold" ? "ABOVE THRESHOLD" : "COMPARATOR SIGNAL"}</span><strong>{circuit.id === "container-empty" ? emptyAlarm ? "ACTIVE" : "OFF" : circuit.id === "container-full" ? fullAlarm ? "ACTIVE" : "OFF" : circuit.id === "comparator-threshold" ? value >= 40 ? "ACTIVE" : "OFF" : circuit.id === "comparator-subtract" ? comparatorOutput : Math.round(value * 15 / 100)}</strong></div></div>
      <p className="circuit-model-note">Change the simulated inventory level and watch its comparator signal or alarm boundary.</p>
    </div>}

    {isTransfer && <div className="circuit-sim-content">
      <div className="inventory-transfer"><div><span>INPUT INVENTORY</span><strong>{itemCount}</strong><small>items</small></div><b className={lockedTransfer ? "transfer-arrow paused" : "transfer-arrow"}>→</b><div><span>{circuit.category === "Storage" ? "SORTED / OVERFLOW" : "DESTINATION"}</span><strong>{sentCount}</strong><small>items moved</small></div></div>
      {circuit.id === "hopper-lock" && <Toggle label="LOCK" value={locked} onClick={() => setLocked((current) => !current)} />}
      <div className="circuit-demo-actions"><button className="small-button" type="button" onClick={() => setItemCount((current) => Math.min(64, current + 8))}>Add 8 items</button><button className="small-button" type="button" disabled={itemCount === 0 || lockedTransfer} onClick={() => { setItemCount((current) => Math.max(0, current - 1)); setSentCount((current) => current + 1); }}>Transfer 1 item</button><button className="clear-button" type="button" onClick={() => { setItemCount(0); setSentCount(0); }}>Clear</button></div>
      <p className="circuit-model-note">Move items through the preview. A locked hopper will hold items until its control is released.</p>
    </div>}

    {isPiston && <div className="circuit-sim-content">
      <button className="small-button" type="button" onClick={() => setExtended((current) => !current)}>{extended ? "Release control" : "Power piston"}</button>
      <div className={`piston-model ${extended ? "extended" : ""}`} aria-label={extended ? "Piston extended" : "Piston retracted"}><span className="piston-input">{extended ? "POWERED" : "IDLE"}</span><div className="piston-base">PISTON<i /></div><div className="piston-moved-blocks">{(circuit.id === "piston-door-2x2" ? [0, 1, 2, 3] : circuit.id === "slime-pusher" || circuit.id === "honey-separation" ? [0, 1, 2] : [0]).map((index) => <i key={index} />)}</div><span className="piston-output">{extended ? "MOVED" : "REST"}</span></div>
      <p className="circuit-model-note">Toggle the control to see the mechanism's resting and powered states. The diagram illustrates motion, not exact block positions.</p>
    </div>}
  </div>;
}
