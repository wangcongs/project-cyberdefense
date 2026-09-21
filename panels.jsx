/* =====================================================================
   侧栏面板层：所有 sidePanel 内容（展示型面板 + 表单面板 + 多步向导）
   表单用本地 useState 收集，提交时调用 actions 层函数
   ===================================================================== */
import { useState } from "react";
import { state, S, SC, INC, stageOf, useApp } from "../core/store.js";
import { closePanel, sidePanel } from "../core/utils.js";
import { DB, ONTO, ONTO_CQS } from "../core/data.js";
import { SevBadge, StatusBadge } from "./common.jsx";
import {
  topoLinkSave, topoLinkDel, saveNet, delNet, saveAsset, delAsset, _dirtyN,
  setAssetProp, resetAsset, setNetProp, resetNet, ASSET_ORIG, NET_ORIG,
} from "../actions/topology.js";
import { switchInc, go } from "../actions/system.js";
import {
  taskSave, taskDel, taskCreate, nextTaskId, taskConfirm, taskDone, taskSkip, tplCatalog,
} from "../actions/pipeline.js";
import {
  cst, showCQ, cqFocus, kgGotoInst, kgInfo, wizNext, wizBack, wizSubmit, WIZ_STEPS,
  ontoRelSave, addClass, addRel, addCQ, kgWizNext, kgWizBack, kgWizSubmit, kgWizPickCls,
  kgWizParseAttrs, KGW_STEPS, KG_LAYER, KG_LAYER_OF, kgAll, kgVerify, kgCustomDelNode, kgCustomRelSave,
  kgFocusNode, kgMode, kgHopsT, kgGetProps, kgSetProp, kgAddProp, kgDelProp, kgResetProps,
  gotoOnto, _kbSet, _kbDirty, kbReset, toggleAtkD3, delAtk, saveAtk, delD3f, saveD3f,
  caseSim, caseReview, caseReopen, caseLessonSet, showAtk, kgGotoCls,
} from "../actions/knowledge.js";

/* =====================================================================
   事件中心 / 拓扑
   ===================================================================== */

export function showEventPanel(e) {
  return <>
    <h3 className="mono hl-cyan" style={{ fontSize: "14px", marginBottom: "4px" }}>event:{e.id}</h3>
    <div className="hint mb14">规范化 SecurityEvent · 原始数据 hash 已存证</div>
    <div className="kv"><span className="k">event_type</span><span className="v mono">{e.type}</span></div>
    <div className="kv"><span className="k">occurred_at</span><span className="v mono">{e.time}</span></div>
    <div className="kv"><span className="k">network_scope</span><span className="v mono">{e.net}</span></div>
    <div className="kv"><span className="k">severity</span><span className="v"><SevBadge s={e.sev} /></span></div>
    <div className="kv"><span className="k">source_system</span><span className="v mono">{e.src}</span></div>
    <div className="kv"><span className="k">evidence_ref</span><span className="v mono">evi:OBJ-{e.id.slice(-3)} · sha256:9f2c…e41a</span></div>
    <div className="kv"><span className="k">事实含义</span><span className="v">{e.meaning}</span></div>
    <div className="kv"><span className="k">成案归属</span><span className="v">{e.incident ? <span className="mono hl-purple">{e.incident}</span> : <span className="faint">未满足成案规则</span>}</span></div>
    {e.incident && RT[e.incident] ? (
      <div className="mt14"><button className="btn sm primary" onClick={() => { closePanel(); switchInc(e.incident); go("analysis"); }}>→ 进入该事件处置</button></div>
    ) : null}
  </>;
}

/* —— 添加拓扑关系（from → to 表单）/ 关系详情 —— */
export function showTopoLinkPanel(from, to, l) {
  if (l) {
    return <>
      <h3 className="mono hl-cyan" style={{ fontSize: "14px", marginBottom: "10px" }}>{l.id} · 拓扑关系</h3>
      <div className="kv"><span className="k">起点</span><span className="v mono hl-cyan">{l.from}</span></div>
      <div className="kv"><span className="k">终点</span><span className="v mono hl-cyan">{l.to}</span></div>
      <div className="kv"><span className="k">类型</span><span className="v"><span className="badge b-cyan">{l.type}</span></span></div>
      <div className="kv"><span className="k">说明</span><span className="v">{l.label}</span></div>
      <div className="hint mt14">手动关系帮助指挥员标注资产间业务/管理依赖，供人工研判与影响分析参考；不进入策略引擎。</div>
      <button className="btn danger mt14" style={{ width: "100%" }} onClick={() => topoLinkDel(l.id)}>✕ 删除该关系</button>
    </>;
  }
  return <TopoLinkForm from={from} to={to} />;
}
function TopoLinkForm({ from, to }) {
  const [type, setType] = useState("业务依赖");
  const [label, setLabel] = useState("");
  return <>
    <h3 className="hl-cyan" style={{ fontSize: "14px", marginBottom: "10px" }}>添加拓扑关系</h3>
    <div className="hint mb14"><span className="mono hl-cyan">{from}</span> → <span className="mono hl-cyan">{to}</span> · 手动关系仅影响拓扑呈现与人工研判参考，不改变访问基线策略（演示为内存态）。</div>
    <div className="f-row"><label className="f-label">关系类型</label>
      <select className="f-input" value={type} onChange={(e) => setType(e.target.value)}>
        {Object.keys(TOPO_LINKTYPES).map((t) => <option key={t}>{t}</option>)}
      </select></div>
    <div className="f-row"><label className="f-label">关系说明</label><input className="f-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="如 数据库访问 / 备份链路 / EDR 管理代理" /></div>
    <button className="btn primary mt8" style={{ width: "100%" }} onClick={() => topoLinkSave(from, to, type, label)}>✓ 添加关系</button>
  </>;
}

