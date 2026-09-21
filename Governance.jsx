/* =====================================================================
   页面：系统治理（闭环流程配置 / 大模型配置 / 角色与权限 / 架构与契约 / 故障演练与审计）
   ===================================================================== */
import { state, useApp, ROLES, PERM_NAMES, roleOf, hasPerm } from "../core/store.js";
import { DB } from "../core/data.js";
import { Tabs } from "../ui/common.jsx";
import { setTab, setRole, govGet, govSet, toggleLLM, toggleDevice, resetAll } from "../actions/system.js";

const LLM_MODELS = {
  "qwen25-72b": "Qwen2.5-72B（本地部署）",
  "deepseek-v3": "DeepSeek-V3（本地部署）",
  "glm4-9b": "GLM-4-9B（本地轻量）",
  "api-external": "外部 API · GPT-4o（涉密禁用）",
};

/* ===== 配置控件（仅系统管理员可写，全部留痕） ===== */
function CfgToggle({ path, label, desc }) {
  const on = govGet(path), dis = !hasPerm("govcfg");
  return (
    <div className="cfg-row">
      <div><div className="cfg-lab">{label}</div><div className="cfg-desc">{desc}</div></div>
      <div className="cfg-ctl">
        <label className="sw"><input type="checkbox" checked={!!on} disabled={dis} onChange={(e) => govSet(path, e.target.checked)} /><i></i></label>
      </div>
    </div>
  );
}
function CfgNum({ path, label, min, max, unit, desc }) {
  const v = govGet(path), dis = !hasPerm("govcfg");
  return (
    <div className="cfg-row">
      <div><div className="cfg-lab">{label}</div><div className="cfg-desc">{desc}</div></div>
      <div className="cfg-ctl">
        <input type="number" min={min} max={max} value={v} disabled={dis}
          onChange={(e) => govSet(path, Math.max(min, Math.min(max, parseInt(e.target.value) || v)))} />
        <span className="faint" style={{ fontSize: "10px" }}>{unit}</span>
      </div>
    </div>
  );
}
function CfgSel({ path, label, opts, desc }) {
  const v = govGet(path), dis = !hasPerm("govcfg");
  return (
    <div className="cfg-row">
      <div><div className="cfg-lab">{label}</div><div className="cfg-desc">{desc}</div></div>
      <div className="cfg-ctl">
        <select disabled={dis} value={String(v)} onChange={(e) => govSet(path, e.target.value)}>
          {opts.map(([val, txt]) => <option key={val} value={val}>{txt}</option>)}
        </select>
      </div>
    </div>
  );
}
function GovLockNote() {
  if (hasPerm("govcfg")) return null;
  return (
    <div className="gov-lock mb14">🔒 当前角色「{roleOf().name} · {roleOf().user}」为只读视图 —— 修改系统配置需在右上角切换为 <b>系统管理员</b>。所有配置变更与越权尝试都会写入审计链。</div>
  );
}
function Fx({ t }) {
  return <div className="cfg-effect">▸ 生效位置：{t}</div>;
}

