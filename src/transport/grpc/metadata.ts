export function getHeaderValue(headers: Headers, key: string): string | undefined {
  return headers.get(key) ?? undefined;
}
