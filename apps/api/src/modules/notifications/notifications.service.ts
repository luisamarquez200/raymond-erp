import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) {}

    private async syncUserNotifications(userId: string) {
        try {
            const user = await this.prisma.users.findUnique({ where: { id: userId } });
            if (!user) return;

            const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase();
            const adcName = ((user as any).adc_asociado_name || '').trim().toLowerCase();
            const userEmail = (user.email || '').trim().toLowerCase();

            // Fetch existing notifications for this user once to avoid JSON path filter syntax errors
            const existingNotifs = await this.prisma.notifications.findMany({
                where: { user_id: userId }
            });
            const existingLogIds = new Set(
                existingNotifs
                    .map(n => (n.metadata as any)?.log_id)
                    .filter(Boolean)
            );

            // Find logs that are approved or rejected
            const db = this.prisma as any;
            const logs = db.cambioSitioLog ? await db.cambioSitioLog.findMany({
                take: 100,
                orderBy: { fecha: 'desc' }
            }) : [];

            for (const log of logs) {
                if (existingLogIds.has(log.id)) continue;

                let datosPropuestos: any = {};
                try {
                    datosPropuestos = JSON.parse(log.motivo || '{}');
                } catch (e) {
                    continue;
                }

                const solicitanteId = datosPropuestos.solicitante_id;
                const solicitante = (datosPropuestos.solicitante || '').toLowerCase();
                
                const isMyLog = 
                    log.usuario_id === userId ||
                    solicitanteId === userId ||
                    (userFullName && userFullName.length > 2 && (solicitante.includes(userFullName) || userFullName.includes(solicitante))) ||
                    (adcName && adcName.length > 2 && (solicitante.includes(adcName) || adcName.includes(solicitante))) ||
                    (userEmail && userEmail.length > 2 && (solicitante.includes(userEmail) || userEmail.includes(solicitante))) ||
                    solicitante.includes('adc') ||
                    solicitante.includes('solicitante');

                if (!isMyLog) continue;

                const isApproved = log.aprobado === true || datosPropuestos.estado === 'APROBADA' || String(log.motivo).includes('APROBADA');
                const isRejected = datosPropuestos.estado === 'RECHAZADA' || String(log.motivo).includes('RECHAZADA');

                if (!isApproved && !isRejected) continue;

                const accionNombre = datosPropuestos?.accion_nombre || 'Actualización de Flotilla';
                const fechaRespuesta = datosPropuestos?.fecha_respuesta_formatted || (log.fecha ? new Date(log.fecha).toLocaleDateString('es-MX') : '');
                const respondidoPor = datosPropuestos?.aprobado_por || datosPropuestos?.rechazado_por || 'Gerencia';

                const title = isApproved
                    ? `✅ Solicitud Aprobada: ${accionNombre}`
                    : `❌ Solicitud Rechazada: ${accionNombre}`;

                const message = isApproved
                    ? `✅ Tu solicitud de ${accionNombre} fue aprobada por ${respondidoPor} ${fechaRespuesta ? 'el ' + fechaRespuesta : ''}.`
                    : `❌ Tu solicitud de ${accionNombre} fue rechazada por ${respondidoPor} ${fechaRespuesta ? 'el ' + fechaRespuesta : ''}.`;

                await this.prisma.notifications.create({
                    data: {
                        user_id: userId,
                        title,
                        message,
                        type: isApproved ? 'SUCCESS' : 'ERROR',
                        metadata: { log_id: log.id }
                    }
                });
            }
        } catch (e) {
            console.error('[syncUserNotifications error]', e);
        }
    }

    async getUserNotifications(userId: string) {
        await this.syncUserNotifications(userId);

        return this.prisma.notifications.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            take: 50,
        });
    }

    async getUnreadCount(userId: string) {
        await this.syncUserNotifications(userId);

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

    async deleteNotification(id: string, userId: string) {
        return this.prisma.notifications.deleteMany({
            where: { id, user_id: userId },
        });
    }

    async deleteAllNotifications(userId: string) {
        return this.prisma.notifications.deleteMany({
            where: { user_id: userId },
        });
    }
}
