import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Busca un proyecto por nombre (case-insensitive).
 * Si no existe, lo crea automáticamente.
 */
async function buscarOCrearProyecto(nombre: string) {
  const nombreNormalizado = nombre.toUpperCase().trim();

  let proyecto = await prisma.proyectos.findFirst({
    where: {
      nombre: {
        equals: nombreNormalizado,
        mode: "insensitive",
      },
    },
  });

  if (!proyecto) {
    proyecto = await prisma.proyectos.create({
      data: { nombre: nombreNormalizado },
    });
  }

  return proyecto;
}

// ─── Tipos ───────────────────────────────────────────────
interface GestionarFinanzasArgs {
  accion: "crear" | "actualizar" | "eliminar";
  tipo: "vencimiento_cliente" | "egreso";
  monto: number;
  descripcion: string;
  proyecto_nombre: string;
  fecha_vencimiento?: string;
  estado_pago?: "pendiente" | "pagado" | "vencido";
}

// ─── Handler principal ──────────────────────────────────
export async function gestionarFinanzas(args: GestionarFinanzasArgs): Promise<string> {
  const {
    accion,
    tipo,
    monto,
    descripcion,
    proyecto_nombre,
    fecha_vencimiento,
    estado_pago,
  } = args;

  try {
    const proyecto = await buscarOCrearProyecto(proyecto_nombre);

    switch (accion) {
      case "crear": {
        const finanza = await prisma.finanzas.create({
          data: {
            tipo,
            monto: new Prisma.Decimal(monto),
            descripcion,
            proyecto_id: proyecto.id,
            estado_pago: (estado_pago || "pendiente").toUpperCase(),
            saldo_pendiente: new Prisma.Decimal(monto),
            fecha_vencimiento: fecha_vencimiento
              ? new Date(fecha_vencimiento)
              : null,
          },
        });
        return JSON.stringify({
          exito: true,
          mensaje: `Movimiento financiero creado: ${tipo === 'vencimiento_cliente' ? 'cobro' : 'pago'} de ${monto.toLocaleString('es-PY')} Gs. - "${finanza.descripcion}" en proyecto ${proyecto.nombre}`,
          finanza_id: finanza.id,
        });
      }

      case "actualizar": {
        const finanzaExistente = await prisma.finanzas.findFirst({
          where: {
            proyecto_id: proyecto.id,
            descripcion: { contains: descripcion, mode: "insensitive" },
          },
        });

        if (!finanzaExistente) {
          return JSON.stringify({
            exito: false,
            mensaje: `No se encontró un movimiento financiero similar a "${descripcion}" en el proyecto ${proyecto.nombre}`,
          });
        }

        const normalizedEstado = (estado_pago || "").toUpperCase();

        const finanzaActualizada = await prisma.finanzas.update({
          where: { id: finanzaExistente.id },
          data: {
            estado_pago: normalizedEstado || finanzaExistente.estado_pago,
            monto: monto ? new Prisma.Decimal(monto) : finanzaExistente.monto,
            saldo_pendiente:
              normalizedEstado === "PAGADO"
                ? new Prisma.Decimal(0)
                : finanzaExistente.saldo_pendiente,
            fecha_vencimiento: fecha_vencimiento
              ? new Date(fecha_vencimiento)
              : finanzaExistente.fecha_vencimiento,
          },
        });

        return JSON.stringify({
          exito: true,
          mensaje: `Finanza actualizada: "${finanzaActualizada.descripcion}" → estado: ${finanzaActualizada.estado_pago}`,
          finanza_id: finanzaActualizada.id,
        });
      }

      case "eliminar": {
        const finanzaAEliminar = await prisma.finanzas.findFirst({
          where: {
            proyecto_id: proyecto.id,
            descripcion: { contains: descripcion, mode: "insensitive" },
          },
        });

        if (!finanzaAEliminar) {
          return JSON.stringify({
            exito: false,
            mensaje: `No se encontró un movimiento financiero similar a "${descripcion}" en el proyecto ${proyecto.nombre}`,
          });
        }

        await prisma.finanzas.delete({ where: { id: finanzaAEliminar.id } });

        return JSON.stringify({
          exito: true,
          mensaje: `Movimiento financiero eliminado: "${finanzaAEliminar.descripcion}" del proyecto ${proyecto.nombre}`,
        });
      }

      default:
        return JSON.stringify({ exito: false, mensaje: `Acción desconocida: ${accion}` });
    }
  } catch (error) {
    return JSON.stringify({
      exito: false,
      mensaje: `Error al gestionar finanza: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
