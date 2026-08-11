import { prisma } from "@/lib/prisma";

// ─── Tipos ───────────────────────────────────────────────
interface ConsultarReporteArgs {
  proyecto_nombre?: string;
  filtro_tipo: "tareas" | "finanzas" | "todo";
}

// ─── Handler principal ──────────────────────────────────
export async function consultarReporte(args: ConsultarReporteArgs): Promise<string> {
  const { proyecto_nombre, filtro_tipo } = args;

  try {
    // Si se especificó un proyecto, buscarlo
    let proyectoId: number | undefined;
    let proyectoNombre: string | undefined;

    if (proyecto_nombre) {
      const proyecto = await prisma.proyectos.findFirst({
        where: {
          nombre: {
            equals: proyecto_nombre.toUpperCase().trim(),
            mode: "insensitive",
          },
        },
      });

      if (!proyecto) {
        return JSON.stringify({
          exito: false,
          mensaje: `No se encontró el proyecto "${proyecto_nombre}". Proyectos disponibles: ${(
            await prisma.proyectos.findMany({ select: { nombre: true } })
          )
            .map((p) => p.nombre)
            .join(", ")}`,
        });
      }

      proyectoId = proyecto.id;
      proyectoNombre = proyecto.nombre;
    }

    const resultado: Record<string, unknown> = {
      exito: true,
      proyecto: proyectoNombre || "TODOS",
    };

    // ─── Consultar Tareas ─────────────────────────────
    if (filtro_tipo === "tareas" || filtro_tipo === "todo") {
      const tareas = await prisma.tareas.findMany({
        where: proyectoId ? { proyecto_id: proyectoId } : {},
        include: { proyectos: { select: { nombre: true } } },
        orderBy: [
          { estado: "asc" }, // pendientes primero
          { prioridad: "desc" },
          { fecha_creacion: "desc" },
        ],
      });

      const tareasPendientes = tareas.filter((t) => t.estado === "pendiente");
      const tareasCulminadas = tareas.filter((t) => t.estado === "culminada");

      resultado.tareas = {
        total: tareas.length,
        pendientes: tareasPendientes.length,
        culminadas: tareasCulminadas.length,
        detalle: tareas.map((t) => ({
          id: t.id,
          descripcion: t.descripcion,
          estado: t.estado,
          prioridad: t.prioridad,
          proyecto: t.proyectos?.nombre,
          fecha_limite: t.fecha_limite?.toISOString().split("T")[0] || null,
          fecha_creacion: t.fecha_creacion?.toISOString().split("T")[0] || null,
        })),
      };
    }

    // ─── Consultar Finanzas ───────────────────────────
    if (filtro_tipo === "finanzas" || filtro_tipo === "todo") {
      const finanzas = await prisma.finanzas.findMany({
        where: proyectoId ? { proyecto_id: proyectoId } : {},
        include: {
          proyectos: {
            select: { nombre: true, entidades: { select: { nombre: true } } },
          },
        },
        orderBy: { fecha_transaccion: "desc" },
      });

      const ingresos = finanzas.filter((f) => f.tipo === "vencimiento_cliente");
      const egresos = finanzas.filter((f) => f.tipo === "egreso");
      const pendientesPago = finanzas.filter(
        (f) => f.estado_pago === "PENDIENTE"
      );

      const totalIngresos = ingresos.reduce(
        (sum, f) => sum + Number(f.monto),
        0
      );
      const totalEgresos = egresos.reduce(
        (sum, f) => sum + Number(f.monto),
        0
      );
      const totalSaldoPendiente = pendientesPago.reduce(
        (sum, f) => sum + Number(f.saldo_pendiente || 0),
        0
      );

      resultado.finanzas = {
        total_movimientos: finanzas.length,
        total_ingresos: totalIngresos,
        total_egresos: totalEgresos,
        balance: totalIngresos - totalEgresos,
        saldo_pendiente_total: totalSaldoPendiente,
        detalle: finanzas.map((f) => ({
          id: f.id,
          tipo: f.tipo,
          monto: Number(f.monto),
          descripcion: f.descripcion,
          estado_pago: f.estado_pago,
          saldo_pendiente: Number(f.saldo_pendiente || 0),
          proyecto: f.proyectos?.nombre,
          entidad: f.proyectos?.entidades?.nombre ?? null,
          fecha_vencimiento:
            f.fecha_vencimiento?.toISOString().split("T")[0] || null,
          fecha_transaccion:
            f.fecha_transaccion?.toISOString().split("T")[0] || null,
        })),
      };
    }

    return JSON.stringify(resultado);
  } catch (error) {
    return JSON.stringify({
      exito: false,
      mensaje: `Error al consultar reporte: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
