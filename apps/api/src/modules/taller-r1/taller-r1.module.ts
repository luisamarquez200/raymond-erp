import { Module, OnModuleInit } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TallerR1Controller } from './taller-r1.controller';
import { TallerR1Service } from './taller-r1.service';
import { EntradasController } from './entradas.controller';
import { EntradasService } from './entradas.service';
import { SalidasController } from './salidas.controller';
import { SalidasService } from './salidas.service';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';
import { UbicacionesController } from './ubicaciones.controller';
import { UbicacionesService } from './ubicaciones.service';
import { ModelosController } from './modelos.controller';
import { ModelosService } from './modelos.service';
import { AccesoriosController } from './accesorios.controller';
import { AccesoriosService } from './accesorios.service';
import { EquipoUbicacionController } from './equipo-ubicacion.controller';
import { EquipoUbicacionService } from './equipo-ubicacion.service';
import { AuthTallerController } from './auth-taller.controller';
import { AuthTallerService } from './auth-taller.service';
import { CargueMasivoController } from './cargue-masivo.controller';
import { CargueMasivoService } from './cargue-masivo.service';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { TecnicosController } from './tecnicos.controller';
import { TecnicosService } from './tecnicos.service';
import { InventarioController } from './inventario.controller';
import { InventarioService } from './inventario.service';
import { RenovadosController } from './renovados.controller';
import { RenovadosService } from './renovados.service';
import { TallerR1MailService } from './mail.service';
import { TallerR1MailController } from './mail.controller';
import { PrismaDynamicService } from '../../database/prisma-dynamic.service';
import { AuthModule } from '../auth/auth.module';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AdcController } from './adc/adc.controller';
import { AdcService } from './adc/adc.service';
import { StorageService } from './storage.service';
import { TotvsSyncController } from './totvs-sync.controller';
import { TotvsSyncService } from './totvs-sync.service';

@Module({
    imports: [AuthModule, HttpModule],
    controllers: [
        TallerR1Controller,
        EntradasController,
        SalidasController,
        ClientesController,
        EquiposController,
        UbicacionesController,
        ModelosController,
        AccesoriosController,
        CargueMasivoController,
        EvaluacionesController,
        UsuariosController,
        TecnicosController,

        InventarioController,
        EquipoUbicacionController,
        AuthTallerController,
        RenovadosController,
        TallerR1MailController,
        AuditoriaController,
        DashboardController,
        AdcController,
        TotvsSyncController,
    ],
    providers: [
        TallerR1Service,
        PrismaDynamicService,
        TallerR1MailService,
        EntradasService,
        SalidasService,
        ClientesService,
        EquiposService,
        UbicacionesService,
        ModelosService,
        AccesoriosService,
        CargueMasivoService,
        EvaluacionesService,
        UsuariosService,
        TecnicosService,

        InventarioService,
        EquipoUbicacionService,
        AuthTallerService,
        RenovadosService,
        AuditoriaService,
        DashboardService,
        AdcService,
        StorageService,
        TotvsSyncService,
    ],
    exports: [
        TallerR1Service,
        PrismaDynamicService,
        EntradasService,
        SalidasService,
        ClientesService,
        EquiposService,
        UbicacionesService,
        ModelosService,
        AccesoriosService,
        EquipoUbicacionService,
        CargueMasivoService,
        EvaluacionesService,
        UsuariosService,
        TecnicosService,
        InventarioService,
        TallerR1MailService,
        DashboardService,
        AdcService,
        StorageService,
    ],
})
export class TallerR1Module implements OnModuleInit {
    async onModuleInit() {
        console.log('[TallerR1Module] Initializing database connections...');
        await PrismaDynamicService.ensureClientsInitialized();
    }
}
