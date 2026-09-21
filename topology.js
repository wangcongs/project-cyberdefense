/* =====================================================================
   拓扑与资产动作：网络域/资产编辑（CMDB 基线运行时维护）、手动关系、
   攻击路径推演、事件中心过滤与档案
   ===================================================================== */
import { state, notify, stageOf, activeIncs } from "../core/store.js";
import { toast, addAudit, closePanel, sidePanel } from "../core/utils.js";
import { DB } from "../core/data.js";
import { showNetPanel, showAssetPanel, showTopoLinkPanel, showEventPanel } from "../ui/panels.jsx";

/* ===== 拓扑关系类型（颜色） ===== */
export const TOPO_LINKTYPES = { "业务依赖": "#22d3ee", "管理关系": "#a78bfa", "跨域访问": "#fbbf24", "自定义": "#34d399" };
export const NETCOLORS = ["#22d3ee", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c", "#e879f9", "#38bdf8"];

/* 拓扑节点位置记忆：拖拽后保留 · 「自动重排」清空恢复网格布局 */
export let TOPOV = null;
export function setTOPOV(v) { TOPOV = v; }
/* 攻击路径推演运行态（模块级：跨渲染保留轮播进度） */
export let RPLAY = null;
export function setRPLAY(v) { RPLAY = v; }

/* ===== 攻击路径推演 ===== */
export function topoReplayToggle() {
  if (RPLAY && RPLAY.on) {
    if (RPLAY.raf) cancelAnimationFrame(RPLAY.raf);
    RPLAY = null;
    addAudit("网络拓扑", "停止攻击路径推演");
    notify();
  } else {
    RPLAY = { on: true, pi: 0, hi: 0, t: 0, hold: 0, raf: 0 };
    addAudit("网络拓扑", "启动攻击路径推演（逐跳动画回放各事件攻击链）");
    toast("攻击路径推演已启动：红色脉冲沿攻击链逐跳推进，自动轮播各事件", "ok");
    notify();
  }
}

/* ===== 手动关系（🔗 添加关系模式） ===== */
export function topoLinkToggle() {
  state.topoLinkPick = state.topoLinkPick ? null : { a: null };
  notify();
}

export function topoRelayout() {
  TOPOV = null;
  addAudit("网络拓扑", "视图重置为自动网格布局");
  toast("已恢复自动布局", "ok");
  notify();
}

export function topoPick(id) {
  const pk = state.topoLinkPick; if (!pk) return;
  if (!pk.a) { pk.a = id; toast(`已选起点 ${id}，请点击目标资产`, "ok"); notify(); }
  else if (pk.a === id) { state.topoLinkPick = { a: null }; toast("已取消起点选择", "warn"); notify(); }
  else { state.topoLinkPick = null; sidePanel(showTopoLinkPanel(pk.a, id)); }
}

export function topoLinkSave(from, to, type, label) {
  label = (label || "").trim() || "—";
  if (state.topoLinks.some((l) => (l.from === from && l.to === to) || (l.from === to && l.to === from))) { toast("两资产间已存在关系", "warn"); return; }
  state.topoLinks.push({ id: "LNK-" + String(state.topoLinks.length + 1).padStart(2, "0"), from, to, label, type });
  addAudit("网络拓扑", `手动添加关系 ${from} → ${to}（${type} · ${label}）`, "ok");
  toast(`已添加关系 ${from} → ${to}`, "ok");
  closePanel(); notify();
}

export function topoLinkDel(id) {
  const l = state.topoLinks.find((x) => x.id === id);
  state.topoLinks = state.topoLinks.filter((x) => x.id !== id);
  addAudit("网络拓扑", `删除手动关系 ${l ? l.from + " → " + l.to : id}`, "warn");
  toast("关系已删除", "warn");
  closePanel(); notify();
}

/* ===== 新增网络域 / 资产 / 安全设备 ===== */
export function saveNet(f) {
  const id = (f.id || "").trim(), name = (f.name || "").trim();
  const cidr = (f.cidr || "").trim() || "—", biz = (f.biz || "").trim() || "—", ctrl = (f.ctrl || "").trim() || "—";
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(id)) { toast("请输入合法域标识（字母开头，如 LAN-D）", "err"); return; }
  if (!name) { toast("请输入域名称", "err"); return; }
  if (DB.networks.find((n) => n.id === id)) { toast("域标识已存在：" + id, "err"); return; }
  DB.networks.push({ id, name, cidr, gw: "—", biz, ctrl, color: NETCOLORS[DB.networks.length % NETCOLORS.length], custom: true });
  closePanel(); notify();
}

