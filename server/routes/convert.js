const express = require('express');
const multer = require('multer');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const url = require('url');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');

// 페이지 크기 매핑 (mm 단위)
const PAGE_SIZES = {
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
};

// multer 설정: .html 파일만 허용, 세션별 uuid 디렉토리에 저장
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.sessionDir) {
      req.sessionDir = path.join(uploadsDir, uuidv4());
      fs.mkdirSync(req.sessionDir, { recursive: true });
    }
    cb(null, req.sessionDir);
  },
  filename: (req, file, cb) => {
    // 원본 파일명 보존 (인코딩 처리)
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.html' || ext === '.htm') {
    cb(null, true);
  } else {
    cb(new Error('HTML 파일(.html, .htm)만 업로드 가능합니다.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 50 },
});

router.post('/', upload.array('files'), async (req, res) => {
  const sessionDir = req.sessionDir;

  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'HTML 파일을 하나 이상 업로드해주세요.' });
    }

    // 페이지 크기 결정
    const { pageSize, width, height, unit } = req.body;
    let widthStr, heightStr;

    if (pageSize === 'Custom') {
      const w = parseFloat(width);
      const h = parseFloat(height);
      if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
        return res.status(400).json({ error: '커스텀 크기의 너비와 높이를 올바르게 입력해주세요.' });
      }
      const u = unit === 'px' ? 'px' : 'mm';
      widthStr = `${w}${u}`;
      heightStr = `${h}${u}`;
    } else {
      const size = PAGE_SIZES[pageSize] || PAGE_SIZES['A4'];
      widthStr = `${size.width}mm`;
      heightStr = `${size.height}mm`;
    }

    // puppeteer 실행 (Railway nixpacks 환경에서는 시스템 Chromium 사용)
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    const browser = await puppeteer.launch(launchOptions);

    const individualPdfs = [];

    for (const file of files) {
      const page = await browser.newPage();
      const fileUrl = url.pathToFileURL(file.path).href;
      await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

      const pdfBuffer = await page.pdf({
        width: widthStr,
        height: heightStr,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      individualPdfs.push(pdfBuffer);
      await page.close();
    }

    await browser.close();

    // pdf-lib으로 병합
    const mergedPdf = await PDFDocument.create();

    for (const pdfBuffer of individualPdfs) {
      const doc = await PDFDocument.load(pdfBuffer);
      const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      pages.forEach((p) => mergedPdf.addPage(p));
    }

    const mergedBytes = await mergedPdf.save();

    // 응답 전송
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="converted.pdf"',
      'Content-Length': mergedBytes.length,
    });
    res.send(Buffer.from(mergedBytes));
  } catch (err) {
    console.error('변환 오류:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: '변환 중 오류가 발생했습니다: ' + err.message });
    }
  } finally {
    // 임시 파일 즉시 삭제
    if (sessionDir) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  }
});

module.exports = router;
