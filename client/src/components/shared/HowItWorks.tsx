import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import TutorialSlide from "./TutorialSlide";

type TutorialRole = "teacher" | "student" | "general";
type Slide = { title: string; body: string; tip?: string; art: ReactNode };

const MockCard = ({ children, tone = "navy" }: { children: ReactNode; tone?: string }) => <div className={`tutorial-mock-card tutorial-mock-card--${tone}`}>{children}</div>;
const Dots = ({ colors = ["red", "red", "amber", "green", "blue", "green", "amber", "blue"] }: { colors?: string[] }) => <div className="tutorial-dots">{colors.map((color, index) => <i className={`tutorial-dot tutorial-dot--${color}`} key={`${color}-${index}`} style={{ width: `${24 + (index % 3) * 6}px`, height: `${24 + (index % 3) * 6}px` }} />)}</div>;
const ProgressRows = () => <div className="tutorial-progress-rows">{[28, 37, 25].map((value, index) => <div key={index}><span>{["Forces & Motion", "Living Things", "Matter & Properties"][index]}</span><i><b style={{ width: `${value}%` }} /></i></div>)}</div>;

function Art({ type }: { type: string }) {
  if (type === "welcome-teacher") return <div className="tutorial-emoji tutorial-emoji--radiate">🎓</div>;
  if (type === "welcome-student") return <div className="tutorial-emoji tutorial-emoji--glow">✨</div>;
  if (type === "ready-teacher") return <div className="tutorial-emoji tutorial-emoji--glow">🎯</div>;
  if (type === "ready-student") return <div className="tutorial-emoji tutorial-emoji--glow">🚀</div>;
  if (type === "action") return <MockCard><b>6 students are confusing<br />mass with weight</b><small>Try next: sort “matter” vs “gravity’s pull”</small></MockCard>;
  if (type === "cohort") return <div className="tutorial-columns">{["Rebuild", "Repair", "Practice", "Extend"].map((label, index) => <div key={label}><small>{label}</small><Dots colors={index === 0 ? ["red", "red", "red"] : index === 1 ? ["amber", "amber", "amber"] : index === 2 ? ["green", "green", "green"] : ["blue", "blue", "blue"]} /></div>)}</div>;
  if (type === "heatmap") return <div className="tutorial-heatmap">{Array.from({ length: 12 }, (_, index) => <i className={index === 4 ? "outline" : index % 5 === 0 ? "hot" : index % 3 === 0 ? "warm" : "clear"} key={index} />)}</div>;
  if (type === "groups") return <div className="tutorial-group-cards">{[["Rebuild", "6", "red"], ["Repair", "5", "amber"], ["Practice", "5", "green"], ["Extend", "4", "blue"]].map(([label, count, tone]) => <div className={`tutorial-group-card tutorial-group-card--${tone}`} key={label}><b>{label} {count}</b><Dots colors={[tone, tone, tone]} /></div>)}</div>;
  if (type === "kiosk") return <div className="tutorial-tablet"><div className="tutorial-roster">{["Hana Yusof", "Adam Ibrahim", "Nadia Farhana"].map((name) => <span key={name}>{name}<ArrowRight size={12} /></span>)}</div></div>;
  if (type === "scanner") return <div className="tutorial-scanner"><div className="tutorial-phone">📷</div><div className="tutorial-paper">A B C<br />✓ ○ ✓</div><ArrowRight size={22} /></div>;
  if (type === "missions") return <div className="tutorial-mission-cards"><MockCard tone="navy"><b>Repair</b><small>Fix one thinking error</small></MockCard><MockCard tone="green"><b>Practice</b><small>Build your confidence</small></MockCard><MockCard tone="blue"><b>Extend</b><small>Try a real-world challenge</small></MockCard></div>;
  if (type === "question") return <MockCard tone="paper"><b>Which statement is true?</b><div className="tutorial-options"><span>A</span><span>B</span><span>C</span><span>D</span></div><div className="tutorial-confidence"><span>🎲</span><span>🤔</span><span>✓</span></div></MockCard>;
  if (type === "feedback") return <div className="tutorial-feedback"><MockCard tone="green"><b>✓ Correct</b><small>Confidence confirmed.</small></MockCard><MockCard tone="warm"><b>💡 Useful clue</b><small>Your thinking gave us a clue.</small></MockCard></div>;
  if (type === "mastery") return <div className="tutorial-mastery"><ProgressRows /><div className="tutorial-radar-placeholder">◈</div></div>;
  if (type === "split") return <div className="tutorial-split"><div className="tutorial-mini-heatmap"><Dots colors={["red", "green", "amber"]} /></div><ArrowRight size={20} /><MockCard tone="navy"><b>Next mission</b><small>Practice mass and weight</small></MockCard></div>;
  if (type === "old-new") return <div className="tutorial-old-new"><MockCard tone="warm"><b>✕ Test score: 40%</b><small>Vague · delayed</small></MockCard><MockCard tone="green"><b>✓ Thinking error</b><small>6 students · detected now</small></MockCard></div>;
  if (type === "flow") return <div className="tutorial-flow"><span>Student answers</span><ArrowRight size={18} /><span>AI classifies</span><ArrowRight size={18} /><span>Card updates</span></div>;
  return <div className="tutorial-three-ways"><span>💻<small>Full digital</small></span><span>📱<small>Kiosk</small></span><span>📄<small>Paper first</small></span></div>;
}

