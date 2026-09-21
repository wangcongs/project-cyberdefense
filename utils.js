/* =====================================================================
   工具层：时间 / 审计 / DOM 查询 / toast（store 驱动）/ 侧栏面板
   ===================================================================== */
import { state, notify } from "./store.js";
import { DB } from "./data.js";

export const $ = (s) => document.querySelector(s);

export function now() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function addAudit(who, act, lvl = "info") {
  DB.auditLog.unshift({ t: now(), who, act, lvl });
}

/* ===== Toast（React <ToastHost/> 消费 state.toasts 渲染） ===== */
export function toast(msg, type = "") {
  const id = ++state._toastSeq;
  state.toasts.push({ id, msg, type });
  notify();
  setTimeout(() => {
    const i = state.toasts.findIndex((t) => t.id === id);
    if (i > -1) { state.toasts.splice(i, 1); notify(); }
  }, 3600);
}

/* ===== 侧栏面板（React <PanelHost/> 消费 state.panel 渲染） ===== */
export function sidePanel(content) {
  state.panel = content;
  notify();
}
export function closePanel() {
  state.panel = null;
  notify();
}

/* ===== KPI 数字滚动（仅纯整数值） ===== */
export function countUp() {
  document.querySelectorAll(".k-val").forEach((el) => {
    const raw = el.textContent;
    if (!/^\d+$/.test(raw)) return;
    const target = parseInt(raw, 10), t0 = performance.now(), dur = 620;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
