/* =====================================================================
   页面：工具网关（§13 语义动作 → Vendor Adapter → 设备 API）
   ===================================================================== */
import { state, useApp } from "../core/store.js";
import { DB } from "../core/data.js";
import { StatusBadge, Console } from "../ui/common.jsx";
import { GW_ACTIONS, gwDemo } from "../actions/pipeline.js";

export default function Gateway() {
  useApp();
  const devs = DB.devices;
  const offCnt = Object.keys(state.devicesOffline).filter((k) => state.devicesOffline[k]).length;

  return <>
    <div className="grid g4 mb14">
      <div className="kpi c-cyan"><div className="k-label">标准动作注册</div><div className="k-val">{GW_ACTIONS.length}</div><div className="k-foot">语义动作 · 全部参数白名单化</div></div>
      <div className="kpi c-green"><div className="k-label">Vendor Adapter</div><div className="k-val">{devs.length}</div><div className="k-foot">{offCnt ? <span className="hl-red">{offCnt} 个不可用</span> : "全部健康检查通过"}</div></div>
      <div className="kpi c-blue"><div className="k-label">今日调用</div><div className="k-val">47</div><div className="k-foot">含重试 · 平均耗时 1.2s</div></div>
      <div className="kpi c-amber"><div className="k-label">白名单拦截</div><div className="k-val">3</div><div className="k-foot">越权参数 / 未知动作 / 超范围目标</div></div>
    </div>

    <div className="card mb14" style={{ borderColor: "rgba(167,139,250,.4)" }}>
      <h3 className="hl-purple">核心原则：上层永远不生成厂商 CLI</h3>
      <div className="hint" style={{ lineHeight: 2 }}>Planning Agent / DefensePlan 中只出现<b className="hl-cyan">语义动作</b>（isolate_endpoint 等）。Vendor Adapter 把标准动作转换成厂商 API，并完成<b>参数白名单、类型校验、超时、重试、幂等和错误码转换</b>——LLM 输出永远不直接触达设备。</div>
    </div>

    <div className="grid g23 mb14">
      <div className="card">
        <h3>标准动作注册表 <span className="sub">§13.1 · 上层唯一合法动作词汇表</span></h3>
        <table><tbody>
          <tr><th>标准动作</th><th>目标</th><th>典型设备</th><th>参数白名单</th></tr>
          {GW_ACTIONS.map((a) => (
            <tr key={a.id}><td className="mono hl-cyan">{a.id}</td><td className="muted">{a.tgt}</td><td className="muted">{a.dev}</td><td className="muted mono" style={{ fontSize: "10.5px" }}>{a.wl}</td></tr>
          ))}
        </tbody></table>
      </div>
      <div className="card">
        <h3>转换链演示 <span className="sub">isolate_endpoint(RND-WS-23)</span>
          <span className="spacer"></span>
          <button className="btn sm primary" onClick={() => gwDemo()}>▶ 执行转换演示</button>
        </h3>
        <Console lines={state.uiLogs.gw} maxH={300} placeholder="// 点击「执行转换演示」查看语义动作 → 厂商 API 的完整转换链（含校验/幂等/审计）" />
        <div className="hint mt8">提示：在「系统治理」将 EDR-B 置为离线后再演示，可观察健康检查失败 → 能力降级路径。</div>
      </div>
    </div>

    <div className="card">
      <h3>Vendor Adapter 能力矩阵 <span className="sub">§13.2 · Adapter 最低要求逐项核查</span></h3>
      <table><tbody>
        <tr><th>设备</th><th>域</th><th>健康检查</th><th>参数校验</th><th>幂等/去重</th><th>可重试错误</th><th>结果标准化</th><th>回滚声明</th><th>审计日志</th></tr>
        {devs.map((d) => {
          const off = state.devicesOffline[d.id];
          return (
            <tr key={d.id}>
              <td className={"mono " + (off ? "hl-red" : "")}>{d.id}{off ? "（离线）" : ""}</td>
              <td className="mono faint">{d.net}</td>
              <td><StatusBadge s={off ? "UNAVAILABLE" : "AVAILABLE"} /></td>
              <td className="mono" style={{ color: "var(--green)" }}>✓ 白名单</td>
              <td className="mono" style={{ color: "var(--green)" }}>✓ op-key</td>
              <td className="mono" style={{ color: "var(--green)" }}>✓ 分类映射</td>
              <td className="mono" style={{ color: "var(--green)" }}>✓ 统一码</td>
              <td className="mono" style={{ color: "var(--green)" }}>✓ {d.id.startsWith("FW") ? "remove_policy" : "restore_*"}</td>
              <td className="mono" style={{ color: "var(--green)" }}>✓ 追加式</td>
            </tr>
          );
        })}
      </tbody></table>
    </div>
  </>;
}
