/* =====================================================================
   任务编排 DAG SVG：分层布局 + 连线建立/删除依赖 + HITL 标记
   ===================================================================== */
import { useEffect, useRef } from "react";
import { state, S, useApp } from "../core/store.js";
import { dagLayout, dagAddDep, dagDelDep } from "../actions/pipeline.js";
import { showTaskPanel } from "../ui/panels.jsx";
import { sidePanel } from "../core/utils.js";

export default function DagSVG() {
  useApp();
  const ref = useRef(null);
  const s = S();
  const sig = [s.tasksVer, s.dispatched, s.tasks.map((t) => t.status).join()].join("|");
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    drawDAG(svg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return <svg id="dag-svg" ref={ref} style={{ width: "100%", display: "block" }}></svg>;
}

function drawDAG(svg) {
  const s = S();
  const tasks = s.tasks;
  const locked = s.dispatched;
  const { P, W, H } = dagLayout(tasks);
  svg.setAttribute("viewBox", `0 0 ${W} ${H + 40}`);
  svg.setAttribute("height", Math.min(H + 40, 460));
  const NS = "http://www.w3.org/2000/svg";
  const el = (t, at) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  svg.innerHTML = `<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#2c3f63"/></marker><marker id="arrG" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#34d399"/></marker><marker id="arrC" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#22d3ee"/></marker></defs>`;
  const gE = el("g", {}), gN = el("g", {}), gFx = el("g", {});
  svg.appendChild(gE); svg.appendChild(gN); svg.appendChild(gFx);
  /* 依赖边 */
  tasks.forEach((t) => t.pre.forEach((p) => {
    const pt = tasks.find((x) => x.id === p); if (!pt) return;
    const a = P[p], b = P[t.id]; if (!a || !b) return;
    const done = pt.status === "SUCCESS" || pt.status === "SKIPPED";
    gE.appendChild(el("line", { x1: a[0] + 74, y1: a[1], x2: b[0] - 74, y2: b[1], stroke: done ? "#34d399" : "#2c3f63", "stroke-width": 1.5, "marker-end": `url(#${done ? "arrG" : "arr"})` }));
    if (!locked) {
      const hit = el("line", { x1: a[0] + 74, y1: a[1], x2: b[0] - 74, y2: b[1], stroke: "#000", "stroke-opacity": 0, "stroke-width": 12, style: "cursor:pointer" });
      const tip = el("title", {}); tip.textContent = `点击删除依赖：${t.id} 不再等待 ${p}`; hit.appendChild(tip);
      hit.addEventListener("click", (ev) => { ev.stopPropagation(); dagDelDep(p, t.id); });
      gE.appendChild(hit);
    }
  }));
  /* 节点 + 右缘 ⊕ 连线手柄 */
  let suppressClick = false;
  svg.addEventListener("click", (ev) => { if (suppressClick) { ev.stopPropagation(); ev.preventDefault(); suppressClick = false; } }, true);
  const toXY = (ev) => {
    const r = svg.getBoundingClientRect(), vb = (svg.getAttribute("viewBox") || "0 0 100 100").split(/[\s,]+/).map(Number);
    return [vb[0] + (ev.clientX - r.left) / r.width * vb[2], vb[1] + (ev.clientY - r.top) / r.height * vb[3]];
  };
  const live = el("path", { fill: "none", stroke: "#22d3ee", "stroke-width": 1.8, "stroke-dasharray": "6 4", opacity: 0, "marker-end": "url(#arrC)" });
  gFx.appendChild(live);
  tasks.forEach((t) => {
    const [x, y] = P[t.id]; if (x == null) return;
    const c = t.status === "SUCCESS" ? "#34d399" : t.status === "SKIPPED" ? "#5b6d92" : t.status === "RUNNING" ? "#22d3ee" : t.status === "FAILED" ? "#f87171" : t.status === "WAITING" ? "#fbbf24" : "#2c3f63";
    const hitl = t.hitl !== "auto";
    const dash = t.status === "WAITING" ? `stroke-dasharray="5 3"` : "";
    const g = el("g", { style: "cursor:pointer" });
    g.innerHTML = `
    <rect x="${x - 74}" y="${y - 26}" width="148" height="52" rx="9" fill="#101a30" stroke="${c}" stroke-width="${hitl ? 2.2 : 1.6}" ${dash} ${t.status === "RUNNING" ? 'class="pulse"' : ""}/>
    ${hitl ? `<circle cx="${x + 60}" cy="${y - 26}" r="9" fill="#1a2745" stroke="#fbbf24" stroke-width="1.2"/><text x="${x + 60}" y="${y - 22.5}" text-anchor="middle" fill="#fbbf24" font-size="9" font-family="monospace">✋</text>` : ""}
    <text x="${x}" y="${y - 6}" text-anchor="middle" fill="${c}" font-size="11" font-family="monospace" font-weight="700">${t.id} · ${t.tpl}</text>
    <text x="${x}" y="${y + 12}" text-anchor="middle" fill="#8398bd" font-size="9.5">${t.target.length > 26 ? t.target.slice(0, 26) + "…" : t.target}</text>`;
    g.addEventListener("click", () => sidePanel(showTaskPanel(t.id)));
    gN.appendChild(g);
    if (!locked) {
      const hd = el("g", { style: "cursor:crosshair" });
      hd.innerHTML = `<circle cx="${x + 74}" cy="${y}" r="9" fill="#1a2745" stroke="#22d3ee" stroke-width="1.2" opacity=".9"/><text x="${x + 74}" y="${y + 3.5}" text-anchor="middle" fill="#22d3ee" font-size="10" font-family="monospace" font-weight="700">⊕</text><title>按住拖到目标任务：建立依赖（目标任务等待本任务完成后执行）</title>`;
      hd.addEventListener("mousedown", (e) => {
        e.stopPropagation(); e.preventDefault();
        const from = [x + 74, y];
        live.setAttribute("opacity", 1);
        const move = (ev) => {
          const [px, py] = toXY(ev);
          live.setAttribute("d", `M ${from[0]} ${from[1]} L ${px} ${py}`);
        };
        const up = (ev) => {
          document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up);
          live.setAttribute("opacity", 0);
          suppressClick = true;
          const [px, py] = toXY(ev);
          const dst = tasks.find((tt) => { const q = P[tt.id]; return q && Math.abs(px - q[0]) <= 82 && Math.abs(py - q[1]) <= 34; });
          if (!dst || dst.id === t.id) return;
          dagAddDep(t.id, dst.id);
        };
        document.addEventListener("mousemove", move); document.addEventListener("mouseup", up);
      });
      gN.appendChild(hd);
    }
  });
  const cap = el("text", { x: W / 2, y: H + 28, "text-anchor": "middle", fill: "#5b6d92", "font-size": 10.5, "font-family": "monospace" });
  cap.textContent = `多局域网任务按 network_scope 拆分子任务组（${[...new Set(tasks.map((t) => t.net))].join(" / ")}），中央 Workflow 等待各域结果${locked ? "" : " · 从节点右缘 ⊕ 拖出连线建立依赖 · 点击连线删除依赖"}`;
  svg.appendChild(cap);
}
