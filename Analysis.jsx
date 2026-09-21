/* =====================================================================
   页面：智能研判（Analysis Agent）
   ===================================================================== */
import { state, S, SC, INC, incEventCount, useApp } from "../core/store.js";
import { StatusBadge, CtxBar, Pipeline, Console } from "../ui/common.jsx";
import { go } from "../actions/system.js";
import { runAnalysis } from "../actions/pipeline.js";

export default function Analysis() {
  useApp();
  const s = S(), a = SC().assessment;
  const logLines = s.aLines || [];

  return <>
    {!state.llmOnline ? (
      <div className="degraded-banner">⚠ LLM 不可用 —— Analysis Agent 停用，当前为「{state.llmCfg.degrade === "playbook" ? "人工研判 + 固定 Playbook" : "纯人工处置"}」降级模式，不生成新研判结论。</div>
    ) : null}
    {!state.pipeCfg.analysis.aiOn ? (
      <div className="degraded-banner">⚙ AI 研判已被系统配置停用（系统治理→流程配置②）—— 「运行 AI 研判」将被策略拦截，事件只能走人工研判流程。</div>
    ) : null}
    {s.confLow ? (
      <div className="degraded-banner" style={{ borderColor: "rgba(251,191,36,.45)" }}>⚠ 本次研判置信度低于系统阈值 {state.pipeCfg.analysis.confThreshold}（流程配置②）—— AttackAssessment 已标记「强制人工复核」，请补充证据后再进入高影响处置。</div>
    ) : null}
    {a.confidence === "MEDIUM" ? (
      <div className="degraded-banner" style={{ borderColor: "rgba(251,191,36,.45)" }}>◐ 置信度 MEDIUM（§7.4 低置信度处理）：证据不足时不直接进入高影响处置 —— 输出「需要补充调查」请求（{a.missing.map((x, i) => <b key={i}>{x}{i < a.missing.length - 1 ? "、" : ""}</b>)}），优先增强监控与局部限制，待证据补齐后再提升处置强度。</div>
    ) : null}

    <CtxBar />
    <div className="card mb14"><h3>闭环进度 <span className="sub">{INC().id} · {INC().title}</span></h3><Pipeline stage={s.stage} /></div>

    <div className="grid g32">
      <div className="card">
        <h3>Analysis Agent 工作台 <span className="sub">唯一两处调用大模型的环节之一</span></h3>
        <div className="flow-box mb14"><b>处理流程：</b>① 规则完成 ATT&amp;CK 候选映射 → ② 调用 Knowledge Service 补齐资产/账户/业务上下文 → ③ 构建受控 Prompt（区分可信事实与不可信文本）→ ④ LLM 综合推理 → ⑤ 程序校验实体ID与证据引用真实存在。</div>
        <div className="flex mb14" style={{ gap: "8px" }}>
          <button className="btn primary" id="btn-analyze" onClick={() => runAnalysis()} disabled={!state.llmOnline || s.assessDone || s.aRunning}>
            {s.aRunning ? "◉ 研判中…" : "◉ 启动 AI 研判"}
          </button>
          {s.assessDone ? <span className="badge b-green">AttackAssessment 已生成并通过校验</span> : null}
        </div>
        <Console
          lines={logLines}
          placeholder={`// 等待启动研判…输入：${INC().id}（${incEventCount(state.activeInc)}条SecurityEvent + 知识图谱上下文）`}
        />
      </div>
      <div className="card">
        <h3>AttackAssessment 攻击研判结果 <span className="sub">结构化 Schema 输出</span></h3>
        {s.assessDone ? <>
          <div className="kv"><span className="k">summary</span><span className="v">{a.summary}</span></div>
          <div className="kv"><span className="k">hypotheses</span><span className="v">{a.hypotheses.map((h, i) => <div key={i}>{h.h} <StatusBadge s={h.conf} /></div>)}</span></div>
          <div className="kv"><span className="k">techniques</span><span className="v">
            {a.techniques.map((t) => (
              <div key={t.id} style={{ marginBottom: "6px" }}>
                <span className="mono hl-red">{t.id}</span> {t.name}<br />
                <span className="faint" style={{ fontSize: "10.5px" }}>{t.src} · 证据 {t.evi.join(", ")}</span>
              </div>
            ))}
          </span></div>
          <div className="kv"><span className="k">affected</span><span className="v">
            {a.affected_assets.map((x) => <span key={x} className="chip">{x}</span>)}<br />
            <span className="hl-amber" style={{ fontSize: "11px" }}>{a.affected_services.map((x, i) => <div key={i}>{x}</div>)}</span>
          </span></div>
          <div className="kv"><span className="k">confidence</span><span className="v">
            <span className={"badge " + (a.confidence.startsWith("HIGH") ? "b-green" : a.confidence.startsWith("MEDIUM") ? "b-amber" : "b-gray")}>{a.confidence}</span>
          </span></div>
          <div className="kv"><span className="k">missing_info</span><span className="v faint">{a.missing.join("；")}</span></div>
          <div className="flow-box mt14"><b>可信约束：</b>{a.note}</div>
          <div className="mt14"><button className="btn primary" onClick={() => go("planning")}>→ 进入方案规划</button></div>
        </> : (
          <div className="empty">尚未生成研判结果<br /><span className="hint">点击左侧「启动 AI 研判」运行 Analysis Agent</span></div>
        )}
      </div>
    </div>
  </>;
}
