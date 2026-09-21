/* =====================================================================
   页面：执行监控（分域执行 · 人工介入点）
   ===================================================================== */
import { S, INC, useApp } from "../core/store.js";
import { StatusBadge, CtxBar, Pipeline, Console } from "../ui/common.jsx";
import { go } from "../actions/system.js";
import { runExecution, taskConfirm, taskDone, taskSkip, revokeDispatch } from "../actions/pipeline.js";

export default function Execution() {
  useApp();
  const s = S();
  const allDone = s.tasks.length > 0 && s.tasks.every((t) => t.status === "SUCCESS" || t.status === "SKIPPED");
  const waiting = s.tasks.filter((t) => t.status === "WAITING");
  const nets = [...new Set(s.tasks.map((t) => t.net))];

  return <>
    <CtxBar />
    <div className="card mb14"><h3>闭环进度 <span className="sub">{INC().id} · {INC().title}</span></h3><Pipeline stage={s.stage} /></div>

    <div className="grid g32">
      <div className="card">
        <h3>分域执行状态 <span className="sub">Local Execution Service 不使用大模型 · 本地二次校验 · Fail Closed</span></h3>
        {s.dispatched ? <>
          {waiting.length ? (
            <div className="flow-box mb14 pulse" style={{ borderColor: "rgba(251,191,36,.55)" }}>
              <b className="hl-amber">⏸ 人工介入等待中（{waiting.length}）</b>
              <div className="mt8">
                {waiting.map((t) => (
                  <div key={t.id} className="flex" style={{ alignItems: "center", gap: "8px", padding: "4px 0", fontSize: "12px" }}>
                    <span className="mono hl-cyan" style={{ width: "30px" }}>{t.id}</span>
                    <span className="mono" style={{ flex: 1 }}>{t.tpl} → {t.target}</span>
                    {t.hitl === "confirm" ? <button className="btn sm primary" onClick={() => taskConfirm(t.id)}>☑ 指挥员确认</button> : null}
                    {t.hitl === "manual" ? <button className="btn sm primary" onClick={() => taskDone(t.id)}>✓ 人工完成</button> : null}
                    <button className="btn sm" onClick={() => taskSkip(t.id)}>跳过</button>
                  </div>
                ))}
              </div>
              <div className="hint mt4">执行引擎已暂停：依赖该任务的所有后续任务将保持 PENDING，直到人工做出决策。</div>
            </div>
          ) : null}
          <div className="grid g2">
            {nets.map((net) => {
              const ts = s.tasks.filter((t) => t.net === net);
              const done = ts.filter((t) => t.status === "SUCCESS" || t.status === "SKIPPED").length;
              return (
                <div key={net} className="flow-box">
                  <div className="flex"><b>{net} Local Execution Service</b><span className="spacer"></span>
                    <span className={"badge " + (done === ts.length ? "b-green" : "b-cyan")}>{done}/{ts.length} 完成</span></div>
                  <div className="progress mt8"><i style={{ width: (ts.length ? done / ts.length * 100 : 0) + "%" }}></i></div>
                  <div className="mt8">
                    {ts.map((t) => (
                      <div key={t.id} className="flex" style={{ fontSize: "11px", padding: "3px 0", alignItems: "center" }}>
                        <span className="mono hl-cyan" style={{ width: "28px" }}>{t.id}</span>
                        <span className="mono" style={{ flex: 1 }}>{t.tpl}{t.hitl !== "auto" ? <span className="hl-amber"> ✋</span> : null}</span>
                        <StatusBadge s={t.status} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt14 flex" style={{ gap: "8px" }}>
            <button className="btn primary" onClick={() => runExecution()} disabled={s.execStarted || allDone}>▶ 开始执行</button>
            {allDone ? <span className="badge b-green">全部任务执行成功 · 凭证已销毁 · 审计已回传</span> : null}
            {allDone ? <button className="btn" onClick={() => go("effect")}>→ 效果验证</button> : null}
            {!allDone && s.execStarted ? <button className="btn" onClick={() => revokeDispatch()}>↩ 撤回分发 · 重新编排</button> : null}
          </div>
          <div className="flow-box mt14" style={{ borderColor: "rgba(167,139,250,.35)" }}><b className="hl-purple">§12.3 双重控制：</b>即使中央平台已批准，若局域网现场状态改变、策略被冻结、设备离线或签名异常，本地执行服务仍然拒绝操作 —— <b>中央 AI 发生错误也不能直接穿透到设备</b>。</div>
        </> : (
          <div className="empty">任务尚未分发<br /><span className="hint">请先在「任务编排」完成签名分发</span></div>
        )}
      </div>
      <div className="card">
        <h3>执行日志 <span className="sub">收到任务后的 8 步确定性校验 · 按依赖拓扑调度</span></h3>
        <Console lines={s.execLog} placeholder="// 等待执行…本地执行服务将依次验证：签名→scope→审批→本地策略→实时状态→短时凭证→Tool Gateway→结果回传" />
      </div>
    </div>
  </>;
}
