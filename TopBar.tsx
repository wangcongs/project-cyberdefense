import { useEffect, useState } from "react";
import { state, TITLES, ROLES, useApp } from "../core/store.js";
import { setRole, toggleLLM, startDemo, stopDemo } from "../actions/system.js";
import { now } from "../core/utils.js";

/**
 * 顶栏：页面标题 / 登录角色切换（RBAC）/ LLM 状态标签（点击演练故障降级）/ 一键演示 / 时钟。
 */
export function TopBar() {
  useApp();
  const [clock, setClock] = useState(now());
  useEffect(() => {
    const t = setInterval(() => setClock(now()), 1000);
    return () => clearInterval(t);
  }, []);

  const t = TITLES[state.route] || ["", ""];
  return (
    <div id="topbar">
      <div className="tb-title">
        <div id="page-title">{t[0]}</div>
        <div id="page-sub">{t[1]}</div>
      </div>
      <div className="tb-right">
        <select
          id="role-sel"
          className="role-sel"
          title="登录角色：决定可执行的操作权限"
          value={state.role}
          onChange={(e) => setRole(e.target.value)}
        >
          {Object.entries(ROLES).map(([id, r]: any) => (
            <option key={id} value={id}>{r.ico} {r.name} · {r.user}</option>
          ))}
        </select>
        <span className="env-tag">虚拟实验环境</span>
        <span
          id="llm-tag"
          className={"llm-tag " + (state.llmOnline ? "llm-on" : "llm-off")}
          title="点击切换 LLM 可用状态（演示故障降级）"
          onClick={() => toggleLLM()}
        >
          {state.llmOnline ? "● LLM 在线" : "● LLM 离线（降级）"}
        </span>
        <button
          className="btn primary sm"
          id="demo-btn"
          onClick={() => (state.demo.on ? stopDemo() : startDemo())}
        >
          {state.demo.on ? "⏹ 退出演示" : "▶ 一键演示闭环"}
        </button>
        <span id="clock">{clock}</span>
      </div>
    </div>
  );
}
