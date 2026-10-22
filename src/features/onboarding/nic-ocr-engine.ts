import { execFile as nodeExecFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AppError } from '../../errors/app-error.js';
import { ErrorCodes } from '../../errors/codes.js';

const execFile = promisify(nodeExecFile);

export const NIC_OCR_MAX_BYTES = 10 * 1024 * 1024;
const COMMAND_TIMEOUT_MS = 8_000;
const MAX_BUFFER_BYTES = 1024 * 1024;
const MAX_PDF_PAGES = 2;
const PDF_RENDER_DPI = 150;
const PDF_RENDER_MAX_DIMENSION = 2_500;
const PREPROCESS_SCRIPT_PATH = fileURLToPath(
  new URL('../../../scripts/preprocess-nic-image.py', import.meta.url),
);

export interface NicOcrCommandOptions {
  timeout: number;
  maxBuffer: number;
  windowsHide: boolean;
}

export type NicOcrCommandRunner = (
  command: string,
  args: string[],
  options: NicOcrCommandOptions,
) => Promise<string>;

const defaultCommandRunner: NicOcrCommandRunner = async (command, args, options) => {
  const result = await execFile(command, args, {
    timeout: options.timeout,
    maxBuffer: options.maxBuffer,
    windowsHide: options.windowsHide,
    encoding: 'utf8',
  });

  return result.stdout;
};

function invalidDocument(): AppError {
  return new AppError(
    ErrorCodes.INVALID_ARGUMENT,
    'The uploaded document is invalid or unsupported.',
    400,
  );
}

function processingFailed(): AppError {
  return new AppError(
    ErrorCodes.INTERNAL,
    'The document could not be processed. Please try another clear image or PDF.',
    500,
  );
}

function hasSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (contentType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return (
      bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)
    );
  }

  if (contentType === 'application/pdf') {
    // The PDF header must appear at the beginning of the file.
    return Buffer.from(bytes.subarray(0, 5)).toString('ascii') === '%PDF-';
  }

  return false;
}

async function runCommand(
  runner: NicOcrCommandRunner,
  command: string,
  args: string[],
): Promise<string> {
  try {
    return await runner(command, args, {
      timeout: COMMAND_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER_BYTES,
      windowsHide: true,
    });
  } catch {
    // Never expose stderr, arguments, or OCR content in errors.
    throw processingFailed();
  }
}

async function runTesseract(imagePath: string, runner: NicOcrCommandRunner): Promise<string> {
  const processedImagePath = `${imagePath}.processed.png`;

  await runCommand(runner, 'python3', [PREPROCESS_SCRIPT_PATH, imagePath, processedImagePath]);

  return runCommand(runner, 'tesseract', [processedImagePath, 'stdout', '-l', 'eng', '--psm', '1']);
}

async function extractFromPdf(
  pdfPath: string,
  directory: string,
  runner: NicOcrCommandRunner,
): Promise<string> {
  const info = await runCommand(runner, 'pdfinfo', [
    '-f',
    '1',
    '-l',
    String(MAX_PDF_PAGES + 1),
    pdfPath,
  ]);

  const pageMatch = info.match(/^\s*Pages:\s*(\d+)\s*$/im);
  const pageCount = pageMatch?.[1] ? Number(pageMatch[1]) : NaN;

  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_PDF_PAGES) {
    throw invalidDocument();
  }

  const prefix = join(directory, 'page');
  const renderArgs = [
    '-f',
    '1',
    '-l',
    String(pageCount),
    '-r',
    String(PDF_RENDER_DPI),
    '-scale-to',
    String(PDF_RENDER_MAX_DIMENSION),
    '-png',
  ];

  if (pageCount === 1) renderArgs.push('-singlefile');

  await runCommand(runner, 'pdftoppm', [...renderArgs, pdfPath, prefix]);

  const imagePaths = pageCount === 1 ? [`${prefix}.png`] : [`${prefix}-1.png`, `${prefix}-2.png`];

  const textParts: string[] = [];

  for (const imagePath of imagePaths) {
    textParts.push(await runTesseract(imagePath, runner));
  }

  return textParts.join('\n');
}

export async function extractNicOcrText(
  bytes: Uint8Array,
  contentType: string,
  runner: NicOcrCommandRunner = defaultCommandRunner,
): Promise<string> {
  if (bytes.length === 0 || bytes.length > NIC_OCR_MAX_BYTES || !hasSignature(bytes, contentType)) {
    throw invalidDocument();
  }

  let directory: string | undefined;

  try {
    directory = await mkdtemp(join(tmpdir(), 'gridx-nic-ocr-'));
    const extension =
      contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'pdf';

    const inputPath = join(directory, `input.${extension}`);
    await writeFile(inputPath, bytes, { mode: 0o600 });

    if (contentType === 'application/pdf') {
      return await extractFromPdf(inputPath, directory, runner);
    }

    return await runTesseract(inputPath, runner);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw processingFailed();
  } finally {
    if (directory) {
      await rm(directory, { recursive: true, force: true }).catch(() => {});
    }
  }
}
