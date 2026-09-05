import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, BellRing, BookOpenCheck, ChevronRight, CircleHelp, Download, Grid2X2, Lightbulb, Printer, Radio, RefreshCw, ScanLine, Sparkles, UsersRound, Wifi, X, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { type Learner, tierMeta, type Tier } from "@shared/mosaic";
import NotificationCenter from "./NotificationCenter";
import PaperScanner from "./PaperScanner";
import PrintableSlipGenerator from "./PrintableSlipGenerator";

const navigation = [
  { id: "overview", label: "Overview", icon: Grid2X2 },
  { id: "cohort", label: "Cohort map", icon: UsersRound },
  { id: "heatmap", label: "Concept signals", icon: BarChart3 },
  { id: "groups", label: "Learning groups", icon: BookOpenCheck },
];

function TierPill({ tier }: { tier: Tier }) {
  const meta = tierMeta[tier];
  return <span className="tier-pill" style={{ color: meta.color, backgroundColor: meta.soft }}><span style={{ backgroundColor: meta.color }} />{meta.label}</span>;
}

function CohortCanvas({ learners, onSelect }: { learners: Learner[]; onSelect: (learner: Learner) => void }) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const width = 850;
    const height = 350;
    const nodes = learners.map((learner, index) => ({ ...learner, index, x: width / 2, y: height / 2 }));
    const targets: Record<Tier, [number, number]> = { red: [145, 170], yellow: [350, 170], green: [560, 170], blue: [745, 170] };
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const labels = Object.entries(targets);
    svg.selectAll(".zone-label").data(labels).enter().append("text")
      .attr("class", "zone-label")
      .attr("x", ([tier, point]) => point[0])
      .attr("y", 50)
      .attr("text-anchor", "middle")
      .text(([tier]) => tierMeta[tier as Tier].label);
    svg.selectAll(".zone-rule").data(labels).enter().append("line")
      .attr("x1", ([, point]) => point[0] - 82).attr("x2", ([, point]) => point[0] + 82)
      .attr("y1", 63).attr("y2", 63).attr("stroke", "#e8e2d8");
    const bubbles = svg.append("g").selectAll("g").data(nodes).enter().append("g").style("cursor", "pointer");
    bubbles.append("circle")
      .attr("r", (node) => 18 + (node.mastery / 100) * 13)
      .attr("fill", (node) => tierMeta[node.tier].color)
      .attr("fill-opacity", 0.88)
      .attr("stroke", "#fffdf8").attr("stroke-width", 3);
    bubbles.append("text").attr("text-anchor", "middle").attr("dy", ".35em").attr("fill", "#fff")
      .attr("font-size", 10).attr("font-weight", 800).text((node) => node.initials);
    bubbles.on("click", (_event, node) => onSelect(node));
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("x", d3.forceX((node) => targets[(node as typeof nodes[number]).tier][0]).strength(0.18))
      .force("y", d3.forceY((node) => targets[(node as typeof nodes[number]).tier][1]).strength(0.14))
      .force("collide", d3.forceCollide((node) => 23 + ((node as typeof nodes[number]).mastery / 100) * 13))
      .alpha(0.85).alphaDecay(0.035)
      .on("tick", () => bubbles.attr("transform", (node) => `translate(${Math.max(36, Math.min(width - 36, node.x ?? width / 2))},${Math.max(94, Math.min(height - 34, node.y ?? height / 2))})`));
    return () => { simulation.stop(); };
  }, [learners, onSelect]);

  return <div className="cohort-canvas"><svg ref={ref} viewBox="0 0 850 350" role="img" aria-label="Dynamic cohort map clustered by learning tier" /></div>;
}

function ActionCard({ data, onPulse }: { data: { title: string; summary: string; recommendation: string; affected: number; topic: string }; onPulse: () => void }) {
  return <section className="action-card">
    <div className="action-card__top"><div className="eyebrow eyebrow--warm"><Sparkles size={14} />Teacher action card</div><span className="live-dot">Live</span></div>
    <div className="action-card__body"><div><h2>{data.title}</h2><p>{data.summary}</p></div><div className="action-count"><strong>{data.affected}</strong><span>learners<br />affected</span></div></div>
    <div className="action-card__footer"><div><Lightbulb size={18} /><p><strong>Try next</strong>{data.recommendation}</p></div><button className="btn btn--ink" onClick={onPulse}><Radio size={16} />New pulse</button></div>
  </section>;
}

