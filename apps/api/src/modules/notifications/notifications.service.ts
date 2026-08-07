import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) {}

    async getUserNotifications(userId: string) {
        return this.prisma.notifications.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            take: 50,
        });
    }

    async getUnreadCount(userId: string) {
        const count = await this.prisma.notifications.count({
            where: { user_id: userId, read: false },
        });
        return { unreadCount: count };
    }

    async markAsRead(id: string, userId: string) {
        return this.prisma.notifications.updateMany({
            where: { id, user_id: userId },
            data: { read: true, read_at: new Date() },
        });
    }

    async markAllAsRead(userId: string) {
        return this.prisma.notifications.updateMany({
            where: { user_id: userId, read: false },
            data: { read: true, read_at: new Date() },
        });
    }
}
