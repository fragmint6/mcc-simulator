/* ------------------------------------------------------------------
   Rowing Simulator - basic vanilla JS app
   - Drag & drop rowers between roster / boat1 / boat2
   - Simple physics-ish simulation for a 1000m race
   - Live telemetry table + Chart.js speed graph
------------------------------------------------------------------- */

const SEATS_PER_BOAT = 8;

let rowers = []; // populated from data/rowers.js at startup

// Parse a 2k score string like "6:28.9" or "06:28.9" into total seconds.
function parseScoreToSeconds(score) {
  if (!score) return null;
  const parts = String(score).split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

// Concept2-style formula: watts = 2.80 / (split_sec_per_500m / 500)^3
// where split_sec_per_500m is the average 500m split derived from the 2k time.
function scoreToWatts(score) {
  const totalSeconds = parseScoreToSeconds(score);
  if (!totalSeconds) return 200; // fallback default
  const splitPer500 = totalSeconds / 4; // 2000m = four 500m splits
  const pace = splitPer500 / 500;
  const watts = 2.8 / Math.pow(pace, 3);
  return Math.round(watts);
}

// Build the in-app rower objects (with computed power) from the raw JSON records.
function buildRowerFromRecord(record, index) {
  return {
    id: "r" + index,
    name: record.name,
    year: record.year,
    twoK: record["2k"],
    weight: record.weight,
    power: scoreToWatts(record["2k"]),
    port: record.port || 0,
    starboard: record.starboard || 0,
    mentality: record.mentality || 0,
    rarity: record.rarity || "Unknown",
  };
}

function loadRowers() {
  if (typeof ROWERS_DATA !== "undefined" && Array.isArray(ROWERS_DATA)) {
    rowers = ROWERS_DATA.map(buildRowerFromRecord);
  } else {
    console.error("No rower data found (ROWERS_DATA missing from data/rowers.js).");
    rowers = [];
  }
}

// boat assignment state: array of length SEATS_PER_BOAT, each null or rower id
let boats = {
  boat1: Array(SEATS_PER_BOAT).fill(null),
  boat2: Array(SEATS_PER_BOAT).fill(null),
};

// ---------- DOM refs ----------
const rowerListEl = document.getElementById("rowerList");
const boat1SeatsEl = document.getElementById("boat1Seats");
const boat2SeatsEl = document.getElementById("boat2Seats");
const boat1MetaEl = document.getElementById("boat1Meta");
const boat2MetaEl = document.getElementById("boat2Meta");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");
const raceStatusEl = document.getElementById("raceStatus");

const marker1 = document.getElementById("marker1");
const marker2 = document.getElementById("marker2");
const lane1Track = document.querySelector("#lane1 .lane-track");
const lane2Track = document.querySelector("#lane2 .lane-track");

const RACE_DISTANCE = 300;
const DISPLAY_SCALE = 5;
const SIM_SPEED = 1;

// ---------- Animated boat SVG (hull + rowing oars) ----------
// Builds a small top-down rowing shell (bow pointing right, in the direction
// of travel) with 4 oars per side that swing fore/aft through a stroke cycle
// (catch -> drive -> finish -> recovery). Oar phase is driven every animation
// frame based on each boat's current stroke rate.
function buildBoatSVG(colorMain, colorAccent) {
  const hullTopY = 38;
  const hullBottomY = 52;
  const oarLength = 24;

  const oarSide = (direction) => {
    // direction: -1 = oars mounted on the top edge (swing above the hull),
    //             1 = oars mounted on the bottom edge (swing below the hull)
    const oarlockY = direction === -1 ? hullTopY - 2 : hullBottomY + 2;
    let oars = "";
    // 4 evenly spaced seats along the length of the hull
    for (let i = 0; i < 4; i++) {
      const cx = 20 + i * 22 + (direction === 1 ? 8 : 0);
      const tipY = oarlockY + direction * oarLength;
      oars += `
        <g class="oar-group" data-side="${direction}" data-seat="${i}" style="transform-origin: ${cx}px ${oarlockY}px;">
          <line class="oar-shaft" x1="${cx}" y1="${oarlockY}" x2="${cx}" y2="${tipY}" />
          <rect class="oar-blade" x="${cx - 4}" y="${direction === -1 ? tipY - 8 : tipY}" width="8" height="8" rx="1.5" style="transform-origin: ${cx}px ${direction === -1 ? tipY - 4 : tipY + 4}px;" />
        </g>`;
    }
    return oars;
  };

  return `
    <svg class="boat-svg" viewBox="-20 -40 140 170" xmlns="http://www.w3.org/2000/svg">
      <g class="oars oars-top">${oarSide(-1)}</g>
      <g class="oars oars-bottom">${oarSide(1)}</g>
      <path class="hull" d="M100 45 C100 41, 96 ${hullTopY}, 90 ${hullTopY} L22 ${hullTopY} C17 ${hullTopY}, 14 41, 14 45 C14 49, 17 ${hullBottomY}, 22 ${hullBottomY} L90 ${hullBottomY} C96 ${hullBottomY}, 100 49, 100 45 Z"
        fill="${colorMain}" stroke="${colorAccent}" stroke-width="2" />
      <ellipse class="hull-highlight" cx="57" cy="45" rx="34" ry="5" fill="${colorAccent}" opacity="0.25" />
    </svg>
  `;
}

marker1.innerHTML = buildBoatSVG("#3fb6ff", "#1c7fb8");
marker2.innerHTML = buildBoatSVG("#ff6b6b", "#c94848");

function findRower(id) {
  return rowers.find(r => r.id === id);
}

function assignedRowerIds() {
  return new Set([...boats.boat1, ...boats.boat2].filter(Boolean));
}

// ---------- Rendering ----------

function renderRosterList() {
  rowerListEl.innerHTML = "";
  const assigned = assignedRowerIds();
  rowers
    .filter(r => !assigned.has(r.id))
    .forEach(r => rowerListEl.appendChild(createRowerCard(r)));
}

function createRowerCard(rower) {
  const li = document.createElement("li");
  li.className = "rower-card";
  li.draggable = true;
  li.dataset.rowerId = rower.id;
  li.dataset.rarity = rower.rarity || "unknown";
  const rs = rarityStyle(rower.rarity);
  const ovr = computeOVR(rower);
  li.innerHTML = `
    <span class="rc-ovr">${ovr}</span>
    <span class="rower-name">${rower.name}</span>
    <span class="rc-rarity" style="background:${rs.color}">${rs.icon} ${rs.label}</span>
  `;
  li.addEventListener("dragstart", onDragStart);
  li.addEventListener("dragend", onDragEnd);
  li.addEventListener("mouseenter", (e) => showRowerHoverCard(rower, e.currentTarget));
  li.addEventListener("mouseleave", hideRowerHoverCard);
  return li;
}

// ---------- Hover stat card ----------

let hoverCardEl = null;

function ensureHoverCard() {
  if (!hoverCardEl) {
    hoverCardEl = document.createElement("div");
    hoverCardEl.id = "rowerHoverCard";
    hoverCardEl.className = "rower-hover-card";
    document.body.appendChild(hoverCardEl);
  }
  return hoverCardEl;
}

const RARITY_STYLES = {
  "Generational": { color: "#ff2020", label: "Generational", icon: "✦" },
  "Freak": { color: "#ff9f43", label: "Freak", icon: "◈" },
  "Pretty Good": { color: "#a359ff", label: "Pretty Good", icon: "◇" },
  "Mid": { color: "#4ade80", label: "Mid", icon: "◆" },
  "Noob": { color: "#8fa3b3", label: "Noob", icon: "○" },
};

function rarityStyle(rarity) {
  return RARITY_STYLES[rarity] || { color: "#5a6b7c", label: rarity || "Unknown", icon: "?" };
}

function computeOVR(rower) {
  const secs = parseScoreToSeconds(rower.twoK);
  if (!secs) return 0;
  const R2k = 92 - ((secs - 390) / 5) * 3;
  const p = rower.port || 0, s = rower.starboard || 0;
  const techStars = (2 * Math.max(p, s) + Math.min(p, s)) / 3;
  const RTech = 18 * techStars + 9;
  const splitSec = secs / 4;
  const watts = 2.80 / Math.pow(splitSec / 500, 3);
  const ptow = watts / (rower.weight || 150);
  const RPW = Math.max(50, Math.min(99, ptow * 38.0));
  const RMental = 18 * (rower.mentality || 0) + 9;
  return Math.round(0.50 * R2k + 0.25 * RTech + 0.15 * RPW + 0.10 * RMental);
}

function dotStars(value, max = 5) {
  const v = Math.min(value, max);
  const full = Math.floor(v);
  const partial = v - full;
  let html = "";
  for (let i = 0; i < max; i++) {
    if (i < full) {
      html += `<span class="hc-dot filled"></span>`;
    } else if (i === full && partial > 0.01) {
      const pct = Math.round(partial * 100);
      html += `<span class="hc-dot partial" style="background:linear-gradient(90deg,#f0b429 ${pct}%,#2c3c4d ${pct}%)"></span>`;
    } else {
      html += `<span class="hc-dot"></span>`;
    }
  }
  return html;
}

function showRowerHoverCard(rower, targetEl) {
  const card = ensureHoverCard();
  const classText = rower.year != null ? `Class of ${rower.year}` : "--";
  const twoKText = rower.twoK ?? "--";
  const weightText = rower.weight != null ? `${rower.weight} lbs` : "--";
  const rs = rarityStyle(rower.rarity);

  const particleCfg = {
    "Generational": { count: 50, sizes: [2, 14], anims: ["fire-rise","fire-drift","spark-burst","ember-float","lightning-flash","explosion","fire-whirl","trail-up"], glow: true, fire: true },
    "Freak": { count: 30, sizes: [2, 10], anims: ["fire-drift","ember-float","spark-burst","fire-whirl","trail-up"], glow: true, fire: false },
    "Pretty Good": { count: 18, sizes: [2, 7], anims: ["ember-float","fire-drift","spark-burst"], glow: false, fire: false },
    "Mid": { count: 9, sizes: [2, 5], anims: ["ember-float","fire-drift"], glow: false, fire: false },
    "Noob": { count: 4, sizes: [2, 4], anims: ["ember-float"], glow: false, fire: false },
  };
  const cfg = particleCfg[rower.rarity] || { count: 0, sizes: [2, 3], anims: ["ember-float"], glow: false, fire: false };

  card.setAttribute("data-rarity", rower.rarity || "unknown");
  let particles = "";
  const fireColors = ["#ff2020", "#ff3300", "#ff5500", "#ff8800", "#ffcc00", "#ffee44", "#ffffff", "#ff4400", "#ff6600", "#ffbb33", "#ff4444", "#ffcc66", "#ffaa00"];
  for (let i = 0; i < cfg.count; i++) {
    const size = cfg.sizes[0] + Math.random() * (cfg.sizes[1] - cfg.sizes[0]);
    const anim = cfg.anims[Math.floor(Math.random() * cfg.anims.length)];
    const color = cfg.fire ? fireColors[Math.floor(Math.random() * fireColors.length)] : rs.color;
    const shadow = cfg.glow ? `0 0 ${(6 + Math.random() * 18).toFixed(1)}px ${color}, 0 0 ${(15 + Math.random() * 30).toFixed(1)}px ${color}` : `0 0 ${(3 + Math.random() * 5).toFixed(1)}px ${color}`;
    const blur = Math.random() > 0.5 ? `filter:blur(${(0.5 + Math.random() * 1.5).toFixed(1)}px);` : "";
    const shapes = ["50%", "50%", "50%", "4px", "40% 60% 60% 40% / 60% 40% 60% 40%", "30% 70% 70% 30% / 30% 30% 70% 70%", "70% 30% 30% 70% / 70% 70% 30% 30%", "50% 20% 50% 20% / 20% 50% 20% 50%", "80% 20% 80% 20% / 20% 80% 20% 80%"];
    const br = shapes[Math.floor(Math.random() * shapes.length)];
    const l = (2 + Math.random() * 96).toFixed(1);
    const t = (2 + Math.random() * 96).toFixed(1);
    const ar = Math.random() > 0.6 ? (0.5 + Math.random() * 1.0).toFixed(2) : "1";
    const w = size;
    const h = size * parseFloat(ar);
    const dur = (0.6 + Math.random() * 2.5).toFixed(1);
    const delay = (Math.random() * 6).toFixed(1);
    particles += `<span class="hc-particle" style="
      left:${l}%;top:${t}%;
      width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;
      border-radius:${br};
      animation:${anim} ${dur}s ease-in-out ${delay}s infinite;
      background:${color};
      box-shadow:${shadow};
      ${blur}
    "></span>`;
  }
  // lightning bolt for Generational
  if (rower.rarity === "Generational") {
    for (let i = 0; i < 3; i++) {
      const l = 10 + i * 35;
      particles += `<span class="hc-lightning" style="left:${l}%;animation-delay:${(i * 1.5).toFixed(1)}s"></span>`;
    }
  }

  card.innerHTML = `
    <div class="hc-particles">${particles}</div>
    <div class="hc-top">
      <span class="hc-name">${rower.name}</span>
    </div>
    <div class="hc-grid">
      <div class="hc-cell">
        <span class="hc-cell-label">2k</span>
        <span class="hc-cell-value">${twoKText}</span>
      </div>
      <div class="hc-cell">
        <span class="hc-cell-label hc-power-label">Power</span>
        <span class="hc-cell-value hc-power">${rower.power}W</span>
      </div>
      <div class="hc-cell">
        <span class="hc-cell-label">Class</span>
        <span class="hc-cell-value">${classText}</span>
      </div>
      <div class="hc-cell">
        <span class="hc-cell-label">Weight</span>
        <span class="hc-cell-value">${weightText}</span>
      </div>
    </div>
    <div class="hc-dots">
      <div class="hc-dot-row">
        <span class="hc-dot-label">Port</span>
        <span class="hc-dot-stars">${dotStars(rower.port || 0)}</span>
        <span class="hc-dot-val">${(rower.port || 0).toFixed(1)}</span>
      </div>
      <div class="hc-dot-row">
        <span class="hc-dot-label">Star</span>
        <span class="hc-dot-stars">${dotStars(rower.starboard || 0)}</span>
        <span class="hc-dot-val">${(rower.starboard || 0).toFixed(1)}</span>
      </div>
      <div class="hc-dot-row">
        <span class="hc-dot-label">Ment</span>
        <span class="hc-dot-stars">${dotStars(rower.mentality || 0)}</span>
        <span class="hc-dot-val">${(rower.mentality || 0).toFixed(1)}</span>
      </div>
    </div>
    <div class="hc-footer">
      <span class="hc-rarity" style="background:${rs.color}">${rs.icon} ${rs.label}</span>
    </div>
  `;
  card.style.display = "block";
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "hcFadeIn 0.2s ease-out forwards";
  positionHoverCardNear(targetEl);
}

function positionRowerHoverCard(e) {
  if (hoverCardEl && hoverCardEl.style.display === "block") {
    positionHoverCardAtPointer(e);
  }
}

let _justDropped = null;

function positionHoverCardNear(targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const card = ensureHoverCard();
  const inBoat2 = targetEl.closest("#panel-boat2");
  if (inBoat2) {
    card.style.left = `${Math.max(4, rect.left - card.offsetWidth - 10)}px`;
  } else {
    card.style.left = `${rect.right + 10}px`;
  }
  card.style.top = `${rect.top}px`;
}

function positionHoverCardAtPointer(e) {
  const card = ensureHoverCard();
  const margin = 14;
  let left = e.clientX + margin;
  let top = e.clientY + margin;
  const cardRect = card.getBoundingClientRect();
  if (left + cardRect.width > window.innerWidth) {
    left = e.clientX - cardRect.width - margin;
  }
  if (top + cardRect.height > window.innerHeight) {
    top = e.clientY - cardRect.height - margin;
  }
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function hideRowerHoverCard() {
  if (hoverCardEl) {
    hoverCardEl.style.display = "none";
  }
}

function renderBoat(boatKey, containerEl, metaEl) {
  containerEl.innerHTML = "";
  const seats = boats[boatKey];
  let filledCount = 0;

  seats.forEach((rowerId, seatIndex) => {
    const row = document.createElement("div");
    row.className = "seat-row";

    const label = document.createElement("span");
    label.className = "seat-label";
    label.textContent = seatLabel(seatIndex);
    row.appendChild(label);

    const slot = document.createElement("li");
    slot.className = "seat-slot";
    slot.dataset.boat = boatKey;
    slot.dataset.seatIndex = seatIndex;

    if (rowerId) {
      filledCount++;
      slot.classList.add("filled");
      const rower = findRower(rowerId);
      const card = createRowerCard(rower);
      slot.appendChild(card);
      if (_justDropped && _justDropped.boat === boatKey && _justDropped.seat === seatIndex) {
        slot.style.animation = "seatDrop 0.4s ease-out";
        _justDropped = null;
      }
    } else {
      const placeholder = document.createElement("span");
      placeholder.textContent = "Empty seat";
      placeholder.style.padding = "0 12px";
      placeholder.style.opacity = "0.4";
      slot.appendChild(placeholder);
    }

    // drop handlers per-seat (allow swapping into a specific seat)
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      slot.closest(".dropzone").classList.add("dragover");
    });
    slot.addEventListener("dragleave", () => {
      slot.closest(".dropzone").classList.remove("dragover");
    });
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.closest(".dropzone").classList.remove("dragover");
      _justDropped = { boat: boatKey, seat: seatIndex };
      handleDrop(boatKey, seatIndex);
    });

    row.appendChild(slot);
    containerEl.appendChild(row);
  });

  metaEl.textContent = `${filledCount} / ${SEATS_PER_BOAT} seats filled`;
}

