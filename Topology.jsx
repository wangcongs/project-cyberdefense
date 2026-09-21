/* =====================================================================
   页面：网络拓扑（SVG 可视化 + 基线/设备/资产标签页）
   ===================================================================== */
import { state, activeIncs, stageOf, useApp } from "../core/store.js";
import { DB } from "../core/data.js";
import { SevBadge, StatusBadge, Tabs } from "../ui/common.jsx";
import { sidePanel } from "../core/utils.js";
import { setTab } from "../actions/system.js";
import { RPLAY, topoReplayToggle, topoLinkToggle, topoRelayout, envReset, showAsset } from "../actions/topology.js";
import { NetAddPanel, AssetAddPanel } from "../ui/panels.jsx";
import TopologySVG from "../viz/TopologySVG.jsx";
import { pzBtn, pzReset } from "../viz/panzoom.jsx";

export default function Topology() {
  useApp();
  const tab = state.tabs.topo || "viz";
  const linking = !!state.topoLinkPick, replay = !!(RPLAY && RPLAY.on);

  return <>
    <div className="flex mb14" style={{ gap: "8px", alignItems: "center" }}>
      <button className="btn primary sm" onClick={() => sidePanel(<NetAddPanel />)}>+ 新增网络域</button>
      <button className="btn sm" onClick={() => sidePanel(<AssetAddPanel />)}>+ 新增资产 / 安全设备</button>
      <button className="btn sm" onClick={() => envReset()}>↺ 恢复初始环境</button>
      <span className="hint">拓扑由 CMDB 资产基线数据驱动，新增对象即时进入布局（演示为内存态，刷新还原）</span>
    </div>

    <Tabs active={tab} onChange={(v) => setTab("topo", v)} tabs={[
      { id: "viz", label: "🗺 拓扑总览" },
      { id: "baseline", label: `跨网访问基线（${DB.accessBaseline.length}）` },
      { id: "devices", label: `安全设备能力（${DB.devices.length}）` },
      { id: "assets", label: `关键资产基线（${DB.assets.length}）` },
    ]} />

    {tab === "viz" ? (
      <div className="card mb14">
        <h3>虚拟多局域网安全实验环境 <span className="sub">点击资产 / 网络域可直接编辑属性 · 红色链路为当前活跃攻击路径（{activeIncs().filter((i) => stageOf(i.id) < 8).length} 条）</span></h3>
        <div style={{ background: "#050810", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px" }}>
          <div className="pz-bar">
            <button className={"btn sm " + (replay ? "primary" : "")} onClick={() => topoReplayToggle()}>{replay ? "■ 停止推演" : "▶ 攻击路径推演"}</button>
            <button className={"btn sm " + (linking ? "primary" : "")} onClick={() => topoLinkToggle()}>{linking ? "✕ 取消添加关系" : "🔗 添加关系"}</button>
            {linking ? (
              <span className={"badge " + (state.topoLinkPick.a ? "b-amber" : "b-cyan")}>
                {state.topoLinkPick.a ? `已选起点 ${state.topoLinkPick.a} · 点击目标资产` : "点击起点资产"}
              </span>
            ) : null}
            <button className="btn sm" onClick={() => topoRelayout()}>⊞ 自动重排</button>
            <button className="btn sm" onClick={() => pzBtn("topo-svg", 0.8)}>＋</button>
            <button className="btn sm" onClick={() => pzBtn("topo-svg", 1.25)}>－</button>
            <button className="btn sm" onClick={() => pzReset("topo-svg")}>⤢ 重置视图</button>
            <span className="pz-zoom-tag" id="topo-svg-zoom">100%</span>
            <span className="hint">拖拽节点自由布局 · 点击节点编辑属性 · 悬停高亮关系 · ▶ 推演逐跳回放攻击链</span>
          </div>
          <div className="pz-canvas" style={{ height: "640px" }}>
            <TopologySVG />
          </div>
        </div>
      </div>
    ) : tab === "baseline" ? (
      <div className="card">
        <h3>跨网访问基线 <span className="sub">进入 Knowledge Service 与 Decision Control</span></h3>
        <table><tbody>
          <tr><th>源域</th><th>目的域</th><th>策略</th><th>例外</th></tr>
          {DB.accessBaseline.map((a, i) => (
            <tr key={i}><td className="mono">{a.from}</td><td className="mono">{a.to}</td><td><StatusBadge s={a.policy} /></td><td className="muted" style={{ fontSize: "11px" }}>{a.note}</td></tr>
          ))}
        </tbody></table>
      </div>
    ) : tab === "devices" ? (
      <div className="card">
        <h3>安全设备能力 <span className="sub">Capability Registry（含健康状态）</span></h3>
        <table><tbody>
          <tr><th>设备</th><th>域</th><th>抽象能力</th><th>健康</th></tr>
          {DB.devices.map((d) => {
            const off = state.devicesOffline[d.id];
            return (
              <tr key={d.id}><td className="mono">{d.id}</td><td className="mono faint">{d.net}</td>
                <td className="muted" style={{ fontSize: "10.5px" }}>{d.caps.join(" / ")}</td>
                <td><StatusBadge s={off ? "UNAVAILABLE" : d.health} /></td></tr>
            );
          })}
        </tbody></table>
      </div>
    ) : (
      <div className="card">
        <h3>关键资产基线 <span className="sub">Entity Resolution 后的规范ID</span></h3>
        <table><tbody>
          <tr><th>资产</th><th>IP</th><th>重要度</th><th>状态</th></tr>
          {DB.assets.map((a) => {
            const iso = (stageOf("INC-20260918-01") >= 6 && a.id === "RND-WS-23") || (stageOf("INC-20260918-02") >= 6 && a.id === "RND-WS-61");
            return (
              <tr key={a.id} className="rowlink" onClick={() => showAsset(a.id)}>
                <td className="mono hl-cyan">{a.id}</td><td className="mono">{a.ip}</td>
                <td><SevBadge s={a.crit} /></td>
                <td>{iso ? <StatusBadge s="ISOLATED" /> : <StatusBadge s="ONLINE" />}</td>
              </tr>
            );
          })}
        </tbody></table>
      </div>
    )}
  </>;
}
