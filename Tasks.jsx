/* =====================================================================
   页面：任务编排（可视化 DAG 编辑 · 人工可介入）
   ===================================================================== */
import { S, INC, useApp } from "../core/store.js";
import { StatusBadge, CtxBar, Pipeline } from "../ui/common.jsx";
import { sidePanel } from "../core/utils.js";
import { go } from "../actions/system.js";
import { dagValid, dispatchTasks, revokeDispatch, resetTasks } from "../actions/pipeline.js";
import { showTaskPanel, TaskAddPanel } from "../ui/panels.jsx";
import DagSVG from "../viz/DagSVG.jsx";

function HitlBadge({ t }) {
  if (t.hitl === "manual") return <span className="badge b-purple">✋ 人工操作</span>;
  if (t.hitl === "confirm") return <span className="badge b-amber">☑ 执行前确认</span>;
  return <span className="badge b-gray">自动</span>;
}

export default function Tasks() {
  useApp();
  const s = S();
  const v = dagValid();
  const hitlCnt = s.tasks.filter((t) => t.hitl !== "auto").length;

  return <>
    <CtxBar />
    <div className="card mb14"><h3>闭环进度 <span className="sub">{INC().id} · {INC().title}</span></h3><Pipeline stage={s.stage} /></div>

    <div className="card mb14">
      <h3>DefenseTask DAG <span className="sub">编排 v{s.tasksVer} · 点击节点编辑任务 / 依赖 / 人工介入点</span>
        <span className="spacer"></span>
        {s.approved && !s.dispatched ? <>
          <button className="btn sm" onClick={() => sidePanel(<TaskAddPanel />)}>＋ 添加任务</button>
          <button className="btn sm" onClick={() => resetTasks()}>↺ 恢复初始编排</button>
        </> : null}
      </h3>
      {s.approved ? <>
        <div className="dag-wrap"><DagSVG /></div>
        <div className="hint mt8">节点：<span className="hl-cyan">待执行</span> · <span style={{ color: "var(--green)" }}>成功</span> · <span style={{ color: "var(--amber)" }}>等待人工</span> · 右上角 <span className="hl-amber">✋</span> 标记 = 人工介入点（共 {hitlCnt} 个） · 虚线边框 = 执行中暂停等待人工操作 · <span className="hl-cyan">从节点右缘 ⊕ 拖出连线可建立依赖，点击连线可删除依赖</span></div>
        <div className="flow-box mt8" style={{ borderColor: v.ok ? "rgba(52,211,153,.35)" : "rgba(248,113,113,.5)" }}>
          <b className={v.ok ? "hl-green" : "hl-red"}>{v.ok ? "✓ DAG 校验通过" : `✕ DAG 校验失败（${v.errs.length} 项问题）`}</b>
          {v.ok ? (
            <span className="muted"> · 无环 · 无悬空依赖 · {s.tasks.length} 个任务 · idempotency_key 就绪{hitlCnt ? ` · 执行时将在 ${hitlCnt} 个节点暂停等待人工` : ""}</span>
          ) : (
            <div style={{ marginTop: "6px" }}>{v.errs.map((e, i) => <div key={i} className="hl-red" style={{ fontSize: "11.5px" }}>· {e}</div>)}</div>
          )}
        </div>
        <div className="flex mt14" style={{ gap: "10px" }}>
          <button className="btn primary" onClick={() => dispatchTasks()} disabled={s.dispatched || !v.ok}>⛓ 签名并分发到各局域网</button>
          {s.dispatched ? <span className="badge b-green">已签名分发 · network_scope 拆分子任务组 · expire_at 按任务设定</span> : null}
          {s.dispatched ? <button className="btn" onClick={() => go("execution")}>→ 执行监控</button> : null}
          {s.dispatched ? <button className="btn" onClick={() => revokeDispatch()}>↩ 撤回分发 · 重新编排</button> : null}
        </div>
      </> : (
        <div className="empty">等待审批通过后生成 DefenseTask<br /><span className="hint">审批通过后，可在本页人工增删任务、调整依赖与参数、插入人工操作步骤（Human-in-the-loop）</span></div>
      )}
    </div>

    {s.approved ? (
      <div className="card">
        <h3>任务清单 <span className="sub">v{s.tasksVer} · 点击行编辑 · 人工介入列决定执行时是否暂停等待人工</span></h3>
        <table><tbody>
          <tr><th>Task</th><th>ActionTemplate</th><th>目标</th><th>前置</th><th>执行端</th><th>network_scope</th><th>人工介入</th><th>expire</th><th>状态</th></tr>
          {s.tasks.map((t) => (
            <tr key={t.id} className="rowlink" onClick={() => sidePanel(showTaskPanel(t.id))}>
              <td className="mono hl-cyan">{t.id}</td><td className="mono">{t.tpl}</td><td>{t.target}</td>
              <td className="mono faint">{t.pre.join(", ") || "—"}</td><td className="mono">{t.exec}</td>
              <td className="mono faint">{t.net}</td><td><HitlBadge t={t} /></td>
              <td className="mono faint">{t.expire}min</td><td><StatusBadge s={t.status} /></td>
            </tr>
          ))}
        </tbody></table>
      </div>
    ) : null}
  </>;
}
