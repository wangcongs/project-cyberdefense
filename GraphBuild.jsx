/* =====================================================================
   页面：图谱构建（数据源接入 · 实体解析 · Mapping · 四层数据模型）
   ===================================================================== */
import { useState } from "react";
import { state, useApp } from "../core/store.js";
import { GRAPH } from "../core/data.js";
import { Console } from "../ui/common.jsx";
import { syncSource, syncAllSources, runER } from "../actions/knowledge.js";

/* 机制开关（演示用纯视觉开关） */
function MechSwitch() {
  const [on, setOn] = useState(true);
  return <span className={"switch " + (on ? "on" : "")} onClick={() => setOn(!on)}></span>;
}

export default function GraphBuild() {
  useApp();
  const g = GRAPH, er = g.erDemo;
  const totalN = g.sources.reduce((a, s) => a + s.nodes, 0), totalE = g.sources.reduce((a, s) => a + s.edges, 0);

  return <>
    <div className="grid g4 mb14">
      <div className="kpi c-cyan"><div className="k-label">图数据库节点</div><div className="k-val">{totalN}</div><div className="k-foot">{g.sources.length} 个数据源汇入</div></div>
      <div className="kpi c-green"><div className="k-label">图数据库边</div><div className="k-val">{totalE}</div><div className="k-foot">含动态边（TTL 24h）</div></div>
      <div className="kpi c-blue"><div className="k-label">实体解析</div><div className="k-val">142</div><div className="k-foot">canonical 实体 · 平均置信度 0.95</div></div>
      <div className="kpi c-amber"><div className="k-label">知识版本</div><div className="k-val" style={{ fontSize: "16px" }}>v19.2 / v1.6.0</div><div className="k-foot">影子图回归通过后切换 active</div></div>
    </div>

    <div className="card mb14">
      <h3>数据源接入与同步 <span className="sub">点击「同步」执行增量入图（模拟）</span>
        <span className="spacer"></span>
        <button className="btn sm primary" onClick={() => syncAllSources()}>⇄ 一键全量同步</button>
      </h3>
      <div className="grid g4">
        {g.sources.map((s, i) => (
          <div key={s.name} className="src-card">
            <div className="sc-head"><span className={"dot " + (s.status === "done" ? "g" : "gray")}></span><span className="sc-name">{s.name}</span></div>
            <div className="hint">{s.detail}</div>
            <div className="sc-stats"><span>节点 {s.nodes}</span><span>边 {s.edges}</span></div>
            <div className="flex mt8" style={{ justifyContent: "space-between" }}>
              <span className="faint" style={{ fontSize: "10px" }}>{s.weight}</span>
              <button className={"sync-btn " + (s.status === "syncing" ? "syncing" : s.status === "done" ? "done" : "")} onClick={() => syncSource(i)}>
                {s.status === "done" ? "✓ 已同步" : s.status === "syncing" ? "同步中…" : "同步"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt14">
        <Console lines={state.graphSyncLog} maxH={200} placeholder="// 同步日志：数据源 → Mapping → Entity Resolution → 入图（影子空间）→ 一致性检查 → 发布" />
      </div>
    </div>

    <div className="grid g2 mb14">
      <div className="card">
        <h3>Entity Resolution 实体解析演示 <span className="sub">强标识优先 · 弱标识辅助 · 网络域约束</span></h3>
        <div className="grid" style={{ gridTemplateColumns: "1fr 40px 1fr", gap: "8px", alignItems: "center" }}>
          <div>
            <div className="hint" style={{ marginBottom: "8px" }}>多源标识输入（同一现实对象）</div>
            {er.inputs.map((x, i) => (
              <div key={i} className="flow-box" style={{ marginBottom: "6px" }}><span className="tag">{x.src}</span> <span className="mono">{x.id}</span></div>
            ))}
          </div>
          <div className="er-arrow">➜</div>
          <div>
            <div className="hint" style={{ marginBottom: "8px" }}>规范实体（Canonical Entity）</div>
            <div className="flow-box" style={{ borderColor: "rgba(34,211,238,.4)" }}>
              <span className="mono hl-cyan" style={{ fontSize: "14px" }}>{er.result}</span><br />
              <span className="hl-green">置信度 {er.confidence}</span> · 保留全部 alias 与来源
            </div>
            <button className="btn sm primary mt14" onClick={() => runER()}>▶ 执行实体解析</button>
          </div>
        </div>
        <div className="mt14">
          <Console lines={state.uiLogs.er} maxH={150} placeholder="// 演示：IP、主机名漂移不会创建新资产，先经强标识合并" />
        </div>
      </div>
      <div className="card">
        <h3>数据源 → 图谱 Mapping <span className="sub">§20.2</span></h3>
        <div style={{ maxHeight: "360px", overflowY: "auto" }}>
          <table><tbody>
            <tr><th>数据源</th><th>源字段</th><th>规范节点/边</th><th>说明</th></tr>
            {g.mapping.map((m, i) => (
              <tr key={i}>
                <td className="mono hl-cyan">{m.src}</td>
                <td className="mono faint" style={{ fontSize: "10px" }}>{m.fields}</td>
                <td className="mono" style={{ fontSize: "10.5px" }}>{m.target}</td>
                <td className="muted" style={{ fontSize: "10.5px" }}>{m.note}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </div>
    </div>

    <div className="grid g2">
      <div className="card">
        <h3>图谱更新与失效机制 <span className="sub">§20.5</span></h3>
        {[
          ["全量基线 + 增量事件", "CMDB/IAM 每日全量对账，设备事件驱动增量入图"],
          ["动态边 TTL", "Connection 边默认 24h 过期，历史通信不永久视为可达"],
          ["Capability 健康检查", "带 health / last_checked_at，规划与执行前重检（R-08）"],
          ["影子图版本切换", "ATT&CK/D3FEND 升级先入影子图，映射回归通过后切换 active_version"],
          ["AI 关系标记", "mappedTo 等 AI 生成边必须保存 confidence / evidence / model_version"],
        ].map(([t, d]) => (
          <div key={t} className="flex" style={{ padding: "8px 0", borderBottom: "1px dashed rgba(31,47,79,.6)" }}>
            <MechSwitch />
            <div><b style={{ fontSize: "12px" }}>{t}</b><div className="hint">{d}</div></div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>四层数据模型 <span className="sub">不把日志原文塞入图数据库</span></h3>
        <table><tbody>
          <tr><th>图谱层</th><th>主要节点</th><th>主要关系</th><th>更新频率</th></tr>
          <tr><td><span className="badge b-red">L1 标准知识</span></td><td className="muted" style={{ fontSize: "10.5px" }}>ATT&CK / D3FEND Technique</td><td className="faint" style={{ fontSize: "10.5px" }}>mapped / mitigates / detects</td><td className="faint">版本离线升级</td></tr>
          <tr><td><span className="badge b-cyan">L2 现场基础</span></td><td className="muted" style={{ fontSize: "10.5px" }}>NetworkDomain / Asset / Account / Service / Mission / SecurityProduct</td><td className="faint" style={{ fontSize: "10.5px" }}>belongsTo / hosts / supports / managedBy / provides</td><td className="faint">每日/事件驱动</td></tr>
          <tr><td><span className="badge b-amber">L3 动态态势</span></td><td className="muted" style={{ fontSize: "10.5px" }}>SecurityEvent / Incident / Evidence / Connection</td><td className="faint" style={{ fontSize: "10.5px" }}>affects / contains / usesAccount</td><td className="faint">分钟级/实时</td></tr>
          <tr><td><span className="badge b-purple">L4 决策执行</span></td><td className="muted" style={{ fontSize: "10.5px" }}>Capability / ActionTemplate / Plan / Task / ExecutionResult</td><td className="faint" style={{ fontSize: "10.5px" }}>realizedBy / targets / dependsOn / produces</td><td className="faint">生命周期更新</td></tr>
        </tbody></table>
        <div className="hint mt8">海量原始日志保存在日志/对象存储，图中只保存与决策有关的实体、关系和证据引用。研判中发现的未接入实体，可在「知识图谱」页通过「✚ 构建实例」向导人工入图（待核验）。</div>
      </div>
    </div>
  </>;
}
