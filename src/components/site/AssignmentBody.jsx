export default function AssignmentBody({ blocks = [], fileUrl }) {
  return <div className="assignment-body">{blocks.map((block, index) => block.type === 'image'
    ? <figure key={index}>
      <img src={fileUrl(block.fileId, true)} alt={block.caption || '作业配图'} loading="lazy" />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
    : block.text && <p key={index}>{block.text}</p>)}</div>;
}
