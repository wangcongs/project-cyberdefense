/* =====================================================================
   页面：事件中心
   ===================================================================== */
import { state, RT, STAGES, activeIncs, stageOf, incEventCount, useApp } from "../core/store.js";
import { DB } from "../core/data.js";
import { SevBadge, nextPageOf } from "../ui/common.jsx";
import { switchInc, go } from "../actions/system.js";
import { setEvFilter, showEvent } from "../actions/topology.js";

export default function Events() {
  useApp();
  const incs = activeIncs(), ec = state.pipeCfg.events;
  const filtered = DB.events.filter((e) =>
    state.eventFilter === "ALL" || (state.eventFilter === "HIST" ? !e.incident || e.incident === "INC-20260916-07" : e.incident === state.eventFilter));

  return <>
    {!ec.autoCase ? (
      <div className="degraded-banner" style={{ borderColor: "rgba(251,191,36,.45)" }}>⚙ 自动成案已停用（系统治理→流程配置①）：新告警进入告警池等待人工合并。当前演示数据为已成案事件。</div>
    ) : null}
    <div className="hint mb14" style={{ fontSize: "10.5px" }}>
      成案策略（流程配置①）：{ec.autoCase ? <b className="hl-cyan">自动成案</b> : <b className="hl-amber">人工成案</b>} · 关联窗口 {ec.corrWindow}min · 最小告警数 {ec.minAlerts} 条
    </div>

    <div className="card mb14">
      <h3>进行中的攻击事件 <span className="sub">{incs.filter((i) => stageOf(i.id) < 8).length} 个在处 · {incs.filter((i) => stageOf(i.id) >= 8).length} 个已闭环 · 点击卡片切换处置上下文</span></h3>
      <div className="grid g2">
        {incs.map((i) => {
          const st = stageOf(i.id), rt = RT[i.id];
          const done = rt.tasks.filter((t) => t.status === "SUCCESS").length;
          return (
            <div key={i.id} className={"inc-card " + (i.id === state.activeInc ? "active" : "")} onClick={() => switchInc(i.id)}>
              <div className="ic-head">
                <span className="mono hl-cyan">{i.id}</span><SevBadge s={i.sev} /><span className="badge b-cyan">{i.net}</span>
                {st >= 8 ? <span className="badge b-green">已遏制</span> : <span className="badge b-amber pulse">{STAGES[st]}中</span>}
                {i.id === state.activeInc ? <span className="badge b-cyan">当前处置</span> : null}
              </div>
              <div className="ic-title">{i.title}</div>
              <div className="ic-desc">{i.desc}</div>
              <div className="ic-bar">
                <div className="flex" style={{ justifyContent: "space-between", marginBottom: "4px" }}>
                  <span className="faint" style={{ fontSize: "10px" }}>闭环 · {STAGES[st]}</span><span className="mono faint" style={{ fontSize: "10px" }}>{st}/9</span>
                </div>
                <div className="progress"><i style={{ width: (st / 9 * 100) + "%" }}></i></div>
              </div>
              <div className="ic-foot">
                <span>告警 {incEventCount(i.id)} 条</span><span>·</span><span>任务 {done}/{rt.tasks.length}</span><span>·</span><span className="mono">{i.created.slice(5, 16)}</span>
                <span className="spacer"></span>
                {st === 0 ? (
                  <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); switchInc(i.id); go("analysis"); }}>进入研判</button>
                ) : st < 8 ? (
                  <button className="btn sm" onClick={(e) => { e.stopPropagation(); switchInc(i.id); go(nextPageOf(st)); }}>继续处置</button>
                ) : (
                  <span className="badge b-green">案例已沉淀</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flow-box mt14" style={{ marginTop: "14px" }}><b>成案逻辑（确定性规则，非LLM）：</b>同一源资产短时间内出现终端异常和异常网络通信 / 同一账户跨多资产异常认证 / 同一目标服务被多类安全设备同时告警 / 跨域通信不符合业务基线 → 合并为 Incident。AI 只分析 Incident，不直接消费海量原始日志。历史闭环事件 INC-20260916-07 见文末档案表。</div>
    </div>

    <div className="card">
      <h3>SecurityEvent 统一事件流
        <span className="sub">全部 {DB.events.length} 条 · 级别：高危 {DB.events.filter((e) => e.sev === "high").length} / 中危 {DB.events.filter((e) => e.sev === "medium").length} / 低危 {DB.events.filter((e) => e.sev === "low").length}</span>
      </h3>
      <div className="filter-chips">
        <span className={"fchip " + (state.eventFilter === "ALL" ? "active" : "")} onClick={() => setEvFilter("ALL")}>全部<span className="n">{DB.events.length}</span></span>
        {incs.map((i) => (
          <span key={i.id} className={"fchip " + (state.eventFilter === i.id ? "active" : "")} onClick={() => setEvFilter(i.id)}>
            {i.id.slice(-2)}号事件·{i.title.slice(0, 8)}<span className="n">{incEventCount(i.id)}</span>
          </span>
        ))}
        <span className={"fchip " + (state.eventFilter === "HIST" ? "active" : "")} onClick={() => setEvFilter("HIST")}>
          历史/未成案<span className="n">{DB.events.filter((e) => !e.incident || e.incident === "INC-20260916-07").length}</span>
        </span>
      </div>
      <table><tbody>
        <tr><th>时间</th><th>事件ID</th><th>来源系统</th><th>类型</th><th>级别</th><th>网络域</th><th>核心事实</th><th>归档</th></tr>
        {filtered.map((e) => (
          <tr key={e.id} className="clickable" onClick={() => showEvent(e.id)}>
            <td className="mono faint" style={{ whiteSpace: "nowrap" }}>{e.time.slice(5, 16)}</td>
            <td className="mono hl-cyan">{e.id}</td>
            <td><span className="tag">{e.src}</span></td>
            <td className="mono">{e.type}</td>
            <td><SevBadge s={e.sev} /></td>
            <td className="mono faint">{e.net}</td>
            <td className="muted" style={{ fontSize: "11px", maxWidth: "380px" }}>{e.facts}</td>
            <td>{e.incident ? <span className="badge b-purple">{e.incident}</span> : <span className="badge b-gray">未成案</span>}</td>
          </tr>
        ))}
      </tbody></table>
      <div className="hint mt8">点击任意行查看事件档案（含 evidence_ref / SHA-256 存证与事实含义）。原始日志被标记为不可信数据，仅作证据保存，防止 Prompt Injection。</div>
    </div>
  </>;
}
