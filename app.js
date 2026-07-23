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

const SIM_SPEED = 2;

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

  const shapeFA = {
    heart: "fa-heart",
    star: "fa-star",
    triangle: "fa-play",
    square: "fa-square",
    circle: "fa-circle",
  };
  const particleClip = {
    triangle: "polygon(50% 0%, 0% 100%, 100% 100%)",
    square: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
    circle: "circle(50%)",
  };
  const particleCfg = {
    "Generational": { count: 55, sizes: [5, 20], anims: ["hc-rise","hc-rise-drift","hc-rise-spin","hc-rise-pulse"], glow: true, shape: "heart", icon: true },
    "Freak":        { count: 35, sizes: [4, 15], anims: ["hc-rise","hc-rise-drift","hc-rise-spin"], glow: true, shape: "star", icon: true },
    "Pretty Good":  { count: 22, sizes: [3, 11], anims: ["hc-rise","hc-rise-drift","hc-rise-spin","hc-rise-pulse"], glow: false, shape: "mixed", icon: false },
    "Mid":          { count: 12, sizes: [3, 8],  anims: ["hc-rise","hc-rise-drift"], glow: false, shape: "circle", icon: false },
    "Noob":         { count: 5,  sizes: [3, 5],  anims: ["hc-rise"], glow: false, shape: "circle", icon: false },
  };
  const cfg = particleCfg[rower.rarity] || { count: 0, sizes: [3, 4], anims: ["hc-rise"], glow: false, shape: "circle", icon: false };

  const genColors = ["#ff2020","#ff3333","#ff4444","#ff5555","#cc0000","#dd1111","#ee2222","#ff1111","#dd2222","#ff6666"];

  card.setAttribute("data-rarity", rower.rarity || "unknown");
  let particles = "";
  for (let i = 0; i < cfg.count; i++) {
    const size = cfg.sizes[0] + Math.random() * (cfg.sizes[1] - cfg.sizes[0]);
    const anim = cfg.anims[Math.floor(Math.random() * cfg.anims.length)];
    const color = rower.rarity === "Generational"
      ? genColors[Math.floor(Math.random() * genColors.length)]
      : rs.color;
    const shadow = cfg.glow
      ? `0 0 ${(8 + Math.random() * 24).toFixed(1)}px ${color}, 0 0 ${(20 + Math.random() * 40).toFixed(1)}px ${color}`
      : `0 0 ${(3 + Math.random() * 6).toFixed(1)}px ${color}`;
    let shape;
    if (cfg.shape === "mixed") {
      shape = Math.random() > 0.5 ? "triangle" : "square";
    } else {
      shape = cfg.shape;
    }
    const l = (2 + Math.random() * 96).toFixed(1);
    const t = (85 + Math.random() * 15).toFixed(1);
    const dur = (3 + Math.random() * 5).toFixed(1);
    const delay = (Math.random() * 10).toFixed(1);
    const blur = Math.random() > 0.7 ? `filter:blur(${(0.5 + Math.random() * 1.2).toFixed(1)}px);` : "";
    if (cfg.icon) {
      const fa = shapeFA[shape] || "fa-circle";
      particles += `<i class="hc-particle fa-solid ${fa}" style="
        left:${l}%;top:${t}%;
        font-size:${size.toFixed(1)}px;line-height:1;
        animation:${anim} ${dur}s linear ${delay}s infinite;
        color:${color};
        text-shadow:${shadow};
        ${blur}
      "></i>`;
    } else {
      const clip = particleClip[shape] || "circle(50%)";
      particles += `<span class="hc-particle" style="
        left:${l}%;top:${t}%;
        width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;
        clip-path:${clip};
        animation:${anim} ${dur}s linear ${delay}s infinite;
        background:${color};
        box-shadow:${shadow};
        ${blur}
      "></span>`;
    }
  }

  card.innerHTML = `
    <div class="hc-pattern"></div>
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
    card.style.left = `${Math.max(4, rect.left + window.scrollX - card.offsetWidth - 10)}px`;
  } else {
    card.style.left = `${rect.right + window.scrollX + 10}px`;
  }
  card.style.top = `${rect.top + window.scrollY}px`;
}

function positionHoverCardAtPointer(e) {
  const card = ensureHoverCard();
  const margin = 14;
  let left = e.pageX + margin;
  let top = e.pageY + margin;
  const cardRect = card.getBoundingClientRect();
  if (left + cardRect.width > window.innerWidth + window.scrollX) {
    left = e.pageX - cardRect.width - margin;
  }
  if (top + cardRect.height > window.innerHeight + window.scrollY) {
    top = e.pageY - cardRect.height - margin;
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
      slot.classList.add("dragover");
    });
    slot.addEventListener("dragleave", () => {
      slot.classList.remove("dragover");
    });
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("dragover");
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
}

// ---------- Drag & drop ----------

let draggedRowerId = null;

function onDragStart(e) {
  draggedRowerId = e.currentTarget.dataset.rowerId;
  e.currentTarget.classList.add("dragging");
  hideRowerHoverCard();
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

function crewSize(boatKey) {
  return boats[boatKey].filter(Boolean).length;
}

let speedChart1 = null;
let speedChart2 = null;

function buildChart(canvasId, lineColor, fillColor) {
  return new Chart(document.getElementById(canvasId).getContext("2d"), {
    type: "line",
    data: {
      labels: Array.from({ length: 21 }, (_, i) => `${i * 5}%`),
      datasets: [{
        label: "Watts",
        data: [],
        borderColor: lineColor,
        backgroundColor: fillColor,
        pointBackgroundColor: lineColor,
        pointBorderColor: lineColor,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2.5,
        tension: 0.3,
        fill: true,
        spanGaps: false,
      }],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "drive %", color: "#8fa3b3" },
          ticks: { color: "#8fa3b3", maxTicksLimit: 11 },
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
        legend: { display: false },
      },
    },
  });
}

function initChart() {
  speedChart1 = buildChart("speedChart1", "#3fb6ff", "rgba(63,182,255,0.1)");
  speedChart2 = buildChart("speedChart2", "#ff6b6b", "rgba(255,107,107,0.1)");
}

let simulation = null;
let rafId = null;
let lastFrameTime = null;
let lastTelemetryUpdate = 0;

function resetRaceState() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (simulation) simulation.reset();
  lastFrameTime = null;
  marker1.style.left = "0%";
  marker2.style.left = "0%";
  renderOarStroke(marker1, 0);
  renderOarStroke(marker2, 0);
  document.getElementById("rt1-body").innerHTML = "";
  document.getElementById("rt2-body").innerHTML = "";
  if (speedChart1) { speedChart1.data.datasets[0].data = []; speedChart1.update(); }
  if (speedChart2) { speedChart2.data.datasets[0].data = []; speedChart2.update(); }
  document.getElementById("t1-time").textContent = "0:00.0";
  document.getElementById("t2-time").textContent = "0:00.0";
  document.getElementById("t1-dist").textContent = "0 m";
  document.getElementById("t2-dist").textContent = "0 m";
  document.getElementById("t1-speed").textContent = "0.00 m/s";
  document.getElementById("t2-speed").textContent = "0.00 m/s";
  document.getElementById("t1-split").textContent = "--:--";
  document.getElementById("t2-split").textContent = "--:--";
  document.getElementById("t1-rate").textContent = "0 spm";
  document.getElementById("t2-rate").textContent = "0 spm";
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
  const b1rowers = boats.boat1.map((id, i) => {
    if (!id) return null;
    const r = { ...findRower(id) };
    r._seatIdx = i;
    r._seatSide = i % 2 === 0 ? 'port' : 'starboard';
    return r;
  }).filter(Boolean);
  const b2rowers = boats.boat2.map((id, i) => {
    if (!id) return null;
    const r = { ...findRower(id) };
    r._seatIdx = i;
    r._seatSide = i % 2 === 0 ? 'port' : 'starboard';
    return r;
  }).filter(Boolean);
  simulation = new RaceSimulation(b1rowers, b2rowers);
  simulation.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
  raceStatusEl.textContent = "Racing...";
  raceStatusEl.className = "race-status running";
  lastFrameTime = null;
  rafId = requestAnimationFrame(tickRace);
}

function pauseRace() {
  if (simulation) simulation.pause();
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  lastFrameTime = null;
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
  const angle = -30 + sweepT * 60;

  oarGroups.forEach((g) => {
    const side = Number(g.dataset.side);
    g.style.transform = `rotate(${side * angle}deg)`;
    g.classList.toggle("in-water", inWater);
  });
}

function tickRace(now) {
  if (!simulation || !simulation.running) return;

  if (lastFrameTime === null) lastFrameTime = now;
  const realDt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  lastTelemetryUpdate += realDt;

  simulation.tick(realDt * SIM_SPEED);
  const s = simulation.getState();

  renderOarStroke(marker1, s.boat1.strokePhase);
  renderOarStroke(marker2, s.boat2.strokePhase);
  updateCourseMarkers(s);
  updateChart(s);
  updateRowerTelemetry(s);
  updateTimeDisplay(s);
  updateSplitDisplay(s);

  if (lastTelemetryUpdate >= 0.2) {
    lastTelemetryUpdate = 0;
    updateDistanceSpeedDisplay(s);
  }

  if (s.finished) {
    finishRace();
    return;
  }

  rafId = requestAnimationFrame(tickRace);
}

function finishRace() {
  if (simulation) simulation.pause();
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  lastFrameTime = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  const s = simulation ? simulation.getState() : null;
  let msg = "Finished";
  if (s) {
    const t1 = s.boat1.finishDisplayTime;
    const t2 = s.boat2.finishDisplayTime;
    if (t1 !== null && t2 !== null) {
      msg = t1 < t2 ? `🏆 Boat 1 wins (${formatRealTime(t1)})` : (t2 < t1 ? `🏆 Boat 2 wins (${formatRealTime(t2)})` : "Photo finish - tie!");
    } else if (t1 !== null) {
      msg = "🏆 Boat 1 wins!";
    } else if (t2 !== null) {
      msg = "🏆 Boat 2 wins!";
    }
  }
  raceStatusEl.textContent = msg;
  raceStatusEl.className = "race-status finished";
}

function formatSplit(speed) {
  if (!speed || speed <= 0) return "--:--";
  const secPer500 = 500 / speed;
  const m = Math.floor(secPer500 / 60);
  const s = (secPer500 % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

function formatRealTime(sec) {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

function getBowFinishPct() {
  const trackEl = document.querySelector(".lane-track");
  const finishEl = document.querySelector(".finish-line");
  if (!trackEl || !finishEl) return 100;
  const trackRect = trackEl.getBoundingClientRect();
  const finishRect = finishEl.getBoundingClientRect();
  const trackWidth = trackRect.width;
  if (trackWidth <= 0) return 100;
  const bowOffset = ((100 - (-20)) / 140) * 92;
  const finishLeft = finishRect.left - trackRect.left;
  return Math.min(100, Math.max(0, 100 * (finishLeft - bowOffset) / (trackWidth - 92)));
}

function updateSplitDisplay(state) {
  if (!state) return;
  document.getElementById("t1-split").textContent = formatSplit(state.boat1.speed);
  document.getElementById("t2-split").textContent = formatSplit(state.boat2.speed);
}

function updateDistanceSpeedDisplay(state) {
  if (!state) return;
  document.getElementById("t1-dist").textContent = Math.ceil(state.boat1.displayDistance) + " m";
  document.getElementById("t2-dist").textContent = Math.ceil(state.boat2.displayDistance) + " m";
  document.getElementById("t1-speed").textContent = state.boat1.speed.toFixed(2) + " m/s";
  document.getElementById("t2-speed").textContent = state.boat2.speed.toFixed(2) + " m/s";
}

function updateTimeDisplay(state) {
  if (!state) return;
  const dt = state.displayTime;
  document.getElementById("t1-time").textContent = formatRealTime(state.boat1.finishDisplayTime !== null ? state.boat1.finishDisplayTime : dt);
  document.getElementById("t2-time").textContent = formatRealTime(state.boat2.finishDisplayTime !== null ? state.boat2.finishDisplayTime : dt);
  document.getElementById("t1-rate").textContent = (state.boat1.strokeRate || 0) + " spm";
  document.getElementById("t2-rate").textContent = (state.boat2.strokeRate || 0) + " spm";
}

function updateCourseMarkers(state) {
  const finishPct = getBowFinishPct();
  const pct1 = Math.min(100, (state.boat1.distance / 750) * finishPct);
  const pct2 = Math.min(100, (state.boat2.distance / 750) * finishPct);
  const boatWidthPx = 92;
  marker1.style.left = `calc(${pct1}% - ${(pct1 / 100) * boatWidthPx}px)`;
  marker2.style.left = `calc(${pct2}% - ${(pct2 / 100) * boatWidthPx}px)`;
}

function updateRowerTelemetry(state) {
  ["boat1", "boat2"].forEach((key) => {
    const tbody = document.getElementById(`rt${key === "boat1" ? "1" : "2"}-body`);
    const data = state[key].rowerData || [];
    if (data.length === 0) { tbody.innerHTML = ""; return; }

    const avgPow = data.reduce((s, r) => s + r.basePower, 0) / data.length;
    const avgEffPow = data.reduce((s, r) => s + r.effPower, 0) / data.length;
    const avgTech = data.reduce((s, r) => s + r.baseTech, 0) / data.length;
    const avgMod = data.reduce((s, r) => s + r.techMod, 0) / data.length;
    const avgEffTech = data.reduce((s, r) => s + r.effTech, 0) / data.length;
    const modClass = avgMod >= 0 ? "rt-tech-pos" : "rt-tech-neg";

    const avgRow = `<tr class="rt-avg-row">
      <td>Avg</td><td></td>
      <td>${avgPow.toFixed(1)}</td>
      <td>${avgEffPow.toFixed(1)}</td>
      <td>${avgTech.toFixed(2)}</td>
      <td class="${modClass}">${avgMod >= 0 ? "+" : ""}${avgMod.toFixed(2)}</td>
      <td>${avgEffTech.toFixed(2)}</td>
    </tr>`;

    const rows = data.map((rd) => {
      const modClass = rd.techMod >= 0 ? "rt-tech-pos" : "rt-tech-neg";
      return `<tr>
        <td>${seatLabel(rd.seatIdx)}</td>
        <td>${rd.name}</td>
        <td>${rd.basePower}</td>
        <td>${rd.effPower}</td>
        <td>${rd.baseTech}</td>
        <td class="${modClass}">${rd.techMod >= 0 ? "+" : ""}${rd.techMod}</td>
        <td>${rd.effTech}</td>
      </tr>`;
    }).join("");
    tbody.innerHTML = avgRow + rows;
  });
}

function updateChart(state) {
  speedChart1.data.datasets[0].data = state.boat1.displayCurve || [];
  speedChart1.update("none");
  speedChart2.data.datasets[0].data = state.boat2.displayCurve || [];
  speedChart2.update("none");
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

