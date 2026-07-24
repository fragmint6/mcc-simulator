/* ------------------------------------------------------------------
   Rowing Simulator - basic vanilla JS app
   - Drag & drop rowers between roster / boat1 / boat2
   - Simple physics-ish simulation for a 1000m race
   - Live telemetry table + Chart.js speed graph
------------------------------------------------------------------- */

const SEATS_PER_BOAT = 8;

let rowers = []; // populated from data/rowers.js at startup
let coxswains = []; // populated from data/coxswains.js at startup
let lineups = []; // populated from data/lineups.js at startup
let boatCoxswains = { boat1: null, boat2: null };

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
    medals: record.medals || [],
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

function buildCoxswainFromRecord(record, index) {
  return {
    id: "c" + index,
    name: record.name,
    year: record.year,
    motivation: record.motivation || 0,
    strategy: record.strategy || 0,
    tech_calls: record.tech_calls || 0,
    steering: record.steering || 0,
    weight: record.weight || 105,
    rarity: record.rarity || "Unknown",
    medals: record.medals || [],
    ovr: computeCOXR(record),
  };
}

function loadCoxswains() {
  if (typeof COXSWAINS_DATA !== "undefined" && Array.isArray(COXSWAINS_DATA)) {
    coxswains = COXSWAINS_DATA.map(buildCoxswainFromRecord);
  } else {
    console.error("No coxswain data found (COXSWAINS_DATA missing).");
    coxswains = [];
  }
}

function loadLineups() {
  if (typeof LINEUPS_DATA !== "undefined" && Array.isArray(LINEUPS_DATA)) {
    lineups = LINEUPS_DATA.map((rec, i) => ({ ...rec, id: "l" + i }));
  } else {
    console.error("No lineup data found (LINEUPS_DATA missing).");
    lineups = [];
  }
}

function findRowerByName(name) {
  return rowers.find(r => r.name === name) || null;
}

function findCoxswainByName(name) {
  return coxswains.find(c => c.name === name) || null;
}

function computeBoatOVR(boatKey) {
  const seatIds = boats[boatKey];
  let total = 0, count = 0;
  seatIds.forEach((id, i) => {
    if (!id) return;
    const r = findRower(id);
    if (!r) return;
    const side = i % 2 === 0 ? 'port' : 'starboard';
    total += computeOVR(r, side);
    count++;
  });
  if (count === 0) return null;
  return Math.round(total / count);
}

function updateBoatOVR(boatKey) {
  const el = document.getElementById(boatKey === 'boat1' ? 'boat1Ovr' : 'boat2Ovr');
  const ovr = computeBoatOVR(boatKey);
  el.textContent = ovr !== null ? `OVR: ${ovr}` : 'OVR: --';
}

function showLineupPopup(boatKey) {
  const overlay = document.createElement("div");
  overlay.className = "lineup-overlay";
  const popup = document.createElement("div");
  popup.className = "lineup-popup";
  popup.innerHTML = `
    <div class="lineup-popup-header">
      <span>Select Lineup</span>
      <button class="lineup-popup-close">&times;</button>
    </div>
    <input class="lineup-search" type="text" placeholder="Search lineups..." />
    <div class="lineup-popup-body"></div>
  `;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => popup.classList.add("open"));

  function renderLineups(filter) {
    const body = popup.querySelector(".lineup-popup-body");
    const term = (filter || "").toLowerCase();
    body.innerHTML = lineups
      .filter(l => !term || l.name.toLowerCase().includes(term))
      .map((l, i) => `
        <button class="lineup-option" data-idx="${i}">
          <span class="lineup-option-name">${l.name}</span>
          <span class="lineup-option-detail">${(l.rowers || []).length} rowers${l.coxswain ? ' · ' + l.coxswain : ''}</span>
        </button>
      `).join("") || '<div class="lineup-empty">No lineups found</div>';

    body.querySelectorAll(".lineup-option").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        const lineup = lineups[idx];
        if (!lineup) return;

        boats[boatKey] = Array(SEATS_PER_BOAT).fill(null);
        boatCoxswains[boatKey] = null;

        if (lineup.coxswain) {
          const cox = findCoxswainByName(lineup.coxswain);
          if (cox) boatCoxswains[boatKey] = cox.id;
        }

        if (lineup.rowers && lineup.rowers.length) {
          lineup.rowers.forEach((name, i) => {
            if (i >= SEATS_PER_BOAT) return;
            const rower = findRowerByName(name);
            if (rower) boats[boatKey][i] = rower.id;
          });
        }

        overlay.remove();
        renderAll();
      });
    });
  }

  popup.querySelector(".lineup-search").addEventListener("input", (e) => {
    renderLineups(e.target.value);
  });

  renderLineups("");

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  popup.querySelector(".lineup-popup-close").addEventListener("click", () => overlay.remove());
}

