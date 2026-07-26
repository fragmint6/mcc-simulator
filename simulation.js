class RaceSimulation {
  constructor(boat1Rowers, boat2Rowers, boat1Coxswain, boat2Coxswain, deterministic = false) {
    this.boats = {
      boat1: this._initBoat(boat1Rowers, boat1Coxswain),
      boat2: this._initBoat(boat2Rowers, boat2Coxswain),
    };
    this.simTime = 0;
    this.running = false;
    this.finished = false;
    this.deterministic = deterministic;
  }

  _initBoat(rowers, coxswain) {
    return {
      rowers: rowers.map(r => ({ ...r })),
      coxswain: coxswain ? { ...coxswain } : null,
      centerX: 0,
      centerY: 0,
      headingAngle: 0,
      totalDistTraveled: 0,
      boatLength: 17.6,
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
      _impulseThisStroke: 0,
      _steeringTarget: 0,
      _steeringTimer: 0,
      executionFactor: 1.0,
      startEF: 1.0,
      middleMoveEF: 1.0,
      sprintEF: 1.0,
      middleMoveRemaining: undefined,
    };
  }

  _getTargetRate(strokeCount, distanceFraction, coxswain, sprinting) {
    if (sprinting || distanceFraction >= 0.8) {
      const mot = coxswain ? Math.max(0, Math.min(5, coxswain.motivation || 0)) : 0;
      return 34 + Math.round(mot * 0.4);
    }
    if (strokeCount < 5) return [20, 30, 36, 38, 40][strokeCount];
    return 36;
  }

  _getPhaseMultiplier(strokeCount, distanceFraction, rower, coxswain, sprinting) {
    const power = rower.power || 250;
    const powerFactor = Math.max(0.6, Math.min(1.3, power / 340));
    const ment = Math.min(5, Math.max(0, rower.mentality || 0));
    if (sprinting || distanceFraction >= 0.8) {
      const mot = coxswain ? Math.max(0, Math.min(5, coxswain.motivation || 0)) : 0;
      return 0.98 + mot * 0.015 + 0.10 * powerFactor;
    }
    if (strokeCount < 5) return 1.05 + 0.15 * powerFactor;
    return 0.85 + 0.03 * ment;
  }

  _computeRowerOutput(rower, strokeCount, distanceFraction, coxswain, executionFactor = 1, sprinting = false) {
    const phaseMult = this._getPhaseMultiplier(strokeCount, distanceFraction, rower, coxswain, sprinting);
    const raceFrac = Math.min(1, distanceFraction);
    const ment = Math.min(5, Math.max(0, rower.mentality || 0));
    const strat = coxswain ? Math.max(0, Math.min(5, coxswain.strategy || 0)) : 0;
    const techCalls = coxswain ? Math.max(0, Math.min(5, coxswain.tech_calls || 0)) : 0;
    const decayPower = 1 - raceFrac * 0.20 * (1 - ment / 5) * (1 - strat * 0.10);
    const decayTech = 1 - raceFrac * 0.18 * (1 - ment / 5) * (1 - techCalls * 0.10);
    const wattVar = this.deterministic ? 0 : (Math.random() - 0.5) * 50;
    const techVar = this.deterministic ? 0 : (Math.random() - 0.5) * 1.4;
    const baseTech = rower._seatSide === 'port'
      ? (rower.port || 0)
      : (rower.starboard || 0);
    const rawPower = Math.round(rower.power * phaseMult * decayPower + wattVar);
    const effPower = Math.round(rawPower * executionFactor * 10) / 10;
    const effTech = Math.max(0.5, Math.min(5, (baseTech * decayTech + techVar) * executionFactor));
    return {
      name: rower.name,
      seatIdx: rower._seatIdx,
      weight: rower.weight || 0,
      basePower: rower.power,
      baseTech: Math.round(baseTech * 10) / 10,
      effPower,
      effTech: Math.round(effTech * 100) / 100,
      techMod: Math.round(techVar * 100) / 100,
    };
  }

  _getMassFactor(rowers, coxswain) {
    const crewWeight = rowers.reduce((s, r) => s + (r.weight || 100), 0);
    const coxWeight = coxswain ? (coxswain.weight || 105) : 0;
    const raw = 1535 / (crewWeight + coxWeight + 100);
    return 1 + (raw - 1) * 0.6;
  }

  _generateCurve(totalWatts, avgTech) {
    const points = 21;
    const peak = totalWatts * 0.5;
    const techVal = Math.min(5, Math.max(0.1, avgTech || 5));
    const noiseLevel = (5 - techVal) / 5;
    const maxJitter = noiseLevel * peak * 0.22;
    const skewBase = this.deterministic ? 0.7 : 0.65 + Math.random() * 0.1;
    const startPow = this.deterministic ? 1.0 : 0.85 + Math.random() * 0.3;
    const endPow = this.deterministic ? 1.45 : 1.2 + Math.random() * 0.5;
    const frac = Math.pow(techVal / 5, 0.5);
    const baseStart = 60 * frac;
    const baseEnd = -35 * frac;
    const startAngle = Math.max(0, Math.min(60, baseStart + (this.deterministic ? 0 : (Math.random() - 0.5) * 5)));
    const endAngle = Math.max(-35, Math.min(0, baseEnd + (this.deterministic ? 0 : (Math.random() - 0.5) * 5)));
    const range = startAngle - endAngle;
    const curve = [];
    for (let i = 0; i < points; i++) {
      const angle = startAngle - i * range / (points - 1);
      const t = i / (points - 1);
      const skewed = Math.pow(t, skewBase);
      let value = peak * Math.pow(Math.sin(Math.PI * skewed), skewed <= 0.5 ? startPow : endPow);
      const phaseMod = Math.sin(Math.PI * skewed);
      const jitter = this.deterministic ? 0 : (Math.random() - 0.5) * 2 * maxJitter * phaseMod;
      curve.push({ x: Math.round(angle), y: Math.round(Math.max(0, value + jitter)) });
    }
    return curve;
  }

  _buildDisplayCurve(fullCurve, phase) {
    if (!fullCurve) return null;
    const firstNZ = fullCurve.findIndex(v => v.y > 0);
    const lastNZ = fullCurve.length - 1 - [...fullCurve].reverse().findIndex(v => v.y > 0);
    if (firstNZ === -1) return fullCurve;
    const drivePortion = 0.35;
    if (phase >= drivePortion) return fullCurve;
    const progress = phase / drivePortion;
    const visible = Math.floor(firstNZ + progress * (lastNZ - firstNZ));
    return fullCurve.map((v, i) => (i <= visible ? v : { x: v.x, y: null }));
  }

  _completeStroke(boat, distFrac, sprinting) {
    const cox = boat.coxswain;
    const targetRate = this._getTargetRate(boat.strokeCount, distFrac, cox, sprinting);
    boat.strokeRate = Math.max(18, targetRate + (this.deterministic ? 0 : Math.round((Math.random() - 0.5) * 2)));
    boat.strokeCount++;
    let phaseEF;
    if (boat.strokeCount <= 5) {
      phaseEF = boat.startEF !== undefined ? boat.startEF : 1;
    } else if (boat.middleMoveRemaining > 0) {
      phaseEF = boat.middleMoveEF !== undefined ? boat.middleMoveEF : 1;
    } else if (sprinting) {
      phaseEF = boat.sprintEF !== undefined ? boat.sprintEF : 1;
    } else {
      phaseEF = boat.executionFactor !== undefined ? boat.executionFactor : 1;
    }
    const outputs = boat.rowers.map(r =>
      this._computeRowerOutput(r, boat.strokeCount - 1, distFrac, cox, phaseEF, sprinting)
    );
    boat.rowerData = outputs;
    let totalWatts = outputs.reduce((s, r) => s + r.effPower, 0);
    const avgTech = outputs.reduce((s, r) => s + r.effTech, 0) / outputs.length;
    boat.totalWatts = totalWatts;

    // Compute the impulse this stroke will deliver over the drive phase.
    const techFactor = 0.60 + 0.08 * avgTech;
    const rateFactor = 0.7 + 0.0075 * boat.strokeRate;
    const driveDuration = 0.35 / (boat.strokeRate / 60);
    const massFactor = this._getMassFactor(boat.rowers, cox);
    const chemistryFactor = 0.98 + 0.0004 * (boat.chemistry || 0);
    const impulse = totalWatts * techFactor * rateFactor * driveDuration * 0.00028 * massFactor * chemistryFactor;
    boat._impulseThisStroke = impulse;

    boat.fullCurve = this._generateCurve(totalWatts, avgTech);
    if (boat.speed > 0) boat.split500 = 500 / boat.speed;
    if (boat.middleMoveRemaining !== undefined && boat.middleMoveRemaining > 0) {
      boat.middleMoveRemaining--;
    }
  }

  _updateHeading(boat, dt) {
    const hasCox = boat.coxswain !== null;
    const steer = hasCox ? Math.max(0, Math.min(5, boat.coxswain.steering || 0)) : 0;
    const maxAngle = Math.min(0.15, 0.01 + (5 - steer) * 0.025);

    // Random drift — more for bad steering
    if (hasCox) {
      boat._steeringTimer += dt;
      while (boat._steeringTimer >= 1.5) {
        boat._steeringTimer -= 1.5;
        if (!this.deterministic) {
          const driftMag = (5 - steer) * 0.028 + 0.003;
          boat._steeringTarget += (Math.random() - 0.5) * driftMag * 2;
        }
        boat._steeringTarget = Math.max(-maxAngle, Math.min(maxAngle, boat._steeringTarget));
      }

      // Coxswain steers bow toward lane center
      if (steer > 0) {
        const laneCenterPull = -boat.centerY * 0.01;
        boat._steeringTarget += (laneCenterPull - boat._steeringTarget) * Math.min(1, 0.3 * dt);
        boat._steeringTarget = Math.max(-maxAngle, Math.min(maxAngle, boat._steeringTarget));
      }
    }

    boat.headingAngle += (boat._steeringTarget - boat.headingAngle) * Math.min(1, 0.6 * dt);
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
          boat.strokePhase = Math.min(boat.strokePhase + boat.strokeRate / 60 * dt, boat._finishTarget);
          if (boat.strokePhase >= boat._finishTarget) {
            boat._strokeFrozen = true;
            boat.displayCurve = boat.fullCurve;
          } else {
            boat.displayCurve = this._buildDisplayCurve(boat.fullCurve, boat.strokePhase);
          }
        }
        const cosH = Math.cos(boat.headingAngle);
        const sinH = Math.sin(boat.headingAngle);
        const xEff = 1 / (1 + Math.abs(boat.headingAngle) * 0.70);
        boat.centerX += boat.speed * cosH * dt * xEff;
        boat.centerY += boat.speed * sinH * dt;
        boat.centerY = Math.max(-2.0, Math.min(2.0, boat.centerY));
        const pathMult = 1 + Math.abs(boat.headingAngle) * 0.70;
        boat.totalDistTraveled += boat.speed * dt * pathMult;
        const coastAngleDecel = Math.abs(boat.headingAngle) * 0.15 * boat.speed;
        boat.speed -= coastAngleDecel * dt;
        boat.speed *= Math.max(0, 1 - dt * 0.35);
        continue;
      }

      const distFrac = boat.centerX / 750;

      const otherKey = key === 'boat1' ? 'boat2' : 'boat1';
      const otherBoat = this.boats[otherKey];
      const losing = otherBoat.rowers.length > 0 && distFrac < (otherBoat.centerX / 750);

      if (boat.middleMoveRemaining === undefined && distFrac >= 375 / 750 && boat.strokeCount > 0) {
        boat.middleMoveRemaining = 5;
      }
      const middleActive = (boat.middleMoveRemaining || 0) > 0;
      const sprinting = (distFrac >= 550 / 750 && losing) || middleActive;

      // On the very first tick, give the boat a starting speed and impulse so
      // it launches immediately instead of crawling from a dead stop.
      if (boat.strokeCount === 0 && boat._impulseThisStroke === 0) {
        const baseTotal = boat.rowers.reduce((s, r) => s + (r.power || 0), 0) * (boat.executionFactor || 1);
        const baseTech = boat.rowers.reduce((s, r) => s + (r._seatSide === 'port' ? (r.port || 0) : (r.starboard || 0)), 0) / boat.rowers.length;
        const techFactor = 0.60 + 0.08 * baseTech;
        const rateFactor = 0.7 + 0.0075 * 20;
        const driveDuration = 0.35 / (20 / 60);
        const chemFactor = 0.98 + 0.0004 * (boat.chemistry || 0);
        boat._impulseThisStroke = baseTotal * techFactor * rateFactor * driveDuration * 0.00028 * this._getMassFactor(boat.rowers, boat.coxswain) * chemFactor;
        boat.totalWatts = Math.round(baseTotal * 1.2);
        boat.fullCurve = this._generateCurve(boat.totalWatts, baseTech);
        const startEF = boat.startEF !== undefined ? boat.startEF : 1;
        boat.rowerData = boat.rowers.map(r => this._computeRowerOutput(r, 0, 0, null, startEF));
        boat.speed = Math.cbrt(Math.max(baseTotal, 1)) * 0.48 * 0.7;
      }

      let strokeCompleted = false;
      const prevPhase = boat.strokePhase;
      boat.strokePhase = (boat.strokePhase + boat.strokeRate / 60 * dt) % 1;

      const dragCoeff = 0.008;
      const dragDecel = dragCoeff * boat.speed * boat.speed;
      const angleDecel = Math.abs(boat.headingAngle) * 0.15 * boat.speed;
      boat.speed -= (dragDecel + angleDecel) * dt;
      boat.speed = Math.max(0, boat.speed);

      if (boat.strokePhase < 0.35) {
        const driveDuration = 0.35 / (boat.strokeRate / 60);
        const impulseRate = boat._impulseThisStroke / driveDuration;
        boat.speed += impulseRate * dt;
      }

      if (boat.strokePhase < prevPhase) {
        this._completeStroke(boat, distFrac, sprinting);
        strokeCompleted = true;
      }

      this._updateHeading(boat, dt);
      const cosH = Math.cos(boat.headingAngle);
      const sinH = Math.sin(boat.headingAngle);
      const xEff = 1 / (1 + Math.abs(boat.headingAngle) * 0.70);
      boat.centerX += boat.speed * cosH * dt * xEff;
      boat.centerY += boat.speed * sinH * dt;
      boat.centerY = Math.max(-2.0, Math.min(2.0, boat.centerY));
      const pathMult = 1 + Math.abs(boat.headingAngle) * 0.70;
      boat.totalDistTraveled += boat.speed * dt * pathMult;

      boat.displayCurve = this._buildDisplayCurve(boat.fullCurve, boat.strokePhase);

      if (boat.centerX >= 750 && boat.finishSimTime === null) {
        if (!strokeCompleted) {
          this._completeStroke(boat, Math.min(1, distFrac), sprinting);
        }
        boat._finishTarget = boat.strokePhase < 0.35 ? 0.35 : 1.0;
        boat._finishSpeed = boat.speed;
        boat._finishDisplayDist = boat.totalDistTraveled * 2;
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
      distance: b.centerX,
      displayDistance: b.finishSimTime !== null ? b._finishDisplayDist : b.totalDistTraveled * 2,
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
      coxswain: b.coxswain ? { ...b.coxswain } : null,
      centerY: b.centerY,
      headingAngle: b.headingAngle,
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
      b.centerX = 0;
      b.centerY = 0;
      b.headingAngle = 0;
      b.totalDistTraveled = 0;
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
      b._impulseThisStroke = 0;
      b._steeringTarget = 0;
      b._steeringTimer = 0;
      b.middleMoveRemaining = undefined;
    }
    this.simTime = 0;
    this.running = false;
    this.finished = false;
  }
}
