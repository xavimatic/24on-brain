import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const proyectos = await prisma.proyectos.findMany({
      include: {
        entidades: {
          select: { nombre: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return NextResponse.json(proyectos);
  } catch (error: any) {
    console.error('Error obteniendo proyectos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, descripcion, estado, entidad_id, fecha_inicio, fecha_fin, notas } = body;

    if (!nombre) {
      return NextResponse.json(
        { error: 'Campo requerido: nombre' },
        { status: 400 }
      );
    }

    const created = await prisma.proyectos.create({
      data: {
        nombre: nombre.toUpperCase(),
        descripcion: descripcion || null,
        entidad_id: entidad_id ? Number(entidad_id) : null,
        estado: estado || 'ACTIVO',
        fecha_inicio: fecha_inicio ? new Date(fecha_inicio) : null,
        fecha_fin: fecha_fin ? new Date(fecha_fin) : null,
        metadatos: (estado ? { estado } : null) as any,
        notas: notas || null,
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (error: any) {
    console.error('Error creando proyecto:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, nombre, descripcion, estado, fecha_inicio, fecha_fin, notas, is_destacado } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Campo requerido: id' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (nombre) updateData.nombre = nombre.toUpperCase();
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (estado !== undefined) {
      updateData.estado = estado;
      updateData.metadatos = { estado };
    }
    if (fecha_inicio !== undefined) {
      updateData.fecha_inicio = fecha_inicio ? new Date(fecha_inicio) : null;
    }
    if (fecha_fin !== undefined) {
      updateData.fecha_fin = fecha_fin ? new Date(fecha_fin) : null;
    }
    if (notas !== undefined) {
      updateData.notas = notas;
    }
    if (is_destacado !== undefined) {
      updateData.is_destacado = is_destacado;
    }

    const updated = await prisma.proyectos.update({
      where: { id: Number(id) },
      data: updateData,
    });

    return NextResponse.json({ ok: true, id: updated.id });
  } catch (error: any) {
    console.error('Error actualizando proyecto:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
