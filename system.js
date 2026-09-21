/* =====================================================================
   系统动作：导航 / RBAC / 治理配置 / 故障演练 / 一键演示 / 环境重置
   ===================================================================== */
import { state, notify, ROLES, PERM_NAMES, roleOf, hasPerm, RT, initRT, activeIncs, S } from "../core/store.js";
import { toast, addAudit, closePanel } from "../core/utils.js";
import { DB, GRAPH, SCEN } from "../core/data.js";
import { runAnalysis, runPlanning, selectPlan, approvePlan, dispatchTasks, runExecution, runVerify, saveCase } from "./pipeline.js";

/* ===== 导航 ===== */
export function go(route) {
  closePanel();
  if (location.hash !== "#" + route) {
    location.hash = "#" + route;               /* App 监听 hashchange 完成跳转 */
  } else {
    state.route = route;
    notify();
  }
}
export function switchInc(id) {
  state.activeInc = id;
  addAudit("指挥员", `切换处置上下文 → ${id}`);
  notify();
  toast(`已切换到 ${id} 的处置上下文`);
}
export function setTab(k, v) { state.tabs[k] = v; notify(); }

/* ===== RBAC ===== */
export { ROLES, PERM_NAMES, roleOf, hasPerm } from "../core/store.js";
export function needPerm(p) {
  if (hasPerm(p)) return true;
  toast(`⛔ 当前角色「${roleOf().name} · ${roleOf().user}」无「${PERM_NAMES[p]}」权限`, "err");
  addAudit("权限管控", `越权拦截：${roleOf().name}·${roleOf().user} 尝试「${PERM_NAMES[p]}」被 RBAC 拒绝`, "warn");
  return false;
}
export function setRole(r) {
  if (!ROLES[r]) return;
  state.role = r;
  addAudit("权限管控", `登录角色切换 → ${ROLES[r].name}·${ROLES[r].user}（${ROLES[r].perms.length ? ROLES[r].perms.map((p) => PERM_NAMES[p]).join("/") : "只读"}）`, "info");
  toast(`${ROLES[r].ico} 已切换角色：${ROLES[r].name} · ${ROLES[r].user}`, "ok");
  notify();
}

/* ===== 系统配置读写（仅系统管理员可写，全部留痕） ===== */
export function govGet(path) { let o = state; for (const k of path.split(".")) o = o[k]; return o; }
export function govSet(path, val) {
  if (!needPerm("govcfg")) { notify(); return; }
  const ks = path.split(".");
  let o = state;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  const old = o[ks[ks.length - 1]];
  if (old === val) { notify(); return; }
  o[ks[ks.length - 1]] = val;
  addAudit("系统配置", `${roleOf().name}·${roleOf().user} 调整 ${path}：${old} → ${val}`, "ok");
  toast(`⚙ 配置已生效：${path} = ${val}`, "ok");
  notify();
}

/* ===== 故障演练 ===== */
export function toggleLLM() {
  if (!needPerm("drill")) return;
  state.llmOnline = !state.llmOnline;
  addAudit("AI Decision Service", state.llmOnline ? "LLM 服务恢复，退出降级模式" : "LLM 不可用，进入降级模式（人工研判+Playbook）", state.llmOnline ? "ok" : "err");
  toast(state.llmOnline ? "LLM 已恢复在线" : "已进入降级模式：AI 研判/规划停用，高影响动作仍受控", "warn");
  notify();
}
export function toggleDevice(id) {
  if (!needPerm("drill")) return;
  state.devicesOffline[id] = !state.devicesOffline[id];
  addAudit("Capability Registry", `${id} health → ${state.devicesOffline[id] ? "UNAVAILABLE（R-08 生效）" : "AVAILABLE"}`, state.devicesOffline[id] ? "warn" : "ok");
  toast(state.devicesOffline[id] ? `${id} 已离线：相关能力被过滤，高影响动作 Fail Closed` : `${id} 已恢复`, "warn");
  notify();
}
export function resetAll() {
  if (!needPerm("reset")) return;
  Object.keys(SCEN).forEach(initRT);
  state.activeInc = "INC-20260918-01";
  state.graphSyncLog = [];
  GRAPH.sources.forEach((s) => (s.status = "idle"));
  DB.cases = DB.cases.filter((c) => !c.auto);
  addAudit("System", "演示环境已重置（全部事件回到成案阶段）");
  toast("演示已重置，可重新开始闭环演示", "ok");
  go("dashboard");
}

