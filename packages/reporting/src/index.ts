import PDFDocument from 'pdfkit';
import { StorageClient } from '@circuitsoul/storage';

export interface ReportOptions {
  title: string;
  content: string;
  author?: string;
  createdAt?: Date;
}

export async function generatePdfReport(options: ReportOptions): Promise<Buffer> {
  const document = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks: Buffer[] = [];

  document.on('data', chunk => chunks.push(chunk));
  document.on('end', () => undefined);

  document.fontSize(24).text(options.title, { underline: true });
  document.moveDown();
  document.fontSize(12).fillColor('#333').text(`Created by: ${options.author ?? 'CircuitSoul AI'}`);
  document.moveDown();
  document.fontSize(10).text(`Generated at: ${options.createdAt?.toISOString() ?? new Date().toISOString()}`);
  document.moveDown();
  document.fontSize(12).text(options.content, { lineGap: 6 });
  document.end();

  return new Promise((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });
}

export async function storeReport(
  storageClient: StorageClient,
  key: string,
  reportBuffer: Buffer,
  contentType = 'application/pdf'
): Promise<string> {
  return storageClient.uploadObject(key, reportBuffer, contentType);
}

export async function buildNdprReport(content: string): Promise<Buffer> {
  return generatePdfReport({
    title: 'CircuitSoul NDPR Report',
    content,
    author: 'CircuitSoul Shield',
    createdAt: new Date()
  });
}

export async function buildExecutiveSummary(summary: string): Promise<Buffer> {
  return generatePdfReport({
    title: 'Executive Summary',
    content: summary,
    author: 'CircuitSoul Reporting',
    createdAt: new Date()
  });
}
