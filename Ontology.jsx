/* =====================================================================
   页面：本体建模（CyberDefenseOntology 1.0 · 六大类核心 Schema）
   ===================================================================== */
import { state, SC, useApp } from "../core/store.js";
import { ONTO, ONTO_CQS, ONTO_ALIGN, ONTO_HIER } from "../core/data.js";
import { Tabs, Console } from "../ui/common.jsx";
import { sidePanel } from "../core/utils.js";
import { setTab } from "../actions/system.js";
import {
  cst, showCQ, cqFocus, cqTestAll, wizOpen, ontoSubmitReview, ontoApprove, ontoReject,
  toggleCls, delCls, toggleRel, runOntoCheck, exportTurtle,
  ontoRelToggle, ontoRelayout, ontoToggleLabels, kgInfo, kgGotoCls, kgAll,
} from "../actions/knowledge.js";
import { OntoWizPanel, AddClassQuickPanel, AddRelQuickPanel, AddCQQuickPanel } from "../ui/panels.jsx";
import OntoSVG from "../viz/OntoSVG.jsx";
import { pzBtn, pzReset } from "../viz/panzoom.jsx";

function OntStBadge({ o }) {
  const s = cst(o);
  return s === "published" ? <span className="badge b-green">已发布</span>
    : s === "review" ? <span className="badge b-amber pulse">评审中</span>
      : <span className="badge b-gray">草稿</span>;
}

