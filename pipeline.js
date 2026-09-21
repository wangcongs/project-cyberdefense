/* =====================================================================
   闭环流程动作：研判 → 规划 → 审批 → 编排（DAG）→ 执行 → 验证 → 案例沉淀
   全部直接修改 RT 运行时后 notify()；控制台日志写入 RT / state，由 React 渲染
   ===================================================================== */
import { state, notify, S, SC, INC, RT, activeIncs, stageOf, roleOf } from "../core/store.js";
import { toast, addAudit, now } from "../core/utils.js";
import { needPerm, go, demoAdvance } from "./system.js";
import { DB } from "../core/data.js";

/* ===== 工具网关标准动作注册表（§13.1，任务编排词汇表同源） ===== */
export const GW_ACTIONS = [
  { id: "isolate_endpoint", tgt: "Endpoint", dev: "EDR / NAC", wl: "target_asset, scope, duration, approval_id" },
  { id: "restore_endpoint", tgt: "Endpoint", dev: "EDR / NAC", wl: "target_asset, scope, approval_id" },
  { id: "restrict_account", tgt: "Account", dev: "IAM / AD", wl: "account, action(warn/limit/lock), duration, approval_id" },
  { id: "restore_account", tgt: "Account", dev: "IAM / AD", wl: "account, approval_id" },
  { id: "apply_network_policy", tgt: "Flow / Zone", dev: "Firewall / NAC", wl: "policy_id, src, dst, effect, expire_at, approval_id" },
  { id: "remove_network_policy", tgt: "Policy", dev: "Firewall / NAC", wl: "policy_id, approval_id" },
  { id: "increase_monitoring", tgt: "Asset / Network", dev: "NDR / EDR / SIEM", wl: "scope, level, duration" },
  { id: "collect_evidence", tgt: "Endpoint / Session", dev: "EDR / 日志平台", wl: "target, evidence_type, hash_alg" },
];
export const GW_CHAIN = [
  ["t", "① Planning Agent 输出语义动作（不含任何厂商 CLI）"],
  ["t", "② Task Engine 签名下发 → Local Execution Service 校验通过（scope · 审批 · 本地策略 · 实时状态）"],
  ["t", "③ Tool Gateway 路由：语义动作 → 目标域 Vendor Adapter（按 Capability Registry 健康状态选择）"],
  ["ok", "④ Adapter 参数白名单校验 ✓ 类型校验 ✓（不在白名单的参数直接拒绝）"],
  ["ok", "⑤ 幂等键生成 op-20260918-0007 · 超时 10s · 可重试错误自动重试（最多2次）"],
  ["ok", "⑥ 调用厂商 API：POST /api/v1/endpoints/{id}/isolate（短时凭证，用后即毁）"],
  ["ok", "⑦ 错误码转换 0x0 → SUCCESS · operation_id=OP-1007 回传标准化结果"],
  ["ok", "⑧ 审计日志落盘：操作者 / 审批单 / 时间戳 / 请求参数 / 设备响应 · 不可篡改追加"],
];

export function tplCatalog() {
  const list = GW_ACTIONS.map((a) => ({ id: a.id, tgt: a.tgt, dev: a.dev }));
  list.push({ id: "verify_effect", tgt: "Incident", dev: "Effect Verification" });
  list.push({ id: "manual_step", tgt: "自定义", dev: "人工操作（由现场人员执行）" });
  return list;
}

