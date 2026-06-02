import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { SitiosController } from './sitios.controller';
import { ClientesService } from './clientes.service';
import { PrismaDynamicService } from '../../../database/prisma-dynamic.service';

@Module({
  controllers: [ClientesController, SitiosController],
  providers: [ClientesService, PrismaDynamicService]
})
export class ClientesModule {}
