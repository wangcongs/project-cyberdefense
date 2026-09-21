/* =====================================================================
   网络拓扑 SVG：网格布局 + 拖拽 + 攻击路径流动动画 + 攻击路径推演回放
   纯命令式绘制（useEffect + ref），按数据签名决定是否重绘
   ===================================================================== */
import { useEffect, useRef } from "react";
import { state, notify, stageOf, activeIncs, useApp } from "../core/store.js";
import { DB, SCEN } from "../core/data.js";
import { TOPOV, setTOPOV, RPLAY, TOPO_LINKTYPES, topoPick, ASSET_ORIG, NET_ORIG, _dirtyN, showAsset, showNet, showTopoLink } from "../actions/topology.js";
import { PZ, svgFocus, svgBlur, pzInit } from "./panzoom.jsx";

const ATK_PATHS = [
  { inc: "INC-20260918-01", hops: ["RND-WS-23", "RND-FILE-01"], label: "异常RDP ▸ INC-01" },
  { inc: "INC-20260918-02", hops: ["RND-WS-61", "LAB-SRV-01"], label: "跨网扫描+白名单外访问 ▸ INC-02" },
  { inc: "INC-20260918-03", hops: ["AD-IAM-01", "RND-GIT-01", "RND-FILE-01"], label: "越权访问 ▸ INC-03" },
  { inc: "INC-20260918-04", hops: ["OA-APP-01", "UPSTREAM-01"], label: "C2 beacon 外联 ▸ INC-04" },
];

