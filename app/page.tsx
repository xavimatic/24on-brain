'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, CheckCircle2, DollarSign, RefreshCw, FileText, Sun, Moon, Network } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

export default function Home() {
  const [texto, setTexto] = useState('');
  const [grabando, setGrabando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [tema, setTema] = useState<'light' | 'dark'>('light');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Inicializar tema desde localStorage o preferencia del sistema
  useEffect(() => {
    const temaGuardado = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (temaGuardado) {
      setTema(temaGuardado);
      document.documentElement.classList.toggle('dark', temaGuardado === 'dark');
    } else {
      const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTema(prefiereOscuro ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', prefiereOscuro);
    }
  }, []);

  const toggleTema = () => {
    const nuevoTema = tema === 'light' ? 'dark' : 'light';
    setTema(nuevoTema);
    localStorage.setItem('theme', nuevoTema);
    document.documentElement.classList.toggle('dark', nuevoTema === 'dark');
  };

  // 1. Iniciar grabación de voz nativa
  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // 1. Cambiamos el tipo a audio/webm que es el nativo de Chrome/Edge
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        setCargando(true);
        setResultado(null);

        try {
          // 2. Le pasamos la extensión correcta .webm
          const formData = new FormData();
          formData.append('audio', audioBlob, 'nota_de_voz.webm');

          // 3. Enviarlo al backend
          const res = await fetch('/api/procesar', {
            method: 'POST',
            body: formData, // Enviamos el formData directo
          });
          
          const data = await res.json();
          setResultado(data);
        } catch (err: any) {
          console.error('Error al enviar el audio:', err);
          setResultado({ success: false, error: err.message || 'Error al procesar el audio en el servidor' });
        } finally {
          setCargando(false);
        }
      };

      mediaRecorder.start();
      setGrabando(true);
    } catch (err) {
      console.error('Error al acceder al micrófono:', err);
      alert('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  // 2. Detener grabación de voz
  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && grabando) {
      mediaRecorderRef.current.stop();
      setGrabando(false);
      // Detener el uso del micrófono en hardware
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // 3. Enviar texto manual al backend
  const enviarTexto = async () => {
    if (!texto.trim()) return;
    setCargando(true);
    setResultado(null);

    try {
      const formData = new FormData();
      formData.append('mensaje', texto);

      const res = await fetch('/api/procesar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setResultado(data);
      if (data.success) setTexto('');
    } catch (err: any) {
      console.error(err);
      setResultado({ success: false, error: err.message || 'Error al conectar con el servidor' });
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-zinc-950 text-neutral-900 dark:text-zinc-100 flex flex-col justify-between p-4 max-w-md mx-auto font-sans transition-colors duration-300">
      {/* Encabezado */}
      <header className="py-4 border-b border-neutral-200/60 dark:border-zinc-800 flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tight text-neutral-800 dark:text-white">24onbrain</h1>
        <div className="flex items-center space-x-3">
          <Link
            href="/cerebro/grafo"
            className="p-2 rounded-full hover:bg-neutral-200/50 dark:hover:bg-zinc-800/60 text-neutral-500 dark:text-zinc-400 transition-colors"
            aria-label="Ver ecosistema relacional"
            title="Ecosistema Relacional"
          >
            <Network size={18} />
          </Link>
          <button 
            onClick={toggleTema}
            className="p-2 rounded-full hover:bg-neutral-200/50 dark:hover:bg-zinc-800/60 text-neutral-500 dark:text-zinc-400 transition-colors"
            aria-label="Cambiar tema"
          >
            {tema === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <span className="bg-neutral-200/60 dark:bg-zinc-800 text-xs px-2 py-1 rounded-full text-neutral-500 dark:text-zinc-400 font-mono">v1.0</span>
        </div>
      </header>

      {/* Pantalla de Resultados Temporales */}
      <section className="flex-1 my-4 overflow-y-auto space-y-4 flex flex-col justify-center">
        {cargando && (
          <div className="flex flex-col items-center justify-center text-neutral-400 space-y-2 animate-pulse">
            <RefreshCw className="animate-spin text-neutral-800 dark:text-blue-500" size={32} />
            <p className="text-xs font-medium">Procesando solicitud...</p>
          </div>
        )}

        {resultado && resultado.success && (
          <div className="bg-white dark:bg-zinc-900 border border-neutral-200/80 dark:border-zinc-800/80 rounded-2xl p-5 space-y-3 shadow-sm animate-fade-in w-full max-w-md mx-auto">
            <div className="flex items-center space-x-2 text-neutral-500 dark:text-zinc-400 font-semibold text-xs uppercase tracking-wider">
              <span>
                {resultado.accion === 'reporte_generado' && '📊 Reporte del Cerebro'}
                {resultado.accion === 'registro_actualizado' && '🎉 Registro Actualizado'}
                {resultado.accion === 'enlace_guardado' && '🔗 Enlace Organizado'}
                {resultado.accion !== 'reporte_generado' && resultado.accion !== 'registro_actualizado' && resultado.accion !== 'enlace_guardado' && '✅ Guardado Exitosamente'}
              </span>
            </div>
            
            {resultado.accion === 'reporte_generado' ? (
              <div className="space-y-4 w-full">
                {resultado.data.datosFinanzas && resultado.data.datosFinanzas.length > 0 && (
                  <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 w-full">
                    
                    {/* Cabecera del Módulo */}
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500 text-left">
                        Control de Cuentas por Cobrar
                      </h3>
                    </div>
                    
                    {/* Tabla de Registros Separados */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/20 text-xs font-medium text-gray-400 dark:border-zinc-800 dark:bg-zinc-900/20 dark:text-zinc-500">
                            <th className="p-4">Concepto / Servicio</th>
                            <th className="p-4">Vencimiento</th>
                            <th className="p-4 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm text-gray-700 dark:divide-zinc-800 dark:text-zinc-300">
                          {resultado.data.datosFinanzas.map((item: any) => {
                            // Lógica para detectar si el vencimiento es del mes actual (Junio 2026)
                            const esMesActual = item.fecha.includes('/06/2026') || item.fecha.includes('/6/2026') || item.fecha.toLowerCase().includes('junio');
                            
                            return (
                              <tr key={item.id} className="hover:bg-gray-50/30 transition-colors dark:hover:bg-zinc-800/20">
                                <td className="p-4">
                                  <div className="font-medium text-gray-900 dark:text-white">{item.descripcion}</div>
                                  <div className="text-xs text-gray-400 dark:text-zinc-500">ID Movimiento: #{item.id}</div>
                                </td>
                                <td className="p-4">
                                  <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs ${
                                    item.fecha === 'Sin fecha'
                                      ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 font-normal'
                                      : esMesActual
                                        ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 font-bold border border-red-200/50' // Alerta Bold si es el mes actual
                                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 font-normal'
                                  }`}>
                                    {item.fecha}
                                  </span>
                                </td>
                                <td className="p-4 text-right font-mono text-base font-bold text-gray-900 dark:text-white">
                                  Gs. {Number(item.monto).toLocaleString('es-PY')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Fila Inferior de Cierre: Total Destacado */}
                    <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <span className="text-sm font-medium text-gray-400 dark:text-zinc-500">Resumen de Flujo Pendiente</span>
                      <span className="text-xl font-black tracking-tight text-gray-900 dark:text-white font-mono">
                        Gs. {resultado.data.datosFinanzas.reduce((acc: number, item: any) => acc + Number(item.monto), 0).toLocaleString('es-PY')}
                      </span>
                    </div>

                  </div>
                )}

                <div className="text-sm text-neutral-700 dark:text-zinc-200 bg-neutral-50 dark:bg-zinc-950/40 p-4 rounded-xl border border-neutral-200/50 dark:border-zinc-800/50 font-sans leading-relaxed text-left prose dark:prose-invert max-w-none">
                  <ReactMarkdown>{resultado.data.reporteTexto}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-700 dark:text-zinc-200 bg-neutral-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-neutral-200/50 dark:border-zinc-800/50 font-mono text-left">
                {resultado.data.descripcion}
              </p>
            )}
            
            <div className="text-[10px] text-neutral-400 dark:text-zinc-500 text-right">
              <span>Módulo: {resultado.accion}</span>
            </div>
          </div>
        )}

        {resultado && !resultado.success && (
          <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-200/60 dark:border-red-900/40 rounded-2xl p-5 space-y-2 shadow-sm animate-fade-in w-full max-w-md mx-auto">
            <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 font-semibold text-xs uppercase tracking-wider">
              <span>⚠️ Error al procesar</span>
            </div>
            <p className="text-sm text-neutral-700 dark:text-zinc-300 bg-red-50/20 dark:bg-red-950/20 p-3 rounded-xl border border-red-100 dark:border-red-900/20 font-sans text-left">
              {resultado.error || 'Ocurrió un error inesperado al procesar la solicitud.'}
            </p>
          </div>
        )}

        {!cargando && !resultado && (
          <div className="text-center text-neutral-400 dark:text-zinc-500 text-xs px-6 font-medium leading-relaxed">
            Dictá una nota de voz o escribí una tarea abajo para agendarla automáticamente.
          </div>
        )}
      </section>

      {/* Controles de Entrada */}
      <section className="space-y-4 bg-neutral-100/50 dark:bg-zinc-900/40 p-4 rounded-3xl border border-neutral-200/80 dark:border-zinc-800/80 backdrop-blur-md">
        {/* Input de Texto Corto */}
        <div className="flex items-center space-x-2 bg-white dark:bg-zinc-950 rounded-xl p-2 border border-neutral-200/80 dark:border-zinc-800 focus-within:border-blue-500 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-950/30 transition-all">
          <input
            type="text"
            placeholder="Escribí una tarea, gasto o link..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={grabando || cargando}
            className="flex-1 bg-transparent border-none outline-none text-neutral-800 dark:text-zinc-100 placeholder-neutral-400 dark:placeholder-zinc-650 px-2 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && enviarTexto()}
          />
          <button 
            onClick={enviarTexto}
            disabled={!texto.trim() || grabando || cargando}
            className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:bg-neutral-100 dark:disabled:bg-zinc-900 disabled:text-neutral-300 dark:disabled:text-zinc-700 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>

        {/* Botón de Micrófono Gigante para Audios */}
        <div className="flex flex-col items-center justify-center pt-2">
          <button
            onClick={grabando ? detenerGrabacion : iniciarGrabacion}
            disabled={cargando || (texto.trim().length > 0)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-md duration-300 ${
              grabando 
                ? 'bg-red-500 hover:bg-red-600 animate-bounce text-white' 
                : 'bg-neutral-900 hover:bg-neutral-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white disabled:bg-neutral-100 dark:disabled:bg-zinc-900 disabled:text-neutral-300 dark:disabled:text-zinc-700'
            }`}
          >
            {grabando ? <Square size={24} fill="white" /> : <Mic size={24} />}
          </button>
          <span className={`text-[10px] mt-2 font-semibold tracking-wider uppercase transition-colors ${grabando ? 'text-red-500 animate-pulse' : 'text-neutral-400 dark:text-zinc-500'}`}>
            {grabando ? 'GRABANDO AUDIO...' : 'MANTENER / TOCAR PARA HABLAR'}
          </span>
        </div>
      </section>
    </main>
  );
}
