import { describe, expect, it, vi } from 'vitest';

import { extractNicOcrText, type NicOcrCommandRunner } from './nic-ocr-engine.js';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pdf = new TextEncoder().encode('%PDF-1.4\n%%EOF');

function runnerReturning(stdout: string): NicOcrCommandRunner {
  return vi.fn<NicOcrCommandRunner>(async () => stdout);
}

describe('extractNicOcrText', () => {
  it('runs Tesseract for a JPEG and returns recognized text', async () => {
    const runner = runnerReturning('NIC: 199012012345');

    await expect(extractNicOcrText(jpeg, 'image/jpeg', runner)).resolves.toBe('NIC: 199012012345');

    expect(runner).toHaveBeenCalledTimes(2);
    expect(runner).toHaveBeenNthCalledWith(
      1,
      'python3',
      expect.arrayContaining([expect.stringContaining('preprocess-nic-image.py')]),
      expect.any(Object),
    );
    expect(runner).toHaveBeenNthCalledWith(
      2,
      'tesseract',
      expect.arrayContaining(['stdout', '-l', 'eng', '--psm', '1']),
      expect.any(Object),
    );
  });

  it('accepts PNG images', async () => {
    const runner = runnerReturning('NATIONAL IDENTITY CARD');

    await expect(extractNicOcrText(png, 'image/png', runner)).resolves.toBe(
      'NATIONAL IDENTITY CARD',
    );
  });

  it('rejects a MIME type that does not match the file signature', async () => {
    const runner = runnerReturning('');

    await expect(extractNicOcrText(jpeg, 'image/png', runner)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });

    expect(runner).not.toHaveBeenCalled();
  });

  it('rejects unsupported MIME types', async () => {
    const runner = runnerReturning('');

    await expect(extractNicOcrText(jpeg, 'image/gif', runner)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });

    expect(runner).not.toHaveBeenCalled();
  });

  it('rejects empty input', async () => {
    const runner = runnerReturning('');

    await expect(extractNicOcrText(new Uint8Array(), 'image/jpeg', runner)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });

    expect(runner).not.toHaveBeenCalled();
  });

  it('rejects input larger than 10 MB', async () => {
    const runner = runnerReturning('');

    await expect(
      extractNicOcrText(new Uint8Array(10 * 1024 * 1024 + 1), 'image/jpeg', runner),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    expect(runner).not.toHaveBeenCalled();
  });

  it('rejects a PDF without a valid PDF signature', async () => {
    const runner = runnerReturning('');

    await expect(
      extractNicOcrText(new TextEncoder().encode('not a PDF'), 'application/pdf', runner),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    expect(runner).not.toHaveBeenCalled();
  });

  it('rejects PDFs containing more than two pages', async () => {
    const runner = runnerReturning('Pages:          3');

    await expect(extractNicOcrText(pdf, 'application/pdf', runner)).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });

    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith('pdfinfo', expect.any(Array), expect.any(Object));
  });

  it('does not expose subprocess error details to callers', async () => {
    const runner = vi.fn<NicOcrCommandRunner>(async () => {
      throw new Error('sensitive subprocess output');
    });

    await expect(extractNicOcrText(jpeg, 'image/jpeg', runner)).rejects.toMatchObject({
      code: 'INTERNAL',
    });
  });
});

describe('PDF OCR rendering', () => {
  it('renders a one-page PDF once and OCRs the rendered image', async () => {
    const { writeFile } = await import('node:fs/promises');

    const runner = vi.fn<NicOcrCommandRunner>(async (command, args) => {
      if (command === 'pdfinfo') return 'Pages:          1';

      if (command === 'pdftoppm') {
        const prefix = args.at(-1);
        if (!prefix) throw new Error('Missing output prefix');
        await writeFile(`${prefix}.png`, 'rendered page');
        return '';
      }

      if (command === 'python3') {
        const outputPath = args[2];
        if (!outputPath) throw new Error('Missing processed output path');
        await writeFile(outputPath, 'processed image');
        return '';
      }

      if (command === 'tesseract') return 'NIC: 199012012345';

      throw new Error('Unexpected command');
    });

    await expect(extractNicOcrText(pdf, 'application/pdf', runner)).resolves.toBe(
      'NIC: 199012012345',
    );

    expect(runner).toHaveBeenCalledTimes(4);
    expect(runner.mock.calls.map(([command]) => command)).toEqual([
      'pdfinfo',
      'pdftoppm',
      'python3',
      'tesseract',
    ]);
    const onePageRender = runner.mock.calls.find(([command]) => command === 'pdftoppm');
    expect(onePageRender).toBeDefined();
    expect(onePageRender?.[1]).toContain('-singlefile');
    expect(onePageRender?.[1]).toContain('-scale-to');
    expect(onePageRender?.[1]).toContain('2500');
  });

  it('renders and OCRs exactly two pages for a two-page PDF', async () => {
    const { writeFile } = await import('node:fs/promises');

    const runner = vi.fn<NicOcrCommandRunner>(async (command, args) => {
      if (command === 'pdfinfo') return 'Pages:          2';

      if (command === 'pdftoppm') {
        const prefix = args.at(-1);
        if (!prefix) throw new Error('Missing output prefix');
        await writeFile(`${prefix}-1.png`, 'rendered page one');
        await writeFile(`${prefix}-2.png`, 'rendered page two');
        return '';
      }

      if (command === 'python3') {
        const outputPath = args[2];
        if (!outputPath) throw new Error('Missing processed output path');
        await writeFile(outputPath, 'processed image');
        return '';
      }

      if (command === 'tesseract') {
        return args[0]?.includes('-1.png.processed.png') ? 'First page' : 'Second page';
      }

      throw new Error('Unexpected command');
    });

    await expect(extractNicOcrText(pdf, 'application/pdf', runner)).resolves.toBe(
      'First page\nSecond page',
    );

    expect(runner).toHaveBeenCalledTimes(6);
    expect(runner.mock.calls.map(([command]) => command)).toEqual([
      'pdfinfo',
      'pdftoppm',
      'python3',
      'tesseract',
      'python3',
      'tesseract',
    ]);
    const twoPageRender = runner.mock.calls.find(([command]) => command === 'pdftoppm');
    expect(twoPageRender).toBeDefined();
    expect(twoPageRender?.[1]).not.toContain('-singlefile');
    expect(twoPageRender?.[1]).toContain('-scale-to');
    expect(twoPageRender?.[1]).toContain('2500');
    expect(twoPageRender?.[1]).toContain('2');
  });
});
