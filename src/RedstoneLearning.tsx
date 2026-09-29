import { useState } from "react";

type Gate = "NOT" | "OR" | "AND" | "NAND" | "NOR" | "XOR";

const GATES: Gate[] = ["NOT", "OR", "AND", "NAND", "NOR", "XOR"];

function evaluate(gate: Gate, a: boolean, b: boolean) {
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
  const [gate, setGate] = useState<Gate>("AND");
  const [inputA, setInputA] = useState(false);
  const [inputB, setInputB] = useState(false);
  const [address, setAddress] = useState(0);
  const [dataIn, setDataIn] = useState(5);
  const [memory, setMemory] = useState([0, 0, 0, 0]);
  const output = evaluate(gate, inputA, inputB);
  const tableRows: Array<[number, number | null]> = gate === "NOT" ? [[0, null], [1, null]] : [[0, 0], [0, 1], [1, 0], [1, 1]];

  const writeMemory = () => {
    setMemory((current) => current.map((value, index) => index === address ? dataIn : value));
  };

  return (
    <div className="redstone-course">
      <section className="redstone-intro panel">
        <div className="redstone-intro-copy">
          <span className="redstone-kicker">JAVA REDSTONE · BUILDING COURSE</span>
          <h2>From one signal<br /><em>to a tiny computer.</em></h2>
          <p>Start with on/off logic, make circuits remember a byte, then connect the parts into a small 8-bit CPU. Each stage builds on the one before it.</p>
        </div>
        <nav className="redstone-lesson-nav" aria-label="Course lessons">
          <a href="#gates"><span>01</span>Logic gates</a>
          <a href="#memory"><span>02</span>8-bit RAM</a>
          <a href="#cpu"><span>03</span>8-bit CPU</a>
        </nav>
      </section>

      <section className="redstone-section panel" id="gates">
        <div className="redstone-section-title"><span className="redstone-step">01</span><div><span className="redstone-kicker">MAKE DECISIONS</span><h2>Logic gates</h2></div></div>
        <p className="redstone-copy">A gate takes powered (1) or unpowered (0) inputs and produces one output. Choose a gate, flip the levers, and compare the result with its truth table.</p>
        <div className="gate-lab">
          <div className="gate-controls">
            <div className="gate-picker" role="group" aria-label="Choose a logic gate">
              {GATES.map((item) => <button key={item} className={gate === item ? "selected" : ""} onClick={() => setGate(item)} aria-pressed={gate === item}>{item}</button>)}
            </div>
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
          <div><span className="redstone-kicker">BUILD IT IN YOUR WORLD</span><h3>{gate} gate</h3><p>{gate === "NOT" ? "Power a solid block with a lever. A redstone torch on the block turns off when the input turns on." : gate === "OR" ? "Two lever lines meet on one dust path. Either lever can light the output lamp." : gate === "AND" ? "Each input turns off its own torch. A central torch lights only when both input torches are off." : gate === "NAND" ? "Build an AND gate, then invert its output with a redstone torch." : gate === "NOR" ? "Build an OR gate, then invert its output with a redstone torch." : "Combine OR with an inverted AND: (A OR B) AND NOT(A AND B). The output is on when exactly one input is on."}</p></div>
          {gate === "OR" && <pre className="circuit-map" aria-label="OR gate floor layout">{`Floor · X →\nZ ↓   0  1  2  3  4\n  0   A  ·  ·  .  .\n  1   .  .  ·  ·  L\n  2   B  ·  ·  .  .`}</pre>}
          {gate === "AND" && <div className="circuit-layers"><pre className="circuit-map" aria-label="AND gate ground layer">{`Y=0 · X →\nZ ↓   0  1  2  3  4  5\n  0   A  ·  S  .  .  .\n  1   .  .  S  T  ·  L\n  2   B  ·  S  .  .  .`}</pre><pre className="circuit-map" aria-label="AND gate upper layer">{`Y=1 · X →\nZ ↓   0  1  2  3\n  0   .  .  T  .\n  1   .  .  ·  .\n  2   .  .  T  .`}</pre></div>}
          {gate === "NOT" && <div className="not-gate-sketch"><span>lever</span><b>→</b><span className="solid-block">solid block</span><b>→</b><span className="torch-output">torch output</span></div>}
          {gate !== "NOT" && gate !== "OR" && gate !== "AND" && <div className="gate-composition"><strong>Build from the gates above</strong><span>Use repeaters to isolate long shared routes. Check every input row before connecting the gate to a larger circuit.</span></div>}
          <div className="circuit-legend"><span>A / B = levers</span><span>· = redstone dust</span><span>S = solid block</span><span>T = redstone torch</span><span>L = lamp</span></div>
          <div className="redstone-reference-links">
            <a href={gate === "AND" ? "https://redstonery.com/circuits/and/" : gate === "OR" ? "https://redstonery.com/circuits/or/" : "https://redstonery.com/circuits/"} target="_blank" rel="noreferrer">Open a redstone circuit layout ↗</a>
          </div>
        </div>
      </section>

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
    </div>
  );
}