function seatLabel(i) {
  const labels = ["Stroke", "7", "6", "5", "4", "3", "2", "Bow"];
  return labels[i] || `Seat ${i + 1}`;
}

function renderAll() {
  renderRosterList();
  renderBoat("boat1", boat1SeatsEl, boat1MetaEl);
  renderBoat("boat2", boat2SeatsEl, boat2MetaEl);
  updateStaticTelemetry();
}

// ---------- Drag & drop ----------

let draggedRowerId = null;

function onDragStart(e) {
  draggedRowerId = e.currentTarget.dataset.rowerId;
  e.currentTarget.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", draggedRowerId);
}

function onDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
  draggedRowerId = null;
}

function handleDrop(targetBoatKey, targetSeatIndex) {
  const rowerId = draggedRowerId;
  if (!rowerId) return;

  // remove rower from wherever it currently is (roster is implicit / no-op)
  removeRowerFromBoats(rowerId);

  // if target seat occupied, bump that rower back to roster
  boats[targetBoatKey][targetSeatIndex] = rowerId;

  renderAll();
}

function removeRowerFromBoats(rowerId) {
  for (const key of ["boat1", "boat2"]) {
    boats[key] = boats[key].map(id => (id === rowerId ? null : id));
  }
}

// roster dropzone: drop = remove from any boat back to roster
rowerListEl.addEventListener("dragover", (e) => {
  e.preventDefault();
  rowerListEl.classList.add("dragover");
});
rowerListEl.addEventListener("dragleave", () => {
  rowerListEl.classList.remove("dragover");
});
rowerListEl.addEventListener("drop", (e) => {
  e.preventDefault();
  rowerListEl.classList.remove("dragover");
  if (draggedRowerId) {
    removeRowerFromBoats(draggedRowerId);
    renderAll();
  }
});

