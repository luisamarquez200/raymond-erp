import { Module } from '@nestjs/common';
import { ActivosModule } from './activos/activos.module';
import { ClientesModule } from './clientes/clientes.module';
import { RentasModule } from './rentas/rentas.module';
import { CargaMasivaModule } from './carga-masiva/carga-masiva.module';
import { FlotillaController } from './flotilla/flotilla.controller';
import { FlotillaService } from './flotilla/flotilla.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { OrdenesController } from './ordenes/ordenes.controller';
import { OrdenesService } from './ordenes/ordenes.service';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';

@Module({
    imports: [
        ActivosModule,
        ClientesModule,
        RentasModule,
        CargaMasivaModule
    ],
    controllers: [
        FlotillaController,
        DashboardController,
        OrdenesController
    ],
    providers: [
        FlotillaService,
        DashboardService,
        OrdenesService,
        PrismaDynamicService
    ]
})
export class ComercialR4Module {}