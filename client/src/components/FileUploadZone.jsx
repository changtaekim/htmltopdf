import { useRef, useState } from 'react';

export default function FileUploadZone({ onFilesAdded }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const filterHtmlFiles = (fileList) => {
    const files = Array.from(fileList);
    return files.filter((f) => f.name.endsWith('.html') || f.name.endsWith('.htm'));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const valid = filterHtmlFiles(e.dataTransfer.files);
    if (valid.length > 0) onFilesAdded(valid);
  };

  const handleChange = (e) => {
    const valid = filterHtmlFiles(e.target.files);
    if (valid.length > 0) onFilesAdded(valid);
    e.target.value = '';
  };

  return (
    <div
      className={`upload-zone ${isDragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".html,.htm"
        multiple
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <div className="upload-icon">📂</div>
      <p className="upload-text">HTML 파일을 여기에 끌어다 놓거나 클릭하여 선택하세요</p>
      <p className="upload-hint">.html, .htm 파일만 지원됩니다</p>
    </div>
  );
}
