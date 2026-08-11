import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const proyectoId = searchParams.get('proyecto_id');
    const entidadId = searchParams.get('entidad_id');
    const all = searchParams.get('all');
    const where: any = {};
    if (proyectoId) where.proyecto_id = Number(proyectoId);
    if (entidadId) where.entidad_id = Number(entidadId);
    if (all) {
      // no filter — return all
    } else if (!proyectoId && !entidadId) {
      // default: return only links WITH a project or entity association
      where.OR = [{ proyecto_id: { not: null } }, { entidad_id: { not: null } }];
    }
    const enlaces = await prisma.enlaces.findMany({
      where,
      orderBy: { creado_en: 'desc' },
    });
    return NextResponse.json(enlaces);
  } catch (error: any) {
    console.error('Error obteniendo enlaces:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, descripcion, categoria, etiquetas, proyecto_id, entidad_id } = body;

    if (!url || !descripcion || !categoria) {
      return NextResponse.json(
        { error: 'Campos requeridos: url, descripcion, categoria' },
        { status: 400 }
      );
    }

    const created = await prisma.enlaces.create({
      data: {
        url,
        descripcion,
        categoria,
        etiquetas: etiquetas || [],
        proyecto_id: proyecto_id ? Number(proyecto_id) : null,
        entidad_id: entidad_id ? Number(entidad_id) : null,
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (error: any) {
    console.error('Error creando enlace:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, url, descripcion, categoria, etiquetas } = body;

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el campo id' }, { status: 400 });
    }

    const data: any = {};
    if (url !== undefined) data.url = url;
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (categoria !== undefined) data.categoria = categoria;
    if (etiquetas !== undefined) data.etiquetas = etiquetas;

    await prisma.enlaces.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error actualizando enlace:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idStr = searchParams.get('id');

    if (!idStr) {
      return NextResponse.json({ error: 'Se requiere el parámetro id' }, { status: 400 });
    }

    await prisma.enlaces.delete({
      where: { id: Number(idStr) },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error eliminando enlace:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
