import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/* ------------------------------------------------------------------ */
/*  POST /api/grafo/finanzas  — Create a new finanza                   */
/* ------------------------------------------------------------------ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { descripcion, monto, tipo, estado_pago, fecha_vencimiento, proyecto_id, entidad_id, crear_alerta, recurrente, frecuencia, dia_vencimiento, mes_vencimiento, cuota_actual, cuotas_total, entidad_origen_id } = body;

    if (!descripcion || monto == null || !tipo) {
      return NextResponse.json(
        { error: 'Campos requeridos: descripcion, monto, tipo' },
        { status: 400 }
      );
    }

    const cuotasTotal = cuotas_total ? Number(cuotas_total) : null;
    const cuotaActual = cuotasTotal ? (cuota_actual ? Number(cuota_actual) : 1) : null;
    const descFinal = cuotasTotal
      ? `${descripcion} cuota ${cuotaActual}/${cuotasTotal}`
      : descripcion;

    const created = await prisma.finanzas.create({
      data: {
        descripcion: descFinal,
        monto,
        tipo,
        estado_pago: (estado_pago || 'PENDIENTE').toUpperCase(),
        saldo_pendiente: monto,
        fecha_vencimiento: fecha_vencimiento ? new Date(fecha_vencimiento) : null,
        proyecto_id: proyecto_id ? Number(proyecto_id) : null,
        recurrente: recurrente === true && (!cuotasTotal || cuotaActual! < cuotasTotal),
        frecuencia: recurrente ? (frecuencia || 'MENSUAL') : null,
        dia_vencimiento: recurrente && frecuencia === 'ANUAL' && mes_vencimiento ? null : (recurrente && dia_vencimiento ? Number(dia_vencimiento) : null),
        mes_vencimiento: recurrente && frecuencia === 'ANUAL' && mes_vencimiento ? Number(mes_vencimiento) : null,
        cuota_actual: cuotaActual,
        cuotas_total: cuotasTotal,
        entidad_origen_id: entidad_origen_id ? Number(entidad_origen_id) : null,
      },
    });

    if (crear_alerta && fecha_vencimiento) {
      await prisma.tareas.create({
        data: {
          descripcion: `Alerta: Vencimiento de ${descripcion}`,
          fecha_limite: new Date(fecha_vencimiento),
          prioridad: 'alta',
          estado: 'pendiente',
        proyecto_id: proyecto_id ? Number(proyecto_id) : null,
        entidad_id: entidad_id ? Number(entidad_id) : null,
          finanza_id: created.id,
        },
      });
    }

    return NextResponse.json({ ok: true, id: created.id });
  } catch (error: any) {
    console.error('Error creando finanza:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/*  PATCH /api/grafo/finanzas  — Update an existing finanza            */