/* ===== 智能研判 ===== */
export function runAnalysis() {
  if (!needPerm("assess")) return;
  if (!state.pipeCfg.analysis.aiOn) {
    toast("AI 研判已被系统配置停用（系统治理→流程配置②），请走人工研判流程", "err");
    addAudit("Decision Control", "AI 研判调用被配置策略拒绝（analysis.aiOn=false）", "warn");
    return;
  }
  if (!state.llmOnline) { toast("LLM 不可用，无法运行 AI 研判（Fail Closed 降级）", "err"); return; }
  const s = S();
  const a = SC().assessment, lc = state.llmCfg, ac = state.pipeCfg.analysis;
  const CONF_SCORE = { HIGH: 85, MEDIUM: 65, LOW: 40 };
  const score = CONF_SCORE[a.confidence] ?? 50, lowConf = score < ac.confThreshold;
  s.aRunning = true;
  s.aLines = [["t", `[${now().slice(11)}] Analysis Agent 启动 · incident=${state.activeInc} · operator=${roleOf().name}·${roleOf().user}`]];
  notify();
  const lines = [
    ["info", `[规则映射] 事件类型→ATT&CK 候选：${a.ruleMap}`],
    ["info", `[Knowledge] resolve_entity: ${a.resolve}`],
    ["info", "[Knowledge] get_asset_context: 网络域 / 重要度 / 管理产品 / 业务服务 已补全"],
    ["warn", `[Knowledge] get_mission_impact: ${a.impact}`],
    ["info", "[Knowledge] get_attack_context: 命中 ATT&CK 检测策略参考"],
    ["ai", `[LLM] 受控 Prompt 构建完成（${lc.model} · T=${lc.temp} · max_tokens=${lc.maxTokens} · timeout=${ac.timeout}s）：可信事实与不可信原始日志已隔离`],
    ["ai", "[LLM] 综合研判中… 生成攻击假设，关联证据引用"],
    ["ok", "[校验] 实体ID白名单校验通过；证据引用校验通过；无不存在的引用"],
    ["ok", `[输出] AttackAssessment 已生成：confidence=${a.confidence}`],
    ...(lowConf ? [["warn", `[阈值] 置信度评分 ${score} < 系统阈值 ${ac.confThreshold}（系统治理→流程配置②）→ 标记「强制人工复核」，不得直接进入高影响处置`]] : []),
  ];
  lines.forEach(([c, t], i) => setTimeout(() => {
    s.aLines.push([c, t]);
    notify();
    if (i === lines.length - 1) {
      s.assessDone = true; s.confLow = lowConf; s.aRunning = false;
      if (s.stage < 2) s.stage = 2;
      addAudit("Analysis Agent", `${state.activeInc} 生成 AttackAssessment（${a.techniques.map((t) => t.id).join(" / ")}，${a.confidence.split("（")[0]}）${lowConf ? ` · 置信度低于阈值 ${ac.confThreshold}，强制人工复核` : ""}`, "ok");
      toast(lowConf ? "AI 研判完成，但置信度低于系统阈值 → 需人工复核" : "AI 研判完成，已生成 AttackAssessment", lowConf ? "warn" : "ok");
      if (state.demo.on) demoAdvance();
      notify();
    }
  }, 350 + i * 600));
}

/* ===== 方案规划 ===== */
export function runPlanning() {
  if (!needPerm("plan")) return;
  if (!state.pipeCfg.planning.aiOn) {
    toast("AI 规划已被系统配置停用（系统治理→流程配置③），仅可使用已审批 Playbook 模板", "err");
    addAudit("Decision Control", "AI 规划调用被配置策略拒绝（planning.aiOn=false）", "warn");
    return;
  }
  if (!state.llmOnline) { toast("LLM 不可用，无法运行 AI 规划（Fail Closed 降级）", "err"); return; }
  const s = S();
  s.pRunning = true;
  notify();
  toast("Planning Agent 正在检索 D3FEND 候选与现场能力映射…");
  setTimeout(() => {
    s.plansDone = true; s.pRunning = false;
    if (s.stage < 3) s.stage = 3;
    const denied = SC().plans.filter((p) => p.rule === "DENY").map((p) => p.id).join("/");
    const mp = state.pipeCfg.planning.maxPlans, shown = SC().plans.slice(0, mp).map((p) => p.id).join("/");
    addAudit("Planning Agent", `${state.activeInc} 生成候选方案 ${shown}${SC().plans.length > mp ? `（候选上限 ${mp}，其余 ${SC().plans.length - mp} 个未纳入）` : ""}${denied ? `；${denied} 被硬规则过滤` : ""}`, "warn");
    toast(`已生成 ${Math.min(mp, SC().plans.length)} 个候选方案${denied ? `，${denied} 被硬规则过滤（DENY）` : ""}`, "warn");
    if (state.demo.on) demoAdvance();
    notify();
  }, 1800);
}