/* ===== 标签页 1：闭环流程配置 ===== */
function GovCfg() {
  return <>
    <GovLockNote />
    <div className="hint mb14" style={{ fontSize: "11px" }}>事件 → 研判 → 规划 → 审批 → 编排 → 执行 → 验证 全链路 7 个阶段的运行参数在此配置，<b className="hl-cyan">修改即时作用于对应页面行为</b>并写入审计链。当前配置角色：<b>{roleOf().name}</b></div>
    <div className="grid g2">
      <div className="card">
        <h3>① 事件成案 <span className="sub">Security Data · 确定性规则，不经 LLM</span></h3>
        <CfgToggle path="pipeCfg.events.autoCase" label="自动成案" desc="开启：规则关联+时间窗口+资产关系自动合并告警为 Incident；关闭：新告警停留告警池等待人工合并" />
        <CfgNum path="pipeCfg.events.corrWindow" label="关联时间窗口" min={5} max={60} unit="min" desc="同一资产/账户在该窗口内的告警参与规则关联" />
        <CfgNum path="pipeCfg.events.minAlerts" label="最小成案告警数" min={2} max={5} unit="条" desc="低于该数量的孤立告警不自动升级为 Incident" />
        <Fx t="「事件中心」顶部显示当前成案策略；关闭自动成案时出现告警池横幅" />
      </div>
      <div className="card">
        <h3>② AI 研判 <span className="sub">Analysis Agent · LLM 调用点 1/2</span></h3>
        <CfgToggle path="pipeCfg.analysis.aiOn" label="启用 AI 研判" desc="关闭后「运行 AI 研判」被拦截，事件只能走人工研判流程（与 LLM 故障降级路径一致）" />
        <CfgNum path="pipeCfg.analysis.confThreshold" label="置信度阈值" min={0} max={100} unit="%" desc="AttackAssessment 置信度低于该值 → 标记「强制人工复核」，不得直接进入高影响处置" />
        <CfgNum path="pipeCfg.analysis.timeout" label="LLM 调用超时" min={10} max={120} unit="s" desc="超时即失败并 Fail Closed，不做无依据猜测" />
        <Fx t="「智能研判」运行按钮与控制台日志（Prompt 构建行显示模型/温度/超时参数）" />
      </div>
      <div className="card">
        <h3>③ 方案规划 <span className="sub">Planning Agent · LLM 调用点 2/2</span></h3>
        <CfgToggle path="pipeCfg.planning.aiOn" label="启用 AI 规划" desc="关闭后仅可使用已审批 Playbook 模板，不生成新候选方案" />
        <CfgNum path="pipeCfg.planning.maxPlans" label="候选方案上限" min={2} max={4} unit="个" desc="超出上限的候选方案置灰且不可选择（控制指挥员认知负荷）" />
        <Fx t="「方案规划」候选卡片数量与可选择性" />
      </div>
      <div className="card">
        <h3>④ 人工审批 <span className="sub">Workflow &amp; Approval · 人类在环</span></h3>
        <CfgSel path="pipeCfg.approval.mode" label="审批模式" opts={[["manual", "全部人工审批（默认）"], ["double", "高影响双人审批"], ["auto_low", "低危自动 + 高危人工"]]} desc="双人模式：批准前须第二审批人勾选确认；低危自动：低危事件免人工（演示事件均为高/中危，仍会进入人工队列）" />
        <Fx t="「审批中心」批准按钮前置校验 + 模式横幅" />
      </div>
      <div className="card">
        <h3>⑤ 任务编排 <span className="sub">Task Engine · DefenseTask DAG</span></h3>
        <CfgToggle path="pipeCfg.tasks.autoDispatch" label="审批后自动下发" desc="开启：审批通过即签名分发 DefenseTask，跳过手动点击；关闭：需在任务编排页手动下发" />
        <CfgNum path="pipeCfg.tasks.maxParallel" label="最大并行度" min={1} max={4} unit="路" desc="DAG 调度同时执行的任务路上限" />
        <Fx t="审批通过动作 + 「执行监控」调度器启动日志" />
      </div>
      <div className="card">
        <h3>⑥ 分域执行 <span className="sub">Local Execution · 不使用 LLM</span></h3>
        <CfgToggle path="pipeCfg.execution.localRecheck" label="本地二次校验" desc="§3.2 职责边界：本地域执行前重检 scope/审批/状态。关闭属危险操作，仅用于演示对比" />
        <CfgNum path="pipeCfg.execution.retry" label="失败重试次数" min={0} max={3} unit="次" desc="瞬时故障允许重试上限；高影响动作任何情况下禁止盲重试" />
        <Fx t="「执行监控」横幅警告与调度日志" />
      </div>
      <div className="card" style={{ gridColumn: "1/-1" }}>
        <h3>⑦ 效果验证 <span className="sub">Effect Verification · API 成功 ≠ 防御成功</span></h3>
        <div className="grid g2">
          <div><CfgNum path="pipeCfg.effect.minEvidence" label="独立证据源要求" min={2} max={4} unit="类" desc="EDR/NDR/IAM/服务健康中至少多少类证据通过才判定 CONTAINED" /></div>
          <div><CfgToggle path="pipeCfg.effect.autoRollback" label="验证失败自动回滚" desc="任一独立证据复核不通过 → 自动执行回滚动作链（restore_endpoint / restore_account）并升级事件" /></div>
        </div>
        <Fx t="「效果验证」复核通过判定与审计记录" />
      </div>
    </div>
  </>;
}

