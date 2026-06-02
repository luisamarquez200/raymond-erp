import { Module } from '@nestjs/common';
import { CargaMasivaController } from './carga-masiva.controller';
import { CargaMasivaService } from './carga-masiva.service';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Module({
  controllers: [CargaMasivaController],
  providers: [CargaMasivaService, PrismaDynamicService],
  exports: [CargaMasivaService],
})
export class CargaMasivaModule {}
