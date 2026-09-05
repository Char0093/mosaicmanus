import { useRef, useState } from "react";
import { Camera, Check, FileImage, Loader2, ScanLine, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { PULSE_QUESTIONS, type Learner } from "@shared/mosaic";

type ScanRow = { student_name: string; matched_student_id: string | null; answers: Record<string, "A" | "B" | "C" | "D" | null>; misconceptions_detected: Array<{ label: string; option: string; name: string }> };

export default function PaperScanner({ classId, isOpen, onClose, classRoster }: { classId: string; isOpen: boolean; onClose: () => void; topics: string[]; classRoster: Learner[] }) {
  const [stage, setStage] = useState<"camera" | "processing" | "results" | "error">("camera");
  const [image, setImage] = useState<{ base64: string; type: "jpeg" | "png" | "webp"; url: string } | null>(null);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const scan = trpc.mosaic.scanPaper.useMutation();
  const confirm = trpc.mosaic.confirmScan.useMutation();
  if (!isOpen) return null;

  const readFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { const url = String(reader.result); const [header, base64] = url.split(","); const type = header.includes("png") ? "png" : header.includes("webp") ? "webp" : "jpeg"; setImage({ base64, type, url }); setStage("camera"); };
    reader.readAsDataURL(file);
  };
  const startScan = () => {
    if (!image) return;
    setStage("processing");
    scan.mutate({ imageBase64: image.base64, imageType: image.type, questionLabels: ["Q1", "Q2", "Q3"], correctAnswers: { Q1: "B", Q2: "B", Q3: "A" }, questionTexts: PULSE_QUESTIONS.map((question) => question.prompt) }, { onSuccess: (result) => { if (result.error) setStage("error"); else { setRows(result.results as ScanRow[]); setStage("results"); } }, onError: () => setStage("error") });
  };
  const updateAnswer = (rowIndex: number, label: string, value: string) => setRows((current) => current.map((row, index) => index === rowIndex ? { ...row, answers: { ...row.answers, [label]: value === "blank" ? null : value as "A" | "B" | "C" | "D" } } : row));
  const confirmScan = () => confirm.mutate({ results: rows, correctAnswers: { Q1: "B", Q2: "B", Q3: "A" } }, { onSuccess: (result) => { toast.success(`${result.processed} student answers processed`); onClose(); }, onError: () => toast.error("Could not update the class heatmap") });

  return <div className="scanner-overlay" role="dialog" aria-modal="true"><div className="scanner-backdrop" onClick={stage === "processing" ? undefined : onClose} /><section className="scanner-sheet"><header className="scanner-sheet__header"><div><div className="eyebrow"><ScanLine size={14} />Paper-first classroom</div><h2>Photograph answer slips</h2><p>Gemini Vision reads the page, then you approve every match before it changes the heatmap.</p></div><button className="drawer-close" onClick={onClose} disabled={stage === "processing"}><X size={18} /></button></header>{stage === "camera" && <div className="scanner-stage scanner-stage--camera"><div className="scanner-instructions"><div className="scanner-icon"><FileImage size={30} /></div><h3>Zero-device assessment</h3><p>Use one clear photo with the student names and answer bubbles visible.</p><div className="scanner-actions"><button className="btn btn--ink" onClick={() => cameraRef.current?.click()}><Camera size={16} />Open camera</button><button className="btn btn--soft" onClick={() => uploadRef.current?.click()}><Upload size={16} />Upload image</button></div><input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={(event) => readFile(event.target.files?.[0])} /><input ref={uploadRef} hidden type="file" accept="image/*" onChange={(event) => readFile(event.target.files?.[0])} /></div>{image && <div className="scanner-preview"><img src={image.url} alt="Uploaded answer slips" /><button className="btn btn--student" onClick={startScan}><ScanLine size={16} />Scan with AI</button></div>}</div>}{stage === "processing" && <div className="scanner-stage scanner-stage--processing"><div className="scanner-loader"><Loader2 size={35} /></div><h3>Reading answer slips…</h3><p>Matching names, answers, and likely misconceptions.</p><div className="processing-dots"><i /><i /><i /></div></div>}{stage === "error" && <div className="scanner-stage scanner-stage--processing"><div className="scanner-icon scanner-icon--error"><ScanLine size={30} /></div><h3>Could not read the slips clearly</h3><p>Try better lighting, hold the camera steady, or use printed slips.</p><button className="btn btn--ink" onClick={() => setStage("camera")}>Try again</button></div>}{stage === "results" && <div className="scanner-stage scanner-stage--results"><div className="scan-summary"><div><span className="eyebrow">Review before publishing</span><h3>{rows.length} slips detected</h3><p>{rows.filter((row) => row.matched_student_id).length} matched · {rows.filter((row) => !row.matched_student_id).length} unmatched</p></div><button className="btn btn--soft" onClick={() => setStage("camera")}>Scan another page</button></div><div className="scan-table"><div className="scan-table__head"><span>Student</span><span>Q1</span><span>Q2</span><span>Q3</span><span>Signal</span></div>{rows.map((row, rowIndex) => <div className={row.matched_student_id ? "scan-row" : "scan-row scan-row--unmatched"} key={`${row.student_name}-${rowIndex}`}><div><b>{row.student_name}</b><small>{row.matched_student_id ? classRoster.find((learner) => learner.id === row.matched_student_id)?.name ?? "Matched" : "Needs manual match"}</small></div>{["Q1", "Q2", "Q3"].map((label) => <select key={label} value={row.answers[label] ?? "blank"} onChange={(event) => updateAnswer(rowIndex, label, event.target.value)}><option value="blank">—</option>{["A", "B", "C", "D"].map((option) => <option key={option} value={option}>{option}</option>)}</select>)}<span className="scan-signal">{row.misconceptions_detected.length ? "Needs review" : "Secure"}</span></div>)}</div><button className="btn btn--student scanner-confirm" onClick={confirmScan} disabled={confirm.isPending}><Check size={16} />{confirm.isPending ? "Updating heatmap…" : "Confirm & update heatmap"}</button></div>}</section></div>;
}