function computeCOXR(c) {
  const ws = 0.28 * (c.motivation || 0)
           + 0.18 * (c.strategy || 0)
           + 0.14 * (c.tech_calls || 0)
           + 0.35 * (c.steering || 0);
  const base = 18 * ws + 9 + 4 * Math.pow(Math.max(0, ws - 4), 2);
  const adj = (105 - (c.weight || 105)) / 10;
  return Math.round(base + adj);
}

// boat assignment state: array of length SEATS_PER_BOAT, each null or rower id
let boats = {
  boat1: Array(SEATS_PER_BOAT).fill(null),
  boat2: Array(SEATS_PER_BOAT).fill(null),
};

// Search and popup state
let rowerSearchTerm = '';
let coxswainSearchTerm = '';
let assignPopupData = null; // { type: 'rower'|'coxswain', item: {...} }

// ---------- DOM refs ----------
const rowerListEl = document.getElementById("rowerList");
const coxswainListEl = document.getElementById("coxswainList");
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
function findCoxswain(id) {
  return coxswains.find(c => c.id === id);
}

// ---------- Rendering ----------

function renderRosterList() {
  rowerListEl.innerHTML = "";
  const term = rowerSearchTerm.toLowerCase();
  rowers
    .filter(r => !term || r.name.toLowerCase().includes(term))
    .forEach(r => rowerListEl.appendChild(createRowerCard(r)));
}

function createRowerCard(rower, seatSide, clickable) {
  const li = document.createElement("li");
  li.className = "rower-card";
  li.dataset.rowerId = rower.id;
  const ovr = computeOVR(rower, seatSide);
  if (seatSide) {
    const baseOvr = computeOVR(rower);
    const diff = ovr - baseOvr;
    if (diff > 0) li.style.setProperty('--ovr-color', '#4ade80');
    else if (diff < 0) li.style.setProperty('--ovr-color', '#ff6b6b');
    else li.style.setProperty('--ovr-color', '');
  }
  const effRarity = displayRarity(rower);
  li.dataset.rarity = effRarity === "Unknown" ? "unknown" : effRarity;
  const rs = rarityStyle(effRarity);
  li.innerHTML = `
    <span class="rc-ovr">${ovr}</span>
    <span class="rower-name">${rower.name}</span>
    <span class="rc-rarity" style="background:${rs.color}">${rs.icon} ${rs.label}</span>
  `;
  if (clickable !== false) {
    li.addEventListener("click", (e) => {
      e.stopPropagation();
      showAssignPopup(rower, 'rower');
    });
  }
  li.addEventListener("mouseenter", (e) => showHoverCard(rower, e.currentTarget, 'rower', seatSide));
  li.addEventListener("mouseleave", hideRowerHoverCard);
  return li;
}

// ---------- Coxswain rendering ----------

function renderCoxswainList() {
  coxswainListEl.innerHTML = "";
  const term = coxswainSearchTerm.toLowerCase();
  coxswains
    .filter(c => !term || c.name.toLowerCase().includes(term))
    .forEach(c => coxswainListEl.appendChild(createCoxswainCard(c)));
}

function createCoxswainCard(coxswain, clickable) {
  const li = document.createElement("li");
  li.className = "rower-card";
  li.dataset.coxswainId = coxswain.id;
  const rs = rarityStyle(coxswain.rarity || "Unknown");
  li.dataset.rarity = coxswain.rarity || "unknown";
  li.innerHTML = `
    <span class="rc-ovr">${coxswain.ovr}</span>
    <span class="rower-name">${coxswain.name}</span>
    <span class="rc-rarity" style="background:${rs.color}">${rs.icon} ${rs.label}</span>
  `;
  if (clickable !== false) {
    li.addEventListener("click", (e) => {
      e.stopPropagation();
      showAssignPopup(coxswain, 'coxswain');
    });
  }
  li.addEventListener("mouseenter", (e) => showHoverCard(coxswain, e.currentTarget, 'coxswain'));
  li.addEventListener("mouseleave", hideRowerHoverCard);
  return li;
}

// ---------- Universal hover card ----------

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
  "Generational": { color: "#ff2020", label: "Generational", icon: "⬢" },
  "Freak": { color: "#ff9f43", label: "Freak", icon: "★" },
  "Pretty Good": { color: "#a359ff", label: "Pretty Good", icon: "■" },
  "Mid": { color: "#4ade80", label: "Mid", icon: "▲" },
  "Noob": { color: "#8fa3b3", label: "Noob", icon: "●" },
};

