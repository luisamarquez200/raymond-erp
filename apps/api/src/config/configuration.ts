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
        endpoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT, 10) || 9000,
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || 'raymond_admin',
        secretKey: process.env.MINIO_SECRET_KEY || 'raymond_secret_2024',
        bucket: process.env.MINIO_BUCKET || 'comercial-r4',
    },
});
