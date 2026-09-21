/* =====================================================================
   页面：知识图谱（本体实例化 · L1-L4 四层数据模型）
   ===================================================================== */
import { state, SC, INC, useApp } from "../core/store.js";
import { Tabs, CtxBar } from "../ui/common.jsx";
import { sidePanel } from "../core/utils.js";
import { setTab } from "../actions/system.js";
import {
  KG_LAYER, kgWizOpen, kgVerify, kgCustomDelNode, kgCustomDelEdge,
  kgMode, kgHopsT, kgToggleLabels, kgGotoInst,
} from "../actions/knowledge.js";
import { KgWizPanel, KgCustomRelPanel } from "../ui/panels.jsx";
import KgSVG from "../viz/KgSVG.jsx";
import { pzBtn, pzReset } from "../viz/panzoom.jsx";

export default function KG() {
  useApp();
  const tab = state.tabs.kg || "viz";

  if (!SC()) {
    return (
      <div className="card mb14">
        <h3>本体实例图谱</h3>
        <div className="hint">该事件为历史闭环案例，未保留场景级实例图谱数据；图谱实例仅对进行中的事件维护。</div>
      </div>
    );
  }

  return <>
    <CtxBar />
    <Tabs active={tab} onChange={(v) => setTab("kg", v)} tabs={[
      { id: "viz", label: "🗺 实例图谱" },
      { id: "custom", label: `✋ 手动构建（${state.kgCustom.nodes.length + state.kgCustom.edges.length}）` },
      { id: "api", label: "固定查询 API" },
      { id: "ns", label: "本体命名空间" },
      { id: "sync", label: "更新与一致性" },
    ]} />

    {tab === "viz" ? (
      <div className="card mb14">
        <h3>本体实例图谱 <span className="sub">{INC().id} · L1标准知识 / L2现场基础 / L3动态态势 / L4决策执行 · 力导向布局 · 拖拽节点 · 点击节点查看关系</span>
          <span className="spacer"></span>
          <button className="btn sm primary" onClick={() => { kgWizOpen(); sidePanel(<KgWizPanel />); }}>✚ 构建实例</button>
          <button className="btn sm" onClick={() => sidePanel(<KgCustomRelPanel />)}>🔗 追加关系</button>
        </h3>
        <div style={{ background: "#050810", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px" }}>
          <div className="pz-bar">
            <button className={"btn sm " + (!state.kgFocus ? "primary" : "")} onClick={() => kgMode(null)}>▣ 整图视图</button>
            {state.kgFocus ? <>
              <span className="badge b-cyan">聚焦 {state.kgFocus} · {state.kgHops} 度关系</span>
              <button className="btn sm" onClick={() => kgHopsT()}>⊕ {state.kgHops === 1 ? "扩展二度关系" : "收缩为一度"}</button>
              <button className="btn sm" onClick={() => kgMode(null)}>← 返回整图</button>
            </> : null}
            <button className={"btn sm " + (state.kgLabels ? "primary" : "")} onClick={() => kgToggleLabels()}>🏷 关系标签</button>
            <button className="btn sm" onClick={() => pzBtn("kg-svg", 0.8)}>＋</button>
            <button className="btn sm" onClick={() => pzBtn("kg-svg", 1.25)}>－</button>
            <button className="btn sm" onClick={() => pzReset("kg-svg")}>⤢ 重置</button>
            <span className="pz-zoom-tag" id="kg-svg-zoom">100%</span>
            <span className="spacer"></span>
            {KG_LAYER.map((l) => <span key={l.t} className="hint"><span className="dot" style={{ background: l.c }}></span>{l.t}</span>)}
            <span className="hint">实线=硬事实 · 紫虚线=AI推断(mappedTo) · 绿虚线=D3FEND推导(relatedDefense) · 琥珀虚线=人工构建（待核验）</span>
          </div>
          <div className="pz-canvas" style={{ height: "560px" }}>
            <KgSVG />
          </div>
        </div>
      </div>
    ) : tab === "api" ? (
      <div className="card">
        <h3>固定查询 API <span className="sub">不暴露任意 Cypher/SPARQL</span></h3>
        {["resolve_entity(ip/host/guid)", "get_asset_context(asset_id)", "get_incident_context(incident_id)", "get_attack_context(incident_id)", "get_mission_impact(asset/action)", "get_available_capabilities(target)", "get_defense_options(technique)", "find_similar_cases(context)"].map((x) => (
          <div key={x} className="flow-box" style={{ marginBottom: "6px" }}><span className="mono hl-cyan">{x}</span></div>
        ))}
      </div>
    ) : tab === "ns" ? (
      <div className="card">
        <h3>本体命名空间 <span className="sub">§19.1</span></h3>
        <table><tbody>
          <tr><th>前缀</th><th>内容</th></tr>
          <tr><td className="mono hl-cyan">cd:</td><td className="muted">本地网络防御本体（在「本体建模」维护）</td></tr>
          <tr><td className="mono hl-red">attack:</td><td className="muted">ATT&amp;CK 外部知识（Technique/Detection/Mitigation）</td></tr>
          <tr><td className="mono hl-purple">d3f:</td><td className="muted">D3FEND 外部知识（防御技术及推导关系）</td></tr>
          <tr><td className="mono hl-green">inst:</td><td className="muted">实例空间（{INC().id} 等现场实例）</td></tr>
          <tr><td className="mono hl-amber">evi:</td><td className="muted">证据空间（原始日志/告警引用与哈希）</td></tr>
        </tbody></table>
      </div>
    ) : tab === "custom" ? <>
      <div className="card mb14">
        <h3>手动构建管理 <span className="sub">构建向导 / 追加关系 入图的人工实例与关系 · 琥珀=待核验，专家核验后转正</span>
          <span className="spacer"></span>
          <button className="btn sm primary" onClick={() => { kgWizOpen(); sidePanel(<KgWizPanel />); }}>✚ 构建实例</button>
          <button className="btn sm" onClick={() => sidePanel(<KgCustomRelPanel />)}>🔗 追加关系</button>
        </h3>
        {state.kgCustom.nodes.length ? (
          <table><tbody>
            <tr><th>实例</th><th>rdf:type</th><th>入图层</th><th>说明</th><th>强标识</th><th>状态</th><th></th></tr>
            {state.kgCustom.nodes.map((n) => {
              const strong = (n.attrs || []).find((a) => a[0] === "strong_id");
              return (
                <tr key={n.id}>
                  <td className="mono hl-cyan" style={{ cursor: "pointer" }} title="在图谱中聚焦" onClick={() => kgGotoInst(n.id)}>{n.label}</td>
                  <td className="mono">{n.cls}</td>
                  <td><span className={"badge " + ["b-red", "b-amber", "b-cyan", "b-purple"][n.layer]}>{KG_LAYER[n.layer].t.split(" ")[0]}</span></td>
                  <td className="muted" style={{ fontSize: "11px" }}>{n.s}</td>
                  <td className="mono faint" style={{ fontSize: "10px" }}>{strong ? strong[1] : <span className="hl-amber">未声明</span>}</td>
                  <td>{n.verified ? <span className="badge b-green">已核验</span> : <span className="badge b-amber pulse">待核验</span>}</td>
                  <td className="flex" style={{ gap: "6px" }}>
                    {n.verified ? null : <button className="btn sm green" onClick={() => kgVerify(n.id)}>✓ 核验</button>}
                    <button className="btn sm danger" onClick={() => kgCustomDelNode(n.id)}>🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody></table>
        ) : (
          <div className="empty" style={{ padding: "24px" }}>暂无人工构建的实例<br /><span className="hint">研判中发现的未接入实体（如 CMDB 未登记的可疑主机），可通过「✚ 构建实例」向导人工入图</span></div>
        )}
      </div>
      <div className="card">
        <h3>人工关系 <span className="sub">研判中发现的未建模连接 · 琥珀虚线显示于实例图谱</span></h3>
        {state.kgCustom.edges.length ? (
          <table><tbody>
            <tr><th>起点</th><th>关系</th><th>终点</th><th></th></tr>
            {state.kgCustom.edges.map((e, i) => {
              const f = state.kgCustom.nodes.find((n) => n.id === e[0]) || { label: e[0] };
              const t = state.kgCustom.nodes.find((n) => n.id === e[1]) || { label: e[1] };
              return (
                <tr key={i}>
                  <td className="mono">{f.label || e[0]}</td>
                  <td className="mono hl-amber">{e[2]}</td>
                  <td className="mono">{t.label || e[1]}</td>
                  <td><button className="btn sm danger" onClick={() => kgCustomDelEdge(i)}>🗑 删除</button></td>
                </tr>
              );
            })}
          </tbody></table>
        ) : (
          <div className="hint" style={{ padding: "12px 0" }}>暂无人工关系 · 通过「🔗 追加关系」在任意两个图中实体间补一条连接</div>
        )}
      </div>
    </> : (
      <div className="card">
        <h3>图谱更新与一致性 <span className="sub">§20.5 · 详见「图谱构建」</span></h3>
        <div className="hint" style={{ lineHeight: 2 }}>
          · 基础数据「全量基线 + 增量事件」同步，IP 漂移先经 Entity Resolution<br />
          · 动态 Connection 边设 TTL，历史通信不永久视为可达<br />
          · Capability 带 health / last_checked_at，规划与执行前重检<br />
          · ATT&amp;CK/D3FEND 固定版本包，影子图回归后切换 active_version<br />
          · AI 生成的 mappedTo 必须保存 confidence / evidence / model_version
        </div>
      </div>
    )}
  </>;
}