function rarityStyle(rarity) {
  return RARITY_STYLES[rarity] || { color: "#5a6b7c", label: rarity || "Unknown", icon: "?" };
}

function rarityFromOVR(ovr) {
  if (ovr >= 90) return "Generational";
  if (ovr >= 85) return "Freak";
  if (ovr >= 80) return "Pretty Good";
  if (ovr >= 70) return "Mid";
  return "Noob";
}

function displayRarity(rower) {
  if (!rower.rarity) return "Unknown";
  return rarityFromOVR(computeOVR(rower));
}

function computeOVR(rower, seatSide) {
  const secs = parseScoreToSeconds(rower.twoK);
  if (!secs) return 0;
  const R2k = 92 - ((secs - 390) / 5) * 3;
  const p = rower.port || 0, s = rower.starboard || 0;
  let techStars;
  if (seatSide === 'port') {
    techStars = p;
  } else if (seatSide === 'starboard') {
    techStars = s;
  } else {
    techStars = (2 * Math.max(p, s) + Math.min(p, s)) / 3;
  }
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

function buildHoverCardHTML(item, itemType, seatSide) {
  const isCox = itemType === 'coxswain';
  const effRarity = isCox ? (item.rarity || "Unknown") : displayRarity(item);
  const rs = rarityStyle(effRarity);
  const classText = item.year != null ? `Class of ${item.year}` : "--";

  const shapeFA = { heart: "fa-heart", star: "fa-star", triangle: "fa-play", square: "fa-square", circle: "fa-circle" };
  const particleClip = { triangle: "polygon(50% 0%, 0% 100%, 100% 100%)", square: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)", circle: "circle(50%)" };
  const particleCfg = {
    "Generational": { count: 55, sizes: [5, 20], anims: ["hc-rise","hc-rise-drift","hc-rise-spin","hc-rise-pulse"], glow: true, shape: "heart", icon: true },
    "Freak":        { count: 35, sizes: [4, 15], anims: ["hc-rise","hc-rise-drift","hc-rise-spin"], glow: true, shape: "star", icon: true },
    "Pretty Good":  { count: 22, sizes: [3, 11], anims: ["hc-rise","hc-rise-drift","hc-rise-spin","hc-rise-pulse"], glow: false, shape: "mixed", icon: false },
    "Mid":          { count: 12, sizes: [3, 8],  anims: ["hc-rise","hc-rise-drift"], glow: false, shape: "circle", icon: false },
    "Noob":         { count: 5,  sizes: [3, 5],  anims: ["hc-rise"], glow: false, shape: "circle", icon: false },
  };
  const cfg = particleCfg[effRarity] || { count: 0, sizes: [3, 4], anims: ["hc-rise"], glow: false, shape: "circle", icon: false };
  const genColors = ["#ff2020","#ff3333","#ff4444","#ff5555","#cc0000","#dd1111","#ee2222","#ff1111","#dd2222","#ff6666"];

  let particles = "";
  for (let i = 0; i < cfg.count; i++) {
    const size = cfg.sizes[0] + Math.random() * (cfg.sizes[1] - cfg.sizes[0]);
    const anim = cfg.anims[Math.floor(Math.random() * cfg.anims.length)];
    const color = effRarity === "Generational" ? genColors[Math.floor(Math.random() * genColors.length)] : rs.color;
    const shadow = cfg.glow ? `0 0 ${(8 + Math.random() * 24).toFixed(1)}px ${color}, 0 0 ${(20 + Math.random() * 40).toFixed(1)}px ${color}` : `0 0 ${(3 + Math.random() * 6).toFixed(1)}px ${color}`;
    let shape;
    if (cfg.shape === "mixed") { shape = Math.random() > 0.5 ? "triangle" : "square"; } else { shape = cfg.shape; }
    const l = (2 + Math.random() * 96).toFixed(1);
    const t = (85 + Math.random() * 15).toFixed(1);
    const dur = (3 + Math.random() * 5).toFixed(1);
    const delay = (Math.random() * 10).toFixed(1);
    const blur = Math.random() > 0.7 ? `filter:blur(${(0.5 + Math.random() * 1.2).toFixed(1)}px);` : "";
    if (cfg.icon) {
      const fa = shapeFA[shape] || "fa-circle";
      particles += `<i class="hc-particle fa-solid ${fa}" style="left:${l}%;top:${t}%;font-size:${size.toFixed(1)}px;line-height:1;animation:${anim} ${dur}s linear ${delay}s infinite;color:${color};text-shadow:${shadow};${blur}"></i>`;
    } else {
      const clip = particleClip[shape] || "circle(50%)";
      particles += `<span class="hc-particle" style="left:${l}%;top:${t}%;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;clip-path:${clip};animation:${anim} ${dur}s linear ${delay}s infinite;background:${color};box-shadow:${shadow};${blur}"></span>`;
    }
  }

  let statsHtml = isCox ? `
    <div class="hc-cell"><span class="hc-cell-label">OVR</span><span class="hc-cell-value">${item.ovr}</span></div>
    <div class="hc-cell"><span class="hc-cell-label">Weight</span><span class="hc-cell-value">${item.weight || "--"} lbs</span></div>
    <div class="hc-cell"><span class="hc-cell-label">Class</span><span class="hc-cell-value">${classText}</span></div>
  ` : `
    <div class="hc-cell"><span class="hc-cell-label">2k</span><span class="hc-cell-value">${item.twoK ?? "--"}</span></div>
    <div class="hc-cell"><span class="hc-cell-label hc-power-label">Power</span><span class="hc-cell-value hc-power">${item.power}W</span></div>
    <div class="hc-cell"><span class="hc-cell-label">Class</span><span class="hc-cell-value">${classText}</span></div>
    <div class="hc-cell"><span class="hc-cell-label">Weight</span><span class="hc-cell-value">${item.weight || "--"} lbs</span></div>
  `;

  let dotsHtml = isCox ? `
    <div class="hc-dot-row"><span class="hc-dot-label">Motivation</span><span class="hc-dot-stars">${dotStars(item.motivation)}</span><span class="hc-dot-val">${item.motivation.toFixed(1)}</span></div>
    <div class="hc-dot-row"><span class="hc-dot-label">Strategy</span><span class="hc-dot-stars">${dotStars(item.strategy)}</span><span class="hc-dot-val">${item.strategy.toFixed(1)}</span></div>
    <div class="hc-dot-row"><span class="hc-dot-label">Tech Calls</span><span class="hc-dot-stars">${dotStars(item.tech_calls)}</span><span class="hc-dot-val">${item.tech_calls.toFixed(1)}</span></div>
    <div class="hc-dot-row"><span class="hc-dot-label">Steering</span><span class="hc-dot-stars">${dotStars(item.steering)}</span><span class="hc-dot-val">${item.steering.toFixed(1)}</span></div>
  ` : `
    <div class="hc-dot-row"><span class="hc-dot-label">Port</span><span class="hc-dot-stars">${dotStars(item.port || 0)}</span><span class="hc-dot-val">${(item.port || 0).toFixed(1)}</span></div>
    <div class="hc-dot-row"><span class="hc-dot-label">Star</span><span class="hc-dot-stars">${dotStars(item.starboard || 0)}</span><span class="hc-dot-val">${(item.starboard || 0).toFixed(1)}</span></div>
    <div class="hc-dot-row"><span class="hc-dot-label">Ment</span><span class="hc-dot-stars">${dotStars(item.mentality || 0)}</span><span class="hc-dot-val">${(item.mentality || 0).toFixed(1)}</span></div>
  `;

  return `
    <div class="hc-pattern"></div>
    <div class="hc-particles">${particles}</div>
    <div class="hc-top"><span class="hc-name">${item.name}</span></div>
    <div class="hc-grid">${statsHtml}</div>
    <div class="hc-dots">${dotsHtml}</div>
    <div class="hc-footer"><span class="hc-rarity" style="background:${rs.color}">${rs.icon} ${rs.label}</span></div>
  `;
}

function showHoverCard(item, targetEl, itemType, seatSide) {
  const card = ensureHoverCard();
  const isCox = itemType === 'coxswain';
  const effRarity = isCox ? (item.rarity || "Unknown") : displayRarity(item);
  card.setAttribute("data-rarity", effRarity === "Unknown" ? "unknown" : effRarity);
  card.innerHTML = buildHoverCardHTML(item, itemType, seatSide);
  card.style.display = "block";
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "hcFadeIn 0.2s ease-out forwards";
  positionHoverCardNear(targetEl);
}

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

function hideRowerHoverCard() {
  if (hoverCardEl) {
    hoverCardEl.style.display = "none";
  }
}

function renderBoat(boatKey, containerEl, metaEl) {
  containerEl.innerHTML = "";
  const seats = boats[boatKey];
  let filledCount = 0;

  // Coxswain seat-row
  const coxRow = document.createElement("div");
  coxRow.className = "seat-row";
  const coxLabel = document.createElement("span");
  coxLabel.className = "seat-label";
  coxLabel.textContent = "Coxswain";
  coxRow.appendChild(coxLabel);
  const coxSlot = document.createElement("li");
  coxSlot.className = "seat-slot";
  coxSlot.dataset.boat = boatKey;
  coxSlot.dataset.seatIndex = -1;
  const coxId = boatCoxswains[boatKey];
  if (coxId) {
    coxSlot.classList.add("filled");
    const cox = findCoxswain(coxId);
    if (cox) {
      const card = createCoxswainCard(cox, false);
      coxSlot.appendChild(card);
    }
  } else {
    const ph = document.createElement("span");
    ph.textContent = "Empty seat";
    ph.style.padding = "0 12px";
    ph.style.opacity = "0.4";
    coxSlot.appendChild(ph);
  }
  if (coxId) {
    const removeBtn = document.createElement("button");
    removeBtn.className = "slot-remove";
    removeBtn.innerHTML = "&times;";
    removeBtn.title = "Remove coxswain";
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      boatCoxswains[boatKey] = null;
      renderAll();
    });
    coxSlot.appendChild(removeBtn);
  }
  coxRow.appendChild(coxSlot);
  containerEl.appendChild(coxRow);

  // Rower seat-rows
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
      const seatSide = seatIndex % 2 === 0 ? 'port' : 'starboard';
      const card = createRowerCard(rower, seatSide, false);
      slot.appendChild(card);
      const removeBtn = document.createElement("button");
      removeBtn.className = "slot-remove";
      removeBtn.innerHTML = "&times;";
      removeBtn.title = "Remove rower";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        boats[boatKey][seatIndex] = null;
        renderAll();
      });
      slot.appendChild(removeBtn);
    } else {
      const placeholder = document.createElement("span");
      placeholder.textContent = "Empty seat";
      placeholder.style.padding = "0 12px";
      placeholder.style.opacity = "0.4";
      slot.appendChild(placeholder);
    }

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
  renderCoxswainList();
  renderBoat("boat1", boat1SeatsEl, boat1MetaEl);
  renderBoat("boat2", boat2SeatsEl, boat2MetaEl);
  updateBoatOVR("boat1");
  updateBoatOVR("boat2");
}

