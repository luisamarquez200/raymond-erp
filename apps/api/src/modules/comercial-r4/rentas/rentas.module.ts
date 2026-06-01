import { Module } from '@nestjs/common';
import { RentasController } from './rentas.controller';
import { RentasService } from './rentas.service';

@Module({
  controllers: [RentasController],
  providers: [RentasService]
})
export class RentasModule {}
