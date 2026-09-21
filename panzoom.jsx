/* =====================================================================
   SVG 画布缩放/平移引擎（拓扑 / 本体 / 图谱通用）
   滚轮缩放 + 拖拽平移 + 按钮控制；模块级 PZ 记忆各画布视图状态
   ===================================================================== */

export const PZ = {};

export function svgFocus(id, name) {
  const svg = document.getElementById(id); if (!svg) return;
  const keep = new Set([name]);
  svg.querySelectorAll("[data-edge]").forEach((el) => {
    const [f, t] = el.getAttribute("data-edge").split("→");
    if (f === name || t === name) { el.classList.remove("dim"); keep.add(f); keep.add(t); }
    else el.classList.add("dim");
  });
  svg.querySelectorAll("[data-name]").forEach((el) => {
    el.classList.toggle("dim", !keep.has(el.getAttribute("data-name")));
  });
}

export function svgBlur(id) {
  const svg = document.getElementById(id); if (!svg) return;
  svg.querySelectorAll(".dim").forEach((el) => el.classList.remove("dim"));
}

export function pzApply(id) {
  const st = PZ[id]; if (!st) return;
  const svg = document.getElementById(id); if (!svg) return;
  svg.setAttribute("viewBox", st.vb.map((v) => v.toFixed(1)).join(" "));
  const tag = document.getElementById(id + "-zoom");
  if (tag) tag.textContent = Math.round(st.base[2] / st.vb[2] * 100) + "%";
}

export function pzZoom(id, f, px, py) {
  const st = PZ[id]; if (!st) return;
  const svg = document.getElementById(id); if (!svg) return;
  const r = svg.getBoundingClientRect();
  const fx = px != null ? (px - r.left) / r.width : 0.5, fy = py != null ? (py - r.top) / r.height : 0.5;
  const ax = st.vb[0] + fx * st.vb[2], ay = st.vb[1] + fy * st.vb[3];
  st.vb[2] *= f; st.vb[3] *= f;
  st.vb[0] = ax - fx * st.vb[2]; st.vb[1] = ay - fy * st.vb[3];
  const minW = st.base[2] / 8, maxW = st.base[2] * 1.5;
  if (st.vb[2] < minW) { const k = minW / st.vb[2]; st.vb[2] *= k; st.vb[3] *= k; }
  if (st.vb[2] > maxW) { const k = maxW / st.vb[2]; st.vb[2] *= k; st.vb[3] *= k; }
  pzApply(id);
}

export function pzBtn(id, f) { pzZoom(id, f, null, null); }
export function pzReset(id) { const st = PZ[id]; if (!st) return; st.vb = [...st.base]; pzApply(id); }

export function pzInit(id) {
  const svg = document.getElementById(id); if (!svg) return;
  const vb = (svg.getAttribute("viewBox") || "0 0 100 100").split(/[\s,]+/).map(Number);
  PZ[id] = { base: [...vb], vb: [...vb], drag: null, moved: false };
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    pzZoom(id, e.deltaY < 0 ? 0.85 : 1.18, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  svg.addEventListener("mousedown", (e) => {
    const st = PZ[id]; if (!st) return;
    if (e.button !== 0) return;
    st.drag = { x: e.clientX, y: e.clientY }; st.moved = false;
    svg.style.cursor = "grabbing";
    const move = (ev) => {
      if (!st.drag) return;
      const r = svg.getBoundingClientRect();
      const dx = ev.clientX - st.drag.x, dy = ev.clientY - st.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) st.moved = true;
      st.vb[0] -= dx * (st.vb[2] / r.width); st.vb[1] -= dy * (st.vb[3] / r.height);
      st.drag = { x: ev.clientX, y: ev.clientY };
      pzApply(id);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      st.drag = null; svg.style.cursor = "grab";
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  });
  svg.addEventListener("click", (e) => {
    const st = PZ[id];
    if (st && st.moved) { e.stopPropagation(); e.preventDefault(); st.moved = false; }
  }, true);
}

/* 工具栏按钮组（React 消费） */
export function PzBtns({ id }) {
  return <>
    <button className="btn sm" onClick={() => pzBtn(id, 0.8)}>＋</button>
    <button className="btn sm" onClick={() => pzBtn(id, 1.25)}>－</button>
    <button className="btn sm" onClick={() => pzReset(id)}>⤢ 重置视图</button>
    <span className="pz-zoom-tag" id={id + "-zoom"}>100%</span>
  </>;
}
