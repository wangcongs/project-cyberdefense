/* =====================================================================
   页面：效果验证（Effect Verification · 独立证据复核 · REPLAN 演练）
   ===================================================================== */
import { state, S, SC, INC, useApp } from "../core/store.js";
import { StatusBadge, CtxBar, Pipeline, Console } from "../ui/common.jsx";
import { runVerify, saveCase, demoReplan } from "../actions/pipeline.js";

export default function Effect() {
  useApp();
  const s = S(), sc = SC();
  const allDone = s.tasks.every((t) => t.status === "SUCCESS");

  return <>
    <CtxBar />
    <div className="card mb14"><h3>闭环进度 <span className="sub">{INC().id} · {INC().title}</span></h3><Pipeline stage={s.stage} /></div>

    <div className="grid g32">
      <div className="card">
        <h3>Effect Verification 独立证据复核 <span className="sub">API 返回成功 ≠ 防御成功（§14.1）</span></h3>
        {allDone ? <>
          <table><tbody>
            <tr><th>验证项</th><th>独立数据源</th><th>通过条件</th><th>结果</th></tr>
            {sc.effectChecks.map((c, i) => (
              <tr key={i}>
                <td>{c.item}</td><td className="mono faint">{c.src}</td>
                <td className="muted" style={{ fontSize: "11px" }}>{c.cond}</td>
                <td>{s.verified || i < (s.verifyN || 0) ? <StatusBadge s="PASS" /> : <span className="badge b-gray">待验证</span>}</td>
              </tr>
            ))}
          </tbody></table>
          <div className="mt14 flex" style={{ gap: "8px" }}>
            <button className="btn primary" onClick={() => runVerify()} disabled={s.verified}>☑ 执行效果验证</button>
            {s.verified ? <span className="badge b-green">EffectReport = ACHIEVED · 残余风险低</span> : null}
          </div>
        </> : (
          <div className="empty">等待全部任务执行完成<br /><span className="hint">效果验证使用 EDR/NDR/IAM/服务健康等独立证据，不依赖设备 API 返回值</span></div>
        )}
      </div>
      <div className="card">
        <h3>EffectReport 效果报告 <span className="sub">验证复杂时可调用 LLM 生成面向人的解释</span></h3>
        {s.verified ? <>
          <div className="kv"><span className="k">plan_id</span><span className="v mono">{s.planSelected ? `${s.planSelected}-v2` : "—"}</span></div>
          <div className="kv"><span className="k">expected</span><span className="v">遏制攻击行为、保全取证、业务影响最小化</span></div>
          <div className="kv"><span className="k">observed</span><span className="v">{sc.effectChecks.slice(0, 3).map((c) => c.item + " ✓").join("；")}；关键业务健康</span></div>
          <div className="kv"><span className="k">status</span><span className="v"><span className="badge b-green">ACHIEVED</span> · Incident → <span className="badge b-green">CONTAINED</span></span></div>
          <div className="kv"><span className="k">residual_risk</span><span className="v">低 · 凭证重置/复盘事项纳入人工流程</span></div>
          <div className="kv"><span className="k">replan_required</span><span className="v mono">false</span></div>
          <div className="mt14"><button className="btn green" onClick={() => saveCase()} disabled={s.caseSaved}>❏ 确认遏制并沉淀案例</button></div>
        </> : <div className="empty">尚未生成效果报告</div>}
      </div>
    </div>

    <div className="card mt14">
      <h3>重新规划 REPLAN（§14.3） <span className="sub">动作执行失败 / 效果未达到 / 出现新证据 / 业务影响超预期 → Workflow 回到 PLANNING</span></h3>
      <div className="flex" style={{ gap: "24px", flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: "320px" }}>
          <div className="flow-box mb14"><b>失败原因注入：</b>回到 PLANNING 时，失败任务、设备响应与验证证据作为 Planning Agent 上下文；<b className="hl-red">系统不重复提交已经失败且条件未改变的方案</b>。</div>
          <div className="flex" style={{ gap: "8px" }}>
            <button className="btn sm" onClick={() => demoReplan()}>▶ 演练：模拟效果验证未通过</button>
            <span className="hint">观察 REPLAN 决策链（VERIFYING → REPLAN → PLANNING）</span>
          </div>
        </div>
        <Console lines={state.uiLogs.replan} maxH={220} placeholder="// REPLAN 演练日志" style={{ flex: 1, minWidth: "320px" }} />
      </div>
    </div>
  </>;
}
