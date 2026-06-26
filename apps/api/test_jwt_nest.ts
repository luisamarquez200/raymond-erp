import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './src/database/prisma.service';
import axios from 'axios';

async function bootstrap() {
    console.log('Bootstrapping app...');
    const app = await NestFactory.createApplicationContext(AppModule);
    const jwtService = app.get(JwtService);
    const prisma = app.get(PrismaService);

    console.log('Finding user...');
    const user = await prisma.users.findFirst({
        include: { roles: true }
    });

    if (!user) {
        console.log('No user found');
        return;
    }

    console.log(`User: ${user.email}, Role: ${user.roles?.name}`);

    const payload = {
        sub: user.id,
        email: user.email,
        orgId: user.organization_id
    };

    const token = jwtService.sign(payload);
    console.log('Token generated');

    try {
        const flotillaRes = await axios.get('http://localhost:8001/api/r4/flotilla', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Flotilla success, length:", flotillaRes.data.data?.length);
    } catch (e: any) {
        if (e.response) {
            console.error("Error from API:", e.response.status, JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("Error:", e.message);
        }
    }
    
    try {
        const adcsRes = await axios.get('http://localhost:8001/api/r4/adcs', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("ADCs success, length:", adcsRes.data.data?.length);
    } catch (e: any) {
        if (e.response) {
            console.error("Error from API (ADCs):", e.response.status, JSON.stringify(e.response.data, null, 2));
        } else {
            console.error("Error (ADCs):", e.message);
        }
    }

    await app.close();
}
bootstrap();
