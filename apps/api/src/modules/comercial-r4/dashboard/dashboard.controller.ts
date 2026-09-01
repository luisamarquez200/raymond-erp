import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('r4/dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get('metrics')
    async getMetrics(@Query() query: any) {
        return {
            success: true,
            data: await this.dashboardService.obtenerMetricas(query)
        };
    }
}
