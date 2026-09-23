import React, { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authService } from "@/services/authService";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [initialized, setInitialized] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const returnTo = new URLSearchParams(location.search).get("returnTo") || "/admin";

  useEffect(() => {
    authService.getSession().then((session) => {
      setInitialized(session?.initialized !== false);
      if (session?.authenticated) navigate(returnTo, { replace: true });
    }).catch((error) => setSessionError(error.message || "无法读取登录服务状态，请稍后重试。" )).finally(() => setInitializing(false));
  }, [navigate, returnTo]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!username.trim() || !password) { setError("请输入管理员账号和密码。"); return; }
    setLoading(true);
    try {
      await authService.login(username.trim(), password);
      navigate(returnTo, { replace: true });
    } catch (loginError) {
      setError(loginError.status === 429 ? "尝试次数过多，请稍后再试。" : "账号或密码不正确，或管理员尚未初始化。 ");
    } finally { setLoading(false); }
  };

  if (initializing) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">正在检查登录状态…</div>;
  if (sessionError) return <main className="min-h-screen bg-background px-5 py-12 md:py-20"><div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-card p-7 text-center"><h1 className="text-lg font-semibold text-foreground">登录服务暂时不可用</h1><p className="mt-2 text-sm text-muted-foreground">{sessionError}</p><button onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">重新检查</button></div></main>;
  return <main className="min-h-screen bg-background px-5 py-12 md:py-20">
    <div className="mx-auto max-w-md">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"><ArrowLeft size={16} />返回网站</Link>
      <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <div className="mb-8"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><LockKeyhole size={22} /></div><h1 className="mt-5 text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-display)" }}>管理员登录</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">管理课程、实验、作品与素材。</p>{!initialized && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">管理员尚未初始化，请先在服务器运行初始化命令。</p>}</div>
        {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</div>}
        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm font-medium text-foreground">账号<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus className="mt-2 w-full rounded-lg border border-border bg-background px-3.5 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
          <label className="block text-sm font-medium text-foreground">密码<div className="relative mt-2"><KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="w-full rounded-lg border border-border bg-background py-3 pl-10 pr-3.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" /></div></label>
          <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60">{loading && <Loader2 size={17} className="animate-spin" />}登录后台</button>
        </form>
      </div>
    </div>
  </main>;
}
