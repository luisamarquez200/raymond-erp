import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Module({
  controllers: [ClientesController],
  providers: [ClientesService, PrismaDynamicService]
})
export class ClientesModule {}