// ---------- Telemetry (static, pre-race) ----------

function crewPower(boatKey) {
  return boats[boatKey]
    .filter(Boolean)
    .reduce((sum, id) => sum + findRower(id).power, 0);
}

function crewSize(boatKey) {
  return boats[boatKey].filter(Boolean).length;
}

function crewAvgStat(boatKey, stat) {
  const rowers = boats[boatKey].map(id => findRower(id)).filter(Boolean);
  if (rowers.length === 0) return 0;
  return rowers.reduce((sum, r) => sum + (r[stat] || 0), 0) / rowers.length;
}

function boatTargetSpeed(boatKey) {
  const power = crewPower(boatKey);
  const size = crewSize(boatKey);
  if (size === 0) return 0;

  const avgMentality = crewAvgStat(boatKey, 'mentality');
  const avgPort = crewAvgStat(boatKey, 'port');
  const avgStarboard = crewAvgStat(boatKey, 'starboard');

  const sideBalance = Math.min(avgPort, avgStarboard) / Math.max(avgPort, avgStarboard || 1);
  const mentalityFactor = 0.7 + avgMentality * 0.1;
  const balanceFactor = 0.9 + sideBalance * 0.1;
  const fullBonus = size / SEATS_PER_BOAT;

  return Math.cbrt(power / 60) * (0.65 + 0.35 * fullBonus) * mentalityFactor * balanceFactor;
}