export function selectPlan(id) {
  if (!needPerm("plan")) return;
  const idx = SC().plans.findIndex((p) => p.id === id);
  if (idx >= state.pipeCfg.planning.maxPlans) {
    toast(`该方案超出本轮候选上限 ${state.pipeCfg.planning.maxPlans}（系统治理→流程配置③），不可选择`, "warn");
    return;
  }
  const s = S();
  s.planSelected = id; s.stage = 4;
  s.approval = { id: "APP-" + state.activeInc.slice(-6).replace("-", ""), plan: id, level: SC().approvalLevel, status: "WAITING", created: now(), window: s.restrictWindow };
  addAudit("Workflow", `${state.activeInc} ${id} 通过校验，进入 WAITING_APPROVAL`);
  toast(`已选择 ${id}，提交人工审批 → 请前往「审批中心」`, "ok");
  if (state.route === "planning") notify(); else go("approval");
  if (state.demo.on) demoAdvance();
}

/* ===== 人工审批（win=限制窗口小时数；dbl=双人审批复核勾选） ===== */
export function approvePlan(ok, win = 2, dbl = false) {
  const ap = S().approval; if (!ap) return;
  if (!needPerm("approve")) return;
  if (ok && state.pipeCfg.approval.mode === "double" && !dbl) {
    toast("双人审批模式（流程配置④）：需第二审批人勾选「已复核」后方可批准", "warn");
    return;
  }
  const s = S();
  if (!ok) {
    ap.status = "REJECTED";
    addAudit("Approval", `${roleOf().name}·${roleOf().user} 拒绝 ${ap.plan}，Workflow 回到 PLANNING`, "warn");
    toast("已拒绝，Workflow 回到 PLANNING 重新规划", "warn");
    s.stage = 2; s.planSelected = null; s.approval = null;
    notify(); return;
  }
  ap.status = "APPROVED"; ap.decidedAt = now(); ap.window = parseInt(win || 2);
  s.approved = true; s.restrictWindow = ap.window; s.stage = 5;
  addAudit("Approval", `${roleOf().name}·${roleOf().user} 批准 ${ap.plan}-v2（账户限制窗口 ${ap.window}h）${state.pipeCfg.approval.mode === "double" ? " · 双人审批已复核" : ""}，签发 approval_id=${ap.id}`, "ok");
  toast(`审批通过：${ap.id} · 已签发签名凭证`, "ok");
  if (state.pipeCfg.tasks.autoDispatch && !s.dispatched) {
    addAudit("Workflow", "审批后自动下发已启用（流程配置⑤）→ DefenseTask 自动签名分发", "info");
    dispatchTasks();
  }
  notify(); if (state.demo.on) demoAdvance();
}

/* ===== 任务编排（DAG） ===== */
export function dagValid() {
  const s = S(), errs = [];
  if (!s.tasks.length) errs.push("任务清单为空，无法编排");
  const ids = new Set(s.tasks.map((t) => t.id));
  s.tasks.forEach((t) => t.pre.forEach((p) => { if (!ids.has(p)) errs.push(`${t.id} 的前置依赖引用了不存在的任务 ${p}`); }));
  const color = {};
  const dfs = (id) => {
    if (color[id] === 1) { errs.push(`检测到依赖环（涉及 ${id}），任务将无法调度`); return; }
    if (color[id] === 2) return;
    color[id] = 1;
    const t = s.tasks.find((x) => x.id === id);
    if (t) t.pre.forEach(dfs);
    color[id] = 2;
  };
  s.tasks.forEach((t) => dfs(t.id));
  if (s.tasks.length && !s.tasks.some((t) => !t.pre.length)) errs.push("缺少起始任务（至少一个任务无前置依赖）");
  return { ok: errs.length === 0, errs };
}