/* —— 新增网络域 —— */
export function NetAddPanel() {
  const [f, setF] = useState({ id: "", name: "", cidr: "", biz: "", ctrl: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const customs = DB.networks.filter((n) => n.custom);
  return <>
    <h3 className="hl-cyan" style={{ fontSize: "14px", marginBottom: "10px" }}>新增网络域</h3>
    <div className="hint mb14">新增域将进入拓扑网格、CMDB 基线与资产归属选项（演示为内存态，刷新还原）。</div>
    <div className="f-row"><label className="f-label">域标识 ID（如 LAN-D）</label><input className="f-input" value={f.id} onChange={set("id")} placeholder="LAN-D" /></div>
    <div className="f-row"><label className="f-label">域名称</label><input className="f-input" value={f.name} onChange={set("name")} placeholder="如 备份区" /></div>
    <div className="f-row"><label className="f-label">CIDR</label><input className="f-input" value={f.cidr} onChange={set("cidr")} placeholder="10.10.40.0/24" /></div>
    <div className="f-row"><label className="f-label">业务用途</label><input className="f-input" value={f.biz} onChange={set("biz")} placeholder="如 数据备份与归档" /></div>
    <div className="f-row"><label className="f-label">管控策略</label><input className="f-input" value={f.ctrl} onChange={set("ctrl")} placeholder="如 默认拒绝，仅备份流量" /></div>
    <button className="btn primary mt8" style={{ width: "100%" }} onClick={() => saveNet(f)}>✓ 保存并重新布局</button>
    {customs.length ? <div className="mt14"><div className="f-label">手动新增的域</div>
      {customs.map((n) => <div key={n.id} className="flow-box" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="mono">{n.id} {n.name}</span><button className="btn sm danger" onClick={() => delNet(n.id)}>✕ 删除</button>
      </div>)}
    </div> : null}
  </>;
}

/* —— 新增资产 / 安全设备 —— */
export function AssetAddPanel() {
  const [f, setF] = useState({ type: "Endpoint", net: DB.networks[0]?.id || "", id: "", ip: "", crit: "普通", svc: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return <>
    <h3 className="hl-cyan" style={{ fontSize: "14px", marginBottom: "10px" }}>新增资产 / 安全设备</h3>
    <div className="hint mb14">资产进入所属网络域的拓扑栅格；安全设备将以能力芯片形式注册到 Capability Registry。</div>
    <div className="f-row"><label className="f-label">对象类型</label>
      <select className="f-input" value={f.type} onChange={set("type")}>
        <option value="Endpoint">终端 Endpoint</option><option value="Server">服务器 Server</option>
        <option value="网络设备">网络设备</option><option value="安全设备">安全设备（EDR/FW/NAC…）</option>
        <option value="AI推理节点">AI 推理节点</option></select></div>
    <div className="f-row"><label className="f-label">所属网络域</label>
      <select className="f-input" value={f.net} onChange={set("net")}>{DB.networks.map((n) => <option key={n.id} value={n.id}>{n.id} {n.name}</option>)}</select></div>
    <div className="f-row"><label className="f-label">标识 ID</label><input className="f-input" value={f.id} onChange={set("id")} placeholder="如 RND-WS-77" /></div>
    <div className="f-row"><label className="f-label">IP 地址</label><input className="f-input" value={f.ip} onChange={set("ip")} placeholder="如 10.10.20.77" /></div>
    <div className="f-row"><label className="f-label">重要度</label>
      <select className="f-input" value={f.crit} onChange={set("crit")}><option>普通</option><option>中</option><option>高</option><option>关键</option></select></div>
    <div className="f-row"><label className="f-label">关键软件 / 服务</label><input className="f-input" value={f.svc} onChange={set("svc")} placeholder="如 备份客户端、EDR Agent" /></div>
    <button className="btn primary mt8" style={{ width: "100%" }} onClick={() => saveAsset(f)}>✓ 保存并进入拓扑</button>
  </>;
}

/* —— 网络域属性编辑 —— */
export function showNetPanel(id) {
  const n = DB.networks.find((x) => x.id === id); if (!n) return null;
  const dirtyK = _dirtyN(NET_ORIG[id], n);
  const F = (k, label) => <tr key={k}>
    <td className={"mono " + (dirtyK.includes(k) ? "hl-amber" : "faint")} style={{ fontSize: "10px" }}>{label}{dirtyK.includes(k) ? ' <改>' : ""}</td>
    <td><input className="pinput" defaultValue={n[k] == null ? "" : n[k]} onBlur={(e) => setNetProp(id, k, e.target.value)} /></td>
  </tr>;
  return <>
    <h3 className="mono hl-cyan" style={{ fontSize: "14px", marginBottom: "4px" }}>cd:NetworkDomain · {n.id}</h3>
    <div className="hint mb14">网络域属性（CMDB 基线）· 点击拓扑域标题即可编辑</div>
    <div style={{ border: "1px solid var(--border)", borderRadius: "9px", padding: "10px", background: "var(--panel)" }}>
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span className="hint">{dirtyK.length ? <span className="hl-amber">{dirtyK.length} 项已修改</span> : "域属性与拓扑/基线表联动"}</span>
        {dirtyK.length ? <button className="btn sm" onClick={() => resetNet(id)}>↺ 恢复初始值</button> : null}
      </div>
      <table>{F("name", "name（域名称）")}{F("cidr", "cidr")}{F("gw", "gateway")}{F("biz", "业务定位")}{F("ctrl", "管控策略")}</table>
      <div className="hint" style={{ marginTop: "8px" }}>生产环境网络域变更须经 CMDB 变更流程；本演示为内存态即时生效。</div>
    </div>
    <div className="hint mt14">{DB.assets.filter((a) => a.net === id).length} 个纳管资产 · {DB.devices.filter((d) => d.net === id).length} 类安全设备 · rdf:type cd:NetworkDomain</div>
    {n.custom ? <button className="btn sm danger mt14" style={{ width: "100%" }} onClick={() => delNet(id)}>✕ 删除该域（手动新增）</button> : null}
  </>;
}

/* —— 资产属性编辑 —— */
export function showAssetPanel(id) {
  const a = DB.assets.find((x) => x.id === id); if (!a) return null;
  const devs = DB.devices.filter((d) => d.net === a.net);
  const mission = DB.missions.find((m) => m.asset === id);
  const dirtyK = _dirtyN(ASSET_ORIG[id], a);
  const F = (k, label) => <tr key={k}>
    <td className={"mono " + (dirtyK.includes(k) ? "hl-amber" : "faint")} style={{ fontSize: "10px" }}>{label}{dirtyK.includes(k) ? " <改>" : ""}</td>
    <td><input className="pinput" defaultValue={a[k] == null ? "" : a[k]} onBlur={(e) => setAssetProp(id, k, e.target.value)} /></td>
  </tr>;
  const SEL = (k, label, opts) => <tr key={k}>
    <td className={"mono " + (dirtyK.includes(k) ? "hl-amber" : "faint")} style={{ fontSize: "10px" }}>{label}{dirtyK.includes(k) ? " <改>" : ""}</td>
    <td><select className="pinput" value={a[k]} onChange={(e) => setAssetProp(id, k, e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select></td>
  </tr>;
  return <>
    <h3 style={{ fontSize: "14px", marginBottom: "4px" }} className="mono hl-cyan">asset:{a.id}</h3>
    <div className="hint mb14">Canonical Entity · Entity Resolution 统一标识（CMDB/EDR/NDR 多源合一）· 属性可直接编辑</div>
    <div className="kv"><span className="k">asset_id</span><span className="v mono">{a.id}{a.custom ? " · 手动新增（✎）" : ""}</span></div>
    <div style={{ border: "1px solid var(--border)", borderRadius: "9px", padding: "10px", background: "var(--panel)", marginTop: "10px" }}>
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span className="hint">资产属性（CMDB 基线）{dirtyK.length ? <> · <span className="hl-amber">{dirtyK.length} 项已修改</span></> : null}</span>
        {dirtyK.length ? <button className="btn sm" onClick={() => resetAsset(id)}>↺ 恢复初始值</button> : null}
      </div>
      <table>
        {F("ip", "ip")}{SEL("type", "type", ["Server", "Endpoint", "AI推理节点", "堡垒机", "网络设备", "安全设备"])}
        {F("os", "os")}{F("svc", "svc / 业务服务")}
        {SEL("crit", "criticality", ["普通", "高", "关键"])}
        {SEL("net", "belongsTo", DB.networks.map((n) => n.id))}
        {F("mgr", "managedBy")}{F("owner", "user_owner")}{SEL("health", "health", ["ONLINE", "OFFLINE"])}
      </table>
      <div className="hint" style={{ marginTop: "8px" }}>属性变更即时生效（拓扑、资产基线表、能力视图联动重绘）并记入审计日志；生产环境须经 CMDB 变更流程同步。</div>
    </div>
    {mission ? <div className="kv mt14"><span className="k">hosts→supports</span><span className="v">{mission.svc} → <b className="hl-amber">{mission.id}</b><br /><span className="faint">{mission.policy}</span></span></div> : null}
    <h3 style={{ fontSize: "12px", margin: "16px 0 8px" }}>现场可用能力（provides）</h3>
    {devs.map((d) => <div key={d.id} className="flow-box" style={{ marginBottom: "8px" }}><b className="mono">{d.id}</b> <span className="faint">{d.net}</span><br />{d.caps.map((c) => <span key={c} className="chip">{c}</span>)}</div>)}
    <div className="hint mt14">数据来源：CMDB / EDR / IAM 每日同步 + 事件驱动增量 · 实体解析置信度 0.98</div>
    {a.custom ? <button className="btn sm danger mt14" style={{ width: "100%" }} onClick={() => delAsset(a.id)}>✕ 删除该资产（手动新增）</button> : null}
  </>;
}

/* =====================================================================
   任务编排侧栏
   ===================================================================== */

export function TaskFields({ t, others, locked }) {
  const [f, setF] = useState({
    tpl: t.tpl, target: t.target, check: t.check,
    exec: t.exec, net: t.net, expire: t.expire, hitl: t.hitl, pre: [...t.pre],
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const D = locked ? "disabled" : "";
  const devs = [...new Set([...DB.devices.map((d) => d.id), "AD/IAM-01", "Effect Verification", "人工操作员"])];
  const nets = [...new Set([...(SC().execNets || []), "LAN-A", "LAN-B", "LAN-C", "INFRA", "SEC-MGMT"])];
  const togglePre = (id) => setF({ ...f, pre: f.pre.includes(id) ? f.pre.filter((x) => x !== id) : [...f.pre, id] });
  return <>
    {(() => { /* 挂到实例上供提交按钮读取 */
      t._form = f;
      return null;
    })()}
    <div className="f-row"><label className="f-label">ActionTemplate（标准动作注册表）</label>
      <select className="f-input" value={f.tpl} disabled={locked} onChange={set("tpl")}>
        {tplCatalog().map((o) => <option key={o.id} value={o.id}>{o.id}（{o.tgt} · {o.dev}）</option>)}
      </select></div>
    <div className="f-row"><label className="f-label">目标 target</label><input className="f-input" value={f.target} disabled={locked} onChange={set("target")} /></div>
    <div className="f-row"><label className="f-label">效果检查 check</label><input className="f-input" value={f.check} disabled={locked} onChange={set("check")} /></div>
    <div className="grid g2" style={{ gap: "8px" }}>
      <div className="f-row"><label className="f-label">执行端 exec</label>
        <select className="f-input" value={f.exec} disabled={locked} onChange={set("exec")}>{devs.map((d) => <option key={d}>{d}</option>)}</select></div>
      <div className="f-row"><label className="f-label">network_scope</label>
        <select className="f-input" value={f.net} disabled={locked} onChange={set("net")}>{nets.map((n) => <option key={n}>{n}</option>)}</select></div>
    </div>
    <div className="grid g2" style={{ gap: "8px" }}>
      <div className="f-row"><label className="f-label">过期时间 expire（分钟）</label>
        <input className="f-input" type="number" min="5" max="240" value={f.expire} disabled={locked} onChange={set("expire")} /></div>
      <div className="f-row"><label className="f-label">人工介入 HITL</label>
        <select className="f-input" value={f.hitl} disabled={locked} onChange={set("hitl")}>
          <option value="auto">⚙ 全自动执行</option>
          <option value="confirm">☑ 执行前需人工确认</option>
          <option value="manual">✋ 纯人工操作步骤</option>
        </select></div>
    </div>
    <div className="hint" style={{ marginBottom: "10px" }}>confirm：执行到该任务时<b className="hl-amber">暂停</b>，等待指挥员确认后继续；manual：由人工现场执行，平台负责下发指令、记录证据与校验结果。</div>
    <div className="f-row"><label className="f-label">前置依赖（全部完成后本任务才可执行）</label>
      <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "6px", maxHeight: "150px", overflow: "auto", background: "var(--panel)" }}>
        {others.length ? others.map((o) => (
          <label key={o.id} className="ckline">
            <input type="checkbox" checked={f.pre.includes(o.id)} disabled={locked} onChange={() => togglePre(o.id)} />
            <span className="mono hl-cyan" style={{ width: "26px" }}>{o.id}</span> <span className="mono" style={{ fontSize: "10.5px" }}>{o.tpl}</span>
          </label>
        )) : <div className="hint" style={{ padding: "4px" }}>（暂无其他任务）</div>}
      </div></div>
  </>;
}

export function showTaskPanel(id) {
  const s = S(); const t = s.tasks.find((x) => x.id === id); if (!t) return null;
  const locked = s.dispatched;
  return <>
    <h3 className="hl-cyan" style={{ fontSize: "14px", marginBottom: "6px" }}>任务 {t.id} · {t.tpl}</h3>
    <div className="hint mb14">{locked ? "已签名分发：任务锁定为只读，修改需「撤回分发」重新编排（变更将重新走审批校验）" : `编排 v${s.tasksVer} · 保存后升版并记入审计日志`}</div>
    <TaskFields t={t} others={s.tasks.filter((x) => x.id !== id)} locked={locked} />
    {!locked ? (
      <div className="flex mt10" style={{ gap: "8px" }}>
        <button className="btn primary" style={{ flex: 1 }} onClick={() => taskSave(t.id, t._form)}>💾 保存修改</button>
        <button className="btn danger" onClick={() => taskDel(t.id)}>🗑 删除</button>
      </div>
    ) : (
      <div className="flow-box" style={{ borderColor: "rgba(167,139,250,.35)" }}><b className="hl-purple">§15 人工介入原则：</b>已签名的任务包不可静默修改。如需调整，请撤回分发重新编排，或通过执行期的人工确认/跳过进行受控介入。</div>
    )}
    {t.status === "WAITING" ? (
      <div className="flow-box mt10" style={{ borderColor: "rgba(251,191,36,.5)" }}>
        <b className="hl-amber">⏸ 该任务正在等待人工介入</b>
        <div className="flex mt8" style={{ gap: "8px", flexWrap: "wrap" }}>
          {t.hitl === "confirm" ? <button className="btn sm primary" onClick={() => taskConfirm(t.id)}>☑ 确认继续执行</button> : null}
          {t.hitl === "manual" ? <button className="btn sm primary" onClick={() => taskDone(t.id)}>✓ 人工操作已完成</button> : null}
          <button className="btn sm" onClick={() => taskSkip(t.id)}>跳过此任务</button>
        </div>
      </div>
    ) : null}
  </>;
}

export function TaskAddPanel() {
  const s = S();
  const nid = nextTaskId();
  const t = { tpl: "increase_monitoring", target: "", check: "", exec: DB.devices[0]?.id || "EDR-B", net: (SC().execNets || ["LAN-B"])[0], expire: 30, hitl: "auto", pre: [], status: "PENDING" };
  return <>
    <h3 className="hl-cyan" style={{ fontSize: "14px", marginBottom: "6px" }}>添加任务 {nid}</h3>
    <div className="hint mb14">从标准 ActionTemplate 注册表选择（与工具网关词汇表一致，无 LLM 自由文本），或添加人工操作步骤。</div>
    <TaskFields t={t} others={s.tasks} locked={false} />
    <div className="flex mt10" style={{ gap: "8px" }}>
      <button className="btn primary" style={{ flex: 1 }} onClick={() => taskCreate(nid, t._form)}>＋ 创建任务 {nid}</button>
    </div>
  </>;
}

/* =====================================================================
   本体建模侧栏
   ===================================================================== */

export function showCQPanel(q) {
  return <>
    <h3 className={"mono " + (q.status === "ok" ? "hl-cyan" : q.status === "partial" ? "hl-amber" : "hl-red")} style={{ fontSize: "14px", marginBottom: "10px" }}>{q.id} · {q.rank}</h3>
    <div className="hint mb14" style={{ fontSize: "12.5px", color: "var(--text)" }}>{q.q}</div>
    <div className="kv"><span className="k">状态</span><span className="v">
      {q.status === "ok" ? <span className="badge b-green">✓ 可回答</span> : q.status === "partial" ? <span className="badge b-amber">⚠ 部分可回答</span> : <span className="badge b-red">✗ 缺口</span>}
      {q.note ? <div className="hint" style={{ marginTop: "4px" }}>{q.note}</div> : null}
    </span></div>
    <div className="kv"><span className="k">所需类</span><span className="v">{q.classes.map((c) => <span key={c} className="chip" style={{ cursor: "pointer" }} title="查看类定义" onClick={() => kgInfo(c)}>{c}</span>)}</span></div>
    <div className="kv"><span className="k">所需属性</span><span className="v mono" style={{ fontSize: "11px" }}>{q.rels.join(", ") || "—（待补充）"}</span></div>
    <div className="kv"><span className="k">测试查询</span><span className="v mono" style={{ fontSize: "10.5px" }}>{q.test}</span></div>
    <div className="hint mt14">该 CQ 是所列类与属性的<b>存在理由</b>：评审新增模型元素时，若无法回溯到任何 CQ 将被打回。CQ 回放测试在「构建流程与评估」运行。</div>
    <button className="btn sm primary mt14" style={{ width: "100%" }} onClick={() => showCQFocus(q.id)}>◎ 在关系图中定位首个类</button>
  </>;
}
function showCQFocus(id) { cqFocusRef(id); }
import { cqFocus as cqFocusRef } from "../actions/knowledge.js";

/* —— 本体构建向导 —— */
export function OntoWizPanel() {
  useApp();
  const w = state.wiz; if (!w) return null;
  const d = w.d;
  const dots = WIZ_STEPS.map((s, i) => <span key={s} className={"badge " + (i === w.step ? "b-cyan" : i < w.step ? "b-green" : "b-gray")}>{s}</span>);
  const bind = (k) => ({ value: d[k], onChange: (e) => { d[k] = e.target.value; notify(); } });
  let body;
  if (w.step === 0) {
    body = <>
      <div className="f-row"><label className="f-label">类名（英文 PascalCase）</label><input className="f-input" {...bind("name")} placeholder="如 Vulnerability" /></div>
      <div className="f-row"><label className="f-label">中文含义</label><input className="f-input" {...bind("cn")} placeholder="如 漏洞" /></div>
      <div className="f-row"><label className="f-label">关键属性（§19.2，逗号分隔）</label><input className="f-input" {...bind("props")} placeholder="cve_id, cvss, affected_product" /></div>
      <div className="f-row"><label className="f-label">典型实例</label><input className="f-input" {...bind("inst")} placeholder="如 CVE-2026-1234" /></div>
    </>;
  } else if (w.step === 1) {
    body = <>
      <div className="f-row"><label className="f-label">父类 subClassOf（必选：新增类必须挂入类层次）</label>
        <select className="f-input" value={d.parent} onChange={(e) => { d.parent = e.target.value; }}>
          <option value="">（顶层类）</option>
          {ONTO.classes.filter((c) => cst(c) === "published").map((c) => <option key={c.name}>{c.name}</option>)}
        </select></div>
      <div className="hint">永久类别建子类（如 Endpoint ⊑ Asset）；若该类是某种“角色/上下文”，应改用关系表达而不是建子类 —— Ontology 101 原则④。子类继承父类的 domain/range 约束。</div>
    </>;
  } else if (w.step === 2) {
    body = <>
      <div className="f-row"><label className="f-label">该类能回答哪些能力问题？（至少 1 个，否则评审将打回）</label>
        <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "6px", maxHeight: "220px", overflow: "auto", background: "var(--panel)" }}>
          {ONTO_CQS.map((q) => (
            <label key={q.id} className="ckline">
              <input type="checkbox" checked={d.cqs.includes(q.id)} onChange={() => { d.cqs = d.cqs.includes(q.id) ? d.cqs.filter((x) => x !== q.id) : [...d.cqs, q.id]; }} />
              <span className={"mono " + (q.status === "ok" ? "hl-cyan" : q.status === "partial" ? "hl-amber" : "hl-red")} style={{ width: "44px" }}>{q.id}</span> <span style={{ fontSize: "11px" }}>{q.q.slice(0, 26)}…</span>
            </label>
          ))}
        </div></div>
      <div className="f-row"><label className="f-label">补充说明（无合适 CQ 时必填，说明业务场景）</label><input className="f-input" {...bind("note")} placeholder="（可选）" /></div>
    </>;
  } else if (w.step === 3) {
    body = <>
      <div className="f-row"><label className="f-label">外部词汇对齐（Reuse before build）</label>
        <select className="f-input" value={d.ext} onChange={(e) => { d.ext = e.target.value; }}>
          {["—（无对应标准词汇）", "STIX 2.1 vulnerability", "STIX 2.1 malware", "STIX 2.1 indicator", "STIX 2.1 infrastructure", "STIX 2.1 tool", "STIX 2.1 identity", "STIX 2.1 course-of-action", "ATT&CK（attack:）", "D3FEND（d3f:）"].map((x) => <option key={x}>{x}</option>)}
        </select></div>
      <div className="f-row"><label className="f-label">复用方式</label>
        <select className="f-input" value={d.how} onChange={(e) => { d.how = e.target.value; }}>
          {["复用", "复用+扩展", "扩展", "新建"].map((x) => <option key={x}>{x}</option>)}
        </select></div>
      <div className="f-row"><label className="f-label">对齐理由</label><input className="f-input" {...bind("why")} placeholder="为什么选择该复用方式" /></div>
    </>;
  } else {
    body = <>
      <div className="kv"><span className="k">类名</span><span className="v mono hl-cyan">{d.name}（{d.cn}）</span></div>
      <div className="kv"><span className="k">父类</span><span className="v mono">{d.parent || "（顶层类）"}</span></div>
      <div className="kv"><span className="k">关键属性</span><span className="v mono" style={{ fontSize: "10.5px" }}>{d.props || "—"}</span></div>
      <div className="kv"><span className="k">回溯 CQ</span><span className="v">{d.cqs.map((x) => <span key={x} className="chip">{x}</span>) || "—"}</span></div>
      <div className="kv"><span className="k">外部对齐</span><span className="v" style={{ fontSize: "11px" }}>{d.ext} · {d.how}</span></div>
      <div className="flow-box mt10" style={{ borderColor: "rgba(251,191,36,.4)" }}><b className="hl-amber">提交后进入「评审中」状态</b>：类出现在核心类管理与关系图中（压暗显示），但不实例化；安全专家评审通过后转为「已发布」并启用。</div>
    </>;
  }
  return <>
    <h3 className="hl-cyan" style={{ fontSize: "14px", marginBottom: "6px" }}>本体构建向导 · 新建类</h3>
    <div className="mb14" style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>{dots}</div>
    {body}
    <div className="flex mt14" style={{ gap: "8px" }}>
      {w.step > 0 ? <button className="btn" onClick={() => wizBack()}>← 上一步</button> : null}
      {w.step < 4 ? <button className="btn primary" style={{ flex: 1 }} onClick={() => wizNext()}>下一步 →</button> : <button className="btn primary" style={{ flex: 1 }} onClick={() => wizSubmit()}>✓ 提交评审</button>}
    </div>
    <div className="hint mt8">向导按 Ontology 101 流程引导：任何一步都可返回修改；提交 = 草稿转评审，不直接发布。</div>
  </>;
}

/* —— 画布添加本体关系表单 —— */
export function showOntoRelForm(from, to) { sidePanel(<OntoRelFormPanel from={from} to={to} />); }
function OntoRelFormPanel({ from, to }) {
  const [name, setName] = useState("");
  const [use, setUse] = useState("");
  return <>
    <h3 className="hl-cyan" style={{ fontSize: "14px", marginBottom: "10px" }}>添加本体关系</h3>
    <div className="hint mb14">在关系图上从 <span className="mono hl-cyan">{from}</span> 连向 <span className="mono hl-cyan">{to}</span> · 保存后写入关系字典（ONTO.relations），随 Schema 一起用于实例化与一致性检查，图中以琥珀色标出。</div>
    <div className="f-row"><label className="f-label">关系名（小驼峰英文，如 dependsOn）</label><input className="f-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="relatedTo" /></div>
    <div className="f-row"><label className="f-label">业务语义（这条关系回答什么问题）</label><input className="f-input" value={use} onChange={(e) => setUse(e.target.value)} placeholder="如 备份服务依赖该存储" /></div>
    <button className="btn primary mt8" style={{ width: "100%" }} onClick={() => ontoRelSave(from, to, name, use)}>✓ 添加关系</button>
  </>;
}

/* —— 快速新增类 / 关系 / CQ 表单 —— */
export function AddClassQuickPanel() {
  const [f, setF] = useState({ name: "", cn: "", parent: "" });
  return <>
    <div className="input-add">
      <input placeholder="类名（英文 PascalCase，如 Vulnerability）" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input placeholder="中文含义" value={f.cn} onChange={(e) => setF({ ...f, cn: e.target.value })} />
      <select style={{ maxWidth: "150px" }} value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value })}>
        <option value="">（顶层类）</option>{ONTO.classes.map((c) => <option key={c.name}>{c.name}</option>)}
      </select>
      <button className="btn sm" onClick={() => addClass(f)}>+ 快速新增（直接提交评审）</button>
    </div>
  </>;
}
export function AddRelQuickPanel() {
  const [f, setF] = useState({ name: "", from: ONTO.classes[0]?.name || "", to: ONTO.classes[0]?.name || "" });
  return <>
    <div className="input-add">
      <input placeholder="关系名（如 dependsOn）" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <select value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}>{ONTO.classes.map((c) => <option key={c.name}>{c.name}</option>)}</select>
      <select value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}>{ONTO.classes.map((c) => <option key={c.name}>{c.name}</option>)}</select>
      <button className="btn sm primary" onClick={() => addRel(f)}>+ 新增</button>
    </div>
  </>;
}
export function AddCQQuickPanel() {
  const [f, setF] = useState({ q: "", cls: "" });
  return <>
    <div className="input-add">
      <input placeholder="新的能力问题（业务语言，如「某终端失联 30 分钟应触发什么？」）" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      <input placeholder="涉及类（逗号分隔，如 Asset,Policy）" style={{ maxWidth: "240px" }} value={f.cls} onChange={(e) => setF({ ...f, cls: e.target.value })} />
      <button className="btn sm primary" onClick={() => addCQ(f)}>+ 新增 CQ</button>
    </div>
  </>;
}

