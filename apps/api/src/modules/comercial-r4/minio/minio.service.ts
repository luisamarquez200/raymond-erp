import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
    private readonly logger = new Logger(MinioService.name);
    private client: Minio.Client;
    private bucket: string;

    constructor(private readonly configService: ConfigService) {}

    async onModuleInit() {
        const cfg = this.configService.get('minio');
        this.bucket = cfg.bucket;

        this.client = new Minio.Client({
            endPoint: cfg.endpoint,
            port: cfg.port,
            useSSL: cfg.useSSL,
            accessKey: cfg.accessKey,
            secretKey: cfg.secretKey,
        });

        await this.ensureBucketExists();
    }

    private async ensureBucketExists() {
        try {
            const exists = await this.client.bucketExists(this.bucket);
            if (!exists) {
                await this.client.makeBucket(this.bucket);
                this.logger.log(`Bucket "${this.bucket}" creado`);
            } else {
                this.logger.log(`Bucket "${this.bucket}" listo`);
            }
        } catch (err: any) {
            this.logger.error(`Error al verificar/crear bucket: ${err.message}`);
        }
    }

    async uploadFile(
        objectKey: string,
        buffer: Buffer,
        mimetype: string,
    ): Promise<string> {
        await this.client.putObject(this.bucket, objectKey, buffer, buffer.length, {
            'Content-Type': mimetype,
        });
        return objectKey;
    }

    async getSignedUrl(objectKey: string, ttlSeconds = 3600): Promise<string> {
        return this.client.presignedGetObject(this.bucket, objectKey, ttlSeconds);
    }

    async deleteFile(objectKey: string): Promise<void> {
        await this.client.removeObject(this.bucket, objectKey);
    }
}
