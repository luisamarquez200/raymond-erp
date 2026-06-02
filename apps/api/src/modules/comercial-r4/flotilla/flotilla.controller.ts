import { Controller, Get, Request } from '@nestjs/common';
import { FlotillaService } from './flotilla.service';

@Controller('r4/flotilla')
// @UseGuards(JwtAuthGuard, RolesGuard) // Descomentar cuando la auth esté completamente lista en frontend
export class FlotillaController {
    constructor(private readonly flotillaService: FlotillaService) {}

    @Get()
    async getFlotilla(@Request() req: any) {
        return this.flotillaService.obtenerFlotilla();
    }
}
