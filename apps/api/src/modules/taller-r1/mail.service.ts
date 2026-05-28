import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

@Injectable()
export class TallerR1MailService {
    private readonly logger = new Logger(TallerR1MailService.name);
    
    // Brevo Config
    private readonly brevoApiKey: string;
    private readonly brevoFrom: { email: string; name: string };
    private readonly brevoUrl = 'https://api.brevo.com/v3/smtp/email';

    constructor(private configService: ConfigService) {
        // Load Brevo
        this.brevoApiKey = this.configService.get<string>('BREVO_API_KEY');
        this.brevoFrom = {
            email: this.configService.get<string>('BREVO_FROM_EMAIL') || 'notificaciones@raymond.com.mx',
            name: 'Raymond WMS'
        };

        if (this.brevoApiKey) {
            this.logger.log('Brevo Mail Service initialized successfully');
        } else {
            this.logger.warn('No Mail Provider configured correctly. Mails will be logged but not sent.');
        }
    }

    /**
     * Generic send method that chooses the available provider
     */
    private async sendMail(payload: {
        to: string | string[],
        subject: string,
        html: string,
        attachments?: any[]
    }) {
        if (this.brevoApiKey) {
            return this.sendWithBrevo(payload);
        }

        this.logger.warn(`[DRY RUN] No provider configured. Subject: ${payload.subject}`);
        return null;
    }

    /**
     * Get recipients based on site or environment variable
     */
    private getRecipientsBySite(site?: string): string[] {
        let siteKey = site?.toUpperCase() || 'R3';
        
        // Map alias to env keys
        if (siteKey === 'NAVES') siteKey = 'R2';
        if (siteKey === 'FRONTERA') siteKey = 'R3';

        // Priority 1: Site-specific environment variable (e.g., NOTIFICATION_EMAILS_R1)
        const siteEmails = this.configService.get<string>(`NOTIFICATION_EMAILS_${siteKey}`);
        if (siteEmails) {
            return siteEmails.split(',').map(e => e.trim()).filter(e => e !== '');
        }

        // Priority 2: General environment variable
        const envEmails = this.configService.get<string>('NOTIFICATION_EMAILS');
        if (envEmails) {
            return envEmails.split(',').map(e => e.trim()).filter(e => e !== '');
        }

        // Default fallback
        return ['soportetaller@raymond.com.mx'];
    }