function Heatmap({ learners, onSelect }: { learners: Learner[]; onSelect?: (learner: Learner) => void }) {
  const concepts = ["Mass vs. weight", "Force & motion", "Falling objects", "Measurement"];
  const cells = learners.slice(0, 12);
  const [context, setContext] = useState<{ learner: Learner; concept: string } | null>(null);
  const [override, setOverride] = useState("Mass and weight are the same thing");
  const applyOverride = trpc.mosaic.teacherOverride.useMutation({ onSuccess: () => setContext(null) });
  const markResolved = trpc.mosaic.markResolved.useMutation({ onSuccess: () => setContext(null) });
  return <section className="panel heatmap-panel"><div className="panel-heading"><div><div className="eyebrow">Concept diagnostic · confidence signal</div><h2>Where thinking gets stuck</h2></div><button className="text-button">See responses <ChevronRight size={15} /></button></div><p className="heatmap-explainer"><Zap size={14} />Solid red means “I knew this” but wrong. An outlined red means “I guessed” or “I’m unsure”. Right-click a cell for teacher actions.</p><div className="heatmap-scroll"><div className="heatmap"><div className="heatmap-row heatmap-row--head"><span>Learner</span>{concepts.map((concept) => <span key={concept}>{concept}</span>)}</div>{cells.map((learner, index) => <div className="heatmap-row" key={learner.id}><span className="learner-label"><b>{learner.initials}</b>{learner.name}</span>{concepts.map((concept, cellIndex) => { const hot = learner.misconception?.toLowerCase().includes("mass") && cellIndex === 0; const confident = hot && (learner.confidentWrongCount ?? 0) > 0; const confused = hot && !confident && (learner.confusedWrongCount ?? 0) > 0; const level = hot ? confident ? "hot-confident" : confused ? "hot-confused" : "hot" : (index + cellIndex * 2) % 5 === 0 ? "watch" : "clear"; return <span className={`heat-cell heat-cell--${level}`} key={concept} title={hot ? `${learner.misconception}\nDetected from: ${confident ? "a confident wrong answer" : "a guessed or unsure answer"}\nPattern: ${confident ? "confident error" : "confused attempt"}` : `${learner.name} · ${concept}`} onContextMenu={(event) => { event.preventDefault(); setContext({ learner, concept }); }} onClick={() => onSelect?.(learner)} aria-label={`${learner.name} ${concept} ${level}`} />; })}</div>)}</div></div><div className="heat-legend"><span><i className="heat-cell heat-cell--clear" />Secure</span><span><i className="heat-cell heat-cell--watch" />Watch</span><span><i className="heat-cell heat-cell--hot-confident" />Confident error</span><span><i className="heat-cell heat-cell--hot-confused" />Confused attempt</span></div>{context && <div className="heatmap-context" role="menu"><b>{context.learner.name}</b><small>{context.concept}</small><button onClick={() => { onSelect?.(context.learner); setContext(null); }}>View student profile <ChevronRight size={14} /></button><label>Override misconception<select value={override} onChange={(event) => setOverride(event.target.value)}><option>Mass and weight are the same thing</option><option>Force is only needed to keep objects moving</option><option>Heavier objects always fall faster</option></select></label><button onClick={() => applyOverride.mutate({ learnerId: context.learner.id, misconception: override })}>Confirm override</button><button onClick={() => markResolved.mutate({ learnerId: context.learner.id })}>Mark as resolved</button><button className="text-button" onClick={() => setContext(null)}>Close</button></div>}</section>;
}

function GroupCards({ learners }: { learners: Learner[] }) {
  return <section className="group-grid">{(Object.keys(tierMeta) as Tier[]).map((tier) => { const meta = tierMeta[tier]; const list = learners.filter((learner) => learner.tier === tier); return <article className="group-card" key={tier} style={{ borderTopColor: meta.color }}><div className="group-card__heading"><div><TierPill tier={tier} /><h3>{list.length} learners</h3></div><span className="group-badge">{tier === "red" ? "Priority" : "Ready"}</span></div><p>{meta.task}</p><div className="avatar-stack">{list.slice(0, 5).map((learner) => <span key={learner.id} title={learner.name} style={{ backgroundColor: meta.color }}>{learner.initials}</span>)}{list.length > 5 && <span className="avatar-stack__more">+{list.length - 5}</span>}</div><button className="text-button" onClick={() => window.print()}>Generate repair slip <Download size={15} /></button></article>; })}</section>;
}

