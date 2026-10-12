export const KYC_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const KYC_DOCUMENT_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

export function isAllowedKycDocument(contentType: string, sizeBytes: number): boolean {
  return (
    contentType in KYC_DOCUMENT_EXTENSIONS &&
    Number.isInteger(sizeBytes) &&
    sizeBytes > 0 &&
    sizeBytes <= KYC_DOCUMENT_MAX_BYTES
  );
}

export function kycDocumentKeyPrefix(userId: string): string {
  return `kyc/${userId}/`;
}

/**
 * True only for keys created for this user by the upload URL use case:
 * kyc/{userId}/{uuid}.{jpg|png|pdf}. Rejects other users' files and path tricks.
 */
export function isOwnKycDocumentKey(userId: string, key: string): boolean {
  const prefix = kycDocumentKeyPrefix(userId);

  if (!key.startsWith(prefix)) {
    return false;
  }

  return /^[0-9a-f-]{36}\.(jpg|png|pdf)$/.test(key.slice(prefix.length));
}
