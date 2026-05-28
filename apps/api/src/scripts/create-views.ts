import { PrismaClient } from '@prisma/client-taller-r1';

const prisma = new PrismaClient();

const VIEWS = [
    {
        name: 'v_equipos_renovados_semana',
        sql: `
            CREATE OR REPLACE VIEW v_equipos_renovados_semana AS
            SELECT 
                YEAR(updated_at) AS anio,
                WEEK(updated_at, 1) AS semana,
                COALESCE(tecnico_responsable, 'Sin asignar') AS tecnico,
                COUNT(*) AS cantidad
            FROM 
                renovado_solicitud
            WHERE 
                estado = 'Finalizado'
            GROUP BY 
                YEAR(updated_at),
                WEEK(updated_at, 1),
                tecnico_responsable;
        `
    },
    {
        name: 'v_equipos_renovados_periodo',
        sql: `
            CREATE OR REPLACE VIEW v_equipos_renovados_periodo AS
            SELECT 
                YEAR(updated_at) AS anio,
                MONTH(updated_at) AS mes,
                WEEK(updated_at, 1) AS semana,
                COALESCE(tecnico_responsable, 'Sin asignar') AS tecnico,
                COUNT(*) AS cantidad
            FROM 
                renovado_solicitud
            WHERE 
                estado = 'Finalizado'
            GROUP BY 
                YEAR(updated_at),
                MONTH(updated_at),
                WEEK(updated_at, 1),
                tecnico_responsable;
        `
    },
    {
        name: 'v_equipos_renovados_modelo',
        sql: `
            CREATE OR REPLACE VIEW v_equipos_renovados_modelo AS
            SELECT 
                YEAR(rs.updated_at) AS anio,
                MONTH(rs.updated_at) AS mes,
                WEEK(rs.updated_at, 1) AS semana,
                COALESCE(rs.tecnico_responsable, 'Sin asignar') AS tecnico,
                COALESCE(e.modelo, ed.modelo, 'Desconocido') AS modelo,
                COUNT(rs.id_solicitud) AS cantidad
            FROM 
                renovado_solicitud rs
            LEFT JOIN 
                equipos e ON rs.serial_equipo COLLATE utf8mb4_unicode_ci = e.numero_serie COLLATE utf8mb4_unicode_ci
            LEFT JOIN (
                SELECT serial_equipo, MAX(modelo) AS modelo 
                FROM entrada_detalle 
                WHERE serial_equipo IS NOT NULL AND serial_equipo <> ''
                GROUP BY serial_equipo
            ) ed ON rs.serial_equipo COLLATE utf8mb4_unicode_ci = ed.serial_equipo COLLATE utf8mb4_unicode_ci
            WHERE 
                rs.estado = 'Finalizado'
            GROUP BY 
                YEAR(rs.updated_at),
                MONTH(rs.updated_at),
                WEEK(rs.updated_at, 1),
                rs.tecnico_responsable,
                COALESCE(e.modelo, ed.modelo, 'Desconocido');
        `
    },
    {
        name: 'v_tiempo_promedio_renovacion_modelo',
        sql: `
            CREATE OR REPLACE VIEW v_tiempo_promedio_renovacion_modelo AS
            SELECT 
                YEAR(rs.updated_at) AS anio,
                MONTH(rs.updated_at) AS mes,
                WEEK(rs.updated_at, 1) AS semana,
                COALESCE(rs.tecnico_responsable, 'Sin asignar') AS tecnico,
                COALESCE(e.modelo, ed.modelo, 'Desconocido') AS modelo,
                AVG(TIMESTAMPDIFF(HOUR, rs.created_at, rs.updated_at)) AS promedio_horas_calendario,
                AVG(TIMESTAMPDIFF(DAY, rs.created_at, rs.updated_at)) AS promedio_dias_calendario,
                AVG(fases_tiempo.total_horas_laborales) AS promedio_horas_laborales
            FROM 
                renovado_solicitud rs
            LEFT JOIN 
                equipos e ON rs.serial_equipo COLLATE utf8mb4_unicode_ci = e.numero_serie COLLATE utf8mb4_unicode_ci
            LEFT JOIN (
                SELECT serial_equipo, MAX(modelo) AS modelo 
                FROM entrada_detalle 
                WHERE serial_equipo IS NOT NULL AND serial_equipo <> ''
                GROUP BY serial_equipo
            ) ed ON rs.serial_equipo COLLATE utf8mb4_unicode_ci = ed.serial_equipo COLLATE utf8mb4_unicode_ci
            LEFT JOIN (
                SELECT id_solicitud, SUM(horas_registradas) AS total_horas_laborales
                FROM renovado_fase
                GROUP BY id_solicitud
            ) fases_tiempo ON rs.id_solicitud COLLATE utf8mb4_unicode_ci = fases_tiempo.id_solicitud COLLATE utf8mb4_unicode_ci
            WHERE 
                rs.estado = 'Finalizado'
            GROUP BY 
                YEAR(rs.updated_at),
                MONTH(rs.updated_at),
                WEEK(rs.updated_at, 1),
                rs.tecnico_responsable,
                COALESCE(e.modelo, ed.modelo, 'Desconocido');
        `
    },
    {
        name: 'v_pareto_incidencias_anio',
        sql: `
            CREATE OR REPLACE VIEW v_pareto_incidencias_anio AS
            WITH total_incidencias AS (
                SELECT 
                    YEAR(ri.fecha_inicio) AS anio,
                    ri.tipo AS tipo_incidencia,
                    SUM(ri.horas_laborales) AS tiempo_total_horas
                FROM 
                    renovado_incidencia ri
                GROUP BY 
                    YEAR(ri.fecha_inicio),
                    ri.tipo
            ),
            acumulado_incidencias AS (
                SELECT 
                    anio,
                    tipo_incidencia,
                    tiempo_total_horas,
                    SUM(tiempo_total_horas) OVER (PARTITION BY anio ORDER BY tiempo_total_horas DESC) AS tiempo_acumulado_horas,
                    SUM(tiempo_total_horas) OVER (PARTITION BY anio) AS tiempo_global_horas
                FROM 
                    total_incidencias
            )
            SELECT 
                anio,
                tipo_incidencia,
                tiempo_total_horas,
                tiempo_acumulado_horas,
                tiempo_global_horas,
                ROUND((tiempo_acumulado_horas / NULLIF(tiempo_global_horas, 0)) * 100, 2) AS porcentaje_acumulado
            FROM 
                acumulado_incidencias;
        `
    },
    {
        name: 'v_pareto_incidencias_periodo',
        sql: `
            CREATE OR REPLACE VIEW v_pareto_incidencias_periodo AS
            WITH total_incidencias AS (
                SELECT 
                    YEAR(ri.fecha_inicio) AS anio,
                    MONTH(ri.fecha_inicio) AS mes,
                    WEEK(ri.fecha_inicio, 1) AS semana,
                    COALESCE(rs.tecnico_responsable, 'Sin asignar') AS tecnico,
                    ri.tipo AS tipo_incidencia,
                    SUM(ri.horas_laborales) AS tiempo_total_horas
                FROM 
                    renovado_incidencia ri
                JOIN 
                    renovado_solicitud rs ON ri.id_solicitud COLLATE utf8mb4_unicode_ci = rs.id_solicitud COLLATE utf8mb4_unicode_ci
                GROUP BY 
                    YEAR(ri.fecha_inicio),
                    MONTH(ri.fecha_inicio),
                    WEEK(ri.fecha_inicio, 1),
                    rs.tecnico_responsable,
                    ri.tipo
            ),
            acumulado_incidencias AS (
                SELECT 
                    anio,
                    mes,
                    semana,
                    tecnico,
                    tipo_incidencia,
                    tiempo_total_horas,
                    SUM(tiempo_total_horas) OVER (PARTITION BY anio, mes, tecnico ORDER BY tiempo_total_horas DESC) AS tiempo_acumulado_horas,
                    SUM(tiempo_total_horas) OVER (PARTITION BY anio, mes, tecnico) AS tiempo_global_horas
                FROM 
                    total_incidencias
            )
            SELECT 
                anio,
                mes,
                semana,
                tecnico,
                tipo_incidencia,
                tiempo_total_horas,
                tiempo_acumulado_horas,
                tiempo_global_horas,
                ROUND((tiempo_acumulado_horas / NULLIF(tiempo_global_horas, 0)) * 100, 2) AS porcentaje_acumulado
            FROM 
                acumulado_incidencias;
        `
    },
    {
        name: 'v_tiempo_total_incidencias_semana',
        sql: `
            CREATE OR REPLACE VIEW v_tiempo_total_incidencias_semana AS
            SELECT 
                YEAR(ri.fecha_inicio) AS anio,
                WEEK(ri.fecha_inicio, 1) AS semana,
                COALESCE(rs.tecnico_responsable, 'Sin asignar') AS tecnico,
                SUM(ri.horas_laborales) AS tiempo_total_incidencias_horas,
                COUNT(ri.id_incidencia) AS cantidad_incidencias
            FROM 
                renovado_incidencia ri
            JOIN 
                renovado_solicitud rs ON ri.id_solicitud COLLATE utf8mb4_unicode_ci = rs.id_solicitud COLLATE utf8mb4_unicode_ci
            GROUP BY 
                YEAR(ri.fecha_inicio),
                WEEK(ri.fecha_inicio, 1),
                rs.tecnico_responsable;
        `
    },
    {
        name: 'v_tiempo_promedio_renovacion_semana',
        sql: `
            CREATE OR REPLACE VIEW v_tiempo_promedio_renovacion_semana AS
            SELECT 
                YEAR(rs.updated_at) AS anio,
                WEEK(rs.updated_at, 1) AS semana,
                COALESCE(rs.tecnico_responsable, 'Sin asignar') AS tecnico,
                AVG(TIMESTAMPDIFF(HOUR, rs.created_at, rs.updated_at)) AS promedio_horas_calendario,
                AVG(TIMESTAMPDIFF(DAY, rs.created_at, rs.updated_at)) AS promedio_dias_calendario,
                AVG(fases_tiempo.total_horas_laborales) AS promedio_horas_laborales
            FROM 
                renovado_solicitud rs
            LEFT JOIN (
                SELECT id_solicitud, SUM(horas_registradas) AS total_horas_laborales
                FROM renovado_fase
                GROUP BY id_solicitud
            ) fases_tiempo ON rs.id_solicitud COLLATE utf8mb4_unicode_ci = fases_tiempo.id_solicitud COLLATE utf8mb4_unicode_ci
            WHERE 
                rs.estado = 'Finalizado'
            GROUP BY 
                YEAR(rs.updated_at),
                WEEK(rs.updated_at, 1),
                rs.tecnico_responsable;
        `
    }
];

async function main() {
    console.log('Iniciando creación de vistas en base de datos Taller R1 con corrección de Collation...');
    for (const view of VIEWS) {
        console.log(`Creando/Reemplazando vista: ${view.name}...`);
        try {
            await prisma.$executeRawUnsafe(view.sql);
            console.log(`✅ Vista ${view.name} creada exitosamente.`);
        } catch (error: any) {
            console.error(`❌ Error al crear vista ${view.name}:`, error.message);
        }
    }
    console.log('Proceso de creación de vistas terminado.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