/* ===== 标签页 2：大模型配置 ===== */
function GovLlm() {
  const c = state.llmCfg, ext = c.model === "api-external";
  return <>
    <GovLockNote />
    {ext ? <div className="degraded-banner">⛔ 已选择外部 API 模型 —— 违反涉密/隔离环境「模型本地化」要求（§16 凭证与数据不出域）。此配置仅用于演示对比，实际部署将被 Policy 拒绝。</div> : null}
    <div className="grid g2 mb14">
      <div className="card">
        <h3>模型服务 <span className="sub">本地化部署 · 数据不出域</span></h3>
        <CfgSel path="llmCfg.model" label="推理模型" opts={[["qwen25-72b", "通义千问 Qwen2.5-72B（本地部署）"], ["deepseek-v3", "DeepSeek-V3（本地部署）"], ["glm4-9b", "GLM-4-9B（本地轻量）"], ["api-external", "外部 API · GPT-4o（涉密环境禁用）"]]} desc="研判/规划共用的基座模型；版本变化会记入审批页「版本记录」" />
        <CfgSel path="llmCfg.temp" label="采样温度 temperature" opts={[["0", "0 · 确定性强"], ["0.2", "0.2 · 推荐（默认）"], ["0.5", "0.5 · 较发散"], ["0.8", "0.8 · 高发散（不推荐）"]]} desc="安全场景要求可复现输出，建议 ≤0.2" />
        <CfgSel path="llmCfg.maxTokens" label="最大输出 tokens" opts={[["1024", "1024"], ["2048", "2048"], ["4096", "4096（默认）"], ["8192", "8192"]]} desc="AttackAssessment / CandidatePlan 的结构化输出长度上限" />
        <CfgNum path="llmCfg.timeout" label="调用超时" min={10} max={120} unit="s" desc="超时即判定模型不可用，触发降级策略" />
        <CfgSel path="llmCfg.degrade" label="不可用降级策略" opts={[["playbook", "人工研判 + 已审批 Playbook（默认）"], ["manual", "纯人工处置流程"]]} desc="LLM 故障/停用时的处置路径；两种策略下高影响动作均 Fail Closed" />
        <Fx t="研判/规划控制台日志显示模型与采样参数；审批页「版本记录」中的 model 字段；降级横幅文案" />
      </div>
      <div className="card">
        <h3>调用约束 <span className="sub">§3.1 · 全系统仅两处调用 LLM</span></h3>
        <table><tbody>
          <tr><th>调用点</th><th>用途</th><th>开关位置</th></tr>
          <tr><td className="mono" style={{ fontSize: "10.5px" }}>Analysis Agent</td><td className="muted" style={{ fontSize: "11px" }}>综合研判，输出 AttackAssessment</td><td><span className="badge b-cyan">流程配置 ②</span></td></tr>
          <tr><td className="mono" style={{ fontSize: "10.5px" }}>Planning Agent</td><td className="muted" style={{ fontSize: "11px" }}>生成候选 CandidatePlan</td><td><span className="badge b-cyan">流程配置 ③</span></td></tr>
          <tr><td className="mono" style={{ fontSize: "10.5px" }}>执行链路</td><td className="muted" style={{ fontSize: "11px" }}>Task Engine / Local Execution / Tool Gateway</td><td><span className="badge b-red">永不调用</span></td></tr>
        </tbody></table>
        <div className="hint mt8">安全边界：原始日志以不可信数据隔离进 Prompt；LLM 输出必须通过实体白名单 + 证据引用校验；模型不持有设备凭证、不直接批准、不执行设备操作。当前服务状态：
          <b className={state.llmOnline ? "hl-green" : "hl-red"}>{state.llmOnline ? "● 在线" : "● 离线（" + (c.degrade === "playbook" ? "Playbook 降级" : "纯人工降级") + "）"}</b></div>
      </div>
    </div>
    <div className="card">
      <h3>当前生效配置快照 <span className="sub">随配置实时变化 · 写入每次研判/规划的审计上下文</span></h3>
      <div className="console" style={{ maxHeight: "130px" }}>
        <div className="ln info">llm.model = {c.model}  # {LLM_MODELS[c.model]}</div>
        <div className="ln info">llm.temperature = {c.temp} · max_tokens = {c.maxTokens} · timeout = {c.timeout}s</div>
        <div className="ln info">llm.degrade_on_unavailable = {c.degrade}  # {c.degrade === "playbook" ? "人工研判 + 已审批 Playbook" : "纯人工处置流程"}</div>
        <div className={"ln " + (ext ? "err" : "ok")}>llm.data_egress = {ext ? "EXTERNAL — POLICY VIOLATION" : "none  # 全链路本地推理，数据不出域"}</div>
      </div>
    </div>
  </>;
}

