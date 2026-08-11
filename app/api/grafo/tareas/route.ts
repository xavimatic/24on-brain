import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/* ------------------------------------------------------------------ */
/*  POST /api/grafo/tareas  — Create a new tarea                       */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { descripcion, estado, prioridad, fecha_limite, proyecto_id, urgente, notas } = body;

    if (!descripcion) {
      return NextResponse.json(
        { error: 'Campo requerido: descripcion' },
        { status: 400 }
      );
    }

    const created = await prisma.tareas.create({
      data: {
        descripcion,
        estado: estado || 'PENDIENTE',
        prioridad: prioridad || 'media',
        fecha_limite: fecha_limite ? new Date(fecha_limite) : null,
        proyecto_id: proyecto_id ? Number(proyecto_id) : null,
        urgente: urgente === true,
        notas: notas || null,
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (error: any) {
    console.error('Error creando tarea:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PATCH /api/grafo/tareas  — Update an existing tarea                */
/* ------------------------------------------------------------------ */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, descripcion, estado, prioridad, fecha_limite, urgente, notas } = body;

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el campo id' }, { status: 400 });
    }

    const data: any = {};
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (notas !== undefined) data.notas = notas;
    if (estado !== undefined) data.estado = estado;
    if (prioridad !== undefined) data.prioridad = prioridad;
    if (fecha_vencimiento_presente(fecha_limite)) {
      data.fecha_limite = fecha_limite ? new Date(fecha_limite) : null;
    }
    if (urgente !== undefined) data.urgente = urgente;
    data.fecha_actualizacion = new Date();

    await prisma.tareas.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error actualizando tarea:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Helper: check if fecha_limite was explicitly passed (even as null) */
function fecha_vencimiento_presente(value: any): boolean {
  return value !== undefined;
}
