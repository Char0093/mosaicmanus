import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, BookOpen, Loader2, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

type PanelRole = "teacher" | "student";

function RolePanel({ role, onRegister }: { role: PanelRole; onRegister: () => void }) {
  const [, navigate] = useLocation();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [roleIntent] = useState<PanelRole | null>(() => {
    const saved = localStorage.getItem("mosaic-role-intent");
    const startedAt = Number(localStorage.getItem("mosaic-role-intent-at") ?? 0);
    const isRecent = startedAt > 0 && Date.now() - startedAt < 10 * 60 * 1000;
    if (!isRecent) {
      localStorage.removeItem("mosaic-role-intent");
      localStorage.removeItem("mosaic-role-intent-at");
    }
    return isRecent && (saved === "teacher" || saved === "student") ? saved : null;
  });
  const teacher = role === "teacher";

  useEffect(() => {
    if (!auth.user || roleIntent !== role) return;
    const actualRole = auth.user.role;
    const roleMismatch = teacher ? actualRole === "student" : actualRole === "educator";
    if (roleMismatch) {
      setError(teacher ? "This account is registered as a student. Please use the student panel." : "This account is registered as a teacher. Please use the teacher panel.");
      localStorage.removeItem("mosaic-role-intent");
      localStorage.removeItem("mosaic-role-intent-at");
      return;
    }
    localStorage.removeItem("mosaic-role-intent");
    localStorage.removeItem("mosaic-role-intent-at");
    navigate(teacher ? "/teacher" : "/student");
  }, [auth.user, navigate, role, roleIntent, teacher]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password to continue.");
      return;
    }
    setBusy(true);
    localStorage.setItem("mosaic-role-intent", role);
    localStorage.setItem("mosaic-role-intent-at", String(Date.now()));
    startLogin();
  };

  return <section className={`login-panel login-panel--${role} ${focused ? "login-panel--focused" : ""}`} onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}><div className="login-panel__label">{teacher ? <UserRound size={18} /> : <BookOpen size={18} />}<span>I’m a {teacher ? "teacher" : "student"}</span></div><p>{teacher ? "Manage your class and act on live insights" : "Continue your learning path"}</p><form onSubmit={submit}><label htmlFor={`${role}-email`}>Email<input id={`${role}-email`} value={email} onChange={(event) => setEmail(event.target.value)} placeholder={teacher ? "teacher@school.edu" : "your school email"} type="email" autoComplete="email" /></label><label htmlFor={`${role}-password`}>Password<input id={`${role}-password`} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" type="password" autoComplete={teacher ? "current-password" : "current-password"} /></label><Button type="submit" className="login-panel__button" disabled={busy}>{busy ? <><Loader2 className="animate-spin" size={16} />Signing in…</> : <>Sign in <ArrowRight size={16} /></>}</Button>{error && <Alert variant="destructive" className="login-error"><AlertCircle size={15} /><AlertDescription>{error}</AlertDescription></Alert>}</form>{teacher ? <button className="login-link" onClick={onRegister}>New here? Create a teacher account</button> : <a className="login-link" href="/kiosk">No account? Join with a class code <ArrowRight size={14} /></a>}</section>;
}

export default function LoginLandingPage() {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerBusy, setRegisterBusy] = useState(false);

  useEffect(() => {
    const message = sessionStorage.getItem("mosaic-toast");
    if (message) {
      sessionStorage.removeItem("mosaic-toast");
      toast.success(message);
    }
  }, []);

  const register = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name || !email || password.length < 8 || password !== confirm) {
      setRegisterError(password !== confirm ? "The passwords do not match." : "Add your name, school email, and a password with at least 8 characters.");
      return;
    }
    setRegisterError("");
    setRegisterBusy(true);
    localStorage.setItem("mosaic-role-intent", "teacher");
    localStorage.setItem("mosaic-role-intent-at", String(Date.now()));
    startLogin();
  };

  return <main className="login-landing"><header className="login-landing__header"><div className="login-brand"><span className="mosaic-mark">M</span><span><b>Mosaic</b><small>Classroom</small></span></div><p>Every student, one classroom. Every path, different.</p></header><div className="login-panels"><RolePanel role="teacher" onRegister={() => setRegisterOpen(true)} /><div className="login-divider"><span>or</span></div><RolePanel role="student" onRegister={() => undefined} /></div><Dialog open={registerOpen} onOpenChange={setRegisterOpen}><DialogContent><DialogHeader><DialogTitle>Create a teacher account</DialogTitle><DialogDescription>Set up your educator access, then continue through Mosaic’s secure login.</DialogDescription></DialogHeader><form className="register-form" onSubmit={register}><label>Full name<Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Aida Rahman" /></label><label>Email<Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="teacher@school.edu" /></label><label>Password<Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="At least 8 characters" /></label><label>Confirm password<Input value={confirm} onChange={(event) => setConfirm(event.target.value)} type="password" placeholder="Repeat your password" /></label>{registerError && <Alert variant="destructive"><AlertDescription>{registerError}</AlertDescription></Alert>}<Button type="submit" disabled={registerBusy}>{registerBusy ? <><Loader2 className="animate-spin" size={15} />Creating…</> : "Create teacher account"}</Button></form></DialogContent></Dialog></main>;
}
