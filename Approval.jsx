/* =====================================================================
   页面：审批中心
   ===================================================================== */
import { useState } from "react";
import { state, RT, S, SC, INC, activeIncs, stageOf, useApp } from "../core/store.js";
import { DB, SCEN } from "../core/data.js";
import { SevBadge, StatusBadge, CtxBar, Pipeline } from "../ui/common.jsx";
import { switchInc, go } from "../actions/system.js";
import { approvePlan } from "../actions/pipeline.js";

export default function Approval() {
  useApp();
  const [win, setWin] = useState(2);
  const [dbl, setDbl] = useState(false);
  const waiting = activeIncs().filter((i) => RT[i.id].planSelected && !RT[i.id].approved);
  const approvedIncs = activeIncs().filter((i) => RT[i.id].approved);
  const s = S(), ap = s.approval, a = SC().assessment;

  return <>
    <CtxBar />
    <div className="card mb14"><h3>闭环进度 <span className="sub">{INC().id} · {INC().title}</span></h3><Pipeline stage={s.stage} /></div>

    <div className="grid g32">
      <div className="card">
        <h3>审批队列 <span className="sub">{waiting.length} 个待审批 · 高影响动作必须人工决策</span></h3>
        {waiting.length ? waiting.map((i) => {
          const w = RT[i.id];
          return (
            <div key={i.id} className={"list-item " + (i.id === state.activeInc ? "sel" : "")} onClick={() => switchInc(i.id)}>
              <span className="dot a pulse"></span>
              <div style={{ flex: 1 }}>
                <div><span className="mono hl-amber">{w.approval.id}</span> · {w.planSelected} {SCEN[i.id].plans.find((p) => p.id === w.planSelected)?.name || ""}</div>
                <div className="faint" style={{ fontSize: "11px", marginTop: "2px" }}>{i.id} · {i.title.slice(0, 14)}… · {w.approval.level}</div>
              </div>
              <StatusBadge s="WAITING" />
            </div>
          );
        }) : (
          <div className="empty" style={{ padding: "24px" }}>暂无待审批事项<br /><span className="hint">在「方案规划」选择方案后自动生成审批单</span></div>
        )}

        {approvedIncs.length ? <>
          <h3 style={{ marginTop: "16px" }}>已审批</h3>
          {approvedIncs.map((i) => {
            const w = RT[i.id];
            return (
              <div key={i.id} className="list-item" onClick={() => switchInc(i.id)}>
                <span className="dot g"></span>
                <div style={{ flex: 1 }}><span className="mono">{w.approval ? w.approval.id : "—"}</span> · {i.id} {w.planSelected}（窗口 {w.approval ? w.approval.window : "—"}h）</div>
                <span className="badge b-green">APPROVED</span>
              </div>
            );
          })}
        </> : null}

        <h3 style={{ marginTop: "16px" }}>审批级别策略 <span className="sub">§10.2</span></h3>
        <table><tbody>
          <tr><th>动作级别</th><th>示例</th><th>审批要求</th></tr>
          {DB.policies.map((p, i) => (
            <tr key={i}>
              <td><SevBadge s={p.level === "低" ? "低" : p.level === "中" ? "中" : "高"} /> {p.level}</td>
              <td className="muted">{p.example}</td><td>{p.approval}</td>
            </tr>
          ))}
        </tbody></table>
      </div>

      <div className="card">
        <h3>审批详情 <span className="sub">界面须完整展示决策依据（§10.3）</span></h3>
        {ap && ap.status === "WAITING" ? <>
          <div className="kv"><span className="k">事件摘要</span><span className="v">{a.summary}</span></div>
          <div className="kv"><span className="k">攻击研判</span><span className="v">{a.techniques.map((t) => <span key={t.id} className="mono hl-red">{t.id}</span>)} · {a.confidence} · 结论为 SUPPORTED 假设</span></div>
          <div className="kv"><span className="k">受影响对象</span><span className="v">
            {a.affected_assets.map((x) => <span key={x} className="chip">{x}</span>)}<br />
            <span className="hl-amber" style={{ fontSize: "11px" }}>{a.affected_services.map((x, i) => <div key={i}>{x}</div>)}</span>
          </span></div>
          <div className="kv"><span className="k">候选方案</span><span className="v">
            {SC().plans.map((p, i) => (
              <span key={p.id}>{i ? " / " : ""}{p.id} {p.name}{p.id === ap.plan ? <b className="hl-cyan">（已选）</b> : null}{p.rule === "DENY" ? <span className="faint">（被硬规则拒绝）</span> : null}</span>
            ))}
          </span></div>
          <div className="kv"><span className="k">执行设备</span><span className="v mono" style={{ fontSize: "11px" }}>{[...new Set(s.tasks.map((t) => t.exec))].join(" · ")}</span></div>
          <div className="kv"><span className="k">规则校验</span><span className="v">
            {["R-01 目标类型 ✓", "R-02 能力匹配 ✓", "R-03 网络域一致 ✓", "R-04 不涉及关键资产自动动作 ✓", "R-05 回滚动作齐备 ✓", "R-08 能力健康 ✓"].map((r) => (
              <div key={r} className="hl-green" style={{ fontSize: "11px" }}>{r}</div>
            ))}
          </span></div>
          <div className="kv"><span className="k">业务影响</span><span className="v">{SC().plans.find((p) => p.id === ap.plan)?.impact} · 回滚：restore_endpoint / restore_account</span></div>
          <div className="kv"><span className="k">版本记录</span><span className="v mono" style={{ fontSize: "10.5px" }}>
            model={state.llmCfg.model} · temp={state.llmCfg.temp} · prompt=v4.0.7 · attack=v19.2 · d3fend=v1.6.0 · policy=v2.3 · capability_snapshot=v3.1 · action_template=v1.4<br />
            <span className="faint">§17.4 版本锁定：保证事后能回答「当时为什么生成这个方案」，历史 Incident 可按原版本复盘</span>
          </span></div>
          <div className="kv"><span className="k">审批模式</span><span className="v">
            {state.pipeCfg.approval.mode === "double" ? <span className="badge b-amber">高影响双人审批（流程配置④）</span>
              : state.pipeCfg.approval.mode === "auto_low" ? <span className="badge b-cyan">低危自动 + 高危人工（本事件仍需人工）</span>
                : <span className="badge b-cyan">全部人工审批</span>}
            <span className="faint" style={{ fontSize: "10.5px" }}> 系统治理→流程配置④可调整</span>
          </span></div>
          <div className="mt14 flex" style={{ gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <label className="hint">账户限制窗口</label>
            <select className="btn sm" style={{ background: "var(--panel3)" }} value={win} onChange={(e) => setWin(parseInt(e.target.value))}>
              <option value="1">1 小时</option><option value="2">2 小时（指挥员调整）</option><option value="4">4 小时</option>
            </select>
            {state.pipeCfg.approval.mode === "double" ? (
              <label className="hint" style={{ display: "flex", alignItems: "center", gap: "5px", border: "1px solid rgba(251,191,36,.4)", borderRadius: "6px", padding: "4px 8px" }}>
                <input type="checkbox" checked={dbl} onChange={(e) => setDbl(e.target.checked)} /> 第二审批人已复核（双人审批模式）
              </label>
            ) : null}
            <button className="btn green" onClick={() => approvePlan(true, win, dbl)}>✓ 批准并下发</button>
            <button className="btn danger" onClick={() => approvePlan(false)}>✕ 拒绝</button>
          </div>
          <div className="hint mt8">人工修改将记录为 {ap.plan}-v2 并进入版本链；批准仅生成审批凭证，不代表设备已被操作。</div>
        </> : ap && ap.status === "APPROVED" ? <>
          <div className="kv"><span className="k">审批凭证</span><span className="v mono">{ap.id} · {ap.plan}-v2</span></div>
          <div className="kv"><span className="k">决定</span><span className="v"><span className="badge b-green">已于 {ap.decidedAt} 由 指挥员·王砺锋 批准（限制窗口 {ap.window}h）</span></span></div>
          <div className="mt14 flex" style={{ gap: "8px" }}>
            <button className="btn primary" onClick={() => go("tasks")}>→ 进入任务编排</button>
            {stageOf(state.activeInc) >= 8 ? <span className="badge b-green">该事件已闭环</span> : null}
          </div>
        </> : (
          <div className="empty">当前事件暂无审批单<br /><span className="hint">在「方案规划」选择方案后会自动生成；左侧队列可切换其他待审批事件</span></div>
        )}
      </div>
    </div>
  </>;
}