export default function MosaicDashboard() {
  const [view, setView] = useState("overview");
  const [focus, setFocus] = useState<Learner | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const dashboard = trpc.mosaic.dashboard.useQuery(undefined, { refetchInterval: 5000 });
  const utils = trpc.useUtils();
  const startPulse = trpc.mosaic.startPulse.useMutation({ onSuccess: () => utils.mosaic.dashboard.invalidate() });
  const createLive = trpc.mosaic.createLiveSession.useMutation();
  const launchLive = trpc.mosaic.launchLiveSession.useMutation();
  const data = dashboard.data;
  const recentLearners = useMemo(() => data?.learners.slice(0, 5) ?? [], [data?.learners]);

  if (dashboard.isLoading || !data) return <div className="app-loading"><div className="mosaic-mark">M</div><p>Arranging your class mosaic…</p></div>;

  const renderMain = () => {
    if (view === "cohort") return <><div className="section-title"><div><div className="eyebrow">Live class view</div><h1>Every learner has a different path.</h1><p>Bubble size reflects current mastery. Tap a learner to see their next move.</p></div><button className="btn btn--soft" onClick={() => dashboard.refetch()}><RefreshCw size={16} />Refresh</button></div><section className="panel cohort-panel"><CohortCanvas learners={data.learners} onSelect={setFocus} /><div className="tier-key">{(Object.keys(tierMeta) as Tier[]).map((tier) => <TierPill tier={tier} key={tier} />)}</div></section></>;
    if (view === "heatmap") return <><div className="section-title"><div><div className="eyebrow">Live class view</div><h1>Concept signals</h1><p>Patterns appear here as learners complete missions and pulse checks.</p></div><button className="btn btn--soft" onClick={() => setShowScanner(true)}><ScanLine size={16} />Paper scanner</button></div><Heatmap learners={data.learners} onSelect={setFocus} /></>;
    if (view === "groups") return <><div className="section-title"><div><div className="eyebrow">Flexible intervention</div><h1>Four small moves. One classroom.</h1><p>Groups refresh as learners demonstrate new understanding.</p></div><button className="btn btn--soft" onClick={() => dashboard.refetch()}><RefreshCw size={16} />Update groups</button></div><GroupCards learners={data.learners} /><section className="peer-bridge"><div className="peer-icon"><UsersRound size={21} /></div><div><div className="eyebrow">Peer bridge</div><h3>Adam can explain it to Hana</h3><p>Adam recently cleared the same mass-and-weight idea. Their explanation may unlock a new route.</p></div><button className="btn btn--ink">Make a pair</button></section></>;
    return <><div className="welcome-line"><div><p className="eyebrow">Tuesday · 9:42 am</p><h1>Good morning, Ms. Aida.</h1><p>Here’s the clearest next step for <strong>{data.classroom.name}</strong>.</p></div><div className="class-chip"><span>F2</span><div><b>{data.classroom.name}</b><small>{data.classroom.subject} · {data.learners.length} learners</small></div></div></div><ActionCard data={data.actionCard} onPulse={() => startPulse.mutate()} /><div className="dashboard-grid"><section className="panel momentum-card"><div className="panel-heading"><div><div className="eyebrow">Class momentum</div><h2>Today’s learning picture</h2></div><span className="date-tag">This lesson</span></div><div className="tier-bars">{(Object.keys(tierMeta) as Tier[]).map((tier) => <div className="tier-bar" key={tier}><div><TierPill tier={tier} /><b>{data.counts[tier]}</b></div><div className="bar-track"><span style={{ width: `${data.counts[tier] * 5}%`, backgroundColor: tierMeta[tier].color }} /></div></div>)}</div><button className="text-button" onClick={() => setView("cohort")}>Open cohort map <ChevronRight size={15} /></button></section><section className="panel pulse-card"><div className="panel-heading"><div><div className="eyebrow">Quick check</div><h2>{data.pulse.active ? "Pulse is live" : "Read the room in 2 minutes"}</h2></div><span className={data.pulse.active ? "live-dot" : "muted-dot"}>{data.pulse.active ? "Live now" : "Ready"}</span></div><p>{data.pulse.active ? "3 questions are open across the classroom. Results will appear here as they arrive." : "Send a short diagnostic to every shared device—no logins needed."}</p><div className="pulse-progress"><span style={{ width: data.pulse.active ? "42%" : "0%" }} /><small>{data.pulse.active ? "8 of 20 responses" : "3 questions prepared"}</small></div><button className="btn btn--outlined" onClick={() => startPulse.mutate()} disabled={startPulse.isPending || data.pulse.active}>{startPulse.isPending ? "Sending…" : data.pulse.active ? "Pulse active" : "Start pulse check"}</button></section></div><Heatmap learners={data.learners} onSelect={setFocus} /></>;
  };

  const liveSession = createLive.data;
  return <div className="mosaic-shell"><aside className="mosaic-sidebar"><a className="brand" href="/"><span className="mosaic-mark">M</span><span>Mosaic<span>Classroom</span></span></a><div className="side-class"><span className="side-class__round">F2</span><div><small>Active classroom</small><b>{data.classroom.name}</b></div></div><nav>{navigation.map((item) => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "nav-item nav-item--active" : "nav-item"} onClick={() => setView(item.id)}><Icon size={18} />{item.label}</button>; })}</nav><div className="sidebar-bottom"><button className="nav-item" onClick={() => setShowScanner(true)}><ScanLine size={18} />Paper-first</button><a className="nav-item" href="/student"><UsersRound size={18} />Student view</a><div className="teacher-mini"><div>AA</div><span><b>Ms. Aida</b><small>Teacher</small></span></div></div></aside><div className="mosaic-main"><header className="topbar"><div className="mobile-brand"><span className="mosaic-mark">M</span>Mosaic</div><div className="topbar__right"><button className="topbar-action" onClick={() => setShowScanner(true)}><ScanLine size={15} />Scan slips</button><button className="topbar-action" onClick={() => setShowPrint(true)}><Printer size={15} />Answer slips</button><button className="topbar-action topbar-action--live" onClick={() => createLive.mutate()}><Zap size={15} />Start live session</button><a href="/kiosk" className="kiosk-link"><Wifi size={15} />Kiosk mode</a><NotificationCenter audience="educator" /></div></header><main className="content"><div className="mobile-nav">{navigation.map((item) => <button key={item.id} className={view === item.id ? "mobile-nav__active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}</div>{renderMain()}<section className="recent-strip"><div><div className="eyebrow">Recent activity</div><h2>Keep an eye on these learners</h2></div><div className="recent-list">{recentLearners.map((learner) => <button key={learner.id} onClick={() => setFocus(learner)}><span className="small-avatar" style={{ backgroundColor: tierMeta[learner.tier].color }}>{learner.initials}</span><span><b>{learner.name}</b><small>{learner.misconception ?? "Building confidence"} · {learner.recent}</small></span><ChevronRight size={16} /></button>)}</div></section></main></div>{focus && <div className="learner-drawer" role="dialog" aria-modal="true"><button className="drawer-backdrop" aria-label="Close learner details" onClick={() => setFocus(null)} /><article><button className="drawer-close" onClick={() => setFocus(null)}><X size={18} /></button><span className="large-avatar" style={{ backgroundColor: tierMeta[focus.tier].color }}>{focus.initials}</span><TierPill tier={focus.tier} /><h2>{focus.name}</h2><p>{focus.mastery}% mastery in Forces & Motion</p><div className="drawer-metric"><span>Next move</span><b>{focus.misconception ?? "Keep building independent practice."}</b></div><div className="drawer-metric"><span>Confident errors</span><b>{focus.confidentWrongCount ?? 0} · Confused attempts {focus.confusedWrongCount ?? 0}</b></div><div className="drawer-metric"><span>Why this was detected</span><b>{focus.misconception ? `Observed pattern: ${focus.misconception}. Confidence signal is used to choose the intervention.` : "No active misconception."}</b></div><button className="btn btn--ink" onClick={() => setFocus(null)}>Plan a 5-minute check-in</button></article></div>}{showScanner && <PaperScanner classId={data.classroom.id} isOpen={showScanner} onClose={() => setShowScanner(false)} topics={data.classroom.topics} classRoster={data.learners} />}{showPrint && <PrintableSlipGenerator className={data.classroom.name} onClose={() => setShowPrint(false)} />}{liveSession && <div className="live-overlay"><div className="live-overlay__card"><button className="drawer-close" onClick={() => createLive.reset()}><X size={18} /></button><div className="eyebrow"><Zap size={14} />Live session ready</div><h2>Join code</h2><strong className="join-code">{liveSession.joinCode}</strong><p>Students open <b>/join/{liveSession.joinCode}</b> on their device and enter their name.</p><div className="live-qr-placeholder">Scan or type the code<br /><small>QR projection placeholder · {data.classroom.name}</small></div><button className="btn btn--student" onClick={() => launchLive.mutate({ joinCode: liveSession.joinCode })}>{launchLive.isPending ? "Launching…" : "Launch questions"}</button></div></div>}</div>;
}