/* —— 类定义（kgInfo） —— */
export function kgInfoPanel(name) {
  const c = ONTO.classes.find((x) => x.name === name);
  const insts = SC() ? kgAll().nodes.filter((n) => n.cls === name) : [];
  const align = ONTO_ALIGN_LIST.find((a) => a.cls === name);
  const cqs = ONTO_CQS.filter((q) => q.classes.includes(name));
  return <>
    <h3 className="mono hl-cyan" style={{ fontSize: "14px", marginBottom: "10px" }}>cd:{name}</h3>
    {c ? <>
      <div className="kv"><span className="k">中文含义</span><span className="v">{c.cn}</span></div>
      <div className="kv"><span className="k">父类 subClassOf</span><span className="v mono">{c.parent ? `${c.parent}（继承其 domain/range 约束）` : "—（顶层类）"}</span></div>
      <div className="kv"><span className="k">关键属性</span><span className="v mono" style={{ fontSize: "10.5px" }}>{c.props}</span></div>
      <div className="kv"><span className="k">典型实例</span><span className="v mono">{c.inst}</span></div>
      <div className="kv"><span className="k">类型</span><span className="v">{c.core ? "核心类（一期基线）" : "自定义类（业务扩展，评审前不实例化）"}</span></div>
      {align ? <div className="kv"><span className="k">外部对齐</span><span className="v" style={{ fontSize: "11px" }}>{align.ext}<br />
        <span className={"badge " + (align.how === "复用" ? "b-green" : align.how === "新建" ? "b-amber" : "b-cyan")}>{align.how}</span> <span className="faint">{align.why}</span></span></div> : null}
      <div className="kv"><span className="k">覆盖能力问题</span><span className="v">{cqs.length ? cqs.map((q) => <span key={q.id} className="chip" style={{ cursor: "pointer" }} title="查看 CQ" onClick={() => showCQ(q.id)}>{q.id}</span>) : <span className="hl-amber">⚠ 无 CQ 回溯 —— 评审需说明存在理由</span>}</span></div>
    </> : null}
    <div className="kv"><span className="k">关联关系</span><span className="v">{ONTO.relations.filter((r) => r.on && (r.from === name || r.to === name)).map((r) => <div key={r.name}>{r.from} —{r.name}→ {r.to}</div>) || "—"}</span></div>
    <div className="kv"><span className="k">本事件实例</span><span className="v">{insts.length ? insts.map((n) => <span key={n.id} className="chip" style={{ cursor: "pointer" }} title="在图谱中查看" onClick={() => kgGotoInst(n.id)}>{n.l}</span>) : <span className="faint">当前事件暂无实例（Schema 保留）</span>}</span></div>
    <div className="hint mt14">本体是 Schema 定义，知识图谱是它的实例化（rdf:type 绑定）；点击上方实例标签可跳转「知识图谱」页聚焦该实例。每个类/关系都应对应一个明确业务问题（能力问题驱动）；新增对象需经安全专家评审后进入 Schema 发布流程。</div>
  </>;
}
import { ONTO_ALIGN as ONTO_ALIGN_LIST } from "../core/data.js";

