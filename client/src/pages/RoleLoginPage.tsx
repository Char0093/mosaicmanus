import { ArrowRight, BookOpen, GraduationCap, HandHelping, LockKeyhole, School } from "lucide-react";
import { startLogin } from "@/const";

type Role = "educator" | "tutor" | "student";
const copy: Record<Role, { label: string; title: string; body: string; icon: typeof School; destination: string; bullets: string[] }> = {
  educator: { label: "Educator login", title: "Open your teaching room.", body: "Create chapters, upload quizzes, and see the class picture without exposing student profiles.", icon: School, destination: "/educator", bullets: ["Classroom ownership", "Chapter and quiz builder", "Notifications for intervention"] },
  tutor: { label: "Tutor login", title: "Support the next small step.", body: "Join classrooms as a mentor, keep notes separate, and unlock Tutor Circle perks.", icon: HandHelping, destination: "/tutor/perks", bullets: ["Mentor-only workspace", "Student-safe access", "Claim tutor perks"] },
  student: { label: "Student login", title: "See your learning mosaic.", body: "Your dashboard is personal. You can see your own progress, not another student’s profile.", icon: GraduationCap, destination: "/student", bullets: ["Private learner dashboard", "Your analytics story", "No peer profile browsing"] },
};

export default function RoleLoginPage({ role }: { role: Role }) {
  const content = copy[role];
  const Icon = content.icon;
  const demo = () => { localStorage.setItem("mosaic-role", role); window.location.href = content.destination; };
  return <main className="role-login"><div className="role-login__art"><span className="mosaic-mark">M</span><div><b>Mosaic</b><small>Classroom</small></div></div><section className="role-login__card"><div className="role-login__icon"><Icon size={26} /></div><div className="eyebrow">{content.label}</div><h1>{content.title}</h1><p>{content.body}</p><div className="role-login__bullets">{content.bullets.map((bullet) => <span key={bullet}><LockKeyhole size={14} />{bullet}</span>)}</div><button className="btn btn--ink role-login__primary" onClick={() => { localStorage.setItem("mosaic-role", role); startLogin(); }}>Continue with Mosaic login <ArrowRight size={17} /></button><button className="btn btn--soft role-login__demo" onClick={demo}>Preview as {role} <ArrowRight size={16} /></button><small className="role-login__privacy">Your role is kept separate from student learning data.</small></section><nav className="role-login__switch"><a href="/login/educator">Educator</a><a href="/login/tutor">Tutor</a><a href="/login/student">Student</a></nav></main>;
}