function boatAccelFactor(boatKey) {
  const avgMentality = crewAvgStat(boatKey, 'mentality');
  return 0.3 + avgMentality * 0.2;
}

function boatStrokesPower(boatKey) {
  return crewPower(boatKey);
}

function updateStaticTelemetry() {
  document.getElementById("t1-crew").textContent = crewSize("boat1");
  document.getElementById("t2-crew").textContent = crewSize("boat2");
  if (!raceState.running) {
    document.getElementById("t1-power").textContent = crewPower("boat1") + " W";
    document.getElementById("t2-power").textContent = crewPower("boat2") + " W";
  }
}

// ---------- Race Simulation ----------

const raceState = {
  running: false,
  finished: false,
  rafId: null,
  lastFrameTime: null,
  elapsed: 0,
  realElapsed: 0,
  boat1: { distance: 0, speed: 0, currentSpeed: 0, strokeRate: 0, strokePhase: 0, strokeCount: 0, finishTime: null, finishRealTime: null, strokePowers: [] },
  boat2: { distance: 0, speed: 0, currentSpeed: 0, strokeRate: 0, strokePhase: 0, strokeCount: 0, finishTime: null, finishRealTime: null, strokePowers: [] },
  lastTelemetryUpdate: 0,
};

let speedChart = null;

