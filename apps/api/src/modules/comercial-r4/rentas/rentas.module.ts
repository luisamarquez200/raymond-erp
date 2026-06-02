import { Module } from '@nestjs/common';
import { RentasController } from './rentas.controller';
import { RentasService } from './rentas.service';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Module({
  controllers: [RentasController],
  providers: [RentasService, PrismaDynamicService]
})
export class RentasModule {}
