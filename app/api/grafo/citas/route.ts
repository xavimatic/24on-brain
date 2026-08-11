import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/* ------------------------------------------------------------------ */
/*  POST /api/grafo/citas  — Create a new quote                        */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { libro_id, texto, pagina, comentario } = body;

    if (!libro_id || !texto) {
      return NextResponse.json(
        { error: 'Campos requeridos: libro_id, texto' },
        { status: 400 }
      );
    }

    const created = await prisma.citas.create({
      data: {
        libro_id: Number(libro_id),
        texto,
        pagina: pagina ? Number(pagina) : null,
        comentario: comentario || null,
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (error: any) {
    console.error('Error creando cita:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
