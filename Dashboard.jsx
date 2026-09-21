/* =====================================================================
   页面：态势总览
   ===================================================================== */
import { state, RT, STAGES, activeIncs, stageOf, incEventCount, useApp } from "../core/store.js";
import { DB } from "../core/data.js";
import { SevBadge, nextPageOf } from "../ui/common.jsx";
import { switchInc, go } from "../actions/system.js";
import { showEvent, showAsset } from "../actions/topology.js";

export default function Dashboard() {
  useApp();
  const incs = activeIncs();
  const active = incs.filter((i) => stageOf(i.id) < 8).length;
  const pendingAppr = incs.filter((i) => RT[i.id].planSelected && !RT[i.id].approved).length;
  const runningTasks = incs.reduce((a, i) => a + RT[i.id].tasks.filter((t) => t.status === "RUNNING").length, 0);
  const contained = incs.filter((i) => stageOf(i.id) >= 8).length + 1;

  return <>
    {!state.llmOnline ? (
      <div className="degraded-banner">⚠ <b>降级模式：</b>LLM / AI Decision 不可用 —— 已切换为「{state.llmCfg.degrade === "playbook" ? "人工研判 + 已审批 Playbook" : "纯人工处置流程"}」（系统治理→大模型配置可调整降级策略），高影响动作仍受 Policy 与审批控制（Fail Closed）。</div>
    ) : null}

    <div className="grid g4 mb14">
      <div className="kpi c-red"><div className="k-label">活跃攻击事件</div><div className="k-val">{active}</div><div className="k-foot">高危 {incs.filter((i) => i.sev === "高" && stageOf(i.id) < 8).length} · 中危 {incs.filter((i) => i.sev === "中" && stageOf(i.id) < 8).length}</div></div>
      <div className="kpi c-amber"><div className="k-label">待人工审批</div><div className="k-val">{pendingAppr}</div><div className="k-foot">高影响动作必须人工决策</div></div>
      <div className="kpi c-cyan"><div className="k-label">执行中任务</div><div className="k-val">{runningTasks}</div><div className="k-foot">DefenseTask DAG · 分域受控执行</div></div>
      <div className="kpi c-green"><div className="k-label">本月成功遏制</div><div className="k-val">{contained}</div><div className="k-foot">Unauthorized Execution Rate = 0</div></div>
    </div>

    <div className="card mb14">
      <h3>进行中的攻击事件 <span className="sub">{active} 个在处 · 点击卡片切换处置上下文</span></h3>
      <div className="grid g2">
        {incs.map((i) => {
          const st = stageOf(i.id), rt = RT[i.id];
          const done = rt.tasks.filter((t) => t.status === "SUCCESS").length;
          return (
            <div key={i.id} className={"inc-card " + (i.id === state.activeInc ? "active" : "")} onClick={() => switchInc(i.id)}>
              <div className="ic-head">
                <span className="mono hl-cyan">{i.id}</span><SevBadge s={i.sev} /><span className="badge b-cyan">{i.net}</span>
                {st >= 8 ? <span className="badge b-green">已遏制</span> : <span className="badge b-amber pulse">{STAGES[st]}中</span>}
              </div>
              <div className="ic-title">{i.title}</div>
              <div className="ic-desc">{i.desc.slice(0, 68)}…</div>
              <div className="ic-bar">
                <div className="flex" style={{ justifyContent: "space-between", marginBottom: "4px" }}>
                  <span className="faint" style={{ fontSize: "10px" }}>闭环进度 · {STAGES[st]}</span><span className="mono faint" style={{ fontSize: "10px" }}>{st}/9</span>
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
    </div>

    <div className="grid g23 mb14">
      <div className="card">
        <h3>网络域态势 <span className="sub">6 个网络域 · {DB.assets.length} 个纳管资产 · {DB.devices.length} 类安全设备</span></h3>
        <table>
          <tbody>
            <tr><th>网络域</th><th>网段</th><th>业务定位</th><th>状态</th></tr>
            {DB.networks.map((n) => {
              const underAttack = (stageOf("INC-20260918-01") < 8 && n.id === "LAN-B")
                || (stageOf("INC-20260918-02") < 8 && (n.id === "LAN-B" || n.id === "LAN-C"))
                || (stageOf("INC-20260918-03") < 8 && n.id === "INFRA")
                || (stageOf("INC-20260918-04") < 8 && n.id === "LAN-A");
              return (
                <tr key={n.id} className="clickable" onClick={() => go("topology")}>
                  <td><span className="dot" style={{ background: n.color, boxShadow: "0 0 6px " + n.color }}></span><b>{n.id}</b> <span className="faint">{n.name}</span></td>
                  <td className="mono">{n.cidr}</td><td className="muted">{n.biz}</td>
                  <td>{underAttack ? <span className="badge b-red pulse">遭受攻击</span> : <span className="badge b-green">正常</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>ATT&amp;CK 技术分布 <span className="sub">近30天</span></h3>
        {[["T1078.002 域账户异常", 42, "#f87171"], ["T1021.001 RDP横向", 31, "#fbbf24"], ["T1046 网络探测", 18, "#22d3ee"], ["T1071.001 C2外联", 12, "#a78bfa"], ["T1110.001 暴力破解", 8, "#34d399"], ["其他", 6, "#5b6d92"]].map(([n, v, c]) => (
          <div key={n} className="scorebar" style={{ marginBottom: "10px" }}>
            <span style={{ width: "150px" }} className="muted">{n}</span>
            <div className="progress"><i style={{ width: v + "%", background: c }}></i></div><b style={{ color: c }}>{v}%</b>
          </div>
        ))}
        <div className="hint mt14">数据来自 ATT&amp;CK v19.2 离线知识包映射统计。</div>
      </div>
    </div>

    <div className="grid g2">
      <div className="card">
        <h3>最新事件流 <span className="sub">SecurityEvent 实时接入</span></h3>
        {DB.events.slice(0, 8).map((e) => (
          <div key={e.id} className="list-item" onClick={() => showEvent(e.id)}>
            <span className={"dot " + (e.sev === "high" ? "r" : e.sev === "medium" ? "a" : "gray")}></span>
            <div style={{ flex: 1 }}>
              <div><span className="mono hl-cyan">{e.id}</span> <span className="muted">{e.type}</span> <SevBadge s={e.sev} /></div>
              <div className="faint" style={{ fontSize: "11px", marginTop: "2px" }}>{e.facts}</div>
            </div>
            <span className="faint mono" style={{ fontSize: "10px" }}>{e.time.slice(5, 16)}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>关键业务（Mission）健康 <span className="sub">Asset → Service → Mission 依赖链</span></h3>
        {DB.missions.map((m) => {
          const threat = (m.id === "MISSION-RD-DESIGN" && (stageOf("INC-20260918-01") < 8 || stageOf("INC-20260918-03") < 8))
            || (m.id === "MISSION-LAB-TEST" && stageOf("INC-20260918-02") < 8)
            || (m.id === "MISSION-OFFICE" && stageOf("INC-20260918-04") < 8);
          return (
            <div key={m.id} className="list-item" onClick={() => showAsset(m.asset)}>
              <span className={"dot " + (threat ? "a" : "g")}></span>
              <div style={{ flex: 1 }}>
                <div><b>{m.name}</b> <SevBadge s={m.crit} /></div>
                <div className="faint" style={{ fontSize: "11px", marginTop: "2px" }}><span className="mono">{m.asset}</span> → {m.svc} · {m.interrupt}</div>
              </div>
              {threat ? <span className="badge b-amber">受威胁</span> : <span className="badge b-green">运行中</span>}
            </div>
          );
        })}
      </div>
    </div>
  </>;
}
