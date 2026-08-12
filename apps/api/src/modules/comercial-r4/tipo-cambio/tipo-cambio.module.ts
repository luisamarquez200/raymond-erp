import { Module } from '@nestjs/common';
import { TipoCambioController } from './tipo-cambio.controller';
import { TipoCambioService } from './tipo-cambio.service';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Module({
    controllers: [TipoCambioController],
    providers: [TipoCambioService, PrismaDynamicService],
    exports: [TipoCambioService]
})
export class TipoCambioModule {}