/* =====================================================================
   知识图谱侧栏
   ===================================================================== */

export function KgWizPanel() {
  useApp();
  const w = state.kgWiz; if (!w) return null;
  const d = w.d;
  const dots = KGW_STEPS.map((s, i) => <span key={s} className={"badge " + (i === w.step ? "b-cyan" : i < w.step ? "b-green" : "b-gray")}>{s}</span>);
  let body;
  if (w.step === 0) {
    const avail = ONTO.classes.filter((c) => cst(c) === "published" && c.on);
    body = <>
      <div className="f-row"><label className="f-label">选择实例的 Schema 类（rdf:type · 仅已发布且启用的类可实例化）</label>
        <div style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "8px", maxHeight: "260px", overflow: "auto", background: "var(--panel)", display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {avail.map((c) => (
            <span key={c.name} className={"chip " + (d.cls === c.name ? "chip-on" : "")} style={{ cursor: "pointer", padding: "5px 10px" }} onClick={() => kgWizPickCls(c.name)}>
              {c.name}<span className="faint" style={{ marginLeft: "4px" }}>{c.cn}</span>
            </span>
          ))}
        </div></div>
      {d.cls ? <div className="hint">已选 <span className="mono hl-cyan">cd:{d.cls}</span> · 入图层 <span className={"badge " + ["b-red", "b-amber", "b-cyan", "b-purple"][KG_LAYER_OF[d.cls] ?? 2]}>{KG_LAYER[KG_LAYER_OF[d.cls] ?? 2].t}</span> · 覆盖 CQ：{ONTO_CQS.filter((q) => q.classes.includes(d.cls)).map((q) => q.id).join(" / ") || "—（该类无 CQ 回溯，入图时仅提示）"}</div> : null}
    </>;
  } else if (w.step === 1) {
    const bind = (k) => ({ value: d[k], onChange: (e) => { d[k] = e.target.value; notify(); } });
    body = <>
      <div className="f-row"><label className="f-label">实例标识（唯一，如 RND-WS-77 / SUSP-PROC-09）</label><input className="f-input" {...bind("label")} placeholder="实例在图中的名字" /></div>
      <div className="f-row"><label className="f-label">一句话说明</label><input className="f-input" {...bind("sub")} placeholder="如 研判发现的可疑备份服务器（CMDB 未登记）" /></div>
      <div className="f-row"><label className="f-label">强标识（asset_code / objectGUID / device_guid）</label><input className="f-input" {...bind("strong")} placeholder="如 CMDB-ASSET-009977" /></div>
      <div className="f-row"><label className="f-label">关键属性（每行一个 key=value）</label><textarea className="f-input" rows="4" value={d.attrs} onChange={(e) => { d.attrs = e.target.value; notify(); }} placeholder={"ip=10.10.20.77\nos=Rocky Linux 9\ncriticality=高"} /></div>
      <div className="hint">强标识优先：后续 Entity Resolution 会按强标识与多源数据合并，避免重复实体；IP/主机名仅作弱标识辅助。</div>
    </>;
  } else if (w.step === 2) {
    const rels = ONTO.relations.filter((r) => cst(r) === "published" && r.on);
    const tgts = kgAll().nodes;
    body = <>
      <div className="hint mb14">可选：让新实例入图即与现有实体挂接（后续也可在「手动构建」标签页追加）。</div>
      <div className="f-row"><label className="f-label">方向</label>
        <select className="f-input" value={d.relDir} onChange={(e) => { d.relDir = e.target.value; }}>
          <option value="out">本实例 → 目标</option><option value="in">目标 → 本实例</option>
        </select></div>
      <div className="f-row"><label className="f-label">关系（对象属性）</label>
        <select className="f-input" value={d.rel} onChange={(e) => { d.rel = e.target.value; }}>
          <option value="">（不挂接）</option>
          {rels.map((r) => <option key={r.name} value={r.name}>{r.name}（{r.from} → {r.to}）</option>)}
        </select></div>
      <div className="f-row"><label className="f-label">目标实例</label>
        <select className="f-input" value={d.target} onChange={(e) => { d.target = e.target.value; }}>
          {tgts.map((n) => <option key={n.id} value={n.id}>{n.l}（{n.cls}）</option>)}
        </select></div>
    </>;
  } else {
    const attrs = kgWizParseAttrs(d.attrs);
    const cqs = ONTO_CQS.filter((q) => q.classes.includes(d.cls));
    const checks = [
      ["ok", `类 cd:${d.cls} 已发布且启用（可实例化）`],
      [d.label ? "ok" : "err", d.label ? `实例标识「${d.label}」未与现有 ${kgAll().nodes.length} 个节点冲突` : "实例标识为空（返回上一步填写）"],
      [d.strong ? "ok" : "warn", d.strong ? "强标识已声明：" + d.strong : "未声明强标识：实体解析将无法自动合并，建议补充"],
      [cqs.length ? "ok" : "warn", cqs.length ? `类有 CQ 回溯：${cqs.map((q) => q.id).join(" / ")}` : "该类无 CQ 回溯（不阻断入图，但评审时会质询）"],
      [attrs.bad === 0 ? "ok" : "err", `属性解析：${attrs.list.length} 项有效${attrs.bad ? `，${attrs.bad} 行格式错误` : ""}`],
      [d.rel ? "ok" : "info", d.rel ? `关系挂接：${d.relDir === "out" ? d.label + " —" + d.rel + "→ " + d.target : d.target + " —" + d.rel + "→ " + d.label}` : "不挂接关系（入图后为孤立节点）"],
    ];
    body = <>
      <div className="flow-box" style={{ borderColor: "rgba(52,211,153,.35)", marginBottom: "10px" }}>
        <b className="hl-green">入图前校验</b>
        {checks.map(([c, t], i) => <div key={i} className={c === "ok" ? "hl-green" : c === "warn" ? "hl-amber" : c === "err" ? "hl-red" : "muted"} style={{ fontSize: "11.5px", marginTop: "6px" }}>{c === "ok" ? "✓" : c === "warn" ? "⚠" : c === "err" ? "✕" : "·"} {t}</div>)}
      </div>
      <div className="hint">入图后实例带 <b className="hl-amber">待核验</b> 标记（琥珀虚线环），由安全专家在「手动构建」标签页核验后转正；演示为内存态，刷新还原。</div>
    </>;
  }
  return <>
    <h3 className="hl-cyan" style={{ fontSize: "14px", marginBottom: "6px" }}>实例构建向导 · 人工入图</h3>
    <div className="mb14" style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>{dots}</div>
    {body}
    <div className="flex mt14" style={{ gap: "8px" }}>
      {w.step > 0 ? <button className="btn" onClick={() => kgWizBack()}>← 上一步</button> : null}
      {w.step < 3 ? <button className="btn primary" style={{ flex: 1 }} onClick={() => kgWizNext()}>下一步 →</button> : <button className="btn primary" style={{ flex: 1 }} onClick={() => kgWizSubmit()}>✓ 校验通过，提交入图</button>}
    </div>
    <div className="hint mt8">生产环境实例写入需经 Knowledge Service 固定 API 并触发实体解析；本向导演示人工构建的完整流程与校验点。</div>
  </>;
}