export function dagLayout(tasks) {
  const memo = {}, stack = [];
  const depth = (t) => {
    if (memo[t.id] != null) return memo[t.id];
    if (stack.includes(t.id)) return 1; /* 环保护：布局不崩溃 */
    stack.push(t.id);
    const ps = t.pre.map((p) => tasks.find((x) => x.id === p)).filter(Boolean);
    const d = 1 + (ps.length ? Math.max(...ps.map(depth)) : 0);
    stack.pop(); memo[t.id] = d; return d;
  };
  const cols = {};
  tasks.forEach((t) => { const d = depth(t); cols[d] = cols[d] || []; cols[d].push(t); });
  const maxD = Math.max(1, ...Object.keys(cols).map(Number));
  const W = 170 + maxD * 205, H = Math.max(240, 90 + Math.max(...Object.values(cols).map((a) => a.length)) * 95);
  const P = {};
  Object.keys(cols).forEach((d) => {
    cols[d].forEach((t, i) => {
      const y = cols[d].length === 1 ? H / 2 : H / 2 + (i - (cols[d].length - 1) / 2) * 95;
      P[t.id] = [140 + (Number(d) - 1) * 205, y];
    });
  });
  return { P, W, H };
}

export function dagAddDep(srcId, dstId) {
  const s = S();
  if (s.dispatched) { toast("已签名分发，请先「撤回分发」再调整依赖", "warn"); return; }
  if (srcId === dstId) return;
  const dst = s.tasks.find((t) => t.id === dstId); if (!dst) return;
  if (dst.pre.includes(srcId)) { toast(`${dstId} 已依赖 ${srcId}，无需重复建立`, "warn"); return; }
  const depOf = (id, seen = new Set()) => {
    const t = s.tasks.find((x) => x.id === id); if (!t) return false;
    if (id === dstId) return true;
    if (seen.has(id)) return false; seen.add(id);
    return t.pre.some((p) => depOf(p, seen));
  };
  if (depOf(srcId)) { toast(`已阻止：将形成循环依赖（${srcId} 已直接/间接依赖 ${dstId}）`, "err"); return; }
  dst.pre.push(srcId);
  s.tasksVer++;
  addAudit("Task Engine", `${state.activeInc} 画布连线建立依赖：${dstId} 等待 ${srcId}，编排升版 v${s.tasksVer}`, "info");
  toast(`已建立依赖 ${srcId} → ${dstId}（${dstId} 在其完成后执行）· 编排 v${s.tasksVer}`, "ok");
  notify();
}

export function dagDelDep(srcId, dstId) {
  const s = S();
  if (s.dispatched) { toast("已签名分发，请先「撤回分发」再调整依赖", "warn"); return; }
  const dst = s.tasks.find((t) => t.id === dstId); if (!dst) return;
  if (!dst.pre.includes(srcId)) return;
  dst.pre = dst.pre.filter((p) => p !== srcId);
  s.tasksVer++;
  addAudit("Task Engine", `${state.activeInc} 删除依赖：${dstId} 不再等待 ${srcId}，编排升版 v${s.tasksVer}`, "warn");
  toast(`已删除依赖 ${srcId} → ${dstId} · 编排 v${s.tasksVer}`, "warn");
  notify();
}

