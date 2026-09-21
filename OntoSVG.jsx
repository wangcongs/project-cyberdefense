/* =====================================================================
   本体核心类关系图 SVG：§5.2 六大类别径向聚类 + 力导向 + 拖拽 + 画布补关系
   ===================================================================== */
import { useEffect, useRef } from "react";
import { state, notify, useApp } from "../core/store.js";
import { ONTO } from "../core/data.js";
import { cst, kgInfo, ontoPickNode } from "../actions/knowledge.js";
import { PZ, svgFocus, svgBlur, pzInit, pzApply } from "./panzoom.jsx";

export const ONTO_BANDS = [
  { t: "现实网络", c: "#22d3ee", cls: ["NetworkDomain", "Asset", "Endpoint", "Server", "Service", "Account"] },
  { t: "安全事件", c: "#fbbf24", cls: ["SecurityEvent", "Incident", "Evidence"] },
  { t: "攻击知识", c: "#f87171", cls: ["AttackTechnique"] },
  { t: "防御知识", c: "#34d399", cls: ["DefenseTechnique", "SecurityProduct", "Capability", "ActionTemplate", "DefenseAction"] },
  { t: "业务影响", c: "#fb923c", cls: ["Mission"] },
  { t: "执行控制", c: "#a78bfa", cls: ["Policy", "DefensePlan", "Approval", "DefenseTask", "ExecutionResult", "EffectReport"] },
];

/* 布局记忆（跨重绘保留节点位置；「自动重排」清空） */
export let ONTOV = null;
export function resetOntoLayout() { ONTOV = null; }

