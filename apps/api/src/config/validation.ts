import * as Joi from 'joi';

export const validationSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test', 'provision')
        .default('development'),
    PORT: Joi.number().default(3000),
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().required().min(32),
    JWT_REFRESH_SECRET: Joi.string().required().min(32),
    CORS_ORIGIN: Joi.string().optional(),
    SUPER_ADMIN_EMAILS: Joi.string().optional(),
    ENABLE_SWAGGER: Joi.string().valid('true', 'false').default('false'),
    MINIO_ENDPOINT: Joi.string().optional(),
    MINIO_PORT: Joi.number().optional(),
    MINIO_USE_SSL: Joi.string().valid('true', 'false').optional(),
    MINIO_ACCESS_KEY: Joi.string().optional(),
    MINIO_SECRET_KEY: Joi.string().optional(),
    MINIO_BUCKET: Joi.string().optional(),
});
