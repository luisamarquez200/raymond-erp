import { Controller, Post } from '@nestjs/common';
import { TotvsSyncService } from './totvs-sync.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('taller-r1/totvs-sync')
export class TotvsSyncController {
    constructor(private readonly service: TotvsSyncService) { }

    @Post('refacciones')
    async syncRefacciones() {
        return this.service.syncRefacciones();
    }
}
