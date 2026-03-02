import { useState } from 'react';
import axios from 'axios';
import FileUploadZone from './components/FileUploadZone';
import FileList from './components/FileList';
import PdfSettings from './components/PdfSettings';
import ProgressOverlay from './components/ProgressOverlay';
import './App.css';

let idCounter = 0;

export default function App() {
  const [files, setFiles] = useState([]);
  const [settings, setSettings] = useState({
    pageSize: 'A4',
    width: '210',
    height: '297',
    unit: 'mm',
  });
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState('');

  const handleFilesAdded = (newFiles) => {
    const mapped = newFiles.map((f) => ({
      id: String(++idCounter),
      name: f.name,
      size: f.size,
      file: f,
    }));
    setFiles((prev) => [...prev, ...mapped]);
    setError('');
  };

  const handleRemove = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      setError('변환할 HTML 파일을 먼저 업로드해주세요.');
      return;
    }
    if (settings.pageSize === 'Custom') {
      if (!settings.width || !settings.height || +settings.width <= 0 || +settings.height <= 0) {
        setError('커스텀 크기의 너비와 높이를 올바르게 입력해주세요.');
        return;
      }
    }

    setConverting(true);
    setError('');

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f.file));
      formData.append('pageSize', settings.pageSize);
      if (settings.pageSize === 'Custom') {
        formData.append('width', settings.width);
        formData.append('height', settings.height);
        formData.append('unit', settings.unit);
      }

      const response = await axios.post('/api/convert', formData, {
        responseType: 'blob',
        timeout: 120000,
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'converted.pdf';
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      if (err.response) {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          setError(json.error || text);
        } catch {
          setError(text);
        }
      } else {
        setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
      }
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="app">
      {converting && <ProgressOverlay />}

      <header className="app-header">
        <h1>HTML → PDF 변환기</h1>
        <p>HTML 파일을 업로드하고 하나의 PDF로 변환하세요</p>
      </header>

      <main className="app-main">
        <FileUploadZone onFilesAdded={handleFilesAdded} />
        <FileList files={files} onReorder={setFiles} onRemove={handleRemove} />
        <PdfSettings settings={settings} onChange={setSettings} />

        {error && <div className="error-message">{error}</div>}

        <button
          className="convert-btn"
          onClick={handleConvert}
          disabled={converting || files.length === 0}
        >
          PDF로 변환하기
        </button>
      </main>
    </div>
  );
}
