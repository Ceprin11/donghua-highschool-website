import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Plus, ImagePlus, X, Eye, Pencil } from 'lucide-react';
import { request } from '@/services/apiClient';
import AssignmentBody from '@/components/site/AssignmentBody';
import '@/styles/learning.css';

const fileUrl = (id, preview = false) => `/api/admin/learning/files/${id}${preview ? '?view=1' : ''}`;
/** @returns {{title: string, description: string, blocks: {type: string, text?: string, fileId?: string, caption?: string}[], files: {id: string, name: string}[]}} */
const emptyDraft = () => ({ title: '', description: '', blocks: [{ type: 'text', text: '' }], files: [] });
export default function AdminLearning({ kind }) {
  const [items, setItems] = useState([]), [editing, setEditing] = useState(null), [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [submissions, setSubmissions] = useState(null);
  const [preview, setPreview] = useState(false);
  const assignment = kind === 'assignment';
  const load = () => request('/api/admin/learning').then(setItems);
  useEffect(() => { load().catch(e => setMessage(e.message)); }, []);
  useEffect(() => { setEditing(null); setDraft(emptyDraft()); setSubmissions(null); setMessage(''); setPreview(false); }, [kind]);
  async function act(callback) { setBusy(true); setMessage(''); try { await callback(); } catch (e) { setMessage(e.message); } finally { setBusy(false); } }
  async function upload(event, inline = false) {
    const input = event.target, file = input.files[0]; if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setMessage('文件不能超过 50 MB。'); input.value = ''; return; }
    await act(async () => {
      const body = new FormData(); body.append('file', file);
      const result = await request('/api/admin/learning/files', { method: 'POST', body });
      setDraft(value => inline ? { ...value, blocks: [...value.blocks, { type: 'image', fileId: result.id, caption: '' }] } : { ...value, files: [...value.files, result] });
    });
    input.value = '';
  }
  function updateBlock(index, change) {
    setDraft(value => ({ ...value, blocks: value.blocks.map((block, i) => i === index ? { ...block, ...change } : block) }));
  }
  function moveBlock(index, offset) {
    setDraft(value => { const blocks = [...value.blocks]; [blocks[index], blocks[index + offset]] = [blocks[index + offset], blocks[index]]; return { ...value, blocks }; });
  }
  async function save(event) {
    event.preventDefault();
    await act(async () => {
      const result = await request(`/api/admin/learning${editing ? `/${editing}` : ''}`, {
        method: editing ? 'PUT' : 'POST',
        body: { kind, title: draft.title, description: assignment ? '' : draft.description, blocks: assignment ? draft.blocks : [], fileIds: draft.files.map(f => f.id) },
      });
      setEditing(result.id); setMessage('草稿已保存，点击“发布”后学生可见。'); await load();
    });
  }
  function edit(item) {
    setEditing(item.id);
    setDraft({ ...item.draft, files: item.files, blocks: [
      ...(assignment && item.draft.description ? [{ type: 'text', text: item.draft.description }] : []), ...(item.draft.blocks || []),
    ] });
    setPreview(false); setMessage('');
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  return <div className="learning-admin">
    <h1>{assignment ? '课程作业' : '资料下载'}</h1>
    {message && <p role="status">{message}</p>}
    <section className="learning-panel">
      <div className="learning-editor-heading">
        <h2>{editing ? '编辑' : '新建'}{assignment ? '作业' : '资料'}</h2>
        <div className="learning-actions">
          {assignment && <button type="button" className="learning-editor-toggle" aria-pressed={preview} onClick={() => setPreview(!preview)}>
            {preview ? <Pencil size={16} /> : <Eye size={16} />}{preview ? '继续编辑' : '预览作业'}
          </button>}
          {editing && <button disabled={busy} onClick={() => { setEditing(null); setDraft(emptyDraft()); setPreview(false); }}>新建一条</button>}
        </div>
      </div>
      {preview ? <article className="assignment-preview">
        <h2>{draft.title || '作业标题'}</h2><AssignmentBody blocks={draft.blocks} fileUrl={fileUrl} />
        {draft.files.map(file => <div className="learning-file" key={file.id}><a href={fileUrl(file.id)}>{file.name}</a></div>)}
      </article> : <form className="learning-form" onSubmit={save}>
        <label>标题<input required maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
        {assignment ? <div className="assignment-editor">
          <h3>作业正文</h3>
          {draft.blocks.map((block, index) => <section className="assignment-block-editor" key={index} aria-label={`第 ${index + 1} 段`}>
            <div className="assignment-block-toolbar">
              <span>{String(index + 1).padStart(2, '0')} / {block.type === 'text' ? '文字' : '图片'}</span>
              <div className="learning-actions">
                <button type="button" disabled={busy || index === 0} aria-label={`上移第 ${index + 1} 段`} onClick={() => moveBlock(index, -1)}><ArrowUp size={16} /></button>
                <button type="button" disabled={busy || index === draft.blocks.length - 1} aria-label={`下移第 ${index + 1} 段`} onClick={() => moveBlock(index, 1)}><ArrowDown size={16} /></button>
                <button type="button" disabled={busy} aria-label={`删除第 ${index + 1} 段`} onClick={() => setDraft(value => ({ ...value, blocks: value.blocks.filter((_, i) => i !== index) }))}><X size={16} /></button>
              </div>
            </div>
            {block.type === 'text' ? <label>文字内容 {index + 1}<textarea maxLength={20000} value={block.text} onChange={e => updateBlock(index, { text: e.target.value })} /></label>
              : <><img className="assignment-editor-image" src={fileUrl(block.fileId, true)} alt={block.caption || '作业配图'} /><label>图片说明 {index + 1}<input maxLength={300} value={block.caption} onChange={e => updateBlock(index, { caption: e.target.value })} /></label></>}
          </section>)}
          <div className="assignment-add-controls">
            <button type="button" disabled={busy || draft.blocks.length >= 40} onClick={() => setDraft(value => ({ ...value, blocks: [...value.blocks, { type: 'text', text: '' }] }))}><Plus size={18} />添加文字</button>
            <label className={busy || draft.blocks.length >= 40 ? 'is-disabled' : ''}><ImagePlus size={18} />添加正文图片
              <input type="file" aria-label="添加正文图片" disabled={busy || draft.blocks.length >= 40} accept=".png,.jpg,.jpeg" onChange={e => upload(e, true)} />
            </label>
          </div>
          <p className="learning-hint">文字和图片按排列顺序显示。支持 PNG、JPG，单张最多 50 MB。</p>
        </div> : <label>资料说明<textarea maxLength={20000} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>}
        <details className="learning-attachments" open={!assignment || undefined}>
          <summary>{assignment ? '附件（可选）' : '资料文件'}</summary>
          <label>添加附件<input disabled={busy || draft.files.length >= 10} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" onChange={e => upload(e)} /></label>
          <p className="learning-hint">支持 PDF、Word、PPT、PNG、JPG，单文件最多 50 MB，每条最多 10 个附件。</p>
          {draft.files.map(file => <div className="learning-file" key={file.id}><a href={fileUrl(file.id)}>{file.name}</a><button type="button" disabled={busy} onClick={() => setDraft(value => ({ ...value, files: value.files.filter(f => f.id !== file.id) }))}>移除附件</button></div>)}
        </details>
        <button className="learning-primary" disabled={busy}>{busy ? '处理中…' : '保存草稿'}</button>
      </form>}
    </section>
    <section className="learning-panel"><h2>{assignment ? '作业列表' : '资料列表'}</h2>
      <div className="learning-admin-list">{items.filter(item => item.kind === kind).map(item => <div key={item.id} className="learning-admin-item">
        <div><h3>{item.draft.title}</h3><p className="learning-hint">{item.published ? JSON.stringify(item.draft) === JSON.stringify(item.published) ? '已发布' : '已发布 · 有未发布修改' : '草稿'}</p></div>
        <div className="learning-actions">
          <button disabled={busy} onClick={() => edit(item)}>编辑</button>
          <button disabled={busy} onClick={() => act(async () => { await request(`/api/admin/learning/${item.id}/publish`, { method: 'POST' }); setMessage('已发布'); await load(); })}>发布</button>
          {item.published && <button disabled={busy} onClick={() => act(async () => { await request(`/api/admin/learning/${item.id}/unpublish`, { method: 'POST' }); setMessage('已下架'); await load(); })}>下架</button>}
          {assignment && <button disabled={busy} onClick={() => act(async () => { const rows = await request(`/api/admin/learning/${item.id}/submissions`); setSubmissions({ title: item.draft.title, rows }); })}>查看提交</button>}
        </div>
      </div>)}</div>
    </section>
    {submissions && <section className="learning-panel"><h2>{submissions.title} · 提交情况</h2>
      <p className="learning-hint">已提交 {submissions.rows.filter(row => row.file).length} / {submissions.rows.length} 人</p>
      <div className="learning-table-wrap"><table className="learning-table">
        <thead><tr><th>姓名</th><th>账号</th><th>提交时间</th><th>作业文件</th></tr></thead>
        <tbody>{submissions.rows.map(row => <tr key={row.id}>
          <td>{row.name}{!row.active && '（已停用）'}</td><td>{row.username}</td>
          <td>{row.submitted_at ? new Date(row.submitted_at).toLocaleString('zh-CN') : '未提交'}</td>
          <td>{row.file && <div className="learning-actions"><span>{row.file.name}</span>
            {(row.file.mime === 'application/pdf' || row.file.mime.startsWith('image/')) && <a href={fileUrl(row.file.id, true)} target="_blank" rel="noreferrer">查看</a>}
            <a href={fileUrl(row.file.id)}>下载</a></div>}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="learning-hint">PDF 和图片可在浏览器中查看。Word 和 PPT 下载后打开。</p>
    </section>}
  </div>;
}