/* 任务保存 / 新建：表单值由侧栏面板组件收集后传入（f={tpl,target,check,exec,net,expire,hitl,pre}） */
export function taskSave(id, f) {
  const s = S(); const t = s.tasks.find((x) => x.id === id); if (!t) return;
  if (s.dispatched) { toast("已签名分发，请先「撤回分发」再修改", "warn"); return; }
  let hitl = f.hitl;
  if (f.tpl === "manual_step" && hitl === "auto") hitl = "manual";
  Object.assign(t, {
    tpl: f.tpl, hitl,
    target: f.target.trim() || "—",
    check: f.check.trim() || "—",
    exec: f.exec, net: f.net,
    expire: Math.max(5, Math.min(240, parseInt(f.expire) || 30)),
    pre: [...f.pre],
  });
  s.tasksVer++;
  addAudit("Task Engine", `${state.activeInc} 人工修改任务 ${t.id}（${t.tpl} → ${t.target}${t.hitl !== "auto" ? ` · 人工介入=${t.hitl}` : ""}），编排升版 v${s.tasksVer}`, "info");
  toast(`任务 ${t.id} 已保存 · 编排 v${s.tasksVer}`, "ok");
  notify();
}

export function taskDel(id) {
  const s = S(); if (s.dispatched) { toast("已签名分发，不可删除", "warn"); return; }
  const t = s.tasks.find((x) => x.id === id); if (!t) return;
  s.tasks = s.tasks.filter((x) => x.id !== id);
  s.tasks.forEach((x) => (x.pre = x.pre.filter((p) => p !== id)));
  s.tasksVer++;
  addAudit("Task Engine", `${state.activeInc} 人工删除任务 ${id}（${t.tpl}），下游依赖已自动修复，编排 v${s.tasksVer}`, "warn");
  toast(`任务 ${id} 已删除，引用它的依赖已自动移除`, "warn");
  notify();
}

export function nextTaskId() {
  const s = S();
  return "T" + (Math.max(0, ...s.tasks.map((t) => parseInt(String(t.id).replace(/\D/g, "")) || 0)) + 1);
}

export function taskCreate(nid, f) {
  const s = S(); if (s.dispatched) return;
  let hitl = f.hitl;
  if (f.tpl === "manual_step" && hitl === "auto") hitl = "manual";
  s.tasks.push({
    id: nid, tpl: f.tpl, target: f.target.trim() || "—", check: f.check.trim() || "—",
    exec: f.exec, net: f.net, expire: Math.max(5, Math.min(240, parseInt(f.expire) || 30)),
    hitl, pre: [...f.pre], status: "PENDING", confirmed: false,
  });
  s.tasksVer++;
  addAudit("Task Engine", `${state.activeInc} 人工新增任务 ${nid}（${f.tpl} → ${f.target.trim() || "—"}${hitl !== "auto" ? ` · 人工介入=${hitl}` : ""}），编排 v${s.tasksVer}`, "info");
  toast(`任务 ${nid} 已加入编排 · v${s.tasksVer}`, "ok");
  notify();
}

export function resetTasks() {
  const s = S(); if (s.dispatched) { toast("已签名分发，请先「撤回分发」", "warn"); return; }
  s.tasks = SC().tasks.map((t) => ({ ...t, status: "PENDING", hitl: "auto", expire: 30, confirmed: false }));
  s.tasksVer = 1;
  addAudit("Task Engine", `${state.activeInc} 编排恢复为 Task Engine 初始生成版本 v1`, "info");
  toast("已恢复初始编排 v1", "ok");
  notify();
}

export function revokeDispatch() {
  const s = S();
  s.dispatched = false; s.execStarted = false; s.stage = 5;
  s.tasks.forEach((t) => { t.status = "PENDING"; t.confirmed = false; });
  s.execLog = [];
  addAudit("Execution Control", `${state.activeInc} 指挥员撤回分发，任务编排回到可编辑状态（全部任务重置为 PENDING）`, "warn");
  toast("已撤回分发 · 可继续人工编辑编排后重新分发", "warn");
  notify();
}

