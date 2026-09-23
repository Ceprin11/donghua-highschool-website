import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { studentFileUrl, studentRequest, studentSession } from '@/services/studentService';
import PageHeader from '@/components/site/PageHeader';
import Reveal from '@/components/site/Reveal';
import AssignmentBody from '@/components/site/AssignmentBody';
import { LoadingState } from '@/components/site/States';
import '@/styles/learning.css';

const StudentContext = createContext(null);
function destination(search) {
  const value = new URLSearchParams(search).get('returnTo');
  return ['/downloads', '/assignments', '/student/account'].includes(value) ? value : '/downloads';
}
export function StudentGuard() {
  const [session, setSession] = useState(null), [error, setError] = useState('');
  const location = useLocation();
  useEffect(() => { let active = true; studentSession().then(value => { if (active) setSession(value); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [location.pathname]);
  if (error) return <div className="page-width page-content" role="alert">{error}<button onClick={() => window.location.reload()}>重新加载</button></div>;
  if (!session) return <LoadingState />;
  if (!session.student) return <Navigate replace to={`/student/login?returnTo=${encodeURIComponent(location.pathname)}`} />;
  if (session.student.mustChangePassword && location.pathname !== '/student/password') return <Navigate replace to={`/student/password?returnTo=${encodeURIComponent(destination(location.search) === '/downloads' ? location.pathname : destination(location.search))}`} />;
  return <StudentContext.Provider value={{ student: session.student, setSession }}><Outlet /></StudentContext.Provider>;
}
export function StudentLogin() {
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const navigate = useNavigate(), location = useLocation();
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await studentSession();
      const result = await studentRequest('login', { method: 'POST', body: { username, password } });
      window.dispatchEvent(new Event('student-session'));
      const next = destination(location.search);
      navigate(result.student.mustChangePassword ? `/student/password?returnTo=${encodeURIComponent(next)}` : next, { replace: true });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="learning-auth"><h1>学生登录</h1><form onSubmit={submit} className="learning-form">
    <label>账号<input required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} /></label>
    <label>密码<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
    {error && <p role="alert" className="learning-error">{error}</p>}
    <button className="learning-primary" disabled={busy}>{busy ? '登录中…' : '登录'}</button>
    <p className="learning-hint">账号由老师提供。忘记密码请联系老师重置。</p>
  </form></div>;
}
export function StudentPassword() {
  const { student, setSession } = useContext(StudentContext);
  const [currentPassword, setCurrent] = useState(''), [newPassword, setNew] = useState(''), [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const navigate = useNavigate(), location = useLocation();
  const submit = async event => {
    event.preventDefault(); setError('');
    if (newPassword !== confirm) return setError('两次输入的新密码不一致。');
    setBusy(true);
    try {
      const result = await studentRequest('password', { method: 'POST', body: { currentPassword, newPassword } });
      setSession(result); window.dispatchEvent(new Event('student-session')); navigate(destination(location.search), { replace: true });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="learning-auth"><h1>{student.mustChangePassword ? '设置新密码' : '修改密码'}</h1>{student.mustChangePassword && <p className="learning-hint">首次登录需要修改初始密码，完成后可查看资料和作业。</p>}<form onSubmit={submit} className="learning-form">
    <label>当前密码<input required type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrent(e.target.value)} /></label>
    <label>新密码<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={newPassword} onChange={e => setNew(e.target.value)} /></label>
    <label>确认新密码<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
    <p className="learning-hint">8 至 128 个字符，不能与账号或当前密码相同。</p>
    {error && <p role="alert" className="learning-error">{error}</p>}
    <button disabled={busy} className="learning-primary">{busy ? '保存中…' : '保存新密码'}</button>
  </form></div>;
}
export function StudentAccount() {
  const { student } = useContext(StudentContext), navigate = useNavigate();
  const [error, setError] = useState('');
  async function logout() {
    try { await studentRequest('logout', { method: 'POST' }); window.dispatchEvent(new Event('student-session')); navigate('/student/login'); }
    catch (e) { setError(e.message); }
  }
  return <div className="learning-auth"><h1>我的账号</h1><dl className="learning-profile"><dt>姓名</dt><dd>{student.name}</dd><dt>账号</dt><dd>{student.username}</dd></dl><div className="learning-actions"><Link to="/student/password" className="learning-primary">修改密码</Link><button onClick={logout}>退出登录</button></div>{error && <p role="alert">{error}</p>}</div>;
}
export function StudentLearning({ kind }) {
  const [items, setItems] = useState(null), [error, setError] = useState('');
  const load = () => studentRequest('learning').then(setItems).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);
  const assignment = kind === 'assignment';
  return <div className="inner-page"><PageHeader title={assignment ? '课程作业' : '资料下载'} label={assignment ? '课程作业' : '资料下载'} /><div className="page-width learning-content">
    <nav className="learning-tabs"><Link aria-current={!assignment ? 'page' : undefined} to="/downloads">资料下载</Link><Link aria-current={assignment ? 'page' : undefined} to="/assignments">课程作业</Link><Link to="/student/account">我的账号</Link></nav>
    {error ? <p role="alert" className="learning-error">{error}<button onClick={load}>重试</button></p> : !items ? <LoadingState /> : items.filter(item => item.kind === kind).length === 0 ? <p className="learning-empty">{assignment ? '暂无作业' : '暂无资料'}</p> : items.filter(item => item.kind === kind).map(item => <Reveal key={item.id} threshold={0}><article className="learning-card"><h2>{item.title}</h2>{item.description && <p className="learning-description">{item.description}</p>}<AssignmentBody blocks={item.blocks} fileUrl={studentFileUrl} /><div className="learning-files">{item.files.map(file => <FileLink key={file.id} file={file} />)}</div>{assignment && <Submission item={item} onUpdate={load} />}</article></Reveal>)}
  </div></div>;
}
function FileLink({ file }) {
  return <div className="learning-file"><span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span><div className="learning-actions">{(file.mime === 'application/pdf' || file.mime.startsWith('image/')) && <a target="_blank" rel="noreferrer" href={studentFileUrl(file.id, true)}>查看</a>}<a href={studentFileUrl(file.id)}>下载</a></div></div>;
}
function Submission({ item, onUpdate }) {
  const [file, setFile] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault(); setMessage(''); if (!file) return;
    if (file.size > 50 * 1024 * 1024) return setMessage('文件不能超过 50 MB。');
    setBusy(true);
    try { const body = new FormData(); body.append('file', file); await studentRequest(`assignments/${item.id}/submit`, { method: 'POST', body }); setMessage('提交成功'); setFile(null); event.target.reset(); await onUpdate(); }
    catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  return <section className="learning-submission"><h3>我的提交</h3>{item.submission ? <><p className="learning-hint">已提交 · {new Date(item.submission.submittedAt).toLocaleString('zh-CN')}</p><FileLink file={item.submission.file} /></> : <p className="learning-hint">尚未提交</p>}<form onSubmit={submit} className="learning-form"><label>作业文件<input type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files[0] || null)} /></label><p className="learning-hint">支持 PDF、Word、PPT、PNG、JPG，单个文件最多 50 MB。重新提交会替换当前提交。</p><button disabled={busy || !file} className="learning-primary">{busy ? '上传中…' : item.submission ? '重新提交' : '提交作业'}</button>{message && <p role="status">{message}</p>}</form></section>;
}
