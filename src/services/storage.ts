export interface StorageObject {
  key: string;
  contentType: string;
  size: number;
}
export interface ObjectStorage {
  createUpload(
    ownerId: string,
    object: StorageObject,
  ): Promise<{ url: string; expiresAt: Date }>;
  createReadUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
// Implement with S3 presigned URLs or Sites R2. Never accept a storage key as authorization.