/* ===== 标签页 3：角色与权限 ===== */
function GovPerm() {
  const permKeys = Object.keys(PERM_NAMES);
  return <>
    <div className="hint mb14" style={{ fontSize: "11px" }}>RBAC 基于角色的访问控制：右上角切换登录角色后，<b className="hl-cyan">无权限的操作会被即时拦截并写入审计链</b>（可切换审计员体验全只读视图）。</div>
    <div className="grid g4 mb14">
      {Object.entries(ROLES).map(([id, r]) => (
        <div key={id} className="card" style={state.role === id ? { borderColor: r.color } : undefined}>
          <div className="flex" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ fontSize: "13px" }}>{r.ico} {r.name}</b>
            {state.role === id ? <span className="badge b-green">当前登录</span> : <button className="btn sm" onClick={() => setRole(id)}>切换</button>}
          </div>
          <div className="hint mt8">{r.user}</div>
          <div className="cfg-desc" style={{ margin: "6px 0 8px" }}>{r.desc}</div>
          <div>{r.perms.length
            ? r.perms.map((p) => <span key={p} className="badge b-cyan" style={{ margin: "0 4px 4px 0" }}>{PERM_NAMES[p]}</span>)
            : <span className="badge b-gray">只读（无操作权限）</span>}</div>
        </div>
      ))}
    </div>
    <div className="card">
      <h3>权限矩阵 <span className="sub">敏感操作 × 角色 · 拦截记录见「故障演练与审计」</span></h3>
      <table><tbody>
        <tr><th>敏感操作</th>{Object.values(ROLES).map((r) => <th key={r.name} style={{ textAlign: "center" }}>{r.ico} {r.name}</th>)}</tr>
        {permKeys.map((p) => (
          <tr key={p}>
            <td className="muted" style={{ fontSize: "11px" }}>{PERM_NAMES[p]}</td>
            {Object.values(ROLES).map((r) => (
              <td key={r.name} style={{ textAlign: "center" }}>{r.perms.includes(p) ? <b className="hl-green">✓</b> : <span className="faint">—</span>}</td>
            ))}
          </tr>
        ))}
      </tbody></table>
      <div className="hint mt8">设计原则（§3.2）：处置决策权（审批/分发）与系统配置权分离 —— 指挥员不能改系统规则，管理员不能参与处置；审计员不可做任何变更。越权尝试统一返回 ⛔ 并记审计。</div>
    </div>
  </>;
}

