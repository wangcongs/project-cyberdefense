/* =====================================================================
   知识图谱 SVG：L1→L4 横向力导向 · 圆形节点（度数定半径）· 聚焦子图
   忠实移植自原型 drawKG
   ===================================================================== */
import { useEffect, useRef } from "react";
import { state, S, SC, useApp } from "../core/store.js";
import { kgAll, KG_LAYER, KG_PROPS, kgNode } from "../actions/knowledge.js";
import { PZ, svgFocus, svgBlur, pzInit } from "./panzoom.jsx";

/* 布局记忆（跨整图/聚焦切换保留） */
export let KGV = null;

export default function KgSVG() {
  useApp();
  const ref = useRef(null);
  const s = S();
  const sig = [
    state.activeInc,
    s.stage >= 7 ? "done" : "",
    state.kgFocus || "", state.kgHops, state.kgLabels ? "L" : "",
    state.kgCustom.nodes.map((n) => n.id + (n.verified ? "v" : "")).join(),
    state.kgCustom.edges.length,
    Object.keys(KG_PROPS).filter((k) => KG_PROPS[k].some((p) => p.dirty)).join(),
  ].join("|");
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    drawKG(svg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return <svg id="kg-svg" ref={ref} style={{ width: "100%", height: "100%", display: "block" }} preserveAspectRatio="xMidYMid meet"></svg>;
}

function drawKG(svg) {
  if (KGV && KGV.raf) cancelAnimationFrame(KGV.raf);
  const all = kgAll();
  /* 度数决定节点半径 */
  all.nodes.forEach((n) => (n.deg = 0));
  all.edges.forEach(([f, t]) => {
    const x = all.nodes.find((n) => n.id === f), y = all.nodes.find((n) => n.id === t);
    if (x) x.deg++; if (y) y.deg++;
  });
  all.nodes.forEach((n) => { n.r = Math.min(30, 11 + n.deg * 3); });
  /* 聚焦过滤（1~2 度邻域子图） */
  let nodes = all.nodes, edges = all.edges;
  if (state.kgFocus && all.nodes.find((n) => n.id === state.kgFocus)) {
    const keep = new Set([state.kgFocus]);
    const hop = () => edges.forEach(([f, t]) => { if (keep.has(f)) keep.add(t); if (keep.has(t)) keep.add(f); });
    hop(); if (state.kgHops > 1) hop();
    nodes = all.nodes.filter((n) => keep.has(n.id));
    edges = all.edges.filter(([f, t]) => keep.has(f) && keep.has(t));
  } else if (state.kgFocus) { state.kgFocus = null; }
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const W = 1190, H = 626, layerX = [190, 470, 750, 1030];
  /* 位置缓存：跨整图/聚焦切换保留布局记忆 */
  const prev = KGV ? KGV.pos : {};
  nodes.forEach((n, i) => {
    const p = prev[n.id];
    if (p) { n.x = p.x; n.y = p.y; }
    else if (n.x == null) { n.x = layerX[n.layer] + (Math.random() * 140 - 70); n.y = 100 + (i * 57) % 430; }
    n.vx = 0; n.vy = 0;
  });
  /* DOM 骨架 */
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.classList.toggle("show-labels", !!state.kgLabels);
  svg.innerHTML = `<defs>
    <pattern id="kgdots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="1.1" fill="#141f38"/></pattern>
  </defs><rect width="${W}" height="${H}" fill="url(#kgdots)"/>`;
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, at) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const gL = el("g", {}), gT = el("g", {}), gN = el("g", {});
  svg.appendChild(gL); svg.appendChild(gT); svg.appendChild(gN);
  const linkEls = [], labelEls = [];
  edges.forEach(([f, t, lbl, kind]) => {
    const a = byId[f], b = byId[t]; if (!a || !b) return;
    const col = kind === "ai" ? "#a78bfa" : kind === "d3f" ? "#34d399" : kind === "custom" ? "#fbbf24" : "#2c3f63";
    const ln = el("line", { "data-edge": f + "→" + t, stroke: col, "stroke-width": kind ? 1.6 : 1.3, opacity: .75 });
    if (kind) ln.setAttribute("stroke-dasharray", "7 5");
    gL.appendChild(ln); linkEls.push({ el: ln, a, b });
    const tx = el("text", { "class": "klbl" + (kind ? " " + kind : ""), x: 0, y: 0, "text-anchor": "middle" });
    tx.textContent = lbl; gT.appendChild(tx); labelEls.push({ el: tx, a, b });
  });
  const nodeEls = {};
  nodes.forEach((n) => {
    const c = KG_LAYER[n.layer].c;
    const dirtyP = (KG_PROPS[state.activeInc + "|" + n.id] || []).some((p) => p.dirty);
    const g = el("g", { "class": "kgnode pz-nopan", "data-name": n.id });
    const halo = el("circle", { r: n.r + 5, fill: "none", stroke: c, "stroke-width": 1, opacity: .22 });
    const main = el("circle", { r: n.r, fill: c + "1c", stroke: c, "stroke-width": 2, "class": "main" });
    if (dirtyP) {
      const ring = el("circle", { r: n.r + 9, fill: "none", stroke: "#fbbf24", "stroke-width": 1.4, "stroke-dasharray": "3 3", opacity: .9 });
      g.appendChild(ring);
    }
    if (n.custom) {
      const cr = el("circle", { r: n.r + 9, fill: "none", stroke: n.verified ? "#34d399" : "#fbbf24", "stroke-width": 1.5, "stroke-dasharray": "6 4", opacity: .95 });
      const bt = el("text", { y: -(n.r + 8), "text-anchor": "middle", fill: n.verified ? "#34d399" : "#fbbf24", "font-size": 8, "font-family": "monospace", "font-weight": 700 });
      bt.textContent = n.verified ? "人工·已核验" : "人工·待核验";
      g.appendChild(cr); g.appendChild(bt);
    }
    const l1 = el("text", { y: n.r + 17, "text-anchor": "middle", fill: "#dce6f7", "font-size": 11, "font-family": "var(--mono)", "font-weight": 700 });
    l1.textContent = n.l;
    const l2 = el("text", { y: n.r + 30, "text-anchor": "middle", fill: "#8398bd", "font-size": 9 });
    l2.textContent = n.s;
    g.appendChild(halo); g.appendChild(main); g.appendChild(l1); g.appendChild(l2);
    gN.appendChild(g); nodeEls[n.id] = { g, main };
    g.addEventListener("mouseenter", () => {
      svgFocus("kg-svg", n.id);
      labelEls.forEach((x) => { if (x.a === n || x.b === n) x.el.classList.add("hl"); });
    });
    g.addEventListener("mouseleave", () => {
      svgBlur("kg-svg");
      labelEls.forEach((x) => x.el.classList.remove("hl"));
    });
    g.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      const start = { x: e.clientX, y: e.clientY, moved: false };
      const toXY = (ev) => {
        const r = svg.getBoundingClientRect(), vbA = (PZ["kg-svg"] && PZ["kg-svg"].vb) || [0, 0, W, H];
        return [vbA[0] + (ev.clientX - r.left) / r.width * vbA[2], vbA[1] + (ev.clientY - r.top) / r.height * vbA[3]];
      };
      const move = (ev) => {
        if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 4) start.moved = true;
        if (!start.moved) return;
        const [x, y] = toXY(ev); n.x = x; n.y = y; n.vx = 0; n.vy = 0;
        sim.alpha = Math.max(sim.alpha, 0.3);
        if (!sim.running) { sim.running = true; sim.raf = requestAnimationFrame(tick); }
        renderKG();
      };
      const up = () => {
        document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up);
        if (!start.moved) kgSelect(n.id);
      };
      document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
    });
  });
  let selected = state.kgFocus || null;
  function renderKG() {
    linkEls.forEach(({ el: ln, a, b }) => { ln.setAttribute("x1", a.x); ln.setAttribute("y1", a.y); ln.setAttribute("x2", b.x); ln.setAttribute("y2", b.y); });
    labelEls.forEach(({ el: tx, a, b }) => {
      tx.setAttribute("x", (a.x + b.x) / 2); tx.setAttribute("y", (a.y + b.y) / 2 - 5);
    });
    nodes.forEach((n) => {
      const e = nodeEls[n.id]; if (!e) return;
      e.g.setAttribute("transform", `translate(${n.x},${n.y})`);
      e.main.setAttribute("stroke-width", n.id === selected ? 3.6 : 2);
    });
  }
  function kgSelect(id) {
    selected = id;
    renderKG();
    kgNode(id);
  }
  /* 力导向模拟：斥力 + 弹簧 + 层向心（保留 L1→L4 横向叙事） */
  const sim = { alpha: 1, frames: 0, raf: 0, running: true };
  function tick() {
    sim.frames++;
    sim.alpha *= 0.986;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy || 1, d = Math.sqrt(d2);
      const f = Math.min(5200 / d2, 20), fx = dx / d * f, fy = dy / d * f;
      a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
    }
    edges.forEach(([f, t]) => {
      const a = byId[f], b = byId[t]; if (!a || !b) return;
      const rest = (a.layer === b.layer) ? 140 : 250;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const k = (d - rest) * 0.03, fx = dx / d * k, fy = dy / d * k;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    });
    nodes.forEach((n) => {
      n.vx += (layerX[n.layer] - n.x) * 0.013;
      n.vy += (H / 2 - n.y) * 0.005;
      n.vx *= 0.5; n.vy *= 0.5;
      n.x += n.vx; n.y += n.vy;
      n.x = Math.max(75, Math.min(W - 85, n.x));
      n.y = Math.max(60, Math.min(H - 50, n.y));
    });
    renderKG();
    KGV.pos = {}; nodes.forEach((n) => { KGV.pos[n.id] = { x: n.x, y: n.y }; });
    if (sim.frames < 2000 && sim.alpha > 0.012) { sim.raf = requestAnimationFrame(tick); }
    else { sim.running = false; sim.raf = 0; }
  }
  KGV = { pos: {}, raf: 0 };
  tick();
  pzInit("kg-svg");
}
