import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import CreateQuizModal from "@/components/teacher/CreateQuizModal";

export default function CreateQuizPage() {
  const workspace = trpc.mosaic.workspace.useQuery();
  if (workspace.isLoading || !workspace.data) return <div className="app-loading"><div className="mosaic-mark">M</div><p>Opening quiz creator…</p></div>;
  const { classroom } = workspace.data;
  return <main className="create-quiz-page"><header className="workspace-header"><a href="/teacher" className="brand"><span className="mosaic-mark">M</span><span>Mosaic<span>Classroom</span></span></a><a className="text-button" href="/teacher"><ArrowLeft size={15} />Back to teacher dashboard</a></header><section className="create-quiz-page__intro"><div className="eyebrow">Teacher tools · {classroom.name}</div><h1>Create a quiz question</h1><p>Write a question your students will see in their next mission. The same misconception diagnosis will be applied to their answers.</p></section><CreateQuizModal classroomName={classroom.name} subject={classroom.subject} topics={classroom.topics} onClose={() => { window.location.href = "/teacher"; }} onSaved={() => { window.location.href = "/teacher"; }} /></main>;
}
