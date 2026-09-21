/* =====================================================================
   页面：案例库（相似案例检索 · 专家复盘治理）
   ===================================================================== */
import { useApp, INC, SC } from "../core/store.js";
import { DB } from "../core/data.js";
import { StatusBadge } from "../ui/common.jsx";
import { caseSim, showCase } from "../actions/knowledge.js";

function CaseTag({ c }) {
  return c.tag === "可推荐案例" ? <span className="badge b-green">可推荐案例</span>
    : c.tag === "待专家复盘" ? <span className="badge b-amber">待专家复盘</span>
      : <span className="badge b-gray">已复盘</span>;
}

export default function Cases() {
  useApp();
  const ranked = DB.cases.map((c) => ({ c, s: (caseSim(c) || {}).score || 0 })).sort((a, b) => b.s - a.s);
  const top = ranked.slice(0, 3);
  const pend = DB.cases.filter((c) => c.tag === "待专家复盘");
  const doneN = DB.cases.filter((c) => c.tag === "已复盘").length;
  const recN = DB.cases.filter((c) => c.tag === "可推荐案例").length;

  return <>
    <div className="card mb14">
      <h3>相似案例检索 <span className="sub">事件摘要与复盘文本 Embedding · 向量召回 + 图关系过滤</span></h3>
      <div className="flow-box">当前事件上下文（{INC().id}）：
        <span className="mono hl-cyan">{SC().assessment.techniques.map((t) => t.id).join(" + ")} · {INC().net}</span> → 召回最相似案例：
        {top.map((x, i) => (
          <span key={x.c.id}><b className={i === 0 ? "hl-green" : "hl-cyan"}>{x.c.id}（{x.s.toFixed(2)}）</b>{i < top.length - 1 ? "、" : ""}</span>
        ))}。案例仅作 Planning 参考，方案仍按当前资产/能力/策略重新生成。</div>
    </div>

    <div className="card mb14">
      <h3>案例治理 <span className="sub">§15.2 · 案例知识经专家复盘后进入推荐池（人工审核的知识更新）</span></h3>
      <div className="flex mb14" style={{ gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <span className={"badge " + (pend.length ? "b-amber" : "b-green")}>待专家复盘 {pend.length}</span>
        <span className="badge b-gray">已复盘 {doneN}</span>
        <span className="badge b-green">可推荐案例 {recN}</span>
        <span className="hint">复盘通过并勾选推荐后，案例进入 Planning 相似检索推荐池；未复盘案例仅作一般参考。</span>
      </div>
      {pend.length ? (
        <div>{pend.map((c) => (
          <div key={c.id} className="flex" style={{ alignItems: "center", gap: "10px", padding: "6px 0", borderBottom: "1px dashed rgba(31,47,79,.6)" }}>
            <span className="mono hl-cyan" style={{ width: "104px", flexShrink: 0 }}>{c.id}</span>
            <span style={{ flex: 1, fontSize: "12px" }}>{c.title}</span>
            <button className="btn sm primary" onClick={() => showCase(c.id)}>🔍 开始专家复盘</button>
          </div>
        ))}</div>
      ) : (
        <div className="hint">✓ 当前没有待复盘案例。事件闭环沉淀的新案例将出现在此处等待专家确认。</div>
      )}
    </div>

    <div className="grid g2">
      {DB.cases.map((c) => {
        const sim = caseSim(c);
        return (
          <div key={c.id} className="card case-card" onClick={() => showCase(c.id)}>
            <div className="flex mb14">
              <span className="mono hl-cyan">{c.id}</span>
              <CaseTag c={c} />
              {sim && sim.score ? <span className="badge b-cyan" title="与当前事件相似度">相似 {sim.score.toFixed(2)}</span> : null}
              <span className="spacer"></span>
              <span className="faint mono" style={{ fontSize: "10px" }}>{c.date}</span>
            </div>
            <div style={{ fontWeight: 600, marginBottom: "8px" }}>{c.title}</div>
            <div className="hint" style={{ lineHeight: 1.8 }}>{c.summary}</div>
            <div className="flex mt8" style={{ gap: "6px", flexWrap: "wrap" }}>
              {c.techs.map((t) => <span key={t} className="chip">{t}</span>)}
              <span className="spacer"></span>
              <span className="badge b-cyan">被引用 {c.reuse} 次</span>
              <StatusBadge s={c.result} />
            </div>
            <div className="faint mt8" style={{ fontSize: "10.5px", textAlign: "right" }}>点击查看案例详情（时间线 · 复盘要点）→</div>
          </div>
        );
      })}
    </div>
  </>;
}
