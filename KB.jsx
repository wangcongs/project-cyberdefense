/* =====================================================================
   页面：知识库（ATT&CK / D3FEND 离线知识 · 可维护）
   ===================================================================== */
import { useApp } from "../core/store.js";
import { DB } from "../core/data.js";
import { sidePanel } from "../core/utils.js";
import { showAtk, showD3f, kbReviewAll } from "../actions/knowledge.js";
import { AtkAddPanel, D3fAddPanel } from "../ui/panels.jsx";

function StT({ t }) {
  return t.custom ? <span className="badge b-purple">本地</span>
    : t._ovr ? <span className="badge b-amber pulse">覆写·待复核</span>
      : t._ok ? <span className="badge b-green">已复核</span>
        : <span className="badge b-gray">标准</span>;
}

export default function KB() {
  useApp();
  const pend = DB.attackKB.filter((t) => t._ovr).length + DB.d3fendKB.filter((d) => d._ovr).length;
  const custom = DB.attackKB.filter((t) => t.custom).length + DB.d3fendKB.filter((d) => d.custom).length;

  return <>
    <div className="grid g4 mb14">
      <div className="kpi c-cyan"><div className="k-label">ATT&amp;CK 版本</div><div className="k-val" style={{ fontSize: "18px" }}>v19.2</div><div className="k-foot">STIX 2.1 离线包 · SHA-256 已固化</div></div>
      <div className="kpi c-green"><div className="k-label">D3FEND 版本</div><div className="k-val" style={{ fontSize: "18px" }}>v1.6.0</div><div className="k-foot">TTL/JSON-LD + full mappings</div></div>
      <div className="kpi c-blue"><div className="k-label">攻击技术条目</div><div className="k-val" style={{ fontSize: "18px" }}>{DB.attackKB.length}</div><div className="k-foot">{DB.attackKB.filter((t) => !t.custom).length} 标准 + {DB.attackKB.filter((t) => t.custom).length} 本地新增</div></div>
      <div className="kpi c-amber"><div className="k-label">本地能力映射</div><div className="k-val" style={{ fontSize: "18px" }}>{DB.d3fendKB.length}</div>
        <div className="k-foot">D3FEND → Capability{pend ? <> · <span className="hl-amber">{pend} 条覆写待复核</span></> : custom ? " · 含本地新增" : ""}</div></div>
    </div>

    <div className="card mb14">
      <h3>ATT&amp;CK 攻击知识 <span className="sub">版本锁定 · 点击行维护 · 编辑产生本地覆写（待专家复核）</span>
        <button className="btn sm" onClick={() => sidePanel(<AtkAddPanel />)}>+ 新增攻击技术</button>
        {pend ? <button className="btn sm green" onClick={() => kbReviewAll()}>✓ 模拟专家复核通过（{pend}）</button> : null}
      </h3>
      <table><tbody>
        <tr><th>状态</th><th>ID</th><th>名称</th><th>类型/父技术</th><th>平台</th><th>Mitigation</th><th>检测参考</th><th>D3FEND 候选</th></tr>
        {DB.attackKB.map((t) => (
          <tr key={t.id} className="clickable" onClick={() => showAtk(t.id)}>
            <td><StT t={t} /></td>
            <td className="mono hl-red">{t.id}</td>
            <td>{t.name}</td>
            <td className="muted">{t.type} · {t.parent}</td>
            <td className="muted" style={{ fontSize: "11px" }}>{t.platform}</td>
            <td className="mono faint">{t.mitigation}</td>
            <td className="mono faint">{t.det || "—"}</td>
            <td>{t.d3fend.map((d) => (
              <span key={d} className="chip" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); showD3f(d); }}>{d}</span>
            ))}</td>
          </tr>
        ))}
      </tbody></table>
    </div>

    <div className="card mb14">
      <h3>D3FEND 防御知识 → 现场能力映射 <span className="sub">Local Mapping · 点击行维护 · 推导关系不代表可执行</span>
        <button className="btn sm" onClick={() => sidePanel(<D3fAddPanel />)}>+ 新增防御映射</button>
      </h3>
      <table><tbody>
        <tr><th>状态</th><th>D3FEND</th><th>防御技术</th><th>战术类</th><th>现场实现方式</th><th>ActionTemplate</th><th>最终设备</th></tr>
        {DB.d3fendKB.map((d) => (
          <tr key={d.id} className="clickable" onClick={() => showD3f(d.id)}>
            <td><StT t={d} /></td>
            <td className="mono hl-purple">{d.id}</td>
            <td>{d.name}</td>
            <td><span className="badge b-blue">{d.cat}</span></td>
            <td className="muted" style={{ fontSize: "11px" }}>{d.impl}</td>
            <td className="mono hl-cyan">{d.action}</td>
            <td className="mono faint">{d.product}</td>
          </tr>
        ))}
      </tbody></table>
    </div>

    <div className="card">
      <h3>知识维护与发布治理 <span className="sub">§15.2 / §20.5 · 知识更新走人工审核</span></h3>
      <div className="flex" style={{ gap: "8px", flexWrap: "wrap" }}>
        {["① 标准包版本锁定：ATT&CK/D3FEND 只随离线版本包升级（影子图回归后切换 active_version）",
          "② 本地覆写：对标准条目的编辑产生 override，标记 pending 专家复核后才生效入图",
          "③ 本地新增：自定义技术/映射立即入库，标记 custom，可随时删除",
          "④ 全程审计：所有增删改记入审计日志（系统治理可见）",
          "⑤ 图谱联动：维护结果实时流入知识图谱实例视图"].map((s) => (
          <div key={s} className="flow-box" style={{ flex: 1, minWidth: "200px" }}>{s}</div>
        ))}
      </div>
      <div className="hint mt14">标准知识离线发布流程：① 获取（官方仓库+SHA-256存证）→ ② 解析（影子知识空间导入）→ ③ 差异比较 → ④ 本地映射回归（专家复核）→ ⑤ 场景回归 → ⑥ 发布（active_version 切换，可回退）。历史事件可按原版本回放。</div>
    </div>
  </>;
}
