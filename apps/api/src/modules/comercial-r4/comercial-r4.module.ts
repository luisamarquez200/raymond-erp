import { Module } from '@nestjs/common';
import { ActivosModule } from './activos/activos.module';
import { ClientesModule } from './clientes/clientes.module';
import { RentasModule } from './rentas/rentas.module';
import { CargaMasivaModule } from './carga-masiva/carga-masiva.module';
import { FlotillaController } from './flotilla/flotilla.controller';
import { FlotillaService } from './flotilla/flotilla.service';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';

@Module({
    imports: [
        ActivosModule,
        ClientesModule,
        RentasModule,
        CargaMasivaModule
    ],
    controllers: [FlotillaController],
    providers: [FlotillaService, PrismaDynamicService]
})
export class ComercialR4Module {}