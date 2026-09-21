/* =====================================================================
   共享 UI 组件：徽章 / 标签页 / 闭环进度条 / 处置上下文条 / Toast / 侧栏面板
   ===================================================================== */
import { useEffect, useRef } from "react";
import { state, STAGES, activeIncs, stageOf, INC, incEventCount, useApp } from "../core/store.js";
import { DB } from "../core/data.js";
import { closePanel, countUp } from "../core/utils.js";
import { switchInc, go } from "../actions/system.js";

/* 闭环阶段 → 下一处置页（态势总览/事件中心「继续处置」按钮用） */
export function nextPageOf(st) {
  return ["analysis", "planning", "approval", "approval", "tasks", "execution", "effect", "cases"][Math.min(st, 7)];
}

/* 控制台日志视图：lines 支持 {c,t} 与 [c,t] 两种元素；t.__html 走 HTML 渲染；自动滚到底部 */
export function Console({ lines, placeholder, maxH = 300, style }) {
  const ref = useRef(null);
  const n = lines ? lines.length : 0;
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [n]);
  return (
    <div className="console" ref={ref} style={{ maxHeight: maxH, ...style }}>
      {n ? lines.map((l, i) => {
        const c = l.c ?? l[0], t = l.t ?? l[1];
        return (
          <div key={i} className={"ln " + c}>
            {t && typeof t === "object" && t.__html
              ? <span dangerouslySetInnerHTML={{ __html: t.__html }} />
              : t}
          </div>
        );
      }) : <div className="t">{placeholder}</div>}
    </div>
  );
}

/* ===== 徽章 ===== */
export function SevBadge({ s }) {
  const m = { "高": "b-red", "中": "b-amber", "低": "b-gray", high: "b-red", medium: "b-amber", low: "b-gray", "关键": "b-red", "普通": "b-gray" };
  return <span className={"badge " + (m[s] || "b-gray")}>{s}</span>;
}
export function StageBadge({ stage }) {
  const st = ["成案","研判","规划","校验","待审批","编排","执行","验证","闭环"][stage] || "";
  const cls = stage >= 8 ? "b-green" : stage >= 5 ? "b-blue" : stage >= 1 ? "b-cyan" : "b-amber";
  return <span className={"badge " + cls}>{st}</span>;
}
export function StatusBadge({ s }) {
  const m = { PENDING: "b-gray", RUNNING: "b-cyan", SUCCESS: "b-green", FAILED: "b-red", SKIPPED: "b-gray", AVAILABLE: "b-green", UNAVAILABLE: "b-red", ONLINE: "b-green", OFFLINE: "b-red", CONTAINED: "b-green", CLOSED: "b-green", ANALYZING: "b-cyan", ISOLATED: "b-red", PASS: "b-green", DENY: "b-red", WAITING: "b-amber" };
  return <span className={"badge " + (m[s] || "b-gray")}>{s}</span>;
}

/* ===== 模块页标签页 ===== */
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="mtabs">
      {tabs.map((t) => (
        <div key={t.id} className={"mtab " + (active === t.id ? "on" : "")} onClick={() => onChange(t.id)}>{t.label}</div>
      ))}
    </div>
  );
}

/* ===== 闭环进度条 ===== */
export function Pipeline({ stage }) {
  return (
    <div className="pipeline">
      {STAGES.map((s, i) => (
        <span key={s} style={{ display: "contents" }}>
          <div className={"pl-step " + (i < stage ? "done" : i === stage ? "cur" : "")}>
            <div className="pl-node">{i < stage ? "✓" : i + 1}</div>
            <div className="pl-label">{s}</div>
          </div>
          {i < STAGES.length - 1 ? <div className={"pl-line " + (i < stage ? "done" : "")}></div> : null}
        </span>
      ))}
    </div>
  );
}

/* ===== 处置上下文条：所有闭环页面共用的事件切换器 ===== */
export function CtxBar() {
  useApp();
  const inc = INC();
  return (
    <div className="ctx-bar">
      <span className="faint" style={{ fontSize: "11px" }}>当前处置事件</span>
      <select value={state.activeInc} onChange={(e) => switchInc(e.target.value)}>
        {activeIncs().map((i) => (
          <option key={i.id} value={i.id}>{i.id} · {i.title}（{STAGES[stageOf(i.id)] || "已闭环"}）</option>
        ))}
      </select>
      <SevBadge s={inc.sev} />
      <span className="badge b-cyan">{inc.net}</span>
      <span className="spacer"></span>
      <span className="hint">告警 {incEventCount(state.activeInc)} 条 · 成案于 {inc.created}</span>
      <button className="btn sm" onClick={() => go("events")}>事件详情</button>
    </div>
  );
}

/* ===== Toast 宿主（消息内容允许简单 HTML 强调） ===== */
export function ToastHost() {
  useApp();
  return (
    <div id="toast">
      {state.toasts.map((t) => (
        <div key={t.id} className={"toast " + t.type} dangerouslySetInnerHTML={{ __html: t.msg }} />
      ))}
    </div>
  );
}

/* ===== 侧栏面板宿主 ===== */
export function PanelHost() {
  useApp();
  if (!state.panel) return <div id="sidepanel-root"></div>;
  return (
    <div id="sidepanel-root">
      <div className="sidepanel">
        <span className="sp-close" onClick={() => closePanel()}>✕</span>
        {state.panel}
      </div>
    </div>
  );
}

/* ===== 页面外壳：路由切换入场动画 + KPI 滚动 ===== */
export function PageShell({ route, children }) {
  useApp();
  useEffect(() => {
    let i = 0;
    document.querySelectorAll("#pg .card, #pg .kpi, #pg .inc-card, #pg .src-card")
      .forEach((el) => { el.style.animationDelay = Math.min(i, 9) * 45 + "ms"; i++; });
    const tb = document.querySelector(".tb-title");
    if (tb) { tb.style.animation = "none"; void tb.offsetWidth; tb.style.animation = ""; }
    countUp();
  }, [route]);
  return <div className="page active route-anim" id="pg">{children}</div>;
}