/* —— 追加人工关系 —— */
export function KgCustomRelPanel() {
  const tgts = kgAll().nodes;
  const rels = ONTO.relations.filter((r) => cst(r) === "published" && r.on);
  const [from, setFrom] = useState(tgts[0]?.id || "");
  const [rel, setRel] = useState(rels[0]?.name || "");
  const [to, setTo] = useState(tgts[1]?.id || tgts[0]?.id || "");
  return <>
    <h3 className="hl-cyan" style={{ fontSize: "14px", marginBottom: "10px" }}>追加人工关系</h3>
    <div className="hint mb14">在任意两个图中实体间补一条关系（琥珀虚线，待核验）；用于研判中发现的未建模连接。</div>
    <div className="f-row"><label className="f-label">起点</label><select className="f-input" value={from} onChange={(e) => setFrom(e.target.value)}>{tgts.map((n) => <option key={n.id} value={n.id}>{n.l}（{n.cls}）</option>)}</select></div>
    <div className="f-row"><label className="f-label">关系</label><select className="f-input" value={rel} onChange={(e) => setRel(e.target.value)}>{rels.map((r) => <option key={r.name} value={r.name}>{r.name}（{r.from} → {r.to}）</option>)}</select></div>
    <div className="f-row"><label className="f-label">终点</label><select className="f-input" value={to} onChange={(e) => setTo(e.target.value)}>{tgts.map((n) => <option key={n.id} value={n.id}>{n.l}（{n.cls}）</option>)}</select></div>
    <button className="btn primary mt8" style={{ width: "100%" }} onClick={() => kgCustomRelSave(from, rel, to)}>✓ 添加关系</button>
    {!state.kgCustom.nodes.length ? <div className="hint mt8">提示：尚无人工构建实例，可先通过「✚ 构建实例」向导创建。</div> : null}
  </>;
}

