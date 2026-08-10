import { Controller, Get, Put, Param, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}

    @Get()
    async getMyNotifications(@Request() req: any) {
        const userId = req.user.id || req.user.sub;
        const data = await this.notificationsService.getUserNotifications(userId);
        return { success: true, data };
    }

    @Get('unread-count')
    async getUnreadCount(@Request() req: any) {
        const userId = req.user.id || req.user.sub;
        return this.notificationsService.getUnreadCount(userId);
    }

    @Put('mark-all-read')
    async markAllAsRead(@Request() req: any) {
        const userId = req.user.id || req.user.sub;
        await this.notificationsService.markAllAsRead(userId);
        return { success: true, message: 'Notificaciones marcadas como leídas' };
    }

    @Put(':id/read')
    async markAsRead(@Param('id') id: string, @Request() req: any) {
        const userId = req.user.id || req.user.sub;
        await this.notificationsService.markAsRead(id, userId);
        return { success: true, message: 'Notificación marcada como leída' };
    }
}
