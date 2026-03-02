const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const convertRouter = require('./routes/convert');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// uploads 디렉토리 보장
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// CORS: 개발은 Vite 로컬, 프로덕션은 /api 전체 허용
app.use('/api', cors({
  origin: isProd ? '*' : 'http://localhost:5173',
  methods: ['POST', 'OPTIONS'],
}));

app.use(express.json());
app.use('/api/convert', convertRouter);

// 프로덕션: 빌드된 React 앱 서빙
if (isProd) {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.use((req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 1시간마다 오래된 임시 파일 정리
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  try {
    const entries = fs.readdirSync(uploadsDir);
    for (const entry of entries) {
      const entryPath = path.join(uploadsDir, entry);
      const stat = fs.statSync(entryPath);
      if (stat.mtimeMs < oneHourAgo) {
        fs.rmSync(entryPath, { recursive: true, force: true });
      }
    }
  } catch (err) {
    console.error('정리 작업 오류:', err.message);
  }
}, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