/* —— 图谱节点详情（含属性编辑） —— */
export function kgNodePanel(id) {
  const rel = {
    [INC().id]: `status=${stageOf(state.activeInc) >= 8 ? "CONTAINED" : "处置中"} · contains ${INC().events.length} 个 SecurityEvent · evidence_ref 已存证（SHA-256）`,
    [INC().net.split(" / ")[0]]: "NetworkDomain · cidr/网关/安全等级来自 CMDB 硬事实",
    evi: "Evidence（evi: 证据空间）· 原始日志/告警引用与哈希，不把日志全文入图；由各 SecurityEvent 经 derivedFrom 指向",
  };
  const n = kgAll().nodes.find((x) => x.id === id);
  const oc = n && ONTO.classes.find((c) => c.name === n.cls);
  const props = n ? kgGetProps(id) : [];
  const dirtyN = props.filter((p) => p.dirty).length;
  return <>
    <h3 className="mono hl-cyan" style={{ fontSize: "13px", marginBottom: "10px" }}>{id}</h3>
    {n ? <>
      <div className="kv"><span className="k">rdf:type</span><span className="v mono hl-cyan">cd:{n.cls}</span></div>
      {n.custom ? <div className="kv"><span className="k">来源</span><span className="v">{n.verified ? <span className="badge b-green">人工构建 · 已核验</span> : <span className="badge b-amber pulse">人工构建 · 待核验</span>} <span className="faint" style={{ fontSize: "10px" }}>（构建向导 · {n.id}）</span></span></div> : null}
      <div className="kv"><span className="k">类定义</span><span className="v">{oc ? oc.cn + " · " : ""}{oc ? <span className="link" onClick={() => gotoOnto(n.cls)}>在本体建模中查看 Schema →</span> : "（自定义对象，未入核心 Schema）"}</span></div>
    </> : null}
    <KgPropsTable id={id} props={props} dirtyN={dirtyN} />
    <div className="flow-box mt10">{rel[id] || "explain_relation：来源系统、更新时间、证据/规则来源均可追溯。实线关系=CMDB/设备/IAM 硬事实；紫虚线=AI 推断（mappedTo，保存 confidence/evidence/model_version）；绿虚线=D3FEND 推导（relatedDefense，标记 mapping_source=D3FEND_INFERRED）。"}</div>
    <div className="mt14 flex" style={{ gap: "8px", flexWrap: "wrap" }}>
      {state.kgFocus !== id ? <button className="btn sm primary" onClick={() => kgFocusNode(id)}>◎ 聚焦此节点</button>
        : <><button className="btn sm" onClick={() => kgMode(null)}>▣ 返回整图</button><button className="btn sm" onClick={() => kgHopsT()}>⊕ {state.kgHops === 1 ? "扩展二度关系" : "收缩为一度"}</button></>}
      {n && n.custom && !n.verified ? <button className="btn sm green" onClick={() => { kgVerify(id); closePanel(); }}>✓ 核验转正</button> : null}
      {n && n.custom ? <button className="btn sm danger" onClick={() => { kgCustomDelNode(id); closePanel(); }}>🗑 删除实例</button> : null}
    </div>
    <div className="hint mt14">本图谱为本体（CyberDefenseOntology 1.0）的实例化视图，每个节点都绑定了 Schema 类（rdf:type）；类与关系的定义见「本体建模」，数据入图流程见「图谱构建」。拖拽节点可整理布局，滚轮缩放。</div>
  </>;
}

function KgPropsTable({ id, props, dirtyN }) {
  const [pk, setPk] = useState("");
  const [pv, setPv] = useState("");
  return <div className="mt10" style={{ border: "1px solid var(--border)", borderRadius: "9px", padding: "10px", background: "var(--panel)" }}>
    <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
      <span className="hint">实体属性 · §19.2 关键属性{dirtyN ? <> · <span className="hl-amber">{dirtyN} 项已修改</span></> : null}</span>
      <button className="btn sm" onClick={() => kgResetProps(id)}>↺ 恢复初始值</button>
    </div>
    <table><tr><th style={{ width: "34%" }}>属性</th><th>值</th><th style={{ width: "26px" }}></th></tr>
      {props.map((p) => <tr key={p.k}>
        <td className={"mono " + (p.dirty ? "hl-amber" : "faint")} style={{ fontSize: "10px" }}>{p.k}{p.dirty ? " <改>" : ""}</td>
        <td><input className="pinput" defaultValue={p.v} onBlur={(e) => kgSetProp(id, p.k, e.target.value)} /></td>
        <td><span style={{ cursor: "pointer", color: "var(--red)", fontSize: "11px" }} title="删除属性" onClick={() => kgDelProp(id, p.k)}>✕</span></td>
      </tr>)}
      <tr>
        <td><input className="pinput" value={pk} onChange={(e) => setPk(e.target.value)} placeholder="新增属性名" /></td>
        <td><input className="pinput" value={pv} onChange={(e) => setPv(e.target.value)} placeholder="属性值" /></td>
        <td><button className="btn sm primary" title="添加属性" onClick={() => { kgAddProp(id, pk, pv); setPk(""); setPv(""); }}>+</button></td>
      </tr>
    </table>
    <div className="hint" style={{ marginTop: "8px" }}>属性变更即时生效并记入审计日志（系统治理可见）；生产环境属性写入需经 Knowledge Service 固定 API，禁止直接改图。</div>
  </div>;
}