    private async sendWithBrevo(payload: {
        to: string | string[],
        subject: string,
        html: string,
        attachments?: any[]
    }) {
        try {
            const toArray = Array.isArray(payload.to) ? payload.to : [payload.to];
            const response = await axios.post(
                this.brevoUrl,
                {
                    sender: this.brevoFrom,
                    to: toArray.map(email => ({ email })),
                    subject: payload.subject,
                    htmlContent: payload.html,
                    attachment: payload.attachments?.map(att => ({
                        name: att.filename,
                        content: att.content // Brevo expects base64 string
                    }))
                },
                {
                    headers: {
                        'api-key': this.brevoApiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            this.logger.log(`Email sent via Brevo: ${payload.subject} (ID: ${response.data.messageId})`);
            return response.data;
        } catch (error: any) {
            const errorData = error.response?.data;
            this.logger.error(`Brevo API Error: ${JSON.stringify(errorData || error.message)}`);
            throw error;
        }
    }



    async sendRenovadoCompletionEmail(data: {
        serial: string,
        solicitud_id: string,
        tecnico: string,
        fecha: Date,
        cliente?: string,
        refacciones?: { area: string, descripcion: string, cantidad: number, precio_unitario: number }[],
        costos_externos?: { descripcion: string, precio: number, observaciones?: string }[],
        total_horas?: number,
    }) {
        const subject = `Renovado Finalizado - Equipo ${data.serial}`;
        const fechaStr = data.fecha.toLocaleDateString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const totalRefacciones = data.refacciones?.reduce((s, r) => s + r.precio_unitario * r.cantidad, 0) || 0;
        const totalExternos = data.costos_externos?.reduce((s, c) => s + c.precio, 0) || 0;

        const refaccionesHtml = data.refacciones && data.refacciones.length > 0
            ? `<table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;">
                  <thead>
                    <tr style="background:#e11d48;color:white;">
                      <th style="padding:10px 12px;text-align:left;font-size:11px;">Área</th>
                      <th style="padding:10px 12px;text-align:left;font-size:11px;">Refacción</th>
                      <th style="padding:10px 12px;text-align:center;font-size:11px;">Cant.</th>
                      <th style="padding:10px 12px;text-align:right;font-size:11px;">Precio Unit.</th>
                      <th style="padding:10px 12px;text-align:right;font-size:11px;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.refacciones.map(r => `
                      <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:8px 12px;font-weight:bold;">${r.area}</td>
                        <td style="padding:8px 12px;">${r.descripcion}</td>
                        <td style="padding:8px 12px;text-align:center;">${r.cantidad}</td>
                        <td style="padding:8px 12px;text-align:right;">$${r.precio_unitario.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td style="padding:8px 12px;text-align:right;font-weight:bold;">$${(r.precio_unitario * r.cantidad).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                  <tfoot>
                    <tr style="background:#f8fafc;font-weight:bold;">
                      <td colspan="4" style="padding:10px 12px;text-align:right;">Total Refacciones</td>
                      <td style="padding:10px 12px;text-align:right;">
                        $${totalRefacciones.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>`
            : '<p style="color:#94a3b8;font-style:italic;">No se utilizaron refacciones en este servicio.</p>';

        const costosHtml = data.costos_externos && data.costos_externos.length > 0
            ? `<div style="margin-top: 24px; border-top: 1px solid #fbbf24; padding-top: 16px;">
                  <h4 style="margin: 0 0 8px; font-size: 12px; font-weight: 900; color: #d97706; text-transform: uppercase; letter-spacing: 0.5px;">Costos Externos</h4>
                  <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                      <tr style="background:#f59e0b;color:white;">
                        <th style="padding:10px 12px;text-align:left;font-size:11px;">Descripción</th>
                        <th style="padding:10px 12px;text-align:left;font-size:11px;">Observaciones</th>
                        <th style="padding:10px 12px;text-align:right;font-size:11px;">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${data.costos_externos.map(c => `
                        <tr style="border-bottom:1px solid #fef3c7;">
                          <td style="padding:8px 12px;font-weight:bold;">${c.descripcion}</td>
                          <td style="padding:8px 12px;color:#64748b;">${c.observaciones || '—'}</td>
                          <td style="padding:8px 12px;text-align:right;font-weight:bold;">$${c.precio.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                    <tfoot>
                      <tr style="background:#fffbeb;font-weight:bold;">
                        <td colspan="2" style="padding:10px 12px;text-align:right;">Total Costos Externos</td>
                        <td style="padding:10px 12px;text-align:right;">$${totalExternos.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>`
            : '';

        const html = `
      <div style="font-family: sans-serif; color: #333; max-width: 620px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden;">
        <div style="background-color: #e11d48; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; font-weight: 900;">Renovado Completado</h1>
          <p style="margin: 8px 0 0; font-size: 13px; opacity: 0.9;">El equipo está disponible en stock</p>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 16px;">Hola,</p>
          <p>Se ha finalizado el proceso de renovación para el siguiente equipo. Queda liberado en el stock con estado <strong>Stock renovado</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr style="background:#f8fafc">
              <td style="padding:12px 16px;font-weight:bold;font-size:11px;text-transform:uppercase;color:#64748b;width:40%">Número de Serie</td>
              <td style="padding:12px 16px;font-size:14px;font-weight:900;color:#0f172a">${data.serial}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-weight:bold;font-size:11px;text-transform:uppercase;color:#64748b">Cliente</td>
              <td style="padding:12px 16px;font-size:13px;color:#0f172a">${data.cliente || 'N/A'}</td>
            </tr>
            <tr style="background:#f8fafc">
              <td style="padding:12px 16px;font-weight:bold;font-size:11px;text-transform:uppercase;color:#64748b">Técnico Responsable</td>
              <td style="padding:12px 16px;font-size:13px;color:#0f172a">${data.tecnico}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-weight:bold;font-size:11px;text-transform:uppercase;color:#64748b">Fecha de Finalización</td>
              <td style="padding:12px 16px;font-size:13px;color:#e11d48;font-weight:bold">${fechaStr}</td>
            </tr>
            <tr style="background:#f8fafc">
              <td style="padding:12px 16px;font-weight:bold;font-size:11px;text-transform:uppercase;color:#64748b">Horas Totales</td>
              <td style="padding:12px 16px;font-size:13px;color:#0f172a;font-weight:bold">${data.total_horas?.toFixed(1) || '0'} h</td>
            </tr>
          </table>

          <div style="margin-top: 30px; border-top: 2px solid #e11d48; padding-top: 20px;">
            <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Refacciones Utilizadas</h3>
            ${refaccionesHtml}
            ${costosHtml}
            <div style="margin-top: 20px; padding: 16px; background: #0f172a; border-radius: 12px; text-align: right;">
              <p style="margin: 0; font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Costo Total del Servicio</p>
              <p style="margin: 4px 0 0; font-size: 24px; font-weight: 900; color: #ffffff;">
                $${(totalRefacciones + totalExternos).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #eee;">
          <p style="margin: 0; font-weight: bold;">Sistema de Reportes Logística Raymond</p>
        </div>
      </div>
    `;

        // Generate PDF with refacciones
        const pdfBase64 = await this.generateRefaccionesPDF(data);
        const attachments = [];
        if (pdfBase64) {
            attachments.push({ filename: `Renovado_${data.serial}_Refacciones.pdf`, content: pdfBase64 });
        }

        const envEmails = this.configService.get<string>('NOTIFICATION_EMAILS_RENOVADOS');
        const to = envEmails ? envEmails.split(',').map(e => e.trim()).filter(e => e !== '') : this.getRecipientsBySite('R1');
        await this.sendMail({ to, subject, html, attachments });
    }

    async sendEntradaSalidaEmail(data: {
        tipo: 'Entrada' | 'Salida';
        folio: string;
        fecha: string;
        site?: string;
        pdfBase64?: string;
        excelBase64?: string;
        remision?: string;
    }) {
        const prefix = data.site ? data.site.toUpperCase() : 'R3';
        
        // Robust check for remision
        const remisionVal = data.remision?.trim().toUpperCase();
        const hasNoRemision = !data.remision || remisionVal === '' || remisionVal === 'PENDIENTE' || remisionVal === 'N/A' || remisionVal === '---';
        const isEnEspera = data.tipo === 'Salida' && hasNoRemision;
        
        let subject = `${prefix} - ${data.tipo} - ${data.folio}`;
        if (isEnEspera) {
            subject = `${prefix} - SALIDA EN ESPERA DE REMISIÓN - ${data.folio}`;
        }

        // TEST MODE: Use env var or fallback
        const recipients = this.getRecipientsBySite(data.site);

        const html = `
            <p>Hola,</p>
            <p>Se han generado los archivos correspondientes a la <strong>${data.tipo.toLowerCase()}</strong> del folio: <strong>${data.folio}</strong> con fecha de: <strong>${data.fecha}</strong>.</p>
            ${isEnEspera ? '<p style="color: #e11d48; font-weight: bold;">⚠️ NOTA: Esta salida se encuentra actualmente EN ESPERA DE REMISIÓN.</p>' : ''}
            <br>
            <p>Saludos,</p>
            <p>Sistema de Reportes Logística Raymond</p>
        `;

        const attachments = [];
        if (data.excelBase64) {
            const excelData = data.excelBase64.split('base64,')[1] || data.excelBase64.replace(/^data:application\/[\w.-]+;base64,/, '');
            attachments.push({ filename: `Resumen_${data.folio}.xlsx`, content: excelData });
        }
        if (data.pdfBase64) {
            const pdfData = data.pdfBase64.split('base64,')[1] || data.pdfBase64.replace(/^data:application\/[\w.-]+;base64,/, '');
            attachments.push({ filename: `Resumen_${data.folio}.pdf`, content: pdfData });
        }

        await this.sendMail({ to: recipients, subject, html, attachments });
    }

    async sendEvaluacionEmail(data: {
        serial: string;
        resultado: string;
        pdfBase64: string;
    }) {
        const subject = `Evaluación de Equipo - Serie ${data.serial}`;
        const envEmails = this.configService.get<string>('NOTIFICATION_EMAILS_RENOVADOS');
        const recipients = envEmails 
            ? envEmails.split(',').map(e => e.trim()).filter(e => e !== '') 
            : ['ogomez@raymond.com.mx', 'Taller_R1@raymond.com.mx', 'mherrera@raymond.com.mx'];

        const html = `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden;">
                <div style="background-color: #0f172a; color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900;">Evaluación de Equipo Finalizada</h1>
                </div>
                <div style="padding: 30px; line-height: 1.6;">
                    <p style="font-size: 16px;">Hola,</p>
                    <p>Se ha completado la evaluación para el equipo con número de serie: <strong>${data.serial}</strong>.</p>
                    <p>El resultado obtenido de la calificación de recibo es: <strong style="font-size: 18px; color: #e11d48;">${data.resultado}</strong>.</p>
                    <p>Se adjunta el documento PDF con los detalles de la evaluación.</p>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-weight: bold;">Sistema de Reportes Logística Raymond</p>
                </div>
            </div>
        `;

        const attachments = [];
        if (data.pdfBase64) {
            const pdfData = data.pdfBase64.split('base64,')[1] || data.pdfBase64.replace(/^data:application\/[\w.-]+;base64,/, '');
            attachments.push({ filename: `Evaluacion_${data.serial}.pdf`, content: pdfData });
        }

        await this.sendMail({ to: recipients, subject, html, attachments });
    }

    /**
     * Generate a Carta-format PDF for a taller service order
     */
    private async generateSolicitudPDF(data: {
        serial: string;
        modelo?: string;
        adc?: string;
        cliente?: string;
        fecha_target?: string;
        motivo?: string;
        creado_por?: string;
        fecha_creacion?: string;
    }): Promise<string> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: 60, bottom: 60, left: 60, right: 60 }
            });
            const chunks: Buffer[] = [];
            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer.toString('base64'));
            });
            doc.on('error', reject);

            const PAGE_W = doc.page.width - 120; // usable width
            const RED = '#e11d48';
            const DARK = '#0f172a';
            const GRAY = '#64748b';
            const LIGHT = '#f8fafc';

            // ── HEADER BAND ──────────────────────────────────────────────
            doc.rect(0, 0, doc.page.width, 110).fill(DARK);

            // Company name
            doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff')
               .text('RAYMOND', 60, 28, { continued: true })
               .fontSize(10).font('Helvetica').fillColor(RED)
               .text('  |  SISTEMA DE TALLER', { continued: false });

            doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
               .text('ORDEN DE SERVICIO', 60, 56);

            // Folio / date block on right
            const fechaDoc = data.fecha_creacion || new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
            doc.fontSize(8).fillColor('#94a3b8').text('FECHA DE EMISIÓN', doc.page.width - 200, 28, { width: 140, align: 'right' });
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff')
               .text(fechaDoc, doc.page.width - 200, 42, { width: 140, align: 'right' });

            // ── RED ACCENT BAR ────────────────────────────────────────────
            doc.rect(0, 110, doc.page.width, 6).fill(RED);

            let y = 136;

            // ── TITLE ─────────────────────────────────────────────────────
            doc.fontSize(18).font('Helvetica-Bold').fillColor(DARK)
               .text('SOLICITUD DE SERVICIO', 60, y);
            y += 32;

            // ── EQUIPMENT CARD ────────────────────────────────────────────
            doc.rect(60, y, PAGE_W, 80).fill(LIGHT).stroke('#e2e8f0');

            doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY)
               .text('NÚMERO DE SERIE', 80, y + 12);
            doc.fontSize(20).font('Helvetica-Bold').fillColor(DARK)
               .text(data.serial || 'N/A', 80, y + 24);

            const midX = 60 + PAGE_W / 2 + 10;
            doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY)
               .text('MODELO', midX, y + 12);
            doc.fontSize(14).font('Helvetica-Bold').fillColor(DARK)
               .text(data.modelo || 'N/D', midX, y + 24, { width: PAGE_W / 2 - 20 });
            y += 96;