function teacherSlides(): Slide[] { return [
  { art: <Art type="welcome-teacher" />, title: "Welcome to Mosaic Classroom, Ms. Aida.", body: "Mosaic Classroom shows you not just who is struggling, but exactly why—and tells you what to do about it right now, mid-lesson. No more waiting for test results.", tip: "The whole system updates in real time as your students answer questions." },
  { art: <Art type="action" />, title: "Your dashboard starts with one decision.", body: "The Teacher Action Card reads your class data and tells you the single most important thing to address right now—and exactly how to address it in 5–10 minutes.", tip: "The card updates automatically every time a student submits an answer." },
  { art: <Art type="cohort" />, title: "See every student in one picture.", body: "The Cohort Map shows one bubble per student, coloured by their tier. Bubble size shows mastery, and tapping a bubble opens the learner profile.", tip: "Students with a pulsing red ring need urgent attention." },
  { art: <Art type="heatmap" />, title: "See which idea is spreading across the room.", body: "Concept Signals shows understanding per topic. Solid red means confident but wrong; outlined red means a guessed answer. Right-click any cell for actions.", tip: "Sort by Priority to put students who need help most at the top." },
  { art: <Art type="groups" />, title: "Four groups. Four tasks. One classroom.", body: "Mosaic groups learners by what they need next. Each group gets a different task, and Generate repair slip creates a printable exercise for struggling groups.", tip: "Peer Bridge shows which high-performing students can explain a concept to a struggling peer." },
  { art: <Art type="kiosk" />, title: "One tablet. Thirty students. No logins.", body: "Kiosk Mode gives a shared tablet a class roster. Each student taps their name, answers three questions, sees feedback, and passes the device on.", tip: "Project the class code so students can join from any device." },
  { art: <Art type="scanner" />, title: "No devices at all? No problem.", body: "Print answer slips, photograph them with Scan slips, and Gemini reads every answer simultaneously to update your heatmap. Zero student devices required.", tip: "You only need your own phone connected to WiFi." },
  { art: <Art type="ready-teacher" />, title: "You’re ready to run your first Mosaic lesson.", body: "Open your dashboard, read the Action Card, and start your lesson. Class data updates as students work; check the Cohort Map after ten minutes to see the class picture form." },
]; }
function studentSlides(): Slide[] { return [
  { art: <Art type="welcome-student" />, title: "Your learning path is made just for you.", body: "Mosaic does not give everyone the same questions. Every question is chosen based on what you specifically need to work on. The more you answer, the better it knows you.", tip: "Your answers are private. Your teacher sees the overall pattern—not your individual answers." },
  { art: <Art type="missions" />, title: "Missions replace worksheets.", body: "Each mission targets the exact idea you are working on. Repair missions fix a thinking error, Practice missions build speed, and Extend missions challenge you with real-world applications.", tip: "Missions take 3–5 minutes and fit between lessons or at the start of class." },
  { art: <Art type="question" />, title: "Tell us how sure you felt. It matters.", body: "After picking an answer, tap how confident you felt. This makes your progress score honest—not just lucky.", tip: "There is no penalty for saying ‘I guessed’. Honesty helps the system choose better questions." },
  { art: <Art type="feedback" />, title: "Wrong answers are learning signals.", body: "When you get something wrong, Mosaic names the exact idea you were using and explains why it does not work. The next question helps you correct it.", tip: "Tap the explanation on a feedback card to see how to think about it differently." },
  { art: <Art type="mastery" />, title: "Watch your understanding grow.", body: "Your Mastery Map shows how well you understand each topic right now. Red means an active thinking error, green means mastered, and blue means you are ready for challenge questions.", tip: "Tap My analytics to see your full learning history." },
  { art: <Art type="ready-student" />, title: "Start your first mission.", body: "Tap Continue mission to begin. It takes about 3–5 minutes, and you will see exactly where your understanding stands. Your teacher sees the class picture—not your individual answers." },
]; }
function generalSlides(): Slide[] { return [
  { art: <Art type="split" />, title: "One classroom. Two very different views.", body: "Mosaic Classroom is a diagnostic learning platform. Teachers see thinking errors spreading across the room while students get questions chosen for exactly what they need." },
  { art: <Art type="old-new" />, title: "Not who is struggling. Why.", body: "Most platforms tell a teacher that a student scored 40%. Mosaic shows the thinking error behind that score—and how many classmates share it right now." },
  { art: <Art type="flow" />, title: "The AI explains itself. Always.", body: "When Mosaic detects a thinking error, it shows the pattern, confidence, and reasoning. Teachers can override any classification with one click.", tip: "AI is constrained to a pre-built library of known, auditable thinking errors." },
  { art: <Art type="ways" />, title: "Works in any classroom. Even without WiFi.", body: "Use full digital, one shared kiosk tablet, or printed paper slips. The heatmap updates regardless of how students answer." },
]; }