function initChart() {
  const ctx = document.getElementById("speedChart").getContext("2d");
  speedChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "Boat 1 power (W)",
          data: [],
          backgroundColor: "rgba(63,182,255,0.7)",
          borderColor: "#3fb6ff",
          borderWidth: 1,
          borderRadius: 2,
        },
        {
          label: "Boat 2 power (W)",
          data: [],
          backgroundColor: "rgba(255,107,107,0.7)",
          borderColor: "#ff6b6b",
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "stroke", color: "#8fa3b3" },
          ticks: { color: "#8fa3b3", maxTicksLimit: 15 },
          grid: { color: "#1f2c3a" },
        },
        y: {
          title: { display: true, text: "watts", color: "#8fa3b3" },
          ticks: { color: "#8fa3b3" },
          grid: { color: "#1f2c3a" },
          beginAtZero: true,
        },
      },
      plugins: {
        legend: { labels: { color: "#e6edf3" } },
      },
    },
  });
}

function resetRaceState() {
  raceState.running = false;
  raceState.finished = false;
  raceState.elapsed = 0;
  raceState.realElapsed = 0;
  raceState.lastFrameTime = null;
  raceState.lastTelemetryUpdate = 0;
  raceState.boat1 = { distance: 0, speed: 0, currentSpeed: 0, strokeRate: 0, strokePhase: 0, strokeCount: 0, finishTime: null, finishRealTime: null, strokePowers: [] };
  raceState.boat2 = { distance: 0, speed: 0, currentSpeed: 0, strokeRate: 0, strokePhase: 0, strokeCount: 0, finishTime: null, finishRealTime: null, strokePowers: [] };
  if (raceState.rafId) {
    cancelAnimationFrame(raceState.rafId);
    raceState.rafId = null;
  }
  marker1.style.left = "0%";
  marker2.style.left = "0%";
  renderOarStroke(marker1, 0);
  renderOarStroke(marker2, 0);
  updateSplitDisplay();
  updateDistanceSpeedDisplay();
  updateTimeDisplay();
  if (speedChart) {
    speedChart.data.labels = [];
    speedChart.data.datasets[0].data = [];
    speedChart.data.datasets[1].data = [];
    speedChart.update();
  }
  raceStatusEl.textContent = "Ready";
  raceStatusEl.className = "race-status";
  startBtn.disabled = false;
  stopBtn.disabled = true;
  stopBtn.textContent = "⏸ Pause";
}

