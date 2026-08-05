import { Module, OnModuleInit } from '@nestjs/common';
import { ActivosModule } from './activos/activos.module';
import { ClientesModule } from './clientes/clientes.module';
import { RentasModule } from './rentas/rentas.module';
import { CargaMasivaModule } from './carga-masiva/carga-masiva.module';
import { PresupuestosModule } from './presupuestos/presupuestos.module';
import { FlotillaController } from './flotilla/flotilla.controller';
import { FlotillaService } from './flotilla/flotilla.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { OrdenesController } from './ordenes/ordenes.controller';
import { OrdenesService } from './ordenes/ordenes.service';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';
import { AdcsController } from './adcs/adcs.controller';
import { AdcsService } from './adcs/adcs.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
    imports: [
        ActivosModule,
        ClientesModule,
        RentasModule,
        CargaMasivaModule,
        PresupuestosModule
    ],
    controllers: [
        FlotillaController,
        DashboardController,
        OrdenesController,
        AdcsController
    ],
    providers: [
        FlotillaService,
        DashboardService,
        OrdenesService,
        PrismaDynamicService,
        AdcsService,
        PrismaService
    ]
})
export class ComercialR4Module implements OnModuleInit {
    async onModuleInit() {
        await PrismaDynamicService.ensureClientsInitialized();
    }
}