import { useState } from "react";
import { ArrowRight, CheckCircle2, Radio, Wifi } from "lucide-react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { PULSE_QUESTIONS, type PulseOption, type PulseQuestion } from "@shared/mosaic";

type ValidLiveSession = { valid: true; studentName: string; joinCode: string; questions: PulseQuestion[]; launched: boolean; classroom: { name: string; subject: string } };

export default function LiveJoinPage() {
  const params = useParams<{ code: string }>();
  const [name, setName] = useState("");
  const [submittedName, setSubmittedName] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const session = trpc.mosaic.joinLiveSession.useQuery({ joinCode: (params.code ?? "").toUpperCase(), studentName: submittedName || "pending" }, { enabled: Boolean(submittedName) });
  const liveSession = session.data?.valid ? session.data as ValidLiveSession : null;
  const question = liveSession?.questions[questionIndex] ?? (liveSession ? PULSE_QUESTIONS[questionIndex] : null);

  if (!submittedName) return <main className="live-join-page"><div className="live-join-card"><div className="live-code-mark"><Radio size={27} /></div><div className="eyebrow">Live pulse · {params.code?.toUpperCase()}</div><h1>Join the class check.</h1><p>Enter your name. No account, password, or email required.</p><form onSubmit={(event) => { event.preventDefault(); setSubmittedName(name.trim()); }}><label htmlFor="student-name">Your name</label><input id="student-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Hana Yusof" autoComplete="off" /><button className="btn btn--student" disabled={name.trim().length < 2}>Join <ArrowRight size={17} /></button></form></div></main>;
  if (!liveSession) return <main className="live-join-page"><div className="live-join-card"><div className="eyebrow">Session unavailable</div><h1>That pulse has closed.</h1><p>Ask your teacher for a new six-character join code.</p></div></main>;
  if (!liveSession.launched) return <main className="live-join-page"><div className="live-join-card"><Wifi size={27} /><div className="eyebrow">You’re in, {submittedName}</div><h1>Waiting for your teacher.</h1><p>The questions will appear when the teacher launches the live pulse.</p><span className="waiting-dots"><i /><i /><i /></span></div></main>;
  if (!question) return <main className="live-join-page"><div className="live-join-card"><CheckCircle2 size={35} /><div className="eyebrow">Pulse complete</div><h1>Nice work, {submittedName}.</h1><p>Your answers are with your teacher. Stay ready for the class reflection.</p></div></main>;
  return <main className="live-join-page"><div className="live-question-card"><div className="live-question-card__top"><span>Question {questionIndex + 1} of {liveSession.questions.length}</span><b>{submittedName}</b></div><div className="eyebrow">{liveSession.classroom.subject} · live pulse</div><h1>{question.prompt}</h1><div className="live-options">{question.options.map((option: PulseOption) => <button key={option.label} className={answers[questionIndex] === option.label ? "live-option live-option--selected" : "live-option"} onClick={() => setAnswers((current) => ({ ...current, [questionIndex]: option.label }))}><b>{option.label}</b>{option.value}</button>)}</div><button className="btn btn--student" disabled={!answers[questionIndex]} onClick={() => setQuestionIndex((index) => index + 1)}>{questionIndex === liveSession.questions.length - 1 ? "Finish pulse" : "Next question"}<ArrowRight size={17} /></button></div></main>;
}
