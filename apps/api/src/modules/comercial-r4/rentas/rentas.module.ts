import { Module } from '@nestjs/common';
import { RentasController } from './rentas.controller';
import { RentasService } from './rentas.service';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';
import { MinioModule } from '../minio/minio.module';

@Module({
  imports: [MinioModule],
  controllers: [RentasController],
  providers: [RentasService, PrismaDynamicService],
})
export class RentasModule {}