// ---------- Helper functions for boat assignment ----------

function removeRowerFromBoats(rowerId) {
  for (const key of ["boat1", "boat2"]) {
    boats[key] = boats[key].map(id => (id === rowerId ? null : id));
  }
}

function removeCoxswainFromBoats(coxId) {
  if (boatCoxswains.boat1 === coxId) boatCoxswains.boat1 = null;
  if (boatCoxswains.boat2 === coxId) boatCoxswains.boat2 = null;
}

// ---------- Assignment popup ----------

function buildMedalsHTML(medals) {
  if (!medals || medals.length === 0) return '<div class="assign-no-medals">No medals</div>';
  return medals.map((m, i) => {
    const cls = m.placement === "Gold" ? "medal-place-gold" : m.placement === "Silver" ? "medal-place-silver" : "medal-place-bronze";
    const icon = m.placement === "Gold" ? '<i class="fa-solid fa-medal"></i>' : m.placement === "Silver" ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-medal"></i>';
    return `<div class="assign-medal-entry" style="animation-delay:${0.15 + i * 0.06}s">
      <span class="medal-year">${m.year}</span>
      <span class="medal-boat">${m.boat}</span>
      <span class="medal-place ${cls}">${icon} ${m.placement}</span>
    </div>`;
  }).join("");
}