function startRace() {
  if (crewSize("boat1") === 0 && crewSize("boat2") === 0) {
    alert("Assign at least one rower to a boat before starting the race.");
    return;
  }
  if (raceState.finished) {
    resetRaceState();
  }
  raceState.running = true;
  raceState.lastFrameTime = null;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  raceStatusEl.textContent = "Racing...";
  raceStatusEl.className = "race-status running";

  raceState.rafId = requestAnimationFrame(tickRace);
}

function pauseRace() {
  raceState.running = false;
  if (raceState.rafId) {
    cancelAnimationFrame(raceState.rafId);
    raceState.rafId = null;
  }
  raceState.lastFrameTime = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  raceStatusEl.textContent = "Paused";
}

// Renders the oar stroke animation for a boat marker based on its stroke
// phase (0-1, one full cycle = catch -> drive -> finish -> recovery).
function renderOarStroke(markerEl, phase) {
  const oarGroups = markerEl.querySelectorAll(".oar-group");
  const drivePortion = 0.35;
  let sweepT, inWater;
  if (phase < drivePortion) {
    sweepT = phase / drivePortion;
    inWater = true;
  } else {
    const t = (phase - drivePortion) / (1 - drivePortion);
    sweepT = 1 - t;
    inWater = false;
  }
  const angle = -28 + sweepT * 46;

  oarGroups.forEach((g) => {
    const side = Number(g.dataset.side);
    g.style.transform = `rotate(${side * angle}deg)`;
    g.classList.toggle("in-water", inWater);
  });
}

