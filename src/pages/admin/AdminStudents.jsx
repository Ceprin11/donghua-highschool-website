import { useEffect, useState } from 'react';
import { request } from '@/services/apiClient';
import '@/styles/learning.css';

export default function AdminStudents() {
  const [students, setStudents] = useState([]), [names, setNames] = useState(''), [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]), [created, setCreated] = useState([]), [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const load = () => request('/api/admin/students').then(setStudents);
  useEffect(() => { load().catch(e => setMessage(e.message)); }, []);
  async function act(callback) { setBusy(true); setMessage(''); try { await callback(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  function changeNames(value) { setNames(value); setPreview([]); setCreated([]); }
  async function makePreview(event) {
    event.preventDefault();
    await act(async () => {
      const body = new FormData(); if (file) body.append('file', file); else body.append('names', names);
      setPreview(await request('/api/admin/students/preview', { method: 'POST', body })); setCreated([]);
    });
  }
  async function importStudents() {
    await act(async () => {
      const result = await request('/api/admin/students/import', { method: 'POST', body: { students: preview } });
      setCreated(result); setPreview([]); setMessage(`已创建 ${result.length} 个学生账号`); await load();
    });
  }
  function downloadAccounts() {
    const rows = ['姓名,账号,初始密码', ...created.map(row => `${row.name},${row.username},${row.username}`)];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = '学生账号.csv'; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="learning-admin"><h1>学生账号</h1>{message && <p role="status">{message}</p>}<section className="learning-panel"><h2>导入学生</h2><a className="text-sm underline" href="/api/admin/students/template">下载 Excel 模板</a><p className="learning-hint">Excel 使用 .xlsx 格式，第一列为姓名，可带“姓名”表头。TXT 使用 UTF-8 编码，一行一个姓名，也可用中文逗号或英文逗号分隔。每次最多 500 人。</p><form onSubmit={makePreview} className="learning-form"><label>名单文件<input disabled={busy} type="file" accept=".xlsx,.txt" onChange={e => { setFile(e.target.files[0] || null); setPreview([]); setCreated([]); }} /></label><label>或直接粘贴姓名<textarea disabled={Boolean(file) || busy} placeholder="张三，李四,王五" value={names} onChange={e => changeNames(e.target.value)} /></label><p className="learning-hint">账号为姓名全拼，重复时自动加数字。初始密码与账号相同，首次登录必须修改。同一名单再次导入会创建新的账号。</p><button disabled={busy || (!file && !names.trim())} className="learning-primary">{busy ? '处理中…' : '预览账号'}</button></form>{preview.length > 0 && <div className="mt-6"><p className="learning-hint">请核对姓名与拼音。多音字可在账号栏修改，账号只使用小写字母和数字。</p><div className="learning-table-wrap"><table className="learning-table"><thead><tr><th>姓名</th><th>账号</th><th>初始密码</th></tr></thead><tbody>{preview.map((row, index) => <tr key={index}><td>{row.name}</td><td><input aria-label={`${row.name}的账号 ${index + 1}`} value={row.username} disabled={busy} onChange={e => setPreview(list => list.map((item, i) => i === index ? { ...item, username: e.target.value } : item))} /></td><td>{row.username}</td></tr>)}</tbody></table></div><button className="learning-primary mt-5" disabled={busy} onClick={importStudents}>{busy ? '正在创建账号…' : `确认导入 ${preview.length} 人`}</button></div>}{created.length > 0 && <button className="learning-primary mt-5" onClick={downloadAccounts}>下载本次账号与初始密码</button>}</section><section className="learning-panel"><h2>账号列表 · {students.length}</h2><label className="learning-form">搜索姓名或账号<input value={query} onChange={e => setQuery(e.target.value)} /></label><div className="learning-table-wrap"><table className="learning-table"><thead><tr><th>姓名</th><th>账号</th><th>状态</th><th>密码状态</th><th>操作</th></tr></thead><tbody>{students.filter(row => `${row.name} ${row.username}`.includes(query)).map(row => <tr key={row.id}><td>{row.name}</td><td>{row.username}</td><td>{row.active ? '启用' : '停用'}</td><td>{row.mustChangePassword ? '待修改初始密码' : '已修改'}</td><td><div className="learning-actions"><button disabled={busy} onClick={() => act(async () => { await request(`/api/admin/students/${row.id}`, { method: 'PUT', body: { active: !row.active } }); await load(); })}>{row.active ? '停用' : '启用'}</button><button disabled={busy} onClick={() => { if (window.confirm(`将 ${row.name}（${row.username}）的密码重置为账号名？该学生需要重新登录并改密。`)) act(async () => { await request(`/api/admin/students/${row.id}/reset-password`, { method: 'POST' }); setMessage('密码已重置为账号名'); await load(); }); }}>重置密码</button></div></td></tr>)}</tbody></table></div></section></div>;
}