function showAssignPopup(item, type) {
  assignPopupData = { item, type };
  const popupEl = document.getElementById("assignPopup");
  popupEl.style.display = "flex";
  const isCox = type === 'coxswain';
  const titleEl = document.getElementById("assignPopupTitle");
  const icon = isCox ? '<i class="fa-solid fa-ear-deaf"></i>' : '<i class="fa-solid fa-person"></i>';
  titleEl.innerHTML = `${icon} ${item.name}`;
  renderAssignPopup();
}

function closeAssignPopup() {
  assignPopupData = null;
  document.getElementById("assignPopup").style.display = "none";
}

function renderAssignPopup() {
  const { item, type } = assignPopupData;
  const body = document.getElementById("assignPopupBody");
  const isCox = type === 'coxswain';

  const effRarity = isCox ? (item.rarity || "Unknown") : displayRarity(item);
  const rarityAttr = effRarity === "Unknown" ? "unknown" : effRarity;
  const hoverHTML = buildHoverCardHTML(item, type);
  const medalsHTML = buildMedalsHTML(item.medals);

  // Left column: hover card + medals
  const leftCol = `
    <div class="assign-left-col">
      <div class="rower-hover-card popup-card-static" data-rarity="${rarityAttr}">${hoverHTML}</div>
      <div class="assign-medals">
        <div class="assign-medals-title"><i class="fa-solid fa-trophy"></i> State Medals</div>
        <div class="assign-medals-list">${medalsHTML}</div>
      </div>
    </div>
  `;

  // Right column: boat panels
  let rightCol = `<div class="assign-right-col${isCox ? ' coxswain-mode' : ''}">`;

  if (type === 'rower') {
    for (const key of ["boat1", "boat2"]) {
      const boatName = key === "boat1" ? "Richard Paul" : "The Challenger";
      const dotClass = key === "boat1" ? "dot-1" : "dot-2";
      const color = key === "boat1" ? "#3fb6ff" : "#ff6b6b";
      rightCol += `<div class="assign-boat-panel">
        <div class="assign-boat-panel-header" style="color:${color}"><span class="boat-dot ${dotClass}"></span> ${boatName}</div>
        <div class="assign-boat-panel-seats">`;
      boats[key].forEach((currentId, i) => {
        const label = seatLabel(i);
        const side = i % 2 === 0 ? "Port" : "Starboard";
        const current = currentId ? findRower(currentId) : null;
        const isCurrent = currentId === item.id;
        const nameDisplay = current ? current.name : "Empty";
        const nameClass = current ? "seat-name-popup" : "seat-name-popup empty";
        const currentBadge = isCurrent ? ' <span class="seat-current-badge"><i class="fa-solid fa-check"></i> Current</span>' : '';
        rightCol += `<button class="assign-seat-btn${isCurrent ? ' current-seat' : ''}" data-boat="${key}" data-seat="${i}">
          <span class="seat-label-popup">${label}</span>
          <span class="seat-side-popup">${side}</span>
          <span class="${nameClass}">${nameDisplay}</span>
          ${currentBadge}
        </button>`;
      });
      rightCol += `</div></div>`;
    }
  } else {
    for (const key of ["boat1", "boat2"]) {
      const boatName = key === "boat1" ? "Richard Paul" : "The Challenger";
      const dotClass = key === "boat1" ? "dot-1" : "dot-2";
      const color = key === "boat1" ? "#3fb6ff" : "#ff6b6b";
      const currentId = boatCoxswains[key];
      const isCurrent = currentId === item.id;
      const nameDisplay = currentId ? (findCoxswain(currentId)?.name || "None") : "None";
      const currentBadge = isCurrent ? ' <span class="seat-current-badge"><i class="fa-solid fa-check"></i> Current</span>' : '';
      rightCol += `<div class="assign-boat-panel">
        <div class="assign-boat-panel-header" style="color:${color}"><span class="boat-dot ${dotClass}"></span> ${boatName}</div>
        <div class="assign-boat-panel-seats">
          <button class="assign-seat-btn${isCurrent ? ' current-seat' : ''}" data-boat="${key}" data-seat="-1">
            <span class="seat-label-popup"><i class="fa-solid fa-ear-deaf"></i></span>
            <span class="seat-side-popup">Coxswain</span>
            <span class="${nameDisplay === 'None' ? 'seat-name-popup empty' : 'seat-name-popup'}">${nameDisplay}</span>
            ${currentBadge}
          </button>
        </div>
      </div>`;
    }
  }

  rightCol += `</div>`;

  body.innerHTML = leftCol + rightCol;

  body.querySelectorAll(".assign-seat-btn[data-boat]").forEach(btn => {
    btn.addEventListener("click", () => {
      const boatKey = btn.dataset.boat;
      const seatIndex = parseInt(btn.dataset.seat);
      if (type === 'rower') {
        removeRowerFromBoats(item.id);
        boats[boatKey][seatIndex] = item.id;
      } else {
        removeCoxswainFromBoats(item.id);
        boatCoxswains[boatKey] = item.id;
      }
      renderAll();
      closeAssignPopup();
    });
  });
}