/* ------------------------------------------------------------------ */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, descripcion, monto, tipo, estado_pago, fecha_vencimiento, recurrente, frecuencia, dia_vencimiento, mes_vencimiento, entidad_id, entidad_origen_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Se requiere el campo id' }, { status: 400 });
    }

    const data: any = {};
    if (descripcion !== undefined) data.descripcion = descripcion;
    if (monto !== undefined) data.monto = monto;
    if (tipo !== undefined) data.tipo = tipo;
    if (fecha_vencimiento !== undefined) {
      data.fecha_vencimiento = fecha_vencimiento ? new Date(fecha_vencimiento) : null;
    }
    if (recurrente !== undefined) data.recurrente = recurrente;
    if (frecuencia !== undefined) data.frecuencia = frecuencia;
    if (dia_vencimiento !== undefined) data.dia_vencimiento = dia_vencimiento ? Number(dia_vencimiento) : null;
    if (mes_vencimiento !== undefined) data.mes_vencimiento = mes_vencimiento ? Number(mes_vencimiento) : null;
    if (entidad_id !== undefined) data.entidad_id = entidad_id ? Number(entidad_id) : null;
    if (entidad_origen_id !== undefined) data.entidad_origen_id = entidad_origen_id ? Number(entidad_origen_id) : null;

    let clonedId: number | null = null;

    // Handle estado_pago changes for recurring installments
    if (estado_pago !== undefined) {
      const newEstado = estado_pago.toUpperCase();
      data.estado_pago = newEstado;

      // If being marked as paid/cobrado, check for recurrence progression
      if (['PAGADO', 'COBRADO', 'CONCRETADO'].includes(newEstado)) {
        const current = await prisma.finanzas.findUnique({
          where: { id: Number(id) },
          select: {
            cuota_actual: true, cuotas_total: true, recurrente: true, frecuencia: true,
            descripcion: true, monto: true, proyecto_id: true, dia_vencimiento: true,
            mes_vencimiento: true, fecha_vencimiento: true, tipo: true,
            entidad_origen_id: true,
          },
        });

        if (current?.recurrente) {
            const ct = current.cuotas_total;
            const ca = current.cuota_actual;

            if (ct && ca) {
              // ── Cuotas: increment numerator, clone as PENDIENTE
              if (ca < ct) {
                const nextCuota = ca + 1;
                const baseDesc = current.descripcion.replace(/\s+cuota\s+\d+\/\d+$/, '');
                const nextVencimiento = current.fecha_vencimiento
                  ? new Date(current.fecha_vencimiento.getFullYear(), current.fecha_vencimiento.getMonth() + 1, current.dia_vencimiento || current.fecha_vencimiento.getDate())
                  : null;

                const cloned = await prisma.finanzas.create({
                  data: {
                    descripcion: `${baseDesc} cuota ${nextCuota}/${ct}`,
                    monto: current.monto,
                    tipo: current.tipo,
                    estado_pago: 'PENDIENTE',
                    saldo_pendiente: current.monto,
                    fecha_vencimiento: nextVencimiento,
                    proyecto_id: current.proyecto_id,
                    recurrente: nextCuota < ct,
                    frecuencia: current.frecuencia,
                    dia_vencimiento: current.dia_vencimiento,
                    mes_vencimiento: current.mes_vencimiento,
                    cuota_actual: nextCuota,
                    cuotas_total: ct,
                    entidad_origen_id: current.entidad_origen_id,
                  },
                });
                clonedId = cloned.id;
              }

              // Close recurrence on the current record if it was the last cuota
              if (ca >= ct) {
                data.recurrente = false;
              }
          } else {
            // ── Simple recurrence (no cuotas): clone with +1 period ──
            const freq = current.frecuencia || 'MENSUAL';
            let nextDate: Date | null = null;

            if (current.fecha_vencimiento) {
              const d = new Date(current.fecha_vencimiento);
              if (freq === 'MENSUAL') {
                d.setMonth(d.getMonth() + 1);
              } else if (freq === 'ANUAL') {
                d.setFullYear(d.getFullYear() + 1);
              }
              nextDate = d;
            } else if (current.dia_vencimiento) {
              // Recurring by day-of-month without a base date: set to next month
              const now = new Date();
              nextDate = new Date(now.getFullYear(), now.getMonth() + 1, current.dia_vencimiento);
              if (current.mes_vencimiento && freq === 'ANUAL') {
                nextDate = new Date(now.getFullYear() + 1, current.mes_vencimiento - 1, current.dia_vencimiento);
              }
            }

            const cloned = await prisma.finanzas.create({
              data: {
                descripcion: current.descripcion,
                monto: current.monto,
                tipo: current.tipo,
                estado_pago: 'PENDIENTE',
                saldo_pendiente: current.monto,
                fecha_vencimiento: nextDate,
                proyecto_id: current.proyecto_id,
                recurrente: true,
                frecuencia: freq,
                dia_vencimiento: current.dia_vencimiento,
                mes_vencimiento: current.mes_vencimiento,
                cuota_actual: null,
                cuotas_total: null,
                entidad_origen_id: current.entidad_origen_id,
              },
            });
            clonedId = cloned.id;
          }
        }
      }
    }

    await prisma.finanzas.update({
      where: { id: Number(id) },
      data,
    });

    return NextResponse.json({ ok: true, clonedId });
  } catch (error: any) {
    console.error('Error actualizando finanza:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
