import React, { useEffect, useState } from "react";
import { BookOpen, Camera, ChevronDown, FileQuestion, FlaskConical, Images, LayoutDashboard, LogOut, Menu, Settings, UserRound, X } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { authService } from "@/services/authService";
import { LoadingState } from "@/components/site/States";

const NAV = [
  { to: "/admin", label: "建设概览", icon: LayoutDashboard, end: true },
  { to: "/admin/settings", label: "首页与设置", icon: Settings },
  { to: "/admin/courses", label: "课程主题", icon: BookOpen },
  { to: "/admin/teacher", label: "主讲教师", icon: UserRound },
  { to: "/admin/experiments", label: "互动实验", icon: FlaskConical },
  { to: "/admin/works", label: "学生作品", icon: Camera },
  { to: "/admin/quizzes", label: "课堂小测", icon: FileQuestion },
  { to: "/admin/media", label: "素材管理", icon: Images },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    authService.getSession().then((result) => {
      if (!active) return;
      if (!result?.authenticated) navigate(`/admin/login?returnTo=${encodeURIComponent(location.pathname)}`, { replace: true });
      else setSession(result);
    }).catch(() => { if (active) navigate(`/admin/login?returnTo=${encodeURIComponent(location.pathname)}`, { replace: true }); }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [navigate, location.pathname]);
  if (checking || !session) return <LoadingState label="正在检查后台权限" />;
  const logout = async () => { await authService.logout().catch(() => {}); navigate("/admin/login", { replace: true }); };
  return <div className="min-h-screen bg-[#f6f4f1] text-foreground"><aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border bg-card transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}><div className="flex h-20 items-center justify-between border-b border-border px-6"><Link to="/admin" onClick={() => setMobileOpen(false)}><div className="text-xs tracking-wide text-muted-foreground">东华 AI 课程项目</div><div className="mt-1 text-lg font-semibold text-foreground">内容后台</div></Link><button className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden" onClick={() => setMobileOpen(false)} aria-label="关闭菜单"><X size={19} /></button></div><nav className="flex-1 space-y-1 overflow-y-auto p-4">{NAV.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-medium transition ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><Icon size={17} />{label}</NavLink>)}</nav><div className="border-t border-border p-4"><Link to="/" className="mb-2 flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">查看公开网站<ChevronDown size={15} className="-rotate-90" /></Link><button onClick={() => setPasswordOpen(true)} className="mb-2 flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"><Settings size={17} />修改密码</button><button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm text-muted-foreground hover:bg-red-50 hover:text-red-700"><LogOut size={17} />退出登录</button></div></aside><div className="lg:pl-72"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-[#f6f4f1]/90 px-5 backdrop-blur md:px-8"><button className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden" onClick={() => setMobileOpen(true)} aria-label="打开菜单"><Menu size={20} /></button><div className="text-sm font-medium text-foreground">{NAV.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))?.label || "内容后台"}</div><div className="text-xs text-muted-foreground">已登录管理员</div></header><main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8"><Outlet context={{ session, setMessage }} />{message && <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg">{message}</div>}</main></div>{mobileOpen && <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" aria-label="关闭菜单" onClick={() => setMobileOpen(false)} />}{passwordOpen && <ChangePasswordDialog onClose={() => setPasswordOpen(false)} />}</div>;
}

function ChangePasswordDialog({ onClose }) { const [currentPassword, setCurrent] = useState(""); const [newPassword, setNew] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const submit = async (event) => { event.preventDefault(); setError(""); if (newPassword.length < 10) { setError("新密码至少需要 10 个字符。"); return; } if (newPassword !== confirm) { setError("两次输入的新密码不一致。"); return; } setSaving(true); try { await authService.changePassword(currentPassword, newPassword); onClose(); } catch (err) { setError(err.message || "修改密码失败。"); } finally { setSaving(false); } }; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-xl border border-border bg-card p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">修改管理员密码</h2><p className="mt-1 text-xs text-muted-foreground">修改后当前会话可能需要重新登录。</p></div><button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent"><X size={18} /></button></div>{error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}<form onSubmit={submit} className="mt-5 space-y-4"><Field label="当前密码"><input type="password" required value={currentPassword} onChange={(event) => setCurrent(event.target.value)} className={inputClass} /></Field><Field label="新密码"><input type="password" required value={newPassword} onChange={(event) => setNew(event.target.value)} className={inputClass} /></Field><Field label="确认新密码"><input type="password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} className={inputClass} /></Field><button disabled={saving} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">{saving ? "保存中…" : "保存密码"}</button></form></div></div>; }
export const inputClass = "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
export function Field({ label, children, hint = "" }) {
  const id = React.useId();
  return <div className="text-sm font-medium text-foreground"><label htmlFor={id} className="block">{label}</label>{React.cloneElement(children, { id, ...(hint ? { 'aria-describedby': `${id}-hint` } : {}) })}{hint && <span id={`${id}-hint`} className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span>}</div>;
}
