export default () => ({
    port: parseInt(process.env.PORT, 10) || 3000,
    database: {
        url: process.env.DATABASE_URL,
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
    },
    cors: {
        origin: process.env.CORS_ORIGIN,
    },
    minio: {
        endpoint: (process.env.MINIO_ENDPOINT || process.env.S3_ENDPOINT || 'localhost').replace(/^https?:\/\//, '').replace(/\/$/, ''),
        port: process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : ((process.env.S3_ENDPOINT || '').startsWith('https') ? 443 : 9000),
        useSSL: process.env.MINIO_USE_SSL ? process.env.MINIO_USE_SSL === 'true' : ((process.env.S3_ENDPOINT || '').startsWith('https')),
        accessKey: process.env.MINIO_ACCESS_KEY || process.env.S3_ACCESS_KEY_ID || 'raymond_admin',
        secretKey: process.env.MINIO_SECRET_KEY || process.env.S3_SECRET_ACCESS_KEY || 'raymond_secret_2024',
        bucket: process.env.MINIO_BUCKET || process.env.S3_BUCKET || 'comercial-r4',
        region: process.env.S3_REGION || 'us-east-1',
    },
});
