/* =====================================================================
   状态仓库：单一 state 对象 + 事件订阅（React 侧用 useSyncExternalStore 消费）
   业务动作直接修改 state / RT 后调用 notify() 触发界面更新。
   ===================================================================== */
import { useSyncExternalStore } from "react";
import { SCEN, DB } from "./data.js";

/* ===== 闭环阶段 ===== */
export const STAGES = ["事件成案","AI研判","方案规划","规则校验","人工审批","任务编排","分域执行","效果验证","案例沉淀"];

/* ===== 全局运行状态（多事件并行处置） ===== */
export const state = {
  route: "dashboard", llmOnline: true, activeInc: "INC-20260918-01",
  demo: { on: false, step: -1, text: "" }, devicesOffline: {},
  eventFilter: "ALL",
  graphSyncLog: [],
  kgFocus: null, kgHops: 1, kgLabels: false, ontoFocus: null, ontoLabels: false,
  tabs: { topo: "viz", onto: "viz", kg: "viz", gov: "cfg" },
  topoLinks: [], topoLinkPick: null, ontoPick: null,
  wiz: null, kgWiz: null, kgCustom: { nodes: [], edges: [] },
  role: "commander",
  /* 闭环流程配置（系统治理·流程配置；每项在各阶段页面真实生效） */
  pipeCfg: {
    events: { autoCase: true, corrWindow: 15, minAlerts: 3 },
    analysis: { aiOn: true, confThreshold: 60, timeout: 60 },
    planning: { aiOn: true, maxPlans: 4 },
    approval: { mode: "manual" },
    tasks: { autoDispatch: false, maxParallel: 3 },
    execution: { localRecheck: true, retry: 1 },
    effect: { minEvidence: 3, autoRollback: false },
  },
  llmCfg: { model: "qwen25-72b", temp: 0.2, maxTokens: 4096, timeout: 30, degrade: "playbook" },
  /* UI 浮层（由 React 渲染） */
  toasts: [],          // {id, msg, type}
  panel: null,         // JSX 元素（侧栏面板内容）
  _toastSeq: 0,
  /* 各页面控制台日志（动作层异步写入，React 渲染） */
  uiLogs: { gw: [], replan: [], onto: [], er: [], cq: [] },
};

/* ===== 登录角色与权限矩阵（RBAC） ===== */
export const ROLES = {
  commander: { name: "指挥员", user: "王砺锋", ico: "🎖", color: "#fbbf24", desc: "闭环最终决策权：审批/拒绝方案、任务分发与执行令下达",
    perms: ["assess","plan","approve","dispatch","execute","verify","drill"] },
  analyst: { name: "安全分析员", user: "陈曦", ico: "🔍", color: "#22d3ee", desc: "研判与规划操作：运行 AI 研判、生成/选择候选方案、参与验证",
    perms: ["assess","plan","verify"] },
  admin: { name: "系统管理员", user: "赵坤", ico: "🛠", color: "#a78bfa", desc: "系统治理：流程/大模型/权限配置、故障演练、环境重置（不参与处置决策）",
    perms: ["govcfg","reset","drill"] },
  auditor: { name: "审计员", user: "周敏", ico: "📋", color: "#94a3b8", desc: "只读审计：全链路日志与配置可见，不可执行任何变更操作",
    perms: [] },
};
export const PERM_NAMES = { assess: "运行 AI 研判", plan: "方案规划/选择", approve: "审批方案", dispatch: "任务分发", execute: "启动执行", verify: "效果验证", govcfg: "修改系统配置", reset: "重置演示环境", drill: "故障演练" };

/* ===== 订阅 / 通知 ===== */
const listeners = new Set();
let version = 0;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getSnapshot() { return version; }
export function notify() { version++; listeners.forEach((f) => f()); }