/* =====================================================================
   知识库侧栏
   ===================================================================== */

function KbField({ kind, id, k, label, val, dirty, opts }) {
  if (opts) return <tr>
    <td className={"mono " + (dirty ? "hl-amber" : "faint")} style={{ fontSize: "10px" }}>{label}{dirty ? " <改>" : ""}</td>
    <td><select className="pinput" value={val} onChange={(e) => _kbSet(kind, id, k, e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select></td>
  </tr>;
  return <tr>
    <td className={"mono " + (dirty ? "hl-amber" : "faint")} style={{ fontSize: "10px" }}>{label}{dirty ? " <改>" : ""}</td>
    <td><input className="pinput" defaultValue={val} onBlur={(e) => _kbSet(kind, id, k, e.target.value)} /></td>
  </tr>;
}

export function showAtkPanel(id) {
  const t = DB.attackKB.find((x) => x.id === id); if (!t) return null;
  const dirty = _kbDirty("atk", id);
  return <>
    <h3 className="mono hl-red" style={{ fontSize: "14px", marginBottom: "4px" }}>attack:{t.id}</h3>
    <div className="hint mb14">{t.custom ? "本地新增知识（可删除）" : "ATT&CK v19.2 标准条目 · 编辑产生本地覆写（待专家复核）"}</div>
    <div className="kv"><span className="k">external_id</span><span className="v mono">{t.id}</span></div>
    <div className="kv"><span className="k">状态</span><span className="v">{t.custom ? <span className="badge b-purple">本地新增</span> : t._ovr ? <span className="badge b-amber pulse">覆写·待复核</span> : t._ok ? <span className="badge b-green">已复核</span> : <span className="badge b-gray">标准条目</span>}</span></div>
    <div style={{ border: "1px solid var(--border)", borderRadius: "9px", padding: "10px", background: "var(--panel)", marginTop: "10px" }}>
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span className="hint">知识属性{dirty.length ? <> · <span className="hl-amber">{dirty.length} 项本地覆写</span></> : null}</span>
        {dirty.length ? <button className="btn sm" onClick={() => kbReset("atk", id)}>↺ 恢复标准值</button> : null}
      </div>
      <table>
        <KbField kind="atk" id={id} k="name" label="name" val={t.name} dirty={dirty.includes("name")} />
        <KbField kind="atk" id={id} k="type" label="type" val={t.type} dirty={dirty.includes("type")} opts={["Technique", "Sub-technique"]} />
        <KbField kind="atk" id={id} k="parent" label="parent / tactic" val={t.parent} dirty={dirty.includes("parent")} />
        <KbField kind="atk" id={id} k="platform" label="platform" val={t.platform} dirty={dirty.includes("platform")} />
        <KbField kind="atk" id={id} k="mitigation" label="mitigation" val={t.mitigation} dirty={dirty.includes("mitigation")} />
        <KbField kind="atk" id={id} k="det" label="detection_ref" val={t.det} dirty={dirty.includes("det")} />
      </table>
      <div className="f-label" style={{ marginTop: "10px" }}>D3FEND 候选（点击切换关联，流入知识图谱 relatedDefense 边）</div>
      <div className="mt8" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {DB.d3fendKB.map((d) => (
          <span key={d.id} className={"chip " + (t.d3fend.includes(d.id) ? "chip-on" : "")} style={{ cursor: "pointer" }} onClick={() => toggleAtkD3(id, d.id)}>{d.id}</span>
        ))}
      </div>
      <div className="hint" style={{ marginTop: "8px" }}>变更即时生效并记入审计日志；对标准条目的修改须经专家复核后正式入图（§15.2）。</div>
    </div>
    {t.custom
      ? <button className="btn sm danger mt14" style={{ width: "100%" }} onClick={() => delAtk(id)}>✕ 删除该本地技术</button>
      : <div className="hint mt14">标准条目不可删除，只能随版本包升级或本地覆写。</div>}
  </>;
}

export function showD3fPanel(id) {
  const d = DB.d3fendKB.find((x) => x.id === id); if (!d) return null;
  const dirty = _kbDirty("d3f", id);
  return <>
    <h3 className="mono hl-purple" style={{ fontSize: "14px", marginBottom: "4px" }}>d3f:{d.id}</h3>
    <div className="hint mb14">{d.custom ? "本地新增映射（可删除）" : "D3FEND v1.6.0 + Local Mapping · 编辑产生本地覆写（待专家复核）"}</div>
    <div className="kv"><span className="k">external_id</span><span className="v mono">{d.id}</span></div>
    <div className="kv"><span className="k">状态</span><span className="v">{d.custom ? <span className="badge b-purple">本地新增</span> : d._ovr ? <span className="badge b-amber pulse">覆写·待复核</span> : d._ok ? <span className="badge b-green">已复核</span> : <span className="badge b-gray">标准条目</span>}</span></div>
    <div style={{ border: "1px solid var(--border)", borderRadius: "9px", padding: "10px", background: "var(--panel)", marginTop: "10px" }}>
      <div className="flex" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span className="hint">映射属性{dirty.length ? <> · <span className="hl-amber">{dirty.length} 项本地覆写</span></> : null}</span>
        {dirty.length ? <button className="btn sm" onClick={() => kbReset("d3f", id)}>↺ 恢复标准值</button> : null}
      </div>
      <table>
        <KbField kind="d3f" id={id} k="name" label="name" val={d.name} dirty={dirty.includes("name")} />
        <KbField kind="d3f" id={id} k="cat" label="战术类" val={d.cat} dirty={dirty.includes("cat")} opts={["Detect", "Harden", "Isolate", "Evict"]} />
        <KbField kind="d3f" id={id} k="impl" label="现场实现方式" val={d.impl} dirty={dirty.includes("impl")} />
        <KbField kind="d3f" id={id} k="action" label="ActionTemplate" val={d.action} dirty={dirty.includes("action")} />
        <KbField kind="d3f" id={id} k="product" label="最终设备" val={d.product} dirty={dirty.includes("product")} />
      </table>
      <div className="hint" style={{ marginTop: "8px" }}>Local Mapping 是 D3FEND 推导关系到现场可执行动作的桥梁；修改会流入知识图谱的 realizedBy 链路。</div>
    </div>
    {d.custom
      ? <button className="btn sm danger mt14" style={{ width: "100%" }} onClick={() => delD3f(id)}>✕ 删除该本地映射</button>
      : <div className="hint mt14">标准映射不可删除，只能本地覆写。</div>}
  </>;
}

export function AtkAddPanel() {
  const [f, setF] = useState({ id: "", name: "", type: "Sub-technique", parent: "", platform: "", mit: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return <>
    <h3 className="hl-cyan" style={{ fontSize: "14px", marginBottom: "10px" }}>新增攻击技术（本地知识）</h3>
    <div className="hint mb14">本地新增条目标记 custom，立即入库可被引用；正式纳入标准需随版本包评审。</div>
    <div className="f-row"><label className="f-label">技术 ID（如 T1218.011）</label><input className="f-input" value={f.id} onChange={set("id")} placeholder="T1218.011" /></div>
    <div className="f-row"><label className="f-label">名称</label><input className="f-input" value={f.name} onChange={set("name")} placeholder="Signed Binary Proxy Execution: Rundll32" /></div>
    <div className="f-row"><label className="f-label">类型</label><select className="f-input" value={f.type} onChange={set("type")}><option>Sub-technique</option><option>Technique</option></select></div>
    <div className="f-row"><label className="f-label">父技术 / 战术</label><input className="f-input" value={f.parent} onChange={set("parent")} placeholder="T1218 · Defense Evasion" /></div>
    <div className="f-row"><label className="f-label">平台</label><input className="f-input" value={f.platform} onChange={set("platform")} placeholder="Windows" /></div>
    <div className="f-row"><label className="f-label">Mitigation 参考</label><input className="f-input" value={f.mit} onChange={set("mit")} placeholder="M1038 / M1040" /></div>
    <button className="btn primary mt8" style={{ width: "100%" }} onClick={() => saveAtk(f)}>✓ 保存并入库</button>
  </>;
}

export function D3fAddPanel() {
  const [f, setF] = useState({ id: "", name: "", cat: "Harden", impl: "", action: "", product: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return <>
    <h3 className="hl-cyan" style={{ fontSize: "14px", marginBottom: "10px" }}>新增防御映射（本地知识）</h3>
    <div className="hint mb14">新增 D3FEND→现场能力映射，标记 custom 立即入库；可被攻击技术的候选关联引用。</div>
    <div className="f-row"><label className="f-label">D3FEND ID（如 D3-CH）</label><input className="f-input" value={f.id} onChange={set("id")} placeholder="D3-CH" /></div>
    <div className="f-row"><label className="f-label">防御技术名称</label><input className="f-input" value={f.name} onChange={set("name")} placeholder="Credential Hardening" /></div>
    <div className="f-row"><label className="f-label">战术类</label><select className="f-input" value={f.cat} onChange={set("cat")}><option>Harden</option><option>Detect</option><option>Isolate</option><option>Evict</option></select></div>
    <div className="f-row"><label className="f-label">现场实现方式</label><input className="f-input" value={f.impl} onChange={set("impl")} placeholder="IAM 策略：凭证加固与轮换" /></div>
    <div className="f-row"><label className="f-label">ActionTemplate</label><input className="f-input" value={f.action} onChange={set("action")} placeholder="harden_credential" /></div>
    <div className="f-row"><label className="f-label">最终设备</label><input className="f-input" value={f.product} onChange={set("product")} placeholder="IAM" /></div>
    <button className="btn primary mt8" style={{ width: "100%" }} onClick={() => saveD3f(f)}>✓ 保存并入库</button>
  </>;
}

/* =====================================================================
   案例库侧栏
   ===================================================================== */

export function showCasePanel(id) {
  const c = DB.cases.find((x) => x.id === id); if (!c) return null;
  return <CasePanel c={c} />;
}

function CasePanel({ c }) {
  const sim = caseSim(c);
  const [lesson, setLesson] = useState(c.lesson || "");
  const [verdict, setVerdict] = useState("有效遏制");
  const [recommend, setRecommend] = useState(true);
  return <>
    <h3 className="mono hl-cyan" style={{ fontSize: "14px", marginBottom: "4px" }}>{c.id}</h3>
    <div className="hint mb14">案例档案 · 沉淀于 {c.date} · 点击技术标签可跳转知识库</div>
    <div className="kv"><span className="k">案例标题</span><span className="v"><b>{c.title}</b></span></div>
    <div className="kv"><span className="k">处置结果</span><span className="v"><StatusBadge s={c.result} /> <span className={"badge " + (c.tag === "可推荐案例" ? "b-green" : c.tag === "待专家复盘" ? "b-amber" : "b-gray")}>{c.tag}</span></span></div>
    <div className="kv"><span className="k">被引用次数</span><span className="v mono">{c.reuse} 次（Planning 相似检索）</span></div>
    {sim && sim.score ? <div className="kv"><span className="k">与当前事件</span><span className="v">相似度 <b className="hl-cyan mono">{sim.score.toFixed(2)}</b>{sim.ov.length ? <> · 技术命中：<span className="mono hl-amber">{sim.ov.join(" ")}</span></> : " · 语义召回（技术不重叠）"}</span></div> : null}
    <h3 style={{ fontSize: "12px", margin: "14px 0 8px" }}>攻击技术（点击查看知识库定义）</h3>
    <div className="flex" style={{ gap: "6px", flexWrap: "wrap" }}>{c.techs.map((t) => <span key={t} className={"chip " + (DB.attackKB.find((k) => k.id === t) ? "chip-on" : "")} style={{ cursor: "pointer" }} onClick={() => showAtk(t)}>{t}</span>)}</div>
    <h3 style={{ fontSize: "12px", margin: "14px 0 8px" }}>处置时间线</h3>
    {(c.timeline || []).map(([tm, act], i) => <div key={i} className="flex" style={{ gap: "10px", padding: "5px 0", borderBottom: "1px dashed rgba(31,47,79,.6)" }}><span className="mono faint" style={{ fontSize: "10.5px", width: "52px", flexShrink: 0 }}>{tm}</span><span style={{ fontSize: "11.5px" }}>{act}</span></div>) || <div className="hint">（自动沉淀案例，时间线见关联事件处置过程）</div>}
    <h3 style={{ fontSize: "12px", margin: "14px 0 8px" }}>策略与复盘</h3>
    <div className="flow-box">{c.summary}</div>
    {c.review ? <>
      <h3 style={{ fontSize: "12px", margin: "14px 0 8px" }}>复盘记录 <span className="sub">{c.review.by} · {c.review.at}</span></h3>
      <div className="kv"><span className="k">复盘结论</span><span className="v"><span className={"badge " + (c.review.verdict === "有效遏制" ? "b-green" : c.review.verdict === "部分有效" ? "b-amber" : "b-red")}>{c.review.verdict}</span></span></div>
      <div className="kv"><span className="k">推荐状态</span><span className="v">{c.review.recommend ? <span className="badge b-green">已进入 Planning 推荐池</span> : <span className="badge b-gray">未推荐（仅档案留存）</span>}</span></div>
      <div className="f-row mt8"><label className="f-label">复盘要点（可继续修订，修订将记入审计）</label>
        <textarea className="f-input" style={{ minHeight: "70px", resize: "vertical" }} defaultValue={c.lesson || ""} onBlur={(e) => { setLesson(e.target.value); caseLessonSet(c.id, e.target.value); }} /></div>
      <button className="btn sm mt8" onClick={() => caseReopen(c.id)}>↩ 撤销复盘 · 重新复盘</button>
    </> : <>
      <h3 style={{ fontSize: "12px", margin: "14px 0 8px" }}>专家复盘确认 <span className="sub">Human Review · §15.2 知识更新需人工审核</span></h3>
      <div className="flow-box" style={{ borderColor: "rgba(251,191,36,.4)" }}>本案例处于<b className="hl-amber">待复盘</b>状态：复盘通过前仅作一般检索参考。请核对处置时间线、效果验证与人工介入点后提交复盘结论。</div>
      <div className="f-row mt8"><label className="f-label">复盘要点 lesson（将沉淀为案例知识）</label>
        <textarea className="f-input" style={{ minHeight: "70px", resize: "vertical" }} value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="如：该策略在同类场景可复用；某环节建议优化…" /></div>
      <div className="f-row"><label className="f-label">处置有效性结论</label>
        <select className="f-input" value={verdict} onChange={(e) => setVerdict(e.target.value)}>
          <option value="有效遏制">有效遏制（目标达成 · 业务无损）</option>
          <option value="部分有效">部分有效（存在改进空间）</option>
          <option value="无效-需改进">无效-需改进（策略需重新评估）</option>
        </select></div>
      <label className="ckline" style={{ marginBottom: "10px" }}><input type="checkbox" checked={recommend} onChange={(e) => setRecommend(e.target.checked)} /> <span>标记为「可推荐案例」——进入 Planning 相似检索推荐池</span></label>
      <button className="btn primary" style={{ width: "100%" }} onClick={() => caseReview(c.id, { lesson, verdict, recommend })}>✓ 提交复盘结论（安全专家·李清源）</button>
    </>}
    {c.incId && SCEN_MAP[c.incId] ? <button className="btn sm mt14" onClick={() => { switchInc(c.incId); closePanel(); }}>查看关联事件（{c.incId}）处置过程 →</button> : null}
    <div className="hint mt14">相似度 = 语义召回基础 + 攻击技术重叠（§15.1 向量召回 + 图关系过滤）；案例仅作 Planning 参考，不直接复用历史方案。</div>
  </>;
}
import { caseSim as caseSimRef } from "../actions/knowledge.js";
