/* =====================================================================
   知识与建模动作：本体建模（CQ/向导/评审）、知识图谱（实例构建/属性/关系）、
   图谱构建（同步/实体解析）、知识库维护、案例库复盘
   ===================================================================== */
import { state, notify, S, SC, INC, stageOf } from "../core/store.js";
import { toast, addAudit, now, closePanel, sidePanel } from "../core/utils.js";
import { DB, ONTO, ONTO_CQS, ONTO_ALIGN, GRAPH } from "../core/data.js";
import { go } from "./system.js";
import {
  showCQPanel, kgInfoPanel, kgNodePanel, showCasePanel, showAtkPanel, showD3fPanel, showOntoRelForm,
} from "../ui/panels.jsx";
import { resetOntoLayout } from "../viz/OntoSVG.jsx";

/* ============================ 本体建模 ============================ */

export function cst(o) { return o.st || "published"; }

export function cqFocus(id) {
  const q = ONTO_CQS.find((x) => x.id === id); if (!q) return;
  closePanel();
  state.tabs.onto = "viz";
  state.ontoFocus = q.classes[0];
  addAudit("本体建模", `按 ${q.id} 定位依赖类 ${q.classes[0]}`);
  notify();
}

export function showCQ(id) {
  const q = ONTO_CQS.find((x) => x.id === id);
  if (q) sidePanel(showCQPanel(q));
}

export function cqTestAll() {
  const lines = [["t", "[CQ 回放] 开始能力问题回放测试 · CyberDefenseOntology 1.0 · Knowledge Service 固定 API"]];
  ONTO_CQS.forEach((q) => lines.push([q.status === "ok" ? "ok" : q.status === "partial" ? "warn" : "err",
    `[${q.id}] ${q.q.slice(0, 30)}${q.q.length > 30 ? "…" : ""} → ${q.status === "ok" ? "✓ 通过（" + q.test + "）" : q.status === "partial" ? "⚠ 部分通过 · " + q.note : "✗ 不可回答 · " + q.note}`]));
  const ok = ONTO_CQS.filter((q) => q.status === "ok").length;
  lines.push(["ok", `[结果] ${ok}/${ONTO_CQS.length} 可回答 · 覆盖率 ${Math.round(ok / ONTO_CQS.length * 100)}% · 缺口项已登记为二期建模任务`]);
  const L = (state.uiLogs.onto = []);
  state.tabs.onto = "method";
  notify();
  lines.forEach(([c, t], i) => setTimeout(() => { L.push({ c, t }); notify(); }, i * 380));
}

export function addCQ(f) {
  const q = (f.q || "").trim();
  if (q.length < 8) { toast("请用完整的业务问题描述（≥8 字）", "err"); return; }
  const clsStr = (f.cls || "").trim();
  const classes = clsStr ? clsStr.split(/[,，、\s]+/).map((s) => s.trim()).filter((s) => ONTO.classes.some((c) => c.name === s)) : ["（待定）"];
  const nid = "CQ-" + String(ONTO_CQS.length + 1).padStart(2, "0");
  ONTO_CQS.push({ id: nid, rank: "P2", q, classes, rels: [], test: "—（待设计测试查询）", status: "gap", note: "新建能力问题：需补充所需类/属性与测试查询后评审" });
  addAudit("本体建模", `新增能力问题 ${nid}：${q.slice(0, 24)}…（待评审）`, "info");
  toast(`能力问题 ${nid} 已登记，默认 P2 · 缺口态，评审后排期`, "ok");
  notify();
}

/* —— 本体构建向导（草稿 → 评审中 → 已发布） —— */
export const WIZ_STEPS = ["① 基本信息", "② 类层次", "③ 关联能力问题", "④ 外部对齐", "⑤ 提交评审"];

export function wizOpen() {
  state.wiz = { step: 0, d: { name: "", cn: "", props: "", inst: "", parent: "", cqs: [], ext: "—（无对应标准词汇）", how: "扩展", why: "", note: "" } };
  notify();
}

export function wizValid() {
  const w = state.wiz, d = w.d;
  if (w.step === 0) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(d.name)) { toast("请输入合法的类名（PascalCase 英文）", "err"); return false; }
    if (ONTO.classes.some((c) => c.name === d.name)) { toast("类已存在", "err"); return false; }
    if (!d.cn) { toast("请填写中文含义", "err"); return false; }
  }
  if (w.step === 2 && !d.cqs.length && !d.note) { toast("请至少关联 1 个能力问题，或在补充说明中描述业务场景", "err"); return false; }
  return true;
}

export function wizNext() { if (!wizValid()) return; state.wiz.step++; notify(); }
export function wizBack() { state.wiz.step = Math.max(0, state.wiz.step - 1); notify(); }

export function wizSubmit() {
  const d = state.wiz.d;
  ONTO.classes.push({ name: d.name, cn: d.cn, props: d.props || "自定义属性", inst: d.inst || "（待实例化）", on: false, core: false, st: "review", ...(d.parent ? { parent: d.parent } : {}) });
  if (d.ext && !d.ext.startsWith("—")) ONTO_ALIGN.push({ cls: d.name, ext: d.ext, how: d.how, why: d.why || "（待补充对齐理由）" });
  else if (d.how === "新建") ONTO_ALIGN.push({ cls: d.name, ext: "—（无对应标准词汇）", how: "新建", why: d.why || "业务特有概念" });
  d.cqs.forEach((id) => { const q = ONTO_CQS.find((x) => x.id === id); if (q && !q.classes.includes(d.name)) q.classes.push(d.name); });
  state.wiz = null;
  addAudit("本体建模", `构建向导提交新类 ${d.name}（${d.cn}，父类 ${d.parent || "顶层"}，回溯 ${d.cqs.join("/") || "无 CQ"}）→ 评审中`, "info");
  toast(`类 ${d.name} 已提交评审：在「核心类管理」评审队列中等待安全专家处理`, "ok");
  closePanel(); notify();
}

