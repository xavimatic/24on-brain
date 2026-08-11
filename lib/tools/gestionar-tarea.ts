import { prisma } from "@/lib/prisma";

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
interface GestionarTareaArgs {
  accion: "crear" | "actualizar" | "eliminar";
  descripcion: string;
  proyecto_nombre: string;
  estado?: "pendiente" | "culminada";
  prioridad?: "baja" | "media" | "alta";
  fecha_limite?: string;
}

// ─── Handler principal ──────────────────────────────────
export async function gestionarTarea(args: GestionarTareaArgs): Promise<string> {
  const { accion, descripcion, proyecto_nombre, estado, prioridad, fecha_limite } = args;

  try {
    const proyecto = await buscarOCrearProyecto(proyecto_nombre);

    switch (accion) {
      case "crear": {
        const tarea = await prisma.tareas.create({
          data: {
            descripcion,
            proyecto_id: proyecto.id,
            estado: estado || "pendiente",
            prioridad: prioridad || "media",
            fecha_limite: fecha_limite ? new Date(fecha_limite) : null,
          },
        });
        return JSON.stringify({
          exito: true,
          mensaje: `Tarea creada: "${tarea.descripcion}" en proyecto ${proyecto.nombre}`,
          tarea_id: tarea.id,
        });
      }

      case "actualizar": {
        // Buscar tarea por descripción similar en el proyecto
        const tareaExistente = await prisma.tareas.findFirst({
          where: {
            proyecto_id: proyecto.id,
            descripcion: { contains: descripcion, mode: "insensitive" },
          },
        });

        if (!tareaExistente) {
          return JSON.stringify({
            exito: false,
            mensaje: `No se encontró una tarea con descripción similar a "${descripcion}" en el proyecto ${proyecto.nombre}`,
          });
        }

        const tareaActualizada = await prisma.tareas.update({
          where: { id: tareaExistente.id },
          data: {
            estado: estado || tareaExistente.estado,
            prioridad: prioridad || tareaExistente.prioridad,
            fecha_limite: fecha_limite
              ? new Date(fecha_limite)
              : tareaExistente.fecha_limite,
            fecha_actualizacion: new Date(),
          },
        });

        return JSON.stringify({
          exito: true,
          mensaje: `Tarea actualizada: "${tareaActualizada.descripcion}" → estado: ${tareaActualizada.estado}`,
          tarea_id: tareaActualizada.id,
        });
      }

      case "eliminar": {
        const tareaAEliminar = await prisma.tareas.findFirst({
          where: {
            proyecto_id: proyecto.id,
            descripcion: { contains: descripcion, mode: "insensitive" },
          },
        });

        if (!tareaAEliminar) {
          return JSON.stringify({
            exito: false,
            mensaje: `No se encontró una tarea con descripción similar a "${descripcion}" en el proyecto ${proyecto.nombre}`,
          });
        }

        await prisma.tareas.delete({ where: { id: tareaAEliminar.id } });

        return JSON.stringify({
          exito: true,
          mensaje: `Tarea eliminada: "${tareaAEliminar.descripcion}" del proyecto ${proyecto.nombre}`,
        });
      }

      default:
        return JSON.stringify({ exito: false, mensaje: `Acción desconocida: ${accion}` });
    }
  } catch (error) {
    return JSON.stringify({
      exito: false,
      mensaje: `Error al gestionar tarea: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