export default function OntoSVG() {
  useApp();
  const ref = useRef(null);
  const sig = [
    ONTO.classes.map((c) => c.name + (c.on ? 1 : 0)).join(),
    ONTO.relations.map((r) => r.name + (r.on ? 1 : 0) + (cst(r) === "published" ? "p" : "")).join(),
    state.ontoFocus || "",
    state.ontoPick ? "pick" + (state.ontoPick.a || "") : "",
    state.ontoLabels ? "L" : "",
  ].join("|");
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    drawOnto(svg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return <svg id="onto-svg" ref={ref} style={{ width: "100%", height: "100%", display: "block" }} preserveAspectRatio="xMidYMid meet"></svg>;
}

function drawOnto(svg) {
  if (ONTOV && ONTOV.raf) cancelAnimationFrame(ONTOV.raf);
  const BANDS = ONTO_BANDS.map((b) => ({ ...b }));
  const known = new Set(BANDS.flatMap((b) => b.cls));
  const extra = ONTO.classes.filter((c) => !known.has(c.name)).map((c) => c.name);
  if (extra.length) BANDS.push({ t: "业务扩展", c: "#e879f9", cls: extra });
  const W = 1180, LEG = 46, H = 640, CX = W / 2, CY = H / 2 + 6;
  const nB = BANDS.length;
  const RX = 460, RY = 208;
  const ANGLES = [180, -120, 120, -60, 60, 0, -90];
  const anchors = BANDS.map((_, i) => {
    const a = (ANGLES[i] !== undefined ? ANGLES[i] : -90 + i * 360 / nB) * Math.PI / 180;
    return [CX + RX * Math.cos(a), CY + RY * Math.sin(a)];
  });
  const NW = 146, NH = 38;
  const nodes = [];
  BANDS.forEach((b, bi) => b.cls.forEach((nm) => {
    if (ONTO.classes.find((z) => z.name === nm)) nodes.push({ name: nm, band: bi, x: 0, y: 0, vx: 0, vy: 0 });
  }));
  const byName = Object.fromEntries(nodes.map((nd) => [nd.name, nd]));
  const edges = [];
  ONTO.relations.forEach((r) => {
    if (!r.on) return;
    const fs = r.from.split("/").map((x) => x.trim()).filter((x) => { const c = ONTO.classes.find((z) => z.name === x); return c && c.on; });
    const ts = r.to.split("/").map((x) => x.trim()).filter((x) => { const c = ONTO.classes.find((z) => z.name === x); return c && c.on; });
    fs.forEach((f) => ts.forEach((t) => edges.push({ f, t, l: r.name, cust: cst(r) !== "published" && !r.core })));
  });
  const prev = ONTOV ? ONTOV.pos : null;
  nodes.forEach((nd) => {
    const p = prev && prev[nd.name], [ax, ay] = anchors[nd.band];
    if (p) { nd.x = p.x; nd.y = p.y; }
    else { nd.x = ax + (Math.random() * 130 - 65); nd.y = ay + (Math.random() * 130 - 65); }
  });
  svg.setAttribute("viewBox", `0 0 ${W} ${H + LEG}`);
  svg.classList.toggle("show-labels", !!state.ontoLabels);
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, at) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  svg.innerHTML = `<defs>
    <pattern id="ontodots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="1.1" fill="#141f38"/></pattern>
    <marker id="oa" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9" fill="#3d5378"/></marker>
    <marker id="oaH" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9" fill="#22d3ee"/></marker>
    <marker id="oaA" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9" fill="#fbbf24"/></marker>
  </defs><rect width="${W}" height="${H + LEG}" fill="url(#ontodots)"/>`;
  const gZ = el("g", {}), gL = el("g", {}), gT = el("g", {}), gN = el("g", {});
  svg.appendChild(gZ); svg.appendChild(gL); svg.appendChild(gT); svg.appendChild(gN);
  /* 聚区（活聚区：随节点簇质心动态包裹） */
  const zoneEls = [];
  BANDS.forEach((b) => {
    const t1 = el("text", { x: 0, y: 0, "text-anchor": "middle", fill: b.c, "font-size": 12, "font-weight": 700, "font-family": "monospace" });
    t1.textContent = b.t;
    const ts = el("tspan", { fill: "#5b6d92", "font-size": 9.5 }); ts.textContent = " " + b.cls.length + " 类";
    t1.appendChild(ts);
    const dot = el("circle", { r: 3.5, fill: b.c });
    const halo = el("circle", { fill: "none", stroke: b.c, "stroke-width": .6, opacity: .22 });
    const main = el("circle", { fill: b.c, "fill-opacity": .05, stroke: b.c, "stroke-width": 1, "stroke-dasharray": "7 5", opacity: .85 });
    gZ.appendChild(halo); gZ.appendChild(main); gZ.appendChild(dot); gZ.appendChild(t1);
    zoneEls.push({ halo, main, dot, t1, b });
  });
  const cem = el("text", { x: CX, y: CY - 5, "text-anchor": "middle", fill: "#1f3050", "font-size": 16, "font-weight": 700, "font-family": "monospace" });
  cem.textContent = "CyberDefenseOntology";
  const cem2 = el("text", { x: CX, y: CY + 13, "text-anchor": "middle", fill: "#182640", "font-size": 9.5, "font-family": "monospace" });
  cem2.textContent = "v1.0 · §5.2 六大类别 Schema";
  gZ.appendChild(cem); gZ.appendChild(cem2);
  /* 关系边 */
  const links = [];
  edges.forEach((e, i) => {
    const a = byName[e.f], b = byName[e.t]; if (!a || !b) return;
    const p = el("path", { class: "oedge" + (e.cust ? " cust" : ""), "data-edge": e.f + "→" + e.t, fill: "none", stroke: e.cust ? "#fbbf24" : "#3d5378", "stroke-width": 1.2, "marker-end": e.cust ? "url(#oaA)" : "url(#oa)" });
    const t = el("text", { class: "olbl", "text-anchor": "middle" });
    t.textContent = e.l;
    gL.appendChild(p); gT.appendChild(t);
    links.push({ p, t, a, b, flip: i % 2 ? 1 : -1 });
  });
  const trim = (f, t) => {
    const dx = t.x - f.x, dy = t.y - f.y;
    const k = Math.min((NW / 2 + 6) / Math.max(Math.abs(dx), 1e-6), (NH / 2 + 6) / Math.max(Math.abs(dy), 1e-6));
    return [f.x + dx * k, f.y + dy * k];
  };
  /* 类节点 */
  const nodeEls = {};
  nodes.forEach((nd) => {
    const b = BANDS[nd.band], c = ONTO.classes.find((z) => z.name === nd.name);
    const col = c.core ? b.c : "#fbbf24", off = !c.on, foc = state.ontoFocus === nd.name;
    const g = el("g", { class: "onode", "data-name": nd.name, opacity: off ? 0.38 : 1 });
    const mk = (t, at) => { const e2 = el(t, at); g.appendChild(e2); return e2; };
    if (foc) mk("rect", { x: -NW / 2 - 6, y: -NH / 2 - 6, width: NW + 12, height: NH + 12, rx: 12, fill: "none", stroke: "#22d3ee", "stroke-width": 1.6, "stroke-dasharray": "5 3" });
    mk("rect", { x: -NW / 2 - 4, y: -NH / 2 - 4, width: NW + 8, height: NH + 8, rx: 11, fill: col, "fill-opacity": .07, stroke: col, "stroke-opacity": .28, "stroke-width": 1 });
    const main = mk("rect", { class: "obox", x: -NW / 2, y: -NH / 2, width: NW, height: NH, rx: 9, fill: foc ? "#0d2a3a" : "#0e1830", stroke: foc ? "#22d3ee" : col, "stroke-width": foc ? 2.2 : (c.core ? 1.4 : 1.6), ...(off ? { "stroke-dasharray": "5 3" } : {}) });
    mk("rect", { x: -NW / 2, y: -NH / 2, width: 4, height: NH, rx: 2, fill: foc ? "#22d3ee" : col });
    const t1 = mk("text", { x: -NW / 2 + 14, y: -2, fill: foc ? "#22d3ee" : col, "font-size": 10.5, "font-family": "monospace", "font-weight": 700 }); t1.textContent = nd.name;
    const t2 = mk("text", { x: -NW / 2 + 14, y: 12, fill: "#8398bd", "font-size": 9 }); t2.textContent = c.cn;
    if (!c.core) {
      mk("rect", { x: NW / 2 - 36, y: -NH / 2 + 5, width: 30, height: 13, rx: 4, fill: "#2b2410", stroke: "#fbbf24", "stroke-width": .8 });
      const nb = mk("text", { x: NW / 2 - 21, y: -NH / 2 + 14.5, "text-anchor": "middle", fill: "#fbbf24", "font-size": 7.5, "font-family": "monospace", "font-weight": 700 }); nb.textContent = "NEW";
    }
    if (off) { const ot = mk("text", { x: NW / 2 - 8, y: 13, "text-anchor": "end", fill: cst(c) === "review" ? "#fbbf24" : "#5b6d92", "font-size": 8, "font-family": "monospace" }); ot.textContent = cst(c) === "review" ? "评审中" : cst(c) === "draft" ? "草稿" : "OFF"; }
    gN.appendChild(g); nodeEls[nd.name] = { g, main };
    g.addEventListener("mouseenter", () => {
      svgFocus("onto-svg", nd.name);
      links.forEach((L) => { if (L.a === nd || L.b === nd) { L.p.classList.add("hl"); L.t.classList.add("hl"); } });
    });
    g.addEventListener("mouseleave", () => {
      svgBlur("onto-svg");
      links.forEach((L) => { L.p.classList.remove("hl"); L.t.classList.remove("hl"); });
    });
    g.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      const start = { x: e.clientX, y: e.clientY, moved: false };
      const toXY = (ev) => {
        const r = svg.getBoundingClientRect(), vbA = (PZ["onto-svg"] && PZ["onto-svg"].vb) || [0, 0, W, H + LEG];
        return [vbA[0] + (ev.clientX - r.left) / r.width * vbA[2], vbA[1] + (ev.clientY - r.top) / r.height * vbA[3]];
      };
      const move = (ev) => {
        if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 4) start.moved = true;
        if (!start.moved) return;
        const [x, y] = toXY(ev); nd.x = x; nd.y = y; nd.vx = 0; nd.vy = 0;
        sim.alpha = Math.max(sim.alpha, 0.35);
        if (!sim.running) { sim.running = true; sim.raf = requestAnimationFrame(tick); }
        renderO();
      };
      const up = () => {
        document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up);
        if (!start.moved) { if (state.ontoPick) ontoPickNode(nd.name); else kgInfo(nd.name); }
      };
      document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
    });
  });
  /* 渲染 */
  function renderO() {
    zoneEls.forEach((Z, bi) => {
      const bs = nodes.filter((nd) => nd.band === bi); if (!bs.length) return;
      let cx = 0, cy = 0; bs.forEach((nd) => { cx += nd.x; cy += nd.y; }); cx /= bs.length; cy /= bs.length;
      let zr = 58; bs.forEach((nd) => { zr = Math.max(zr, Math.hypot(nd.x - cx, nd.y - cy) + 62); });
      Z.main.setAttribute("cx", cx); Z.main.setAttribute("cy", cy); Z.main.setAttribute("r", zr);
      Z.halo.setAttribute("cx", cx); Z.halo.setAttribute("cy", cy); Z.halo.setAttribute("r", zr + 16);
      Z.t1.setAttribute("x", cx); Z.t1.setAttribute("y", cy - zr + 20);
      Z.dot.setAttribute("cx", cx - (Z.b.t.length * 12.5 + 44) / 2); Z.dot.setAttribute("cy", cy - zr + 16);
    });
    links.forEach((L) => {
      if (L.a === L.b) {
        const x = L.a.x, y = L.a.y;
        L.p.setAttribute("d", `M ${x + NW / 2 - 10} ${y - 11} C ${x + NW / 2 + 38} ${y - 42}, ${x + NW / 2 + 38} ${y + 42}, ${x + NW / 2 - 10} ${y + 11}`);
        L.t.setAttribute("x", x + NW / 2 + 52); L.t.setAttribute("y", y + 3);
        return;
      }
      const s = trim(L.a, L.b), e2 = trim(L.b, L.a);
      const mx = (s[0] + e2[0]) / 2, my = (s[1] + e2[1]) / 2;
      const nx = -(e2[1] - s[1]), ny = e2[0] - s[0], len = Math.hypot(nx, ny) || 1;
      const off = Math.min(34, Math.max(10, len * 0.12)) * L.flip;
      const cx = mx + nx / len * off, cy = my + ny / len * off;
      L.p.setAttribute("d", `M ${s[0]} ${s[1]} Q ${cx} ${cy} ${e2[0]} ${e2[1]}`);
      L.t.setAttribute("x", mx * 0.5 + cx * 0.5); L.t.setAttribute("y", my * 0.5 + cy * 0.5 - 4);
    });
    nodes.forEach((nd) => {
      const E2 = nodeEls[nd.name]; if (!E2) return;
      E2.g.setAttribute("transform", `translate(${nd.x},${nd.y})`);
      E2.main.setAttribute("stroke-width", state.ontoFocus === nd.name ? 2.2 : (ONTO.classes.find((z) => z.name === nd.name).core ? 1.4 : 1.6));
    });
    ONTOV.pos = {}; nodes.forEach((nd) => { ONTOV.pos[nd.name] = { x: nd.x, y: nd.y }; });
  }
  /* 力导向 */
  const sim = { alpha: 1, frames: 0, raf: 0, running: true };
  function step() {
    sim.frames++; sim.alpha *= 0.985;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy || 1, d = Math.sqrt(d2);
      const f = Math.min(12000 / d2, 28), fx = dx / d * f, fy = dy / d * f;
      a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
    }
    edges.forEach((e) => {
      const a = byName[e.f], b = byName[e.t]; if (!a || !b || a === b) return;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const k = (d - 210) * 0.016, fx = dx / d * k, fy = dy / d * k;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    });
    nodes.forEach((nd) => {
      const [ax, ay] = anchors[nd.band];
      nd.vx += (ax - nd.x) * 0.032; nd.vy += (ay - nd.y) * 0.032;
      nd.vx += (CX - nd.x) * 0.0022; nd.vy += (CY - nd.y) * 0.0022;
      nd.vx *= 0.55; nd.vy *= 0.55;
      nd.x += nd.vx; nd.y += nd.vy;
      nd.x = Math.max(NW / 2 + 12, Math.min(W - NW / 2 - 12, nd.x));
      nd.y = Math.max(NH / 2 + 36, Math.min(H - NH / 2 - 10, nd.y));
    });
  }
  function tick() {
    step(); renderO();
    if (sim.frames < 2200 && sim.alpha > 0.012) { sim.raf = requestAnimationFrame(tick); }
    else { sim.running = false; sim.raf = 0; }
  }
  ONTOV = { pos: {}, raf: 0 };
  for (let i = 0; i < 300; i++) step();
  renderO();
  /* 图例 */
  const legY = H + 29;
  const lg = el("g", { "font-family": "monospace", "font-size": 9.5 });
  lg.appendChild(el("rect", { x: 20, y: H + 7, width: W - 40, height: 34, rx: 8, fill: "#0b1120", stroke: "#1f2f4f" }));
  const lt = (x, str, fill) => { const t = el("text", { x, y: legY, fill: fill || "#8398bd" }); t.textContent = str; lg.appendChild(t); return t; };
  lt(40, "悬停：高亮关系 · 拖拽：调整布局");
  lg.appendChild(el("line", { x1: 250, y1: legY - 4, x2: 288, y2: legY - 4, stroke: "#3d5378", "stroke-width": 1.2, "marker-end": "url(#oa)" })); lt(296, "对象关系（箭头=方向）");
  lg.appendChild(el("path", { d: `M 440 ${legY - 9} C 452 ${legY - 15}, 452 ${legY + 8}, 440 ${legY + 2}`, fill: "none", stroke: "#3d5378", "stroke-width": 1.2 })); lt(462, "自环");
  lg.appendChild(el("circle", { cx: 512, cy: legY - 4, r: 8, fill: "none", stroke: "#22d3ee", "stroke-width": 1, "stroke-dasharray": "4 3" })); lt(528, "类别聚区（§5.2）");
  lg.appendChild(el("rect", { x: 628, y: legY - 12, width: 26, height: 14, rx: 4, fill: "#2b2410", stroke: "#fbbf24", "stroke-width": .8 }));
  const nb = el("text", { x: 641, y: legY - 2.5, "text-anchor": "middle", fill: "#fbbf24", "font-size": 7, "font-weight": 700 }); nb.textContent = "NEW"; lg.appendChild(nb); lt(660, "自定义新增类");
  lg.appendChild(el("rect", { x: 756, y: legY - 11, width: 28, height: 14, rx: 4, fill: "none", stroke: "#5b6d92", "stroke-dasharray": "4 3" })); lt(792, "已停用（虚线+压暗）");
  lg.appendChild(el("line", { x1: 855, y1: legY - 4, x2: 883, y2: legY - 4, stroke: "#fbbf24", "stroke-width": 1.6 })); lt(891, "手动新增关系");
  const rt = el("text", { x: W - 36, y: legY, "text-anchor": "end", fill: "#5b6d92" }); rt.textContent = "点击节点查看定义 · 🔗画关系"; lg.appendChild(rt);
  svg.appendChild(lg);
  pzInit("onto-svg");
  /* 从知识图谱跳转而来：定位目标类并打开定义面板（一次性） */
  if (state.ontoFocus) {
    const nd = byName[state.ontoFocus];
    if (nd) {
      const st = PZ["onto-svg"];
      const w = st.base[2] * 0.45, h = st.base[3] * 0.75;
      st.vb = [Math.max(0, nd.x - w / 2), Math.max(0, nd.y - h / 2), w, h];
      pzApply("onto-svg");
      svgFocus("onto-svg", state.ontoFocus);
    }
    kgInfo(state.ontoFocus);
    state.ontoFocus = null;
    notify();
  }
}