/* —— 评审队列 —— */
export function ontoSubmitReview(kind, idx) {
  const o = kind === "cls" ? ONTO.classes[idx] : ONTO.relations[idx];
  o.st = "review";
  addAudit("本体建模", `提交评审：${o.name}`);
  toast(`${o.name} 已提交评审`, "ok"); notify();
}

export function ontoApprove(kind, idx) {
  const o = kind === "cls" ? ONTO.classes[idx] : ONTO.relations[idx];
  o.st = "published"; o.on = true;
  addAudit("本体建模", `安全专家·李清源 评审通过并发布 ${o.name}`, "ok");
  toast(`${o.name} 已发布，进入正式 Schema 并可实例化`, "ok"); notify();
}

export function ontoReject(kind, idx) {
  const o = kind === "cls" ? ONTO.classes[idx] : ONTO.relations[idx];
  o.st = "draft"; o.on = false;
  addAudit("本体建模", `安全专家·李清源 打回 ${o.name} 至草稿（需补充 CQ 回溯/对齐说明）`, "warn");
  toast(`${o.name} 已打回草稿`, "warn"); notify();
}

export function toggleCls(i) { ONTO.classes[i].on = !ONTO.classes[i].on; addAudit("本体建模", `类 ${ONTO.classes[i].name} → ${ONTO.classes[i].on ? "启用" : "停用"}`); notify(); }
export function delCls(i) { const c = ONTO.classes[i]; ONTO.classes.splice(i, 1); addAudit("本体建模", `删除类 ${c.name}`, "warn"); toast(`已删除类 ${c.name}`, "warn"); notify(); }

export function addClass(f) {
  const name = (f.name || "").trim(), cn = (f.cn || "").trim() || "—";
  const parent = f.parent || "";
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) { toast("请输入合法的类名（PascalCase 英文）", "err"); return; }
  if (ONTO.classes.some((c) => c.name === name)) { toast("类已存在", "err"); return; }
  ONTO.classes.push({ name, cn, props: "自定义属性", inst: "（待实例化）", on: false, core: false, st: "review", ...(parent ? { parent } : {}) });
  addAudit("本体建模", `快速新增类 ${name}（${cn}${parent ? `，父类 ${parent}` : ""}）→ 评审中`, "ok");
  toast(`类 ${name} 已提交评审队列（发布前不实例化）`, "ok"); notify();
}

export function toggleRel(i) { ONTO.relations[i].on = !ONTO.relations[i].on; addAudit("本体建模", `关系 ${ONTO.relations[i].name} → ${ONTO.relations[i].on ? "启用" : "停用"}`); notify(); }

export function addRel(f) {
  const name = (f.name || "").trim(), from = f.from, to = f.to;
  if (!/^[a-z][A-Za-z0-9]*$/.test(name)) { toast("请输入合法的关系名（小驼峰英文）", "err"); return; }
  ONTO.relations.push({ name, from, to, use: "自定义关系（业务确认中）", on: false, core: false, st: "review", feat: "—" });
  addAudit("本体建模", `新增关系 ${name}: ${from} → ${to} → 评审中`, "ok");
  toast(`关系 ${name} 已提交评审队列`, "ok"); notify();
}

export function runOntoCheck() {
  const cls = ONTO.classes.filter((c) => c.on), rel = ONTO.relations.filter((r) => r.on);
  const cqOk = ONTO_CQS.filter((q) => q.status === "ok").length;
  const lines = [
    ["t", "[推理机] HermiT 风格一致性检查 + CQ 回放 · CyberDefenseOntology 1.0"],
    ["info", `[Schema] 类 ${cls.length}（含 subClassOf 层次 ${cls.filter((c) => c.parent).length} 条）/ 对象属性 ${rel.length} / 外部命名空间 attack: d3f: 版本已锁定`],
    ["info", "[检查] 类可满足性：未发现不可满足类（Unsatisfiable = 0）… 通过"],
    ["info", "[检查] 不相交约束：事件 ⊓ 网络基础设施 = ∅、行为主体 ⊓ 业务对象 = ∅ … 通过"],
    ["info", "[检查] domain/range 与类层次匹配（子类继承父类约束）… 通过"],
    ["info", "[检查] functional belongsTo：每资产唯一网络域（RND-WS-23 → LAN-B）… 通过"],
    ["info", "[检查] dependsOn 无环（DAG）：任务依赖图拓扑排序可行 … 通过"],
    ["warn", "[提示] 自定义新增类未实例化：保留 Schema，评审通过前不进入图数据库"],
    ["ok", `[CQ 回放] ${cqOk}/${ONTO_CQS.length} 能力问题可回答（CQ-09 / CQ-12 部分、CQ-11 缺口 → 二期）`],
    ["ok", "[结果] 本体可满足、无违例，Schema 可用于实例化；CQ 覆盖率 75%"],
  ];
  const L = (state.uiLogs.onto = []);
  state.tabs.onto = "method";
  notify();
  lines.forEach(([c, t], i) => setTimeout(() => { L.push({ c, t }); notify(); }, i * 450));
}

