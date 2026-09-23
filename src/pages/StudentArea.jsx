import { createContext, useContext, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, FileText, Image, Upload, Check, ArrowRight, UserRound, FolderOpen, LoaderCircle } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { studentFileUrl, studentRequest, studentSession } from '@/services/studentService';
import PageHeader from '@/components/site/PageHeader';
import Reveal from '@/components/site/Reveal';
import AssignmentBody from '@/components/site/AssignmentBody';
import { LoadingState } from '@/components/site/States';
import '@/styles/learning.css';
import '@/styles/student-learning.css';

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
  const load = () => studentRequest('learning').then(value => { setItems(value); setError(''); }).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);
  const assignment = kind === 'assignment';
  const visible = items?.filter(item => item.kind === kind) || [];
  const title = assignment ? '课程作业' : '资料下载';
  return <div className="inner-page student-learning">
    <PageHeader title={title} label={title} />
    <div className="page-width student-content">
      <nav className="student-nav" aria-label="学生页面">
        <Link aria-current={!assignment ? 'page' : undefined} to="/downloads">资料下载</Link>
        <Link aria-current={assignment ? 'page' : undefined} to="/assignments">课程作业</Link>
        <Link className="student-account" to="/student/account"><UserRound size={16} aria-hidden="true" />我的账号</Link>
      </nav>
      {error ? <div role="alert" className="student-notice">{error}<button onClick={load}>重新加载</button></div>
        : !items ? <LoadingState />
          : visible.length === 0 ? <Reveal className="student-empty"><FolderOpen size={32} strokeWidth={1.3} aria-hidden="true" /><h2>{assignment ? '暂无作业' : '暂无资料'}</h2></Reveal>
            : <div className="student-list">{visible.map(item => <Reveal key={item.id} threshold={0}>
              <article className={assignment ? 'student-assignment' : 'student-resource'} aria-labelledby={`title-${item.id}`}>
                <div className="student-article">
                  <header className="student-article-heading">
                    <h2 id={`title-${item.id}`}>{item.title}</h2>
                    {!assignment && <span className="student-file-count">{item.files.length} 个文件</span>}
                  </header>
                  {item.description && <p className="student-description">{item.description}</p>}
                  <AssignmentBody blocks={item.blocks} fileUrl={studentFileUrl} />
                  {assignment && item.files.length > 0 && <div className="student-attachments">
                    <h3>作业附件</h3><div>{item.files.map(file => <FileLink key={file.id} file={file} />)}</div>
                  </div>}
                </div>
                {assignment ? <Submission item={item} onUpdate={load} />
                  : <div className="student-resource-files">{item.files.map(file => <FileLink key={file.id} file={file} />)}</div>}
              </article>
            </Reveal>)}</div>}
    </div>
  </div>;
}
function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function FileLink({ file }) {
  const extension = file.name.split('.').pop().toUpperCase();
  const isImage = file.mime.startsWith('image/');
  const previewable = file.mime === 'application/pdf' || isImage;
  const Icon = isImage ? Image : FileText;
  return <div className="student-file">
    <span className="student-file-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.5} /></span>
    <div className="student-file-info"><span className="student-file-name">{file.name}</span><span className="student-file-meta">{extension} <span aria-hidden="true">·</span> {fileSize(file.size)}</span></div>
    <div className="student-file-actions">
      {previewable && <a target="_blank" rel="noreferrer" href={studentFileUrl(file.id, true)}><span>查看</span><ArrowUpRight size={16} aria-hidden="true" /></a>}
      <a href={studentFileUrl(file.id)}><span>下载</span><ArrowDownToLine size={16} aria-hidden="true" /></a>
    </div>
  </div>;
}
function Submission({ item, onUpdate }) {
  const [file, setFile] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setMessage(''); setError('');
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return setError('文件不能超过 50 MB。');
    setBusy(true);
    const form = event.currentTarget;
    try {
      const body = new FormData(); body.append('file', file);
      await studentRequest(`assignments/${item.id}/submit`, { method: 'POST', body });
      setMessage('提交成功'); setFile(null); form.reset(); await onUpdate();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <aside className="student-submit-column" aria-label="提交作业">
    <section className="student-submit">
      <div className="student-submit-heading"><h3>我的提交</h3>
        <span className={`student-status ${item.submission ? 'is-submitted' : ''}`}>{item.submission && <Check size={13} aria-hidden="true" />}{item.submission ? '已提交' : '待提交'}</span>
      </div>
      {item.submission && <div className="student-current-submission">
        <p className="student-submitted-at">{new Date(item.submission.submittedAt).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <FileLink file={item.submission.file} />
      </div>}
      <form onSubmit={submit} className="student-upload-form">
        <label className={`student-upload ${file ? 'has-file' : ''} ${busy ? 'is-busy' : ''}`}>
          <input type="file" aria-label="作业文件" required disabled={busy} accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" onChange={e => { setFile(e.target.files[0] || null); setMessage(''); setError(''); }} />
          <span className="student-upload-icon" aria-hidden="true">{file ? <FileText size={24} strokeWidth={1.5} /> : <Upload size={24} strokeWidth={1.5} />}</span>
          <span className="student-upload-name">{file ? file.name : item.submission ? '选择新的作业文件' : '选择作业文件'}</span>
          <span className="student-upload-note">{file ? `${fileSize(file.size)} · 点击更换` : '点击选择文件'}</span>
        </label>
        <p className="student-upload-formats">PDF、Word、PPT、PNG、JPG<br />单个文件不超过 50 MB</p>
        <button disabled={busy || !file} className="student-submit-button">
          <span>{busy ? '上传中…' : item.submission ? '重新提交' : '提交作业'}</span>
          {busy ? <LoaderCircle size={17} className="student-spinner" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}
        </button>
        {item.submission && <p className="student-replace-note">重新提交会替换上一次的文件。</p>}
        {message && <p role="status" className="student-feedback"><Check size={16} aria-hidden="true" />{message}</p>}
        {error && <p role="alert" className="student-upload-error">{error}</p>}
      </form>
    </section>
  </aside>;
}
