import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const MAP_SIZE = 512;
const MIN_RANGE = 24;
const MAX_RANGE = 128;

type Marker = {
  id: string;
  name: string;
  kind: "player" | "farm";
  x: number;
  z: number;
  color: string;
};

const SAMPLE_MARKERS: Marker[] = [
  { id: "player-a", name: "AFK A", kind: "player", x: 96, z: 128, color: "#79bdd1" },
  { id: "player-b", name: "AFK B", kind: "player", x: 288, z: 128, color: "#e9b96d" },
  { id: "farm-west", name: "West farm", kind: "farm", x: 48, z: 208, color: "#a8ba83" },
  { id: "farm-center", name: "Center farm", kind: "farm", x: 192, z: 128, color: "#a8ba83" },
  { id: "farm-east", name: "East farm", kind: "farm", x: 336, z: 208, color: "#a8ba83" },
];

type Drag = { id: string; pointerId: number };

export default function FarmRangeDemo() {
  const [markers, setMarkers] = useState(SAMPLE_MARKERS);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const players = markers.filter((marker) => marker.kind === "player");
  const farms = markers.filter((marker) => marker.kind === "farm");
  const results = farms.map((farm) => {
    const distances = players.map((player) => {
      const distance = Math.hypot(farm.x - player.x, farm.z - player.z);
      return { player, distance: Math.round(distance), inRange: distance > MIN_RANGE && distance <= MAX_RANGE };
    });
    return { farm, distances, inRange: distances.filter((item) => item.inRange) };
  });
  const sharedCount = results.filter((result) => result.inRange.length > 1).length;
  const coveredCount = results.filter((result) => result.inRange.length > 0).length;

  const moveMarker = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !bounds) return;
    const rawX = ((event.clientX - bounds.left) / bounds.width) * MAP_SIZE;
    const rawZ = ((event.clientY - bounds.top) / bounds.height) * MAP_SIZE;
    const x = Math.max(0, Math.min(MAP_SIZE, Math.round(rawX / 8) * 8));
    const z = Math.max(0, Math.min(MAP_SIZE, Math.round(rawZ / 8) * 8));
    setMarkers((current) => current.map((marker) => marker.id === drag.id ? { ...marker, x, z } : marker));
  };

  const finishMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const startMove = (event: ReactPointerEvent<SVGGElement>, marker: Marker) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { id: marker.id, pointerId: event.pointerId };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  return (
    <section className="farm-demo">
      <div className="farm-demo-map panel">
        <div className="farm-demo-heading">
          <div>
            <span className="farm-demo-kicker">SAMPLE SERVER · 512 × 512 BLOCKS</span>
            <h2>AFK and farm positions</h2>
          </div>
          <button className="small-button" onClick={() => setMarkers(SAMPLE_MARKERS)}>Reset sample</button>
        </div>
        <p className="farm-demo-help">Drag the circles and squares. A farm inside both players’ bands is marked as shared.</p>
        <div className="farm-demo-map-scroll">
          <svg
            ref={svgRef}
            className="farm-range-map"
            viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
            role="application"
            aria-label="Draggable top-down map of two AFK players, their 24 and 128 block ranges, and three farm platforms"
            onPointerMove={moveMarker}
            onPointerUp={finishMove}
            onPointerCancel={finishMove}
            onLostPointerCapture={finishMove}
          >
            <rect width={MAP_SIZE} height={MAP_SIZE} className="farm-map-background" />
            <g aria-hidden="true">
              {Array.from({ length: 33 }, (_, index) => index * 16).map((position) => (
                <g key={position}>
                  <line x1={position} y1={0} x2={position} y2={MAP_SIZE} className={position % 128 === 0 ? "farm-grid-line major" : "farm-grid-line"} />
                  <line x1={0} y1={position} x2={MAP_SIZE} y2={position} className={position % 128 === 0 ? "farm-grid-line major" : "farm-grid-line"} />
                </g>
              ))}
              {[0, 128, 256, 384, 512].map((position) => <text key={position} x={position + 4} y={12} className="farm-axis-label">{position}</text>)}
              {players.map((player) => (
                <g key={`${player.id}-range`}>
                  <circle cx={player.x} cy={player.z} r={MAX_RANGE} fill="none" stroke={player.color} strokeWidth={2} strokeDasharray="7 5" opacity={0.8} />
                  <circle cx={player.x} cy={player.z} r={MIN_RANGE} fill="none" stroke={player.color} strokeWidth={2} />
                </g>
              ))}
            </g>
            {farms.map((farm) => (
              <g key={farm.id} className="farm-demo-marker" onPointerDown={(event) => startMove(event, farm)}>
                <title>{`${farm.name}: X ${farm.x}, Z ${farm.z}. Drag to move.`}</title>
                <rect x={farm.x - 8} y={farm.z - 8} width={16} height={16} rx={3} fill={farm.color} stroke="#172018" strokeWidth={2} />
                <text x={farm.x} y={farm.z - 13} textAnchor="middle" className="farm-marker-label">{farm.name}</text>
              </g>
            ))}
            {players.map((player, index) => (
              <g key={player.id} className="farm-demo-marker" onPointerDown={(event) => startMove(event, player)}>
                <title>{`${player.name}: X ${player.x}, Z ${player.z}. Drag to move.`}</title>
                <circle cx={player.x} cy={player.z} r={11} fill={player.color} stroke="#172018" strokeWidth={2} />
                <text x={player.x} y={player.z + 3.5} textAnchor="middle" className="player-marker-label">{index === 0 ? "A" : "B"}</text>
                <text x={player.x} y={player.z - 17} textAnchor="middle" className="farm-marker-label">{player.name}</text>
              </g>
            ))}
          </svg>
        </div>
        <div className="farm-demo-legend">
          <span><i className="range-line" /> 128-block limit</span>
          <span><i className="safe-line" /> 24-block inner limit</span>
          <span><i className="player-dot player-a-dot" /> AFK player</span>
          <span><i className="farm-dot" /> Farm platform</span>
        </div>
        <p className="farm-demo-axis">X increases → · Z increases ↓ · grid lines mark 16 blocks</p>
      </div>

      <aside className="farm-demo-results panel">
        <div className="farm-demo-heading">
          <div><span className="farm-demo-kicker">WHAT IS IN RANGE?</span><h2>Farm check</h2></div>
        </div>
        <div className="farm-demo-stats">
          <div><strong>{coveredCount}/{farms.length}</strong><span>farms in at least one band</span></div>
          <div><strong>{sharedCount}</strong><span>farms in both bands</span></div>
        </div>
        <div className="farm-result-list">
          {results.map(({ farm, distances, inRange }) => (
            <article className="farm-result" key={farm.id}>
              <div className="farm-result-title">
                <strong>{farm.name}</strong>
                <span className={`farm-result-status ${inRange.length > 1 ? "shared" : inRange.length === 1 ? "reachable" : "outside"}`}>
                  {inRange.length > 1 ? "Both players" : inRange.length === 1 ? inRange[0].player.name : "Out of range"}
                </span>
              </div>
              <small>X {farm.x}, Z {farm.z}</small>
              <p>{distances.map(({ player, distance }) => `${player.name} ${distance}`).join(" · ")} blocks</p>
            </article>
          ))}
        </div>
        <p className="farm-demo-caveat">This demo assumes every player and platform is at the same height. Real spawn results also depend on Y distance, game version, mob caps, and farm design.</p>
      </aside>
    </section>
  );
}