// ---------- Search ----------

document.getElementById("rowerSearch").addEventListener("input", (e) => {
  rowerSearchTerm = e.target.value;
  renderRosterList();
});
document.getElementById("coxswainSearch").addEventListener("input", (e) => {
  coxswainSearchTerm = e.target.value;
  renderCoxswainList();
});

// ---------- Popup close ----------

document.getElementById("assignPopupClose").addEventListener("click", closeAssignPopup);
document.getElementById("assignPopup").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeAssignPopup();
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
        tension: 0.1,
        fill: true,
        spanGaps: false,
      }],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 10, right: 10 } },
      scales: {
        x: {
          type: 'linear',
          reverse: true,
          min: -35,
          max: 60,
          title: { display: true, text: "angle", color: "#8fa3b3" },
          ticks: { color: "#8fa3b3", stepSize: 5, maxTicksLimit: 25, callback: v => `${v}°` },
          grid: { color: "#1f2c3a" },
        },
        y: {
          title: { display: true, text: "watts", color: "#8fa3b3" },
          ticks: { color: "#8fa3b3" },
          grid: { color: "#1f2c3a" },
          beginAtZero: true,
          max: 2000,
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

  new ResizeObserver(() => {
    speedChart1?.resize();
    speedChart2?.resize();
  }).observe(document.getElementById('panel-telemetry'));
}

let simulation = null;
let rafId = null;
let lastFrameTime = null;
let lastTelemetryUpdate = 0;
let prevStrokeCount1 = 0;
let prevStrokeCount2 = 0;
let prevInWater1 = false;
let prevInWater2 = false;
let hasCatch1 = false;
let hasCatch2 = false;

function resetRaceState() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (simulation) simulation.reset();
  lastFrameTime = null;
  prevStrokeCount1 = 0;
  prevStrokeCount2 = 0;
  prevInWater1 = false;
  prevInWater2 = false;
  hasCatch1 = false;
  hasCatch2 = false;
  marker1.style.left = "0%";
  marker1.style.setProperty('--steer-y', '0px');
  marker1.style.setProperty('--steer-angle', '0deg');
  marker2.style.left = "0%";
  marker2.style.setProperty('--steer-y', '0px');
  marker2.style.setProperty('--steer-angle', '0deg');
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
  stopBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
}

