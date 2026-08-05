import { Module } from '@nestjs/common';
import { PresupuestosController } from './presupuestos.controller';
import { PresupuestosService } from './presupuestos.service';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Module({
    controllers: [PresupuestosController],
    providers: [PresupuestosService, PrismaDynamicService],
})
export class PresupuestosModule {}
