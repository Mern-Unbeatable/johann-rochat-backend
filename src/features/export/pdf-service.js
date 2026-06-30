import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import { BadRequestError } from '../../shared/globals/helpers/error-handler.js';

function getChromiumPath() {
  // Check env var first
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath) {
    console.log('Chrome path from env:', envPath);
    return envPath;
  }

  // Auto-detect — add /bin paths since Google Chrome installs there
  const candidates = [
    '/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];

  for (const candidate of candidates) {
    try {
      execSync(`test -f "${candidate}"`, { stdio: 'ignore' });
      console.log('Chrome path auto-detected:', candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  // Last resort
  try {
    const found = execSync(
      'which google-chrome || which google-chrome-stable || which chromium || which chromium-browser',
      { encoding: 'utf8' }
    ).trim().split('\n')[0];
    console.log('Chrome path from which:', found);
    return found;
  } catch {
    throw new Error('Chrome not found on system. Run: sudo apt-get install -y google-chrome-stable');
  }
}

class PDFService {
  async generatePdf(html) {
    let browser;

    // Get path INSIDE the method so env vars are already loaded
    const chromePath = getChromiumPath();
    console.log('Launching Chrome at:', chromePath);

    try {
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-extensions',
        ],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 1600 });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      });

      return Buffer.from(pdfBuffer);

    } catch (error) {
      console.error('PDF ERROR:', error);
      throw new BadRequestError(`PDF generation failed: ${error.message}`);
    } finally {
      if (browser) await browser.close();
    }
  }
}

export default new PDFService();