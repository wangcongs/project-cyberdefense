/* =====================================================================
   页面：方案规划（Planning Agent）
   ===================================================================== */
import { state, S, SC, INC, useApp } from "../core/store.js";
import { StatusBadge, CtxBar, Pipeline } from "../ui/common.jsx";
import { runPlanning, selectPlan } from "../actions/pipeline.js";

function PlanCard({ p }) {
  const s = S();
  const denied = p.rule === "DENY";
  const sel = s.planSelected === p.id;
  const overCap = SC().plans.findIndex((x) => x.id === p.id) >= state.pipeCfg.planning.maxPlans;
  return (
    <div className={"plan-card " + (p.recommended ? "recommended" : "") + (denied ? " denied" : "")} style={overCap ? { opacity: ".42", filter: "saturate(.5)" } : undefined}>
      <div className="p-head">
        <span className="p-name">{p.id} · {p.name}</span>
        {p.recommended ? <span className="badge b-cyan">系统推荐</span> : null}
        {denied ? <StatusBadge s="DENY" /> : <StatusBadge s="PASS" />}
        {overCap ? <span className="badge b-gray">超出候选上限 {state.pipeCfg.planning.maxPlans}（流程配置③）</span> : null}
        {sel ? <span className="badge b-green">已提交审批</span> : null}
      </div>
      <div className="hint mb14">{p.strategy} · 业务影响:{p.impact}</div>
      <div style={{ fontSize: "11.5px", lineHeight: 2 }} className="muted">
        {p.actions.map((a, i) => <div key={i}><span className="mono hl-cyan">{i + 1}.</span> <span className="mono">{a}</span></div>)}
      </div>
      {denied ? (
        <div className="plan-deny-note">⛔ {p.ruleNote}</div>
      ) : <>
        <div className="mt8" style={{ borderTop: "1px dashed var(--border2)", paddingTop: "10px" }}>
          {[["安全控制效果", p.scores.effect, "#34d399"], ["业务影响(越小越高)", p.scores.biz, "#22d3ee"], ["现场可执行性", p.scores.exec, "#a78bfa"], ["证据可信度", p.scores.evi, "#fbbf24"]].map(([n, v, c]) => (
            <div key={n} className="scorebar" style={{ marginBottom: "6px" }}>
              <span style={{ width: "130px" }} className="faint">{n}</span>
              <div className="progress"><i style={{ width: v * 20 + "%", background: c }}></i></div><b style={{ color: c }}>{v}</b>
            </div>
          ))}
        </div>
        <div className="mt8 flex" style={{ gap: "8px" }}>
          <button className={"btn sm " + (p.recommended ? "primary" : "")} onClick={() => selectPlan(p.id)} disabled={sel || s.approved || overCap}>
            {sel ? "已提交" : overCap ? "未纳入本轮" : "选择并提交审批"}
          </button>
          <span className="hint">{p.diff}</span>
        </div>
      </>}
    </div>
  );
}

export default function Planning() {
  useApp();
  const s = S();

  return <>
    {!state.llmOnline ? <div className="degraded-banner">⚠ LLM 不可用 —— Planning Agent 停用，仅可套用已审批 Playbook 模板。</div> : null}
    {!state.pipeCfg.planning.aiOn ? <div className="degraded-banner">⚙ AI 规划已被系统配置停用（系统治理→流程配置③）—— 不生成新候选方案，仅可使用已审批 Playbook 模板。</div> : null}

    <CtxBar />
    <div className="card mb14"><h3>闭环进度 <span className="sub">{INC().id} · {INC().title}</span></h3><Pipeline stage={s.stage} /></div>

    <div className="card mb14">
      <h3>Planning Agent <span className="sub">仅从注册的 DefenseAction / Capability 中选动作，不允许自造设备命令</span></h3>
      <div className="flow-box mb14"><b>输入：</b>AttackAssessment + 现场可用能力 + D3FEND/Playbook 候选 + 业务影响 + 相似案例 + Policy 上下文。<b>原则：</b>一次生成 2~3 个策略差异明显的方案，经硬规则过滤 + 4 项简单评分排序，最终由有权限人员选择。</div>
      <div className="flex" style={{ gap: "8px" }}>
        <button className="btn primary" id="btn-plan" onClick={() => runPlanning()} disabled={!s.assessDone || s.plansDone || s.pRunning || !state.llmOnline || !state.pipeCfg.planning.aiOn}>
          {s.pRunning ? "❖ Planning Agent 生成中…" : "❖ 生成候选防御方案"}
        </button>
        {!s.assessDone ? <span className="hint">需先完成 AI 研判</span> : null}
        {s.plansDone ? <span className="badge b-green">{SC().plans.length} 个候选方案已生成（{SC().plans.filter((p) => p.rule === "DENY").length} 个被硬规则过滤）</span> : null}
      </div>
    </div>

    {s.plansDone ? <>
      <div className="grid g2" id="plan-cards">
        {SC().plans.map((p) => <PlanCard key={p.id} p={p} />)}
      </div>
      <div className="card mt14">
        <h3>方案标准化（§8.4） <span className="sub">LLM 输出 CandidatePlan 后，由普通程序完成归一化 —— 无法映射到注册动作模板的内容只展示给人，不进入执行链</span></h3>
        <div className="grid g2">
          <div>
            <div className="f-label" style={{ marginBottom: "6px" }}>LLM 原始输出（CandidatePlan 摘录）</div>
            <div className="console" style={{ maxHeight: "200px" }}>
              <div className="ln ai">[LLM] 建议动作 4 项：terminate_session(rnd_chen) · collect_evidence(RND-WS-23) · isolate_endpoint(RND-WS-23) · <span className="hl-red">block_egress_ip(fortigate-cli "config firewall addr…")</span></div>
              <div className="ln ai">[LLM] 建议补充：对源终端执行厂商深度扫描脚本 dump_mem.bin</div>
            </div>
          </div>
          <div>
            <div className="f-label" style={{ marginBottom: "6px" }}>程序归一化结果</div>
            <div className="flow-box" style={{ marginBottom: "8px" }}><b className="hl-green">✓ 已归一：</b>terminate_session → 注册模板 · 目标 account:LAB:rnd_chen 解析成功 · 能力绑定 AD/IAM-01 · 回滚模板 restore_account 自动补齐</div>
            <div className="flow-box" style={{ marginBottom: "8px" }}><b className="hl-green">✓ 已归一：</b>collect_evidence / isolate_endpoint → 注册模板 · 依赖检查通过（取证先于隔离）</div>
            <div className="flow-box" style={{ borderColor: "rgba(248,113,113,.45)" }}><b className="hl-red">✕ 不可执行建议：</b>block_egress_ip 含厂商 CLI，未注册于 ActionTemplate；dump_mem.bin 非注册动作。<b>标记为「不可执行建议」仅展示给人</b>，不进入 DefensePlan 执行链 —— LLM 永远不直接生成设备命令。</div>
          </div>
        </div>
      </div>
    </> : (
      <div className="card"><div className="empty">候选方案将在此展示（含硬规则过滤结果与4维评分）</div></div>
    )}
  </>;
}