export default function Ontology() {
  useApp();
  const cls = ONTO.classes, rel = ONTO.relations;
  const onCls = cls.filter((c) => c.on).length, onRel = rel.filter((r) => r.on).length;
  const instCnt = {};
  if (SC()) kgAll().nodes.forEach((n) => { instCnt[n.cls] = (instCnt[n.cls] || 0) + 1; });
  const cqOk = ONTO_CQS.filter((q) => q.status === "ok").length;
  const cqGap = ONTO_CQS.filter((q) => q.status !== "ok").length;
  const tab = state.tabs.onto || "viz";
  const picking = !!state.ontoPick;
  const pending = cls.map((o, i) => ({ o, i, k: "cls" })).concat(rel.map((o, i) => ({ o, i, k: "rel" }))).filter((x) => cst(x.o) !== "published");

  return <>
    <div className="grid g4 mb14">
      <div className="kpi c-cyan"><div className="k-label">能力问题覆盖</div><div className="k-val">{cqOk}<span style={{ fontSize: "13px", color: "var(--faint)" }}> / {ONTO_CQS.length}</span></div><div className="k-foot">CQ 回放测试 · {cqGap} 项缺口指向二期建模任务</div></div>
      <div className="kpi c-green"><div className="k-label">核心类</div><div className="k-val">{onCls}<span style={{ fontSize: "13px", color: "var(--faint)" }}> / {cls.length}</span></div><div className="k-foot">含 subClassOf 层次 · 一期建议基线 20~30 个</div></div>
      <div className="kpi c-blue"><div className="k-label">对象属性</div><div className="k-val">{onRel}<span style={{ fontSize: "13px", color: "var(--faint)" }}> / {rel.length}</span></div><div className="k-foot">domain→range · 含 inverse/functional 等语义特征</div></div>
      <div className="kpi c-amber"><div className="k-label">本体版本</div><div className="k-val" style={{ fontSize: "18px" }}>1.0</div><div className="k-foot">外部复用 STIX 2.1 / ATT&amp;CK / D3FEND · 可导出 RDF/Turtle</div></div>
    </div>

    <Tabs active={tab} onChange={(v) => setTab("onto", v)} tabs={[
      { id: "viz", label: "🗺 核心类关系图" },
      { id: "cq", label: `能力问题（${cqOk}/${ONTO_CQS.length}）` },
      { id: "align", label: "术语与外部复用" },
      { id: "hier", label: "类层次 subClassOf" },
      { id: "classes", label: `核心类管理（${cls.length}）` },
      { id: "rels", label: `属性字典（${rel.length}）` },
      { id: "method", label: "构建流程与评估" },
    ]} />

    {tab === "viz" ? (
      <div className="card mb14">
        <h3>核心类关系图 <span className="sub">按 §5.2 六大类别组织 Schema · 关闭的类/关系将从图中隐藏 · 🔗 可在画布上手动补关系</span></h3>
        <div style={{ background: "#050810", border: "1px solid var(--border)", borderRadius: "10px", padding: "10px" }}>
          <div className="pz-bar">
            <button className={"btn sm " + (picking ? "primary" : "")} onClick={() => ontoRelToggle()}>{picking ? "✕ 取消添加关系" : "🔗 添加关系"}</button>
            {picking ? (
              <span className={"badge " + (state.ontoPick.a ? "b-amber" : "b-cyan")}>
                {state.ontoPick.a ? `已选起点 ${state.ontoPick.a} · 点击目标类` : "点击起点类"}
              </span>
            ) : null}
            <button className="btn sm" onClick={() => ontoRelayout()}>⊞ 自动重排</button>
            <button className={"btn sm " + (state.ontoLabels ? "primary" : "")} onClick={() => ontoToggleLabels()}>🏷 关系标签</button>
            <button className="btn sm" onClick={() => pzBtn("onto-svg", 0.8)}>＋</button>
            <button className="btn sm" onClick={() => pzBtn("onto-svg", 1.25)}>－</button>
            <button className="btn sm" onClick={() => pzReset("onto-svg")}>⤢ 重置</button>
            <span className="pz-zoom-tag" id="onto-svg-zoom">100%</span>
            <span className="hint">拖拽节点自由布局 · 点击查看类定义与实例 · 悬停高亮关联</span>
          </div>
          <div className="pz-canvas" style={{ height: "540px" }}>
            <OntoSVG />
          </div>
        </div>
      </div>
    ) : tab === "cq" ? (
      <div className="card">
        <h3>能力问题 Competency Questions <span className="sub">Ontology 101 / TOVE 方法的核心：CQ 是本体的设计目标，也是可回放的验收测试 —— 每个类与属性都必须能回溯到某个 CQ；点击行查看依赖链与测试查询</span></h3>
        <div className="flex mb14" style={{ gap: "8px", flexWrap: "wrap" }}>
          <button className="btn primary sm" onClick={() => cqTestAll()}>▶ 运行 CQ 回放测试</button>
          <span className="hint">状态：{ONTO_CQS.filter((q) => q.status === "ok").length} ✓ 可回答 · {ONTO_CQS.filter((q) => q.status === "partial").length} ⚠ 部分 · {ONTO_CQS.filter((q) => q.status === "gap").length} ✗ 缺口</span>
        </div>
        <AddCQQuickPanel />
        <div style={{ maxHeight: "520px", overflowY: "auto" }}>
          <table><tbody>
            <tr><th style={{ width: "56px" }}>CQ</th><th>能力问题</th><th style={{ width: "44px" }}>级别</th><th>所需类</th><th style={{ width: "64px" }}>状态</th><th style={{ width: "40px" }}></th></tr>
            {ONTO_CQS.map((q) => (
              <tr key={q.id} className="rowlink" onClick={() => showCQ(q.id)}>
                <td className={"mono " + (q.status === "ok" ? "hl-cyan" : q.status === "partial" ? "hl-amber" : "hl-red")}>{q.id}</td>
                <td>{q.q}</td>
                <td><span className={"badge " + (q.rank === "P0" ? "b-red" : q.rank === "P1" ? "b-amber" : "b-gray")}>{q.rank}</span></td>
                <td className="mono faint" style={{ fontSize: "10px" }}>{q.classes.join(", ")}</td>
                <td>{q.status === "ok" ? <span className="badge b-green">✓ 可回答</span> : q.status === "partial" ? <span className="badge b-amber">⚠ 部分</span> : <span className="badge b-red">✗ 缺口</span>}</td>
                <td><span className="hint" title="在关系图中定位" style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); cqFocus(q.id); }}>◎</span></td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <div className="hint mt8">规则：新增类/属性时若无法回溯到任何 CQ，评审将打回（防止「万物建模」）；CQ 缺口 = 二期建模任务，缺口指向即扩展方向。</div>
      </div>
    ) : tab === "align" ? (
      <div className="card">
        <h3>术语枚举与外部复用 <span className="sub">Reuse before build：先查 STIX 2.1 / ATT&amp;CK / D3FEND / UCO 是否已有对应概念，能复用不新建；本地仅做必要扩展</span></h3>
        <div style={{ maxHeight: "520px", overflowY: "auto" }}>
          <table><tbody>
            <tr><th>本地类</th><th>外部词汇 / 标准</th><th style={{ width: "96px" }}>复用方式</th><th>对齐理由</th></tr>
            {ONTO_ALIGN.map((a, i) => {
              const c = ONTO.classes.find((z) => z.name === a.cls);
              return (
                <tr key={i} className="rowlink" onClick={() => kgInfo(a.cls)}>
                  <td className={"mono " + (c && c.on ? "hl-cyan" : "faint")}>{a.cls}</td>
                  <td className="muted" style={{ fontSize: "11px" }}>{a.ext}</td>
                  <td><span className={"badge " + (a.how === "复用" ? "b-green" : a.how === "新建" ? "b-amber" : "b-cyan")}>{a.how}</span></td>
                  <td className="muted" style={{ fontSize: "11px" }}>{a.why}</td>
                </tr>
              );
            })}
          </tbody></table>
        </div>
        <div className="hint mt8">外部知识经命名空间隔离（attack: / d3f:）以只读方式入图，版本锁定（ATT&amp;CK v19.2 / D3FEND v1.6.0），升级需评审 —— 见「知识图谱 → 本体命名空间」。</div>
      </div>
    ) : tab === "hier" ? (
      <div className="card">
        <h3>类层次 subClassOf <span className="sub">骨架：永久类别建子类（Endpoint ⊑ Asset），角色与上下文用关系表达 —— Ontology 101 原则④ · 抽象类不实例化</span></h3>
        <div className="grid g3">
          {ONTO_HIER.map((g) => (
            <div key={g.abs} className="flow-box" style={{ borderColor: g.c + "33" }}>
              <div style={{ color: g.c, fontWeight: 700, fontSize: "12px", marginBottom: "8px" }}>◇ {g.abs}<span className="faint" style={{ fontWeight: 400, fontSize: "10px" }}>（抽象）</span></div>
              {g.kids.map((k) => {
                const c = ONTO.classes.find((z) => z.name === k.n);
                return (
                  <div key={k.n} style={{ margin: "4px 0" }}>
                    <span className={"mono " + (c && c.on ? "hl-cyan" : "faint")} style={{ cursor: "pointer" }} onClick={() => kgInfo(k.n)}>{k.n}</span>
                    {k.kids ? k.kids.map((kd) => {
                      const c2 = ONTO.classes.find((z) => z.name === kd);
                      return (
                        <div key={kd} style={{ margin: "3px 0 0 18px", fontSize: "11px" }}>
                          <span className="faint">⊑</span> <span className={"mono " + (c2 && c2.on ? "" : "faint")} style={{ cursor: "pointer" }} onClick={() => kgInfo(kd)}>{kd}</span>
                        </div>
                      );
                    }) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="hint mt14" style={{ lineHeight: 2 }}>
          ① 抽象层（6 个）只做组织与推理锚点，不实例化；具体类才是实例的 rdf:type<br />
          ② 不相交约束：事件 ⊓ 网络基础设施 = ∅、行为主体 ⊓ 业务对象 = ∅（推理机检查，见「构建流程与评估」）<br />
          ③ 为什么"管理员账户"不是 Account 的子类：同一账户可在不同上下文担任不同角色 —— 用 <span className="mono">Account —accesses→ Asset</span> 与 privilege 属性表达，避免类爆炸<br />
          ④ 新增类必须声明父类（见核心类管理）；子类继承父类的 domain/range 约束
        </div>
      </div>
    ) : tab === "classes" ? (
      <div className="card">
        <h3>核心类管理 <span className="sub">草稿 → 评审 → 发布 · 新增类必须声明父类并回溯到能力问题</span>
          <span className="spacer"></span>
          <button className="btn sm primary" onClick={() => { wizOpen(); sidePanel(<OntoWizPanel />); }}>🧭 本体构建向导</button>
        </h3>
        {pending.length ? (
          <div className="flow-box mb14" style={{ borderColor: "rgba(251,191,36,.4)" }}>
            <b className="hl-amber">评审队列（{pending.length}）</b> <span className="hint">草稿需提交评审；评审中等待安全专家·李清源处理 · 发布后进入正式 Schema 并可实例化</span>
            {pending.map((x) => (
              <div key={x.k + x.i} className="flex mt8" style={{ justifyContent: "space-between", gap: "8px", borderTop: "1px dashed rgba(31,47,79,.6)", paddingTop: "8px" }}>
                <span>
                  <span className={"badge " + (x.k === "cls" ? "b-cyan" : "b-purple")}>{x.k === "cls" ? "类" : "属性"}</span>{" "}
                  <span className={"mono " + (cst(x.o) === "review" ? "hl-amber" : "")}>{x.o.name}</span> <OntStBadge o={x.o} />{" "}
                  <span className="faint" style={{ fontSize: "10px" }}>{x.k === "cls" ? x.o.cn : `${x.o.from} → ${x.o.to}`}</span>
                </span>
                <span className="flex" style={{ gap: "6px" }}>
                  {cst(x.o) === "draft" ? <button className="btn sm" onClick={() => ontoSubmitReview(x.k, x.i)}>↑ 提交评审</button> : null}
                  {cst(x.o) === "review" ? <>
                    <button className="btn sm green" onClick={() => ontoApprove(x.k, x.i)}>✓ 发布</button>
                    <button className="btn sm danger" onClick={() => ontoReject(x.k, x.i)}>✕ 打回</button>
                  </> : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <AddClassQuickPanel />
        <div style={{ maxHeight: "560px", overflowY: "auto" }}>
          <table><tbody>
            <tr><th>类</th><th>中文</th><th>父类</th><th>关键属性</th><th>典型实例</th><th>本事件实例</th><th>状态</th><th>启用</th><th></th></tr>
            {cls.map((c, i) => (
              <tr key={c.name}>
                <td className={"mono " + (c.on ? "hl-cyan" : "faint")}>{c.name}</td>
                <td className="muted">{c.cn}</td>
                <td className="mono faint" style={{ fontSize: "10px" }}>{c.parent || "—"}</td>
                <td className="faint mono" style={{ fontSize: "10px" }}>{c.props}</td>
                <td className="mono faint" style={{ fontSize: "10px" }}>{c.inst}</td>
                <td>{instCnt[c.name] ? <span className="badge b-cyan" style={{ cursor: "pointer" }} title="在知识图谱中查看" onClick={() => kgGotoCls(c.name)}>{instCnt[c.name]}</span> : <span className="faint">—</span>}</td>
                <td><OntStBadge o={c} /></td>
                <td>{cst(c) === "published"
                  ? <span className={"switch " + (c.on ? "on" : "")} title="启用/停用" onClick={() => toggleCls(i)}></span>
                  : <span className="faint" style={{ fontSize: "10px" }}>发布后启用</span>}</td>
                <td>{c.core ? <span className="badge b-gray">核心</span>
                  : cst(c) === "published" ? <span style={{ cursor: "pointer", color: "var(--red)", fontSize: "11px" }} onClick={() => delCls(i)}>删除</span> : null}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </div>
    ) : tab === "rels" ? (
      <div className="card">
        <h3>属性字典（对象属性） <span className="sub">domain → range · 语义特征（inverse / functional / transitive / 基数）· 每条属性都对应一个明确业务问题</span></h3>
        <AddRelQuickPanel />
        <div style={{ maxHeight: "560px", overflowY: "auto" }}>
          <table><tbody>
            <tr><th>属性</th><th>domain → range</th><th>语义特征</th><th>业务语义</th><th>状态</th><th>启用</th></tr>
            {rel.map((r, i) => (
              <tr key={r.name + i}>
                <td className={"mono " + (r.on ? "hl-green" : "faint")}>{r.name}</td>
                <td className="mono faint" style={{ fontSize: "10px" }}>{r.from} → {r.to}</td>
                <td className="mono" style={{ fontSize: "10px", color: "var(--purple)" }}>{r.feat || "—"}</td>
                <td className="muted">{r.use}</td>
                <td><OntStBadge o={r} /></td>
                <td>{cst(r) === "published"
                  ? <span className={"switch " + (r.on ? "on" : "")} onClick={() => toggleRel(i)}></span>
                  : <span className="faint" style={{ fontSize: "10px" }}>评审队列</span>}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </div>
    ) : (
      <div className="card">
        <h3>构建流程与评估 <span className="sub">Ontology 101（Noy &amp; McGuinness, 2001）七步法 + CQ 回放验收 · 与 §19.4 / §5.4 对应</span></h3>
        <div className="pipeline" style={{ marginBottom: "14px" }}>
          {["①范围与能力问题", "②复用评估", "③术语枚举", "④类与类层次", "⑤属性与限制", "⑥实例化", "⑦评估与迭代"].map((s2, i) => {
            const done = i < 6;
            return (
              <span key={s2} style={{ display: "contents" }}>
                <div className={"pl-step " + (done ? "done" : i === 6 ? "cur" : "")}>
                  <div className="pl-node">{done ? "✓" : i + 1}</div>
                  <div className="pl-label" style={{ fontSize: "10.5px" }}>{s2}</div>
                </div>
                {i < 6 ? <div className={"pl-line " + (i < 5 ? "done" : "")}></div> : null}
              </span>
            );
          })}
        </div>
        <div className="hint" style={{ lineHeight: 2 }}>
          ① <b className="hl-cyan">能力问题驱动</b>：先写 CQ 再建模，Top-P0 定义一期范围，其余进 backlog；每个类/属性必须回溯到 CQ<br />
          ② <b className="hl-cyan">复用优先</b>：STIX 2.1 / ATT&amp;CK / D3FEND / UCO 已有概念不重建（见「术语与外部复用」）<br />
          ③ <b className="hl-cyan">强标识优先</b>：CMDB asset_code / AD objectGUID / EDR device_guid；IP、主机名仅作辅助<br />
          ④ <b className="hl-cyan">网络域约束</b>：实体解析在同一 network_scope 内进行，防止跨域误合并<br />
          ⑤ <b className="hl-cyan">最小公理化</b>：只加业务需要的约束 —— 每条公理都是维护成本和推理机开销；核心业务规则用程序规则或少量 SHACL 做数据质量检查；DefensePlan 用 JSON Schema + Policy 校验<br />
          ⑥ 不要求业务人员操作 OWL/SPARQL —— 对外只暴露 Knowledge Service 固定 API<br />
          ⑦ 注意区分：本体是 <span className="hl-cyan">Schema 定义</span>（本页）；知识图谱是本体的<span className="hl-amber">实例化</span>（L1-L4 四层组织，见「知识图谱」）
        </div>
        <div className="mt14 flex" style={{ gap: "8px" }}>
          <button className="btn primary sm" onClick={() => runOntoCheck()}>☑ 运行推理一致性检查 + CQ 回放</button>
          <button className="btn sm" onClick={() => exportTurtle()}>⇩ 导出 RDF/Turtle</button>
        </div>
        <div className="mt14">
          <Console lines={state.uiLogs.onto} maxH={220} placeholder="// 推理机一致性检查 / CQ 回放 / 导出 将在此输出" />
        </div>
      </div>
    )}
  </>;
}
