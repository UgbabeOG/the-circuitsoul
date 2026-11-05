import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';

export interface StorageClient {
  uploadObject(key: string, body: Buffer | Readable | string, contentType: string): Promise<string>;
  downloadObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export interface S3StorageClientConfig {
  region: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  publicUrlBase?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

export const storageEnvSchema = z.object({
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1, 'S3_BUCKET is required'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_PUBLIC_URL_BASE: z.string().url().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_SESSION_TOKEN: z.string().optional()
});

export type StorageEnv = z.infer<typeof storageEnvSchema>;

export function validateStorageEnv(env: Record<string, string | undefined>) {
  return storageEnvSchema.parse(env);
}

export class S3StorageClient implements StorageClient {
  private client: S3Client;
  private bucket: string;
  private publicUrlBase?: string;

  constructor(config: S3StorageClientConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: config.credentials
    });
    this.bucket = config.bucket;
    this.publicUrlBase = config.publicUrlBase;
  }

  async uploadBuffer(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const contentType = mimeType || 'application/octet-stream';
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000'
      })
    );

    return this.publicUrlBase ? `${this.publicUrlBase.replace(/\/$/, '')}/${key}` : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async uploadObject(key: string, body: Buffer | Readable | string, contentType: string): Promise<string> {
    const input: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType
    };

    await this.client.send(new PutObjectCommand(input));
    return this.getPublicUrl(key);
  }

  async downloadObject(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body) {
      throw new Error(`Object not found: ${key}`);
    }

    return streamToBuffer(response.Body as Readable);
  }

  async deleteFile(key: string): Promise<void> {
    await this.deleteObject(key);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return this.getPresignedUrl(key, expiresInSeconds);
  }

  async getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  private get region() {
    return this.client.config.region ?? 'us-east-1';
  }

  private getPublicUrl(key: string): string {
    if (this.publicUrlBase) {
      return `${this.publicUrlBase.replace(/\/$/, '')}/${key}`;
    }

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

export const createStorageClient = (config: S3StorageClientConfig) => new S3StorageClient(config);
export { getSignedUrl };
