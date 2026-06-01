import { Module } from '@nestjs/common';
import { CargaMasivaController } from './carga-masiva.controller';
import { CargaMasivaService } from './carga-masiva.service';

@Module({
  controllers: [CargaMasivaController],
  providers: [CargaMasivaService]
})
export class CargaMasivaModule {}