export function dispatchTasks() {
  if (!needPerm("dispatch")) return;
  const v = dagValid();
  if (!v.ok) { toast(`DAG 校验未通过（${v.errs.length} 项问题），无法分发`, "warn"); return; }
  const s = S();
  s.dispatched = true; s.stage = 6;
  const hitl = s.tasks.filter((t) => t.hitl !== "auto").length;
  addAudit("Execution Control", `${state.activeInc} 编排 v${s.tasksVer} 已签名分发（${[...new Set(s.tasks.map((t) => t.net))].join(" / ")} 子任务组${hitl ? ` · 含 ${hitl} 个人工介入点` : ""}）`, "ok");
  toast(`${s.tasks.length} 个 DefenseTask 已签名分发${hitl ? `，含 ${hitl} 个人工介入点，执行时将暂停等待确认` : ""}`, "ok");
  notify();
  if (state.demo.on) demoAdvance();
}

/* ===== 分域执行 ===== */
export function execLog(c, t) {
  S().execLog.push({ c, t });
  notify();
}

export function taskSatisfied(id) {
  const p = S().tasks.find((x) => x.id === id);
  return !!p && (p.status === "SUCCESS" || p.status === "SKIPPED");
}

export function execTick() {
  const s = S(); if (!s.execStarted) return;
  let hitlPause = false;
  s.tasks.filter((t) => t.status === "PENDING" && t.pre.every(taskSatisfied)).forEach((t) => {
    if (t.hitl === "manual") {
      t.status = "WAITING"; hitlPause = true;
      execLog("warn", `[${now().slice(11)}] ${t.id} ${t.tpl} → 人工操作步骤：已下发操作指令与检查标准，等待现场人员完成并在平台确认`);
    } else if (t.hitl === "confirm" && !t.confirmed) {
      t.status = "WAITING"; hitlPause = true;
      execLog("warn", `[${now().slice(11)}] ${t.id} ${t.tpl} 已就绪（前置完成），但编排设置了「执行前确认」→ 引擎暂停，等待指挥员确认`);
    } else startTask(t);
  });
  if (hitlPause && !s._hitlNoted) { s._hitlNoted = true; toast("执行已暂停：有人工介入任务等待决策", "warn"); }
  if (s.tasks.length && s.tasks.every((t) => t.status === "SUCCESS" || t.status === "SKIPPED")) {
    s.execStarted = false; s.stage = 7;
    addAudit("Execution Control", `${state.activeInc} 全部 DefenseTask 执行完成，进入效果验证`, "ok");
    toast("全部任务执行完成 → 请进行效果验证（API成功 ≠ 防御成功）", "ok");
    if (state.demo.on) demoAdvance();
  }
  notify();
}

function startTask(t) {
  const s = S();
  t.status = "RUNNING";
  execLog("t", `[${now().slice(11)}] ${t.id} ${t.tpl} → ${t.exec}（${t.net}）`);
  execLog("info", `  ① 验证中央签名/证书/task_id ✓  ② network_scope=${t.net} 与本地映射一致 ✓`);
  execLog("info", `  ③ approval_id 有效 · expire_at=${t.expire}min 未过期 ✓  ④ 本地 Policy 无冻结/维护窗口 ✓`);
  execLog("info", `  ⑤ 目标实时状态 & Capability 健康重检 ✓  ⑥ 从 Credential Vault 申请短时最小权限凭证 ✓`);
  const idx = s.tasks.indexOf(t);
  setTimeout(() => {
    t.status = "SUCCESS";
    execLog("ok", `  ⑦ Tool Gateway 调用 ${t.exec} Adapter 成功 · operation_id=OP-${1000 + idx} · 设备响应 success`);
    execLog("ok", `  ⑧ 临时凭证已销毁 · ExecutionResult 与审计信息已回传 ✓ [${t.check}]`);
    addAudit(`Local Execution ${t.net}`, `${state.activeInc} ${t.id} ${t.tpl} 执行成功（${t.exec}）`, "ok");
    execTick();
  }, 1700);
  notify();
}