/** 页面/组件订阅入口：调用后组件随每次 notify() 重渲染 */
export function useApp() {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/* ===== 每个可交互事件的运行时 ===== */
export const RT = {};
export function initRT(id) {
  const sc = SCEN[id];
  RT[id] = { stage: 0, assessDone: false, plansDone: false, planSelected: null, approved: false,
    dispatched: false, execStarted: false, verified: false, caseSaved: false, confLow: false,
    restrictWindow: 2, approval: null, execLog: [],
    tasks: sc.tasks.map((t) => ({ ...t, status: "PENDING", hitl: "auto", expire: 30 })), tasksVer: 1 };
}
Object.keys(SCEN).forEach(initRT);

/* ===== 导航 / 页面标题 ===== */
export const NAV = [
  { sec: "指挥态势" },
  { id: "dashboard", name: "态势总览", ico: "◈" },
  { id: "topology", name: "网络拓扑", ico: "⬡" },
  { id: "events", name: "事件中心", ico: "⚠", badge: () => activeIncs().filter((i) => stageOf(i.id) < 8).length || null },
  { sec: "AI 决策链" },
  { id: "analysis", name: "智能研判", ico: "◎" },
  { id: "planning", name: "方案规划", ico: "❖" },
  { id: "approval", name: "审批中心", ico: "✓", badge: () => { const n = activeIncs().filter((i) => RT[i.id].planSelected && !RT[i.id].approved).length; return n || null; } },
  { sec: "受控执行" },
  { id: "tasks", name: "任务编排", ico: "⛓" },
  { id: "execution", name: "执行监控", ico: "▶" },
  { id: "gateway", name: "工具网关", ico: "⇄" },
  { id: "effect", name: "效果验证", ico: "☑" },
  { sec: "知识与建模" },
  { id: "ontology", name: "本体建模", ico: "◇" },
  { id: "kg", name: "知识图谱", ico: "✦" },
  { id: "graphbuild", name: "图谱构建", ico: "⧉" },
  { id: "kb", name: "知识库", ico: "▤" },
  { id: "cases", name: "案例库", ico: "❏" },
  { sec: "治理" },
  { id: "governance", name: "系统治理", ico: "⚙" },
];

export const TITLES = {
  dashboard: ["态势总览", "多局域网安全态势与业务闭环一览"],
  topology: ["网络拓扑", "虚拟多局域网实验环境 · 网络域 / 资产 / 安全设备"],
  events: ["事件中心", "SecurityEvent 接入关联 · Incident 事件档案与处置入口"],
  analysis: ["智能研判", "Analysis Agent · 攻击认知与 AttackAssessment"],
  planning: ["方案规划", "Planning Agent · 候选防御方案生成与评分"],
  approval: ["审批中心", "人工审批 · 高影响动作分级控制"],
  tasks: ["任务编排", "Task Engine · DefenseTask DAG"],
  execution: ["执行监控", "Local Execution Service · 分域受控执行"],
  gateway: ["工具网关", "Tool Gateway · 语义动作 → Vendor Adapter → 设备 API"],
  effect: ["效果验证", "Effect Verification · 独立证据复核"],
  ontology: ["本体建模", "CyberDefenseOntology 1.0 · 六大类核心 Schema：现实网络 / 安全事件 / 攻击知识 / 防御知识 / 业务影响 / 执行控制"],
  kg: ["知识图谱", "本体实例化 · 四层数据模型（§20.1）：L1标准知识 / L2现场基础 / L3动态态势 / L4决策执行"],
  graphbuild: ["图谱构建", "数据入图 · 多源同步 / 实体解析 / 映射与一致性"],
  kb: ["知识库", "ATT&CK v19.2 / D3FEND v1.6.0 离线知识"],
  cases: ["案例库", "历史案例沉淀与相似案例检索"],
  governance: ["系统治理", "策略规则 · 能力注册 · 审计 · 故障降级"],
};

/* ===== 场景访问器 ===== */
export function S() { return RT[state.activeInc]; }
export function SC() { return SCEN[state.activeInc]; }
export function INC() { return DB.incidents.find((i) => i.id === state.activeInc); }
export function rtOf(id) { return RT[id] || { stage: DB.incidents.find((i) => i.id === id)?.stage ?? 8, caseSaved: true }; }
export function stageOf(id) { return rtOf(id).stage; }
export function activeIncs() { return DB.incidents.filter((i) => i.scenario); }
export function incEventCount(id) { return DB.events.filter((e) => e.incident === id).length; }
export function roleOf() { return ROLES[state.role]; }
export function hasPerm(p) { return roleOf().perms.includes(p); }
