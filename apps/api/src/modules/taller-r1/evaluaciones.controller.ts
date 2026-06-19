
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('taller-r1/evaluaciones')
export class EvaluacionesController {
    constructor(private readonly evaluacionesService: EvaluacionesService) { }

    @Post('equipo')
    async saveEquipoEvaluation(@Body() data: any) {
        return this.evaluacionesService.saveEquipoEvaluation(data);
    }

    @Get('equipo/:id')
    async getEquipoEvaluation(@Param('id') id: string) {
        try {
            const result = await this.evaluacionesService.getEquipoEvaluation(id);
            console.log('✅ getEquipoEvaluation SUCCESS for id:', id, 'result:', result);
            return result;
        } catch (error) {
            console.error('❌ getEquipoEvaluation ERROR for id:', id, 'error:', error);
            throw error;
        }
    }

    @Post('accesorio')
    async saveAccesorioEvaluation(@Body() data: any) {
        return this.evaluacionesService.saveAccesorioEvaluation(data);
    }

    @Get('accesorio/:id')
    async getAccesorioEvaluation(@Param('id') id: string) {
        return this.evaluacionesService.getAccesorioEvaluation(id);
    }

    @Post('accesorio/:id/carga')
    async registerCharge(
        @Param('id') id: string,
        @Body() body: any
    ) {
        console.log(`[EvaluacionesController] POST charge for ${id}. Body:`, body);
        return this.evaluacionesService.registerCharge(id, body.comentarios, body.fecha_carga);
    }

    @Get('accesorio/:id/historial-cargas')
    async getChargeHistory(@Param('id') id: string) {
        return this.evaluacionesService.getChargeHistory(id);
    }

    @Get('detalle/:id')
    async getEvaluationById(@Param('id') id: string) {
        return this.evaluacionesService.getEvaluationById(id);
    }

    @Get('historial-equipo/:serial')
    async getHistoryBySerial(@Param('serial') serial: string) {
        return this.evaluacionesService.getHistoryBySerial(serial);
    }


    @Get('todos-equipos')
    async getAllEquiposEvaluations() {
        return this.evaluacionesService.getAllEquiposEvaluations();
    }

    @Get('equipos-pendientes')
    async getPendingEquipos() {
        return this.evaluacionesService.getPendingEquipos();
    }

    @Post('bulk-generic-r1')
    async bulkGenericEvaluationR1() {
        return this.evaluacionesService.bulkGenericEvaluationR1();
    }
}
