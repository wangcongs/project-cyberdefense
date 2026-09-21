import { state, NAV, useApp } from "../core/store.js";
import { go } from "../actions/system.js";

/** 侧边导航：分组 + 徽标（在处事件数 / 待审批数）由 NAV.badge() 闭包实时计算 */
export function Nav() {
  useApp();
  return (
    <div id="nav">
      {NAV.map((n: any) => {
        if (n.sec) return <div key={n.sec} className="nav-sec">{n.sec}</div>;
        const b = n.badge ? n.badge() : null;
        return (
          <div
            key={n.id}
            className={"nav-item " + (state.route === n.id ? "active" : "")}
            onClick={() => go(n.id)}
          >
            <span className="ico">{n.ico}</span>
            {n.name}
            {b ? <span className="bdg">{b}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
