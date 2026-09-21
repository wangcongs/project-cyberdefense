import { useEffect } from "react";
import { state, useApp, notify } from "./core/store.js";
import { closePanel } from "./core/utils.js";
import { Nav } from "./components/Nav";
import { TopBar } from "./components/TopBar";
import { DemoBanner } from "./components/DemoBanner";
import { ToastHost, PanelHost, PageShell } from "./ui/common.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Topology from "./pages/Topology.jsx";
import Events from "./pages/Events.jsx";
import Analysis from "./pages/Analysis.jsx";
import Planning from "./pages/Planning.jsx";
import Approval from "./pages/Approval.jsx";
import Tasks from "./pages/Tasks.jsx";
import Execution from "./pages/Execution.jsx";
import Gateway from "./pages/Gateway.jsx";
import Effect from "./pages/Effect.jsx";
import Ontology from "./pages/Ontology.jsx";
import KG from "./pages/KG.jsx";
import GraphBuild from "./pages/GraphBuild.jsx";
import KB from "./pages/KB.jsx";
import Cases from "./pages/Cases.jsx";
import Governance from "./pages/Governance.jsx";

/* 路由表：state.route → 页面组件（hash 模式，离线 file:// 与 dev server 行为一致） */
const PAGES: Record<string, React.ComponentType> = {
  dashboard: Dashboard, topology: Topology, events: Events, analysis: Analysis,
  planning: Planning, approval: Approval, tasks: Tasks, execution: Execution,
  gateway: Gateway, effect: Effect, ontology: Ontology, kg: KG,
  graphbuild: GraphBuild, kb: KB, cases: Cases, governance: Governance,
};
export const PAGE_ROUTES = Object.keys(PAGES);

/**
 * 应用外壳：侧边导航 + 顶栏 + 页面视图 + 全局浮层（toast / 演示横幅 / 侧栏）。
 * 状态全部来自 core/store.js：动作层 notify() → useApp() 订阅重渲染。
 */
export default function App() {
  useApp();

  useEffect(() => {
    /* hash 路由监听（导航点击 / 浏览器前进后退；初始路由已在 main.tsx 确定） */
    const onHash = () => {
      const r = location.hash.replace("#", "");
      if (PAGES[r] && r !== state.route) {
        state.route = r;
        closePanel();
        notify();
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const Page = PAGES[state.route] || Dashboard;

  return (
    <>
      <div id="app">
        <div id="sidebar">
          <div id="logo">
            <div className="t1">网络攻防指挥控制决策系统</div>
            <div className="t2">LLM + AGENT + ONTOLOGY · V4.1</div>
          </div>
          <Nav />
          <div id="side-foot">
            虚拟实验环境 · 数据均为虚构样例
            <br />
            ATT&amp;CK v19.2 / D3FEND v1.6.0
          </div>
        </div>
        <div id="main">
          <TopBar />
          <div id="content">
            <PageShell route={state.route}>
              <Page />
            </PageShell>
          </div>
        </div>
      </div>

      {/* 全局浮层（React 渲染，store 驱动） */}
      <ToastHost />
      <DemoBanner />
      <PanelHost />
    </>
  );
}
