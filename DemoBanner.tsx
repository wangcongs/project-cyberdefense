import { state, useApp } from "../core/store.js";
import { demoNext, stopDemo } from "../actions/system.js";

/** 一键演示横幅：state.demo 驱动（on / text），文案允许简单 HTML 强调 */
export function DemoBanner() {
  useApp();
  const d = state.demo;
  return (
    <div id="demo-banner" className={d.on ? "on" : ""}>
      <span className="pulse" style={{ color: "var(--cyan)", fontSize: "16px" }}>◉</span>
      <div className="db-step" id="demo-text" dangerouslySetInnerHTML={{ __html: d.text }}></div>
      <button className="btn sm" id="demo-next" onClick={() => demoNext()}>下一步 ›</button>
      <button className="btn sm danger" id="demo-stop" onClick={() => stopDemo()}>退出演示</button>
    </div>
  );
}
