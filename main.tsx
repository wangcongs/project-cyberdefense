import { createRoot } from "react-dom/client";
import "./styles.css";
import App, { PAGE_ROUTES } from "./App";
import { state } from "./core/store.js";

/* 初始路由在首次渲染前确定：支持 file:///...index.html#kg 直达 */
const initRoute = (location.hash || "").replace("#", "");
if (PAGE_ROUTES.includes(initRoute)) state.route = initRoute;

/* 注意：不使用 StrictMode —— SVG 画布（拓扑/本体/图谱/DAG）为命令式绘制，
   StrictMode 的开发期双调用副作用会重复追加节点。 */
createRoot(document.getElementById("root")!).render(<App />);
