import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  TestStep,
  FullResult,
} from '@playwright/test/reporter';
import * as path from 'path';
import * as fs from 'fs';

/**
 * PdfReporter — custom Playwright reporter that generates a PDF report
 * for every individual test (mirroring the Python/allure per-test PDF from the
 * existing framework), plus a suite-level summary PDF.
 *
 * Uses pdfkit for generation — no browser dependency required.
 * Output directory: reports/pdf/
 */
export default class PdfReporter implements Reporter {
  private readonly outputDir: string;
  private readonly testReports: TestReportEntry[] = [];
  private suiteTitle = 'Test Suite';

  // Runtime check — pdfkit may not be installed in all environments
  private PDFDocument: typeof import('pdfkit') | null = null;

  constructor(options?: { outputDir?: string }) {
    this.outputDir = path.resolve(process.cwd(), options?.outputDir || 'reports/pdf');
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private async loadPdfKit(): Promise<boolean> {
    if (this.PDFDocument) return true;
    try {
      this.PDFDocument = (await import('pdfkit')).default as unknown as typeof import('pdfkit');
      return true;
    } catch {
      console.warn('[PdfReporter] pdfkit not available — PDF reports skipped');
      return false;
    }
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.suiteTitle = suite.title || config.projects[0]?.name || 'Test Suite';
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const steps: StepEntry[] = [];
    const collectSteps = (step: TestStep): void => {
      steps.push({
        title: step.title,
        category: step.category,
        duration: step.duration,
        error: step.error?.message,
      });
      step.steps.forEach(collectSteps);
    };
    result.steps.forEach(collectSteps);

    const screenshotAttachments = result.attachments
      .filter((a) => a.contentType === 'image/png' && a.path)
      .map((a) => a.path as string);

    this.testReports.push({
      title: test.title,
      fullTitle: test.titlePath().join(' › '),
      suiteName: test.titlePath()[0] || this.suiteTitle,
      status: result.status,
      duration: result.duration,
      startTime: result.startTime,
      retry: result.retry,
      error: result.error?.message,
      steps,
      screenshots: screenshotAttachments.filter(Boolean),
      browser: test.parent?.project()?.name || 'unknown',
      environment: process.env.TEST_ENV || 'dev',
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    const available = await this.loadPdfKit();
    if (!available || !this.PDFDocument) return;

    const PDFDocument = this.PDFDocument;

    // Generate per-test PDFs
    for (const report of this.testReports) {
      await this.generateTestPdf(report, PDFDocument);
    }

    // Generate suite summary PDF
    await this.generateSuitePdf(result, PDFDocument);

    console.log(`\n[PdfReporter] ✓ ${this.testReports.length} test PDF(s) → ${this.outputDir}`);
  }

  // ─── Per-test PDF ─────────────────────────────────────────────────────────

  private async generateTestPdf(
    report: TestReportEntry,
    PDFDocument: typeof import('pdfkit'),
  ): Promise<void> {
    const safeName = report.title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 60);
    const retryTag = report.retry > 0 ? `_retry${report.retry}` : '';
    const filename = `${safeName}${retryTag}_${report.status}.pdf`;
    const outputPath = path.join(this.outputDir, filename);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(outputPath);

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
      doc.pipe(stream);

      const statusColor = this.statusColor(report.status);
      const pageWidth = doc.page.width - 100; // margins

      // ── Header ────────────────────────────────────────────────────────
      doc.rect(50, 40, pageWidth, 60).fill(statusColor);
      doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
        .text(report.status.toUpperCase(), 60, 55, { width: pageWidth - 20 });
      doc.fontSize(11).font('Helvetica')
        .text(report.title, 60, 78, { width: pageWidth - 20 });

      // ── Metadata table ────────────────────────────────────────────────
      let y = 120;
      doc.fillColor('#333').fontSize(11).font('Helvetica-Bold').text('Test Details', 50, y);
      y += 18;

      const meta: [string, string][] = [
        ['Full Title', report.fullTitle],
        ['Suite', report.suiteName],
        ['Status', report.status],
        ['Duration', `${(report.duration / 1000).toFixed(2)}s`],
        ['Start Time', report.startTime.toISOString()],
        ['Browser', report.browser],
        ['Environment', report.environment],
        ['Retry', String(report.retry)],
      ];

      for (const [key, value] of meta) {
        doc.fillColor('#555').font('Helvetica-Bold').fontSize(9).text(key + ':', 50, y, { width: 120 });
        doc.fillColor('#222').font('Helvetica').fontSize(9).text(value, 175, y, { width: pageWidth - 125 });
        y += 16;
      }

      // ── Error (if failed) ─────────────────────────────────────────────
      if (report.error) {
        y += 10;
        doc.fillColor('#cc0000').fontSize(11).font('Helvetica-Bold').text('Error', 50, y);
        y += 16;
        doc.rect(50, y, pageWidth, 1).fill('#cc0000');
        y += 8;
        doc.fillColor('#cc0000').font('Helvetica').fontSize(8)
          .text(report.error.substring(0, 800), 50, y, {
            width: pageWidth,
            lineBreak: true,
          });
        y = doc.y + 10;
      }

      // ── Test Steps ────────────────────────────────────────────────────
      if (report.steps.length > 0) {
        y += 10;
        doc.fillColor('#333').fontSize(11).font('Helvetica-Bold').text('Steps', 50, y);
        y += 16;
        doc.rect(50, y, pageWidth, 1).fill('#ccc');
        y += 8;

        let stepNum = 0;
        for (const step of report.steps.slice(0, 50)) {
          if (step.category === 'hook') continue;
          if (y > doc.page.height - 80) {
            doc.addPage();
            y = 50;
          }
          stepNum++;
          const stepColor = step.error ? '#cc0000' : '#227722';
          doc.fillColor(stepColor).font('Helvetica').fontSize(8)
            .text(
              `${stepNum}. ${step.title}  (${step.duration}ms)`,
              60,
              y,
              { width: pageWidth - 10 },
            );
          if (step.error) {
            y = doc.y + 2;
            doc.fillColor('#cc0000').fontSize(7)
              .text(`   ↳ ${step.error.substring(0, 200)}`, 70, y, { width: pageWidth - 20 });
          }
          y = doc.y + 4;
        }
      }

      // ── Screenshots ───────────────────────────────────────────────────
      if (report.screenshots.length > 0) {
        if (y > doc.page.height - 200) { doc.addPage(); y = 50; }
        y += 10;
        doc.fillColor('#333').fontSize(11).font('Helvetica-Bold').text('Screenshots', 50, y);
        y += 16;

        for (const screenshotPath of report.screenshots.slice(0, 3)) {
          if (fs.existsSync(screenshotPath)) {
            if (y > doc.page.height - 200) { doc.addPage(); y = 50; }
            try {
              doc.image(screenshotPath, 50, y, { width: pageWidth, height: 200 });
              y += 210;
            } catch {
              doc.fillColor('#999').fontSize(8).text(`[Screenshot: ${path.basename(screenshotPath)}]`, 50, y);
              y += 15;
            }
          }
        }
      }

      // ── Footer ─────────────────────────────────────────────────────────
      const footerY = doc.page.height - 40;
      doc.rect(50, footerY - 5, pageWidth, 1).fill('#ddd');
      doc.fillColor('#888').fontSize(7).font('Helvetica')
        .text(
          `Generated by Playwright TS Framework | ${new Date().toISOString()} | Report: ${filename}`,
          50,
          footerY,
          { width: pageWidth, align: 'center' },
        );

      doc.end();
    });
  }

