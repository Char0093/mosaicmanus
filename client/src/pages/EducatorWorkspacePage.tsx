import { useMemo, useRef, useState } from "react";
import { BookOpen, Check, FileUp, Plus, School, Sparkles, UploadCloud } from "lucide-react";
import { trpc } from "@/lib/trpc";
import CreateQuizModal from "@/components/teacher/CreateQuizModal";

const starterQuestions = [
  { id: "q1", prompt: "Which statement best describes mass?", options: ["The pull of gravity", "The amount of matter", "A push or pull", "How fast something moves"] },
  { id: "q2", prompt: "What changes between Earth and the Moon?", options: ["Mass", "The amount of matter", "Weight", "The object itself"] },
  { id: "q3", prompt: "What tool measures weight?", options: ["Balance", "Spring scale", "Ruler", "Thermometer"] },
];

export default function EducatorWorkspacePage() {
  const workspace = trpc.mosaic.workspace.useQuery();
  const teacherQuestions = trpc.mosaic.teacherQuestions.useQuery();
  const setQuestionActive = trpc.mosaic.setTeacherQuestionActive.useMutation({ onSuccess: () => teacherQuestions.refetch() });
  const deleteQuestion = trpc.mosaic.deleteTeacherQuestion.useMutation({ onSuccess: () => teacherQuestions.refetch() });
  const openClassroom = trpc.mosaic.openClassroom.useMutation({ onSuccess: () => workspace.refetch() });
  const createChapter = trpc.mosaic.createChapter.useMutation({ onSuccess: () => { workspace.refetch(); setChapterTitle(""); setChapterDescription(""); } });
  const uploadQuiz = trpc.mosaic.uploadQuiz.useMutation({ onSuccess: () => { workspace.refetch(); setQuizTitle(""); setQuizFileName(""); setQuizQuestions(starterQuestions); } });
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterDescription, setChapterDescription] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [quizFileName, setQuizFileName] = useState("");
  const [quizQuestions, setQuizQuestions] = useState(starterQuestions);
  const [classroomName, setClassroomName] = useState("");
  const [classroomSubject, setClassroomSubject] = useState("");
  const [notice, setNotice] = useState("");
  const [createQuizOpen, setCreateQuizOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chapters = workspace.data?.chapters ?? [];
  const quizzes = workspace.data?.quizzes ?? [];
  const questionsPreview = useMemo(() => quizQuestions.slice(0, 3), [quizQuestions]);

  const parseQuizFile = async (file: File) => {
    setQuizFileName(file.name);
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as { title?: string; questions?: typeof starterQuestions };
      if (parsed.title) setQuizTitle(parsed.title);
      if (Array.isArray(parsed.questions) && parsed.questions.length) setQuizQuestions(parsed.questions);
      setNotice("Quiz file read. Review the questions, then save it to the selected chapter.");
    } catch {
      const rows = text.split(/\r?\n/).map((row) => row.split(",").map((cell) => cell.trim())).filter((row) => row.length >= 2 && row[0]);
      if (rows.length) setQuizQuestions(rows.slice(0, 20).map((row, index) => ({ id: `imported-${index + 1}`, prompt: row[0], options: row.slice(1, 5).length >= 2 ? row.slice(1, 5) : ["True", "False"] })));
      setNotice("CSV-style quiz file read. Review the questions, then save it to the selected chapter.");
    }
  };

  if (workspace.isLoading || !workspace.data) return <div className="app-loading"><div className="mosaic-mark">M</div><p>Opening educator workspace…</p></div>;
  const { classroom } = workspace.data;
  return <main className="workspace-page"><header className="workspace-header"><a href="/teacher" className="brand"><span className="mosaic-mark">M</span><span>Mosaic<span>Classroom</span></span></a><div className="workspace-header__right"><span className="role-chip"><School size={14} />Educator workspace</span><button className="btn btn--student" onClick={() => setCreateQuizOpen(true)}>Create quiz <Plus size={15} /></button><a className="text-button" href="/teacher">Back to dashboard</a><a className="btn btn--student" href="/login/student">Student login</a></div></header><section className="workspace-hero"><div><div className="eyebrow"><Sparkles size={14} />Classroom builder</div><h1>Open a classroom that has a clear next step.</h1><p>Set up chapters, upload a quiz, and publish only when your materials are ready for students and tutors.</p></div><div className="workspace-hero__state"><span>Current classroom</span><b>{classroom.name}</b><small>{classroom.subject} · code {classroom.kioskCode}</small></div></section>{notice && <div className="workspace-notice"><Check size={16} />{notice}</div>}<section className="workspace-grid"><article className="workspace-card workspace-card--open"><div className="workspace-card__heading"><div><div className="eyebrow">1 · Open classroom</div><h2>Create a new room</h2></div><School size={19} /></div><p>Educators own the room. Students and tutors join only through the access you share.</p><div className="form-grid"><label>Classroom name<input value={classroomName} onChange={(event) => setClassroomName(event.target.value)} placeholder="e.g. 3A Science" /></label><label>Subject<input value={classroomSubject} onChange={(event) => setClassroomSubject(event.target.value)} placeholder="e.g. Biology" /></label></div><button className="btn btn--ink" disabled={!classroomName || !classroomSubject || openClassroom.isPending} onClick={() => openClassroom.mutate({ name: classroomName, subject: classroomSubject, topics: [classroomSubject, "Practice", "Reflection"] })}>{openClassroom.isPending ? "Opening…" : "Open classroom"}<Plus size={16} /></button></article><article className="workspace-card"><div className="workspace-card__heading"><div><div className="eyebrow">2 · Build chapters</div><h2>Sequence the learning</h2></div><BookOpen size={19} /></div><p>Chapters keep the teacher plan, student mission, and tutor support in one place.</p><div className="chapter-list">{chapters.map((chapter) => <div className="chapter-row" key={chapter.id}><span>{chapter.orderIndex}</span><div><b>{chapter.title}</b><small>{chapter.description}</small></div><i>{chapter.published ? "Published" : "Draft"}</i></div>)}</div><div className="compact-form"><input value={chapterTitle} onChange={(event) => setChapterTitle(event.target.value)} placeholder="Chapter title" /><input value={chapterDescription} onChange={(event) => setChapterDescription(event.target.value)} placeholder="What should learners understand?" /><button className="btn btn--soft" disabled={!chapterTitle || !chapterDescription || createChapter.isPending} onClick={() => createChapter.mutate({ title: chapterTitle, description: chapterDescription, published: false })}><Plus size={15} />Add chapter</button></div></article><article className="workspace-card workspace-card--quiz"><div className="workspace-card__heading"><div><div className="eyebrow">3 · Upload a quiz</div><h2>Bring your own questions</h2></div><UploadCloud size={19} /></div><p>Upload a JSON or CSV-style file, review the question preview, then attach it to a chapter.</p><input ref={fileRef} type="file" accept=".json,.csv,.txt" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void parseQuizFile(file); }} /><div className="upload-drop" onClick={() => fileRef.current?.click()}><FileUp size={24} /><b>{quizFileName || "Choose a quiz file"}</b><small>JSON or CSV · review before publishing</small></div><div className="form-grid"><label>Quiz title<input value={quizTitle} onChange={(event) => setQuizTitle(event.target.value)} placeholder="e.g. Chapter 1 check" /></label><label>Attach to chapter<select defaultValue={chapters[0]?.id ?? ""}><option value="">No chapter yet</option>{chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label></div><div className="quiz-preview">{questionsPreview.map((question, index) => <div key={question.id}><b>Q{index + 1}</b><span>{question.prompt}</span><small>{question.options.join(" · ")}</small></div>)}</div><button className="btn btn--student" disabled={!quizTitle || uploadQuiz.isPending} onClick={() => uploadQuiz.mutate({ title: quizTitle, chapterId: chapters[0]?.id ?? null, sourceFilename: quizFileName || "manual-entry", questions: quizQuestions, published: false })}>{uploadQuiz.isPending ? "Saving…" : "Save quiz draft"}<UploadCloud size={16} /></button></article></section><section className="workspace-questions"><div className="workspace-section-heading"><div><div className="eyebrow">Teacher question bank</div><h2>My questions</h2><p>Students receive active questions in their next mission.</p></div><button className="btn btn--soft" onClick={() => setCreateQuizOpen(true)}><Plus size={15} />Add question</button></div><div className="question-table">{teacherQuestions.data?.length ? teacherQuestions.data.map((question) => <div className="question-table__row" key={question.id}><div><b>{question.topic}</b><span>{question.questionText}</span></div><small>{new Date(question.createdAt).toLocaleDateString()}</small><label className="toggle-label"><input type="checkbox" checked={question.isActive} onChange={(event) => setQuestionActive.mutate({ id: question.id, active: event.target.checked })} /> Active</label><button className="link-button link-button--danger" onClick={() => { if (window.confirm("Delete this question?")) deleteQuestion.mutate({ id: question.id }); }}>Delete</button></div>) : <div className="empty-state">No teacher-created questions yet. Add one to give students a precise, teacher-written check.</div>}</div></section><section className="workspace-library"><div><div className="eyebrow">Published materials</div><h2>Ready for your classroom</h2></div><div className="library-grid">{quizzes.map((quiz) => <article key={quiz.id}><div className="eyebrow">Quiz · {quiz.questionCount} questions</div><h3>{quiz.title}</h3><p>{quiz.sourceFilename || "Manual entry"}</p><span className={quiz.published ? "status-pill status-pill--live" : "status-pill"}>{quiz.published ? "Published" : "Draft"}</span></article>)}</div></section>{createQuizOpen && <CreateQuizModal classroomName={classroom.name} subject={classroom.subject} topics={classroom.topics} onClose={() => setCreateQuizOpen(false)} onSaved={() => { teacherQuestions.refetch(); setNotice("Question added! Students will see it in their next mission."); }} />} </main>;
}
