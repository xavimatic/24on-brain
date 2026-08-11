import { prisma } from '@/lib/prisma';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Generates a deterministic string-id like "mes-2026-07" */
function mesId(date: Date): string {
  return `mes-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Human label for a month node: "Julio 2026" */
function mesLabel(date: Date): string {
  return `${MESES[date.getMonth()]} ${date.getFullYear()}`;
}

export async function obtenerGrafo() {
  // ── 1. Entidades, Vínculos, Finanzas, Tareas, Libros, Proyectos, Enlaces ─
  const [entidades, vinculos, finanzasRows, tareasRows, librosRows, proyectosRows, enlacesRows] = await Promise.all([
    prisma.entidades.findMany({
      select: { id: true, nombre: true, tipo: true, metadatos: true, entidad_padre_id: true, is_destacado: true },
    }),
    prisma.vinculos.findMany({
      select: { id: true, tipo: true, origen_id: true, destino_id: true },
    }),
    // ── 2. Finanzas (con proyecto → entidad) ─────────────────────
    prisma.finanzas.findMany({
      select: {
        id: true,
        descripcion: true,
        monto: true,
        tipo: true,
        estado_pago: true,
        saldo_pendiente: true,
        fecha_vencimiento: true,
        fecha_transaccion: true,
        recurrente: true,
        frecuencia: true,
        dia_vencimiento: true,
        mes_vencimiento: true,
        cuota_actual: true,
        cuotas_total: true,
        proyecto_id: true,
        entidad_id: true,
        entidad_origen_id: true,
        entidad_origen: {
          select: { id: true, nombre: true },
        },
        entidades: {
          select: { id: true, nombre: true },
        },
        proyectos: {
          select: {
            id: true,
            nombre: true,
            entidad_id: true,
          },
        },
      },
    }),
    // ── 3. Tareas pendientes (con proyecto → entidad) ────────────
    prisma.tareas.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        descripcion: true,
        notas: true,
        estado: true,
        prioridad: true,
        fecha_limite: true,
        fecha_creacion: true,
        urgente: true,
        proyecto_id: true,
        proyectos: {
          select: {
            id: true,
            nombre: true,
            entidad_id: true,
          },
        },
      },
    }),
    // ── 4. Libros & Citas ────────────────────────────────────────
    prisma.libros.findMany({
      include: {
        citas: true,
      },
    }),
    // ── 5. Proyectos ─────────────────────────────────────────────
    prisma.proyectos.findMany({
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        metadatos: true,
        entidad_id: true,
        fecha_inicio: true,
        fecha_fin: true,
        estado: true,
        notas: true,
        is_destacado: true,
      },
    }),
    // ── 6. Enlaces (global) ──────────────────────────────────────
    prisma.enlaces.findMany({
      orderBy: { creado_en: 'desc' },
      include: {
        proyectos: { select: { id: true, nombre: true } },
        entidades: { select: { id: true, nombre: true } },
      },
    }),
  ]);

  // ── Nodos de Entidades ──────────────────────────────────────────
  const nodes: any[] = entidades.map((e: any) => ({
    id: `ent-${e.id}`,
    name: e.nombre,
    type: e.tipo,                         // EMPRESA | PERSONA | SERVICIO
    alias: (e.metadatos as any)?.alias || [],
    extra: {
      is_destacado: e.is_destacado,
    },
  }));

  // ── Links de Vínculos ───────────────────────────────────────────
  const links: any[] = vinculos.map((v: any) => ({
    source: `ent-${v.origen_id}`,
    target: `ent-${v.destino_id}`,
    type: v.tipo,
  }));

  // ── Links jerárquicos (entidad_padre_id) ────────────────────────
  for (const e of entidades) {
    if (e.entidad_padre_id) {
      links.push({
        source: `ent-${e.id}`,
        target: `ent-${e.entidad_padre_id}`,
        type: 'HIJO_DE',
      });
    }
  }

  // ── Nodos & Links de Meses (set avoids duplicates) ──────────────
  const mesesCreados = new Map<string, boolean>();

  function asegurarMes(date: Date) {
    const id = mesId(date);
    if (!mesesCreados.has(id)) {
      mesesCreados.set(id, true);
      nodes.push({
        id,
        name: mesLabel(date),
        type: 'MES',
      });
    }
    return id;
  }

  // ── Nodos & Links de Finanzas ──────────────────────────────────
  for (const f of finanzasRows) {
    const nodeId = `fin-${f.id}`;
    nodes.push({
      id: nodeId,
      name: f.descripcion,
      type: 'FINANZA',
      extra: {
        monto: Number(f.monto),
        saldo_pendiente: f.saldo_pendiente ? Number(f.saldo_pendiente) : null,
        estado_pago: f.estado_pago,
        tipo: f.tipo,
        fecha_vencimiento: f.fecha_vencimiento,
        fecha_transaccion: f.fecha_transaccion,
        proyecto: f.proyectos?.nombre ?? null,
        proyecto_id: f.proyecto_id ?? null,
        entidad_id: f.entidad_id ?? null,
        recurrente: f.recurrente,
        frecuencia: f.frecuencia,
        dia_vencimiento: f.dia_vencimiento,
        mes_vencimiento: f.mes_vencimiento,
        cuota_actual: f.cuota_actual,
        cuotas_total: f.cuotas_total,
        entidad_origen_id: f.entidad_origen_id,
        entidad_origen_nombre: f.entidad_origen?.nombre ?? null,
      },
    });

    // Link finanza → proyecto (or entidad directa, or proyecto → entidad fallback)
    if (f.proyecto_id) {
      links.push({
        source: nodeId,
        target: `proj-${f.proyecto_id}`,
        type: 'COBRO_DE',
      });
    } else if (f.entidad_id) {
      links.push({
        source: nodeId,
        target: `ent-${f.entidad_id}`,
        type: 'COBRO_DE',
      });
    } else if (f.proyectos?.entidad_id) {
      links.push({
        source: nodeId,
        target: `ent-${f.proyectos.entidad_id}`,
        type: 'COBRO_DE',
      });
    }

    // Link finanza → hub de tesorería
    links.push({
      source: nodeId,
      target: 'hub_finanzas',
      type: 'HUB_FINANZAS',
    });

    // Link finanza → entidad origen (Unidad Originadora)
    if (f.entidad_origen_id) {
      links.push({
        source: nodeId,
        target: `ent-${f.entidad_origen_id}`,
        type: 'ORIGINADO_POR',
      });
    }

    // Link finanza → mes de vencimiento
    if (f.fecha_vencimiento) {
      const mid = asegurarMes(new Date(f.fecha_vencimiento));
      links.push({
        source: nodeId,
        target: mid,
        type: 'VENCE_EN',
      });
    } else if (f.fecha_transaccion) {
      // Fallback: use transaction date if no due date
      const mid = asegurarMes(new Date(f.fecha_transaccion));
      links.push({
        source: nodeId,
        target: mid,
        type: 'REGISTRADO_EN',
      });
    }
  }

  // ── Hub de Tesorería ──────────────────────────────────────────
  if (finanzasRows.length > 0) {
    nodes.push({
      id: 'hub_finanzas',
      name: '💳 FINANZAS / TESORERÍA',
      type: 'HUB_FINANZAS',
      extra: { total_movimientos: finanzasRows.length },
    });
    // Link hub → each unique origin entity
    const origenIds = new Set<number>();
    for (const f of finanzasRows) {
      if (f.entidad_origen_id && !origenIds.has(f.entidad_origen_id)) {
        origenIds.add(f.entidad_origen_id);
        links.push({
          source: 'hub_finanzas',
          target: `ent-${f.entidad_origen_id}`,
          type: 'ORIGINADO_POR',
        });
      }
    }
  }

  // ── Nodos & Links de Tareas ────────────────────────────────────
  for (const t of tareasRows) {
    const nodeId = `tar-${t.id}`;
    nodes.push({
      id: nodeId,
      name: t.descripcion,
      type: 'TAREA',
      extra: {
        estado: t.estado,
        prioridad: t.prioridad,
        notas: t.notas,
        fecha_limite: t.fecha_limite,
        fecha_creacion: t.fecha_creacion,
        proyecto: t.proyectos?.nombre ?? null,
        proyecto_id: t.proyecto_id ?? null,
        urgente: t.urgente ?? false,
      },
    });

    // Link tarea → proyecto (o entidad fallback)
    if (t.proyecto_id) {
      links.push({
        source: nodeId,
        target: `proj-${t.proyecto_id}`,
        type: 'TAREA_DE',
      });
    } else if (t.proyectos?.entidad_id) {
      links.push({
        source: nodeId,
        target: `ent-${t.proyectos.entidad_id}`,
        type: 'TAREA_DE',
      });
    }

    // Link tarea → mes de fecha límite
    if (t.fecha_limite) {
      const mid = asegurarMes(new Date(t.fecha_limite));
      links.push({
        source: nodeId,
        target: mid,
        type: 'VENCE_EN',
      });
    }
  }

  // ── Hub de Tareas Urgentes ──────────────────────────────────────
  const urgentTasks = tareasRows.filter((t: any) => t.urgente === true || (t.prioridad || '').toLowerCase() === 'alta' || (t.estado && t.estado !== 'CULMINADO'));
  if (urgentTasks.length > 0 || tareasRows.length > 0) {
    nodes.push({
      id: 'hub-urgentes-tareas',
      name: '🔥 URGENTES TAREAS',
      type: 'HUB_TAREAS',
      extra: { total_urgentes: urgentTasks.length },
    });
    for (const t of urgentTasks) {
      links.push({
        source: 'hub-urgentes-tareas',
        target: `tar-${t.id}`,
        type: 'HUB_TAREAS',
      });
    }
  }

  // ── Nodos & Links de Libros & Citas ────────────────────────────
  for (const b of librosRows) {
    const bookNodeId = `lib-${b.id}`;
    const nodeType = (b as any).tipo_media || 'LIBRO';
    nodes.push({
      id: bookNodeId,
      name: b.titulo,
      type: nodeType,
      extra: {
        titulo: b.titulo,
        autor: b.autor ?? null,
        estado_lectura: b.estado_lectura,
        veces_leido: b.veces_leido,
        url_pdf: b.url_pdf ?? null,
        creado_en: b.creado_en,
        tipo_media: nodeType,
      },
    });

    // Link libro/pelicula → mes LEYO_EN / VIO_EN
    if ((b.estado_lectura === 'LEYENDO' || b.estado_lectura === 'LEIDO' || b.estado_lectura === 'VIENDO' || b.estado_lectura === 'VISTO') && b.creado_en) {
      const mid = asegurarMes(new Date(b.creado_en));
      links.push({
        source: bookNodeId,
        target: mid,
        type: nodeType === 'LIBRO' ? 'LEYO_EN' : 'VIO_EN',
      });
    }

    // Process quotes (citas)
    for (const c of b.citas) {
      const quoteNodeId = `cit-${c.id}`;
      // Limit display text to 35 chars for label clarity, keep full text in extra
      const displayLabel = c.texto.length > 35 ? c.texto.substring(0, 35) + '...' : c.texto;
      nodes.push({
        id: quoteNodeId,
        name: displayLabel,
        type: 'CITA',
        extra: {
          texto: c.texto,
          pagina: c.pagina ?? null,
          comentario: c.comentario ?? null,
          libro_id: c.libro_id,
          libro_titulo: b.titulo,
        },
      });

      // Link cita → libro (CITA_DE)
      links.push({
        source: quoteNodeId,
        target: bookNodeId,
        type: 'CITA_DE',
      });
    }
  }

  // ── Nodos & Links de Proyectos ──────────────────────────────────
  for (const p of proyectosRows) {
    const nodeId = `proj-${p.id}`;
    nodes.push({
      id: nodeId,
      name: p.nombre,
      type: 'PROYECTO',
      extra: {
        descripcion: p.descripcion,
        estado: p.estado || (p.metadatos as any)?.estado || 'ACTIVO',
        fecha_inicio: p.fecha_inicio,
        fecha_fin: p.fecha_fin,
        entidad_id: p.entidad_id,
        notas: p.notas,
        is_destacado: p.is_destacado,
      },
    });

    if (p.entidad_id) {
      links.push({
        source: nodeId,
        target: `ent-${p.entidad_id}`,
        type: 'PROYECTO_DE',
      });
    }
  }

  // ── Nodo maestro LINKS ───────────────────────────────────────────
  if (enlacesRows.length > 0) {
    nodes.push({
      id: 'links-hub',
      name: '🔗 LINKS',
      type: 'LINKS',
      extra: { enlaces: enlacesRows },
    });
  }

  return { nodes, links };
}