  // ─── Suite summary PDF ────────────────────────────────────────────────────

  private async generateSuitePdf(
    result: FullResult,
    PDFDocument: typeof import('pdfkit'),
  ): Promise<void> {
    const filename = `suite_summary_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
    const outputPath = path.join(this.outputDir, filename);

    const passed = this.testReports.filter((r) => r.status === 'passed').length;
    const failed = this.testReports.filter((r) => r.status === 'failed').length;
    const skipped = this.testReports.filter((r) => r.status === 'skipped').length;
    const timedOut = this.testReports.filter((r) => r.status === 'timedOut').length;
    const total = this.testReports.length;
    const totalDuration = this.testReports.reduce((sum, r) => sum + r.duration, 0);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(outputPath);

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
      doc.pipe(stream);

      const pageWidth = doc.page.width - 100;
      const overallColor = failed > 0 || timedOut > 0 ? '#cc3300' : '#227722';

      // ── Title bar ──────────────────────────────────────────────────────
      doc.rect(50, 40, pageWidth, 70).fill(overallColor);
      doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
        .text('Test Suite Report', 65, 50, { width: pageWidth - 20 });
      doc.fontSize(12).font('Helvetica')
        .text(this.suiteTitle, 65, 78, { width: pageWidth - 20 });

      // ── Summary Stats ──────────────────────────────────────────────────
      let y = 130;
      doc.fillColor('#333').fontSize(14).font('Helvetica-Bold').text('Summary', 50, y);
      y += 22;

      const stats: [string, string | number, string][] = [
        ['Total Tests', total, '#333'],
        ['Passed', passed, '#227722'],
        ['Failed', failed, '#cc3300'],
        ['Skipped', skipped, '#886600'],
        ['Timed Out', timedOut, '#cc3300'],
        ['Duration', `${(totalDuration / 1000).toFixed(1)}s`, '#333'],
        ['Pass Rate', `${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`, passed === total ? '#227722' : '#cc3300'],
        ['Environment', process.env.TEST_ENV || 'dev', '#333'],
        ['Generated', new Date().toLocaleString(), '#333'],
      ];

      for (const [label, value, color] of stats) {
        doc.fillColor('#555').font('Helvetica-Bold').fontSize(10).text(`${label}:`, 50, y, { width: 130 });
        doc.fillColor(color).font('Helvetica').fontSize(10).text(String(value), 185, y, { width: pageWidth - 135 });
        y += 18;
      }

      // ── Test Results table ─────────────────────────────────────────────
      y += 15;
      doc.fillColor('#333').fontSize(14).font('Helvetica-Bold').text('Test Results', 50, y);
      y += 18;

      // Table header
      doc.rect(50, y, pageWidth, 20).fill('#444');
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
        .text('Status', 55, y + 6, { width: 50 })
        .text('Test Name', 110, y + 6, { width: 280 })
        .text('Duration', 395, y + 6, { width: 60 })
        .text('Retry', 460, y + 6, { width: 40 });
      y += 22;

      for (const report of this.testReports) {
        if (y > doc.page.height - 60) { doc.addPage(); y = 50; }

        const rowColor = report.status === 'passed' ? '#f0fff0' : report.status === 'failed' ? '#fff0f0' : '#fffde7';
        doc.rect(50, y, pageWidth, 18).fill(rowColor);

        const statusTextColor = this.statusColor(report.status);
        doc.fillColor(statusTextColor).font('Helvetica-Bold').fontSize(7)
          .text(report.status.toUpperCase(), 55, y + 5, { width: 50 });
        doc.fillColor('#222').font('Helvetica').fontSize(7)
          .text(report.title.substring(0, 70), 110, y + 5, { width: 280 });
        doc.fillColor('#555').fontSize(7)
          .text(`${(report.duration / 1000).toFixed(1)}s`, 395, y + 5, { width: 60 });
        doc.fillColor('#555').fontSize(7)
          .text(String(report.retry), 460, y + 5, { width: 40 });

        // Divider
        doc.rect(50, y + 18, pageWidth, 0.5).fill('#e0e0e0');
        y += 20;
      }

      // ── Footer ─────────────────────────────────────────────────────────
      const footerY = doc.page.height - 40;
      doc.rect(50, footerY - 5, pageWidth, 1).fill('#ddd');
      doc.fillColor('#888').fontSize(7).font('Helvetica')
        .text(
          `Playwright TypeScript Automation Framework | Suite PDF Report | ${new Date().toISOString()}`,
          50,
          footerY,
          { width: pageWidth, align: 'center' },
        );

      doc.end();
    });
  }

  private statusColor(status: string): string {
    switch (status) {
      case 'passed': return '#227722';
      case 'failed': return '#cc3300';
      case 'timedOut': return '#cc3300';
      case 'skipped': return '#886600';
      default: return '#555555';
    }
  }

  printsToStdio(): boolean {
    return false;
  }
}

// ─── Internal types ────────────────────────────────────────────────────────────

interface TestReportEntry {
  title: string;
  fullTitle: string;
  suiteName: string;
  status: string;
  duration: number;
  startTime: Date;
  retry: number;
  error?: string;
  steps: StepEntry[];
  screenshots: string[];
  browser: string;
  environment: string;
}

interface StepEntry {
  title: string;
  category: string;
  duration: number;
  error?: string;
}