export default function TopologySVG() {
  useApp();
  const ref = useRef(null);
  /* 数据签名：仅相关数据变化时重绘（拖拽由内部 DOM 更新，不触发重绘） */
  const sig = [
    DB.networks.map((n) => n.id + (n.custom ? "*" : "") + (_dirtyN(NET_ORIG[n.id], n).length ? "!" : "")).join(),
    DB.assets.map((a) => a.id + a.net + a.type + (_dirtyN(ASSET_ORIG[a.id], a).length ? "!" : "")).join(),
    DB.devices.map((d) => d.id + (state.devicesOffline[d.id] ? "*" : "")).join(),
    state.topoLinks.map((l) => l.id).join(),
    state.topoLinkPick ? "pick" + (state.topoLinkPick.a || "") : "",
    activeIncs().filter((i) => stageOf(i.id) < 8).map((i) => i.id).join(),
    state.llmOnline ? "llm1" : "llm0",
  ].join("|");

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    drawTopology(svg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return <svg id="topo-svg" ref={ref} style={{ width: "100%", height: "100%", display: "block" }} preserveAspectRatio="xMidYMid meet"></svg>;
}

function drawTopology(svg) {
  const atk = (id) => stageOf(id) < 8;
  const ICO = { Server: "▣", Endpoint: "▭", "AI推理节点": "◎", 堡垒机: "⚿", 外部网络: "☁", 网络设备: "⛁" };
  const TYPECN = { Server: "服务器", Endpoint: "终端", "AI推理节点": "AI 推理", 堡垒机: "受控接入", 外部网络: "外部接口", 网络设备: "网络设备" };
  /* 基础布局：网络域 3 列网格；域内资产 2 列栅格 */
  const COLS = 3, ZW = 366, GX = 34, GY = 44;
  const zoneRect = {}, basePos = {};
  const zAssets = (id) => DB.assets.filter((a) => a.net === id);
  const zDevs = (id) => DB.devices.filter((d) => d.net === id);
  const zH = (n) => Math.max(240, 64 + Math.max(1, Math.ceil(zAssets(n.id).length / 2)) * 64 + (zDevs(n.id).filter((d) => !DB.assets.find((a) => a.id === d.id)).length ? 48 : 10));
  const rowH = {};
  DB.networks.forEach((n, i) => { const r = Math.floor(i / COLS); rowH[r] = Math.max(rowH[r] || 0, zH(n)); });
  const zoneTop = (i) => { let y = 40; for (let r = 0; r < Math.floor(i / COLS); r++) y += rowH[r] + GY; return y; };
  DB.networks.forEach((n, i) => {
    const c = i % COLS, x = 30 + c * (ZW + GX), y = zoneTop(i);
    zoneRect[n.id] = { x, y, w: ZW, h: zH(n) };
    zAssets(n.id).forEach((a, j) => {
      basePos[a.id] = { x: x + ZW / 2 + (j % 2 ? -1 : 1) * ZW / 4, y: y + 64 + 30 + Math.floor(j / 2) * 64 };
    });
  });
  const bottomMost = Math.max(...DB.networks.map((n, i) => zoneTop(i) + zH(n)));
  const W = Math.max(1160, 30 + Math.min(COLS, Math.max(1, Math.ceil(DB.networks.length / COLS))) * (ZW + GX));
  const legY = bottomMost + 24, HT = legY + 48;
  const pos = {};
  DB.assets.forEach((a) => { if (basePos[a.id]) pos[a.id] = (TOPOV && TOPOV.pos[a.id]) ? { ...TOPOV.pos[a.id] } : { ...basePos[a.id] }; });
  /* 受攻击网络域 / 受影响资产 / 已隔离资产 */
  const attacked = new Set(), hitAssets = new Set(), isoAssets = new Set();
  activeIncs().filter((i) => atk(i.id)).forEach((inc) => {
    (inc.events || []).forEach((eid) => {
      const e = DB.events.find((x) => x.id === eid); if (!e) return;
      e.net.split("→").forEach((tok) => {
        const t = tok.trim();
        if (t === "边界") attacked.add("EDGE");
        else if (DB.networks.find((n) => n.id === t)) attacked.add(t);
      });
    });
    const aff = (SCEN[inc.id]?.assessment?.affected_assets) || [];
    aff.forEach((aid) => {
      hitAssets.add(aid);
      const a = DB.assets.find((x) => x.id === aid); if (a) attacked.add(a.net);
    });
    if (stageOf(inc.id) >= 6) isoAssets.add(aff[0]);
  });
  /* DOM 骨架 */
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, at) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  svg.setAttribute("viewBox", `0 0 ${W} ${HT}`);
  svg.innerHTML = `<defs>
    <pattern id="topodots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="1.1" fill="#141f38"/></pattern>
    <marker id="arrR" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9" fill="#f87171"/></marker>
  </defs><rect width="${W}" height="${HT}" fill="url(#topodots)"/>`;
  /* 静态层：受控管理通道 + 网络域分区 */
  const mgLines = [];
  const borderPt = (z, tx, ty) => {
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2, dx = tx - cx, dy = ty - cy;
    if (Math.abs(dx) * z.h > Math.abs(dy) * z.w)
      return dx > 0 ? [z.x + z.w, cy + dy * (z.w / 2) / Math.abs(dx)] : [z.x, cy + dy * (z.w / 2) / Math.abs(dx)];
    return dy > 0 ? [cx + dx * (z.h / 2) / Math.abs(dy), z.y + z.h] : [cx + dx * (z.h / 2) / Math.abs(dy), z.y];
  };
  const mg = zoneRect["SEC-MGMT"];
  if (mg) {
    const mcx = mg.x + mg.w / 2, mcy = mg.y + mg.h / 2;
    DB.networks.forEach((n) => {
      if (n.id === "SEC-MGMT") return;
      const z = zoneRect[n.id]; if (!z) return;
      const ax = borderPt(mg, z.x + z.w / 2, z.y + z.h / 2), bx = borderPt(z, mcx, mcy);
      mgLines.push(`<line class="mgline" x1="${ax[0]}" y1="${ax[1]}" x2="${bx[0]}" y2="${bx[1]}" stroke="#a78bfa" stroke-width="1.2" stroke-dasharray="6 5" opacity=".3"/>`);
    });
  }
  const gZ = el("g", {}); gZ.innerHTML = mgLines.join(""); svg.appendChild(gZ);
  const zoneClickG = el("g", {}); svg.appendChild(zoneClickG);
  DB.networks.forEach((n) => {
    const z = zoneRect[n.id], alert = attacked.has(n.id);
    const cnt = zAssets(n.id).length;
    const ndirty = _dirtyN(NET_ORIG[n.id], n).length;
    const g = el("g", { style: "cursor:pointer" });
    g.innerHTML = `
    ${alert ? `<rect x="${z.x - 4}" y="${z.y - 4}" width="${z.w + 8}" height="${z.h + 8}" rx="15" fill="rgba(248,113,113,.07)" stroke="#f87171" stroke-width="1.3" class="zglow"/>` : ""}
    ${ndirty ? `<rect x="${z.x - 8}" y="${z.y - 8}" width="${z.w + 16}" height="${z.h + 16}" rx="16" fill="none" stroke="#fbbf24" stroke-width="1.3" stroke-dasharray="3 3" opacity=".85"/>` : ""}
    <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="12" fill="${n.color}0a" stroke="${n.color}" stroke-width="1.1" stroke-dasharray="7 5"/>
    <circle cx="${z.x + 18}" cy="${z.y + 21}" r="4" fill="${n.color}">${alert ? '<animate attributeName="opacity" values="1;.15;1" dur="1.2s" repeatCount="indefinite"/>' : ""}</circle>
    <text x="${z.x + 30}" y="${z.y + 25}" fill="${n.color}" font-size="11.5" font-weight="700" font-family="monospace">${n.id} ${n.name}${n.custom ? " ✎" : ""}${ndirty ? ' <tspan fill="#fbbf24">✎改</tspan>' : ""}</text>
    <text x="${z.x + 30}" y="${z.y + 42}" fill="#5b6d92" font-size="9.5" font-family="monospace">${n.cidr} · ${cnt} 纳管资产</text>
    ${alert ? `<text x="${z.x + z.w - 12}" y="${z.y + 25}" text-anchor="end" fill="#f87171" font-size="10.5" font-weight="700" font-family="monospace">⚠ 遭受攻击</text>` : ""}
    `;
    g.addEventListener("click", () => showNet(n.id));
    zoneClickG.appendChild(g);
    const devs = zDevs(n.id).filter((d) => !DB.assets.find((a) => a.id === d.id));
    if (devs.length) {
      const off = devs.filter((d) => state.devicesOffline[d.id]);
      const dt = el("text", { x: z.x + z.w / 2, y: z.y + z.h - 24, "text-anchor": "middle", fill: off.length ? "#f87171" : "#8398bd", "font-size": 10, "font-family": "monospace" });
      dt.textContent = `⛨ ${devs.map((d) => state.devicesOffline[d.id] ? d.id + "(离线)" : d.id).join(" · ")}`;
      zoneClickG.appendChild(dt);
    }
  });
  const gL = el("g", {}), gT = el("g", {}), gN = el("g", {});
  svg.appendChild(gL); svg.appendChild(gT); svg.appendChild(gN);
  /* 活跃攻击路径 */
  const atkGroups = [];
  ATK_PATHS.forEach((p) => {
    if (!atk(p.inc)) return;
    const els = [];
    p.hops.slice(0, -1).forEach((from, i) => {
      const to = p.hops[i + 1];
      if (!pos[from] || !pos[to]) return;
      const path = el("path", { fill: "none", stroke: "#f87171", "stroke-width": 2.4, class: "atk-flow", "marker-end": "url(#arrR)", "data-edge": from + "→" + to });
      gL.appendChild(path);
      els.push({ path, from, to });
    });
    if (!els.length) return;
    const lbl = el("text", { class: "elbl", "text-anchor": "middle", fill: "#f87171", "font-size": 10, "font-weight": 700, "font-family": "monospace" });
    lbl.textContent = p.label;
    gT.appendChild(lbl);
    atkGroups.push({ p, els, lbl });
  });
  /* 手动关系 */
  const lnkEls = [];
  state.topoLinks.forEach((l) => {
    if (!pos[l.from] || !pos[l.to]) return;
    const c = TOPO_LINKTYPES[l.type] || "#22d3ee";
    const main = el("path", { fill: "none", stroke: c, "stroke-width": 1.8, "stroke-dasharray": "7 5", "pointer-events": "none", "data-edge": l.from + "→" + l.to });
    const hit = el("path", { fill: "none", stroke: "#000", "stroke-opacity": 0, "stroke-width": 16, style: "cursor:pointer" });
    const lbl = el("text", { class: "tlink-lbl", "text-anchor": "middle", fill: c });
    lbl.textContent = l.type + " · " + l.label;
    hit.addEventListener("click", (e) => { e.stopPropagation(); showTopoLink(l.id); });
    gL.appendChild(main); gL.appendChild(hit); gT.appendChild(lbl);
    lnkEls.push({ main, hit, lbl, l });
  });
  /* 资产节点 */
  const nodeEls = [];
  DB.assets.forEach((a) => {
    if (!pos[a.id]) return;
    const nz = DB.networks.find((n) => n.id === a.net);
    let col = nz ? nz.color : "#22d3ee";
    if (hitAssets.has(a.id)) col = "#f87171";
    if (a.id === "LLM-01" && !state.llmOnline) col = "#f87171";
    const edited = !!_dirtyN(ASSET_ORIG[a.id], a).length;
    const picked = state.topoLinkPick && state.topoLinkPick.a === a.id;
    const g = el("g", { class: "tnode", "data-name": a.id, style: "cursor:grab" });
    g.innerHTML = `
    ${isoAssets.has(a.id) ? `<circle r="36" fill="none" stroke="#f87171" stroke-width="1.8" stroke-dasharray="5 4" class="ring"/><text y="-44" text-anchor="middle" fill="#f87171" font-size="9.5" font-weight="700" font-family="monospace">ISOLATED</text>` : ""}
    ${edited ? `<circle r="44" fill="none" stroke="#fbbf24" stroke-width="1.4" stroke-dasharray="3 3" opacity=".9"/>` : ""}
    ${picked ? `<circle r="50" fill="none" stroke="#fbbf24" stroke-width="2.2" stroke-dasharray="6 4" class="zglow"/>` : ""}
    <rect class="tbox" x="-62" y="-24" width="124" height="48" rx="9" fill="#0e1830" stroke="${col}" stroke-width="${picked ? 2.6 : 1.5}"/>
    <rect x="-62" y="-24" width="4.5" height="48" rx="2" fill="${col}"/>
    <text x="-50" y="-5" fill="#dce6f7" font-size="11" font-family="monospace" font-weight="700">${a.id}</text>
    <text x="-50" y="13" fill="#5b6d92" font-size="9">${a.ip === "—" ? "" : a.ip + " "}${TYPECN[a.type] || a.type}${a.custom ? " ✎" : ""}</text>
    <text class="ticon" x="44" y="2" text-anchor="middle" fill="${col}" font-size="14">${ICO[a.type] || "▣"}</text>`;
    gN.appendChild(g);
    nodeEls.push({ g, a });
    g.addEventListener("mouseenter", () => svgFocus("topo-svg", a.id));
    g.addEventListener("mouseleave", () => svgBlur("topo-svg"));
    g.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      const start = { x: e.clientX, y: e.clientY, moved: false };
      const toXY = (ev) => {
        const r = svg.getBoundingClientRect(), vb = (PZ["topo-svg"] && PZ["topo-svg"].vb) || [0, 0, W, HT];
        return [vb[0] + (ev.clientX - r.left) / r.width * vb[2], vb[1] + (ev.clientY - r.top) / r.height * vb[3]];
      };
      const move = (ev) => {
        if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 4) start.moved = true;
        if (!start.moved) return;
        const [x, y] = toXY(ev);
        pos[a.id].x = Math.max(70, Math.min(W - 70, x));
        pos[a.id].y = Math.max(70, Math.min(HT - 80, y));
        renderT();
      };
      const up = () => {
        document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up);
        if (!start.moved) { if (state.topoLinkPick) topoPick(a.id); else showAsset(a.id); }
      };
      document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
    });
  });
  /* 每帧渲染（攻击路径 / 手动关系 / 节点位置） */
  function renderT() {
    atkGroups.forEach((G) => {
      G.els.forEach((E, i) => {
        const p1 = pos[E.from], p2 = pos[E.to];
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, nx = -(p2.y - p1.y), ny = (p2.x - p1.x), len = Math.hypot(nx, ny) || 1;
        const off = Math.abs(p2.y - p1.y) < 10 ? 34 : Math.min(46, Math.max(16, len * 0.12));
        const cx = mx + nx / len * off, cy = my + ny / len * off;
        E.path.setAttribute("d", `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`);
        E.geo = { x1: p1.x, y1: p1.y, cx, cy, x2: p2.x, y2: p2.y };
        if (i === 0) {
          const ax = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x, ay = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y;
          G.lbl.setAttribute("x", ax + nx / len * 16); G.lbl.setAttribute("y", ay + ny / len * 16 - 2);
        }
      });
    });
    lnkEls.forEach((L) => {
      const p1 = pos[L.l.from], p2 = pos[L.l.to];
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, nx = -(p2.y - p1.y), ny = (p2.x - p1.x), len = Math.hypot(nx, ny) || 1;
      const off = Math.min(26, Math.max(10, len * 0.08));
      const cx = mx + nx / len * off, cy = my + ny / len * off;
      const d = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;
      L.main.setAttribute("d", d); L.hit.setAttribute("d", d);
      L.lbl.setAttribute("x", 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x);
      L.lbl.setAttribute("y", 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y - 4);
    });
    nodeEls.forEach((N) => N.g.setAttribute("transform", `translate(${pos[N.a.id].x},${pos[N.a.id].y})`));
    if (!TOPOV || !TOPOV.pos) setTOPOV({ pos: {} });
    Object.keys(pos).forEach((id) => { TOPOV.pos[id] = { x: pos[id].x, y: pos[id].y }; });
  }
  renderT();
  /* 图例 */
  svg.insertAdjacentHTML("beforeend", `<g font-family="monospace" font-size="9.5">
  <rect x="30" y="${legY}" width="${W - 60}" height="40" rx="8" fill="#0b1120" stroke="#1f2f4f"/>
  <rect x="46" y="${legY + 13}" width="26" height="14" rx="4" fill="#22d3ee0a" stroke="#22d3ee" stroke-dasharray="4 3"/><text x="80" y="${legY + 24}" fill="#8398bd">网络域（虚线=域边界）</text>
  <line x1="205" y1="${legY + 20}" x2="241" y2="${legY + 20}" stroke="#f87171" stroke-width="2.4" class="atk-flow" marker-end="url(#arrR)"/><text x="249" y="${legY + 24}" fill="#8398bd">活跃攻击路径（流动动画）</text>
  <line x1="390" y1="${legY + 20}" x2="426" y2="${legY + 20}" stroke="#a78bfa" stroke-width="1.3" stroke-dasharray="6 5" opacity=".6"/><text x="434" y="${legY + 24}" fill="#8398bd">受控管理通道</text>
  <circle cx="565" cy="${legY + 20}" r="7" fill="none" stroke="#f87171" stroke-width="1.5" stroke-dasharray="4 3"/><text x="581" y="${legY + 24}" fill="#8398bd">已隔离终端</text>
  <line x1="655" y1="${legY + 20}" x2="691" y2="${legY + 20}" stroke="#22d3ee" stroke-width="1.8" stroke-dasharray="7 5"/><text x="699" y="${legY + 24}" fill="#8398bd">手动关系（点击编辑）</text>
  <circle cx="875" cy="${legY + 20}" r="7" fill="none" stroke="#fbbf24" stroke-width="1.3" stroke-dasharray="3 3"/><text x="891" y="${legY + 24}" fill="#8398bd">属性已编辑</text>
  <text x="${W - 46}" y="${legY + 24}" text-anchor="end" fill="#5b6d92">⚠红框=受攻击 · ✎=手动新增 · 拖拽布局 · ▶可推演</text>
  </g>`);
  pzInit("topo-svg");
  /* 攻击路径推演回放 */
  if (RPLAY && RPLAY.on && atkGroups.length) {
    RPLAY.groups = atkGroups;
    const gFx = el("g", {}); svg.appendChild(gFx);
    RPLAY.dot = el("circle", { r: 5, fill: "#f87171", opacity: 0, style: "filter:drop-shadow(0 0 6px rgba(248,113,113,.9))" });
    RPLAY.hdr = el("text", { x: 44, y: 28, fill: "#f87171", "font-size": 12, "font-weight": 700, "font-family": "monospace", class: "elbl" });
    gFx.appendChild(RPLAY.dot); gFx.appendChild(RPLAY.hdr);
    if (RPLAY.raf) cancelAnimationFrame(RPLAY.raf);
    RPLAY.last = performance.now();
    const qpt = (E, t) => { const u = 1 - t; return [u * u * E.geo.x1 + 2 * u * t * E.geo.cx + t * t * E.geo.x2, u * u * E.geo.y1 + 2 * u * t * E.geo.cy + t * t * E.geo.y2]; };
    const ring = (aid) => {
      const p = pos[aid]; if (!p) return;
      const c = el("circle", { cx: p.x, cy: p.y, r: 8, fill: "none", stroke: "#f87171", "stroke-width": 2 });
      c.appendChild(el("animate", { attributeName: "r", from: 8, to: 44, dur: "0.8s", fill: "freeze" }));
      c.appendChild(el("animate", { attributeName: "opacity", from: 1, to: 0, dur: "0.8s", fill: "freeze" }));
      gFx.appendChild(c);
      setTimeout(() => c.remove(), 850);
    };
    const tick = (ts) => {
      if (!RPLAY || !RPLAY.on) return;
      if (!svg.isConnected) { RPLAY.raf = 0; return; }
      const dt = Math.min(60, ts - (RPLAY.last || ts)); RPLAY.last = ts;
      const G = RPLAY.groups;
      const g = G[RPLAY.pi % G.length];
      G.forEach((gg) => {
        const cur = gg === g;
        gg.els.forEach((E) => { E.path.style.opacity = cur ? 1 : .12; });
        gg.lbl.style.opacity = cur ? 1 : .1;
      });
      const done = RPLAY.hi >= g.els.length;
      g.els.forEach((E, i) => { E.path.style.strokeWidth = i < RPLAY.hi || done ? 3 : (i === RPLAY.hi ? 3.4 : 2.2); });
      if (done) {
        RPLAY.dot.setAttribute("opacity", 0);
        RPLAY.hold += dt;
        if (RPLAY.hold > 1500) { RPLAY.hold = 0; RPLAY.hi = 0; RPLAY.t = 0; RPLAY.pi = (RPLAY.pi + 1) % G.length; }
      } else {
        RPLAY.t += dt * 0.0011;
        if (RPLAY.t >= 1) {
          ring(g.p.hops[Math.min(RPLAY.hi + 1, g.p.hops.length - 1)]);
          RPLAY.hi++; RPLAY.t = 0;
          if (RPLAY.hi >= g.els.length) RPLAY.dot.setAttribute("opacity", 0);
        } else {
          const E = g.els[RPLAY.hi];
          if (E && E.geo) { const [px, py] = qpt(E, RPLAY.t); RPLAY.dot.setAttribute("cx", px); RPLAY.dot.setAttribute("cy", py); RPLAY.dot.setAttribute("opacity", 1); }
        }
      }
      RPLAY.hdr.textContent = `⚔ 攻击路径推演 ${RPLAY.pi + 1}/${G.length} · ${g.p.inc} · ${g.p.label} · 第 ${Math.min(RPLAY.hi + 1, g.els.length)}/${g.els.length} 跳`;
      RPLAY.raf = requestAnimationFrame(tick);
    };
    RPLAY.raf = requestAnimationFrame(tick);
  }
}