export default function HowItWorks({ role, isOpen, onClose }: { role: TutorialRole; isOpen: boolean; onClose: () => void }) {
  const [activeRole, setActiveRole] = useState<TutorialRole>(role);
  const [open, setOpen] = useState(isOpen);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const slides = useMemo(() => activeRole === "teacher" ? teacherSlides() : activeRole === "student" ? studentSlides() : generalSlides(), [activeRole]);
  useEffect(() => setOpen(isOpen), [isOpen]);
  useEffect(() => { if (role !== "general" && !autoTriggered && !localStorage.getItem(`mosaic_tutorial_seen_${role}`)) { const timer = window.setTimeout(() => { setOpen(true); setAutoTriggered(true); }, 1000); return () => window.clearTimeout(timer); } }, [autoTriggered, role]);
  useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); if (event.key === "ArrowRight") next(); if (event.key === "ArrowLeft") previous(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); });
  const close = () => { if (step >= 2 || activeRole === "general") localStorage.setItem(`mosaic_tutorial_seen_${activeRole}`, "true"); setOpen(false); onClose(); };
  const next = () => { if (step < slides.length - 1) { setDirection(1); setStep((value) => value + 1); } };
  const previous = () => { if (step > 0) { setDirection(-1); setStep((value) => value - 1); } };
  const changeRole = (nextRole: "teacher" | "student") => { setActiveRole(nextRole); setStep(0); setDirection(1); };
  return <Dialog open={open} onOpenChange={(value) => value ? setOpen(true) : close()}><DialogContent className="how-it-works-dialog"><DialogTitle className="sr-only">How Mosaic Classroom works</DialogTitle><div className="tutorial-header"><div><div className="eyebrow"><CircleHelp size={14} />How it works</div><div className="tutorial-role-toggle"><button className={activeRole === "teacher" ? "active" : ""} onClick={() => changeRole("teacher")}>View as Teacher</button><button className={activeRole === "student" ? "active" : ""} onClick={() => changeRole("student")}>View as Student</button></div></div><button className="tutorial-skip" onClick={close}>Skip tutorial <X size={13} /></button></div><div className="tutorial-progress"><i style={{ width: `${((step + 1) / slides.length) * 100}%` }} /></div><div className="tutorial-count">Step {step + 1} of {slides.length}</div><div className="tutorial-stage"><AnimatePresence initial={false} custom={direction} mode="wait"><motion.div key={`${activeRole}-${step}`} custom={direction} initial={{ opacity: 0, x: direction * 38 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -38 }} transition={{ duration: .22 }}><TutorialSlide illustration={slides[step].art} title={slides[step].title} body={slides[step].body} tip={slides[step].tip} /></motion.div></AnimatePresence></div><div className="tutorial-footer"><button className="tutorial-nav" onClick={previous} disabled={step === 0} aria-label="Previous slide"><ArrowLeft size={17} /></button><span>{activeRole === "teacher" ? "Teacher path" : "Student path"}</span>{step === slides.length - 1 ? <button className="btn btn--student tutorial-done" onClick={close}>{activeRole === "teacher" ? "Open my dashboard" : "Start my mission"} <ArrowRight size={16} /></button> : <button className="tutorial-nav" onClick={next} aria-label="Next slide"><ArrowRight size={17} /></button>}</div></DialogContent></Dialog>;
}
