/**
 * Definiciones de las 3 herramientas que Gemini puede invocar.
 * Formato compatible con @google/genai Function Calling.
 */

import { Type } from "@google/genai";
import type { FunctionDeclaration, Tool } from "@google/genai";

// ─── 1. GESTIONAR TAREA ──────────────────────────────────
const gestionarTarea: FunctionDeclaration = {
  name: "gestionar_tarea",
  description:
    "Crear, actualizar (marcar como culminada) o eliminar una tarea o pendiente de un proyecto. " +
    "Usar cuando el usuario mencione algo que hay que hacer, un pendiente, una actividad, un arreglo, etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      accion: {
        type: Type.STRING,
        description: "La acción a realizar",
        enum: ["crear", "actualizar", "eliminar"],
      },
      descripcion: {
        type: Type.STRING,
        description: "Descripción de la tarea (qué hay que hacer)",
      },
      proyecto_nombre: {
        type: Type.STRING,
        description:
          "Nombre del proyecto al que pertenece (ej: '24ON', 'JORDAN'). Normalizar a mayúsculas.",
      },
      estado: {
        type: Type.STRING,
        description: "Estado de la tarea",
        enum: ["pendiente", "culminada"],
      },
      prioridad: {
        type: Type.STRING,
        description: "Nivel de prioridad",
        enum: ["baja", "media", "alta"],
      },
      fecha_limite: {
        type: Type.STRING,
        description: "Fecha límite en formato ISO 8601 (ej: 2026-06-15). Opcional.",
      },
    },
    required: ["accion", "descripcion", "proyecto_nombre"],
  },
};

// ─── 2. GESTIONAR FINANZAS ───────────────────────────────
const gestionarFinanzas: FunctionDeclaration = {
  name: "gestionar_finanzas",
  description:
    "Registrar, actualizar o eliminar un movimiento financiero: cobros, pagos a proveedores, " +
    "gastos de caja chica, vencimientos de clientes o proveedores. " +
    "Usar cuando el usuario mencione dinero, cobros, pagos, facturas, montos, etc.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      accion: {
        type: Type.STRING,
        description: "La acción a realizar",
        enum: ["crear", "actualizar", "eliminar"],
      },
      tipo: {
        type: Type.STRING,
        description: "Tipo de movimiento financiero",
        enum: [
          "vencimiento_cliente",
          "egreso",
        ],
      },
      monto: {
        type: Type.NUMBER,
        description: "Monto del movimiento en la moneda local",
      },
      descripcion: {
        type: Type.STRING,
        description: "Descripción del movimiento (ej: 'Pago parcial factura #123')",
      },
      proyecto_nombre: {
        type: Type.STRING,
        description:
          "Nombre del proyecto asociado. Normalizar a mayúsculas.",
      },
      fecha_vencimiento: {
        type: Type.STRING,
        description: "Fecha de vencimiento en formato ISO 8601. Opcional.",
      },
      estado_pago: {
        type: Type.STRING,
        description: "Estado del pago",
        enum: ["pendiente", "pagado", "vencido"],
      },
    },
    required: ["accion", "tipo", "monto", "descripcion", "proyecto_nombre"],
  },
};

// ─── 3. CONSULTAR REPORTE ────────────────────────────────
const consultarReporte: FunctionDeclaration = {
  name: "consultar_reporte",
  description:
    "Consultar el estado actual de tareas, finanzas o ambos para un proyecto. " +
    "Usar cuando el usuario pregunte qué hay pendiente, cuánto se debe, el estado de un proyecto, " +
    "o cualquier consulta informativa.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      proyecto_nombre: {
        type: Type.STRING,
        description:
          "Nombre del proyecto a consultar. Si el usuario dice 'todo' o 'todos', dejar vacío.",
      },
      filtro_tipo: {
        type: Type.STRING,
        description: "Qué tipo de información consultar",
        enum: ["tareas", "finanzas", "todo"],
      },
    },
    required: ["filtro_tipo"],
  },
};

// ─── EXPORT ──────────────────────────────────────────────
export const tools: Tool[] = [
  {
    functionDeclarations: [
      gestionarTarea,
      gestionarFinanzas,
      consultarReporte,
    ],
  },
];