function tickRace(now) {
  if (!raceState.running) return;

  if (raceState.lastFrameTime === null) {
    raceState.lastFrameTime = now;
  }
  const realDtMs = now - raceState.lastFrameTime;
  raceState.lastFrameTime = now;

  const realDt = realDtMs / 1000;
  const dt = realDt * SIM_SPEED;
  raceState.elapsed += dt;
  raceState.realElapsed += realDt;

  ["boat1", "boat2"].forEach((key) => {
    const st = raceState[key];
    if (st.finishTime !== null) return;

    const size = crewSize(key);
    if (size === 0) return;

    // acceleration model: currentSpeed approaches targetSpeed
    const target = boatTargetSpeed(key);
    const accel = boatAccelFactor(key);
    const noise = (Math.random() - 0.5) * 0.05;
    st.currentSpeed += (target + noise - st.currentSpeed) * accel * dt;
    st.currentSpeed = Math.max(0, st.currentSpeed);
    st.speed = st.currentSpeed;
    st.distance = Math.min(RACE_DISTANCE, st.distance + st.speed * dt);

    const displayDist = st.distance * DISPLAY_SCALE;
    let targetRate = 36;
    if (displayDist >= 1200) {
      targetRate = 38;
    } else if (st.strokeCount < 1) {
      targetRate = 24;
    } else if (st.strokeCount < 2) {
      targetRate = 28;
    } else if (st.strokeCount < 3) {
      targetRate = 32;
    } else if (st.strokeCount < 4) {
      targetRate = 36;
    } else if (st.strokeCount < 14) {
      targetRate = 40;
    } else {
      targetRate = 36;
    }
    st.strokeRate = size > 0 ? targetRate : 0;

    const strokesPerSecond = Math.max(st.strokeRate, 1) / 60;
    const prevPhase = st.strokePhase;
    st.strokePhase = (st.strokePhase + strokesPerSecond * dt) % 1;
    if (st.strokePhase < prevPhase) {
      st.strokeCount++;
      const strokePower = boatStrokesPower(key);
      st.strokePowers.push(strokePower);
      updateChart();
      updateSplitDisplay();
    }

    if (st.distance >= RACE_DISTANCE && st.finishTime === null) {
      st.finishTime = raceState.elapsed;
      st.finishRealTime = raceState.realElapsed;
    }
  });

  renderOarStroke(marker1, raceState.boat1.strokePhase);
  renderOarStroke(marker2, raceState.boat2.strokePhase);
  updateCourseMarkers();

  // distance + speed every 0.2s real time
  raceState.lastTelemetryUpdate += realDt;
  if (raceState.lastTelemetryUpdate >= 0.2) {
    raceState.lastTelemetryUpdate = 0;
    updateDistanceSpeedDisplay();
  }

  // time + rate + power every frame
  updateTimeDisplay();

  const b1done = crewSize("boat1") === 0 || raceState.boat1.finishTime !== null;
  const b2done = crewSize("boat2") === 0 || raceState.boat2.finishTime !== null;
  if (b1done && b2done) {
    finishRace();
    return;
  }

  raceState.rafId = requestAnimationFrame(tickRace);
}

