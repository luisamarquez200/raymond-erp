import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import { UbiqoController } from './ubiqo.controller';
import { PrismaService } from '../../database/prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [WebhooksController, UbiqoController],
  providers: [WebhooksService, PrismaService],
  exports: [WebhooksService],
})
export class WebhooksModule { }
