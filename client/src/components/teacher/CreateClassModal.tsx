import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { SUBJECTS, YEAR_LEVELS } from "@shared/mosaic";

export type CreatedClass = { id: string; slug: string; name: string; subject: string; yearLevel: string; description: string; kioskCode: string; topics: string[]; createdAt: string };

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (classroom: CreatedClass) => void };

function newCode() { return Math.random().toString(36).substring(2, 9).toUpperCase(); }

export default function CreateClassModal({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0].name);
  const [topics, setTopics] = useState<string[]>([...SUBJECTS[0].default_topics]);
  const [topicInput, setTopicInput] = useState("");
  const [error, setError] = useState("");
  const [previewCode, setPreviewCode] = useState(newCode);
  const [createdClass, setCreatedClass] = useState<CreatedClass | null>(null);
  const createClass = trpc.mosaic.createClass.useMutation();
  const selectedSubject = useMemo(() => SUBJECTS.find((item) => item.name === subject) ?? SUBJECTS[0], [subject]);

  useEffect(() => { if (open) { setStep(1); setError(""); setPreviewCode(newCode()); setCreatedClass(null); } }, [open]);
  useEffect(() => { setTopics([...selectedSubject.default_topics]); }, [selectedSubject]);

  const addTopic = () => { const value = topicInput.trim(); if (value && !topics.some((item) => item.toLowerCase() === value.toLowerCase())) setTopics((current) => [...current, value]); setTopicInput(""); };
  const removeTopic = (topic: string) => setTopics((current) => current.filter((item) => item !== topic));
  const goNext = () => {
    setError("");
    if (step === 1 && (!name.trim() || !yearLevel)) { setError("Add a class name and choose a year level."); return; }
    if (step === 2 && topics.length === 0) { setError("Choose at least one topic to continue."); return; }
    setStep((current) => Math.min(3, current + 1));
  };
  const submit = () => {
    setError("");
    createClass.mutate({ name: name.trim(), subject, yearLevel, topics, description: description.trim() || undefined }, { onSuccess: (created) => { toast.success(`Class created! Your kiosk code is ${created.kioskCode}`); setCreatedClass(created); onCreated(created); }, onError: (cause) => setError(cause.message || "Could not create this class. Please try again.") });
  };
  const copyCode = async () => { await navigator.clipboard?.writeText(previewCode); toast.success("Preview code copied"); };
  const copyCreatedCode = async () => { if (!createdClass) return; await navigator.clipboard?.writeText(createdClass.kioskCode); toast.success("Kiosk code copied"); };

  if (createdClass) return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-class-dialog class-created-dialog"><DialogHeader><DialogTitle><Check size={20} />Class created!</DialogTitle><DialogDescription>Your classroom is ready. Share the kiosk code with your students.</DialogDescription></DialogHeader><section className="class-created-success"><h2>{createdClass.name}</h2><p>{createdClass.subject} · {createdClass.yearLevel} · 0 students</p><span>Your kiosk code</span><strong>{createdClass.kioskCode}</strong><Button onClick={copyCreatedCode}><Copy size={15} />Copy code</Button><small>Students go to <b>/kiosk</b>, type this code, and pick their name — no password needed.</small></section><div className="class-wizard-actions"><Button type="button" onClick={() => onOpenChange(false)}>Go to my dashboard <ArrowRight size={15} /></Button></div></DialogContent></Dialog>;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="create-class-dialog"><DialogHeader><DialogTitle>Create a new class</DialogTitle><DialogDescription>Set up a classroom space, then share its code with students.</DialogDescription></DialogHeader><div className="class-wizard-progress"><i style={{ width: `${(step / 3) * 100}%` }} /></div><div className="class-wizard-steps"><span className={step >= 1 ? "active" : ""}>1 Identity</span><span className={step >= 2 ? "active" : ""}>2 Subject</span><span className={step >= 3 ? "active" : ""}>3 Review</span></div>{step === 1 && <section className="class-wizard-panel"><label>Class name<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Form 2A Science" autoFocus /></label><label>Year/Form level<select value={yearLevel} onChange={(event) => setYearLevel(event.target.value)}><option value="">Choose a level</option>{YEAR_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label><label>Description <span className="field-note">optional</span><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you teaching this term?" rows={3} /></label></section>}{step === 2 && <section className="class-wizard-panel"><label>Subject<select value={subject} onChange={(event) => setSubject(event.target.value)}>{SUBJECTS.map((item) => <option key={item.name} value={item.name}>{item.icon} {item.name}</option>)}</select></label><label>Topics <span className="field-note">choose or add your own</span><div className="topic-tags">{topics.map((topic) => <span key={topic}>{topic}<button type="button" onClick={() => removeTopic(topic)} aria-label={`Remove ${topic}`}><X size={12} /></button></span>)}</div><div className="topic-input"><Input value={topicInput} onChange={(event) => setTopicInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTopic(); } }} placeholder="Type a topic" /><Button type="button" variant="outline" onClick={addTopic}><Plus size={15} />Add</Button></div></label></section>}{step === 3 && <section className="class-wizard-panel class-review"><div className="review-summary"><span>Class name</span><b>{name}</b><span>Year level</span><b>{yearLevel}</b><span>Subject</span><b>{selectedSubject.icon} {subject}</b><span>Topics</span><div className="review-topics">{topics.map((topic) => <span key={topic}>{topic}</span>)}</div></div><div className="kiosk-code-preview"><span>Your kiosk code</span><strong>{previewCode}</strong><button type="button" onClick={copyCode}><Copy size={14} />Copy code</button><p>Share this code with students to let them join via any device — no account needed.</p></div></section>}{error && <p className="class-wizard-error">{error}</p>}<div className="class-wizard-actions">{step > 1 ? <Button type="button" variant="outline" onClick={() => { setError(""); setStep((current) => current - 1); }}><ArrowLeft size={15} />Back</Button> : <span />}{step < 3 ? <Button type="button" onClick={goNext}>Next <ArrowRight size={15} /></Button> : <Button type="button" onClick={submit} disabled={createClass.isPending}><Check size={15} />{createClass.isPending ? "Creating…" : "Create class"} <ArrowRight size={15} /></Button>}</div></DialogContent></Dialog>;
}