function finishRace() {
  raceState.running = false;
  raceState.finished = true;
  if (raceState.rafId) {
    cancelAnimationFrame(raceState.rafId);
    raceState.rafId = null;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;

  let msg = "Finished";
  const t1 = raceState.boat1.finishTime;
  const t2 = raceState.boat2.finishTime;
  if (t1 !== null && t2 !== null) {
    const tt1 = formatRealTime(t1 * DISPLAY_SCALE);
    const tt2 = formatRealTime(t2 * DISPLAY_SCALE);
    msg = t1 < t2 ? `🏆 Boat 1 wins (${tt1})` : (t2 < t1 ? `🏆 Boat 2 wins (${tt2})` : "Photo finish - tie!");
  } else if (t1 !== null) {
    msg = "🏆 Boat 1 wins!";
  } else if (t2 !== null) {
    msg = "🏆 Boat 2 wins!";
  }
  raceStatusEl.textContent = msg;
  raceStatusEl.className = "race-status finished";
}

function formatSplit(speed) {
  if (!speed || speed <= 0) return "--:--";
  const secPer500 = 500 / speed;
  const m = Math.floor(secPer500 / 60);
  const s = Math.round(secPer500 % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatRealTime(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

function updateSplitDisplay() {
  const b1 = raceState.boat1;
  const b2 = raceState.boat2;
  document.getElementById("t1-split").textContent = formatSplit(b1.speed);
  document.getElementById("t2-split").textContent = formatSplit(b2.speed);
}

function updateDistanceSpeedDisplay() {
  const b1 = raceState.boat1;
  const b2 = raceState.boat2;
  document.getElementById("t1-dist").textContent = Math.ceil(b1.distance * DISPLAY_SCALE) + " m";
  document.getElementById("t2-dist").textContent = Math.ceil(b2.distance * DISPLAY_SCALE) + " m";
  document.getElementById("t1-speed").textContent = b1.speed.toFixed(2) + " m/s";
  document.getElementById("t2-speed").textContent = b2.speed.toFixed(2) + " m/s";
}

function updateTimeDisplay() {
  const b1 = raceState.boat1;
  const b2 = raceState.boat2;
  const t1 = b1.finishRealTime !== null ? b1.finishRealTime * DISPLAY_SCALE : raceState.realElapsed * DISPLAY_SCALE;
  const t2 = b2.finishRealTime !== null ? b2.finishRealTime * DISPLAY_SCALE : raceState.realElapsed * DISPLAY_SCALE;
  document.getElementById("t1-time").textContent = formatRealTime(t1);
  document.getElementById("t2-time").textContent = formatRealTime(t2);
  document.getElementById("t1-rate").textContent = (b1.strokeRate || 0) + " spm";
  document.getElementById("t2-rate").textContent = (b2.strokeRate || 0) + " spm";
  document.getElementById("t1-power").textContent = crewPower("boat1") + " W";
  document.getElementById("t2-power").textContent = crewPower("boat2") + " W";
  document.getElementById("t1-crew").textContent = crewSize("boat1");
  document.getElementById("t2-crew").textContent = crewSize("boat2");
}

function getBowFinishPct() {
  const trackEl = document.querySelector(".lane-track");
  if (!trackEl) return 100;
  const trackWidth = trackEl.offsetWidth;
  if (trackWidth <= 0) return 100;
  const bowOffset = ((100 - (-20)) / 140) * 92;
  return Math.min(100, (100 * (trackWidth - 55 - bowOffset)) / (trackWidth - 92));
}

function updateCourseMarkers() {
  const finishPct = getBowFinishPct();
  const pct1 = Math.min(finishPct, (raceState.boat1.distance / RACE_DISTANCE) * finishPct);
  const pct2 = Math.min(finishPct, (raceState.boat2.distance / RACE_DISTANCE) * finishPct);
  const boatWidthPx = 92;
  marker1.style.left = `calc(${pct1}% - ${(pct1 / 100) * boatWidthPx}px)`;
  marker2.style.left = `calc(${pct2}% - ${(pct2 / 100) * boatWidthPx}px)`;
}

function updateChart() {
  const b1 = raceState.boat1;
  const b2 = raceState.boat2;
  const maxStrokes = Math.max(b1.strokePowers.length, b2.strokePowers.length);
  if (maxStrokes === 0) return;
  const labels = [];
  const d1 = [];
  const d2 = [];
  for (let i = 0; i < maxStrokes; i++) {
    labels.push((i + 1).toString());
    d1.push(b1.strokePowers[i] || null);
    d2.push(b2.strokePowers[i] || null);
  }
  speedChart.data.labels = labels;
  speedChart.data.datasets[0].data = d1;
  speedChart.data.datasets[1].data = d2;
  speedChart.update("none");
}

// ---------- Event wiring ----------

startBtn.addEventListener("click", startRace);
stopBtn.addEventListener("click", pauseRace);
resetBtn.addEventListener("click", resetRaceState);

// ---------- Init ----------

function seedDefaultBoats() {
  // Put the first 8 rowers (by 2k speed) in boat1, next 8 in boat2 as a starting example
  const seatCount = Math.min(SEATS_PER_BOAT, rowers.length);
  for (let i = 0; i < seatCount; i++) {
    boats.boat1[i] = rowers[i].id;
  }
  const boat2Count = Math.min(SEATS_PER_BOAT, Math.max(0, rowers.length - SEATS_PER_BOAT));
  for (let i = 0; i < boat2Count; i++) {
    boats.boat2[i] = rowers[SEATS_PER_BOAT + i].id;
  }
}

function init() {
  loadRowers();
  seedDefaultBoats();
  renderAll();
  initChart();
  resetRaceState();
}

init();

