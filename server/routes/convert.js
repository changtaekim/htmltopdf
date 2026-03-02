const express = require('express');
const multer = require('multer');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const { randomUUID: uuidv4 } = require('crypto');
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

// multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.sessionDir) {
      req.sessionDir = path.join(uploadsDir, uuidv4());
      fs.mkdirSync(req.sessionDir, { recursive: true });
    }
    cb(null, req.sessionDir);
  },
  filename: (req, file, cb) => {
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

// 페이지 크기 파싱
function parsePaperSize(body) {
  const { pageSize, width, height, unit } = body;
  if (pageSize === 'Custom') {
    const w = parseFloat(width);
    const h = parseFloat(height);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
      return { error: '커스텀 크기의 너비와 높이를 올바르게 입력해주세요.' };
    }
    const u = unit === 'px' ? 'px' : 'mm';
    return { widthStr: `${w}${u}`, heightStr: `${h}${u}` };
  }
  const size = PAGE_SIZES[pageSize] || PAGE_SIZES['A4'];
  return { widthStr: `${size.width}mm`, heightStr: `${size.height}mm` };
}

// Puppeteer 브라우저 실행
async function launchBrowser() {
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  return puppeteer.launch(launchOptions);
}

// HTML → PDF 변환 (문자열 또는 파일)
async function htmlToPdf(browser, source, widthStr, heightStr) {
  const page = await browser.newPage();
  if (source.type === 'content') {
    await page.setContent(source.html, { waitUntil: 'networkidle0', timeout: 30000 });
  } else {
    const fileUrl = url.pathToFileURL(source.path).href;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
  }
  const pdfBuffer = await page.pdf({
    width: widthStr,
    height: heightStr,
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await page.close();
  return pdfBuffer;
}

// PDF 병합
async function mergePdfs(pdfBuffers) {
  const mergedPdf = await PDFDocument.create();
  for (const pdfBuffer of pdfBuffers) {
    const doc = await PDFDocument.load(pdfBuffer);
    const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => mergedPdf.addPage(p));
  }
  return mergedPdf.save();
}

// ============================================================
// 1) 기존: 파일 업로드 방식 (multipart/form-data)
// ============================================================
router.post('/', upload.array('files'), async (req, res) => {
  const sessionDir = req.sessionDir;

  try {
    // 파일 업로드 + htmlContent 둘 다 체크
    const files = req.files || [];
    const htmlContent = req.body.htmlContent;
    const htmlContents = req.body.htmlContents;

    // htmlContent 문자열이 있으면 그것도 변환 대상에 포함
    const sources = [];

    // 파일 업로드 소스
    for (const file of files) {
      sources.push({ type: 'file', path: file.path });
    }

    // 단일 HTML 문자열
    if (htmlContent) {
      sources.push({ type: 'content', html: htmlContent });
    }

    // 복수 HTML 문자열 배열
    if (htmlContents) {
      const arr = Array.isArray(htmlContents) ? htmlContents : [htmlContents];
      for (const html of arr) {
        if (html) sources.push({ type: 'content', html });
      }
    }

    if (sources.length === 0) {
      return res.status(400).json({ error: 'HTML 파일 또는 htmlContent를 하나 이상 전달해주세요.' });
    }

    const paper = parsePaperSize(req.body);
    if (paper.error) return res.status(400).json({ error: paper.error });

    const browser = await launchBrowser();
    const pdfBuffers = [];
    for (const source of sources) {
      pdfBuffers.push(await htmlToPdf(browser, source, paper.widthStr, paper.heightStr));
    }
    await browser.close();

    const mergedBytes = await mergePdfs(pdfBuffers);

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
    if (sessionDir) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  }
});

// ============================================================
// 2) 신규: JSON 방식 (application/json)
//    Retool 등 외부 서비스에서 HTML 문자열 직접 전달
// ============================================================
router.post('/html', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { htmlContent, htmlContents, pageSize, width, height, unit } = req.body;

    const sources = [];

    if (htmlContent) {
      sources.push({ type: 'content', html: htmlContent });
    }
    if (htmlContents && Array.isArray(htmlContents)) {
      for (const html of htmlContents) {
        if (html) sources.push({ type: 'content', html });
      }
    }

    if (sources.length === 0) {
      return res.status(400).json({ error: 'htmlContent 또는 htmlContents를 전달해주세요.' });
    }

    const paper = parsePaperSize({ pageSize, width, height, unit });
    if (paper.error) return res.status(400).json({ error: paper.error });

    const browser = await launchBrowser();
    const pdfBuffers = [];
    for (const source of sources) {
      pdfBuffers.push(await htmlToPdf(browser, source, paper.widthStr, paper.heightStr));
    }
    await browser.close();

    const mergedBytes = await mergePdfs(pdfBuffers);

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
  }
});

module.exports = router;
