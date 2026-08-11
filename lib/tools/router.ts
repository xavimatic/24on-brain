import { gestionarTarea } from "./gestionar-tarea";
import { gestionarFinanzas } from "./gestionar-finanzas";
import { consultarReporte } from "./consultar-reporte";

/**
 * Router central: recibe el nombre de la función y sus argumentos
 * del function_call de Gemini, y ejecuta el handler correspondiente.
 */
export async function ejecutarHerramienta(
  nombreFuncion: string,
  argumentos: Record<string, unknown>
): Promise<string> {
  switch (nombreFuncion) {
    case "gestionar_tarea":
      return gestionarTarea(argumentos as unknown as Parameters<typeof gestionarTarea>[0]);

    case "gestionar_finanzas":
      return gestionarFinanzas(
        argumentos as unknown as Parameters<typeof gestionarFinanzas>[0]
      );

    case "consultar_reporte":
      return consultarReporte(
        argumentos as unknown as Parameters<typeof consultarReporte>[0]
      );

    default:
      return JSON.stringify({
        exito: false,
        mensaje: `Herramienta desconocida: ${nombreFuncion}`,
      });
  }
}
