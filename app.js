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

let raceTelemetry = null;

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
    individualAwards: record.individualAwards || [],
    captain: record.captain || false,
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
    individualAwards: record.individualAwards || [],
    captain: record.captain || false,
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
  const ovrs = [];
  seatIds.forEach((id, i) => {
    if (!id) return;
    const r = findRower(id);
    if (!r) return;
    const side = i % 2 === 0 ? 'port' : 'starboard';
    ovrs.push(computeOVR(r, side));
  });
  if (ovrs.length === 0) return null;
  const avgAll = ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
  const top3 = [...ovrs].sort((a, b) => b - a).slice(0, 3);
  const avgTop3 = top3.reduce((a, b) => a + b, 0) / top3.length;
  let coxOVR = 0;
  const coxId = boatCoxswains[boatKey];
  if (coxId) {
    const cox = findCoxswain(coxId);
    if (cox) coxOVR = computeCOXR(cox);
  }
  const boatOVR = avgAll * 0.70 + avgTop3 * 0.18 + coxOVR * 0.12;
  return Math.round(Math.max(40, Math.min(99, boatOVR)));
}

function updateBoatOVR(boatKey) {
  const el = document.getElementById(boatKey === 'boat1' ? 'boat1Ovr' : 'boat2Ovr');
  const ovr = computeBoatOVR(boatKey);
  el.textContent = ovr !== null ? `OVR: ${ovr}` : 'OVR: --';
}