/* ===== 一键演示模式（INC-20260918-01） ===== */
export const DEMO_SCRIPT = [
  { page: "dashboard", text: "<b>第 0 步 · 态势总览</b>：系统接入 EDR/NDR/IAM/CMDB 等多源数据。当前有多个攻击事件并行，下面跟随 INC-20260918-01（LAN-B 域账户异常+RDP横向）走完完整防御闭环。" },
  { page: "events", text: "<b>第 1 步 · 事件成案</b>：3 条告警（终端异常 + 异常RDP + 异常登录）经「规则关联+时间窗口+资产/账户关系」合并为 Incident。注意：成案是确定性规则，不用大模型。" },
  { page: "analysis", text: "<b>第 2 步 · AI 研判</b>：Analysis Agent 调用知识图谱补全上下文，LLM 输出 AttackAssessment：映射 T1078.002 / T1021.001，置信度 HIGH。即将自动运行…", action: () => { if (!S().assessDone) runAnalysis(); else demoAdvance(); } },
  { page: "planning", text: "<b>第 3 步 · 方案规划</b>：Planning Agent 结合 D3FEND 候选与现场能力生成 4 个方案；隔离关键服务器的 PLAN-C 被硬规则 R-04 直接拒绝。", action: () => { if (!S().plansDone) runPlanning(); else demoAdvance(); } },
  { page: "planning", text: "<b>第 4 步 · 硬规则过滤 + 评分</b>：系统按安全效果/业务影响/可执行性/证据可信度 4 维排序，推荐 PLAN-B（证据保全优先），但最终决定权在指挥员。", action: () => { if (!S().planSelected) selectPlan("PLAN-B"); else demoAdvance(); } },
  { page: "approval", text: "<b>第 5 步 · 人工审批</b>：审批界面完整展示研判、影响资产、候选差异、执行设备、规则校验与回滚方式。指挥员将账户限制窗口调整为 2 小时后批准。", action: () => { const ap = S().approval; if (ap && ap.status === "WAITING") approvePlan(true); else demoAdvance(); } },
  { page: "tasks", text: "<b>第 6 步 · 任务编排</b>：Task Engine 把批准的方案转换为 6 个 DefenseTask（DAG）：取证→终止会话→限制账户∥隔离终端→流量控制→验证。", action: () => { if (!S().dispatched) dispatchTasks(); else demoAdvance(); } },
  { page: "execution", text: "<b>第 7 步 · 分域执行</b>：LAN-B / INFRA 的 Local Execution Service 各自完成 8 步校验（验签→scope→审批→策略→状态→短时凭证→调用→回传），本地不使用 LLM。", action: () => { if (!S().tasks.every((t) => t.status === "SUCCESS")) runExecution(); else demoAdvance(); } },
  { page: "effect", text: "<b>第 8 步 · 效果验证</b>：API 成功 ≠ 防御成功。Effect Verification 用 EDR/NDR/IAM/服务健康等独立证据复核。", action: () => { if (!S().verified) runVerify(); else demoAdvance(); } },
  { page: "cases", text: "<b>第 9 步 · 案例沉淀</b>：保存最终方案、人工修改与实际效果，专家复盘后标记「可推荐」，供下次相似事件检索参考。", action: () => { if (!S().caseSaved) saveCase(); else demoAdvance(); } },
  { page: "dashboard", text: "<b>闭环完成 ✓</b>：从告警到遏制全程可审计、可复盘；其余三个攻击事件可在「事件中心」选择后走同样闭环。可在「系统治理」重置后再次演示。" },
];

export function demoNext() {
  const d = state.demo;
  d.step++;
  if (d.step >= DEMO_SCRIPT.length) { stopDemo(); toast("闭环演示完成 ✓", "ok"); return; }
  d.on = true;
  const item = DEMO_SCRIPT[d.step];
  d.text = `${d.step + 1}/${DEMO_SCRIPT.length} · ${item.text}`;
  if (state.route !== item.page) go(item.page); else notify();
  if (item.action) setTimeout(item.action, d.step === 0 ? 600 : 1400);
}
export function demoAdvance() { if (!state.demo.on) return; setTimeout(() => demoNext(), 1400); }
export function stopDemo() { state.demo.on = false; state.demo.step = -1; state.demo.text = ""; notify(); }
export function startDemo() {
  state.activeInc = "INC-20260918-01";
  const rt = RT[state.activeInc];
  if (rt.stage > 0 && !rt.caseSaved) { toast("检测到该事件演示已进行，将从当前进度继续（如需从头演示请先在「系统治理」重置）", "warn"); }
  state.demo.on = true; state.demo.step = -1;
  demoNext();
}
