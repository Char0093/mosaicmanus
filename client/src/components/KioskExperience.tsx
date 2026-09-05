import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, CircleAlert, Headphones, KeyRound, Lightbulb, LockKeyhole, UserRound, Wifi, WifiOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { clearQueuedAnswers, listQueuedAnswers, queueAnswer } from "@/lib/offline";
import { PULSE_QUESTIONS, type Confidence, type Learner, tierMeta } from "@shared/mosaic";

function ConfidenceButtons({ value, onChange }: { value: Confidence; onChange: (value: Confidence) => void }) {
  const choices: { id: Confidence; label: string }[] = [{ id: "guessed", label: "I guessed" }, { id: "unsure", label: "Not sure" }, { id: "knew", label: "I knew this" }];
  return <div className="confidence-buttons">{choices.map((choice) => <button type="button" key={choice.id} className={value === choice.id ? "confidence-buttons__active" : ""} onClick={() => onChange(choice.id)}>{choice.label}</button>)}</div>;
}

function StudentQuiz({ learner, onReturn }: { learner: Learner; onReturn: () => void }) {
  const [option, setOption] = useState("");
  const [confidence, setConfidence] = useState<Confidence>("unsure");
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);
  const [offlineFeedback, setOfflineFeedback] = useState<string | null>(null);
  const quiz = trpc.mosaic.answerQuiz.useMutation();
  const syncOffline = trpc.mosaic.syncOffline.useMutation();
  const question = PULSE_QUESTIONS[0];
  const feedback = quiz.data ?? (offlineFeedback ? { correct: false, feedback: offlineFeedback } : null);

  const refreshQueue = async () => setQueuedCount((await listQueuedAnswers()).length);
  const flushQueue = async () => {
    if (!navigator.onLine) return;
    const pending = await listQueuedAnswers();
    if (!pending.length) return;
    syncOffline.mutate({ answers: pending.map(({ learnerId, option: queuedOption, confidence: queuedConfidence }) => ({ learnerId, option: queuedOption, confidence: queuedConfidence })) }, {
      onSuccess: async () => {
        await clearQueuedAnswers(pending.map((item) => item.id));
        await refreshQueue();
      },
    });
  };

  useEffect(() => {
    void refreshQueue();
    const handleOnline = () => { setIsOnline(true); void flushQueue(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, []);

  const handleCheck = async () => {
    if (!option) return;
    if (!navigator.onLine) {
      await queueAnswer({ learnerId: learner.id, option, confidence });
      await refreshQueue();
      setOfflineFeedback("Your answer is saved on this device. We’ll check it and update your teacher’s view when the connection returns.");
      return;
    }
    quiz.mutate({ learnerId: learner.id, option, confidence });
  };

  return <main className="student-page"><header className="student-header"><button className="icon-back" onClick={onReturn}><ArrowLeft size={19} /></button><div className="student-header__brand"><span className="mosaic-mark">M</span><b>Mosaic Classroom</b></div><span className="offline-ready">{isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}{isOnline ? "Online" : "Offline"}{queuedCount ? ` · ${queuedCount} saved` : ""}</span></header><div className="quiz-layout"><aside className="mission-rail"><div className="student-avatar" style={{ backgroundColor: tierMeta[learner.tier].color }}>{learner.initials}</div><h2>Hello, {learner.name.split(" ")[0]}.</h2><p>Your next small step is ready.</p><div className="mission-rail__step"><span>1</span><b>Warm up</b><small>Quick check</small></div><div className="mission-rail__step mission-rail__step--muted"><span>2</span><b>Practice</b><small>Build confidence</small></div><div className="mission-rail__step mission-rail__step--muted"><span>3</span><b>Reflect</b><small>Show what changed</small></div></aside><section className="quiz-card">{!feedback ? <><div className="quiz-card__header"><div><div className="eyebrow">{question.prompt.includes("mass") ? "Forces & Motion" : "Quick check"} · warm up</div><h1>Let’s sort out one idea.</h1></div><button className="tts-button" onClick={() => window.speechSynthesis?.speak(new SpeechSynthesisUtterance(question.prompt))}><Headphones size={18} />Listen</button></div><div className="question-number"><span>Question 1 of 3</span><div><i /></div></div><p className="question-prompt">{question.prompt}</p><div className="option-list">{question.options.map((item) => <button key={item.label} className={option === item.label ? "option-card option-card--selected" : "option-card"} onClick={() => setOption(item.label)}><b>{item.label}</b><span>{item.value}</span></button>)}</div><div className="confidence-area"><span>How sure are you?</span><ConfidenceButtons value={confidence} onChange={setConfidence} /></div><button className="btn btn--student" disabled={!option || quiz.isPending} onClick={() => void handleCheck()}>{quiz.isPending ? "Checking your thinking…" : isOnline ? "Check my answer" : "Save my answer"}<ChevronRight size={18} /></button></> : <><div className={feedback.correct ? "feedback-icon feedback-icon--good" : "feedback-icon feedback-icon--warm"}>{feedback.correct ? <CheckCircle2 size={30} /> : <Lightbulb size={30} />}</div><div className="eyebrow">{feedback.correct ? "A strong start" : offlineFeedback ? "Saved for sync" : "Misconception detected"}</div><h1>{feedback.correct ? "You’ve got the key idea." : offlineFeedback ? "Your answer is safe." : "Your thinking gave us a useful clue."}</h1><p className="feedback-copy">{feedback.feedback}</p>{!feedback.correct && !offlineFeedback && <div className="thinking-box"><CircleAlert size={19} /><div><b>Try this image</b><p>Move the same backpack from Earth to the Moon. What stays inside it? What changes because the pull of gravity changes?</p></div></div>}<button className="btn btn--student" onClick={onReturn}>Back to the class list</button></>}</section></div></main>;
}

export default function KioskExperience() {
  const [code, setCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState("");
  const [learner, setLearner] = useState<Learner | null>(null);
  const kiosk = trpc.mosaic.kiosk.useQuery({ code: submittedCode || "pending" }, { enabled: Boolean(submittedCode) });
  const hasRoster = kiosk.data?.valid;
  const intro = useMemo(() => ({ name: kiosk.data && "classroom" in kiosk.data ? kiosk.data.classroom?.name : "Your classroom", subject: kiosk.data && "classroom" in kiosk.data ? kiosk.data.classroom?.subject : "" }), [kiosk.data]);

  if (learner) return <StudentQuiz learner={learner} onReturn={() => setLearner(null)} />;

  return <main className="kiosk-page"><header className="kiosk-header"><a href="/" className="brand"><span className="mosaic-mark">M</span><span>Mosaic<span>Classroom</span></span></a><a href="/" className="return-teacher">Teacher view <ChevronRight size={15} /></a></header>{!hasRoster ? <section className="kiosk-entry"><div className="kiosk-entry__art"><div className="orbit orbit--one" /><div className="orbit orbit--two" /><div className="entry-symbol"><KeyRound size={39} /></div></div><div className="eyebrow">Shared-device classroom</div><h1>Start where you are.</h1><p>Enter the classroom code from your teacher. You’ll choose your name next—no password needed.</p><form onSubmit={(event) => { event.preventDefault(); setSubmittedCode(code); }}><label htmlFor="class-code">Classroom code</label><div className="code-input"><input id="class-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="e.g. MOSAIC01" autoComplete="off" /><button className="btn btn--student" type="submit" disabled={!code || kiosk.isFetching}>{kiosk.isFetching ? "Checking…" : "Continue"}<ChevronRight size={18} /></button></div>{kiosk.data && !kiosk.data.valid && <p className="form-error"><CircleAlert size={15} />{kiosk.data.message}</p>}</form><div className="entry-notes"><span><LockKeyhole size={15} />No login required</span><span><WifiOff size={15} />Works on shared devices</span></div></section> : <section className="roster-page"><div className="roster-heading"><div><div className="eyebrow">{intro.subject} · shared device</div><h1>Who’s learning now?</h1><p>Choose your name to continue your own learning path.</p></div><button className="text-button" onClick={() => { setSubmittedCode(""); setCode(""); }}><ArrowLeft size={15} />Change code</button></div><div className="roster-grid">{hasRoster && kiosk.data?.learners?.map((item) => <button className="roster-person" key={item.id} onClick={() => setLearner(item)}><span style={{ backgroundColor: tierMeta[item.tier].color }}>{item.initials}</span><div><b>{item.name}</b><small>{item.tier === "red" || item.tier === "yellow" ? "Continue your mission" : "Ready for your next step"}</small></div><ChevronRight size={18} /></button>)}</div><p className="privacy-note"><UserRound size={15} />Your answers are saved to your name only. Ask your teacher if you need help.</p></section>}</main>;
}