export function taskConfirm(id) {
  const s = S(); const t = s.tasks.find((x) => x.id === id); if (!t || t.status !== "WAITING") return;
  t.confirmed = true; t.status = "PENDING";
  execLog("ok", `[${now().slice(11)}] ${t.id} 指挥员·王砺锋 现场确认继续执行 → 恢复自动流程`);
  addAudit("Human Confirm", `${state.activeInc} ${t.id} ${t.tpl} 指挥员确认继续执行（人工介入点）`, "ok");
  toast(`任务 ${id} 已确认，恢复执行`, "ok");
  execTick();
}

export function taskDone(id) {
  const s = S(); const t = s.tasks.find((x) => x.id === id); if (!t || t.status !== "WAITING") return;
  t.status = "SUCCESS";
  execLog("ok", `[${now().slice(11)}] ${t.id} ${t.tpl} → 现场人员确认人工操作完成，操作记录与证据已回传 [${t.check}]`);
  addAudit("Manual Step", `${state.activeInc} ${t.id} ${t.tpl} 人工操作完成（${t.target}）`, "ok");
  toast(`任务 ${id} 人工操作已确认完成`, "ok");
  execTick();
}

export function taskSkip(id) {
  const s = S(); const t = s.tasks.find((x) => x.id === id); if (!t || t.status === "SUCCESS") return;
  t.status = "SKIPPED";
  execLog("warn", `[${now().slice(11)}] ${t.id} ${t.tpl} 被人工跳过 · 下游依赖任务将把该前置视为已满足`);
  addAudit("Human Override", `${state.activeInc} ${t.id} ${t.tpl} 被人工跳过（人工介入决策）`, "warn");
  toast(`任务 ${id} 已跳过`, "warn");
  execTick();
}

export function runExecution() {
  if (!needPerm("execute")) return;
  const s = S(); s.execStarted = true; s._hitlNoted = false;
  execLog("t", `[${now().slice(11)}] Task Engine 调度器启动：编排 v${s.tasksVer} · ${s.tasks.length} 个任务按依赖拓扑调度（并行度 ≤${state.pipeCfg.tasks.maxParallel}）${s.tasks.some((t) => t.hitl !== "auto") ? " · 含人工介入点，将在对应节点暂停" : ""}`);
  execLog("info", `[配置] 失败重试 ≤${state.pipeCfg.execution.retry} 次（高影响动作禁止盲重试） · 本地二次校验：${state.pipeCfg.execution.localRecheck ? "启用" : "已停用"}`);
  if (!state.pipeCfg.execution.localRecheck) execLog("warn", "[配置警告] 本地二次校验已停用（系统治理→流程配置⑥）—— 违反 §3.2 职责边界，仅用于演示对比，生产环境禁止");
  execTick();
}

/* ===== 效果验证 / REPLAN / 案例沉淀 ===== */
export function runVerify() {
  if (!needPerm("verify")) return;
  const s = S(), sc = SC();
  s.verifyN = 0;
  notify();
  sc.effectChecks.forEach((c, i) => setTimeout(() => {
    s.verifyN = i + 1;
    if (i === sc.effectChecks.length - 1) {
      s.verified = true;
      addAudit("Effect Verification", `${state.activeInc} 独立证据复核全部通过（要求证据源 ≥${state.pipeCfg.effect.minEvidence} 类 · 自动回滚：${state.pipeCfg.effect.autoRollback ? "启用" : "关闭"}），Incident → CONTAINED`, "ok");
      toast("效果验证全部通过：Incident 已遏制（CONTAINED）", "ok");
      if (state.demo.on) demoAdvance();
    }
    notify();
  }, 600 + i * 700));
}

