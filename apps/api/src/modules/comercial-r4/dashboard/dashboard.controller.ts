import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('r4/dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get('metrics')
    async getMetrics() {
        return {
            success: true,
            data: await this.dashboardService.obtenerMetricas()
        };
    }
}