export function delNet(id) {
  const used = DB.assets.find((a) => a.net === id) || DB.devices.find((d) => d.net === id);
  if (used) { toast("该域下仍有资产/设备（" + used.id + "），请先移除", "err"); return; }
  DB.networks = DB.networks.filter((n) => n.id !== id);
  closePanel(); notify();
}

export function saveAsset(f) {
  const type = f.type, net = f.net;
  const id = (f.id || "").trim(), ip = (f.ip || "").trim() || "—";
  const crit = f.crit, svc = (f.svc || "").trim() || "—";
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) { toast("请输入合法标识 ID（字母开头）", "err"); return; }
  if (DB.assets.find((a) => a.id === id) || DB.devices.find((d) => d.id === id)) { toast("标识已存在：" + id, "err"); return; }
  if (type === "安全设备") {
    DB.devices.push({ id, net, caps: ["TrafficFilter", "NetworkAccessControl"], health: "AVAILABLE", custom: true });
  } else {
    DB.assets.push({ id, ip, type, os: "—", svc, crit, net, mgr: "—", health: "ONLINE", custom: true });
  }
  closePanel(); notify();
}

export function delAsset(id) {
  DB.assets = DB.assets.filter((a) => a.id !== id);
  DB.devices = DB.devices.filter((d) => d.id !== id);
  closePanel(); notify();
}

export function envReset() { location.reload(); }

/* ===== 资产 / 网络域属性编辑（CMDB 基线运行时维护） ===== */
export const ASSET_ORIG = {}, NET_ORIG = {};
export function _dirtyN(obj, cur) { return obj ? Object.keys(obj).filter((k) => String(obj[k]) !== String(cur[k])) : []; }

export function setAssetProp(id, k, val) {
  const a = DB.assets.find((x) => x.id === id); if (!a) return;
  if (!ASSET_ORIG[id]) ASSET_ORIG[id] = { ...a };
  a[k] = val;
  addAudit("CMDB基线", `更新资产 ${id}.${k} = ${val}`);
  toast(`资产属性 ${k} 已更新`, "ok");
  sidePanel(showAssetPanel(id));
  notify();
}

export function resetAsset(id) {
  const o = ASSET_ORIG[id]; if (!o) { toast("该资产未被修改", "warn"); return; }
  Object.assign(DB.assets.find((x) => x.id === id), o);
  delete ASSET_ORIG[id];
  addAudit("CMDB基线", `恢复资产 ${id} 初始属性`);
  sidePanel(showAssetPanel(id));
  notify();
}

export function setNetProp(id, k, val) {
  const n = DB.networks.find((x) => x.id === id); if (!n) return;
  if (!NET_ORIG[id]) NET_ORIG[id] = { ...n };
  n[k] = val;
  addAudit("CMDB基线", `更新网络域 ${id}.${k} = ${val}`);
  toast(`域属性 ${k} 已更新`, "ok");
  sidePanel(showNetPanel(id));
  notify();
}

export function resetNet(id) {
  const o = NET_ORIG[id]; if (!o) return;
  Object.assign(DB.networks.find((x) => x.id === id), o);
  delete NET_ORIG[id];
  addAudit("CMDB基线", `恢复网络域 ${id} 初始属性`);
  sidePanel(showNetPanel(id));
  notify();
}

/* ===== 事件中心 ===== */
export function setEvFilter(f) { state.eventFilter = f; notify(); }

export function showEvent(id) {
  const e = DB.events.find((x) => x.id === id);
  if (e) sidePanel(showEventPanel(e));
}

/* 面板入口（由页面调用，内容组件在 ui/panels.jsx） */
export function showNet(id) { sidePanel(showNetPanel(id)); }
export function showAsset(id) { sidePanel(showAssetPanel(id)); }
export function showTopoLink(id) {
  const l = state.topoLinks.find((x) => x.id === id); if (l) sidePanel(showTopoLinkPanel(l.from, l.to, l));
}