            // ── DETAILS TABLE ─────────────────────────────────────────────
            const rows = [
                ['Fecha Requerida', data.fecha_target || 'No especificada'],
                ['ADC / Solicitante', data.adc || 'N/D'],
                ['Cliente', data.cliente || 'N/D'],
                ['Creado por', data.creado_por || 'Sistema'],
            ];

            rows.forEach(([label, value], i) => {
                const rowY = y + i * 36;
                if (i % 2 === 0) doc.rect(60, rowY, PAGE_W, 36).fill('#f1f5f9');
                doc.fontSize(8).font('Helvetica-Bold').fillColor(GRAY)
                   .text(label.toUpperCase(), 80, rowY + 8);
                doc.fontSize(11).font('Helvetica').fillColor(DARK)
                   .text(value, 80, rowY + 20, { width: PAGE_W - 40 });
            });
            y += rows.length * 36 + 16;

            // ── MOTIVO / NOTAS ────────────────────────────────────────────
            doc.rect(60, y, PAGE_W, 20).fill(RED);
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff')
               .text('MOTIVO / NOTAS', 80, y + 6);
            y += 20;

            const motivoText = data.motivo || 'Sin motivo especificado';
            const motivoHeight = Math.max(60, doc.heightOfString(motivoText, { width: PAGE_W - 40, fontSize: 11 }) + 24);
            doc.rect(60, y, PAGE_W, motivoHeight).fill(LIGHT).stroke('#e2e8f0');
            doc.fontSize(11).font('Helvetica').fillColor(DARK)
               .text(motivoText, 80, y + 12, { width: PAGE_W - 40 });
            y += motivoHeight + 24;