function updateBoatStats(boatKey) {
  const el = document.getElementById(boatKey === 'boat1' ? 'boat1Stats' : 'boat2Stats');
  const seatIds = boats[boatKey];
  const rowers = seatIds.map(id => findRower(id)).filter(Boolean);
  let avg2k = 0, avgWeight = 0, avgPort = 0, avgStarboard = 0, chemistry = 0, ovr = null;
  if (rowers.length >= 2) {
    avg2k = rowers.reduce((s, r) => s + (parseScoreToSeconds(r.twoK) || 0), 0) / rowers.length;
    avgWeight = rowers.reduce((s, r) => s + (r.weight || 0), 0) / rowers.length;
    let portTech = 0, starboardTech = 0, portCount = 0, starboardCount = 0;
    seatIds.forEach((id, i) => {
      const r = findRower(id);
      if (!r) return;
      if (i % 2 === 0) { portTech += r.port || 0; portCount++; }
      else { starboardTech += r.starboard || 0; starboardCount++; }
    });
    avgPort = portCount > 0 ? portTech / portCount : 0;
    avgStarboard = starboardCount > 0 ? starboardTech / starboardCount : 0;
    chemistry = computeChemistry(rowers);
    ovr = computeBoatOVR(boatKey);
  }
  const avg2kStr = avg2k > 0 ? formatSecondsToTime(avg2k) : '--:--';
  el.innerHTML = `
    <div class="bs-cell"><span class="bs-label">OVR</span><span class="bs-value">${ovr !== null ? ovr : '--'}</span></div>
    <div class="bs-cell"><span class="bs-label">2k</span><span class="bs-value bs-2k">${avg2kStr}</span></div>
    <div class="bs-cell"><span class="bs-label">Wt</span><span class="bs-value">${rowers.length >= 2 ? avgWeight.toFixed(1) : '--'}</span></div>
    <div class="bs-cell"><span class="bs-label">Port</span><span class="bs-value">${rowers.length >= 2 ? avgPort.toFixed(1) : '--'}</span></div>
    <div class="bs-cell"><span class="bs-label">Star</span><span class="bs-value">${rowers.length >= 2 ? avgStarboard.toFixed(1) : '--'}</span></div>
    <div class="bs-cell"><span class="bs-label">Chem</span><span class="bs-value">${rowers.length >= 2 ? chemistry + '%' : '--'}</span></div>
  `;
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
    const filtered = lineups
      .filter(l => l.rowers && l.rowers.length === SEATS_PER_BOAT)
      .filter(l => !term || l.name.toLowerCase().includes(term) || String(l.year).includes(term));
    body.innerHTML = filtered.map((l, i) => {
        const origIdx = lineups.indexOf(l);
        const ovr = computeLineupOVR(l);
        const ovrRarity = rarityFromOVR(ovr);
        const rs = rarityStyle(ovrRarity);
        return `
        <button class="lineup-option" data-idx="${origIdx}">
          <div class="lineup-option-text">
            <span class="lineup-option-name"><span class="medal-year">${l.year}</span> <span class="medal-boat">${l.name}</span></span>
            <span class="lineup-option-detail">${(l.rowers || []).length} rowers${l.coxswain ? ' <i class="fa-solid fa-circle dot-sep"></i> ' + l.coxswain : ''}</span>
          </div>
          <span class="lineup-option-ovr" style="background:${rs.color}">${ovr}</span>
        </button>`;
      }).join("") || '<div class="lineup-empty">No lineups found</div>';

    body.querySelectorAll(".lineup-option").forEach(btn => {
      const idx = parseInt(btn.dataset.idx);
      const lineup = lineups[idx];
      btn.addEventListener("click", () => {
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
        _replaySeatStagger(boatKey);
      });
      btn.addEventListener("mouseenter", (e) => {
        if (lineup) showLineupHoverCard(lineup, e.currentTarget);
      });
      btn.addEventListener("mouseleave", hideLineupHoverCard);
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

function randomizeBoat(boatKey) {
  const otherKey = boatKey === 'boat1' ? 'boat2' : 'boat1';
  const otherIds = new Set(boats[otherKey].filter(Boolean));
  const available = rowers.filter(r => r.twoK != null && !otherIds.has(r.id));
  if (available.length < 8) {
    showAlertPopup("Not enough rowers available to fill the boat.");
    return;
  }
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  boats[boatKey] = shuffled.slice(0, 8).map(r => r.id);
  const coxIndex = Math.floor(Math.random() * coxswains.length);
  boatCoxswains[boatKey] = coxswains[coxIndex].id;
  renderAll();
  _replaySeatStagger(boatKey);
}

function computeCOXR(c) {
  const ws = 0.28 * (c.motivation || 0)
           + 0.18 * (c.strategy || 0)
           + 0.14 * (c.tech_calls || 0)
           + 0.35 * (c.steering || 0);
  const base = 18 * ws + 9 + 4 * Math.pow(Math.max(0, ws - 4), 2);
  const adj = (105 - (c.weight || 105)) / 10;
  const bonus = computeMedalBonus(c.name, 'coxswain') + computeIndividualAwardBonus(c) + (c.captain ? 1 : 0);
  return Math.round(base + adj + bonus);
}

function computeLineupStats(lineup) {
  const rowers = lineup.rowers.map(name => findRowerByName(name)).filter(Boolean);
  if (rowers.length === 0) return null;
  const avg2k = rowers.reduce((s, r) => s + (parseScoreToSeconds(r.twoK) || 0), 0) / rowers.length;
  const avgWeight = rowers.reduce((s, r) => s + (r.weight || 0), 0) / rowers.length;
  let portTech = 0, starboardTech = 0, portCount = 0, starboardCount = 0;
  lineup.rowers.forEach((name, i) => {
    const r = findRowerByName(name);
    if (!r) return;
    if (i % 2 === 0) { portTech += r.port || 0; portCount++; }
    else { starboardTech += r.starboard || 0; starboardCount++; }
  });
  const avgPort = portCount > 0 ? portTech / portCount : 0;
  const avgStarboard = starboardCount > 0 ? starboardTech / starboardCount : 0;
  let chemistry = 0;
  if (rowers.length >= 2) chemistry = computeChemistry(rowers);
  return { avg2k, avgWeight, avgPort, avgStarboard, chemistry, count: rowers.length };
}

function computeChemistry(rowers) {
  const years = rowers.map(r => r.year);
  let totalDiff = 0, pairs = 0;
  for (let i = 0; i < years.length; i++) {
    for (let j = i + 1; j < years.length; j++) {
      totalDiff += Math.abs(years[i] - years[j]);
      pairs++;
    }
  }
  const avgDiff = pairs > 0 ? totalDiff / pairs : 0;
  let classBonus;
  if (avgDiff <= 0) classBonus = 20;
  else if (avgDiff <= 0.5) classBonus = 17 + (0.5 - avgDiff) / 0.5 * 3;
  else if (avgDiff <= 1.0) classBonus = 14 + (1.0 - avgDiff) / 0.5 * 3;
  else if (avgDiff <= 1.5) classBonus = 10 + (1.5 - avgDiff) / 0.5 * 4;
  else if (avgDiff <= 2.0) classBonus = 6 + (2.0 - avgDiff) / 0.5 * 4;
  else if (avgDiff <= 3.0) classBonus = (3.0 - avgDiff) / 1.0 * 6;
  else classBonus = 0;
  const names = rowers.map(r => r.name);
  let maxOverlap = 0;
  for (const l of lineups) {
    if (!l.rowers) continue;
    const matching = l.rowers.filter(n => names.includes(n)).length;
    const overlap = Math.min(matching, 8) / 8;
    if (overlap > maxOverlap) maxOverlap = overlap;
  }
  return Math.min(100, Math.round(classBonus + 80 * maxOverlap));
}

function formatSecondsToTime(secs) {
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(1).padStart(4, "0");
  return m + ":" + s;
}

function computeLineupOVR(lineup) {
  if (!lineup || !lineup.rowers || lineup.rowers.length === 0) return 0;
  const ovrs = [];
  lineup.rowers.forEach((name, i) => {
    const r = findRowerByName(name);
    if (!r) return;
    const side = i % 2 === 0 ? 'port' : 'starboard';
    ovrs.push(computeOVR(r, side));
  });
  if (ovrs.length === 0) return 0;
  const avgAll = ovrs.reduce((a, b) => a + b, 0) / ovrs.length;
  const top3 = [...ovrs].sort((a, b) => b - a).slice(0, 3);
  const avgTop3 = top3.reduce((a, b) => a + b, 0) / top3.length;
  let coxOVR = 0;
  if (lineup.coxswain) {
    const cox = findCoxswainByName(lineup.coxswain);
    if (cox) coxOVR = computeCOXR(cox);
  }
  const boatOVR = avgAll * 0.70 + avgTop3 * 0.18 + coxOVR * 0.12;
  return Math.round(Math.max(40, Math.min(99, boatOVR)));
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
const resultsBtn = document.getElementById("resultsBtn");


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
function buildBoatSVG(uid, colorMain, colorDark, colorBlade) {
  const hullTopY = 38;
  const hullBottomY = 52;
  const oarLength = 26;

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
          <line class="oar-shaft" x1="${cx}" y1="${oarlockY}" x2="${cx - 2}" y2="${tipY}" />
          <rect class="oar-blade" x="${cx - 5}" y="${direction === -1 ? tipY - 9 : tipY}" width="9" height="9" rx="2.2" style="transform-origin: ${cx - 0.5}px ${direction === -1 ? tipY - 4.5 : tipY + 4.5}px;" />
        </g>`;
    }
    return oars;
  };

  // 8 interleaved crew dots, stern (left) to bow (right), matching oar geometry
  let rowerDots = "";
  for (let i = 0; i < 8; i++) {
    const x = 20 + Math.floor(i / 2) * 22 + (i % 2 === 1 ? 8 : 0);
    rowerDots += `<circle class="rower-dot" data-seat="${i}" cx="${x}" cy="45" r="3" />`;
  }

  // Rigger struts from hull edge out to the oarlocks
  let riggers = "";
  for (let i = 0; i < 4; i++) {
    const cxT = 20 + i * 22, cxB = 28 + i * 22;
    riggers += `<line class="rigger" x1="${cxT}" y1="${hullTopY}" x2="${cxT}" y2="${hullTopY - 3}" />`;
    riggers += `<line class="rigger" x1="${cxB}" y1="${hullBottomY}" x2="${cxB}" y2="${hullBottomY + 3}" />`;
  }

  return `
    <svg class="boat-svg" viewBox="-20 -40 140 170" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hullG-${uid}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${colorDark}"/>
          <stop offset="42%" stop-color="${colorMain}"/>
          <stop offset="100%" stop-color="${colorMain}" stop-opacity="0.92"/>
        </linearGradient>
        <linearGradient id="deckG-${uid}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42"/>
          <stop offset="55%" stop-color="#ffffff" stop-opacity="0.12"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.02"/>
        </linearGradient>
        <radialGradient id="glowG-${uid}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${colorMain}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${colorMain}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="wakeG-${uid}" cx="88%" cy="50%" r="85%">
          <stop offset="0%" stop-color="#e6f6ff" stop-opacity="0.55"/>
          <stop offset="55%" stop-color="#a5dcff" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#a5dcff" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <ellipse class="boat-glow" cx="57" cy="45" rx="54" ry="14" fill="url(#glowG-${uid})"/>
      <path class="wake-ribbon" d="M14 41 C -6 40, -34 41, -62 44 C -34 47, -6 50, 14 49 Z" fill="url(#wakeG-${uid})"/>
      <ellipse class="boat-shadow" cx="57" cy="47.5" rx="48" ry="8.5" fill="#020814" opacity="0.5"/>

      <g class="oars oars-top">${oarSide(-1)}</g>
      <g class="oars oars-bottom">${oarSide(1)}</g>
      ${riggers}

      <path class="hull" d="M100 45 C100 41, 96 ${hullTopY}, 90 ${hullTopY} L22 ${hullTopY} C17 ${hullTopY}, 14 41, 14 45 C14 49, 17 ${hullBottomY}, 22 ${hullBottomY} L90 ${hullBottomY} C96 ${hullBottomY}, 100 49, 100 45 Z"
        fill="url(#hullG-${uid})" stroke="${colorDark}" stroke-width="1.6" />
      <line class="deck-line" x1="19" y1="45" x2="95" y2="45" stroke="url(#deckG-${uid})" stroke-width="3.4" />
      <path class="hull-highlight" d="M22 40.6 L88 40.6" stroke="#ffffff" stroke-opacity="0.38" stroke-width="1.1" fill="none" />
      <path class="bow-flash" d="M92.5 39.8 L98.5 45 L92.5 50.2" fill="none" stroke="#ffffff" stroke-opacity="0.65" stroke-width="1.5" />

      <g class="crew">${rowerDots}</g>
      <circle class="cox-dot" cx="16.8" cy="45" r="2.6" />
    </svg>
  `;
}

marker1.innerHTML = '<div class="boat-inner">' + buildBoatSVG("b1", "#42d4ff", "#0d79b8", "#8fe8ff") + "</div>";
marker2.innerHTML = '<div class="boat-inner">' + buildBoatSVG("b2", "#ff5f7e", "#b8324e", "#ff9db0") + "</div>";

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
    .filter(r => r.twoK != null && r.port != null && r.starboard != null && r.mentality != null && r.rarity != null)
    .filter(r => !term || r.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((r, i) => { const card = createRowerCard(r); card.style.setProperty("--i", Math.min(i, 26)); rowerListEl.appendChild(card); });
}

function shortName(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return parts[0][0].toUpperCase() + ". " + parts.slice(1).join(" ");
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
    <span class="rower-name">${shortName(rower.name)}</span>
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
    .filter(c => c.motivation != null && c.strategy != null && c.tech_calls != null && c.steering != null && c.rarity != null)
    .filter(c => !term || c.name.toLowerCase().includes(term))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((c, i) => { const card = createCoxswainCard(c); card.style.setProperty("--i", Math.min(i, 12)); coxswainListEl.appendChild(card); });
}

function createCoxswainCard(coxswain, clickable) {
  const li = document.createElement("li");
  li.className = "rower-card";
  li.dataset.coxswainId = coxswain.id;
  const rs = rarityStyle(coxswain.rarity || "Unknown");
  li.dataset.rarity = coxswain.rarity || "unknown";
  li.innerHTML = `
    <span class="rc-ovr">${coxswain.ovr}</span>
    <span class="rower-name">${shortName(coxswain.name)}</span>
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
let lineupHoverCardEl = null;

function ensureLineupHoverCard() {
  if (!lineupHoverCardEl) {
    lineupHoverCardEl = document.createElement("div");
    lineupHoverCardEl.className = "lineup-hover-card";
    document.body.appendChild(lineupHoverCardEl);
  }
  return lineupHoverCardEl;
}

function buildLineupHoverCardHTML(lineup, effRarity) {
  const stats = computeLineupStats(lineup);
  if (!stats) return '<div class="hc-top"><span class="hc-name">Incomplete lineup</span></div>';
  const avg2kStr = formatSecondsToTime(stats.avg2k);
  const rs = rarityStyle(effRarity);
  const particles = buildParticlesHTML(effRarity);
  let medalsHtml = "";
  if (lineup.medals && lineup.medals.length) {
    medalsHtml = '<div class="hc-medals">' + lineup.medals.map(m => {
      const cls = m.placement === "Gold" ? "medal-place-gold" : m.placement === "Silver" ? "medal-place-silver" : "medal-place-bronze";
      return `<span class="hc-medal ${cls}">${m.placement}</span>`;
    }).join("") + '</div>';
  }
  return `
    <div class="hc-pattern"></div>
    <div class="hc-particles">${particles}</div>
    <div class="hc-top"><span class="hc-name">${lineup.name} ${lineup.year}</span>${medalsHtml}</div>
    <div class="hc-grid">
      <div class="hc-cell"><span class="hc-cell-label">Avg 2k</span><span class="hc-cell-value hc-2k">${avg2kStr}</span></div>
      <div class="hc-cell"><span class="hc-cell-label">Avg Wt</span><span class="hc-cell-value">${stats.avgWeight.toFixed(1)} lbs</span></div>
      <div class="hc-cell"><span class="hc-cell-label">Chem</span><span class="hc-cell-value">${stats.chemistry}%</span></div>
    </div>
    <div class="hc-dots">
      <div class="hc-dot-row"><span class="hc-dot-label">Port Tech</span><span class="hc-dot-stars">${dotStars(stats.avgPort)}</span><span class="hc-dot-val">${stats.avgPort.toFixed(1)}</span></div>
      <div class="hc-dot-row"><span class="hc-dot-label">Star Tech</span><span class="hc-dot-stars">${dotStars(stats.avgStarboard)}</span><span class="hc-dot-val">${stats.avgStarboard.toFixed(1)}</span></div>
    </div>
    <div class="hc-footer"><span class="hc-rarity" style="background:${rs.color}">${rs.icon} ${rs.label}</span></div>
  `;
}

function showLineupHoverCard(lineup, targetEl) {
  const card = ensureLineupHoverCard();
  const ovr = computeLineupOVR(lineup);
  const effRarity = rarityFromOVR(ovr);
  card.setAttribute("data-rarity", effRarity);
  card.innerHTML = buildLineupHoverCardHTML(lineup, effRarity);
  card.style.display = "block";
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "hcFadeIn 0.2s ease-out forwards";
  const rect = targetEl.getBoundingClientRect();
  const popupRect = targetEl.closest('.lineup-popup')?.getBoundingClientRect();
  if (popupRect && rect.right + card.offsetWidth + 20 > popupRect.right) {
    card.style.left = (rect.left - card.offsetWidth - 10) + "px";
  } else {
    card.style.left = (rect.right + 10) + "px";
  }
  card.style.top = Math.max(4, rect.top) + "px";
}

function hideLineupHoverCard() {
  if (lineupHoverCardEl) lineupHoverCardEl.style.display = "none";
}

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
  "Generational": { color: "#ff2020", label: "Generational", icon: '<i class="fa-solid fa-gem"></i>' },
  "Freak": { color: "#ff9f43", label: "Freak", icon: '<i class="fa-solid fa-star"></i>' },
  "Pretty Good": { color: "#a359ff", label: "Pretty Good", icon: '<i class="fa-solid fa-square"></i>' },
  "Mid": { color: "#4ade80", label: "Mid", icon: '<i class="fa-solid fa-play tri-up"></i>' },
  "Noob": { color: "#8fa3b3", label: "Noob", icon: '<i class="fa-solid fa-circle"></i>' },
};

function rarityStyle(rarity) {
  return RARITY_STYLES[rarity] || { color: "#5a6b7c", label: rarity || "Unknown", icon: '<i class="fa-solid fa-question"></i>' };
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

function computeMedalBonus(name, type) {
  const medals = getMedalsForPerson(name, type);
  let gold = 0, silver = 0, bronze = 0;
  medals.forEach(m => {
    if (m.placement === "Gold") gold++;
    else if (m.placement === "Silver") silver++;
    else if (m.placement === "Bronze") bronze++;
  });
  return Math.min(4, 1.5 * gold + 1.0 * silver + 0.5 * bronze);
}

function computeIndividualAwardBonus(person) {
  const awards = person.individualAwards || [];
  let total = 0;
  awards.forEach(a => {
    if (a.award === "First Team") total += 1.5;
    else if (a.award === "Second Team") total += 1;
    else if (a.award === "Honorable Mention") total += 0.5;
    else if (a.award === "Most Valuable Player") total += 1;
    else if (a.award === "Hammer") total += 1;
  });
  return Math.min(3, total);
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
  const base = 0.50 * R2k + 0.25 * RTech + 0.15 * RPW + 0.10 * RMental;
  const bonus = computeMedalBonus(rower.name, 'rower') + computeIndividualAwardBonus(rower) + (rower.captain ? 1 : 0);
  return Math.round(base + bonus);
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
      html += `<span class="hc-dot partial" style="--p:${pct}%"></span>`;
    } else {
      html += `<span class="hc-dot"></span>`;
    }
  }
  return html;
}

const shapeFA = { heart: "fa-heart", star: "fa-star", triangle: "fa-play", square: "fa-square", circle: "fa-circle" };
const particleClip = { triangle: "polygon(50% 0%, 0% 100%, 100% 100%)", square: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)", circle: "circle(50%)" };
const particleCfg = {
  "Generational": { count: 18, sizes: [5, 14], anims: ["hc-rise","hc-rise-drift","hc-rise-spin"], glow: true, shape: "heart", icon: true },
  "Freak":        { count: 12, sizes: [4, 12], anims: ["hc-rise","hc-rise-drift"], glow: true, shape: "star", icon: true },
  "Pretty Good":  { count: 8,  sizes: [3, 9],  anims: ["hc-rise","hc-rise-drift"], glow: false, shape: "mixed", icon: false },
  "Mid":          { count: 5,  sizes: [3, 7],  anims: ["hc-rise"], glow: false, shape: "circle", icon: false },
  "Noob":         { count: 3,  sizes: [3, 5],  anims: ["hc-rise"], glow: false, shape: "circle", icon: false },
};
const genColors = ["#ff2020","#ff3333","#ff4444","#ff5555","#cc0000","#dd1111","#ee2222","#ff1111","#dd2222","#ff6666"];

function buildParticlesHTML(effRarity) {
  const cfg = particleCfg[effRarity] || { count: 0, sizes: [3, 4], anims: ["hc-rise"], glow: false, shape: "circle", icon: false };
  const rs = rarityStyle(effRarity);
  let html = "";
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
      html += `<i class="hc-particle fa-solid ${fa}" style="left:${l}%;top:${t}%;font-size:${size.toFixed(1)}px;line-height:1;animation:${anim} ${dur}s linear ${delay}s infinite;color:${color};text-shadow:${shadow};${blur}"></i>`;
    } else {
      const clip = particleClip[shape] || "circle(50%)";
      html += `<span class="hc-particle" style="left:${l}%;top:${t}%;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;clip-path:${clip};animation:${anim} ${dur}s linear ${delay}s infinite;background:${color};box-shadow:${shadow};${blur}"></span>`;
    }
  }
  return html;
}

function buildHoverCardHTML(item, itemType, seatSide) {
  const isCox = itemType === 'coxswain';
  const effRarity = isCox ? (item.rarity || "Unknown") : displayRarity(item);
  const rs = rarityStyle(effRarity);
  const classText = item.year != null ? `Class of ${item.year}` : "--";

  const particles = buildParticlesHTML(effRarity);

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
    <div class="hc-top">
      <span class="hc-name">${item.name}</span>
      ${item.captain ? '<span class="hc-captain-badge">Captain</span>' : ''}
    </div>
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
  hideLineupHoverCard();
  updateBoatStats("boat1");
  updateBoatStats("boat2");
  updateWinProbs();
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

function buildIndividualAwardsHTML(awards) {
  if (!awards || awards.length === 0) return '<div class="assign-no-medals">No individual awards</div>';
  const sorted = [...awards].sort((a, b) => b.year - a.year);
  return sorted.map((a, i) => {
    const cls = a.award === "First Team" || a.award === "Most Valuable Player" || a.award === "Hammer"
      ? "medal-place-gold"
      : a.award === "Second Team"
        ? "medal-place-silver"
        : "medal-place-bronze";
    const icon = a.award === "Most Valuable Player" ? '<i class="fa-solid fa-crown"></i>'
      : a.award === "Hammer" ? '<i class="fa-solid fa-gavel"></i>'
      : '<i class="fa-solid fa-star"></i>';
    return `<div class="assign-medal-entry" style="animation-delay:${0.15 + i * 0.06}s">
      <span class="medal-year">${a.year}</span>
      <span class="medal-place ${cls}">${icon} ${a.award}</span>
    </div>`;
  }).join("");
}

function buildLineupsHTML(name, type) {
  if (!lineups || lineups.length === 0) return '<div class="assign-no-lineups">No lineups available</div>';
  const rowerLineups = type === 'rower'
    ? lineups.filter(l => l.rowers && l.rowers.length === SEATS_PER_BOAT && l.rowers.includes(name))
    : lineups.filter(l => l.rowers && l.rowers.length === SEATS_PER_BOAT && l.coxswain === name);
  if (rowerLineups.length === 0) return '<div class="assign-no-lineups">Not in any lineup</div>';
  return rowerLineups.map((l, i) => {
    return `<div class="assign-lineup-entry" style="animation-delay:${0.15 + i * 0.06}s">
      <span class="medal-year">${l.year}</span>
      <span class="medal-boat lineup-name">${l.name}</span>
    </div>`;
  }).join("");
}

function getMedalsForPerson(name, type) {
  if (!lineups) return [];
  const matching = type === 'rower'
    ? lineups.filter(l => l.rowers && l.rowers.includes(name))
    : lineups.filter(l => l.coxswain === name);
  const medals = [];
  matching.forEach(l => {
    if (l.medals) {
      l.medals.forEach(m => {
        medals.push({ year: m.year, placement: m.placement, boat: l.name });
      });
    }
  });
  return medals;
}

function showAlertPopup(message) {
  const overlay = document.createElement("div");
  overlay.className = "alert-overlay";
  const popup = document.createElement("div");
  popup.className = "alert-popup";
  popup.innerHTML = `
    <div class="alert-popup-body">${message}</div>
    <button class="alert-popup-btn">OK</button>
  `;
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  popup.querySelector(".alert-popup-btn").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

function showAssignPopup(item, type) {
  assignPopupData = { item, type };
  const popupEl = document.getElementById("assignPopup");
  popupEl.style.display = "flex";
  const isCox = type === 'coxswain';
  const effRarity = isCox ? (item.rarity || "Unknown") : displayRarity(item);
  const rs = rarityStyle(effRarity);
  popupEl.style.setProperty('--rarity-glow', rs.color);
  const titleEl = document.getElementById("assignPopupTitle");
  const icon = isCox ? '<i class="fa-solid fa-ear-deaf"></i>' : '<i class="fa-solid fa-person"></i>';
  titleEl.innerHTML = `${icon} ${item.name}`;
  renderAssignPopup();
}

function _replaySeatStagger(boatKey) {
  const el = boatKey === "boat1" ? boat1SeatsEl : boat2SeatsEl;
  if (!el) return;
  el.classList.remove("replay-stagger");
  void el.offsetWidth;
  el.classList.add("replay-stagger");
  setTimeout(() => el.classList.remove("replay-stagger"), 950);
}

function _flashSeat(boatKey, seatIndex) {
  const el = document.querySelector(`.seat-slot[data-boat="${boatKey}"][data-seat-index="${seatIndex}"]`);
  if (!el) return;
  el.classList.add("seat-pop");
  setTimeout(() => el.classList.remove("seat-pop"), 700);
}

function closeAssignPopup() {
  assignPopupData = null;
  const popupEl = document.getElementById("assignPopup");
  popupEl.style.display = "none";
  popupEl.style.removeProperty('--rarity-glow');
}

function renderAssignPopup() {
  const { item, type } = assignPopupData;
  const body = document.getElementById("assignPopupBody");
  const isCox = type === 'coxswain';

  const effRarity = isCox ? (item.rarity || "Unknown") : displayRarity(item);
  const rarityAttr = effRarity === "Unknown" ? "unknown" : effRarity;
  const hoverHTML = buildHoverCardHTML(item, type);
  const medalsHTML = buildMedalsHTML(getMedalsForPerson(item.name, type));
  const individualAwardsHTML = buildIndividualAwardsHTML(item.individualAwards);
  const lineupsHTML = buildLineupsHTML(item.name, type);

  // Left column: hover card only
  const leftCol = `
    <div class="assign-left-col">
      <div class="rower-hover-card popup-card-static" data-rarity="${rarityAttr}">${hoverHTML}</div>
    </div>
  `;

  // Right column: sections + boat panels
  let rightCol = `<div class="assign-right-col${isCox ? ' coxswain-mode' : ''}">`;

  rightCol += `
    <div class="assign-right-sections">
      <div class="assign-medals">
        <div class="assign-medals-title"><i class="fa-solid fa-trophy"></i> State Medals</div>
        <div class="assign-medals-list">${medalsHTML}</div>
      </div>
      <div class="assign-medals">
        <div class="assign-medals-title"><i class="fa-solid fa-award"></i> Individual Awards</div>
        <div class="assign-medals-list">${individualAwardsHTML}</div>
      </div>
      <div class="assign-lineups">
        <div class="assign-lineups-title"><i class="fa-solid fa-people-group"></i> Lineups</div>
        <div class="assign-lineups-list">${lineupsHTML}</div>
      </div>
    </div>
  `;

  rightCol += `<div class="assign-right-boats">`;
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
  rightCol += `</div>`;  // close assign-right-boats

  rightCol += `</div>`;  // close assign-right-col

  body.innerHTML = leftCol + rightCol;

  body.querySelectorAll(".assign-seat-btn[data-boat]").forEach(btn => {
    btn.addEventListener("click", () => {
      const boatKey = btn.dataset.boat;
      const seatIndex = parseInt(btn.dataset.seat);
      if (type === 'rower') {
        boats[boatKey][seatIndex] = item.id;
      } else {
        boatCoxswains[boatKey] = item.id;
      }
      renderAll();
      closeAssignPopup();
      _flashSeat(boatKey, seatIndex);
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

function _hexToRgb(hex) {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function buildChart(canvasId, lineColor) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  const rgb = _hexToRgb(lineColor);
  const grad = ctx.createLinearGradient(0, 0, 0, 230);
  grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},0.42)`);
  grad.addColorStop(0.55, `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`);
  grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0.01)`);
  const tickColor = "#71809a";
  const gridColor = "rgba(126,166,255,0.08)";
  const axisFont = { family: "'Space Grotesk', sans-serif", size: 10, weight: "600" };
  return new Chart(ctx, {
    type: "line",
    data: {
      datasets: [{
        label: "Watts",
        data: [],
        borderColor: lineColor,
        backgroundColor: grad,
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
          title: { display: true, text: "catch angle", color: tickColor, font: axisFont },
          ticks: { color: tickColor, stepSize: 5, maxTicksLimit: 25, font: axisFont, callback: v => `${v}\u00b0` },
          grid: { color: gridColor },
          border: { color: "rgba(126,166,255,0.16)" },
        },
        y: {
          title: { display: true, text: "watts", color: tickColor, font: axisFont },
          ticks: { color: tickColor, font: axisFont },
          grid: { color: gridColor },
          border: { color: "rgba(126,166,255,0.16)" },
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
  speedChart1 = buildChart("speedChart1", "#38d1ff");
  speedChart2 = buildChart("speedChart2", "#ff5470");

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
let popupScheduled = false;

const commentary = {
  log: [],
  _boat1PrevX: 0,
  _boat2PrevX: 0,
  _commentedStart: false,
  _commentedMove1: false,
  _commentedMove2: false,
  _commentedSprint1: false,
  _commentedSprint2: false,
  _commentedEval: false,
  _lastCommentaryTime: 0,
  _lastAnyTime: 0,
  _lastStrokeTime: 0,
  _lastGapTime: 0,
  _lastTechTime: 0,
  _lastFillerTime: 0,
  _lastSteerTime: 0,
  _lastOvertakeTime: 0,
  _overtakeNotedAhead: null,
  _addedThisFrame: false,
  _commentedCheckpoints: {},
  _prevGap: 0,
  _prevFinish1: false,
  _prevFinish2: false,
  _commentedVictory: false,
  add(type, text) {
    this.log.push({ type, text, time: Date.now() });
    this._addedThisFrame = true;
    this._lastCommentaryTime = Date.now();
    this._lastAnyTime = Date.now();
    const feed = document.getElementById("commentaryFeed");
    if (!feed) return;
    const items = this.log.slice(-25).reverse().map(e =>
      `<div class="commentary-entry commentary-${e.type}">${e.text}</div>`
    ).join("");
    feed.innerHTML = items;
  },
  canAdd(minGap) {
    return Date.now() - this._lastCommentaryTime >= (minGap || 2500);
  },
  canAddMinor() {
    return Date.now() - this._lastAnyTime >= 2500;
  },
  pick(...msgs) { return msgs[Math.floor(Math.random() * msgs.length)]; },
  boatName(key) { return key === "boat1" ? "Richard Paul" : "The Challenger"; },
  short(key) { return key === "boat1" ? "RP" : "TC"; },
  clear() {
    this.log = [];
    this._commentedStart = false;
    this._commentedMove1 = false;
    this._commentedMove2 = false;
    this._commentedSprint1 = false;
    this._commentedSprint2 = false;
    this._commentedEval = false;
    this._lastCommentaryTime = 0;
    this._lastAnyTime = 0;
    this._lastStrokeTime = 0;
    this._lastGapTime = 0;
    this._lastTechTime = 0;
    this._lastFillerTime = 0;
    this._lastSteerTime = 0;
    this._lastOvertakeTime = 0;
    this._overtakeNotedAhead = null;
    this._commentedCheckpoints = {};
    this._prevGap = 0;
    this._prevFinish1 = false;
    this._prevFinish2 = false;
    this._commentedVictory = false;
    this._boat1PrevX = 0;
    this._boat2PrevX = 0;
    const feed = document.getElementById("commentaryFeed");
    if (feed) feed.innerHTML = "";
  },
};

function pickShortName(rower) {
  const parts = (rower.name || "").split(" ");
  return parts.length > 1 ? parts[0][0] + ". " + parts[parts.length - 1] : rower.name;
}

function initTelemetry() {
  raceTelemetry = {
    boat1: { strokes: [], rowers: {}, splits: {} },
    boat2: { strokes: [], rowers: {}, splits: {} }
  };
}

function resetRaceState() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (simulation) simulation.reset();
  initTelemetry();
  lastFrameTime = null;
  prevStrokeCount1 = 0;
  prevStrokeCount2 = 0;
  prevInWater1 = false;
  prevInWater2 = false;
  hasCatch1 = false;
  hasCatch2 = false;
  popupScheduled = false;
  commentary.clear();
  Object.keys(_oarCache).forEach(k => delete _oarCache[k]);
  marker1.style.setProperty('--boat-x', '0px');
  marker1.style.setProperty('--steer-y', '0px');
  marker1.style.setProperty('--steer-angle', '0deg');
  marker2.style.setProperty('--boat-x', '0px');
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
  resultsBtn.style.display = "none";
  const raceClockEl = document.getElementById("raceClock");
  if (raceClockEl) raceClockEl.textContent = "0:00.0";
  const gapChipEl = document.getElementById("gapChip");
  if (gapChipEl) { gapChipEl.textContent = "\u2014"; gapChipEl.dataset.leader = "0"; }
  const liveBadgeReset = document.getElementById("liveBadge");
  if (liveBadgeReset) liveBadgeReset.classList.remove("live");
  startBtn.disabled = false;
  stopBtn.disabled = true;
  stopBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
}

function startRace() {
  if (crewSize("boat1") === 0 && crewSize("boat2") === 0) {
    showAlertPopup("Assign at least one rower to a boat before starting the race.");
    return;
  }
  if (crewSize("boat1") > 0 && !boatCoxswains.boat1) {
    showAlertPopup("Richard Paul needs a coxswain before the race can start.");
    return;
  }
  if (crewSize("boat2") > 0 && !boatCoxswains.boat2) {
    showAlertPopup("The Challenger needs a coxswain before the race can start.");
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
  const chem1 = b1rowers.length >= 2 ? computeChemistry(b1rowers) : 0;
  const chem2 = b2rowers.length >= 2 ? computeChemistry(b2rowers) : 0;
  simulation.boats.boat1.chemistry = chem1;
  simulation.boats.boat2.chemistry = chem2;
  simulation.boats.boat1.executionFactor = 0.95 + Math.random() * 0.10;
  simulation.boats.boat2.executionFactor = 0.95 + Math.random() * 0.10;
  simulation.boats.boat1.startEF = 0.95 + Math.random() * 0.10;
  simulation.boats.boat2.startEF = 0.95 + Math.random() * 0.10;
  simulation.boats.boat1.middleMoveEF = 0.95 + Math.random() * 0.10;
  simulation.boats.boat2.middleMoveEF = 0.95 + Math.random() * 0.10;
  simulation.boats.boat1.sprintEF = 0.95 + Math.random() * 0.10;
  simulation.boats.boat2.sprintEF = 0.95 + Math.random() * 0.10;
  simulation.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
  lastFrameTime = null;
  rafId = requestAnimationFrame(tickRace);
}

function togglePause() {
  if (!simulation) return;
  if (simulation.running) {
    simulation.pause();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    lastFrameTime = null;
    stopBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
  } else {
    simulation.start();
    lastFrameTime = null;
    rafId = requestAnimationFrame(tickRace);
    stopBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
  }
  const lb = document.getElementById("liveBadge");
  if (lb) lb.classList.toggle("live", simulation.running);
}

// Renders the oar stroke animation for a boat marker based on its stroke
// phase (0-1, one full cycle = catch -> drive -> finish -> recovery).
function spawnSplash(markerEl, trackEl) {
  const trackRect = trackEl.getBoundingClientRect();
  const blades = _getOarCache(markerEl).oarBlades;
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

const _oarCache = {};
function _getOarCache(markerEl) {
  const id = markerEl.id || 'm';
  if (!_oarCache[id]) {
    _oarCache[id] = {
      oarGroups: [...markerEl.querySelectorAll(".oar-group")],
      rowerDots: [...markerEl.querySelectorAll(".rower-dot")],
      oarBlades: [...markerEl.querySelectorAll(".oar-blade")],
      inner: markerEl.firstElementChild,
    };
  }
  return _oarCache[id];
}

function renderOarStroke(markerEl, phase) {
  const cache = _getOarCache(markerEl);
  const { oarGroups, rowerDots, inner } = cache;
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

  for (let i = 0; i < oarGroups.length; i++) {
    const g = oarGroups[i];
    const side = Number(g.dataset.side);
    g.style.transform = `rotate(${side * angle}deg)`;
    g.classList.toggle("in-water", inWater);
  }

  // --- Hull dynamics: surge, pitch, sliding crew, swelling wake ---
  if (inner) {
    const surge = inWater
      ? Math.sin(Math.PI * sweepT) * 1.8
      : Math.sin(Math.PI * (1 - sweepT)) * -0.55;
    const pitch = inWater ? -0.9 + sweepT * 1.7 : 0.7 * sweepT - 0.35;
    inner.style.transform = `translate(${surge.toFixed(2)}px, 0px) rotate(${pitch.toFixed(2)}deg)`;
  }
  // Rowers roll toward the stern during the drive, recover forward
  const slide = (-4.5 * sweepT).toFixed(2);
  for (let i = 0; i < rowerDots.length; i++) {
    rowerDots[i].setAttribute("transform", `translate(${slide} 0)`);
  }
  // Wake swells through the drive and lingers into the recovery
  const wakeOp = 0.18 + 0.5 * (inWater ? Math.min(1, sweepT * 1.3) : sweepT * 0.55);
  const wakeS = 0.75 + 0.35 * (1 - sweepT) * (inWater ? 0.5 : 1);
  markerEl.style.setProperty("--wake-op", wakeOp.toFixed(3));
  markerEl.style.setProperty("--wake-s", wakeS.toFixed(3));
}

function tickRace(now) {
  if (!simulation || !simulation.running) return;

  if (lastFrameTime === null) lastFrameTime = now;
  const realDt = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  lastTelemetryUpdate += realDt;

  simulation.tick(realDt * SIM_SPEED);
  const s = simulation.getState();
  const liveBadgeEl = document.getElementById("liveBadge");
  if (liveBadgeEl) liveBadgeEl.classList.add("live");

  renderOarStroke(marker1, s.boat1.strokePhase);
  renderOarStroke(marker2, s.boat2.strokePhase);
  updateCourseMarkers(s);
  updateChart(s);
  updateRowerTelemetry(s);
  updateTimeDisplay(s);

  if (s.boat1.strokeCount !== prevStrokeCount1) {
    prevStrokeCount1 = s.boat1.strokeCount;
    document.getElementById("t1-split").textContent = formatSplit(s.boat1.speed);
    if (raceTelemetry) { const bb = simulation.boats.boat1; if (bb.rowerData) {
      const tel = raceTelemetry.boat1;
      tel.strokes.push({ n: s.boat1.strokeCount, watts: bb.totalWatts, split: bb.split500, heading: bb.headingAngle, speed: bb.speed, dist: bb.centerX, time: s.displayTime });
      bb.rowerData.forEach(r => {
        if (!tel.rowers[r.name]) tel.rowers[r.name] = [];
        tel.rowers[r.name].push({ watts: r.effPower, tech: r.effTech, basePower: r.basePower, baseTech: r.baseTech, expectedPower: r.expectedPower });
      });
    }}
  }
  if (s.boat2.strokeCount !== prevStrokeCount2) {
    prevStrokeCount2 = s.boat2.strokeCount;
    document.getElementById("t2-split").textContent = formatSplit(s.boat2.speed);
    if (raceTelemetry) { const bb = simulation.boats.boat2; if (bb.rowerData) {
      const tel = raceTelemetry.boat2;
      tel.strokes.push({ n: s.boat2.strokeCount, watts: bb.totalWatts, split: bb.split500, heading: bb.headingAngle, speed: bb.speed, dist: bb.centerX, time: s.displayTime });
      bb.rowerData.forEach(r => {
        if (!tel.rowers[r.name]) tel.rowers[r.name] = [];
        tel.rowers[r.name].push({ watts: r.effPower, tech: r.effTech, basePower: r.basePower, baseTech: r.baseTech, expectedPower: r.expectedPower });
      });
    }}
  }

  if (raceTelemetry) {
    for (const bk of ["boat1", "boat2"]) {
      const sd = bk === "boat1" ? s.boat1.distance : s.boat2.distance;
      const tel = raceTelemetry[bk];
      for (const d of [250, 500, 750]) {
        if (sd >= d && tel.splits[d] === undefined) tel.splits[d] = s.displayTime;
      }
    }
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

  // --- Commentary events ---
  if (simulation) {
    const b1 = simulation.boats.boat1;
    const b2 = simulation.boats.boat2;
    const name = (k) => commentary.boatName(k);
    commentary._addedThisFrame = false;

    // 1. Start evaluation (one-shot, after both boats have 5+ strokes)
    if (!commentary._commentedStart && s.boat1.strokeCount >= 5 && s.boat2.strokeCount >= 5) {
      commentary._commentedStart = true;
      const lead = b1.centerX > b2.centerX ? "boat1" : "boat2";
      const trail = lead === "boat1" ? "boat2" : "boat1";
      commentary.add("start", commentary.pick(
        `${name(lead)} EXPLODES off the line, leaving ${name(trail)} in their wake!`,
        `${name(lead)} with an ABSOLUTE ROCKET of a start!`,
        `${name(lead)} throws the first punch and already has a lead on ${name(trail)}!`,
        `WHAT A START from ${name(lead)}! ${name(trail)} is already playing catch-up!`,
        `${name(lead)} sets the tone early, putting ${name(trail)} on the back foot!`,
        `${name(lead)} storms out of the blocks. ${name(trail)} is stunned!`,
        `${name(trail)} is already down. ${name(lead)} is ON IT today!`,
        `${name(lead)} fires off the line like a CANNONBALL! ${name(trail)} caught sleeping!`,
        `${name(lead)} with a SCORCHING opening! ${name(trail)} already a length down!`
      ));
    }

    // 2. Victory call -- must be checked BEFORE any other event so nothing fires after finish
    if (!commentary._commentedVictory) {
      const justFinished1 = b1.finishSimTime !== null && !commentary._prevFinish1;
      const justFinished2 = b2.finishSimTime !== null && !commentary._prevFinish2;
      if (justFinished1 || justFinished2) {
        commentary._commentedVictory = true;
        const winner = justFinished1 ? "boat1" : "boat2";
        const wName = name(winner);
        commentary.add("finish", commentary.pick(
          `${wName} TAKES THE WIN!`,
          `${wName} crosses the line FIRST! VICTORY!`,
          `${wName} WINS IT! WHAT A RACE!`,
          `${wName} gets the win! Absolutely DOMINANT!`,
          `${wName} POWER through the line! UNCONTESTED!`,
          `${wName} with a STATEMENT victory! RESOUNDING!`
        ));
      } else {
        // === All other commentary only runs while the race is still active ===

        const d1 = b1.centerX * 2, d2 = b2.centerX * 2;
        const inCheckZone = (d1 >= 450 && d1 <= 550) || (d2 >= 450 && d2 <= 550) ||
                            (d1 >= 950 && d1 <= 1050) || (d2 >= 950 && d2 <= 1050);

        // 3. Walk detection (one boat passes the other, only after start)
        if (commentary._commentedStart) {
          const wasAhead1 = commentary._boat1PrevX > commentary._boat2PrevX;
          const nowAhead1 = b1.centerX > b2.centerX;
          if (wasAhead1 !== nowAhead1 && commentary._boat1PrevX > 0 && commentary._boat2PrevX > 0) {
            const passer = nowAhead1 ? "boat1" : "boat2";
            const passed = nowAhead1 ? "boat2" : "boat1";
            commentary.add("walk", commentary.pick(
              `${name(passer)} is WALKING RIGHT THROUGH ${name(passed)}!`,
              `${name(passer)} surges ahead with AUTHORITY! ${name(passed)} has no answer!`,
              `${name(passer)} just broke ${name(passed)}. That is a CRUSHING move!`,
              `${name(passer)} powers past like ${name(passed)} is standing still! ABSOLUTELY DOMINANT!`,
              `${name(passer)} takes the lead! Can ${name(passed)} find a response?`,
              `${name(passer)} makes a BRUTAL move and ${name(passed)} is fading fast!`,
              `HERE COMES ${name(passer).toUpperCase()}! They are FLYING past ${name(passed)}!`,
              `${name(passer)} SWALLOWS ${name(passed)} whole! Dominance personified!`,
              `${name(passer)} just DESTROYED ${name(passed)}'s chances! Ruthless!`
            ));
          }
          commentary._boat1PrevX = b1.centerX;
          commentary._boat2PrevX = b2.centerX;
        }

        // 3a. Pre-overtake buildup (trailing boat closes within 0.3m)
        if (commentary._commentedStart && commentary.canAddMinor() && !commentary._addedThisFrame) {
          const gap = Math.abs(b1.centerX - b2.centerX);
          const nowAhead1 = b1.centerX > b2.centerX;
          if (gap < 0.3 && gap > 0.02) {
            if (commentary._overtakeNotedAhead === null || commentary._overtakeNotedAhead !== nowAhead1) {
              commentary._overtakeNotedAhead = nowAhead1;
              const attacker = nowAhead1 ? "boat2" : "boat1";
              const defender = nowAhead1 ? "boat1" : "boat2";
              commentary._lastOvertakeTime = Date.now();
              commentary.add("move", commentary.pick(
                `${name(attacker)} is making a MOVE! They are CLOSING on ${name(defender)}!`,
                `${name(attacker)} has the bit between their teeth! ${name(defender)} is in their sights!`,
                `${name(attacker)} is STORMING through! ${name(defender)} is under PRESSURE!`,
                `The gap is SHRINKING! ${name(attacker)} is coming for ${name(defender)}!`,
                `${name(attacker)} charges! This could be THE MOVE of the race!`,
                `${name(attacker)} is HUNTING! ${name(defender)} is in the crosshairs!`,
                `${name(attacker)} smells BLOOD! They are CLOSING FAST on ${name(defender)}!`,
              ));
            }
          } else if (gap > 0.5) {
            commentary._overtakeNotedAhead = null;
          }
        }

        // 4. Tech commentary (crew technique / rhythm observations)
        if (commentary._commentedStart && !inCheckZone && commentary.canAddMinor() && Date.now() - commentary._lastTechTime >= 5000) {
          const getTech = (b) => b.rowerData && b.rowerData.length > 0
            ? b.rowerData.reduce((s, r) => s + (r.effTech || 0) / (r.technique || 1), 0) / b.rowerData.length
            : null;
          const t1 = getTech(b1);
          const t2 = getTech(b2);
          if (t1 !== null && t2 !== null) {
            if (t1 > 1.05 && t2 > 1.05 && Math.random() < 0.35) {
              commentary._lastTechTime = Date.now();
              commentary.add("tech", commentary.pick(
                `Both crews are rowing BEAUTIFULLY! Timing is FLAWLESS!`,
                `Incredible technique from both crews! This is ROWING at its finest!`,
                `PURE poetry in motion! Both crews in PERFECT sync!`,
                `What a display of technical mastery! Both boats are FLYING!`
              ));
            } else if (t1 > 1.05 && Math.random() < 0.35) {
              commentary._lastTechTime = Date.now();
              commentary.add("tech", commentary.pick(
                `Richard Paul's rhythm is PERFECT right now! Great connection at the catch!`,
                `Richard Paul is LOCKED IN! Every stroke is PRISTINE!`,
                `Richard Paul making it look EFFORTLESS! Beautiful rotation through the finish!`,
                `Richard Paul is ROWING WITH THEIR SOULS! Every blade in the water at once!`,
                `Richard Paul's timing is IMMACULATE! They are unstoppable like this!`
              ));
            } else if (t2 > 1.05 && Math.random() < 0.35) {
              commentary._lastTechTime = Date.now();
              commentary.add("tech", commentary.pick(
                `The Challenger is rowing with PURE EFFICIENCY! Absolutely SUPERB!`,
                `The Challenger is in a ZONE! Perfect execution stroke after stroke!`,
                `The Challenger's technique is TEXTBOOK! They are unstoppable right now!`,
                `The Challenger is a WELL-OILED MACHINE! Synchrony at its peak!`,
                `The Challenger are in FLAWLESS form! Every catch is razor sharp!`
              ));
            } else if (t1 < 0.90 && t2 < 0.90 && Math.random() < 0.5) {
              commentary._lastTechTime = Date.now();
              commentary.add("tech", commentary.pick(
                `Both crews are struggling! ROUGH water and rough technique!`,
                `This is UGLY from both crews! Technique is falling apart!`,
                `Neither crew can find their rhythm! This is PAINFUL to watch!`,
                `It is a TECHNIQUE NIGHTMARE out there! Both boats are fighting the water!`
              ));
            } else if (t1 < 0.90 && Math.random() < 0.4) {
              commentary._lastTechTime = Date.now();
              commentary.add("tech", commentary.pick(
                `Richard Paul is getting RAGGED! They need to find their composure!`,
                `Sloppy from Richard Paul! Rushing the slide and losing connection!`,
                `Richard Paul's timing is OFF! They need a good settle stroke!`,
                `Richard Paul has lost their LENGTH! Short and choppy at the finish!`,
                `Richard Paul is fighting the boat! Hands are bouncing at the catch!`
              ));
            } else if (t2 < 0.90 && Math.random() < 0.4) {
              commentary._lastTechTime = Date.now();
              commentary.add("tech", commentary.pick(
                `The Challenger is looking UNCOMFORTABLE! Fighting the boat right now!`,
                `The Challenger's rhythm is SHATTERED! They need to reset!`,
                `The Challenger is losing their shape! Look at the sterns!`,
                `The Challenger CANNOT find the connection! Skying at the catch!`,
                `The Challenger is all over the place! Bucket seats everywhere!`
              ));
            }
            // Technique mismatch - one crew excelling while the other struggles
            if ((t1 > 1.05 && t2 < 0.95) || (t2 > 1.05 && t1 < 0.95)) {
              const bad = t1 < 0.95 ? "Richard Paul" : "The Challenger";
              const good = t1 > 1.05 ? "Richard Paul" : "The Challenger";
              if (Math.random() < 0.45) {
                commentary._lastTechTime = Date.now();
                commentary.add("tech", commentary.pick(
                  `${bad} are a MESS right now while ${good} are absolutely FLYING!`,
                  `The contrast is STARK! ${good} rowing beautifully, ${bad} in SHAMBLES!`,
                  `${good} making it look easy while ${bad} cannot buy a clean stroke!`,
                  `${bad} are getting EXPOSED! ${good} showing them how it is done!`,
                  `One crew is PRISTINE, the other is STRUGGLING to stay afloat!`
                ));
              }
            }
          }
        }

        // 5. Stroke quality (per-stroke change, reduced frequency)
        if (commentary._commentedStart && !inCheckZone && commentary.canAddMinor() && Date.now() - commentary._lastStrokeTime >= 4000) {
          let strokeComment = null;
          for (const key of ["boat1", "boat2"]) {
            const b = key === "boat1" ? b1 : b2;
            const sCount = key === "boat1" ? s.boat1.strokeCount : s.boat2.strokeCount;
            const prevCount = key === "boat1" ? prevStrokeCount1 : prevStrokeCount2;
            if (sCount === prevCount || sCount === 0 || !b.rowerData) continue;
            const rowers = b.rowerData;
            const best = rowers.reduce((a, b) => a.effPower / (a.expectedPower||1) > b.effPower / (b.expectedPower||1) ? a : b);
            const worst = rowers.reduce((a, b) => a.effPower / (a.expectedPower||1) < b.effPower / (b.expectedPower||1) ? a : b);
            const bestRatio = best.effPower / (best.expectedPower||1);
            const worstRatio = worst.effPower / (worst.expectedPower||1);
            if (bestRatio >= 1.08 && Math.random() < 0.25) {
              strokeComment = { boat: name(key), rower: pickShortName(best), type: "good" };
              break;
            }
            if (worstRatio <= 0.92 && Math.random() < 0.25) {
              strokeComment = { boat: name(key), rower: pickShortName(worst), type: "bad" };
              break;
            }
          }
          if (strokeComment) {
            commentary._lastStrokeTime = Date.now();
            const { boat, rower, type } = strokeComment;
            if (type === "good") {
              commentary.add("good", commentary.pick(
                `${rower} of ${boat} HAMMERS one down!`,
                `${boat}'s ${rower} absolutely demolishes that stroke!`,
                `WHAT A STROKE from ${rower}! ${boat} is on fire!`,
                `${rower} finds something extra. ${boat} is FLYING!`,
                `${boat}'s ${rower} just ripped the heart out of that stroke!`,
                `INCREDIBLE from ${rower}! ${boat} is SURGING!`,
                `${rower} unleashes absolute THUNDER! ${boat} jumps forward!`,
                `${rower} with a NASTY stroke! That one will leave a mark!`
              ));
            } else {
              commentary.add("bad", commentary.pick(
                `Tough stroke for ${boat}'s ${rower}... they lose a bit of ground there.`,
                `${rower} of ${boat} with a rough one. Fighting to find the rhythm again.`,
                `${boat} has a shaky stroke from ${rower}, that one will sting.`,
                `Sloppy from ${boat}. ${rower} misses the connection.`,
                `${boat}'s ${rower} is laboring. That was UGLY.`,
                `A costly mistake from ${boat}. ${rower} loses the blade for a split second!`,
                `${rower} of ${boat} has a CATASTROPHIC stroke! That will HURT!`,
                `${boat} crabbed at the catch! ${rower} loses all rhythm!`
              ));
            }
          }
        }

        // 6. Gap change detection (trailing boat closes by >=8% in a frame, 4s cooldown)
        if (commentary._commentedStart && !inCheckZone) {
          const gap = Math.abs(b1.centerX - b2.centerX);
          if (commentary._prevGap > 0 && gap > 0.5 && gap < commentary._prevGap * 0.92 && commentary.canAddMinor() && Date.now() - commentary._lastGapTime >= 5000) {
            commentary._lastGapTime = Date.now();
            const behind = b1.centerX < b2.centerX ? "boat1" : "boat2";
            commentary.add("walk", commentary.pick(
              `${name(behind)} is CHARGING BACK! The gap is SHRINKING!`,
              `${name(behind)} is walking back! They are NOT done yet!`,
              `${name(behind)} is CLOSING the gap! This race is not over!`,
              `${name(behind)} is coming back! Can they finish the job?!`,
              `LOOK OUT! ${name(behind)} is cutting into the lead!`,
              `${name(behind)} refuses to go away! They are FIGHTING!`,
              `${name(behind)} is INCHING BACK! Every stroke counts!`,
              `${name(behind)} will NOT lie down! They are DRAGGING themselves back!`
            ));
          }
        }

        // 6a. Steering criticism (heading angle too large, >0.026 rad ~1.5 degrees)
        if (commentary._commentedStart && !inCheckZone && commentary.canAddMinor() && !commentary._addedThisFrame && Date.now() - commentary._lastSteerTime >= 8000) {
          const badSteer = [];
          if (Math.abs(b1.headingAngle) > 0.026) badSteer.push("boat1");
          if (Math.abs(b2.headingAngle) > 0.026) badSteer.push("boat2");
          if (badSteer.length === 1) {
            commentary._lastSteerTime = Date.now();
            const b = badSteer[0];
            commentary.add("tech", commentary.pick(
              `${name(b)} is ALL OVER THE WATER! They cannot hold a straight line!`,
              `${name(b)}'s steering is ABYSMAL! Wandering all over the course!`,
              `${name(b)} is zig-zagging! They are COSTING themselves precious time!`,
              `Look at the wash from ${name(b)}! The coxswain has lost control!`,
              `${name(b)} can NOT find their line! This is PAINFUL to watch!`
            ));
          } else if (badSteer.length === 2) {
            commentary._lastSteerTime = Date.now();
            commentary.add("tech", commentary.pick(
              `Both crews are STEERING POORLY! Zig-zagging down the course!`,
              `Neither coxswain can hold a line! This is SLOOPY rowing!`,
              `The steering is AWFUL! Both boats are all over the place!`
            ));
          }
        }

        // 7. Middle move detection
        if (!commentary._commentedMove1 && b1.middleMoveRemaining !== undefined && b1.middleMoveRemaining > 0) {
          commentary._commentedMove1 = true;
          commentary.add("move", commentary.pick(
            `Richard Paul THROWS DOWN a vicious power move at 750m!`,
            `Richard Paul is making a MONSTER push in the middle of the race!`,
            `Richard Paul digs DEEP for 5 huge strokes. They are making a STATEMENT!`,
            `The cox calls for BLOOD and Richard Paul RESPONDS with 5 massive strokes!`,
            `Richard Paul is on the ATTACK! Five strokes to change the race!`,
            `Richard Paul's cox sends the rating UP! 5 CRIPPLING strokes incoming!`,
            `Richard Paul is UNLEASHING HELL! 5 strokes that will define their race!`
          ));
        }
        if (!commentary._commentedMove2 && b2.middleMoveRemaining !== undefined && b2.middleMoveRemaining > 0) {
          commentary._commentedMove2 = true;
          commentary.add("move", commentary.pick(
            `The Challenger LAUNCHES a devastating power move at 750m!`,
            `The Challenger is putting together a HUGE push right now!`,
            `The Challenger digs deep. 5 massive strokes to swing the momentum!`,
            `The cox of The Challenger calls the move and the crew ANSWERS!`,
            `The Challenger is SURGING! Five strokes that could decide everything!`,
            `The Challenger THROWS THE DICE! 5 gutsy strokes to turn the tide!`,
            `The Challenger attacks the MIDDLE THOUSAND! This is the turning point!`
          ));
        }

        // 8. Sprint detection
        const sprint1 = b1.rowerData && b1._impulseThisStroke > 0 &&
          b1.strokeRate >= 34 && b1.centerX / 750 >= 0.55 &&
          b1.centerX < b2.centerX;
        const sprint2 = b2.rowerData && b2._impulseThisStroke > 0 &&
          b2.strokeRate >= 34 && b2.centerX / 750 >= 0.55 &&
          b2.centerX < b1.centerX;
        if (!commentary._commentedSprint1 && sprint1) {
          commentary._commentedSprint1 = true;
          commentary.add("sprint", commentary.pick(
            `Richard Paul LIGHTS THE FUSE! Sprinting to get back in this!`,
            `Richard Paul is going for BROKE! Emptying the tank to close the gap!`,
            `EVERYTHING NOW from Richard Paul! They are throwing it all out there!`,
            `Richard Paul launches an EARLY SPRINT! Trying to catch The Challenger!`,
            `Richard Paul shifts GEARS! Rate climbing FAST!`,
            `Richard Paul is DESPERATE! The sprint comes early for them!`
          ));
        }
        if (!commentary._commentedSprint2 && sprint2) {
          commentary._commentedSprint2 = true;
          commentary.add("sprint", commentary.pick(
            `The Challenger LIGHTS THE FUSE! Sprinting to get back in this!`,
            `The Challenger is going for BROKE! Emptying the tank to close the gap!`,
            `EVERYTHING NOW from The Challenger! Trying to walk back Richard Paul!`,
            `The Challenger launches an EARLY SPRINT! Desperate to close the gap!`,
            `The Challenger UPS THE RATE! Pushing into the red!`,
            `The Challenger throws CAUTION to the wind! Sprint mode ACTIVATED!`
          ));
        }

        // 9. Checkpoint commentary (fires when EITHER boat reaches 500m / 1000m)
        const checkpoints = [500, 1000];
        const b1dist = b1.centerX * 2;
        const b2dist = b2.centerX * 2;
        for (const cp of checkpoints) {
          if (!commentary._commentedCheckpoints[cp] && (b1dist >= cp || b2dist >= cp)) {
            commentary._commentedCheckpoints[cp] = true;
            const ahead = b1.centerX > b2.centerX ? "boat1" : "boat2";
            const behind = ahead === "boat1" ? "boat2" : "boat1";
            const gap = Math.abs(b1.centerX - b2.centerX);
            const gapBoat = gap.toFixed(1);
            if (gap < 2) {
              commentary.add("walk", commentary.pick(
                `At ${cp}m: DEAD EVEN! ${name(ahead)} barely has the edge!`,
                `At ${cp}m: This is a WAR! Nothing separates these two crews!`,
                `At ${cp}m: ${name(ahead)} leads by a canvas. TOO CLOSE TO CALL!`,
                `At ${cp}m: Both crews locked in BATTLE! No one is backing down!`,
                `At ${cp}m: The crowd is on their feet! ${name(ahead)} by a HAIR!`,
                `At ${cp}m: ABSOLUTE NAIL-BITER! This is RACING at its finest!`,
                `At ${cp}m: INCHES! ${name(ahead)} just ahead of ${name(behind)}!`,
                `At ${cp}m: Could you ASK for a closer race?! ${name(ahead)} by a fraction!`,
                `At ${cp}m: EDGE OF THE SEAT stuff! ${name(ahead)} barely in front!`
              ));
            } else if (gap < 8) {
              commentary.add("walk", commentary.pick(
                `At ${cp}m: ${name(ahead)} leads by ${gapBoat}m. ${name(behind)} is HANGING ON!`,
                `At ${cp}m: ${name(ahead)} has a ${gapBoat}m lead! ${name(behind)} needs to ANSWER!`,
                `At ${cp}m: ${name(ahead)} is applying PRESSURE. ${gapBoat}m clear!`,
                `At ${cp}m: ${name(ahead)} is gaining CONFIDENCE. ${gapBoat}m ahead!`,
                `At ${cp}m: ${name(behind)} is in DANGER. ${name(ahead)} by ${gapBoat}m!`,
                `At ${cp}m: ${name(ahead)} has the edge, ${gapBoat}m up on ${name(behind)}!`,
                `At ${cp}m: ${name(ahead)} with a DECISIVE lead! ${gapBoat}m the margin!`,
                `At ${cp}m: ${name(behind)} needs a MIRACLE. ${gapBoat}m to claw back!`
              ));
            } else {
              commentary.add("sprint", commentary.pick(
                `At ${cp}m: ${name(ahead)} is RUNNING AWAY with it! ${gapBoat}m CLEAR!`,
                `At ${cp}m: This is getting UGLY. ${name(ahead)} by ${gapBoat}m!`,
                `At ${cp}m: ${name(behind)} is getting ROCKED. ${gapBoat}m off the pace!`,
                `At ${cp}m: ${name(ahead)} is SHOWING NO MERCY. ${gapBoat}m ahead!`,
                `At ${cp}m: ABSOLUTE DOMINATION from ${name(ahead)}. ${gapBoat}m gap!`,
                `At ${cp}m: ${name(behind)} is in SURVIVAL MODE. ${gapBoat}m down!`,
                `At ${cp}m: This one is slipping away. ${name(ahead)} by ${gapBoat}m!`,
                `At ${cp}m: ${name(ahead)} is OBLITERATING the field! ${gapBoat}m!`,
                `At ${cp}m: This is a MASSACRE! ${name(ahead)} by ${gapBoat}m!`
              ));
            }
            break;
          }
        }

        // 10. Final evaluation near finish (both boats >= 700m)
        if (!commentary._commentedEval && s.boat1.distance >= 700 && s.boat2.distance >= 700) {
          commentary._commentedEval = true;
          const gap = Math.abs(b1.centerX - b2.centerX);
          const lead = b1.centerX > b2.centerX ? "boat1" : "boat2";
          if (gap < 5) {
            commentary.add("finish", commentary.pick(
              `EVERYTHING COMES DOWN TO THIS! PHOTO FINISH INCOMING!`,
              `This is going to the WIRE! WHO WANTS IT MORE?!`,
              `TOO CLOSE TO CALL! This is what racing is ALL ABOUT!`,
              `HOLD ON TO YOUR SEATS! This finish is going to be LEGENDARY!`,
              `Both crews are EMPTYING THE TANK! This will be decided at the line!`,
              `A PHOTO FINISH is brewing! Every stroke counts NOW!`,
              `THIS IS WHY WE RACE! Both crews giving absolute EVERYTHING!`,
              `DRAMA at the finish line! This could go EITHER WAY!`
            ));
          } else {
            commentary.add("finish", commentary.pick(
              `${name(lead)} is CRUSHING their soul! Pulling away with the line in sight!`,
              `${name(lead)} has BROKEN ${name(lead === "boat1" ? "boat2" : "boat1")}! This one is OVER!`,
              `${name(lead)} is in TOTAL CONTROL. Just a few more meters!`,
              `${name(lead)} is on FIRE! ${name(lead === "boat1" ? "boat2" : "boat1")} has nothing left!`,
              `${name(lead)} is DOMINATING! Putting the final nail in the coffin!`,
              `${name(lead)} is just toying with them now. This race is DONE.`,
              `${name(lead)} is UNSTOPPABLE! They smell the finish line!`,
              `${name(lead)} has ALL THE MOMENTUM! The finish cannot come soon enough!`
            ));
          }
        }

        // 11. Filler (only if nothing else fired this frame, 5s cooldown, uses _prevGap for trend)
        if (commentary._commentedStart && !inCheckZone && !commentary._addedThisFrame && commentary.canAddMinor() && Date.now() - commentary._lastFillerTime >= 6000 && b1.strokeCount > 0) {
          commentary._lastFillerTime = Date.now();
          const ahead = b1.centerX > b2.centerX ? "boat1" : "boat2";
          const behind = ahead === "boat1" ? "boat2" : "boat1";
          const gap = Math.abs(b1.centerX - b2.centerX);
          const gapBoat = gap.toFixed(1);
          const aheadDist = Math.round((ahead === "boat1" ? b1.centerX : b2.centerX) * 2);
          const trend = commentary._prevGap > 0 ? (
            gap < commentary._prevGap - 0.5 ? "closing" :
            gap > commentary._prevGap + 0.5 ? "extending" : "stable"
          ) : "stable";
          if (gap < 2) {
            commentary.add("good", commentary.pick(
              `STILL DEAD EVEN at ${aheadDist}m! ${name(ahead)} by the slimmest of margins!`,
              `Nothing in it at ${aheadDist}m! Both crews giving EVERYTHING!`,
              `These two are inseparable! ${name(ahead)} just inches ahead at ${aheadDist}m!`,
              `At ${aheadDist}m: this is a PURE DOGFIGHT! Neither crew will yield!`,
              `${aheadDist}m gone and we STILL cannot separate them! INCREDIBLE racing!`,
              `A MATCH RACE at its FINEST! ${name(ahead)} barely ahead at ${aheadDist}m!`,
              `RIDICULOUSLY close at ${aheadDist}m! These crews are GLUED together!`
            ));
          } else if (trend === "closing") {
            commentary.add("walk", commentary.pick(
              `${name(behind)} is CUTTING INTO the lead! Gap down to ${gapBoat}m at ${aheadDist}m!`,
              `${name(behind)} is STORMING BACK! ${gapBoat}m now separates them at ${aheadDist}m!`,
              `The gap is SHRINKING! ${name(behind)} within ${gapBoat}m at ${aheadDist}m!`,
              `${name(behind)} is CHARGING! Only ${gapBoat}m in it now!`,
              `${name(behind)} refuses to give up! Now within ${gapBoat}m!`,
              `${name(behind)} is EATING INTO the deficit! ${gapBoat}m the gap at ${aheadDist}m!`,
              `${name(behind)} making a LATE CHARGE! ${gapBoat}m to close at ${aheadDist}m!`
            ));
          } else if (trend === "extending") {
            commentary.add("sprint", commentary.pick(
              `${name(ahead)} is EXTENDING the lead! ${gapBoat}m clear at ${aheadDist}m!`,
              `${name(ahead)} is pulling AWAY! Gap grows to ${gapBoat}m!`,
              `${name(ahead)} is pouring it on! ${gapBoat}m ahead with the finish approaching!`,
              `${name(ahead)} is IN CONTROL. ${gapBoat}m lead at ${aheadDist}m.`,
              `${name(behind)} is losing contact! ${name(ahead)} now leads by ${gapBoat}m!`,
              `${name(ahead)} is STEPPING ON THE GAS! ${gapBoat}m and pulling clear!`,
              `${name(behind)} is in TROUBLE! ${name(ahead)} moves ${gapBoat}m clear!`
            ));
          } else {
            commentary.add("good", commentary.pick(
              `${name(ahead)} by ${gapBoat}m at ${aheadDist}m. ${name(behind)} is holding steady.`,
              `${name(ahead)} leads ${name(behind)} by ${gapBoat}m. ${1500 - aheadDist}m to go.`,
              `${name(ahead)} keeping ${name(behind)} at bay. ${gapBoat}m the margin at ${aheadDist}m.`,
              `Tactical race at ${aheadDist}m. ${name(ahead)} by ${gapBoat}m over ${name(behind)}.`,
              `${aheadDist}m down. ${name(ahead)} leads ${gapBoat}m. ${name(behind)} within striking range.`,
              `${name(ahead)} holding a ${gapBoat}m edge at ${aheadDist}m. ${name(behind)} waiting for a chance.`,
              `STALEMATE at ${aheadDist}m! ${name(ahead)} by ${gapBoat}m, neither crew backing down.`
            ));
          }
        }
      }

      // Always track finish state regardless of which branch fired
      if (b1.finishSimTime !== null) commentary._prevFinish1 = true;
      if (b2.finishSimTime !== null) commentary._prevFinish2 = true;
    }

    // Update _prevGap after filler
    if (commentary._commentedStart) {
      commentary._prevGap = Math.abs(b1.centerX - b2.centerX);
    }
  }

  if (!popupScheduled && simulation) {
    const b1 = simulation.boats.boat1;
    const b2 = simulation.boats.boat2;
    if (b1.finishSimTime !== null && b2.finishSimTime !== null) {
      popupScheduled = true;
      resultsBtn.style.display = "";
      setTimeout(showRaceSummaryPopup, 1000);
    }
  }

  if (s.finished) {
    finishRace();
    return;
  }

  rafId = requestAnimationFrame(tickRace);
}

function showRaceSummaryPopup() {
  if (!simulation) return;
  const b1 = simulation.boats.boat1;
  const b2 = simulation.boats.boat2;
  const t1 = b1.finishDisplayTime, t2 = b2.finishDisplayTime;
  if (t1 === null || t2 === null) return;
  const winner = t1 < t2 ? "boat1" : "boat2";
  const wName = commentary.boatName(winner);
  const margin = Math.abs(t1 - t2);
  const probs = computeWinProbs();
  const efPct = (v) => (v === undefined ? "0%" : (v >= 1 ? "+" : "") + ((v - 1) * 100).toFixed(1) + "%");
  const efCls = (v) => v === undefined ? "" : v >= 1.005 ? "col-green" : v <= 0.995 ? "col-red" : "";
  const tel1 = raceTelemetry ? raceTelemetry.boat1 : null;
  const tel2 = raceTelemetry ? raceTelemetry.boat2 : null;
  const s1 = tel1 ? tel1.strokes : [];
  const s2 = tel2 ? tel2.strokes : [];
  const avg = (arr, f) => arr.length ? arr.reduce((s, v) => s + f(v), 0) / arr.length : 0;
  const bStats = (strokes, rowers) => {
    const ap = strokes.length ? avg(strokes, s => s.watts) : 0;
    const pp = strokes.length ? Math.max(...strokes.map(s => s.watts)) : 0;
    const validSplits = strokes.filter(s => s.split > 0);
    const asp = validSplits.length ? avg(validSplits, s => s.split) : 0;
    const ls = validSplits.length ? Math.min(...validSplits.map(s => s.split)) : 0;
    const ad = strokes.length ? avg(strokes, s => Math.abs(s.heading)) : 0;
    const at = rowers ? avg(Object.values(rowers).flat(), r => r.tech) : 0;
    return { avgPower: ap, peakPower: pp, avgSplit: asp, lowSplit: ls, avgSteerDev: ad, avgTech: at };
  };
  const bs1 = bStats(s1, tel1 ? tel1.rowers : null);
  const bs2 = bStats(s2, tel2 ? tel2.rowers : null);
  const rowerTable = (tel, key) => {
    if (!tel || !tel.rowers) return "";
    const rows = Object.entries(tel.rowers).map(([name, data]) => {
      const avgP = avg(data, d => d.watts);
      const pkP = Math.max(...data.map(d => d.watts));
      const avgT = avg(data, d => d.tech);
      const avgExpP = avg(data, d => d.expectedPower);
      const raw = avgExpP > 0 ? avgP / avgExpP : 1;
      return { name, avgP, pkP, avgT, raw };
    });
    const avgRaw = rows.reduce((s, r) => s + r.raw, 0) / rows.length;
    const normFactor = avgRaw > 0 ? avgRaw : 1;
    rows.forEach(r => {
      const pct = r.raw / normFactor;
      r.pct = pct;
      r.pctStr = (pct >= 1 ? "+" : "") + ((pct - 1) * 100).toFixed(1) + "%";
      r.cls = pct >= 1 ? "col-green" : "col-red";
    });
    rows.sort((a, b) => b.pct - a.pct);
    const mvp = rows[0];
    return rows.map(r => {
      const star = r === mvp ? ' <span class="col-gold">&#9733; MVP</span>' : "";
      return `<tr><td>${r.name}${star}</td><td>${r.avgP.toFixed(0)}</td><td>${r.pkP.toFixed(0)}</td><td>${r.avgT.toFixed(2)}</td><td class="${r.cls}">${r.pctStr}</td></tr>`;
    }).join("");
  };
  const splitVal = (tel, d) => (tel && tel.splits && tel.splits[d] !== undefined ? tel.splits[d] : null);
  const splitTime = (tel, startD, endD) => {
    const tEnd = splitVal(tel, endD);
    const tStart = startD === 0 ? 0 : splitVal(tel, startD);
    if (tEnd === null || tStart === null) return "--:--";
    return formatRealTime(tEnd - tStart);
  };
  const st1 = (d) => splitTime(tel1, d[0], d[1]);
  const st2 = (d) => splitTime(tel2, d[0], d[1]);

  const overlay = document.createElement("div");
  overlay.className = "alert-overlay";
  overlay.innerHTML = `
    <div class="rs-popup">
      <div class="rs-header">
        <div class="rs-header-icon"><i class="fa-solid fa-trophy"></i></div>
        <div class="rs-header-title">Race Results</div>
        <div class="rs-header-sub">${wName} takes the win</div>
      </div>
      <div class="rs-body">
        <div class="rs-card">
          <div class="rs-card-title"><i class="fa-solid fa-medal"></i> Result</div>
          <div class="rs-result-grid">
            <div class="rs-result-col">
              <div class="rs-boat-label rs-rp">${commentary.short("boat1")}</div>
              <div class="rs-time">${formatRealTime(t1)}</div>
            </div>
            <div class="rs-vs"><i class="fa-solid fa-xmark"></i></div>
            <div class="rs-result-col">
              <div class="rs-boat-label rs-tc">${commentary.short("boat2")}</div>
              <div class="rs-time">${formatRealTime(t2)}</div>
            </div>
          </div>
          <div class="rs-margin">Margin: ${margin.toFixed(1)}s</div>
        </div>

        <div class="rs-row">
          <div class="rs-card rs-card-half">
            <div class="rs-card-title"><i class="fa-solid fa-chart-line"></i> Prediction</div>
            <div class="rs-stat-grid">
              <div><span class="rs-stat-label">Win Prob</span><span class="rs-stat-val ${probs && probs.prob1 >= 50 ? "col-green" : "col-red"}">${probs ? probs.prob1.toFixed(1) + "%" : "--"}</span><span class="rs-stat-sub">${commentary.short("boat1")}</span></div>
              <div><span class="rs-stat-label">Win Prob</span><span class="rs-stat-val ${probs && probs.prob2 >= 50 ? "col-green" : "col-red"}">${probs ? probs.prob2.toFixed(1) + "%" : "--"}</span><span class="rs-stat-sub">${commentary.short("boat2")}</span></div>
              <div><span class="rs-stat-label">Pred Margin</span><span class="rs-stat-val">${probs ? Math.abs(probs.margin).toFixed(1) + "s" : "--"}</span><span class="rs-stat-sub">${probs ? (probs.margin >= 0 ? commentary.short("boat1") : commentary.short("boat2")) : ""}</span></div>
            </div>
          </div>
          <div class="rs-card rs-card-half">
            <div class="rs-card-title"><i class="fa-solid fa-gauge-high"></i> Execution</div>
            <div class="rs-ef-grid">
              <span class="rs-ef-label">Overall</span><span class="${efCls(b1.executionFactor)}">${efPct(b1.executionFactor)}</span><span class="${efCls(b2.executionFactor)}">${efPct(b2.executionFactor)}</span>
              <span class="rs-ef-label">Start</span><span class="${efCls(b1.startEF)}">${efPct(b1.startEF)}</span><span class="${efCls(b2.startEF)}">${efPct(b2.startEF)}</span>
              <span class="rs-ef-label">Mid Move</span><span class="${efCls(b1.middleMoveEF)}">${efPct(b1.middleMoveEF)}</span><span class="${efCls(b2.middleMoveEF)}">${efPct(b2.middleMoveEF)}</span>
              <span class="rs-ef-label">Sprint</span><span class="${efCls(b1.sprintEF)}">${efPct(b1.sprintEF)}</span><span class="${efCls(b2.sprintEF)}">${efPct(b2.sprintEF)}</span>
            </div>
          </div>
        </div>

        <div class="rs-card">
          <div class="rs-card-title"><i class="fa-solid fa-clock"></i> Race Timeline (500m Splits)</div>
          <table class="rs-table">
            <tr><td></td><td><b>${commentary.short("boat1")}</b></td><td><b>${commentary.short("boat2")}</b></td></tr>
            <tr><td>0 - 500m</td><td>${st1([0, 250])}</td><td>${st2([0, 250])}</td></tr>
            <tr><td>500 - 1000m</td><td>${st1([250, 500])}</td><td>${st2([250, 500])}</td></tr>
            <tr><td>1000 - 1500m</td><td>${st1([500, 750])}</td><td>${st2([500, 750])}</td></tr>
          </table>
        </div>

        <div class="rs-row">
          <div class="rs-card rs-card-half">
            <div class="rs-card-title"><i class="fa-solid fa-water"></i> ${commentary.short("boat1")} Stats</div>
            <div class="rs-stat-grid">
              <div><span class="rs-stat-label">Avg Power</span><span class="rs-stat-val">${bs1.avgPower.toFixed(0)}</span><span class="rs-stat-sub">W</span></div>
              <div><span class="rs-stat-label">Peak Power</span><span class="rs-stat-val">${bs1.peakPower.toFixed(0)}</span><span class="rs-stat-sub">W</span></div>
              <div><span class="rs-stat-label">Avg Tech</span><span class="rs-stat-val">${bs1.avgTech.toFixed(2)}</span><span class="rs-stat-sub"></span></div>
              <div><span class="rs-stat-label">Best Split</span><span class="rs-stat-val">${bs1.lowSplit > 0 ? formatSplitFromSec(bs1.lowSplit) : "--:--"}</span><span class="rs-stat-sub"></span></div>
              <div><span class="rs-stat-label">Avg Split</span><span class="rs-stat-val">${bs1.avgSplit > 0 ? formatSplitFromSec(bs1.avgSplit) : "--:--"}</span><span class="rs-stat-sub"></span></div>
              <div><span class="rs-stat-label">Steer Dev</span><span class="rs-stat-val">${(bs1.avgSteerDev * 180 / Math.PI).toFixed(1)}</span><span class="rs-stat-sub">&deg;</span></div>
            </div>
          </div>
          <div class="rs-card rs-card-half">
            <div class="rs-card-title"><i class="fa-solid fa-water"></i> ${commentary.short("boat2")} Stats</div>
            <div class="rs-stat-grid">
              <div><span class="rs-stat-label">Avg Power</span><span class="rs-stat-val">${bs2.avgPower.toFixed(0)}</span><span class="rs-stat-sub">W</span></div>
              <div><span class="rs-stat-label">Peak Power</span><span class="rs-stat-val">${bs2.peakPower.toFixed(0)}</span><span class="rs-stat-sub">W</span></div>
              <div><span class="rs-stat-label">Avg Tech</span><span class="rs-stat-val">${bs2.avgTech.toFixed(2)}</span><span class="rs-stat-sub"></span></div>
              <div><span class="rs-stat-label">Best Split</span><span class="rs-stat-val">${bs2.lowSplit > 0 ? formatSplitFromSec(bs2.lowSplit) : "--:--"}</span><span class="rs-stat-sub"></span></div>
              <div><span class="rs-stat-label">Avg Split</span><span class="rs-stat-val">${bs2.avgSplit > 0 ? formatSplitFromSec(bs2.avgSplit) : "--:--"}</span><span class="rs-stat-sub"></span></div>
              <div><span class="rs-stat-label">Steer Dev</span><span class="rs-stat-val">${(bs2.avgSteerDev * 180 / Math.PI).toFixed(1)}</span><span class="rs-stat-sub">&deg;</span></div>
            </div>
          </div>
        </div>

        <div class="rs-card">
          <div class="rs-card-title"><i class="fa-solid fa-users"></i> Rower Performance</div>
          <table class="rs-table">
            <tr><td></td><td><b>Avg W</b></td><td><b>Peak W</b></td><td><b>Tech</b></td><td><b>vs Base</b></td></tr>
            <tr><td colspan="5" class="rs-section-label">${commentary.boatName("boat1")}</td></tr>
            ${rowerTable(tel1, "boat1")}
            <tr><td colspan="5" class="rs-section-label">${commentary.boatName("boat2")}</td></tr>
            ${rowerTable(tel2, "boat2")}
          </table>
        </div>

        <div class="rs-card">
          <div class="rs-card-title"><i class="fa-solid fa-chart-area"></i> Power Over Race</div>
          <canvas id="popupPowerGraph" height="180"></canvas>
        </div>
      </div>
      <button class="rs-close-btn"><i class="fa-solid fa-xmark"></i> Close</button>
    </div>`;
  document.body.appendChild(overlay);
  const rsCols = overlay.querySelectorAll(".rs-result-col");
  const winCol = rsCols[winner === "boat1" ? 0 : 1];
  if (winCol) winCol.classList.add("rs-win");
  if (typeof window.fxConfetti === "function") {
    window.fxConfetti(winner === "boat1"
      ? ["#38d1ff", "#9feaff", "#f7c948", "#ffffff"]
      : ["#ff5470", "#ffb1c0", "#f7c948", "#ffffff"]);
  }

  // Render power graph
  const canvas = document.getElementById("popupPowerGraph");
  let popupChart = null;
  if (canvas && s1.length > 0) {
    const d1 = s1.map(s => ({ x: Math.min(Math.round(s.dist * 2), 1500), y: s.watts }));
    const d2 = s2.length > 0 ? s2.map(s => ({ x: Math.min(Math.round(s.dist * 2), 1500), y: s.watts })) : [];
    popupChart = new Chart(canvas, {
      type: "scatter",
      data: {
        datasets: [
          { label: commentary.short("boat1"), data: d1, borderColor: "#38d1ff", backgroundColor: "rgba(56,209,255,0.15)", pointRadius: 0, borderWidth: 2, showLine: true, tension: 0.2 },
          { label: commentary.short("boat2"), data: d2, borderColor: "#ff5470", backgroundColor: "rgba(255,84,112,0.15)", pointRadius: 0, borderWidth: 2, showLine: true, tension: 0.2 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "top", labels: { boxWidth: 12, font: { size: 11, family: "'Space Grotesk', sans-serif" }, color: "#a9bdd4" } } },
        scales: {
          x: { title: { display: true, text: "Distance (m)", color: "#71809a" }, min: 0, max: 1500, ticks: { color: "#71809a" }, grid: { color: "rgba(126,166,255,0.08)" } },
          y: { title: { display: true, text: "Watts", color: "#71809a" }, beginAtZero: false, ticks: { color: "#71809a" }, grid: { color: "rgba(126,166,255,0.08)" } }
        }
      }
    });
  }
  const closePopup = () => { if (popupChart) popupChart.destroy(); overlay.remove(); };
  overlay.querySelector(".rs-close-btn").addEventListener("click", closePopup);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closePopup(); });
}

function finishRace() {
  if (simulation) simulation.pause();
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  lastFrameTime = null;
  const lb = document.getElementById("liveBadge");
  if (lb) lb.classList.remove("live");
  stopBtn.disabled = true;
  stopBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';

  const b1 = simulation.boats.boat1;
  const b2 = simulation.boats.boat2;
  if (b1.finishDisplayTime !== null && b2.finishDisplayTime !== null && !commentary._commentedVictory) {
    const winner = b1.finishDisplayTime < b2.finishDisplayTime ? "boat1" : "boat2";
    const wName = commentary.boatName(winner);
    const margin = Math.abs(b1.finishDisplayTime - b2.finishDisplayTime);
    if (margin < 0.5) {
      commentary.add("finish", commentary.pick(
        `${wName} gets the BOWBALL on the line! UNBELIEVABLE!`,
        `PHOTO FINISH! ${wName} wins by a FRACTION!`,
        `${wName} wins a HEART-STOPPER! That was INCREDIBLE!`,
        `${wName} takes it by INCHES! That was NERVE-WRACKING!`,
        `BY A CANVAS! ${wName} snatches VICTORY from the jaws of defeat!`
      ));
    } else {
      commentary.add("finish", commentary.pick(
        `${wName} TAKES THE WIN!`,
        `${wName} crosses the line first. a CONVINCING victory!`,
        `${wName} storms to victory! ABSOLUTELY DOMINANT!`,
        `${wName} with the win. they were the better crew today!`,
        `${wName} wins COMFORTABLY! No doubt about the better crew!`,
        `${wName} sails home! A MASTERCLASS in rowing!`
      ));
    }
  }
}

function _buildBoatRowers(boatKey) {
  return boats[boatKey].map((id, i) => {
    if (!id) return null;
    const r = { ...findRower(id) };
    r._seatIdx = i;
    r._seatSide = i % 2 === 0 ? 'port' : 'starboard';
    return r;
  }).filter(Boolean);
}

function _runQuickRace(rowers1, rowers2, cox1, cox2, execFactor1, execFactor2) {
  const sim = new RaceSimulation(rowers1, rowers2, cox1, cox2, true);
  sim.boats.boat1.chemistry = rowers1.length >= 2 ? computeChemistry(rowers1) : 0;
  sim.boats.boat2.chemistry = rowers2.length >= 2 ? computeChemistry(rowers2) : 0;
  sim.boats.boat1.executionFactor = execFactor1;
  sim.boats.boat2.executionFactor = execFactor2;
  sim.boats.boat1.startEF = 1;
  sim.boats.boat2.startEF = 1;
  sim.boats.boat1.middleMoveEF = 1;
  sim.boats.boat2.middleMoveEF = 1;
  sim.boats.boat1.sprintEF = 1;
  sim.boats.boat2.sprintEF = 1;
  sim.start();
  const dt = 0.2;
  let maxTicks = 5000;
  while (!sim.finished && maxTicks-- > 0) sim.tick(dt);
  const t1 = sim.boats.boat1.finishDisplayTime;
  const t2 = sim.boats.boat2.finishDisplayTime;
  if (t1 === null || t2 === null) return null;
  return { margin: t2 - t1, boat1Won: t1 < t2 };
}

function computeWinProbs() {
  const rowers1 = _buildBoatRowers("boat1");
  const rowers2 = _buildBoatRowers("boat2");
  const cox1 = boatCoxswains.boat1 ? { ...findCoxswain(boatCoxswains.boat1) } : null;
  const cox2 = boatCoxswains.boat2 ? { ...findCoxswain(boatCoxswains.boat2) } : null;
  if (rowers1.length === 0 || rowers2.length === 0) return null;

  let totalMargin = 0;
  let wins1 = 0;
  const N = 100;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const ef1 = 0.95 + t * 0.10;
    const ef2 = 1.05 - t * 0.10;
    const result = _runQuickRace(rowers1, rowers2, cox1, cox2, ef1, ef2);
    if (!result) continue;
    totalMargin += result.margin;
    if (result.boat1Won) wins1++;
  }
  const avgMargin = totalMargin / N;
  const prob1 = wins1 / N;
  return { prob1: prob1 * 100, prob2: (1 - prob1) * 100, margin: avgMargin };
}

function confidenceLabel(prob) {
  if (prob < 20) return "Coughing Baby";
  if (prob < 30) return "No Chance";
  if (prob < 40) return "Disadvantage";
  if (prob <= 60) return "Coin Flip";
  if (prob < 70) return "Slight Edge";
  if (prob < 80) return "Heavy Favorite";
  return "Hydrogen Bomb";
}

function updateWinProbs() {
  const el = document.getElementById("winProbs");
  const probs = computeWinProbs();
  const p1n = probs ? probs.prob1 : 50;
  const p2n = probs ? probs.prob2 : 50;
  let marginHtml = "";
  if (probs) {
    const fav = probs.prob1 >= probs.prob2 ? "RP" : "TC";
    const absMargin = Math.abs(probs.margin);
    marginHtml = `<span class="wp-margin">${fav} by ${absMargin.toFixed(1)}s</span>`;
  }
  const p1 = probs ? probs.prob1.toFixed(1) + "%" : "--";
  const p2 = probs ? probs.prob2.toFixed(1) + "%" : "--";
  const c1 = probs ? confidenceLabel(probs.prob1) : "--";
  const c2 = probs ? confidenceLabel(probs.prob2) : "--";
  el.innerHTML = `
    <div class="wp-block">
      <div class="wp-bar">
        <span class="wp-seg wp-seg-1" style="width:${p1n.toFixed(2)}%"></span>
        <span class="wp-seg wp-seg-2" style="width:${p2n.toFixed(2)}%"></span>
        <span class="wp-notch"></span>
      </div>
      <div class="wp-chips">
        <span class="wp-boat wp-boat1"><span class="wp-label">RP</span><span class="wp-pct">${p1}</span><span class="wp-conf">${c1}</span></span>
        <span class="wp-vs">vs</span>
        <span class="wp-boat wp-boat2"><span class="wp-label">TC</span><span class="wp-pct">${p2}</span><span class="wp-conf">${c2}</span></span>
        ${marginHtml}
      </div>
    </div>
  `;
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

function formatSplitFromSec(secPer500) {
  if (!secPer500 || secPer500 <= 0) return "--:--";
  const m = Math.floor(secPer500 / 60);
  const s = (secPer500 % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

let _cachedFinishPct = 100;
let _cachedTrackW = 0;
function _updateFinishPct() {
  const trackEl = document.querySelector(".lane-track");
  const finishEl = document.querySelector(".finish-line");
  if (!trackEl || !finishEl) return;
  _cachedTrackW = trackEl.offsetWidth;
  const trackRect = trackEl.getBoundingClientRect();
  const finishRect = finishEl.getBoundingClientRect();
  const trackWidth = trackRect.width;
  if (trackWidth <= 0) return;
  const bowOffset = ((100 - (-20)) / 140) * 92;
  const finishLeft = finishRect.left - trackRect.left;
  _cachedFinishPct = Math.min(100, Math.max(0, 100 * (finishLeft - bowOffset) / (trackWidth - 92)));
}
function getBowFinishPct() {
  return _cachedFinishPct;
}
window.addEventListener("resize", _updateFinishPct);
window.addEventListener("load", () => setTimeout(_updateFinishPct, 60));
if (document.readyState !== "loading") setTimeout(_updateFinishPct, 60);
else document.addEventListener("DOMContentLoaded", () => setTimeout(_updateFinishPct, 60));

function updateDistanceSpeedDisplay(state) {
  if (!state) return;
  const gapChip = document.getElementById("gapChip");
  if (gapChip) {
    if (!simulation || simulation.simTime <= 0.01) {
      gapChip.textContent = "\u2014";
      gapChip.dataset.leader = "0";
    } else {
      const diff = state.boat1.displayDistance - state.boat2.displayDistance;
      if (Math.abs(diff) < 0.5) {
        gapChip.textContent = "Dead level";
        gapChip.dataset.leader = "0";
      } else {
        gapChip.textContent = (diff > 0 ? "RP +" : "TC +") + Math.abs(diff).toFixed(1) + " m";
        gapChip.dataset.leader = diff > 0 ? "1" : "2";
      }
    }
  }
  document.getElementById("t1-dist").textContent = Math.ceil(state.boat1.displayDistance) + " m";
  document.getElementById("t2-dist").textContent = Math.ceil(state.boat2.displayDistance) + " m";
  document.getElementById("t1-speed").textContent = state.boat1.speed.toFixed(2) + " m/s";
  document.getElementById("t2-speed").textContent = state.boat2.speed.toFixed(2) + " m/s";
}

function updateTimeDisplay(state) {
  if (!state) return;
  const dt = state.displayTime;
  const raceClockNode = document.getElementById("raceClock");
  if (raceClockNode) raceClockNode.textContent = formatRealTime(dt);
  document.getElementById("t1-time").textContent = formatRealTime(state.boat1.finishDisplayTime !== null ? state.boat1.finishDisplayTime : dt);
  document.getElementById("t2-time").textContent = formatRealTime(state.boat2.finishDisplayTime !== null ? state.boat2.finishDisplayTime : dt);
  document.getElementById("t1-rate").textContent = (state.boat1.strokeRate || 0) + " spm";
  document.getElementById("t2-rate").textContent = (state.boat2.strokeRate || 0) + " spm";
  const _hdg1 = ((state.boat1.headingAngle || 0) * (180 / Math.PI)).toFixed(1);
  const _hdg2 = ((state.boat2.headingAngle || 0) * (180 / Math.PI)).toFixed(1);
  document.getElementById("t1-steer").innerHTML = `${_hdg1}<i class="fa-solid fa-arrow-up steer-needle" style="transform:rotate(${_hdg1}deg)"></i>`;
  document.getElementById("t2-steer").innerHTML = `${_hdg2}<i class="fa-solid fa-arrow-up steer-needle" style="transform:rotate(${_hdg2}deg)"></i>`;
}

function updateCourseMarkers(state) {
  const finishPct = getBowFinishPct();
  const pct1 = Math.min(100, (state.boat1.distance / 750) * finishPct);
  const pct2 = Math.min(100, (state.boat2.distance / 750) * finishPct);
  const trackW = _cachedTrackW;
  if (trackW > 0) {
    const boatWidthPx = 92;
    marker1.style.setProperty('--boat-x', `${(pct1 / 100) * (trackW - boatWidthPx)}px`);
    marker2.style.setProperty('--boat-x', `${(pct2 / 100) * (trackW - boatWidthPx)}px`);
  }
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

startBtn.addEventListener("click", () => {
  if (window._raceCountdownRunning) return;
  if (crewSize("boat1") === 0 && crewSize("boat2") === 0) {
    showAlertPopup("Assign at least one rower to a boat before starting the race.");
    return;
  }
  if (crewSize("boat1") > 0 && !boatCoxswains.boat1) {
    showAlertPopup("Richard Paul needs a coxswain before the race can start.");
    return;
  }
  if (crewSize("boat2") > 0 && !boatCoxswains.boat2) {
    showAlertPopup("The Challenger needs a coxswain before the race can start.");
    return;
  }
  window._raceCountdownRunning = true;
  startBtn.disabled = true;
  const go = () => {
    window._raceCountdownRunning = false;
    startRace();
  };
  if (typeof window.fxCountdown === "function") window.fxCountdown(go);
  else go();
});
stopBtn.addEventListener("click", togglePause);
resetBtn.addEventListener("click", resetRaceState);
resultsBtn.addEventListener("click", () => showRaceSummaryPopup());
document.getElementById("hofBtn").addEventListener("click", showHallOfFamePopup);

document.querySelectorAll(".btn-lineup").forEach(btn => {
  btn.addEventListener("click", () => {
    const boatKey = btn.dataset.boat;
    showLineupPopup(boatKey);
  });
});

document.querySelectorAll(".btn-randomize").forEach(btn => {
  btn.addEventListener("click", () => {
    const boatKey = btn.dataset.boat;
    randomizeBoat(boatKey);
  });
});

// ---------- Hall of Fame ----------

function computeDecorationScore(person, type) {
  let pts = 0;
  const medals = getMedalsForPerson(person.name, type);
  medals.forEach(m => {
    if (m.placement === "Gold") pts += 5;
    else if (m.placement === "Silver") pts += 3;
    else if (m.placement === "Bronze") pts += 2;
  });
  (person.individualAwards || []).forEach(a => {
    if (a.award === "First Team") pts += 4;
    else if (a.award === "Second Team") pts += 2.5;
    else if (a.award === "Honorable Mention") pts += 1.5;
    else if (a.award === "Most Valuable Player") pts += 1;
    else if (a.award === "Hammer") pts += 1;
  });
  if (person.captain) pts += 1;
  return pts;
}

function getHallOfFameData() {
  const validRowers = rowers.filter(r => r.twoK && parseScoreToSeconds(r.twoK));

  // Fastest Erg (lowest 2k time)
  const fastestErg = validRowers.reduce((a, b) =>
    parseScoreToSeconds(a.twoK) < parseScoreToSeconds(b.twoK) ? a : b
  );

  // Pound for Pound (watts / weight)
  const pfp = validRowers
    .filter(r => r.weight && r.weight > 0)
    .map(r => ({ rower: r, ratio: scoreToWatts(r.twoK) / r.weight }))
    .sort((a, b) => b.ratio - a.ratio);
  const poundForPound = pfp[0];

  // Most Decorated (rowers + coxswains)
  const decorated = [
    ...validRowers.map(r => ({ rower: r, score: computeDecorationScore(r, 'rower'), type: 'rower' })),
    ...(coxswains || []).map(c => ({ rower: c, score: computeDecorationScore(c, 'coxswain'), type: 'coxswain' }))
  ].sort((a, b) => b.score - a.score);
  const mostDecorated = decorated[0];

  // Greatest Boat (highest lineup OVR)
  let greatestBoat = null;
  let bestOvr = -1;
  LINEUPS_DATA.forEach(lu => {
    const ovr = computeLineupOVR(lu);
    if (ovr > bestOvr) {
      bestOvr = ovr;
      greatestBoat = { lineup: lu, ovr };
    }
  });

  return { fastestErg, poundForPound, mostDecorated, greatestBoat };
}

function showHallOfFamePopup() {
  const data = getHallOfFameData();
  const overlay = document.createElement("div");
  overlay.className = "hof-overlay";

  const format2k = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
  };

  // Build awards detail for Most Decorated
  const decRower = data.mostDecorated.rower;
  const decType = data.mostDecorated.type || 'rower';
  const decAwards = [];
  getMedalsForPerson(decRower.name, decType).forEach(m => {
    decAwards.push(`${m.year} ${m.placement} (${m.boat})`);
  });
  (decRower.individualAwards || []).forEach(a => {
    decAwards.push(`${a.year} ${a.award}`);
  });
  if (decRower.captain) decAwards.push("Team Captain");
  const awardsDetail = decAwards.join(' <i class="fa-solid fa-circle dot-sep"></i> ') || '<i class="fa-solid fa-minus hof-none"></i>';

  overlay.innerHTML = `
    <div class="hof-card">
      <div class="hof-glow"></div>
      <button class="hof-close"><i class="fa-solid fa-xmark"></i></button>
      <div class="hof-header">
        <div class="hof-header-icon"><i class="fa-solid fa-trophy"></i></div>
        <div class="hof-title">Hall of Fame</div>
        <div class="hof-sub hof-sub-years">(2025 <i class="fa-solid fa-arrow-right-long hof-year-arrow"></i> Present)</div>
      </div>
      <div class="hof-grid">
        <div class="hof-category" style="--hof-delay:0.1s">
          <div class="hof-cat-icon"><i class="fa-solid fa-gauge-high"></i></div>
          <div class="hof-cat-label">Fastest Erg</div>
          <div class="hof-cat-name">${data.fastestErg.name}</div>
          <div class="hof-cat-value">${data.fastestErg.twoK}</div>
          <div class="hof-cat-detail">${scoreToWatts(data.fastestErg.twoK)} W</div>
        </div>
        <div class="hof-category" style="--hof-delay:0.2s">
          <div class="hof-cat-icon"><i class="fa-solid fa-weight-scale"></i></div>
          <div class="hof-cat-label">Pound for Pound</div>
          <div class="hof-cat-name">${data.poundForPound.rower.name}</div>
          <div class="hof-cat-value">${data.poundForPound.ratio.toFixed(2)} Power/Weight</div>
          <div class="hof-cat-detail">${data.poundForPound.rower.weight} lbs <i class="fa-solid fa-circle dot-sep"></i> ${data.poundForPound.rower.twoK}</div>
        </div>
        <div class="hof-category" style="--hof-delay:0.3s">
          <div class="hof-cat-icon"><i class="fa-solid fa-crown"></i></div>
          <div class="hof-cat-label">Most Decorated</div>
          <div class="hof-cat-name">${data.mostDecorated.rower.name}</div>
          <div class="hof-cat-value">${data.mostDecorated.score} pts</div>
          <div class="hof-cat-detail hof-awards-detail">${awardsDetail}</div>
        </div>
        <div class="hof-category" style="--hof-delay:0.4s">
          <div class="hof-cat-icon"><i class="fa-solid fa-ship"></i></div>
          <div class="hof-cat-label">Greatest Boat</div>
          <div class="hof-cat-name">${data.greatestBoat.lineup.name} (${data.greatestBoat.lineup.year})</div>
          <div class="hof-cat-value">${data.greatestBoat.ovr} OVR</div>
          <div class="hof-cat-detail">${data.greatestBoat.lineup.rowers.join(' <i class="fa-solid fa-circle dot-sep"></i> ')}</div>
        </div>
      </div>
    </div>
  `;

  overlay.querySelector(".hof-close").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  // trigger entrance animation
  requestAnimationFrame(() => overlay.querySelector(".hof-card").classList.add("hof-card-visible"));
}

// ---------- Init ----------

function seedDefaultBoats() {
  // Showcase state: strongest 8 in boat1, next 8 in boat2, coxswains paired up.
  const seatCount = Math.min(SEATS_PER_BOAT, rowers.length);
  for (let i = 0; i < seatCount; i++) {
    boats.boat1[i] = rowers[i].id;
  }
  const boat2Count = Math.min(SEATS_PER_BOAT, Math.max(0, rowers.length - SEATS_PER_BOAT));
  for (let i = 0; i < boat2Count; i++) {
    boats.boat2[i] = rowers[SEATS_PER_BOAT + i].id;
  }
  if (coxswains.length > 0 && !boatCoxswains.boat1) {
    boatCoxswains.boat1 = (coxswains.find(c => (c.name || "").includes("James Millward")) || coxswains[coxswains.length - 1]).id;
  }
  if (coxswains.length > 1 && !boatCoxswains.boat2) {
    boatCoxswains.boat2 = (coxswains.find(c => (c.name || "").includes("Alexander Tran")) || coxswains[0]).id;
  }
}

function init() {
  loadRowers();
  loadLineups();
  loadCoxswains();
  seedDefaultBoats();
  renderAll();
  initChart();
  resetRaceState();
}

init();
