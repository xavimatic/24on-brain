import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/* ------------------------------------------------------------------ */
/*  POST /api/grafo/libros  — Create a new book                        */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { titulo, autor, estado_lectura, veces_leido, url_pdf, fecha } = body;

    if (!titulo) {
      return NextResponse.json(
        { error: 'Campos requeridos: titulo' },
        { status: 400 }
      );
    }

    const created = await prisma.libros.create({
      data: {
        titulo,
        autor: autor || null,
        estado_lectura: estado_lectura || 'PENDIENTE',
        veces_leido: veces_leido ? Number(veces_leido) : 0,
        url_pdf: url_pdf || null,
        creado_en: fecha ? new Date(fecha) : new Date(),
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (error: any) {
    console.error('Error creando libro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PATCH /api/grafo/libros  — Update an existing book                 */
/* ------------------------------------------------------------------ */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, titulo, autor, estado_lectura, veces_leido, url_pdf } = body;

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el campo id' }, { status: 400 });
    }

    const data: any = {};
    if (titulo !== undefined) data.titulo = titulo;
    if (autor !== undefined) data.autor = autor;
    if (estado_lectura !== undefined) data.estado_lectura = estado_lectura;
    if (veces_leido !== undefined) data.veces_leido = Number(veces_leido);
    if (url_pdf !== undefined) data.url_pdf = url_pdf;

    await prisma.libros.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error actualizando libro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
