import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import * as path from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
    // Validate required environment variables
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
    const missing = requiredEnvVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate JWT secrets length
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
        throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        bodyParser: false, // Disable default body parser to configure custom limits
    });

    // CORS
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:8000',
        'http://localhost:8001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:8000',
        'http://127.0.0.1:8001',
        'https://dev.logistica-raymond.runsolutions-services.com'
    ];

    // Add production origin if configured
    if (process.env.CORS_ORIGIN) {
        const origins = process.env.CORS_ORIGIN.split(',').map(o => o.trim());
        allowedOrigins.push(...origins);
    }

    app.enableCors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
        allowedHeaders: 'Content-Type, Accept, Authorization, x-site-id, x-taller-username, x-org-id',
        exposedHeaders: ['Authorization', 'x-org-id', 'x-site-id'],
    });

    // Static Assets
    app.useStaticAssets(path.join(process.cwd(), 'uploads'), {
        prefix: '/uploads/',
    });

    // Increase body parser limit for image uploads (50MB)
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Security Headers
    app.use(helmet());

    // Global Prefix
    app.setGlobalPrefix('api');

    // Global Validation
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));

    // Swagger Documentation
    const config = new DocumentBuilder()
        .setTitle('RAYMOND ERP API')
        .setDescription(`
# RAYMOND ERP - Enterprise Resource Planning System

A comprehensive, multi-tenant ERP system built with NestJS, featuring:

- **Project Management**: Projects, Tasks (Kanban), Sprints with Burndown
- **Finance**: Double-entry accounting, Accounts, Journal Entries, Financial Reports
- **Analytics**: Real-time KPIs, Dashboards, Metrics
- **Notifications**: Email & In-App notifications via BullMQ
- **Multi-Tenancy**: Organization-level data isolation
- **RBAC**: Role-Based Access Control with granular permissions

## Authentication

All endpoints (except auth) require a Bearer token. Obtain one via \`POST /auth/login\`.

## Multi-Tenancy

The \`X-Organization-Id\` header is required for all authenticated requests.
        `)
        .setVersion('1.0.0')
        .setContact('RAYMOND Team', 'https://raymond-erp.com', 'support@raymond-erp.com')
        .setLicense('MIT', 'https://opensource.org/licenses/MIT')
        .addBearerAuth(
            {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter JWT token',
            },
            'JWT',
        )
        .addTag('Auth', 'Authentication and authorization endpoints')
        .addTag('Users', 'User management')
        .addTag('Roles', 'Role and permission management')
        .addTag('Projects', 'Project management')
        .addTag('Tasks', 'Task management with Kanban support')
        .addTag('Sprints', 'Sprint management with burndown charts')
        .addTag('Finance', 'Financial management and accounting')
        .addTag('Analytics', 'KPIs, metrics, and dashboards')
        .addTag('Health', 'System health checks')
        .build();

    const document = SwaggerModule.createDocument(app, config);

    // Security: Only enable Swagger in development or if explicitly enabled
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
        SwaggerModule.setup('api/docs', app, document, {
            customSiteTitle: 'RAYMOND ERP API Documentation',
            customCss: '.swagger-ui .topbar { display: none }',
            swaggerOptions: {
                persistAuthorization: true,
                docExpansion: 'none',
                filter: true,
                showRequestDuration: true,
            },
        });
    }

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');

    const logger = new Logger('Bootstrap');
    logger.log(`🚀 Application is running on: ${await app.getUrl()}`);
    logger.log(`📚 API Documentation: ${await app.getUrl()}/api/docs`);
}
bootstrap();
