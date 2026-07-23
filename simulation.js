class RaceSimulation {
  constructor(boat1Rowers, boat2Rowers) {
    this.boats = {
      boat1: this._initBoat(boat1Rowers),
      boat2: this._initBoat(boat2Rowers),
    };
    this.simTime = 0;
    this.running = false;
    this.finished = false;
  }

  _initBoat(rowers) {
    return {
      rowers: rowers.map(r => ({ ...r })),
      distance: 0,
      speed: 0,
      strokeRate: 18,
      strokePhase: 0,
      strokeCount: 0,
      finishSimTime: null,
      finishDisplayTime: null,
      fullCurve: null,
      displayCurve: null,
      rowerData: null,
      totalWatts: 0,
      split500: 0,
      _strokeFrozen: false,
      _finishSpeed: 0,
      _finishDisplayDist: 0,
    };
  }

  _getTargetRate(strokeCount, distanceFraction) {
    if (distanceFraction >= 0.8) return 38;
    if (strokeCount < 5) return [20, 26, 32, 38, 40][strokeCount];
    return 36;
  }

  _getPhaseMultiplier(strokeCount, distanceFraction, mentality) {
    if (distanceFraction >= 0.8) return 1.20;
    if (strokeCount < 5) return 1.20;
    return 0.85 + 0.03 * Math.max(0, Math.min(5, mentality || 0));
  }

  _computeRowerOutput(rower, strokeCount, distanceFraction) {
    const phaseMult = this._getPhaseMultiplier(strokeCount, distanceFraction, rower.mentality);
    const raceFrac = Math.min(1, distanceFraction);
    const ment = Math.min(5, Math.max(0, rower.mentality || 0));
    const decayPower = 1 - raceFrac * 0.15 * (1 - ment / 5);
    const decayTech = 1 - raceFrac * 0.12 * (1 - ment / 5);
    const wattVar = (Math.random() - 0.5) * 50;
    const techVar = (Math.random() - 0.5) * 0.7;
    const baseTech = rower._seatSide === 'port'
      ? (rower.port || 0)
      : (rower.starboard || 0);
    const effPower = Math.round(rower.power * phaseMult * decayPower + wattVar);
    const effTech = Math.max(0.5, Math.min(5, baseTech * decayTech + techVar));
    return {
      name: rower.name,
      seatIdx: rower._seatIdx,
      basePower: rower.power,
      baseTech: Math.round(baseTech * 10) / 10,
      effPower,
      effTech: Math.round(effTech * 100) / 100,
      techMod: Math.round(techVar * 100) / 100,
    };
  }

  _computeSpeed(totalWatts, avgTech, rate) {
    const rawSpeed = Math.cbrt(Math.max(totalWatts, 1)) * 0.48;
    const techFactor = 0.85 + 0.03 * avgTech;
    const rateFactor = 0.7 + 0.0075 * rate;
    const waterResistance = 0.84;
    return Math.max(0.1, rawSpeed * techFactor * rateFactor * waterResistance);
  }

  _generateCurve(totalWatts, avgTech) {
    const points = 21;
    const peak = totalWatts * 0.5;
    const techVal = Math.min(5, Math.max(0, avgTech || 5));
    const noiseLevel = (5 - techVal) / 5;
    const maxJitter = noiseLevel * peak * 0.12;
    const curve = [];
    for (let i = 0; i < points; i++) {
      const t = i / (points - 1);
      const skewed = Math.pow(t, 0.65);
      let value = peak * Math.pow(Math.sin(Math.PI * skewed), 1.6);
      const phaseMod = Math.sin(Math.PI * skewed);
      const jitter = (Math.random() - 0.5) * 2 * maxJitter * phaseMod;
      curve.push(Math.round(Math.max(0, value + jitter)));
    }
    return curve;
  }

  _buildDisplayCurve(fullCurve, phase) {
    if (!fullCurve) return null;
    const drivePortion = 0.35;
    if (phase >= drivePortion) return fullCurve;
    const progress = phase / drivePortion;
    const visible = Math.floor(progress * fullCurve.length);
    return fullCurve.map((v, i) => (i <= visible ? v : null));
  }

  _completeStroke(boat, distFrac) {
    const targetRate = this._getTargetRate(boat.strokeCount, distFrac);
    boat.strokeRate = Math.max(18, targetRate + Math.round((Math.random() - 0.5) * 2));
    boat.strokeCount++;
    const outputs = boat.rowers.map(r =>
      this._computeRowerOutput(r, boat.strokeCount - 1, distFrac)
    );
    boat.rowerData = outputs;
    boat.totalWatts = outputs.reduce((s, r) => s + r.effPower, 0);
    const avgTech = outputs.reduce((s, r) => s + r.effTech, 0) / outputs.length;
    const speedNoise = 0.985 + Math.random() * 0.03;
    boat.speed = this._computeSpeed(boat.totalWatts, avgTech, boat.strokeRate) * speedNoise;
    boat.fullCurve = this._generateCurve(boat.totalWatts, avgTech);
    if (boat.speed > 0) boat.split500 = 500 / boat.speed;
  }

  tick(dt) {
    if (!this.running || this.finished) return;

    this.simTime += dt;

    for (const key of ['boat1', 'boat2']) {
      const boat = this.boats[key];
      if (boat.finishSimTime !== null && boat.speed < 0.05) continue;
      if (boat.rowers.length === 0) continue;

      if (boat.finishSimTime !== null) {
        if (!boat._strokeFrozen) {
          const prevPhase = boat.strokePhase;
          boat.strokePhase = (boat.strokePhase + boat.strokeRate / 60 * dt) % 1;
          if (boat.strokePhase < prevPhase) {
            boat.strokePhase = 1;
            boat._strokeFrozen = true;
          }
        }
        boat.distance += boat.speed * dt;
        boat.speed *= Math.max(0, 1 - dt * 0.35);
        continue;
      }

      if (boat.speed === 0) {
        const baseTotal = boat.rowers.reduce((s, r) => s + (r.power || 0), 0);
        const baseTech = boat.rowers.reduce((s, r) => s + (r._seatSide === 'port' ? (r.port || 0) : (r.starboard || 0)), 0) / boat.rowers.length;
        boat.speed = this._computeSpeed(baseTotal * 1.2, baseTech, 20);
        boat.totalWatts = Math.round(baseTotal * 1.2);
      }

      const distFrac = boat.distance / 750;

      const prevPhase = boat.strokePhase;
      boat.strokePhase = (boat.strokePhase + boat.strokeRate / 60 * dt) % 1;

      if (boat.strokePhase < prevPhase) {
        this._completeStroke(boat, distFrac);
      }

      boat.displayCurve = this._buildDisplayCurve(boat.fullCurve, boat.strokePhase);
      boat.distance += boat.speed * dt;

      if (boat.distance >= 750 && boat.finishSimTime === null) {
        this._completeStroke(boat, Math.min(1, distFrac));
        boat.displayCurve = boat.fullCurve;
        boat._finishSpeed = boat.speed;
        boat._finishDisplayDist = 1500;
        boat.finishSimTime = this.simTime;
        boat.finishDisplayTime = this.simTime * 2;
      }
    }

    const b1done = this.boats.boat1.rowers.length === 0 || (this.boats.boat1.finishSimTime !== null && this.boats.boat1.speed < 0.05);
    const b2done = this.boats.boat2.rowers.length === 0 || (this.boats.boat2.finishSimTime !== null && this.boats.boat2.speed < 0.05);
    if (b1done && b2done) {
      this.finished = true;
      this.running = false;
    }
  }

  getBoatState(key) {
    const b = this.boats[key];
    return {
      distance: b.distance,
      displayDistance: b.finishSimTime !== null ? b._finishDisplayDist : b.distance * 2,
      speed: b.finishSimTime !== null ? b._finishSpeed : b.speed,
      strokeRate: b.strokeRate,
      strokePhase: b.strokePhase,
      strokeCount: b.strokeCount,
      finishSimTime: b.finishSimTime,
      finishDisplayTime: b.finishDisplayTime,
      displayCurve: b.displayCurve,
      rowerData: b.rowerData,
      totalWatts: b.totalWatts,
      split500: b.split500,
      crewSize: b.rowers.length,
    };
  }

  getState() {
    return {
      running: this.running,
      finished: this.finished,
      simTime: this.simTime,
      displayTime: this.simTime * 2,
      boat1: this.getBoatState('boat1'),
      boat2: this.getBoatState('boat2'),
    };
  }

  start() {
    if (this.finished) this.reset();
    this.running = true;
  }

  pause() {
    this.running = false;
  }

  reset() {
    for (const key of ['boat1', 'boat2']) {
      const b = this.boats[key];
      b.distance = 0;
      b.speed = 0;
      b.strokeRate = 18;
      b.strokePhase = 0;
      b.strokeCount = 0;
      b.finishSimTime = null;
      b.finishDisplayTime = null;
      b.fullCurve = null;
      b.displayCurve = null;
      b.rowerData = null;
      b.totalWatts = 0;
      b.split500 = 0;
    }
    this.simTime = 0;
    this.running = false;
    this.finished = false;
  }
}
