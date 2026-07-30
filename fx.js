/* ==========================================================================
   fx.js — Ambient visual effects for the McLean Crew Simulator
   - Animated water canvas behind the race course (depth-layered waves)
   - "ATTENTION ... GO!" race-start countdown overlay
   - Winner confetti burst
   - Distance tick layout + boot stagger
   ========================================================================== */
(function () {
  "use strict";

  const prefersReduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     Boot stagger: lets the CSS cascade panels/cards in once on load
  ------------------------------------------------------------------ */
  function armBoot() {
    document.body.classList.add("booting");
    setTimeout(() => document.body.classList.remove("booting"), 2100);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", armBoot);
  } else {
    armBoot();
  }

  /* ------------------------------------------------------------------
     Distance ticks: align the 500m / 1000m markers with the same
     bow-finish geometry app.js uses for the boats.
  ------------------------------------------------------------------ */
  function layoutTicks() {
    const trackEl = document.querySelector(".lane-track");
    const finishEl = document.querySelector(".finish-line");
    if (!trackEl || !finishEl) return;
    const trackRect = trackEl.getBoundingClientRect();
    const finishRect = finishEl.getBoundingClientRect();
    const trackWidth = trackRect.width;
    if (trackWidth <= 92) return;
    const bowOffset = ((100 - -20) / 140) * 92;
    const finishLeft = finishRect.left - trackRect.left;
    const finishPct = Math.min(100, Math.max(0, (100 * (finishLeft - bowOffset)) / (trackWidth - 92)));
    document.querySelectorAll(".dist-tick").forEach((t) => {
      const m = Number(t.dataset.m || 0);
      const p = (m / 1500) * finishPct;
      t.style.left = `calc(${p.toFixed(3)}% - ${((p / 100) * 92).toFixed(2)}px)`;
    });
  }
  window.addEventListener("resize", layoutTicks);
  window.addEventListener("load", () => setTimeout(layoutTicks, 60));
  if (document.readyState !== "loading") setTimeout(layoutTicks, 60);
  else document.addEventListener("DOMContentLoaded", () => setTimeout(layoutTicks, 60));

  /* ------------------------------------------------------------------
     Countdown: ATTENTION -> GO! then starts the race.
  ------------------------------------------------------------------ */
  window.fxCountdown = function (go) {
    const overlay = document.getElementById("startOverlay");
    const txt = document.getElementById("cdText");
    const sub = document.getElementById("cdSub");
    if (!overlay || !txt) {
      go();
      return;
    }
    if (prefersReduced) {
      go();
      return;
    }
    const phases = [
      { text: "ATTENTION", sub: "hands on", cls: "cd-attn", dur: 1050 },
      { text: "GO!", sub: "send it", cls: "cd-go", dur: 900 },
    ];
    overlay.classList.add("show");
    let i = 0;
    const run = () => {
      const ph = phases[i];
      txt.textContent = ph.text;
      if (sub) sub.textContent = ph.sub;
      txt.classList.remove("cd-attn", "cd-go");
      void txt.offsetWidth; // restart animation
      txt.classList.add(ph.cls);
      if (i === 1) {
        try { go(); } catch (e) { console.error(e); }
      }
      setTimeout(() => {
        i++;
        if (i < phases.length) run();
        else overlay.classList.remove("show");
      }, ph.dur);
    };
    run();
  };

  /* ------------------------------------------------------------------
     Confetti burst (colors arrays passed by the winner's palette)
  ------------------------------------------------------------------ */
  window.fxConfetti = function (colors) {
    if (prefersReduced) return;
    const palette = colors && colors.length ? colors : ["#38d1ff", "#ff5470", "#f7c948", "#ffffff"];
    const canvas = document.createElement("canvas");
    canvas.className = "confetti-canvas";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    const N = 100;
    const parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        x: Math.random() * canvas.width,
        y: -30 * dpr - Math.random() * canvas.height * 0.35,
        w: (5 + Math.random() * 7) * dpr,
        h: (7 + Math.random() * 9) * dpr,
        vx: (Math.random() - 0.5) * 2.2 * dpr,
        vy: (2.2 + Math.random() * 3.4) * dpr,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.28,
        color: palette[(Math.random() * palette.length) | 0],
        circle: Math.random() < 0.25,
        wobble: Math.random() * Math.PI * 2,
      });
    }
    const start = performance.now();
    const dur = 3400;
    function frame(now) {
      const el = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.wobble += 0.09;
        p.x += p.vx + Math.sin(p.wobble) * 0.9 * dpr;
        p.y += p.vy;
        p.vy += 0.018 * dpr;
        p.rot += p.vr;
        const fade = Math.min(1, Math.max(0, (dur - el - 700) / 700));
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.circle) {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.55 + 0.45 * Math.abs(Math.sin(p.wobble))));
        }
        ctx.restore();
      }
      if (el < dur) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  };

  /* ------------------------------------------------------------------
     Animated water canvas (optimized)
  ------------------------------------------------------------------ */
  function initWater() {
    const canvas = document.getElementById("waterCanvas");
    const course = document.querySelector(".course");
    if (!canvas || !course) return;
    const ctx = canvas.getContext("2d");
    let w = 1, h = 1;
    let running = false;
    let raf = null;
    const t0 = performance.now();
    const dpr = 1; // force 1x to halve pixel count

    // Twinkle specks (reduced count)
    const specks = [];
    for (let i = 0; i < 15; i++) {
      specks.push({
        x: Math.random() * 1.05,
        y: Math.random(),
        sp: 0.02 + Math.random() * 0.05,
        r: 0.7 + Math.random() * 1.5,
        ph: Math.random() * Math.PI * 2,
      });
    }

    // Pre-allocate reused gradient objects
    const waterGrad = ctx.createLinearGradient(0, 0, 0, 1);
    waterGrad.addColorStop(0, "#0c2036");
    waterGrad.addColorStop(0.42, "#0a1a30");
    waterGrad.addColorStop(1, "#050d19");

    function resize() {
      const rect = course.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = w;
      canvas.height = h;
      if (prefersReduced) draw(0);
    }

    function raceBoost() {
      const badge = document.getElementById("liveBadge");
      return badge && badge.classList.contains("live") ? 1.3 : 1;
    }

    function draw(tMs) {
      const t = tMs / 1000;
      const boost = raceBoost();

      // Base water gradient
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, 0, w, h);

      // Slow lateral current gradient
      const sheenX = ((t * 0.02 * boost) % 1.6) - 0.3;
      const sg = ctx.createLinearGradient(w * sheenX - w * 0.3, 0, w * sheenX + w * 0.3, 0);
      sg.addColorStop(0, "rgba(120,200,255,0)");
      sg.addColorStop(0.5, "rgba(120,200,255,0.04)");
      sg.addColorStop(1, "rgba(120,200,255,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);

      // Depth-layered wave sheets (reduced to 2 layers, wider step)
      const layers = [
        { y: 0.35, amp: 6,  len: 0.0050, sp: 0.45, alpha: 0.08, col: "120,200,255" },
        { y: 0.70, amp: 7,  len: 0.0055, sp: -0.35, alpha: 0.07, col: "70,160,230" },
      ];
      for (let li = 0; li < layers.length; li++) {
        const L = layers[li];
        const phase = t * L.sp * boost + li * 2.2;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 14) {
          const y = h * L.y + Math.sin(x * L.len + phase) * L.amp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = `rgba(${L.col},${L.alpha})`;
        ctx.fill();
      }

      // Twinkle specks (reduced)
      for (const s of specks) {
        const x = ((s.x + t * s.sp * 0.08 * boost) % 1.05) * w;
        const tw = 0.5 + 0.5 * Math.sin(t * 1.7 + s.ph);
        ctx.beginPath();
        ctx.arc(x, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,235,255,${(0.03 + 0.06 * tw).toFixed(3)})`;
        ctx.fill();
      }

      // Vignette for depth
      const vg = ctx.createRadialGradient(
        w / 2, h * 0.42, Math.min(w, h) * 0.28,
        w / 2, h * 0.5, Math.max(w, h) * 0.78
      );
      vg.addColorStop(0, "rgba(2,8,18,0)");
      vg.addColorStop(1, "rgba(2,8,18,0.45)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }

    function loop(now) {
      draw(now - t0);
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (!running && !prefersReduced) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    resize();
    window.addEventListener("resize", resize);

    if ("IntersectionObserver" in window && !prefersReduced) {
      const io = new IntersectionObserver(
        (entries) => entries.forEach((e) => (e.isIntersecting ? start() : stop())),
        { threshold: 0.03 }
      );
      io.observe(course);
    } else {
      start();
    }
    if (prefersReduced) {
      resize();
      draw(0);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else if (!prefersReduced) start();
    });
  }

  if (document.readyState !== "loading") initWater();
  else document.addEventListener("DOMContentLoaded", initWater);
})();
