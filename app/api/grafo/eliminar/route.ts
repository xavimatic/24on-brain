import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const syntheticId = searchParams.get('id');

    if (!syntheticId) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro "id"' },
        { status: 400 }
      );
    }

    const dashIndex = syntheticId.indexOf('-');
    if (dashIndex === -1) {
      return NextResponse.json(
        { error: 'Formato de ID inválido. Debe incluir un prefijo y un número (ej: fin-5)' },
        { status: 400 }
      );
    }

    const prefix = syntheticId.substring(0, dashIndex);
    const dbId = Number(syntheticId.substring(dashIndex + 1));

    if (isNaN(dbId)) {
      return NextResponse.json(
        { error: 'ID numérico inválido' },
        { status: 400 }
      );
    }

    switch (prefix) {
      case 'fin':
        await prisma.finanzas.delete({ where: { id: dbId } });
        break;
      case 'tar':
        await prisma.tareas.delete({ where: { id: dbId } });
        break;
      case 'lib':
        await prisma.libros.delete({ where: { id: dbId } });
        break;
      case 'cit':
        await prisma.citas.delete({ where: { id: dbId } });
        break;
      case 'proj':
        await prisma.proyectos.delete({ where: { id: dbId } });
        break;
      case 'ent':
        await prisma.entidades.delete({ where: { id: dbId } });
        break;
      default:
        return NextResponse.json(
          { error: `Tipo de nodo "${prefix}" no soportado para eliminación física.` },
          { status: 400 }
        );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Error al eliminar registro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