function startRace() {
  if (crewSize("boat1") === 0 && crewSize("boat2") === 0) {
    alert("Assign at least one rower to a boat before starting the race.");
    return;
  }
  if (crewSize("boat1") > 0 && !boatCoxswains.boat1) {
    alert("Richard Paul needs a coxswain before the race can start.");
    return;
  }
  if (crewSize("boat2") > 0 && !boatCoxswains.boat2) {
    alert("The Challenger needs a coxswain before the race can start.");
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
  const b1cox = boatCoxswains.boat1 ? { ...findCoxswain(boatCoxswains.boat1) } : null;
  const b2cox = boatCoxswains.boat2 ? { ...findCoxswain(boatCoxswains.boat2) } : null;
  simulation = new RaceSimulation(b1rowers, b2rowers, b1cox, b2cox);
  simulation.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
  raceStatusEl.textContent = "Racing...";
  raceStatusEl.className = "race-status running";
  lastFrameTime = null;
  rafId = requestAnimationFrame(tickRace);
}

function togglePause() {
  if (!simulation) return;
  if (simulation.running) {
    simulation.pause();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    lastFrameTime = null;
    startBtn.disabled = false;
    stopBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
    raceStatusEl.textContent = "Paused";
  } else {
    simulation.start();
    lastFrameTime = null;
    rafId = requestAnimationFrame(tickRace);
    startBtn.disabled = true;
    stopBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    raceStatusEl.textContent = "Racing...";
    raceStatusEl.className = "race-status running";
  }
}

// Renders the oar stroke animation for a boat marker based on its stroke
// phase (0-1, one full cycle = catch -> drive -> finish -> recovery).
function spawnSplash(markerEl, trackEl) {
  const trackRect = trackEl.getBoundingClientRect();
  const blades = markerEl.querySelectorAll(".oar-blade");
  if (blades.length === 0) return;
  blades.forEach(blade => {
    const r = blade.getBoundingClientRect();
    const cx = (r.left - trackRect.left) + r.width / 2;
    const cy = (r.top - trackRect.top) + r.height / 2;
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "splash-particle";
      const xOff = -(Math.random() * 12 + 4);
      const yOff = (Math.random() - 0.5) * 16;
      const size = 1.5 + Math.random() * 3;
      const dur = 0.2 + Math.random() * 0.3;
      p.style.cssText = `left:${cx + (Math.random() - 0.5) * 10}px;top:${cy + yOff * 0.5}px;--dx:${xOff}px;--dy:${yOff}px;width:${size}px;height:${size}px;animation-duration:${dur}s`;
      trackEl.appendChild(p);
      setTimeout(() => p.remove(), dur * 1000 + 50);
    }
  });
}

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
  const angle = -35 + sweepT * 60;

  oarGroups.forEach((g) => {
    const side = Number(g.dataset.side);
    g.style.transform = `rotate(${side * angle}deg)`;
    g.classList.toggle("in-water", inWater);
  });
}