export function exportTurtle() {
  const cls = ONTO.classes.filter((c) => c.on);
  const sample = cls.slice(0, 3).map((c) => `cd:${c.name} a owl:Class ; rdfs:label "${c.cn}" .`).join("\n");
  const L = (state.uiLogs.onto = []);
  state.tabs.onto = "method";
  notify();
  const lines = [
    ["t", "[导出] CyberDefenseOntology 1.0 → RDF/Turtle（标准化交付用，生产系统使用属性图）"],
    ["info", { __html: "<pre style='margin:4px 0;color:#8398bd'>" + `@prefix cd: &lt;http://example.org/cd#&gt; .\n@prefix owl: &lt;http://www.w3.org/2002/07/owl#&gt; .\n\n${sample}\ncd:belongsTo rdfs:domain cd:Asset ;\n             rdfs:range  cd:NetworkDomain .`.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</pre>" }],
    ["ok", `[完成] 共 ${cls.length} 类 / ${ONTO.relations.filter((r) => r.on).length} 关系 · 文件 ontology-v1.0.turtle`],
  ];
  lines.forEach(([c, t], i) => setTimeout(() => { L.push({ c, t }); notify(); }, i * 500));
  toast("已生成 RDF/Turtle 导出预览", "ok");
}

/* —— 本体关系图交互 —— */
export function ontoRelToggle() { state.ontoPick = state.ontoPick ? null : { a: null }; notify(); }

export function ontoRelayout() {
  resetOntoLayout();
  addAudit("本体建模", "视图重置为自动聚类布局");
  toast("已恢复自动布局", "ok");
  notify();
}

export function ontoPickNode(name, ONTOVref) {
  const pk = state.ontoPick; if (!pk) return;
  const c = ONTO.classes.find((z) => z.name === name);
  if (c && !c.on) { toast(`类 ${name} 已停用，不能作为关系端点`, "warn"); return; }
  if (!pk.a) { pk.a = name; toast(`已选起点类 ${name}，请点击目标类`, "ok"); notify(); }
  else if (pk.a === name) { state.ontoPick = { a: null }; toast("已取消起点选择", "warn"); notify(); }
  else { state.ontoPick = null; showOntoRelForm(pk.a, name); }
}

export function ontoRelSave(from, to, name, use) {
  name = (name || "").trim(); use = (use || "").trim() || "自定义关系（画布手动创建）";
  if (!/^[a-z][A-Za-z0-9]*$/.test(name)) { toast("请输入合法的关系名（小驼峰英文）", "err"); return; }
  if (ONTO.relations.some((r) => r.name === name && r.from === from && r.to === to)) { toast("相同关系已存在", "warn"); return; }
  ONTO.relations.push({ name, from, to, use, on: false, core: false, st: "review" });
  addAudit("本体建模", `画布添加关系 ${name}: ${from} → ${to}（${use}）→ 评审中`, "ok");
  toast(`关系 ${name} 已提交评审队列，发布后以琥珀色显示于关系图`, "ok");
  closePanel(); notify();
}

export function ontoToggleLabels() { state.ontoLabels = !state.ontoLabels; notify(); }

export function kgInfo(name) { sidePanel(kgInfoPanel(name)); }

/* ============================ 知识图谱 ============================ */

export const KG_LAYER = [
  { t: "L1 标准安全知识", c: "#f87171" },
  { t: "L3 动态安全态势", c: "#fbbf24" },
  { t: "L2 现场基础知识", c: "#22d3ee" },
  { t: "L4 决策执行知识", c: "#a78bfa" },
];
export const KG_LAYER_OF = { AttackTechnique: 0, DefenseTechnique: 0, SecurityEvent: 1, Incident: 1, Evidence: 1, NetworkDomain: 2, Asset: 2, Endpoint: 2, Server: 2, Service: 2, Mission: 2, Account: 2, SecurityProduct: 2, Capability: 3, ActionTemplate: 3, Policy: 3, DefensePlan: 3, DefenseAction: 3, DefenseTask: 3, Approval: 3, ExecutionResult: 3, EffectReport: 3 };

export function kgAll() {
  const a = SC().assessment, evs = INC().events.map((id) => DB.events.find((e) => e.id === id));
  const NET = INC().net.split(" / ")[0];
  const D3F_MAP = { "T1078.002": ["D3-DAM", "D3-MFA", "D3-AL"], "T1021.001": ["D3-ST", "D3-NI", "D3-NTF"], "T1046": ["D3-NTF"], "T1105": ["D3-NTF"], "T1110.001": ["D3-AL", "D3-DAM"], "T1078": ["D3-DAM", "D3-MFA"], "T1071.001": ["D3-NTF", "D3-ST"] };
  const D3F_NAME = { "D3-ST": "Session Termination", "D3-NI": "Network Isolation", "D3-NTF": "Network Traffic Filtering", "D3-DAM": "Domain Account Monitoring", "D3-MFA": "Multi-Factor Auth", "D3-AL": "Account Lockout" };
  const tD3f = (t) => { const kb = DB.attackKB.find((k) => k.id === t.id); return (kb && kb.d3fend && kb.d3fend.length) ? kb.d3fend : (D3F_MAP[t.id] || ["D3-ST"]); };
  const d3fs = [...new Set(a.techniques.flatMap(tD3f))];
  const d3Nm = (id) => { const x = DB.d3fendKB.find((k) => k.id === id); return x ? x.name : (D3F_NAME[id] || "D3FEND"); };
  const HOSTS = { DesignArchiveService: "RND-FILE-01", LabDataService: "LAB-SRV-01", GitService: "RND-GIT-01", OAService: "OA-APP-01" };
  const svcs = a.affected_services.slice(0, 2).map((x) => {
    const [s, m] = x.split("→").map((p) => p.trim());
    return { svc: s, mis: (m || "").split("（")[0].trim() || "MISSION", lvl: (x.match(/（([^）]*)）/) || [])[1] || "" };
  });
  const CAP_MAP = { terminate_session: "AccountControl", restrict_account: "AccountControl", require_mfa: "AccountControl", restrict_network_access: "NetworkAccessControl", isolate_endpoint: "EndpointIsolation", apply_network_policy: "NetworkPolicyControl", increase_monitoring: "Monitoring", increase_account_monitoring: "AccountMonitoring", collect_evidence: "EvidenceCollection", verify_effect: "EffectVerification" };
  const D3_REALIZE = { "D3-ST": "AccountControl", "D3-DAM": "AccountControl", "D3-MFA": "AccountControl", "D3-AL": "AccountControl", "D3-NI": "EndpointIsolation", "D3-NTF": "NetworkPolicyControl" };
  const norm = (x) => (x === "AD/IAM" ? "AD/IAM-01" : x);
  const prods = [...new Set(SC().tasks.map((t) => norm(t.exec)).filter((x) => x !== "Effect Verification"))];
  const caps = [...new Set(SC().tasks.map((t) => CAP_MAP[t.tpl]).filter(Boolean))];
  const capProd = {}, capNet = {};
  SC().tasks.forEach((t) => { const c = CAP_MAP[t.tpl]; if (c) { capProd[c] = norm(t.exec); if (!capNet[c]) capNet[c] = t.net; } });
  const acctM = (a.summary.match(/账户\s+([a-zA-Z][\w-]*)/) || [])[1];
  const pl = S().planSelected ? SC().plans.find((p) => p.id === S().planSelected) : null;
  const assetCls = (x) => (/WS|PC|TERM/i.test(x) ? "Endpoint" : /FILE|SRV|APP|GIT|IAM/i.test(x) ? "Server" : "Asset");
  const done = stageOf(state.activeInc) >= 7;
  const nodes = [
    ...a.techniques.map((t) => ({ id: t.id, l: "attack:" + t.id, s: t.name.slice(0, 20), layer: 0, cls: "AttackTechnique" })),
    ...d3fs.map((d) => ({ id: d, l: "d3f:" + d, s: d3Nm(d), layer: 0, cls: "DefenseTechnique" })),
    ...evs.map((e) => ({ id: e.id, l: e.id, s: e.type.slice(0, 16), layer: 1, cls: "SecurityEvent" })),
    { id: INC().id, l: "inst:" + INC().id, s: "Incident 事件档案", layer: 1, cls: "Incident" },
    { id: "evi", l: "evi:证据档案", s: a.evidence.length + " 份引用 · SHA-256", layer: 1, cls: "Evidence" },
    ...(acctM ? [{ id: "acct", l: "account:" + acctM, s: "Account · AD/IAM 同步", layer: 2, cls: "Account" }] : []),
    ...a.affected_assets.slice(0, 2).map((x) => ({ id: x, l: "inst:" + x, s: "受影响资产", layer: 2, cls: assetCls(x) })),
    { id: NET, l: "inst:" + NET, s: "NetworkDomain", layer: 2, cls: "NetworkDomain" },
    ...svcs.map((v) => ({ id: "svc:" + v.svc, l: "inst:" + v.svc, s: "Service · CMDB", layer: 2, cls: "Service" })),
    ...svcs.map((v) => ({ id: v.mis, l: v.mis, s: "Mission · " + (v.lvl || "—"), layer: 2, cls: "Mission", lvl: v.lvl })),
    ...prods.map((p) => ({ id: "prd:" + p, l: "inst:" + p, s: "SecurityProduct", layer: 2, cls: "SecurityProduct" })),
    ...caps.map((c) => ({ id: "cap:" + c, l: "cap:" + c, s: "scope=" + (capNet[c] || "—") + " · health=AVAILABLE", layer: 3, cls: "Capability" })),
    { id: "at1", l: "ActionTemplate", s: "标准动作注册表", layer: 3, cls: "ActionTemplate" },
    { id: "plan", l: "inst:DefensePlan", s: pl ? pl.id + " · " + pl.name : "（待规划）", layer: 3, cls: "DefensePlan" },
    { id: "task", l: "inst:DefenseTask", s: SC().tasks.length + " 任务 DAG", layer: 3, cls: "DefenseTask" },
    ...(done ? [{ id: "exec", l: "inst:ExecutionResult", s: "status=SUCCESS · evidence_refs", layer: 3, cls: "ExecutionResult" }] : []),
  ];
  const E = [], seen = new Set();
  const add = (f, t, l, k) => { const key = f + "|" + t + "|" + l; if (!seen.has(key)) { seen.add(key); E.push([f, t, l, k || ""]); } };
  evs.forEach((e) => add(INC().id, e.id, "contains"));
  a.techniques.forEach((t) => add(INC().id, t.id, "mappedTo(AI·" + a.confidence + ")", "ai"));
  a.techniques.forEach((t) => tD3f(t).forEach((d) => add(t.id, d, "relatedDefense", "d3f")));
  a.affected_assets.slice(0, 2).forEach((x) => add(INC().id, x, "affects"));
  a.affected_assets.slice(0, 2).forEach((x) => add(x, NET, "belongsTo"));
  evs.forEach((e) => add(e.id, "evi", "derivedFrom"));
  svcs.forEach((v) => {
    const host = (HOSTS[v.svc] && a.affected_assets.includes(HOSTS[v.svc])) ? HOSTS[v.svc] : a.affected_assets[0];
    add(host, "svc:" + v.svc, "hosts"); add("svc:" + v.svc, v.mis, "supports");
  });
  caps.forEach((c) => { if (capProd[c] && capProd[c] !== "Effect Verification") add("prd:" + capProd[c], "cap:" + c, "provides"); });
  const MGMT_TPL = new Set(["isolate_endpoint", "collect_evidence", "restrict_network_access"]);
  SC().tasks.forEach((t) => {
    if (!MGMT_TPL.has(t.tpl)) return;
    const ast = a.affected_assets.find((x) => t.target.includes(x));
    if (ast && prods.includes(norm(t.exec))) add(ast, "prd:" + norm(t.exec), "managedBy");
  });
  let acctT = null;
  if (acctM) for (const e of evs) { if (e.facts.includes(acctM)) { const hit = a.affected_assets.find((x) => e.facts.includes(x)); if (hit) { acctT = hit; break; } } }
  if (acctM) add("acct", acctT || a.affected_assets[0], "accesses");
  d3fs.forEach((d) => {
    const e = DB.d3fendKB.find((x) => x.id === d);
    const act = e ? String(e.action).split("（")[0].trim() : null;
    const c = (act && CAP_MAP[act]) || D3_REALIZE[d];
    if (c && caps.includes(c)) add(d, "cap:" + c, "realizedBy");
  });
  caps.forEach((c) => add("cap:" + c, "at1", "implementedBy"));
  add("at1", "plan", "组合生成(Planner)");
  add("plan", "task", "编排下发(签名)");
  if (done) add("task", "exec", "produces");
  const edges = E.filter(([x, y]) => nodes.find((n) => n.id === x) && nodes.find((n) => n.id === y));
  state.kgCustom.nodes.forEach((n) => { if (!nodes.find((x) => x.id === n.id)) nodes.push({ ...n }); });
  state.kgCustom.edges.forEach((e) => { if (nodes.find((n) => n.id === e[0]) && nodes.find((n) => n.id === e[1])) edges.push(e); });
  return { nodes, edges };
}

/* —— 实例构建向导 —— */
export const KGW_STEPS = ["① 选择类", "② 标识与属性", "③ 关系挂接", "④ 校验与入图"];

export function kgWizOpen() {
  if (!SC()) { toast("历史闭环案例不支持实例构建", "warn"); return; }
  state.kgWiz = { step: 0, d: { cls: "", label: "", sub: "", strong: "", attrs: "", relDir: "out", rel: "", target: "" } };
  notify();
}

export function kgWizPickCls(name) { state.kgWiz.d.cls = name; notify(); }

export function kgWizParseAttrs(txt) {
  const list = []; let badCnt = 0;
  String(txt || "").split("\n").map((x) => x.trim()).filter(Boolean).forEach((line) => {
    const m = line.match(/^([a-zA-Z_][\w.-]*)\s*=\s*(.+)$/);
    if (m) list.push([m[1], m[2]]); else badCnt++;
  });
  return { list, bad: badCnt };
}

export function kgWizValid() {
  const w = state.kgWiz, d = w.d;
  if (w.step === 0 && !d.cls) { toast("请先选择一个 Schema 类", "err"); return false; }
  if (w.step === 1) {
    if (!d.label) { toast("请填写实例标识", "err"); return false; }
    if (kgAll().nodes.some((n) => n.id === d.label || n.l === "inst:" + d.label) || state.kgCustom.nodes.some((n) => n.label === d.label)) { toast("实例标识已存在", "err"); return false; }
  }
  return true;
}

export function kgWizNext() { if (!kgWizValid()) return; state.kgWiz.step++; notify(); }
export function kgWizBack() { state.kgWiz.step = Math.max(0, state.kgWiz.step - 1); notify(); }

export function kgWizSubmit() {
  const d = state.kgWiz.d;
  const attrs = kgWizParseAttrs(d.attrs).list;
  if (d.strong) attrs.unshift(["strong_id", d.strong]);
  const nid = "cust-" + String(state.kgCustom.nodes.length + 1).padStart(2, "0");
  const node = { id: nid, label: d.label, l: "inst:" + d.label, s: d.sub || (d.cls + " · 人工构建"), layer: KG_LAYER_OF[d.cls] ?? 2, cls: d.cls, custom: true, verified: false, attrs };
  state.kgCustom.nodes.push(node);
  if (d.rel && d.target) {
    const e = d.relDir === "out" ? [nid, d.target, d.rel, "custom"] : [d.target, nid, d.rel, "custom"];
    state.kgCustom.edges.push(e);
  }
  state.kgWiz = null;
  addAudit("知识图谱", `构建向导人工入图实例 ${d.label}（cd:${d.cls} · ${KG_LAYER[node.layer].t}${d.rel ? ` · 挂接 ${d.rel}→${d.target}` : ""}）→ 待核验`, "info");
  toast(`实例 ${d.label} 已入图（待核验）· 在「手动构建」标签页管理`, "ok");
  closePanel();
  state.tabs.kg = "viz"; state.kgFocus = nid; state.kgHops = 1;
  notify();
}

export function kgVerify(id) {
  const n = state.kgCustom.nodes.find((x) => x.id === id); if (!n) return;
  n.verified = true;
  addAudit("知识图谱", `安全专家·李清源 核验通过人工实例 ${n.label}（${n.id}）`, "ok");
  toast(`实例 ${n.label} 已核验转正`, "ok");
  notify();
}

export function kgCustomDelNode(id) {
  const n = state.kgCustom.nodes.find((x) => x.id === id);
  state.kgCustom.nodes = state.kgCustom.nodes.filter((x) => x.id !== id);
  state.kgCustom.edges = state.kgCustom.edges.filter((e) => e[0] !== id && e[1] !== id);
  if (state.kgFocus === id) state.kgFocus = null;
  addAudit("知识图谱", `删除人工实例 ${n ? n.label : id}（关联关系已一并移除）`, "warn");
  toast("人工实例已删除", "warn");
  notify();
}

export function kgCustomDelEdge(i) {
  const e = state.kgCustom.edges[i]; if (!e) return;
  state.kgCustom.edges.splice(i, 1);
  addAudit("知识图谱", `删除人工关系 ${e[0]} —${e[2]}→ ${e[1]}`, "warn");
  toast("人工关系已删除", "warn");
  notify();
}

export function kgCustomRelSave(from, rel, to) {
  if (from === to) { toast("起点与终点不能相同", "err"); return; }
  if (state.kgCustom.edges.some((e) => (e[0] === from && e[1] === to && e[2] === rel) || (e[0] === to && e[1] === from && e[2] === rel))) { toast("相同关系已存在", "warn"); return; }
  state.kgCustom.edges.push([from, to, rel, "custom"]);
  addAudit("知识图谱", `人工追加关系 ${from} —${rel}→ ${to}`, "ok");
  toast("关系已添加（待核验）", "ok");
  closePanel(); notify();
}

export function kgMode(f) { state.kgFocus = f; notify(); }
export function kgHopsT() { state.kgHops = state.kgHops === 1 ? 2 : 1; notify(); }
export function kgToggleLabels() { state.kgLabels = !state.kgLabels; notify(); }
export function kgFocusNode(id) { state.kgFocus = id; state.kgHops = 1; closePanel(); notify(); }

export function kgNode(id) { sidePanel(kgNodePanel(id)); }

/* —— 图谱 ↔ 本体 双向导航 —— */
export function gotoOnto(cls) { state.ontoFocus = cls; closePanel(); go("ontology"); }
export function kgGotoInst(id) { if (!SC()) return; state.kgFocus = id; state.kgHops = 1; state.tabs.kg = "viz"; closePanel(); go("kg"); }
export function kgGotoCls(name) {
  const n = SC() && kgAll().nodes.find((x) => x.cls === name);
  if (n) kgGotoInst(n.id); else toast("当前事件暂无该类实例", "warn");
}

/* —— 实体属性（§19.2 关键属性 · 会话内可编辑） —— */
export const KG_PROPS = {};

export function kgPropsOf(n) {
  if (n.custom) {
    const base = [["inst_id", n.id], ["rdf:type", "cd:" + n.cls], ["source", "人工构建（构建向导）"], ["verified", n.verified ? "true（专家已核验）" : "false（待核验）"]];
    return base.concat(n.attrs || []).map(([k, v]) => ({ k, v: String(v), v0: String(v), dirty: false }));
  }
  const a = SC().assessment, ev = DB.events.find((e) => e.id === n.id);
  const NETLVL = { "LAN-A": "办公（互联网边界）", "LAN-B": "研发（内部）", "LAN-C": "实验（隔离）", "INFRA": "基础设施管理", "SEC-MGMT": "安全管理" };
  const svc = SC().assessment.affected_services.map((x) => ({ s: x.split("→")[0].trim(), lvl: (x.match(/（([^）]*)）/) || [])[1] || "" }));
  const pl = S().planSelected ? SC().plans.find((p) => p.id === S().planSelected) : null;
  const f = {
    AttackTechnique: () => { const t = a.techniques.find((x) => x.id === n.id) || {}; return [["external_id", t.id || n.id], ["name", t.name || "—"], ["source_version", "ATT&CK v19.2"]]; },
    DefenseTechnique: () => [["external_id", n.id], ["name", (DB.d3fendKB.find((x) => x.id === n.id) || { name: "D3FEND" }).name], ["source_version", "D3FEND v1.6.0"], ["mapping_source", "D3FEND_INFERRED"]],
    SecurityEvent: () => [["event_id", n.id], ["event_type", ev ? ev.type : "—"], ["time", ev ? ev.time : "—"], ["severity", ev ? ev.sev : "—"], ["source_system", ev ? ev.src : "—"]],
    Incident: () => [["incident_id", n.id], ["status", stageOf(state.activeInc) >= 8 ? "CONTAINED" : "处置中"], ["scope", INC().net], ["confidence", a.confidence]],
    Evidence: () => [["evidence_ref", a.evidence.join(", ")], ["sha256", "已存证（见事件详情）"], ["source", "EDR / NDR / IAM / SIEM"]],
    Account: () => [["account_id", n.l.replace("account:", "")], ["account_type", "域账户"], ["status", "ACTIVE"], ["privilege", "普通"]],
    NetworkDomain: () => [["domain_id", n.id], ["security_level", NETLVL[n.id] || "—"], ["cidr", "（见 CMDB）"]],
    Service: () => [["service_id", n.l.replace("inst:", "")], ["health", "NORMAL"], ["importance", svc.find((x) => n.l.includes(x.s))?.lvl || "—"]],
    Mission: () => [["mission_id", n.id], ["criticality", n.lvl || "—"], ["owner", "业务部门"]],
    SecurityProduct: () => [["product_id", n.l.replace("inst:", "")], ["scope", INC().net], ["health", "AVAILABLE"]],
    Capability: () => [["capability_id", n.l.replace("cap:", "")], ["scope", "按任务网域"], ["health", "AVAILABLE"], ["risk", "可控"]],
    ActionTemplate: () => [["action_type", "标准动作集"], ["target_type", "Endpoint / Account / Network"], ["rollback", "支持（R-05）"]],
    DefensePlan: () => [["plan_id", pl ? pl.id : "—"], ["objective", pl ? pl.name : "（待规划）"], ["status", S().approved ? "APPROVED" : S().planSelected ? "SELECTED" : "DRAFT"]],
    DefenseTask: () => [["task_id", "T1…T" + SC().tasks.length], ["scope", INC().net], ["approval_id", S().approved ? "已关联" : "待审批"], ["expire_at", "执行窗口内"]],
    ExecutionResult: () => [["status", "SUCCESS"], ["operation_id", "EXEC 系列"], ["evidence_refs", "已关联证据档案"]],
    Endpoint: () => [["asset_id", n.id], ["edr_status", "INSTALLED"], ["criticality", "HIGH"], ["user_owner", "（见 IAM）"]],
    Server: () => [["asset_id", n.id], ["criticality", "CRITICAL"], ["ha_level", "（见 CMDB）"]],
    Asset: () => [["asset_id", n.id], ["criticality", "（见 CMDB）"]],
  }[n.cls];
  return f ? f().map(([k, v]) => ({ k, v: String(v), v0: String(v), dirty: false })) : [];
}

export function kgGetProps(id) {
  const key = state.activeInc + "|" + id;
  if (!KG_PROPS[key]) {
    const n = kgAll().nodes.find((x) => x.id === id);
    KG_PROPS[key] = n ? kgPropsOf(n) : [];
  }
  return KG_PROPS[key];
}

export function kgSetProp(id, k, val) {
  const p = kgGetProps(id).find((x) => x.k === k); if (!p) return;
  p.v = val; p.dirty = val !== p.v0;
  addAudit("知识图谱", `更新属性 ${id}.${k} = ${val}`);
  toast(`属性 ${k} 已更新`, "ok");
  sidePanel(kgNodePanel(id));
  notify();
}

export function kgAddProp(id, k, v) {
  if (!/^[a-zA-Z_][\w.-]*$/.test(k || "")) { toast("属性名请用英文/数字/下划线", "err"); return; }
  if (kgGetProps(id).some((x) => x.k === k)) { toast("属性已存在", "err"); return; }
  kgGetProps(id).push({ k, v, v0: "", dirty: true });
  addAudit("知识图谱", `新增属性 ${id}.${k} = ${v}`, "ok");
  toast(`属性 ${k} 已添加`, "ok");
  sidePanel(kgNodePanel(id));
  notify();
}

export function kgDelProp(id, k) {
  const arr = kgGetProps(id), i = arr.findIndex((x) => x.k === k);
  if (i >= 0) { arr.splice(i, 1); addAudit("知识图谱", `删除属性 ${id}.${k}`, "warn"); sidePanel(kgNodePanel(id)); notify(); }
}

export function kgResetProps(id) {
  delete KG_PROPS[state.activeInc + "|" + id];
  addAudit("知识图谱", `恢复 ${id} 的初始属性`, "info");
  sidePanel(kgNodePanel(id));
  notify();
}

/* ============================ 图谱构建 ============================ */

export function gbLog(c, t) { state.graphSyncLog.push({ c, t }); notify(); }

export function syncSource(i) {
  const s = GRAPH.sources[i];
  s.status = "syncing";
  gbLog("t", `[${now().slice(11)}] ${s.name}：拉取增量数据…`);
  notify();
  setTimeout(() => { gbLog("info", "  Mapping 转换 → 规范节点/边 · 实体解析合并 alias"); }, 600);
  setTimeout(() => {
    s.status = "done";
    gbLog("ok", `  入图完成：+${Math.round(s.nodes * 0.03) || 1} 节点 / +${Math.round(s.edges * 0.05) || 2} 边 · 一致性检查通过`);
    addAudit("图谱构建", `${s.name} 增量同步完成`, "ok");
    notify();
  }, 1400);
}

export function syncAllSources() {
  GRAPH.sources.forEach((s, i) => { if (s.status !== "done") setTimeout(() => syncSource(i), i * 600); });
  toast("已触发全部数据源同步（增量入图）", "ok");
}

export function runER() {
  const er = GRAPH.erDemo;
  const lines = [
    ["t", "[Entity Resolution] 输入 4 个多源标识 · 网络域约束 LAN-B"],
    ["info", `[强标识] 命中：${er.strong}`],
    ["info", `[弱标识] 辅助：${er.weak} · IP 未漂移，hostname 一致`],
    ["warn", "[冲突检测] 未发现跨域同名资产；无需人工确认"],
    ["ok", `[输出] 合并为规范实体 ${er.result}（置信度 ${er.confidence}），保留全部 alias 与来源系统`],
  ];
  const L = (state.uiLogs.er = []);
  notify();
  lines.forEach(([c, t], i) => setTimeout(() => { L.push({ c, t }); notify(); }, i * 550));
}

/* ============================ 知识库 ============================ */

export const KB_ORIG = { atk: {}, d3f: {} };

export function _kbSnap(kind, id) {
  if (!KB_ORIG[kind][id]) {
    const src = kind === "atk" ? DB.attackKB : DB.d3fendKB;
    const e = src.find((x) => x.id === id);
    KB_ORIG[kind][id] = e ? JSON.parse(JSON.stringify(e)) : {};
  }
  return KB_ORIG[kind][id];
}

export function _kbDirty(kind, id) {
  const src = kind === "atk" ? DB.attackKB : DB.d3fendKB;
  const e = src.find((x) => x.id === id), o = KB_ORIG[kind][id];
  if (!e || !o || e.custom) return [];
  return Object.keys(o).filter((k) => !k.startsWith("_") && String(o[k]) !== String(e[k]));
}

export function _kbSet(kind, id, k, val) {
  const src = kind === "atk" ? DB.attackKB : DB.d3fendKB;
  const e = src.find((x) => x.id === id); if (!e) return;
  _kbSnap(kind, id);
  e[k] = val;
  if (!e.custom) { e._ovr = true; e._ok = false; }
  addAudit("标准知识库", `更新${kind === "atk" ? "攻击技术" : "防御映射"} ${id}.${k} = ${val}${e.custom ? "" : "（本地覆写，待专家复核）"}`, "warn");
  notify();
}

export function kbReviewAll() {
  let n = 0;
  [...DB.attackKB, ...DB.d3fendKB].forEach((e) => { if (e._ovr) { e._ovr = false; e._ok = true; n++; } });
  if (!n) { toast("当前没有待复核的覆写", "warn"); return; }
  addAudit("标准知识库", `专家复核通过 ${n} 条本地覆写，已生效入图`, "ok");
  toast(`${n} 条本地覆写复核通过 ✓`, "ok");
  notify();
}

export function showAtk(id) { const t = DB.attackKB.find((x) => x.id === id); if (t) sidePanel(showAtkPanel(id)); }
export function showD3f(id) { const d = DB.d3fendKB.find((x) => x.id === id); if (d) sidePanel(showD3fPanel(id)); }

export function toggleAtkD3(id, did) {
  const t = DB.attackKB.find((x) => x.id === id); if (!t) return;
  _kbSnap("atk", id);
  t.d3fend = t.d3fend.includes(did) ? t.d3fend.filter((x) => x !== did) : [...t.d3fend, did];
  if (!t.custom) { t._ovr = true; t._ok = false; }
  addAudit("标准知识库", `调整 ${id} 的 D3FEND 候选 → ${t.d3fend.join("/") || "（空）"}`, "warn");
  sidePanel(showAtkPanel(id));
  notify();
}

export function kbReset(kind, id) {
  const src = kind === "atk" ? DB.attackKB : DB.d3fendKB;
  const e = src.find((x) => x.id === id), o = KB_ORIG[kind][id];
  if (!e || !o) return;
  Object.keys(o).forEach((k) => { if (!k.startsWith("_")) e[k] = o[k]; });
  e._ovr = false; e._ok = false;
  addAudit("标准知识库", `恢复 ${id} 为标准包原始值`);
  sidePanel(kind === "atk" ? showAtkPanel(id) : showD3fPanel(id));
  notify();
}

export function delAtk(id) {
  const t = DB.attackKB.find((x) => x.id === id);
  if (!t || !t.custom) { toast("标准条目不可删除", "err"); return; }
  DB.attackKB = DB.attackKB.filter((x) => x.id !== id);
  addAudit("标准知识库", `删除本地攻击技术 ${id}`, "warn");
  toast(`已删除 ${id}`, "warn");
  closePanel(); notify();
}

export function saveAtk(f) {
  const id = (f.id || "").trim(), name = (f.name || "").trim();
  const type = f.type, parent = (f.parent || "").trim() || "—";
  const platform = (f.platform || "").trim() || "—", mit = (f.mit || "").trim() || "—";
  if (!/^T\d{4}(\.\d{3})?$/.test(id)) { toast("技术 ID 格式：T1234 或 T1234.001", "err"); return; }
  if (!name) { toast("请输入名称", "err"); return; }
  if (DB.attackKB.some((t) => t.id === id)) { toast("技术 ID 已存在", "err"); return; }
  DB.attackKB.push({ id, name, type, parent, platform, mitigation: mit, d3fend: [], custom: true });
  addAudit("标准知识库", `新增本地攻击技术 ${id}（${name}）`, "ok");
  toast(`本地技术 ${id} 已入库`, "ok");
  closePanel(); notify();
}

export function delD3f(id) {
  const d = DB.d3fendKB.find((x) => x.id === id);
  if (!d || !d.custom) { toast("标准映射不可删除", "err"); return; }
  DB.d3fendKB = DB.d3fendKB.filter((x) => x.id !== id);
  DB.attackKB.forEach((t) => { t.d3fend = t.d3fend.filter((x) => x !== id); });
  addAudit("标准知识库", `删除本地防御映射 ${id}`, "warn");
  toast(`已删除 ${id}`, "warn");
  closePanel(); notify();
}

export function saveD3f(f) {
  const id = (f.id || "").trim(), name = (f.name || "").trim();
  const cat = f.cat, impl = (f.impl || "").trim() || "—";
  const action = (f.action || "").trim() || "—", product = (f.product || "").trim() || "—";
  if (!/^D3-[A-Za-z0-9/]+$/.test(id)) { toast("ID 格式：D3-XX（如 D3-CH）", "err"); return; }
  if (!name) { toast("请输入名称", "err"); return; }
  if (DB.d3fendKB.some((d) => d.id === id)) { toast("D3FEND ID 已存在", "err"); return; }
  DB.d3fendKB.push({ id, name, cat, impl, action, product, custom: true });
  addAudit("标准知识库", `新增本地防御映射 ${id}（${name}）`, "ok");
  toast(`本地映射 ${id} 已入库`, "ok");
  closePanel(); notify();
}

/* ============================ 案例库 ============================ */

export function caseSim(c) {
  if (!SC()) return null;
  const cur = SC().assessment.techniques.map((t) => t.id);
  const ov = c.techs.filter((t) => cur.some((x) => x === t || x.startsWith(t + ".")));
  if (!ov.length && !c.sim) return null;
  const full = c.techs.every((t) => cur.includes(t));
  const score = Math.min(0.99, 0.5 + (c.sim || 0) + 0.18 * ov.length + (full ? 0.05 : 0));
  return { ov, score };
}

export function showCase(id) {
  const c = DB.cases.find((x) => x.id === id);
  if (c) sidePanel(showCasePanel(id));
}

export function caseReview(id, f) {
  const c = DB.cases.find((x) => x.id === id); if (!c) return;
  const lesson = (f.lesson || "").trim();
  if (!lesson) { toast("请填写复盘要点（lesson）后再提交", "err"); return; }
  const verdict = f.verdict, rec = !!f.recommend;
  c.lesson = lesson;
  c.review = { by: "安全专家·李清源", at: now(), verdict, recommend: rec };
  c.tag = rec ? "可推荐案例" : "已复盘";
  addAudit("Case Library", `${c.id} 专家复盘确认（李清源）：${verdict}${rec ? " · 已标记「可推荐」进入 Planning 推荐池" : " · 仅档案留存"}`, "ok");
  toast(rec ? `${c.id} 复盘通过 ✓ 已进入可推荐池` : `${c.id} 复盘完成（未推荐）`, "ok");
  closePanel(); notify();
}

export function caseReopen(id) {
  const c = DB.cases.find((x) => x.id === id); if (!c) return;
  c.tag = "待专家复盘"; c.review = null;
  addAudit("Case Library", `${c.id} 复盘结论已撤销，重新待专家复盘确认`, "warn");
  toast(`${c.id} 已重新打开复盘`, "warn");
  closePanel(); notify();
}

export function caseLessonSet(id, v) {
  const c = DB.cases.find((x) => x.id === id); if (!c) return;
  c.lesson = v;
  addAudit("Case Library", `${c.id} 复盘要点已人工修订`, "info");
  toast(`${c.id} 复盘要点已更新`, "ok");
  notify();
}