export function saveCase() {
  const s = S(), i = INC(), sc = SC();
  s.caseSaved = true; s.stage = 8;
  DB.cases.unshift({
    id: "CASE-2026-0" + (48 + activeIncs().filter((x) => stageOf(x.id) >= 8).length),
    title: i.title, date: "2026-09-18", techs: sc.assessment.techniques.map((t) => t.id),
    result: "CONTAINED", reuse: 0, tag: "待专家复盘",
    summary: sc.caseSummary + (s.tasksVer > 1 ? `（编排经人工调整，v${s.tasksVer}）` : ""),
    incId: i.id, auto: true,
    timeline: s.tasks.map((t) => [t.id, t.tpl + "（" + t.exec + "）→ " + t.check + (t.hitl !== "auto" ? " · 人工介入（" + (t.hitl === "confirm" ? "执行前确认" : "人工操作") + "）" : "")]),
    lesson: "",
  });
  addAudit("Case Library", `${i.id} 案例已沉淀（编排 v${s.tasksVer}），待专家复盘确认`, "ok");
  toast("案例已沉淀至案例库 · 待专家复盘确认", "ok");
  notify();
  if (state.demo.on) demoAdvance();
}

/* ===== 工具网关转换链演示（日志写入 state.uiLogs.gw） ===== */
export function gwDemo() {
  const edrOff = state.devicesOffline["EDR-B"];
  const chain = edrOff ? [
    ["t", "① Planning Agent 输出语义动作 isolate_endpoint(target=RND-WS-23)"],
    ["t", "② Task Engine 签名下发 → Local Execution Service 校验通过"],
    ["err", "③ Tool Gateway 路由 → EDR-B Vendor Adapter 健康检查失败（UNAVAILABLE）"],
    ["err", "④ Capability LAN-B.EndpointIsolation 标记 UNAVAILABLE → 不调用厂商 API"],
    ["t", "⑤ 结果回传 Workflow：执行失败 · 触发替代方案或人工处置（R-08 Fail Closed，不静默跳过）"],
    ["ok", "⑥ 审计日志落盘：失败原因 / 时间戳 / 任务ID · 供效果验证与重新规划使用"],
  ] : GW_CHAIN;
  const L = (state.uiLogs.gw = []);
  notify();
  chain.forEach((l, i) => {
    setTimeout(() => { L.push({ c: l[0], t: l[1] }); notify(); }, i * 420);
  });
}

/* ===== REPLAN 演练（不改变闭环状态） ===== */
export function demoReplan() {
  const lines = [
    ["warn", "[Effect Verification] PostCheck 失败：T2 apply_network_policy 设备返回 success，但 NDR 独立证据显示 10.10.20.23 → 10.10.20.40 RDP 会话仍存在"],
    ["err", "[EffectReport] status=NOT_ACHIEVED · replan_required=true"],
    ["t", "[Workflow] 状态转换 VERIFYING → REPLAN → PLANNING（仅工作流引擎可改变主状态）"],
    ["info", "[上下文注入] Planning Agent 收到：失败任务 T2 / 设备响应 / 验证证据 / R-06 禁止重复提交失败方案"],
    ["ai", "[Planning Agent] 检索替代能力：D3-NTF TrafficFilter → FW-B apply_network_policy(flow_scope) 语义不变，改用 NAC-B restrict_network_access 双通道阻断"],
    ["ok", "[输出] 替代方案 PLAN-D 生成：NAC 准入降级 + 会话终止，避开 FW 策略下发失败路径 → 重新进入硬规则校验与人工审批"],
    ["ok", "[审计] REPLAN 决策链已落盘，原 PLAN-B-v2 保留版本链可追溯"],
  ];
  const L = (state.uiLogs.replan = []);
  notify();
  lines.forEach((l, i) => setTimeout(() => {
    L.push({ c: l[0], t: l[1] });
    notify();
    if (i === lines.length - 1) {
      addAudit("Workflow", `${state.activeInc} REPLAN 演练：效果验证未通过 → 回到 PLANNING 生成替代方案`, "warn");
      toast("REPLAN 演练完成（演示，不改变当前闭环状态）", "warn");
    }
  }, i * 550));
}
