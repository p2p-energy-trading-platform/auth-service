export interface CreateUploadUrlInput {
  key: string;
  contentType: string;
  sizeBytes: number;
  expiresInSeconds: number;
}

export interface StoredObjectInfo {
  sizeBytes: number;
  contentType: string;
}

export interface FileStorage {
  /**
   * Returns a presigned URL the browser can PUT the file to. The upload must
   * use exactly this content type and size.
   */
  createUploadUrl(input: CreateUploadUrlInput): Promise<string>;

  /** Returns the stored object's size and type, or null if it does not exist. */
  getObjectInfo(key: string): Promise<StoredObjectInfo | null>;
}