/* ===== 标签页 4：架构与契约（静态设计约束） ===== */
function GovArch() {
  const svc = [["Security Data", "接入、标准化、证据保存、规则关联", "✕"], ["Knowledge Service", "本体、图谱、ATT&CK/D3FEND、案例检索", "✕"], ["AI Decision", "Analysis + Planning Agent", "✓"], ["Decision Control", "Schema、Policy、Capability、影响检查", "✕"], ["Workflow & Approval", "状态机、人工审批、版本管理", "✕"], ["Execution Control", "任务生成、签名、分域投递", "✕"], ["Local Execution", "本地二次校验、Tool Gateway、Adapter", "✕"]];
  const bound = [["LLM", "语义理解、综合研判、方案生成", "不直接批准、不执行设备操作"], ["本体/图谱", "统一对象、关系、约束", "不替代实时设备状态检查"], ["Agent", "调用知识和 LLM 完成分析/规划", "不维护流程状态、不持有设备凭证"], ["Workflow", "固定流程、超时、状态转换", "不做安全语义推理"], ["Policy/Rule", "权限、审批、动作合法性", "不生成开放式方案"], ["Local Exec.", "调用设备 API、本地校验", "不理解自然语言方案"]];
  const apis = [["POST /incident/ingest", "数据服务", "创建/更新 Incident"], ["GET /knowledge/asset/{id}", "AI 服务", "资产/网络/业务上下文"], ["GET /knowledge/capabilities", "Planning", "目标可用能力"], ["POST /ai/analyze", "Workflow", "生成 AttackAssessment"], ["POST /ai/plan", "Workflow", "生成候选 DefensePlan"], ["POST /decision/validate", "Workflow", "规则与能力校验"], ["POST /approval/{plan}", "UI", "批准/拒绝/修改"], ["POST /task/dispatch", "Workflow", "生成并分发 DefenseTask"], ["POST /local/execute", "Execution Control", "本地域执行"], ["POST /effect/verify", "Workflow", "效果验证"]];
  const risks = [["Prompt Injection", "原始日志标记为不可信数据；外部内容不能改变系统指令或工具列表"], ["幻觉 Hallucination", "实体/能力/动作必须通过 Knowledge Service 与注册表校验"], ["工具滥用", "分析/规划 Agent 无真实执行工具；执行服务不使用 LLM"], ["越权跨域", "network_scope + 服务身份 + 本地二次校验"], ["知识污染", "外部情报标来源；进入推荐知识前人工审核"], ["凭证泄露", "设备凭证只存本地域 Vault，LLM 从不可见"], ["模型不可用", "降级为规则+固定 Playbook，只给保守建议"]];
  return <>
    <div className="grid g3 mb14">
      <div className="card">
        <h3>七个核心服务 <span className="sub">§3.1 · 仅两处调用大模型</span></h3>
        <table><tbody>
          <tr><th>服务</th><th>职责</th><th>LLM</th></tr>
          {svc.map(([a, b, c]) => (
            <tr key={a}><td className="mono" style={{ fontSize: "10.5px" }}>{a}</td><td className="muted" style={{ fontSize: "10.5px" }}>{b}</td><td style={{ fontSize: "11px" }}>{c === "✓" ? <b className="hl-purple">✓</b> : c}</td></tr>
          ))}
        </tbody></table>
      </div>
      <div className="card">
        <h3>技术职责边界 <span className="sub">§3.2 · 谁做什么、谁绝对不做什么</span></h3>
        <table><tbody>
          <tr><th>技术</th><th>负责</th><th>不负责</th></tr>
          {bound.map(([a, b, c]) => (
            <tr key={a}><td className="mono" style={{ fontSize: "10.5px" }}>{a}</td><td className="muted" style={{ fontSize: "10.5px" }}>{b}</td><td className="hl-red" style={{ fontSize: "10.5px" }}>{c}</td></tr>
          ))}
        </tbody></table>
      </div>
      <div className="card">
        <h3>服务接口 <span className="sub">§17.3 · 服务间 REST 契约</span></h3>
        <table><tbody>
          <tr><th>接口</th><th>调用方</th><th>说明</th></tr>
          {apis.map(([a, b, c]) => (
            <tr key={a}><td className="mono" style={{ fontSize: "9.5px" }}>{a}</td><td className="faint" style={{ fontSize: "10px" }}>{b}</td><td className="muted" style={{ fontSize: "10px" }}>{c}</td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
    <div className="grid g2">
      <div className="card">
        <h3>本体约束与业务规则 <span className="sub">R-01 ~ R-08 · 确定性控制不依赖大模型</span></h3>
        <table><tbody>
          <tr><th>规则</th><th>条件</th><th>结果</th><th>实现</th></tr>
          {DB.rules.map((r) => (
            <tr key={r.id}><td className="mono hl-amber">{r.id}</td><td className="muted" style={{ fontSize: "11px" }}>{r.cond}</td><td style={{ fontSize: "11px" }}>{r.result}</td><td className="faint" style={{ fontSize: "10.5px" }}>{r.impl}</td></tr>
          ))}
        </tbody></table>
      </div>
      <div className="card">
        <h3>AI 安全治理 <span className="sub">§16 风险控制矩阵</span></h3>
        <table><tbody>
          <tr><th>风险</th><th>控制措施</th></tr>
          {risks.map(([a, b]) => (
            <tr key={a}><td className="hl-red" style={{ fontSize: "11.5px" }}>{a}</td><td className="muted" style={{ fontSize: "11px" }}>{b}</td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
  </>;
}

/* ===== 标签页 5：故障演练与审计 ===== */
function GovOps() {
  const failRows = [
    ["LLM/AI 不可用", "切换人工研判+已审批Playbook，不扩大动作范围", <span key="1" className="badge b-cyan">AI故障不影响确定性控制</span>],
    ["知识服务不可用", "只读缓存展示；停止依赖未知事实的高影响新方案", <span key="2" className="badge b-cyan">没有事实依据不执行</span>],
    ["Policy/权限不可用", "高影响任务直接拒绝", <span key="3" className="badge b-red">Fail Closed</span>],
    ["跨域链路中断", "本地不接受新任务；已领取任务按签名计划完成或暂停", <span key="4" className="badge b-cyan">本地自治但不越权</span>],
    ["设备 Adapter 不可用", "Capability 标记 UNAVAILABLE，触发替代方案或人工处置", <span key="5" className="badge b-cyan">能力状态实时化</span>],
    ["审计写入异常", "本地缓冲；无法保证审计完整时暂停高影响动作", <span key="6" className="badge b-red">无审计不做高风险变更</span>],
  ];
  return <>
    <GovLockNote />
    <div className="grid g2 mb14">
      <div className="card">
        <h3>故障降级与 Fail Closed <span className="sub">即使模型犯错也无法绕过控制 · 演练需管理员权限</span></h3>
        <div className="flex mb14" style={{ gap: "10px", flexWrap: "wrap" }}>
          <button className={"btn " + (state.llmOnline ? "" : "danger")} onClick={() => toggleLLM()}>{state.llmOnline ? "◉ 模拟 LLM 故障" : "◉ 恢复 LLM 服务"}</button>
          <button className="btn" onClick={() => toggleDevice("EDR-B")}>{state.devicesOffline["EDR-B"] ? "恢复 EDR-B" : "模拟 EDR-B 离线"}</button>
          <button className="btn danger" onClick={() => resetAll()}>↺ 重置全部演示</button>
        </div>
        {state.devicesOffline["EDR-B"] ? <div className="degraded-banner">⚠ EDR-B Capability 已标记 UNAVAILABLE（R-08）：规划时过滤 isolate_endpoint，执行前重检将返回 STALE_STATE，禁止盲重试高影响动作。</div> : null}
        <table><tbody>
          <tr><th>故障场景</th><th>系统处理</th><th>安全原则</th></tr>
          {failRows.map(([a, b, c]) => (
            <tr key={a}><td>{a}</td><td className="muted" style={{ fontSize: "11px" }}>{b}</td><td>{c}</td></tr>
          ))}
        </tbody></table>
      </div>
    </div>
    <div className="card">
      <h3>审计链 <span className="sub">全链路可追溯 · 版本锁定可复盘 · 含 RBAC 拦截与配置变更记录</span></h3>
      <div className="console" style={{ maxHeight: "460px" }}>
        {DB.auditLog.map((l, i) => (
          <div key={i} className={"ln " + (l.lvl === "err" ? "err" : l.lvl === "warn" ? "warn" : l.lvl === "ok" ? "ok" : "info")}>
            <span className="t">{l.t}</span>  <b>{l.who}</b>  {l.act}
          </div>
        ))}
      </div>
    </div>
  </>;
}

const GOV_TABS = [
  { id: "cfg", label: "🧩 闭环流程配置" },
  { id: "llm", label: "🧠 大模型配置" },
  { id: "perm", label: "🔐 角色与权限" },
  { id: "arch", label: "🏛 架构与契约" },
  { id: "ops", label: "🧪 故障演练与审计" },
];

export default function Governance() {
  useApp();
  const tab = state.tabs.gov || "cfg";
  return <>
    <Tabs tabs={GOV_TABS} active={tab} onChange={(id) => setTab("gov", id)} />
    {tab === "cfg" ? <GovCfg /> : tab === "llm" ? <GovLlm /> : tab === "perm" ? <GovPerm /> : tab === "arch" ? <GovArch /> : <GovOps />}
  </>;
}
