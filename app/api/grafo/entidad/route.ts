import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, tipo, metadatos } = body;

    if (!nombre || !tipo) {
      return NextResponse.json(
        { error: 'Nombre y tipo son requeridos' },
        { status: 400 }
      );
    }

    const entidad = await prisma.entidades.create({
      data: {
        nombre,
        tipo,
        metadatos: metadatos || {},
      },
    });

    return NextResponse.json(entidad, { status: 201 });
  } catch (error: any) {
    console.error('Error al crear entidad:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, nombre, entidad_padre_id, is_destacado } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const data: any = {};
    if (nombre !== undefined) data.nombre = nombre;
    if (entidad_padre_id !== undefined) {
      data.entidad_padre_id = entidad_padre_id ? Number(entidad_padre_id) : null;
    }
    if (is_destacado !== undefined) {
      data.is_destacado = is_destacado;
    }

    const entidad = await prisma.entidades.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json(entidad);
  } catch (error: any) {
    console.error('Error al actualizar entidad:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idStr = searchParams.get('id');

    if (!idStr) {
      return NextResponse.json(
        { error: 'Se requiere el parámetro "id"' },
        { status: 400 }
      );
    }

    const id = Number(idStr);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID numérico inválido' },
        { status: 400 }
      );
    }

    const entidad = await prisma.entidades.findUnique({
      where: { id },
      include: {
        entidades_hijas: {
          include: {
            proyectos: {
              include: {
                finanzas: {
                  include: {
                    entidad_origen: {
                      select: { id: true, nombre: true },
                    },
                  },
                },
              },
            },
          },
        },
        proyectos: {
          include: {
            tareas: {
              orderBy: { id: 'desc' },
            },
            finanzas: {
              include: {
                entidad_origen: {
                  select: { id: true, nombre: true },
                },
              },
            },
            enlaces: true,
          },
        },
      },
    });

    if (!entidad) {
      return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 404 });
    }

    // Consolidate finances from this entity + all child entities
    const childEntityIds = entidad.entidades_hijas.map((h: any) => h.id);
    const allEntityIds = [id, ...childEntityIds];

    // Collect all project IDs from all entities
    const allProyectos: any[] = [...entidad.proyectos];
    for (const child of entidad.entidades_hijas) {
      allProyectos.push(...child.proyectos);
    }
    const consolidatedFinanzas = allProyectos.flatMap((p: any) => p.finanzas);

    // Also fetch direct finanzas (entidad_id = this entity)
    const directFinanzas = await prisma.finanzas.findMany({
      where: { entidad_id: id },
      include: {
        entidad_origen: {
          select: { id: true, nombre: true },
        },
      },
    });
    consolidatedFinanzas.push(...directFinanzas);

    let tareasUrgentesClientes: any[] = [];
    if (entidad.nombre.toLowerCase() === '24on') {
      const vinculos = await prisma.vinculos.findMany({
        where: {
          OR: [
            { origen_id: entidad.id },
            { destino_id: entidad.id },
          ],
        },
      });
      const clientIds = vinculos.map((v) => (v.origen_id === entidad.id ? v.destino_id : v.origen_id));
      if (clientIds.length > 0) {
        tareasUrgentesClientes = await prisma.tareas.findMany({
          where: {
            urgente: true,
            proyectos: {
              entidad_id: { in: clientIds },
            },
          },
          orderBy: { id: 'desc' },
          include: {
            proyectos: {
              select: {
                id: true,
                nombre: true,
                entidades: {
                  select: {
                    id: true,
                    nombre: true,
                    metadatos: true,
                  },
                },
              },
            },
          },
        });
      }
    }

    return NextResponse.json({
      ...entidad,
      childEntityIds,
      consolidatedFinanzas,
      directFinanzas,
      tareasUrgentesClientes,
    });
  } catch (error: any) {
    console.error('Error al obtener detalle de la entidad:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