            // ── SIGNATURE AREA ────────────────────────────────────────────
            const sigY = Math.max(y + 20, doc.page.height - 160);
            doc.moveTo(60, sigY).lineTo(260, sigY).strokeColor('#cbd5e1').stroke();
            doc.moveTo(doc.page.width - 260, sigY).lineTo(doc.page.width - 60, sigY).strokeColor('#cbd5e1').stroke();
            doc.fontSize(8).font('Helvetica').fillColor(GRAY)
               .text('FIRMA JEFE DE TALLER', 60, sigY + 6, { width: 200, align: 'center' })
               .text('FIRMA SOLICITANTE', doc.page.width - 260, sigY + 6, { width: 200, align: 'center' });

            // ── FOOTER ────────────────────────────────────────────────────
            doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill(DARK);
            doc.fontSize(8).font('Helvetica').fillColor('#64748b')
               .text('Sistema de Reportes Logística Raymond  ·  Confidencial', 60, doc.page.height - 34,
                     { width: doc.page.width - 120, align: 'center' });

            doc.end();
        });
    }

    private async generateRefaccionesPDF(data: {
        serial: string;
        tecnico: string;
        fecha: Date;
        cliente?: string;
        refacciones?: { area: string, descripcion: string, cantidad: number, precio_unitario: number }[];
        costos_externos?: { descripcion: string, precio: number, observaciones?: string }[];
        total_horas?: number;
    }): Promise<string> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: 60, bottom: 60, left: 60, right: 60 }
            });
            const chunks: Buffer[] = [];
            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer.toString('base64'));
            });
            doc.on('error', reject);

            const PAGE_W = doc.page.width - 120;
            const RED = '#e11d48';
            const DARK = '#0f172a';
            const GRAY = '#64748b';
            const LIGHT = '#f8fafc';

            // Header
            doc.rect(0, 0, doc.page.width, 100).fill(DARK);
            doc.fontSize(20).font('Helvetica-Bold').fillColor('#ffffff')
               .text('RAYMOND', 60, 28, { continued: true })
               .fontSize(10).font('Helvetica').fillColor(RED)
               .text('  |  SISTEMA DE TALLER', { continued: false });
            doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
               .text('REPORTE DE FINALIZACIÓN', 60, 54);
            const fechaDoc = data.fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
            doc.fontSize(8).fillColor('#94a3b8').text('FECHA', doc.page.width - 200, 28, { width: 140, align: 'right' });
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#ffffff')
               .text(fechaDoc, doc.page.width - 200, 42, { width: 140, align: 'right' });

            doc.rect(0, 100, doc.page.width, 6).fill(RED);

            let y = 130;

            // Title
            doc.fontSize(18).font('Helvetica-Bold').fillColor(DARK)
               .text('RENOVADO FINALIZADO', 60, y);
            y += 30;

            // Info card
            doc.rect(60, y, PAGE_W, 70).fill(LIGHT).stroke('#e2e8f0');
            doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY)
               .text('NÚMERO DE SERIE', 80, y + 10);
            doc.fontSize(18).font('Helvetica-Bold').fillColor(DARK)
               .text(data.serial, 80, y + 22);
            const midX = 60 + PAGE_W / 2 + 10;
            doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY)
               .text('TÉCNICO', midX, y + 10);
            doc.fontSize(12).font('Helvetica-Bold').fillColor(DARK)
               .text(data.tecnico, midX, y + 22, { width: PAGE_W / 2 - 20 });
            doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY)
               .text('CLIENTE', midX, y + 42);
            doc.fontSize(10).font('Helvetica').fillColor(DARK)
               .text(data.cliente || 'N/D', midX, y + 52, { width: PAGE_W / 2 - 20 });
            doc.fontSize(7).font('Helvetica-Bold').fillColor(GRAY)
               .text('HORAS TOTALES', 80, y + 42);
            doc.fontSize(12).font('Helvetica-Bold').fillColor(DARK)
               .text(`${data.total_horas?.toFixed(1) || '0'} h`, 80, y + 52);
            y += 90;

            // Refacciones table
            doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK)
               .text('REFACCIONES UTILIZADAS', 60, y);
            y += 20;

            const refs = data.refacciones || [];
            if (refs.length === 0) {
                doc.fontSize(10).font('Helvetica').fillColor(GRAY)
                   .text('No se utilizaron refacciones en este servicio.', 60, y, { italic: true });
                y += 24;
            } else {
                // Table header
                const colX = [60, 120, 320, 390, 450];
                const colW = [60, 200, 70, 60, 80];
                doc.rect(60, y, PAGE_W, 22).fill(RED);
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
                doc.text('ÁREA', colX[0] + 6, y + 6, { width: colW[0] });
                doc.text('REFACCIÓN', colX[1] + 6, y + 6, { width: colW[1] });
                doc.text('CANT.', colX[2] + 6, y + 6, { width: colW[2], align: 'center' });
                doc.text('P/U', colX[3] + 6, y + 6, { width: colW[3], align: 'right' });
                doc.text('TOTAL', colX[4] + 6, y + 6, { width: colW[4], align: 'right' });
                y += 22;
                let total = 0;
                refs.forEach((r, i) => {
                    const rowTotal = r.precio_unitario * r.cantidad;
                    total += rowTotal;
                    if (i % 2 === 0) doc.rect(60, y, PAGE_W, 22).fill(LIGHT);
                    doc.fontSize(8).font('Helvetica-Bold').fillColor(DARK);
                    doc.text(r.area, colX[0] + 6, y + 5, { width: colW[0] });
                    doc.fontSize(8).font('Helvetica').fillColor(DARK);
                    doc.text(r.descripcion, colX[1] + 6, y + 5, { width: colW[1] });
                    doc.text(String(r.cantidad), colX[2] + 6, y + 5, { width: colW[2], align: 'center' });
                    doc.text(`$${r.precio_unitario.toFixed(2)}`, colX[3] + 6, y + 5, { width: colW[3], align: 'right' });
                    doc.text(`$${rowTotal.toFixed(2)}`, colX[4] + 6, y + 5, { width: colW[4], align: 'right' });
                    y += 22;
                });
                // Total row
                doc.rect(60, y, PAGE_W, 24).fill(DARK);
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
                doc.text('TOTAL GENERAL', 60 + 6, y + 6, { width: PAGE_W - 100, align: 'right' });
                doc.text(`$${total.toFixed(2)}`, colX[4] + 6, y + 6, { width: colW[4], align: 'right' });
                y += 40;
            }

            // Costos Externos section
            const externos = data.costos_externos || [];
            if (externos.length > 0) {
                doc.fontSize(10).font('Helvetica-Bold').fillColor(DARK)
                   .text('COSTOS EXTERNOS', 60, y);
                y += 20;

                const extColX = [60, 120, 380];
                const extColW = [60, 260, 130];
                doc.rect(60, y, PAGE_W, 22).fill('#f59e0b');
                doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
                doc.text('DESCRIPCIÓN', extColX[0] + 6, y + 6, { width: extColW[0] });
                doc.text('OBSERVACIONES', extColX[1] + 6, y + 6, { width: extColW[1] });
                doc.text('PRECIO', extColX[2] + 6, y + 6, { width: extColW[2], align: 'right' });
                y += 22;
                let totalExt = 0;
                externos.forEach((c, i) => {
                    totalExt += c.precio;
                    if (i % 2 === 0) doc.rect(60, y, PAGE_W, 22).fill(LIGHT);
                    doc.fontSize(8).font('Helvetica-Bold').fillColor(DARK);
                    doc.text(c.descripcion, extColX[0] + 6, y + 5, { width: extColW[0] });
                    doc.fontSize(8).font('Helvetica').fillColor(DARK);
                    doc.text(c.observaciones || '—', extColX[1] + 6, y + 5, { width: extColW[1] });
                    doc.text(`$${c.precio.toFixed(2)}`, extColX[2] + 6, y + 5, { width: extColW[2], align: 'right' });
                    y += 22;
                });
                doc.rect(60, y, PAGE_W, 24).fill(DARK);
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
                doc.text('TOTAL COSTOS EXTERNOS', 60 + 6, y + 6, { width: PAGE_W - 100, align: 'right' });
                doc.text(`$${totalExt.toFixed(2)}`, extColX[2] + 6, y + 6, { width: extColW[2], align: 'right' });
                y += 40;
            }

            // Footer
            doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill(DARK);
            doc.fontSize(8).font('Helvetica').fillColor('#64748b')
               .text('Sistema de Reportes Logística Raymond  ·  Confidencial', 60, doc.page.height - 34,
                     { width: doc.page.width - 120, align: 'center' });

            doc.end();
        });
    }

    async sendSolicitudTallerEmail(data: {
        serial: string;
        modelo?: string;
        motivo?: string;
        creado_por?: string;
        adc?: string;
        cliente?: string;
        fecha_target?: string;
        fecha_creacion?: string;
    }) {
        const subject = `Nueva Solicitud de Taller - Serie ${data.serial}`;
        const envEmails = this.configService.get<string>('NOTIFICATION_EMAILS_RENOVADOS');
        const recipients = envEmails 
            ? envEmails.split(',').map(e => e.trim()).filter(e => e !== '') 
            : ['ogomez@raymond.com.mx', 'Taller_R1@raymond.com.mx', 'mherrera@raymond.com.mx'];

        const html = `
            <div style="font-family: sans-serif; color: #333; max-width: 620px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden;">
                <div style="background-color: #e11d48; color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900;">Nueva Solicitud de Taller</h1>
                    <p style="margin: 8px 0 0; font-size: 13px; opacity: 0.9;">Se adjunta la orden de trabajo en formato PDF</p>
                </div>
                <div style="padding: 30px; line-height: 1.6;">
                    <p style="font-size: 16px;">Hola,</p>
                    <p>Se ha creado una nueva solicitud de servicio en el taller.</p>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                        <tr style="background:#f8fafc">
                            <td style="padding:12px 16px; font-weight:bold; font-size:11px; text-transform:uppercase; color:#64748b; width:40%">Número de Serie</td>
                            <td style="padding:12px 16px; font-size:14px; font-weight:900; color:#0f172a">${data.serial}</td>
                        </tr>
                        <tr>
                            <td style="padding:12px 16px; font-weight:bold; font-size:11px; text-transform:uppercase; color:#64748b">Modelo</td>
                            <td style="padding:12px 16px; font-size:13px; color:#0f172a">${data.modelo || 'N/D'}</td>
                        </tr>
                        <tr style="background:#f8fafc">
                            <td style="padding:12px 16px; font-weight:bold; font-size:11px; text-transform:uppercase; color:#64748b">ADC / Solicitante</td>
                            <td style="padding:12px 16px; font-size:13px; color:#0f172a">${data.adc || 'N/D'}</td>
                        </tr>
                        <tr>
                            <td style="padding:12px 16px; font-weight:bold; font-size:11px; text-transform:uppercase; color:#64748b">Cliente</td>
                            <td style="padding:12px 16px; font-size:13px; color:#0f172a">${data.cliente || 'N/D'}</td>
                        </tr>
                        <tr style="background:#f8fafc">
                            <td style="padding:12px 16px; font-weight:bold; font-size:11px; text-transform:uppercase; color:#64748b">Fecha Requerida</td>
                            <td style="padding:12px 16px; font-size:13px; color:#e11d48; font-weight:bold">${data.fecha_target || 'No especificada'}</td>
                        </tr>
                        <tr>
                            <td style="padding:12px 16px; font-weight:bold; font-size:11px; text-transform:uppercase; color:#64748b">Motivo / Notas</td>
                            <td style="padding:12px 16px; font-size:13px; color:#0f172a">${(data.motivo || 'N/A').replace(/\n/g, '<br>')}</td>
                        </tr>
                        <tr style="background:#f8fafc">
                            <td style="padding:12px 16px; font-weight:bold; font-size:11px; text-transform:uppercase; color:#64748b">Creado por</td>
                            <td style="padding:12px 16px; font-size:13px; color:#0f172a">${data.creado_por || 'N/A'}</td>
                        </tr>
                    </table>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-weight: bold;">Sistema de Reportes Logística Raymond</p>
                </div>
            </div>
        `;

        // Generate PDF
        const pdfBase64 = await this.generateSolicitudPDF(data);
        const attachments = [{ filename: `OrdenServicio_${data.serial}.pdf`, content: pdfBase64 }];

        await this.sendMail({ to: recipients, subject, html, attachments });
    }

    async sendRefaccionesEmail(data: {
        serial_equipo: string;
        excelBase64: string;
    }) {
        const subject = `Lista de Refacciones - Renovado Equipo ${data.serial_equipo}`;
        // TEST MODE: Use env var or fallback
        const recipients = this.getRecipientsBySite('R1'); // Usually refacciones are R1/Renovados
        /*
        const recipients = [
            'Taller_R1@raymond.com.mx',
            'ogomez@raymond.com.mx'
        ];
        */

        const html = `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden;">
                <div style="background-color: #0f172a; color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900;">Solicitud de Refacciones</h1>
                </div>
                <div style="padding: 30px; line-height: 1.6;">
                    <p style="font-size: 16px;">Hola,</p>
                    <p>Se adjunta el listado de refacciones solicitadas para el equipo con número de serie: <strong>${data.serial_equipo}</strong>.</p>
                    <p>Por favor, consulte el archivo Excel adjunto para ver los detalles.</p>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-weight: bold;">Sistema de Reportes Logística Raymond</p>
                </div>
            </div>
        `;

        const attachments = [];
        if (data.excelBase64) {
            const excelData = data.excelBase64.split('base64,')[1] || data.excelBase64.replace(/^data:application\/[\w.-]+;base64,/, '');
            attachments.push({ filename: `Refacciones_${data.serial_equipo}.xlsx`, content: excelData });
        }

        await this.sendMail({ to: recipients, subject, html, attachments });
    }

    async sendUserApprovedEmail(to: string, username: string, sites: string[]) {
        const subject = 'Acceso Concedido - Raymond Taller';
        const sitesFormatted = sites.map(s => `<strong>${s}</strong>`).join(', ');

        const html = `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: white; padding: 40px; text-align: center;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -1px;">¡BIENVENIDO!</h1>
                    <p style="margin-top: 10px; opacity: 0.9;">Tu acceso ha sido aprobado</p>
                </div>
                <div style="padding: 40px; line-height: 1.6;">
                    <p style="font-size: 16px;">Hola <strong>${username}</strong>,</p>
                    <p>Nos complace informarte que tu solicitud de acceso al sistema Raymond ha sido <strong>aprobada exitosamente</strong>.</p>
                    
                    <div style="background-color: #f8fafc; border-radius: 15px; padding: 25px; margin: 30px 0; border: 1px solid #e2e8f0;">
                        <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">SITIOS ASIGNADOS</p>
                        <p style="margin: 0; font-size: 18px; color: #e11d48;">${sitesFormatted}</p>
                    </div>

                    <p>Ya puedes iniciar sesión con tu correo electrónico y la contraseña que registraste.</p>
                    
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="${this.configService.get('FRONTEND_URL') || 'http://localhost:3000'}/login" 
                           style="background-color: #e11d48; color: white; padding: 18px 35px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block;">
                            INICIAR SESIÓN AHORA
                        </a>
                    </div>
                </div>
                <div style="background-color: #f9fafb; padding: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-weight: bold; color: #64748b;">© ${new Date().getFullYear()} Raymond Corporation</p>
                    <p style="margin: 5px 0 0 0;">Desarrollado por</p>
                    <p style="margin: 2px 0 0 0; font-weight: 900; color: #e11d48; letter-spacing: 1px;">RUN SOLUTIONS & SERVICES</p>
                </div>
            </div>
        `;

        await this.sendMail({ to, subject, html });
    }

    async sendUserRejectedEmail(to: string, username: string) {
        const subject = 'Información sobre tu solicitud de acceso - Raymond Taller';

        const html = `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden;">
                <div style="background-color: #475569; color: white; padding: 40px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 900;">Solicitud de Acceso</h1>
                </div>
                <div style="padding: 40px; line-height: 1.6;">
                    <p style="font-size: 16px;">Hola <strong>${username}</strong>,</p>
                    <p>Gracias por tu interés en acceder al sistema Raymond.</p>
                    <p>Lamentamos informarte que, tras revisar tu solicitud, esta <strong>no ha sido aprobada</strong> en este momento.</p>
                    <p style="margin-top: 20px; color: #64748b;">Si consideras que esto es un error o necesitas más información, por favor contacta al administrador de tu sucursal.</p>
                </div>
                <div style="background-color: #f9fafb; padding: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #eee;">
                    <p style="margin: 0; font-weight: bold; color: #64748b;">© ${new Date().getFullYear()} Raymond Corporation</p>
                    <p style="margin: 5px 0 0 0;">Desarrollado por</p>
                    <p style="margin: 2px 0 0 0; font-weight: 900; color: #e11d48; letter-spacing: 1px;">RUN SOLUTIONS & SERVICES</p>
                </div>
            </div>
        `;

        await this.sendMail({ to, subject, html });
    }
}

