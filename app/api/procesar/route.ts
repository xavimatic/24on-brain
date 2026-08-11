import { NextResponse } from 'next/server';
import { normalizeText } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { obtenerGrafo } from '../grafo/helper';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const mensajeTexto = formData.get('mensaje') as string | null;
    const archivoAudio = formData.get('audio') as File | null;
    const entidadIdStr = formData.get('entidad_id') as string | null;
    const entidadId = entidadIdStr ? Number(entidadIdStr) : null;

    const isGlobalParse = formData.get('is_global_parse') === 'true';

    if (isGlobalParse) {
      if (!mensajeTexto) {
        return NextResponse.json({ error: 'Debes proporcionar un texto para procesar' }, { status: 400 });
      }

      const openai = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseURL: 'https://api.deepseek.com',
      });

      const promptGlobalParser = `
        Analiza la siguiente frase en español escrita o dictada por el usuario. Tu objetivo es clasificarla en uno de los siguientes tipos de creación y extraer sus campos correspondientes.
        
        Tipos de creación soportados:
        1. "FINANZA_ALERTA": Si se refiere a un vencimiento de cobro, pago, gasto, factura o hosting con montos y fechas.
           Campos a extraer:
           - descripcion (string, concepto de la finanza, ej: "Pago de hosting de Nix")
           - monto (number, el valor numérico, ej: 250000)
           - tipo (string, clasificar estrictamente en: "vencimiento_cliente" o "egreso")
           - fecha_vencimiento (string en formato ISO, la fecha detectada. Hoy es 13 de junio de 2026. Si menciona "5 de julio", calcula la fecha correspondiente a 2026-07-05T00:00:00.000Z)
           - crear_alerta (boolean, siempre true para este tipo)
           - proyecto_nombre (string, opcional, nombre del proyecto mencionado, ej: "NIX")
        2. "LIBRO": Si habla de cargar o registrar un libro o lectura.
           Campos a extraer:
           - titulo (string, título del libro)
           - autor (string, opcional, autor)
           - estado_lectura (string, por defecto "PENDIENTE")
        3. "PELICULA": Si habla de registrar una película o serie de TV.
           Campos a extraer:
           - titulo (string, título de la película o serie)
           - autor (string, opcional, director o creador)
           - estado_lectura (string, por defecto "PENDIENTE")
           - tipo_media (string, "PELICULA" o "SERIE")
        4. "TAREA": Si se refiere a un recordatorio, tarea simple, alarma o cosa por hacer sin montos.
           Campos a extraer:
           - descripcion (string, descripción de la tarea)
           - prioridad (string, "baja", "media" o "alta")
           - fecha_limite (string en formato ISO, la fecha límite calculada)
           - estado (string, clasificar estrictamente en: "PENDIENTE" o "SEGUIMIENTO", por defecto "PENDIENTE")
           - proyecto_nombre (string, opcional)
        5. "CITA": Si se refiere a anotar una cita, frase o nota libre asociada a un libro.
           Campos a extraer:
           - texto (string, el texto de la cita o nota)
           - pagina (number, opcional)
           - comentario (string, opcional)
           - libro_titulo (string, opcional, libro al que pertenece)
        6. "LINK": Si provee una URL para guardar como enlace.
           Campos a extraer:
           - url (string, la URL completa)
           - descripcion (string, descripción corta)
           - categoria (string, "TUTORIAL", "CONTENIDO_YOUTUBE", "IDEAS_PUBLICIDAD" o "OTROS")

        Debes responder ÚNICAMENTE con un objeto JSON válido (sin markdown, sin bloques de código) con la estructura:
        {
          "tipo": "FINANZA_ALERTA" | "LIBRO" | "PELICULA" | "TAREA" | "CITA" | "LINK",
          "argumentos": { ...campos extraídos... }
        }

        Texto del usuario: "${mensajeTexto}"
      `;

      const completion = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: promptGlobalParser },
          { role: 'user', content: mensajeTexto }
        ],
        response_format: { type: 'json_object' }
      });

      const responseText = completion.choices[0].message.content;
      if (!responseText) {
        throw new Error('No se recibió respuesta en formato texto de la IA');
      }
      const resultadoIA = JSON.parse(responseText);
      const args = resultadoIA.argumentos;

      let responseMsg = 'Registro creado exitosamente.';

      if (resultadoIA.tipo === 'FINANZA_ALERTA') {
        let proyectoId: number | null = null;
        if (args.proyecto_nombre) {
          const proyectoNombre = args.proyecto_nombre.toUpperCase();
          const proj = await prisma.proyectos.upsert({
            where: { nombre: proyectoNombre },
            update: {},
            create: { nombre: proyectoNombre, descripcion: `Proyecto ${proyectoNombre}` }
          });
          proyectoId = proj.id;
        }

        const finanza = await prisma.finanzas.create({
          data: {
            descripcion: args.descripcion || 'Gasto/Cobro registrado por IA',
            monto: Number(args.monto) || 0,
            tipo: args.tipo || 'egreso',
            estado_pago: (args.estado_pago || 'pendiente').toUpperCase(),
            saldo_pendiente: Number(args.monto) || 0,
            fecha_vencimiento: args.fecha_vencimiento ? new Date(args.fecha_vencimiento) : null,
            proyecto_id: proyectoId
          }
        });

        if (args.crear_alerta && args.fecha_vencimiento) {
          await prisma.tareas.create({
            data: {
              descripcion: `Alerta: Vencimiento de ${args.descripcion || 'Gasto/Cobro'}`,
              fecha_limite: new Date(args.fecha_vencimiento),
              prioridad: 'alta',
              estado: 'PENDIENTE',
              proyecto_id: proyectoId,
              finanza_id: finanza.id
            }
          });
        }
        responseMsg = `Finanza "${args.descripcion}" y recordatorio creados exitosamente.`;
      } 
      else if (resultadoIA.tipo === 'LIBRO') {
        await prisma.libros.create({
          data: {
            titulo: args.titulo || 'Libro sin título',
            autor: args.autor || null,
            estado_lectura: args.estado_lectura || 'PENDIENTE',
            tipo_media: 'LIBRO'
          }
        });
        responseMsg = `Libro "${args.titulo}" guardado exitosamente.`;
      }
      else if (resultadoIA.tipo === 'PELICULA') {
        await prisma.libros.create({
          data: {
            titulo: args.titulo || 'Película sin título',
            autor: args.autor || null,
            estado_lectura: args.estado_lectura || 'PENDIENTE',
            tipo_media: args.tipo_media || 'PELICULA'
          }
        });
        responseMsg = `${args.tipo_media === 'SERIE' ? 'Serie' : 'Película'} "${args.titulo}" guardada exitosamente.`;
      }
      else if (resultadoIA.tipo === 'TAREA') {
        let proyectoId: number | null = null;
        if (args.proyecto_nombre) {
          const proyectoNombre = args.proyecto_nombre.toUpperCase();
          const proj = await prisma.proyectos.upsert({
            where: { nombre: proyectoNombre },
            update: {},
            create: { nombre: proyectoNombre, descripcion: `Proyecto ${proyectoNombre}` }
          });
          proyectoId = proj.id;
        }

        await prisma.tareas.create({
          data: {
            descripcion: args.descripcion || 'Tarea sin descripción',
            prioridad: args.prioridad || 'media',
            fecha_limite: args.fecha_limite ? new Date(args.fecha_limite) : null,
            proyecto_id: proyectoId,
            estado: args.estado || 'PENDIENTE'
          }
        });
        responseMsg = `Tarea "${args.descripcion}" guardada exitosamente.`;
      }
      else if (resultadoIA.tipo === 'CITA') {
        const libroTitulo = args.libro_titulo || 'Notas Libres';
        const libro = await prisma.libros.upsert({
          where: { titulo: normalizeText(libroTitulo) },
          update: {},
          create: {
            titulo: normalizeText(libroTitulo),
            estado_lectura: 'LEIDO',
            tipo_media: 'LIBRO'
          }
        });

        await prisma.citas.create({
          data: {
            libro_id: libro.id,
            texto: args.texto || 'Nota sin contenido',
            pagina: args.pagina ? Number(args.pagina) : null,
            comentario: args.comentario || null
          }
        });
        responseMsg = `Nota guardada exitosamente en el libro "${libroTitulo}".`;
      }
      else if (resultadoIA.tipo === 'LINK') {
        await prisma.enlaces.create({
          data: {
            url: args.url,
            descripcion: args.descripcion || 'Enlace guardado',
            categoria: args.categoria || 'OTROS'
          }
        });
        responseMsg = `Enlace guardado exitosamente: "${args.descripcion}".`;
      }

      return NextResponse.json({
        success: true,
        data: { descripcion: responseMsg },
        grafo: await obtenerGrafo()
      });
    }

    if (!mensajeTexto && !archivoAudio) {
      return NextResponse.json({ error: 'Debes proporcionar un texto o una nota de voz' }, { status: 400 });
    }

    // El motor de DeepSeek es de texto, si mandan audio tiramos un error amigable
    if (archivoAudio) {
      return NextResponse.json({ 
        success: false, 
        error: 'El motor DeepSeek no soporta transcripción de voz directamente. Por favor, escribe tu solicitud en formato de texto.' 
      }, { status: 400 });
    }

    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseURL: 'https://api.deepseek.com',
    });
    // Traer las entidades y vínculos de la base de datos para dar contexto a la IA
    const entidadesDB = await prisma.entidades.findMany({
      include: {
        vinculos_de: {
          include: {
            destino: true
          }
        }
      }
    });

    const contextoEcosistema = entidadesDB.map(e => {
      const aliasList = (e.metadatos as any)?.alias || [];
      const relaciones = e.vinculos_de.map(v => `es ${v.tipo} de "${v.destino.nombre}"`).join(', ');
      return `- Entidad: "${e.nombre}" (${e.tipo}). Alias: ${JSON.stringify(aliasList)}.${relaciones ? ` Relaciones: ${relaciones}.` : ''}`;
    }).join('\n');

    let contextoEntidadSeleccionada = '';
    if (entidadId) {
      const ent = await prisma.entidades.findUnique({
        where: { id: entidadId },
        include: { proyectos: true }
      });
      if (ent) {
        contextoEntidadSeleccionada = `\nENTIDAD SELECCIONADA ACTUALMENTE: El usuario está viendo la entidad "${ent.nombre}" (${ent.tipo}). Cualquier tarea, finanza o enlace que se cree debe asociarse preferentemente a esta entidad. Sus proyectos asociados son: ${ent.proyectos.map(p => `"${p.nombre}"`).join(', ')}.\n`;
      }
    }

    const promptSistema = `
      Eres el motor de control de un Segundo Cerebro operativo y financiero. 
      
      24onbrain es una aplicación exclusiva para Xavier Reyes y la agencia 24on. Cuando el usuario consulte 'cobros', muestra ÚNICAMENTE los saldos a favor de la agencia (ingresos o vencimientos de clientes que le deben dinero a 24on). Ignora por completo cualquier registro de caja interna o servicios de terceros (como ventas de repuestos o mecánicas de clientes) que puedan existir en la base de datos como registros de prueba.

      CONTEXTO DE NUESTRO ECOSISTEMA DE ENTIDADES Y PROYECTOS:
      ${contextoEcosistema}
      ${contextoEntidadSeleccionada}
      
      Tu trabajo es analizar el mensaje (texto o audio) y determinar la acción exacta del usuario basándote en cinco herramientas disponibles: 'gestionar_tarea', 'gestionar_finanzas', 'consultar_reporte', 'actualizar_estado' o 'gestionar_enlaces'.
      
      Debes responder ÚNICAMENTE con un objeto JSON válido (sin markdown, sin bloques de código) con la estructura:
      {
        "herramienta": "nombre_de_la_herramienta",
        "argumentos": { ...datos extraídos... }
      }
      
      REGLAS CRÍTICAS DE CLASIFICACIÓN:
      1. Usa 'consultar_reporte' SIEMPRE que el usuario pregunte "¿Qué tengo...?", "Mostrame...", "Listame...", "Cobros de...", "Tareas de...", o simplemente escriba palabras clave de búsqueda como "cobros jordan" o "tareas urgentes". Su único objetivo es BUSCAR y MOSTRAR.
      2. Usa 'actualizar_estado' ÚNICAMENTE si el usuario da una orden explícita de acción imperativa para cerrar o cambiar algo, por ejemplo: "Marcar como pagado el cobro de...", "Completar la tarea de...", o "Ya pagué lo de...".
 
      REGLAS PARA 'actualizar_estado' (Se activa si el usuario dice que "ya hizo", "completó", "pagó" o "cobró" algo existente):
      - tipo_entidad: 'tarea' o 'finanzas'
      - busqueda_keyword: Una frase o palabra clave corta para buscar el registro en la DB (ej: si dice "ya cambié la luz de la oficina", la keyword puede ser "luz oficina").
      - nuevo_estado: 'CONCLUIDA' (para tareas completadas), 'SEGUIMIENTO' (para tareas puestas en seguimiento), o 'pagado' (para finanzas).
      - proyecto_nombre: 'JORDAN', '24ON' o 'PERSONAL'.
      - nueva_descripcion: (opcional, para finanzas) La descripción completa o concepto de la transacción si el usuario menciona detalles descriptivos adicionales (ej: si dice "ya pagué el cobro de dario, saldo del 50% por venta de PC", nueva_descripcion es "Saldo del 50% por venta de PC").
      - monto: (opcional, para finanzas) El monto de la transacción si se menciona en el mensaje.
      
      REGLAS PARA CREACIÓN ('gestionar_tarea' / 'gestionar_finanzas'):
      - Úsalas solo si el usuario está agendando algo NUEVO para el futuro, no algo que ya se realizó.
 
      REGLAS PARA 'gestionar_enlaces' (Se activa si el usuario provee una URL o link):
      - url: la dirección web detectada.
      - descripcion: un resumen de para qué sirve o qué contiene según lo que mencione el usuario (ej: "Idea de publicidad para calzados").
      - categoria: Clasificar estrictamente en: 'TUTORIAL', 'CONTENIDO_YOUTUBE', 'IDEAS_PUBLICIDAD' o 'OTROS'.
      - etiquetas: Array de strings con palabras clave en minúsculas para facilitar búsquedas (ej: ["calzados", "instagram", "marketing"]).
      - proyecto_nombre: (opcional) 'JORDAN', '24ON' o 'PERSONAL' si el usuario lo menciona.

      REGLAS PARA 'consultar_reporte':
      - Si el usuario pide un reporte general, trae todo.
      - Si el usuario pregunta por un cliente específico (ej: "Jordan", "Darío") o un concepto, DEBES colocar esa palabra exacta en el argumento "busqueda_keyword" para que el backend filtre la base de datos antes de responder.
      - Si el usuario pide un mes o período específico (ej: "mes de julio", "lo de este mes", "agosto", "junio"), debes calcular las fechas límites de inicio y fin para el año actual (2026) y pasarlas en los argumentos "fecha_inicio" y "fecha_fin" en formato ISO string (ej: para julio de 2026, fecha_inicio: "2026-07-01T00:00:00.000Z", fecha_fin: "2026-07-31T23:59:59.999Z"). Hoy es 13 de junio de 2026.
    `;

    const userMessage = mensajeTexto ? mensajeTexto.trim() : '';
    let promptFinal = userMessage;

    // Si empieza con http o contiene una URL de Instagram
    if (userMessage.startsWith('http') || userMessage.includes('instagram.com')) {
      promptFinal = `Organiza este enlace: ${userMessage}. Extrae la URL limpia, clasifícala en la categoría adecuada (ej: IDEAS_PUBLICIDAD si habla de ganchos o tiendas) y genera las etiquetas semánticas correspondientes.`;
    }

    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: promptSistema },
        { role: 'user', content: promptFinal }
      ],
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0].message.content;

    if (!responseText) {
      throw new Error('No se recibió respuesta en formato texto de la IA');
    }
    const resultadoIA = JSON.parse(responseText);

    // ==========================================
    // 🛠️ NUEVO CASO: ACTUALIZACIÓN DE ESTADOS
    // ==========================================
    if (resultadoIA.herramienta === 'actualizar_estado') {
      const args = resultadoIA.argumentos;
      
      const originalKeyword = args.busqueda_keyword?.trim() || '';
      const keyword = originalKeyword
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      
      // Buscar el ID del proyecto si se especificó
      let proyectoId: number | null = null;
        if (args.proyecto_nombre) {
          const proyectoNombre = normalizeText(args.proyecto_nombre);
        const proj = await prisma.proyectos.findUnique({ where: { nombre: proyectoNombre } });
        if (proj) proyectoId = proj.id;
      }

      if (args.tipo_entidad === 'tarea') {
        // Buscamos la tarea activa que coincida parcialmente con la descripción dada por la IA
        const tareaEncontrada = await prisma.tareas.findFirst({
          where: {
            estado: { in: ['PENDIENTE', 'SEGUIMIENTO', 'pendiente', 'seguimiento'] },
            proyecto_id: proyectoId,
            OR: [
              { descripcion: { contains: keyword, mode: 'insensitive' } },
              { descripcion: { contains: originalKeyword, mode: 'insensitive' } }
            ]
          }
        });

        if (!tareaEncontrada) {
          return NextResponse.json({ success: false, error: `No encontré ninguna tarea activa que coincida con "${args.busqueda_keyword}"` }, { status: 444 });
        }

        let nuevoEstado = args.nuevo_estado || 'CONCLUIDA';
        const neoUpper = nuevoEstado.toUpperCase();
        if (neoUpper === 'CULMINADA' || neoUpper === 'COMPLETADA' || neoUpper === 'CONCLUIDA') {
          nuevoEstado = 'CONCLUIDA';
        } else if (neoUpper === 'PENDIENTE') {
          nuevoEstado = 'PENDIENTE';
        } else if (neoUpper === 'SEGUIMIENTO') {
          nuevoEstado = 'SEGUIMIENTO';
        }

        // Actualizamos a la versión normalizada
        const tareaActualizada = await prisma.tareas.update({
          where: { id: tareaEncontrada.id },
          data: { estado: nuevoEstado }
        });

        return NextResponse.json({
          success: true,
          accion: 'registro_actualizado',
          data: { descripcion: `Tarea completada: ${tareaActualizada.descripcion}`, id: tareaActualizada.id },
          grafo: await obtenerGrafo()
        });
      }

      if (args.tipo_entidad === 'finanzas') {
        const finanzaEncontrada = await prisma.finanzas.findFirst({
          where: {
            estado_pago: 'PENDIENTE',
            OR: [
              { descripcion: { contains: keyword, mode: 'insensitive' } },
              { descripcion: { contains: originalKeyword, mode: 'insensitive' } }
            ]
          }
        });

        if (finanzaEncontrada) {
          const finanzaActualizada = await prisma.finanzas.update({
            where: { id: finanzaEncontrada.id },
            data: {
              estado_pago: args.nuevo_estado,
              fecha_vencimiento: new Date('2026-06-26'),
              descripcion: args.nueva_descripcion || finanzaEncontrada.descripcion
            }
          });

          return NextResponse.json({
            success: true,
            accion: 'registro_actualizado',
            data: { descripcion: `Finanza pagada/cobrada: ${finanzaActualizada.descripcion}`, id: finanzaActualizada.id },
            grafo: await obtenerGrafo()
          });
        } else {
          // Si no encuentra coincidencias, hace un prisma.finanzas.create() y lo inserta como cobro pendiente
          const proyectoNombre = normalizeText(args.proyecto_nombre || 'PERSONAL');
          const proyecto = await prisma.proyectos.upsert({
            where: { nombre: proyectoNombre },
            update: entidadId ? { entidad_id: entidadId } : {},
            create: { nombre: proyectoNombre, descripcion: `Proyecto ${proyectoNombre}`, entidad_id: entidadId ?? null }
          });

          const montoDetectado = Number(args.monto) || 0;

          const nuevaFinanza = await prisma.finanzas.create({
            data: {
              descripcion: args.nueva_descripcion || args.busqueda_keyword || 'Cobro pendiente registrado',
              monto: montoDetectado,
              tipo: 'vencimiento_cliente',
              proyecto_id: proyecto.id,
              estado_pago: 'PENDIENTE',
              fecha_vencimiento: new Date('2026-06-26')
            }
          });

          return NextResponse.json({
            success: true,
            accion: 'registro_actualizado',
            data: { descripcion: `Nuevo cobro pendiente registrado: ${nuevaFinanza.descripcion}`, id: nuevaFinanza.id },
            grafo: await obtenerGrafo()
          });
        }
      }
    }

    // ==========================================
    // 🔀 CREACIÓN Y REPORTES (Mantenemos la lógica anterior intacta)
    // ==========================================
    if (resultadoIA.herramienta === 'gestionar_tarea') {
      const args = resultadoIA.argumentos;
      const proyectoNombre = (args.proyecto_nombre || 'PERSONAL').toUpperCase();
      const proyecto = await prisma.proyectos.upsert({
        where: { nombre: proyectoNombre },
        update: entidadId ? { entidad_id: entidadId } : {},
        create: { nombre: proyectoNombre, descripcion: `Proyecto ${proyectoNombre}`, entidad_id: entidadId ?? null }
      });
      const nuevaTarea = await prisma.tareas.create({
        data: {
          descripcion: args.descripcion || mensajeTexto || 'Tarea sin descripción',
          proyecto_id: proyecto.id,
          estado: args.estado || 'PENDIENTE',
          prioridad: args.prioridad || 'media'
        }
      });
      return NextResponse.json({ success: true, accion: 'tarea_guardada_en_db', data: nuevaTarea, grafo: await obtenerGrafo() });
    }

    if (resultadoIA.herramienta === 'gestionar_finanzas') {
      const args = resultadoIA.argumentos;
      const proyectoNombre = (args.proyecto_nombre || 'PERSONAL').toUpperCase();
      const proyecto = await prisma.proyectos.upsert({
        where: { nombre: proyectoNombre },
        update: entidadId ? { entidad_id: entidadId } : {},
        create: { nombre: proyectoNombre, descripcion: `Proyecto ${proyectoNombre}`, entidad_id: entidadId ?? null }
      });
      const nuevoRegistroFinanciero = await prisma.finanzas.create({
        data: {
          descripcion: args.descripcion || mensajeTexto || 'Transacción financiera sin descripción',
          monto: Number(args.monto),
          tipo: args.tipo,
          proyecto_id: proyecto.id,
          estado_pago: args.estado_pago || 'pendiente'
        }
      });
      return NextResponse.json({ success: true, accion: 'finanzas_guardadas_en_db', data: nuevoRegistroFinanciero, grafo: await obtenerGrafo() });
    }

    if (resultadoIA.herramienta === 'consultar_reporte') {
      const args = resultadoIA.argumentos;
      const originalKeyword = args.busqueda_keyword?.trim() || '';
      const keyword = originalKeyword
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      const isFinanceQuery = keyword.includes('cobro') || keyword.includes('pago') || keyword.includes('finanza') || keyword.includes('tesorer') || keyword.includes('vencimiento') || keyword.includes('saldo') || keyword.includes('monto') || keyword.includes('guaran');

      // Ajustamos los márgenes de fecha (+/- 2 días) para absorber desfases de huso horario
      let fechaInicioAjustada: Date | undefined;
      let fechaFinAjustada: Date | undefined;
      if (args.fecha_inicio && args.fecha_fin) {
        const dInicio = new Date(args.fecha_inicio);
        dInicio.setDate(dInicio.getDate() - 2);
        fechaInicioAjustada = dInicio;

        const dFin = new Date(args.fecha_fin);
        dFin.setDate(dFin.getDate() + 2);
        fechaFinAjustada = dFin;
      }

      // 2. Finanzas pendientes (vencimientos de clientes)
      const finanzasPendientes = await prisma.finanzas.findMany({
        where: {
          estado_pago: 'PENDIENTE',
          tipo: 'vencimiento_cliente',
          ...(fechaInicioAjustada && fechaFinAjustada ? {
            fecha_vencimiento: {
              gte: fechaInicioAjustada,
              lte: fechaFinAjustada
            }
          } : {}),
          ...(keyword && !isFinanceQuery ? {
            OR: [
              { descripcion: { contains: keyword, mode: 'insensitive' } },
              { descripcion: { contains: originalKeyword, mode: 'insensitive' } },
              { proyectos: { nombre: { contains: keyword, mode: 'insensitive' } } },
              { proyectos: { nombre: { contains: originalKeyword, mode: 'insensitive' } } }
            ]
          } : {}),
          NOT: [
            { descripcion: { contains: 'repuesto', mode: 'insensitive' } },
            { descripcion: { contains: 'inyector', mode: 'insensitive' } },
            { descripcion: { contains: 'bomba', mode: 'insensitive' } },
            { descripcion: { contains: 'mecánico', mode: 'insensitive' } },
            { descripcion: { contains: 'camión', mode: 'insensitive' } },
            { descripcion: { contains: 'filtro', mode: 'insensitive' } },
            { descripcion: { contains: 'combustible', mode: 'insensitive' } }
          ]
        },
        orderBy: { fecha_vencimiento: 'asc' },
        include: { proyectos: { include: { entidades: { select: { nombre: true } } } } }
      });

      let todasLasTareas: any[] = [];
      let tareasUrgentes: any[] = [];
      let enlaces: any[] = [];
      let promptReporte: string;

      if (isFinanceQuery) {
        // ── Solo finanzas: ignorar tareas y enlaces ──
        promptReporte = `Eres el asistente analítico del Segundo Cerebro. Redacta un resumen ejecutivo de tesorería utilizando ÚNICAMENTE los datos financieros proporcionados.

        CONSULTA DEL USUARIO: "${originalKeyword || '(reporte financiero)'}"

        REGLA CRÍTICA: El usuario solicitó exclusivamente información financiera. NO incluyas NINGUNA sección de tareas, pendientes, proyectos, enlaces ni videos. Concéntrate única y exclusivamente en el análisis de flujo de caja y cuentas por cobrar.

        REGLA DE CONTEXTO CRÍTICA: Cuando redactes el análisis ejecutivo del flujo de caja, bajo ninguna circunstancia vuelvas a listar los registros individuales, conceptos, montos ni fechas detalladas en formato de texto o listas (ya que el usuario los visualiza de forma nativa en una tabla superior). Concéntrate exclusivamente en dar un panorama estratégico de alto nivel: totales acumulados pendientes, alertas sobre vencimientos, y proyecciones de liquidez a corto/largo plazo de manera resumida.
        REGLA DE MONEDA CRÍTICA: Estás operando en Paraguay. Los montos se representan SIEMPRE como Guaraníes (Gs.). El signo '$' en descripciones de texto plano refiere al símbolo general de dinero, pero la moneda local predeterminada son GUARANÍES (Gs.). Jamás uses pesos (MXN).
        Datos: FINANZAS: ${JSON.stringify(finanzasPendientes)}.`;
      } else {
        // ── Reporte general o de tareas: incluir todo ──
        todasLasTareas = await prisma.tareas.findMany({
          where: {
            estado: { in: ['PENDIENTE', 'SEGUIMIENTO'] },
            urgente: false,
            ...(fechaInicioAjustada && fechaFinAjustada ? {
              fecha_limite: { gte: fechaInicioAjustada, lte: fechaFinAjustada }
            } : {}),
            OR: keyword ? [
              { descripcion: { contains: keyword, mode: 'insensitive' } },
              { descripcion: { contains: originalKeyword, mode: 'insensitive' } }
            ] : undefined
          },
          include: { proyectos: true },
          orderBy: { fecha_creacion: 'desc' },
        });

        tareasUrgentes = await prisma.tareas.findMany({
          where: { urgente: true, estado: { not: 'CULMINADO' } },
          include: { proyectos: true },
          orderBy: { fecha_creacion: 'desc' },
        });

        enlaces = keyword
          ? await prisma.enlaces.findMany({
              where: {
                OR: [
                  { descripcion: { contains: keyword, mode: 'insensitive' } },
                  { descripcion: { contains: originalKeyword, mode: 'insensitive' } }
                ]
              }
            })
          : [];

        promptReporte = `Eres el asistente analítico del Segundo Cerebro. Redacta un resumen ejecutivo utilizando únicamente los datos proporcionados que tengan registros. Si una sección viene vacía en el JSON, ignórala por completo.

        CONSULTA DEL USUARIO: "${originalKeyword || '(reporte general)'}"

        TIENES DOS COLECCIONES DE TAREAS INDEPENDIENTES:
        1. TAREAS_URGENTES: Tareas marcadas como urgentes (urgente: true) que aún no están culminadas.
        2. TODAS_LAS_TAREAS: El resto de tareas activas (PENDIENTE / SEGUIMIENTO) que NO son urgentes.

        COMPORTAMIENTO CONDICIONAL SEGÚN LA INTENCIÓN DEL USUARIO:
        - Si la consulta menciona explícitamente "urgentes", "urgente" o "prioridad alta": genera EXCLUSIVAMENTE la sección "🔴 Tareas Urgentes". Ignora TODAS_LAS_TAREAS por completo.
        - Si la consulta pide "tareas" en general, "pendientes", "activas" o es un reporte general: estructura el reporte completo: primero "🔴 Tareas Urgentes" (si hay datos), luego "📋 Otras Tareas Activas" listando TODAS_LAS_TAREAS agrupadas por proyecto.
        - Si no hay tareas urgentes, omite esa sección.

        REGLA DE CONTEXTO CRÍTICA: Cuando haya datos financieros en el reporte, bajo ninguna circunstancia vuelvas a listar los registros individuales, conceptos, montos ni fechas detalladas en formato de texto o listas (ya que el usuario los visualiza de forma nativa en una tabla superior). Concéntrate exclusivamente en dar un panorama estratégico de alto nivel.
        REGLA DE MONEDA CRÍTICA: Estás operando en Paraguay. Los montos se representan SIEMPRE como Guaraníes (Gs.). Jamás uses pesos (MXN).
        Datos: TAREAS_URGENTES: ${JSON.stringify(tareasUrgentes)} | TODAS_LAS_TAREAS: ${JSON.stringify(todasLasTareas)} | FINANZAS: ${JSON.stringify(finanzasPendientes)} | ENLACES: ${JSON.stringify(enlaces)}.`;
      }

      const completionReporte = await openai.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: promptReporte },
          { role: 'user', content: 'Genera el reporte solicitado.' }
        ]
      });
      const textReporte = completionReporte.choices[0].message.content;
      return NextResponse.json({ 
        success: true, 
        accion: 'reporte_generado', 
        data: { 
          reporteTexto: textReporte || 'No se pudo generar el reporte.',
          datosFinanzas: finanzasPendientes.map(f => ({
            id: f.id,
            descripcion: f.descripcion,
            monto: f.monto,
            tipo: f.tipo,
            entidad: f.proyectos?.entidades?.nombre ?? null,
            proyecto: f.proyectos?.nombre ?? null,
            fecha: f.fecha_vencimiento
              ? `${String(f.fecha_vencimiento.getUTCDate()).padStart(2, '0')}/${String(f.fecha_vencimiento.getUTCMonth() + 1).padStart(2, '0')}/${f.fecha_vencimiento.getUTCFullYear()}`
              : 'Sin fecha'
          }))
        },
        grafo: await obtenerGrafo()
      });
    }

    if (resultadoIA.herramienta === 'gestionar_enlaces') {
      const args = resultadoIA.argumentos;

      const proyectoNombre = (args.proyecto_nombre || 'PERSONAL').toUpperCase();
      const proyecto = await prisma.proyectos.upsert({
        where: { nombre: proyectoNombre },
        update: entidadId ? { entidad_id: entidadId } : {},
        create: { nombre: proyectoNombre, descripcion: `Proyecto ${proyectoNombre}`, entidad_id: entidadId ?? null }
      });

      const nuevoEnlace = await prisma.enlaces.create({
        data: {
          url: args.url,
          descripcion: args.descripcion,
          categoria: args.categoria || 'OTROS',
          etiquetas: args.etiquetas || [],
          proyecto_id: proyecto.id
        }
      });

      return NextResponse.json({
        success: true,
        accion: 'enlace_guardado',
        data: { descripcion: `Enlace organizado: [${args.categoria}] ${args.descripcion}`, id: nuevoEnlace.id },
        grafo: await obtenerGrafo()
      });
    }

    return NextResponse.json({ error: 'No se pudo determinar la herramienta' }, { status: 422 });
  } catch (error: any) {
    console.error('Error en el pipeline:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
