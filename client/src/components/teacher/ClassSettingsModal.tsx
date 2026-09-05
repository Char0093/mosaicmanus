import { useEffect, useState } from "react";
import { Check, Copy, Download, RefreshCw, Settings, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { YEAR_LEVELS } from "@shared/mosaic";
import type { CreatedClass } from "./CreateClassModal";

type Props = { classroom: CreatedClass | null; open: boolean; onOpenChange: (open: boolean) => void; onUpdated: (classroom: CreatedClass) => void };

type Tab = "details" | "access" | "students";

export default function ClassSettingsModal({ classroom, open, onOpenChange, onUpdated }: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [copied, setCopied] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const students = trpc.mosaic.classStudents.useQuery({ id: classroom?.id ?? "" }, { enabled: Boolean(classroom && open && tab === "students") });
  const update = trpc.mosaic.updateClass.useMutation({ onSuccess: (updated) => { if (classroom && "kioskCode" in updated) onUpdated({ ...classroom, ...updated }); toast.success("Class details saved"); } });
  const regenerate = trpc.mosaic.regenerateClassCode.useMutation({ onSuccess: (result) => { if (classroom) { const next = { ...classroom, kioskCode: result.kioskCode }; onUpdated(next); } toast.success("Kiosk code regenerated"); } });
  useEffect(() => { if (classroom && open) { setName(classroom.name); setDescription(classroom.description); setYearLevel(classroom.yearLevel); setTab("details"); } }, [classroom, open]);
  if (!classroom) return null;
  const copyCode = async () => { await navigator.clipboard?.writeText(classroom.kioskCode); setCopied(true); toast.success("Kiosk code copied"); window.setTimeout(() => setCopied(false), 2000); };
  const filteredStudents = (students.data ?? []).filter((student) => student.name.toLowerCase().includes(studentSearch.toLowerCase()));
  const exportStudents = () => { const csv = ["Name,Tier,Last active", ...filteredStudents.map((student) => `${student.name},${student.tier},${student.recent}`)].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${classroom.name.replace(/[^a-z0-9]+/gi, "-")}-students.csv`; anchor.click(); URL.revokeObjectURL(url); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="class-settings-dialog"><DialogHeader><DialogTitle><Settings size={18} />Class settings</DialogTitle><DialogDescription>{classroom.name} · {classroom.subject}</DialogDescription></DialogHeader><div className="settings-tabs"><button className={tab === "details" ? "settings-tab settings-tab--active" : "settings-tab"} onClick={() => setTab("details")}>Details</button><button className={tab === "access" ? "settings-tab settings-tab--active" : "settings-tab"} onClick={() => setTab("access")}>Kiosk &amp; Access</button><button className={tab === "students" ? "settings-tab settings-tab--active" : "settings-tab"} onClick={() => setTab("students")}><Users size={14} />Students</button></div>{tab === "details" && <section className="settings-panel"><label>Class name<Input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Description<Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label><label>Year/Form level<select value={yearLevel} onChange={(event) => setYearLevel(event.target.value)}>{YEAR_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label><label>Subject<input value={classroom.subject} readOnly /></label><label>Created date<input value={new Date(classroom.createdAt).toLocaleDateString()} readOnly /></label><Button className="settings-save" onClick={() => update.mutate({ id: classroom.id, name, description, yearLevel })} disabled={update.isPending}>{update.isPending ? "Saving…" : "Save changes"}</Button></section>}{tab === "access" && <section className="settings-panel"><div className="class-code-box"><span>Your class code</span><strong>{classroom.kioskCode}</strong><div><Button onClick={copyCode}><Copy size={15} />{copied ? "Copied!" : "Copy code"}</Button><Button variant="outline" onClick={() => { if (window.confirm("Are you sure? Students using the old code will need the new one.")) regenerate.mutate({ id: classroom.id }); }} disabled={regenerate.isPending}><RefreshCw size={15} />{regenerate.isPending ? "Regenerating…" : "Regenerate"}</Button></div></div><div className="share-instructions"><b>Share this with your students:</b><span>1. Go to /kiosk</span><span>2. Type this code</span><span>3. Pick your name — no password needed</span></div><label className="kiosk-toggle"><input type="checkbox" defaultChecked /> <span><b>Kiosk mode</b><small>Students can join via a shared device with this code.</small></span></label></section>}{tab === "students" && <section className="settings-panel"><div className="student-list-toolbar"><Input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search students" /><Button variant="outline" onClick={exportStudents}><Download size={15} />Export CSV</Button></div><div className="settings-student-list">{filteredStudents.length ? filteredStudents.map((student) => <div className="settings-student-row" key={student.id}><span className="student-avatar">{student.initials}</span><div><b>{student.name}</b><small>Last active: {student.recent}</small></div><span className="tier-badge">{student.tier}</span><button aria-label={`Remove ${student.name}`} onClick={() => { if (window.confirm(`Remove ${student.name}?`)) toast.info("Student removal will be available when enrollment management is enabled."); }}><X size={14} /></button></div>) : <div className="empty-state">No enrolled students match this search.</div>}</div></section>}</DialogContent></Dialog>;
}