function tickRace(now) {
  if (!simulation || !simulation.running) return;

  if (lastFrameTime === null) lastFrameTime = now;
  const realDt = Math.min((now - lastFrameTime) / 1000, 0.05);
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

  if (s.boat1.strokeCount !== prevStrokeCount1) {
    prevStrokeCount1 = s.boat1.strokeCount;
    document.getElementById("t1-split").textContent = formatSplit(s.boat1.speed);
  }
  if (s.boat2.strokeCount !== prevStrokeCount2) {
    prevStrokeCount2 = s.boat2.strokeCount;
    document.getElementById("t2-split").textContent = formatSplit(s.boat2.speed);
  }

  const inWater1 = s.boat1.strokePhase < 0.35;
  if (inWater1 !== prevInWater1) {
    if (hasCatch1) spawnSplash(marker1, lane1Track);
    else hasCatch1 = true;
    prevInWater1 = inWater1;
  }
  const inWater2 = s.boat2.strokePhase < 0.35;
  if (inWater2 !== prevInWater2) {
    if (hasCatch2) spawnSplash(marker2, lane2Track);
    else hasCatch2 = true;
    prevInWater2 = inWater2;
  }

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
  stopBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';

  const s = simulation ? simulation.getState() : null;
  let msg = "Finished";
  if (s) {
    const t1 = s.boat1.finishDisplayTime;
    const t2 = s.boat2.finishDisplayTime;
    if (t1 !== null && t2 !== null) {
      msg = t1 < t2 ? `<i class="fa-solid fa-trophy"></i> Richard Paul wins (${formatRealTime(t1)})` : (t2 < t1 ? `<i class="fa-solid fa-trophy"></i> The Challenger wins (${formatRealTime(t2)})` : "Photo finish - tie!");
    } else if (t1 !== null) {
      msg = '<i class="fa-solid fa-trophy"></i> Richard Paul wins!';
    } else if (t2 !== null) {
      msg = '<i class="fa-solid fa-trophy"></i> The Challenger wins!';
    }
  }
  raceStatusEl.innerHTML = msg;
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
  document.getElementById("t1-steer").textContent = ((state.boat1.headingAngle || 0) * (180 / Math.PI)).toFixed(1) + "°";
  document.getElementById("t2-steer").textContent = ((state.boat2.headingAngle || 0) * (180 / Math.PI)).toFixed(1) + "°";
}

function updateCourseMarkers(state) {
  const finishPct = getBowFinishPct();
  const pct1 = Math.min(100, (state.boat1.distance / 750) * finishPct);
  const pct2 = Math.min(100, (state.boat2.distance / 750) * finishPct);
  const boatWidthPx = 92;
  marker1.style.left = `calc(${pct1}% - ${(pct1 / 100) * boatWidthPx}px)`;
  marker2.style.left = `calc(${pct2}% - ${(pct2 / 100) * boatWidthPx}px)`;
  const yOffset1 = ((state.boat1.centerY || 0) * 8);
  const yOffset2 = ((state.boat2.centerY || 0) * 8);
  marker1.style.setProperty('--steer-y', `${yOffset1.toFixed(1)}px`);
  marker2.style.setProperty('--steer-y', `${yOffset2.toFixed(1)}px`);
  const angle1 = ((state.boat1.headingAngle || 0) * (180 / Math.PI));
  const angle2 = ((state.boat2.headingAngle || 0) * (180 / Math.PI));
  marker1.style.setProperty('--steer-angle', `${angle1.toFixed(1)}deg`);
  marker2.style.setProperty('--steer-angle', `${angle2.toFixed(1)}deg`);
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
    const avgWeight = data.reduce((s, r) => s + (r.weight || 0), 0) / data.length;
    const modClass = avgMod >= 0 ? "rt-tech-pos" : "rt-tech-neg";

    const avgRow = `<tr class="rt-avg-row">
      <td>Avg</td><td></td>
      <td>${avgWeight.toFixed(1)}</td>
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
        <td>${rd.weight || 0}</td>
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
stopBtn.addEventListener("click", togglePause);
resetBtn.addEventListener("click", resetRaceState);

document.querySelectorAll(".btn-lineup").forEach(btn => {
  btn.addEventListener("click", () => {
    const boatKey = btn.dataset.boat;
    showLineupPopup(boatKey);
  });
});

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
  loadCoxswains();
  loadLineups();
  seedDefaultBoats();
  renderAll();
  initChart();
  resetRaceState();
}

init();

