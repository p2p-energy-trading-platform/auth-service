export interface SriLankanNicOcrResult {
  nicNumber: string | null;
  dateOfBirth: string | null;
  fullName: string | null;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > new Date().getUTCFullYear() ||
    month < 1 ||
    month > 12 ||
    day < 1
  ) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function formatDate(year: number, month: number, day: number): string | null {
  if (!isValidDate(year, month, day)) return null;

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function dateFromNic(nic: string): string | null {
  let year: number;
  let dayOfYear: number;

  if (/^\d{12}$/.test(nic)) {
    year = Number(nic.slice(0, 4));
    dayOfYear = Number(nic.slice(4, 7));
  } else if (/^\d{9}[VX]$/.test(nic)) {
    year = 1900 + Number(nic.slice(0, 2));
    dayOfYear = Number(nic.slice(2, 5));
  } else {
    return null;
  }

  // Sri Lankan NICs encode female dates using an offset of 500.
  if (dayOfYear > 500) dayOfYear -= 500;

  const daysInYear = new Date(Date.UTC(year, 1, 29)).getUTCDate() === 29 ? 366 : 365;

  if (dayOfYear < 1 || dayOfYear > daysInYear) return null;

  const date = new Date(Date.UTC(year, 0, dayOfYear));

  return formatDate(year, date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Validates the format and encoded day-of-year of a Sri Lankan NIC.
 * This does not establish document authenticity or identity ownership.
 */
export function isValidSriLankanNicNumber(value: string): boolean {
  const nic = value.trim().toUpperCase();

  return (/^\d{12}$/.test(nic) || /^\d{9}[VX]$/.test(nic)) && dateFromNic(nic) !== null;
}

function extractNic(text: string): string | null {
  const normalized = text.toUpperCase().replace(/[ \t.-]/g, '');

  // Prefer a number explicitly associated with a NIC label.
  const labelled = text.match(
    /(?:NIC(?:\s*(?:NO|NUMBER|#))?|NATIONAL\s+IDENTITY\s+(?:CARD|NO))\s*[:#-]?\s*([0-9OIl]{9,12}\s*[VX]?)/i,
  );

  // Only accept complete number tokens. Do not extract a NIC-shaped
  // substring from a longer reference or account number.
  const candidates = [
    ...(labelled ? [labelled[1]] : []),
    ...(normalized.match(/(?<![A-Z0-9])(?:\d{12}|\d{9}[VX])(?![A-Z0-9])/g) ?? []),
  ];

  for (const candidate of candidates) {
    if (candidate === undefined) continue;

    const nic = candidate
      .toUpperCase()
      .replace(/[ \t.-]/g, '')
      .replace(/[O]/g, '0')
      .replace(/[IL]/g, '1');

    if ((/^\d{12}$/.test(nic) || /^\d{9}[VX]$/.test(nic)) && dateFromNic(nic) !== null) {
      return nic;
    }
  }

  return null;
}

function extractPrintedDate(text: string): string | null {
  const labelled = text.match(
    /(?:DATE\s+OF\s+BIRTH|D\.?O\.?B\.?|BIRTH\s+DATE)\s*[:-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})/i,
  );

  const value = labelled?.[1];
  if (!value) return null;

  const parts = value.split(/[/.-]/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    return null;
  }

  const [first, second, third] = parts;
  if (first === undefined || second === undefined || third === undefined) {
    return null;
  }

  if (/^\d{4}/.test(value)) {
    return formatDate(first, second, third);
  }

  // Sri Lankan printed dates are commonly day/month/year.
  return formatDate(third, second, first);
}

function extractFullName(text: string): string | null {
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) continue;

    const labelled = line.match(/^\s*(?:FULL\s+NAME|NAME\s+IN\s+FULL|NAME)\s*:?\s*(.*?)\s*$/i);

    if (!labelled) continue;

    let capturedName = labelled[1]?.trim() ?? '';

    // Some card layouts put the value on the line after its label.
    if (!capturedName) {
      for (let next = index + 1; next < lines.length; next += 1) {
        const candidate = lines[next]?.trim() ?? '';
        if (candidate) {
          // OCR may split the NAME label across adjacent lines.
          // Strip only a recognizable label fragment, not arbitrary text.
          capturedName = candidate
            .replace(/^(?:ame|name|full\s+name|name\s+in\s+full)\s*:\s*/i, '')
            .trim();
          break;
        }
      }
    }

    const name = capturedName
      .split(/\r?\n/)[0]
      ?.replace(/\s+/g, ' ')
      .trim()
      .replace(/[ .'-]+$/, '');

    if (
      !name ||
      name.length < 3 ||
      name.length > 100 ||
      !/[A-Z]/i.test(name) ||
      /\d/.test(name) ||
      !/^[A-Z .'-]+$/i.test(name) ||
      /^(?:OF|IN|ON|FOR)\b/i.test(name)
    ) {
      continue;
    }

    return name;
  }

  return null;
}

export function parseSriLankanNicOcrText(text: string): SriLankanNicOcrResult {
  const nicNumber = extractNic(text);
  const dateOfBirth = extractPrintedDate(text) ?? (nicNumber ? dateFromNic(nicNumber) : null);

  return {
    nicNumber,
    dateOfBirth,
    fullName: extractFullName(text),
  };
}
