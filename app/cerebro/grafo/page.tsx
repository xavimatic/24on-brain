'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw,
  Search, X, Calendar, DollarSign, CheckSquare, Building2,
  Clock, ChevronRight, Save, Plus, Loader2, Settings, Sliders, Filter,
  BookOpen, FileText, Hash, Trash2, ExternalLink, Sparkles,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { forceCollide } from 'd3-force';

// react-force-graph-2d uses browser APIs (Canvas), so we must load it dynamically with SSR disabled
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NodeExtra {
  monto?: number;
  saldo_pendiente?: number | null;
  estado_pago?: string;
  tipo?: string;
  fecha_vencimiento?: string | null;
  fecha_transaccion?: string | null;
  proyecto?: string | null;
  proyecto_id?: number | null;
  entidad_id?: number | null;
  estado?: string;
  prioridad?: string;
  fecha_limite?: string | null;
  fecha_creacion?: string | null;
  titulo?: string;
  autor?: string | null;
  estado_lectura?: string;
  veces_leido?: number;
  url_pdf?: string | null;
  libro_id?: number;
  libro_titulo?: string;
  texto?: string;
  pagina?: number | null;
  comentario?: string | null;
  descripcion?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  notas?: string | null;
  urgente?: boolean;
  enlaces?: any[];
  is_destacado?: boolean;
  entidad_origen_id?: number | null;
  entidad_origen_nombre?: string | null;
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  alias?: string[];
  extra?: NodeExtra;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  __bckgDimensions?: [number, number];
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const FIXED_CATEGORIES = [
  'HERRAMIENTAS',
  'TUTORIALES',
  'SEO',
  'CONTENIDO_YOUTUBE',
  'IDEAS_PUBLICIDAD',
  'OTROS',
  'Productos de Reventa',
  'Proveedores / Servicios',
  'Inspiración / Benchmarking',
  'Documentación Técnica',
];

/* ------------------------------------------------------------------ */
/*  Obsidian-inspired color palette                                    */
/* ------------------------------------------------------------------ */

const NODE_COLORS: Record<string, { fill: string; text: string; glow: string }> = {
  EMPRESA: {
    fill: '#7c3aed',
    text: '#c4b5fd',
    glow: 'rgba(124, 58, 237, 0.45)',
  },
  PERSONA: {
    fill: '#ec4899',
    text: '#f9a8d4',
    glow: 'rgba(236, 72, 153, 0.45)',
  },
  SERVICIO: {
    fill: '#14b8a6',
    text: '#5eead4',
    glow: 'rgba(20, 184, 166, 0.40)',
  },
  FINANZA: {
    fill: '#10b981',
    text: '#6ee7b7',
    glow: 'rgba(16, 185, 129, 0.45)',
  },
  TAREA: {
    fill: '#f59e0b',
    text: '#fcd34d',
    glow: 'rgba(245, 158, 11, 0.40)',
  },
  MES: {
    fill: '#64748b',
    text: '#cbd5e1',
    glow: 'rgba(100, 116, 139, 0.35)',
  },
  LIBRO: {
    fill: '#eb5757',
    text: '#fca5a5',
    glow: 'rgba(235, 87, 87, 0.45)',
  },
  PELICULA: {
    fill: '#06b6d4',
    text: '#99f6e4',
    glow: 'rgba(6, 182, 212, 0.45)',
  },
  SERIE: {
    fill: '#3b82f6',
    text: '#bfdbfe',
    glow: 'rgba(59, 130, 246, 0.45)',
  },
  CITA: {
    fill: '#f2c94c',
    text: '#fef08a',
    glow: 'rgba(242, 201, 76, 0.40)',
  },
  PROYECTO: {
    fill: '#ff3b30',
    text: '#fca5a5',
    glow: 'rgba(255, 59, 48, 0.50)',
  },
  HUB_FINANZAS: {
    fill: '#10b981',
    text: '#6ee7b7',
    glow: 'rgba(16, 185, 129, 0.60)',
  },
  HUB_TAREAS: {
    fill: '#f59e0b',
    text: '#fcd34d',
    glow: 'rgba(245, 158, 11, 0.60)',
  },
  LINKS: {
    fill: '#0ea5e9',
    text: '#7dd3fc',
    glow: 'rgba(14, 165, 233, 0.45)',
  },
  DEFAULT: {
    fill: '#6b7280',
    text: '#d1d5db',
    glow: 'rgba(107, 114, 128, 0.30)',
  },
};

const LINK_COLORS: Record<string, string> = {
  CLIENTE_DE: '#7c3aed',
  TRABAJA_EN: '#ec4899',
  PROVEEDOR_DE: '#14b8a6',
  SOCIO_DE: '#f97316',
  DUEÑO_DE: '#ef4444',
  PROPIETARIO_DE: '#ef4444',
  TIO_DE: '#ec4899',
  COBRO_DE: '#10b981',
  VENCE_EN: '#64748b',
  REGISTRADO_EN: '#475569',
  TAREA_DE: '#f59e0b',
  CITA_DE: '#f2c94c',
  LEYO_EN: '#eb5757',
  VIO_EN: '#06b6d4',
  PROYECTO_DE: '#a855f7',
  HIJO_DE: '#6366f1',
  HUB_FINANZAS: '#10b981',
  HUB_TAREAS: '#f59e0b',
  DEFAULT: '#334155',
};

/* ------------------------------------------------------------------ */
/*  Node radius by type (Obsidian-style sizing)                        */
/* ------------------------------------------------------------------ */

const NODE_RADIUS: Record<string, number> = {
  EMPRESA: 4,
  PERSONA: 3.5,
  SERVICIO: 3,
  FINANZA: 3,
  TAREA: 3,
  MES: 5,
  LIBRO: 4.5,
  PELICULA: 4.5,
  SERIE: 4.5,
  CITA: 3,
  PROYECTO: 4.2,
  HUB_FINANZAS: 5.5,
  HUB_TAREAS: 5.5,
  LINKS: 5,
  DEFAULT: 3,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatGs(amount: number): string {
  return `Gs. ${amount.toLocaleString('es-PY')}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getUTCDate()).padStart(2, '0')} ${monthsShort[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const monthsShort = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function shortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const year = d.getUTCFullYear();
  const base = `${String(d.getUTCDate()).padStart(2, '0')} ${monthsShort[d.getUTCMonth()]}`;
  return year === thisYear ? base : `${base} ${year}`;
}

function finanzaDateClass(f: any): string {
  const cls = shortDateClass(getFinanceDate(f));
  return cls || 'text-white/30';
}

function shortDateClass(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const thisMonth = now.getUTCMonth();
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  if (year === thisYear && month === thisMonth) return 'text-red-400';
  return '';
}

function getFinanceDate(f: any): string | null {
  return f.extra?.fecha_vencimiento || f.extra?.fecha_transaccion || null;
}

function toInputDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
}

function getNodeId(node: string | GraphNode): string {
  return typeof node === 'object' ? node.id : node;
}

/** Extract the numeric DB id from node.id ("fin-42" → 42) */
function dbId(nodeId: string): number {
  return Number(nodeId.split('-').slice(1).join('-'));
}

function renderFormattedText(text: string): string {
  return text
    .replace(/==([^=]+)==/g, '<mark class="bg-yellow-200 text-gray-900 px-0.5 rounded">$1</mark>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/<u>([^<]+)<\/u>/g, '<u>$1</u>')
    .replace(/\n/g, '<br/>');
}

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);
  const wrapped = before + selected + after;
  const newVal = textarea.value.substring(0, start) + wrapped + textarea.value.substring(end);
  textarea.value = newVal;
  textarea.selectionStart = textarea.selectionEnd = start + wrapped.length;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

const calcularDiasTranscurridos = (fechaInicio: string | Date) => {
  const inicio = new Date(fechaInicio);
  const hoy = new Date();
  inicio.setHours(0,0,0,0);
  hoy.setHours(0,0,0,0);
  
  const diferenciaTiempo = hoy.getTime() - inicio.getTime();
  const dias = Math.floor(diferenciaTiempo / (1000 * 60 * 60 * 24));
  return dias >= 0 ? dias : 0;
};

const calcularDiasTotales = (fechaInicio: string | Date, fechaFin: string | Date) => {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  inicio.setHours(0,0,0,0);
  fin.setHours(0,0,0,0);
  
  const diferenciaTiempo = fin.getTime() - inicio.getTime();
  const dias = Math.floor(diferenciaTiempo / (1000 * 60 * 60 * 24));
  return dias >= 0 ? dias : 0;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function GrafoPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerNode, setDrawerNode] = useState<GraphNode | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create' | 'global_create'>('view');
  const [saving, setSaving] = useState(false);
  const [createType, setCreateType] = useState<'FINANZA' | 'TAREA' | 'LIBRO' | 'CITA' | 'LINK' | 'PELICULA' | 'SERIE' | 'PROYECTO'>('FINANZA');
  const [selectedEntidadId, setSelectedEntidadId] = useState('0');

  // Dual View & Secondary Panel states
  const [showSecondaryPanel, setShowSecondaryPanel] = useState(true);
  const [secondaryFilter, setSecondaryFilter] = useState<'ALL' | 'TAREAS' | 'FINANZAS' | 'ENTIDADES'>('ALL');
  const [hubContextNode, setHubContextNode] = useState<GraphNode | null>(null);

  const getLinkedItemsForNode = useCallback((node: GraphNode | null) => {
    if (!node || !data) return { tasks: [], finances: [], entities: [], projects: [], links: [], allItems: [] };

    const connectedNodeIds = new Set<string>();
    data.links.forEach((l) => {
      const src = getNodeId(l.source);
      const tgt = getNodeId(l.target);
      if (src === node.id) connectedNodeIds.add(tgt);
      if (tgt === node.id) connectedNodeIds.add(src);
    });

    const nodeNameLower = (node.name || '').toLowerCase();
    const isUrgentesHub =
      node.id === 'hub-urgentes-tareas' ||
      node.id === 'proj-urgentes' ||
      node.type === 'HUB_TAREAS' ||
      nodeNameLower.includes('urgente') ||
      (node.type === 'PROYECTO' && nodeNameLower.includes('tarea'));

    let tasks: GraphNode[] = [];
    let finances: GraphNode[] = [];
    let entities: GraphNode[] = [];
    let projects: GraphNode[] = [];
    let links: GraphNode[] = [];

    if (isUrgentesHub) {
      tasks = data.nodes.filter((n) => {
        if (n.type !== 'TAREA') return false;
        if (n.extra?.urgente) return true;
        if (connectedNodeIds.has(n.id)) return true;
        if ((n.extra?.prioridad || '').toLowerCase() === 'alta') return true;
        if (n.extra?.estado === 'PENDIENTE') return true;
        return false;
      });
    } else if (node.type === 'PROYECTO') {
      const projDbId = dbId(node.id);
      tasks = data.nodes.filter((n) => n.type === 'TAREA' && (connectedNodeIds.has(n.id) || n.extra?.proyecto_id === projDbId));
      finances = data.nodes.filter((n) => n.type === 'FINANZA' && (connectedNodeIds.has(n.id) || n.extra?.proyecto_id === projDbId));
      links = data.nodes.filter((n) => (n.type === 'LINKS' || n.type === 'CITA' || n.type === 'LIBRO') && connectedNodeIds.has(n.id));
    } else if (['EMPRESA', 'PERSONA', 'SERVICIO'].includes(node.type)) {
      const entDbId = dbId(node.id);
      const childProjIds = new Set(data.nodes.filter((n) => n.type === 'PROYECTO' && (connectedNodeIds.has(n.id) || n.extra?.entidad_id === entDbId)).map((n) => dbId(n.id)));
      tasks = data.nodes.filter((n) => n.type === 'TAREA' && (connectedNodeIds.has(n.id) || (n.extra?.proyecto_id && childProjIds.has(n.extra.proyecto_id))));
      finances = data.nodes.filter((n) => n.type === 'FINANZA' && (connectedNodeIds.has(n.id) || n.extra?.entidad_id === entDbId || (n.extra?.proyecto_id && childProjIds.has(n.extra.proyecto_id))));
      projects = data.nodes.filter((n) => n.type === 'PROYECTO' && (connectedNodeIds.has(n.id) || n.extra?.entidad_id === entDbId));
      entities = data.nodes.filter((n) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type) && connectedNodeIds.has(n.id) && n.id !== node.id);
    } else if (node.type === 'MES') {
      tasks = data.nodes.filter((n) => n.type === 'TAREA' && connectedNodeIds.has(n.id));
      finances = data.nodes.filter((n) => n.type === 'FINANZA' && connectedNodeIds.has(n.id));
      links = data.nodes.filter((n) => (n.type === 'LIBRO' || n.type === 'PELICULA' || n.type === 'SERIE') && connectedNodeIds.has(n.id));
    } else if (node.type === 'HUB_FINANZAS' || node.id === 'hub_finanzas') {
      finances = data.nodes.filter((n) => n.type === 'FINANZA');
      entities = data.nodes.filter((n) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type) && connectedNodeIds.has(n.id));
    } else if (node.type === 'LINKS' || node.id === 'links-hub') {
      links = data.nodes.filter((n) => n.type === 'LINKS' || n.type === 'CITA' || n.type === 'LIBRO');
    } else {
      tasks = data.nodes.filter((n) => n.type === 'TAREA' && connectedNodeIds.has(n.id) && n.id !== node.id);
      finances = data.nodes.filter((n) => n.type === 'FINANZA' && connectedNodeIds.has(n.id) && n.id !== node.id);
      entities = data.nodes.filter((n) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type) && connectedNodeIds.has(n.id));
      projects = data.nodes.filter((n) => n.type === 'PROYECTO' && connectedNodeIds.has(n.id));
    }

    const uniqueTasks = Array.from(new Map(tasks.map((t) => [t.id, t])).values());
    const uniqueFinances = Array.from(new Map(finances.map((f) => [f.id, f])).values());
    const uniqueEntities = Array.from(new Map(entities.map((e) => [e.id, e])).values());
    const uniqueProjects = Array.from(new Map(projects.map((p) => [p.id, p])).values());
    const uniqueLinks = Array.from(new Map(links.map((l) => [l.id, l])).values());

    const allItems = [...uniqueTasks, ...uniqueFinances, ...uniqueEntities, ...uniqueProjects, ...uniqueLinks];

    return {
      tasks: uniqueTasks,
      finances: uniqueFinances,
      entities: uniqueEntities,
      projects: uniqueProjects,
      links: uniqueLinks,
      allItems,
    };
  }, [data]);

  const secondarySourceNode = hubContextNode || drawerNode;
  const linkedItems = useMemo(() => {
    return getLinkedItemsForNode(secondarySourceNode);
  }, [secondarySourceNode, getLinkedItemsForNode]);

  // Edit form state
  const [editDesc, setEditDesc] = useState('');
  const [editMonto, setEditMonto] = useState('');
  const [editTipo, setEditTipo] = useState('');
  const [editEstado, setEditEstado] = useState('');
  const [editPrioridad, setEditPrioridad] = useState('');
  const [editFecha, setEditFecha] = useState('');
  const [editFechaInicio, setEditFechaInicio] = useState('');
  const [editFechaFin, setEditFechaFin] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [editUrgente, setEditUrgente] = useState(false);
  const [editIsDestacado, setEditIsDestacado] = useState(false);
  const [editEntityOrigenId, setEditEntityOrigenId] = useState<number | ''>('');
  const [entityFinOrigenId, setEntityFinOrigenId] = useState<number | ''>('');
  const [hubFinanzasDestacado, setHubFinanzasDestacado] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hubFinanzasDestacado') === 'true';
    }
    return false;
  });
  const [editEntityPadreId, setEditEntityPadreId] = useState<number | ''>('');

  // Entity detailed state
  const [entidadDetails, setEntidadDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'ia' | 'proyectos' | 'tareas' | 'finanzas' | 'enlaces'>('ia');
  const [activeFinanzaTab, setActiveFinanzaTab] = useState<'pending_in' | 'pending_out' | 'completed_in' | 'completed_out'>('pending_in');

  // Inline task editing
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskDesc, setEditingTaskDesc] = useState('');
  const [editingTaskPrioridad, setEditingTaskPrioridad] = useState('media');
  const [editingTaskFecha, setEditingTaskFecha] = useState('');
  const [editingTaskUrgente, setEditingTaskUrgente] = useState(false);

  // New task form state under Entity Tareas tab
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPrioridad, setNewTaskPrioridad] = useState('media');
  const [newTaskFecha, setNewTaskFecha] = useState('');
  const [newTaskEstado, setNewTaskEstado] = useState('PENDIENTE');
  const [newTaskProjectId, setNewTaskProjectId] = useState<number | ''>('');
  const [newTaskUrgente, setNewTaskUrgente] = useState(false);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [createProyectoId, setCreateProyectoId] = useState<number | ''>('');
  const [proyectoTaskFilter, setProyectoTaskFilter] = useState<'PENDIENTE' | 'SEGUIMIENTO' | 'CULMINADO'>('PENDIENTE');
  const [showInlineTaskForm, setShowInlineTaskForm] = useState(false);
  const [inlineTaskDesc, setInlineTaskDesc] = useState('');
  const [inlineTaskPrioridad, setInlineTaskPrioridad] = useState('media');
  const [inlineTaskFecha, setInlineTaskFecha] = useState('');
  const [inlineTaskUrgente, setInlineTaskUrgente] = useState(false);

  const isSeguimiento = useCallback((estado: string) => {
    const est = (estado || '').toUpperCase();
    return est === 'SEGUIMIENTO';
  }, []);

  const isConcluida = useCallback((estado: string) => {
    const est = (estado || '').toUpperCase();
    return est === 'CULMINADO' || est === 'CULMINADA' || est === 'CONCLUIDA' || est === 'COMPLETADA';
  }, []);

  const isPendiente = useCallback((estado: string) => {
    const est = (estado || '').toUpperCase();
    return est === 'PENDIENTE' || est === 'PENDIENTE_ALERTA' || (est !== 'SEGUIMIENTO' && est !== 'CONCLUIDA' && est !== 'COMPLETADA' && est !== 'CULMINADA');
  }, [isSeguimiento, isConcluida]);

  const handleToggleTaskCheckbox = async (task: any) => {
    setSaving(true);
    let newEstado = 'CULMINADO';
    if (isConcluida(task.estado)) {
      newEstado = 'PENDIENTE';
    }
    try {
      const res = await fetch('/api/grafo/tareas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.id,
          estado: newEstado
        })
      });
      if (res.ok) {
        await fetchData();
        if (drawerNode) {
          const numericId = dbId(drawerNode.id);
          const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
          const detailData = await detailRes.json();
          setEntidadDetails(detailData);
        }
      }
    } catch (err) {
      console.error('Error toggling task status:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTaskSeguimiento = async (task: any) => {
    setSaving(true);
    const newEstado = isSeguimiento(task.estado) ? 'PENDIENTE' : 'SEGUIMIENTO';
    try {
      const res = await fetch('/api/grafo/tareas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task.id,
          estado: newEstado
        })
      });
      if (res.ok) {
        await fetchData();
        if (drawerNode) {
          const numericId = dbId(drawerNode.id);
          const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
          const detailData = await detailRes.json();
          setEntidadDetails(detailData);
        }
      }
    } catch (err) {
      console.error('Error toggling task tracking:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInlineTask = async (taskId: number) => {
    if (!editingTaskDesc.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/grafo/tareas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: taskId,
          descripcion: editingTaskDesc,
          prioridad: editingTaskPrioridad,
          fecha_limite: editingTaskFecha || null,
          urgente: editingTaskUrgente,
        }),
      });
      if (res.ok) {
        setEditingTaskId(null);
        await fetchData();
        if (drawerNode) {
          const numericId = dbId(drawerNode.id);
          const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
          const detailData = await detailRes.json();
          setEntidadDetails(detailData);
        }
      }
    } catch (err) {
      console.error('Error saving inline task:', err);
    } finally {
      setSaving(false);
    }
  };

  const renderTaskItem = (task: any) => {
    const isTaskEditing = editingTaskId === task.id;
    if (isTaskEditing) {
      return (
        <div key={task.id} className="bg-white/[0.03] border border-violet-500/30 rounded-xl p-3 space-y-2.5 animate-fade-in text-left">
          <textarea
            id="edit-task-ta"
            value={editingTaskDesc}
            onChange={(e) => setEditingTaskDesc(e.target.value)}
            rows={2}
            className="drawer-input py-1 text-[12px] resize-none overflow-hidden"
            placeholder="Modificar descripción..."
            onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
          />
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => { const ta = document.querySelector('#edit-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '**', '**'); }} className="text-[11px] font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Negrita">B</button>
            <button type="button" onClick={() => { const ta = document.querySelector('#edit-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '*', '*'); }} className="text-[11px] font-bold italic px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Cursiva">I</button>
            <button type="button" onClick={() => { const ta = document.querySelector('#edit-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '<u>', '</u>'); }} className="text-[11px] font-bold underline px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Subrayado">U</button>
            <button type="button" onClick={() => { const ta = document.querySelector('#edit-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '==', '=='); }} className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Resaltar">🖍️</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[8px] text-white/35 uppercase tracking-wider mb-1 font-semibold">Prioridad</label>
              <select
                value={editingTaskPrioridad}
                onChange={(e) => setEditingTaskPrioridad(e.target.value)}
                className="drawer-input py-1 text-[10px]"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-[8px] text-white/35 uppercase tracking-wider mb-1 font-semibold">Fecha límite</label>
              <input
                type="date"
                value={editingTaskFecha}
                onChange={(e) => setEditingTaskFecha(e.target.value)}
                className="drawer-input py-1 text-[10px]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editingTaskUrgente}
                onChange={(e) => setEditingTaskUrgente(e.target.checked)}
                className="accent-red-500 h-3.5 w-3.5 rounded cursor-pointer"
              />
              <span className="text-[10px] font-bold text-red-400">🔥 Marcar como Urgente</span>
            </label>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => setEditingTaskId(null)}
              className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-white/10 hover:bg-white/5 text-white/60 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleSaveInlineTask(task.id)}
              className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-all"
            >
              Guardar
            </button>
          </div>
        </div>
      );
    }

    const concluida = isConcluida(task.estado);
    return (
      <div key={task.id} className={`flex flex-col rounded-xl p-3 transition-all group text-left ${concluida ? 'opacity-50 bg-white/[0.01] border border-white/[0.03]' : 'bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04]'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <input
              type="checkbox"
              checked={concluida}
              disabled={saving}
              onChange={() => handleToggleTaskCheckbox(task)}
              className="accent-violet-500 h-3.5 w-3.5 mt-0.5 rounded cursor-pointer shrink-0"
            />
            <div className="min-w-0">
              <p className={`text-[12px] leading-snug font-medium break-words ${concluida ? 'line-through text-white/30' : 'text-white/80'}`}>
                {task.proyectoClientePrefix && (
                  <span className="text-violet-400 font-semibold mr-1">{task.proyectoClientePrefix}</span>
                )}
                <span dangerouslySetInnerHTML={{ __html: renderFormattedText(task.descripcion) }} />
              </p>
              
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-md truncate max-w-[80px] ${concluida ? 'text-white/20 bg-white/5' : 'text-white/40 bg-white/5 border border-white/10'}`}>
                                  {task.proyectoNombre}
                                </span>

                                {task.urgente && !concluida && (
                  <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md text-red-400 bg-red-500/15 border border-red-500/20 animate-pulse">
                    🔥 URGENTE
                  </span>
                )}

                {task.fecha_limite && (
                  <span className={`text-[8px] flex items-center gap-0.5 ${concluida ? 'text-white/20' : 'text-white/35'}`}>
                    <span>📅</span>
                    <span>{formatDate(task.fecha_limite)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {!concluida && (
              <button
                onClick={() => handleToggleTaskSeguimiento(task)}
                disabled={saving}
                title={isSeguimiento(task.estado) ? 'Mover a Pendiente' : 'Mover a Seguimiento'}
                className="text-white/40 hover:text-violet-400 p-1 rounded hover:bg-white/5 transition-all"
              >
                {isSeguimiento(task.estado) ? (
                  <span className="text-[11px]" title="Mover a Pendiente">⏳</span>
                ) : (
                  <span className="text-[11px]" title="Mover a Seguimiento">🔄</span>
                )}
              </button>
            )}

            {!concluida && (
              <button
                onClick={async () => {
                  setSaving(true);
                  try {
                    await fetch('/api/grafo/tareas', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: task.id, urgente: !task.urgente }),
                    });
                    await fetchData();
                    if (drawerNode) {
                      const numericId = dbId(drawerNode.id);
                      const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
                      const detailData = await detailRes.json();
                      setEntidadDetails(detailData);
                    }
                  } catch (err) { console.error('Error toggling urgency:', err); }
                  finally { setSaving(false); }
                }}
                disabled={saving}
                title={task.urgente ? 'Quitar urgencia' : 'Marcar como urgente'}
                className={`p-1 rounded hover:bg-white/5 transition-all text-[11px] ${task.urgente ? 'text-red-400 hover:text-red-300' : 'text-white/40 hover:text-red-400'}`}
              >
                🔥
              </button>
            )}

            {!concluida && (
              <button
                onClick={() => {
                  setEditingTaskId(task.id);
                  setEditingTaskDesc(task.descripcion);
                  setEditingTaskPrioridad(task.prioridad || 'media');
                  setEditingTaskFecha(toInputDate(task.fecha_limite));
                  setEditingTaskUrgente(task.urgente || false);
                }}
                disabled={saving}
                title="Editar descripción"
                className="text-white/35 hover:text-white/60 p-1 rounded hover:bg-white/5 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                </svg>
              </button>
            )}

            <button
              onClick={() => handleDeleteNode(`tar-${task.id}`)}
              disabled={saving}
              title="Eliminar tarea"
              className="text-white/35 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-all"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Input states for Entity Drawer loaders
  const [iaPromptInput, setIaPromptInput] = useState('');
  const [entityTaskDesc, setEntityTaskDesc] = useState('');
  const [entityTaskPrioridad, setEntityTaskPrioridad] = useState('media');
  const [entityTaskFecha, setEntityTaskFecha] = useState('');
  const [entityFinDesc, setEntityFinDesc] = useState('');
  const [entityFinMonto, setEntityFinMonto] = useState('');
  const [entityFinTipo, setEntityFinTipo] = useState('vencimiento_cliente');
  const [entityFinFecha, setEntityFinFecha] = useState('');
  const [entityFinRecurrente, setEntityFinRecurrente] = useState(false);
  const [entityFinFrecuencia, setEntityFinFrecuencia] = useState('MENSUAL');
  const [entityFinDiaVencimiento, setEntityFinDiaVencimiento] = useState<number | ''>('');
  const [entityFinMesVencimiento, setEntityFinMesVencimiento] = useState<number | ''>('');
  const [entityFinCuotaActual, setEntityFinCuotaActual] = useState<number | ''>('');
  const [entityFinCuotasTotal, setEntityFinCuotasTotal] = useState<number | ''>('');
  const [showCuotaLimite, setShowCuotaLimite] = useState(false);
  const [entityLinkUrl, setEntityLinkUrl] = useState('');
  const [entityLinkDesc, setEntityLinkDesc] = useState('');
  const [entityLinkCat, setEntityLinkCat] = useState('OTROS');
  const [entityLinkSearch, setEntityLinkSearch] = useState('');
  const [entityLinkEntidadId, setEntityLinkEntidadId] = useState<number | ''>('');
  const [projectEnlaces, setProjectEnlaces] = useState<any[]>([]);
  const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
  const [editingFinanzaId, setEditingFinanzaId] = useState<number | null>(null);
  const [finFormProyectoId, setFinFormProyectoId] = useState<number | ''>('');
  const [finFormIsDirect, setFinFormIsDirect] = useState(false);
  const [showProjectTaskForm, setShowProjectTaskForm] = useState(false);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Additional form states for Books and Quotes
  const [editAutor, setEditAutor] = useState('');
  const [editVecesLeido, setEditVecesLeido] = useState(0);
  const [editPdfUrl, setEditPdfUrl] = useState('');
  const [newCitaTexto, setNewCitaTexto] = useState('');
  const [newCitaPagina, setNewCitaPagina] = useState('');
  const [newCitaComentario, setNewCitaComentario] = useState('');

  // Global Creation form states
  const [crearAlerta, setCrearAlerta] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkDesc, setNewLinkDesc] = useState('');
  const [newLinkCat, setNewLinkCat] = useState('OTROS');
  const [selectedBookId, setSelectedBookId] = useState('0');
  const [globalIaPrompt, setGlobalIaPrompt] = useState('');
  const [showEntityForm, setShowEntityForm] = useState<'EMPRESA' | 'PERSONA' | null>(null);
  const [entityFormNombre, setEntityFormNombre] = useState('');
  const [showPeliculas, setShowPeliculas] = useState(true);
  const [showSeries, setShowSeries] = useState(true);

  // Obsidian settings states
  const [showSettings, setShowSettings] = useState(true); // default open so user sees it
  const [showEmpresas, setShowEmpresas] = useState(true);
  const [showPersonas, setShowPersonas] = useState(true);
  const [showServicios, setShowServicios] = useState(true);
  const [showFinanzas, setShowFinanzas] = useState(true);
  const [showTareas, setShowTareas] = useState(true);
  const [showMeses, setShowMeses] = useState(true);
  const [showLibros, setShowLibros] = useState(true);
  const [showCitas, setShowCitas] = useState(true);
  const [showProyectos, setShowProyectos] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [showHubFinanzas, setShowHubFinanzas] = useState(true);
  const [mostrarSoloDestacados, setMostrarSoloDestacados] = useState(false);

  // Hot project creation inline states
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectEstado, setNewProjectEstado] = useState('ACTIVO');
  const [newProjectFechaInicio, setNewProjectFechaInicio] = useState('');
  const [newProjectFechaFin, setNewProjectFechaFin] = useState('');
  const [newProjectNotas, setNewProjectNotas] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);

  const [showLabels, setShowLabels] = useState(true);
  const [labelSize, setLabelSize] = useState(11);
  const [ocultarYMostrarEnHover, setOcultarYMostrarEnHover] = useState(false);

  // D3 force simulation parameters
  const [repulsionStrength, setRepulsionStrength] = useState(-120);
  const [repulsionDistance, setRepulsionDistance] = useState(250);
  const [linkDistance, setLinkDistance] = useState(70);
  const [collisionRadius, setCollisionRadius] = useState(15);

  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 0, height: 0 });

  // Track canvas container size for explicit width/height on ForceGraph2D
  useEffect(() => {
    if (!graphContainerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setGraphDimensions({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    ro.observe(graphContainerRef.current);
    // Set initial size
    const rect = graphContainerRef.current.getBoundingClientRect();
    setGraphDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    return () => ro.disconnect();
  }, []);

  // Node drag handlers: pin fx/fy while dragging to avoid canvas pan
  const handleNodeDrag = useCallback((node: any) => {
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  const handleNodeDragEnd = useCallback((node: any) => {
    // Keep node pinned at dropped position
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  // ── Filtered data based on Obsidian control settings ──────────────
  const filteredData = useMemo<GraphData>(() => {
    if (!data) return { nodes: [], links: [] };

    const activeTypes = new Set<string>();
    if (showEmpresas) activeTypes.add('EMPRESA');
    if (showPersonas) activeTypes.add('PERSONA');
    if (showServicios) activeTypes.add('SERVICIO');
    if (showFinanzas) activeTypes.add('FINANZA');
    if (showTareas) activeTypes.add('TAREA');
    if (showMeses) activeTypes.add('MES');
    if (showLibros) activeTypes.add('LIBRO');
    if (showCitas) activeTypes.add('CITA');
    if (showPeliculas) activeTypes.add('PELICULA');
    if (showSeries) activeTypes.add('SERIE');
    if (showProyectos) activeTypes.add('PROYECTO');
    if (showLinks) activeTypes.add('LINKS');
    if (showHubFinanzas) activeTypes.add('HUB_FINANZAS');

    const nodes = data.nodes.filter((n) => activeTypes.has(n.type));
    const nodeIds = new Set(nodes.map((n) => n.id));

    const links = data.links.filter((l) => {
      const srcId = getNodeId(l.source);
      const tgtId = getNodeId(l.target);
      return nodeIds.has(srcId) && nodeIds.has(tgtId);
    });

    // Apply hubFinanzasDestacado to the HUB_FINANZAS node
    if (hubFinanzasDestacado) {
      const hub = nodes.find((n) => n.id === 'hub_finanzas');
      if (hub) hub.extra = { ...hub.extra, is_destacado: true };
    }

    // Filter: show only destacado nodes when toggle is on
    if (mostrarSoloDestacados) {
      const destacados = nodes.filter((n) => n.extra?.is_destacado === true);
      const destacadosIds = new Set(destacados.map((n) => n.id));
      return {
        nodes: destacados,
        links: links.filter((l) => {
          const srcId = getNodeId(l.source);
          const tgtId = getNodeId(l.target);
          return destacadosIds.has(srcId) && destacadosIds.has(tgtId);
        }),
      };
    }

    return { nodes, links };
  }, [data, showEmpresas, showPersonas, showServicios, showFinanzas, showTareas, showMeses, showLibros, showCitas, showPeliculas, showSeries, showProyectos, showLinks, showHubFinanzas, hubFinanzasDestacado, mostrarSoloDestacados]);

  // ── Fetch / Refresh graph data ────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/grafo');
      if (!res.ok) throw new Error('Error al cargar datos del grafo');
      const json = await res.json();
      setData(json);
      return json;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/grafo/categorias');
      if (res.ok) {
        const data = await res.json();
        setDynamicCategories(data.filter((c: string) => !FIXED_CATEGORIES.includes(c)));
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  useEffect(() => { fetchData(); fetchCategories(); }, [fetchData, fetchCategories]);

  // Load projects list and set default to "Urgentes Tareas" when entering create TAREA mode
  useEffect(() => {
    if (drawerMode === 'create' && createType === 'TAREA') {
      fetch('/api/grafo/proyectos')
        .then(r => r.json())
        .then(projects => {
          setAllProjects(projects);
          const urgentes = projects.find((p: any) => p.nombre === 'Urgentes Tareas');
          setCreateProyectoId(urgentes ? urgentes.id : (projects[0]?.id || ''));
        })
        .catch(() => {});
    }
  }, [drawerMode, createType]);

  // Effect to load detailed entity data
  useEffect(() => {
    if (drawerNode && ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(drawerNode.type)) {
      const numericId = dbId(drawerNode.id);
      setLoadingDetails(true);
      Promise.all([
        fetch(`/api/grafo/entidad?id=${numericId}`).then((r) => r.json()),
        fetch('/api/grafo/proyectos').then((r) => r.json()),
      ])
        .then(([detailData, projectsData]) => {
          setEntidadDetails(detailData);
          setAllProjects(projectsData);
          setLoadingDetails(false);
          if (detailData && detailData.proyectos && detailData.proyectos.length > 0) {
            setNewTaskProjectId(detailData.proyectos[0].id);
          } else if (projectsData && projectsData.length > 0) {
            setNewTaskProjectId(projectsData[0].id);
          } else {
            setNewTaskProjectId('');
          }
        })
        .catch((err) => {
          console.error('Error loading entity details:', err);
          setLoadingDetails(false);
        });
    } else if (drawerNode && drawerNode.type === 'PROYECTO') {
      const numericId = dbId(drawerNode.id);
      setEntityLinkUrl('');
      setEntityLinkDesc('');
      setEntityLinkCat('OTROS');
      setEntityLinkSearch('');
      fetch(`/api/grafo/enlaces?proyecto_id=${numericId}`)
        .then((r) => r.json())
        .then((data) => {
          setProjectEnlaces(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          console.error('Error loading project enlaces:', err);
          setProjectEnlaces([]);
        });
    } else {
      setEntidadDetails(null);
      setProjectEnlaces([]);
      setNewTaskProjectId('');
    }
  }, [drawerNode]);

  // ── Configure D3 forces on graph mount (Obsidian repulsion) ───────
  useEffect(() => {
    if (!graphRef.current || !filteredData) return;
    const fg = graphRef.current;
    try {
      const charge = fg.d3Force('charge');
      if (charge) {
        charge.strength(repulsionStrength).distanceMax(repulsionDistance);
      }
      const link = fg.d3Force('link');
      if (link) {
        link.distance(linkDistance);
      }
      const collide = fg.d3Force('collide');
      if (collide) {
        collide.radius(collisionRadius);
      } else {
        fg.d3Force('collide', forceCollide().radius(collisionRadius));
      }
      fg.d3ReheatSimulation();
    } catch { /* d3Force may not yet be ready */ }
  }, [filteredData, repulsionStrength, repulsionDistance, linkDistance, collisionRadius]);

  // ── Search highlighting ───────────────────────────────────────────
  useEffect(() => {
    if (!filteredData || !searchQuery.trim()) {
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }
    const q = searchQuery.toLowerCase();
    const matchedNodeIds = new Set<string>();
    const matchedLinks = new Set<string>();

    filteredData.nodes.forEach((n) => {
      if (
        n.name.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        n.alias?.some((a) => a.toLowerCase().includes(q))
      ) {
        matchedNodeIds.add(n.id);
      }
    });

    filteredData.links.forEach((l) => {
      const srcId = getNodeId(l.source);
      const tgtId = getNodeId(l.target);
      if (matchedNodeIds.has(srcId) || matchedNodeIds.has(tgtId)) {
        matchedLinks.add(`${srcId}-${tgtId}`);
      }
    });

    setHighlightNodes(matchedNodeIds);
    setHighlightLinks(matchedLinks);
  }, [searchQuery, filteredData]);

  // ── Fullscreen ────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Zoom controls ─────────────────────────────────────────────────
  const handleZoomIn = () => graphRef.current?.zoom(graphRef.current.zoom() * 1.4, 400);
  const handleZoomOut = () => graphRef.current?.zoom(graphRef.current.zoom() * 0.7, 400);
  const handleReset = () => graphRef.current?.zoomToFit(600, 80);

  // ── Populate edit form from a node ────────────────────────────────
  const populateEditForm = useCallback((node: GraphNode) => {
    setEditDesc(node.name || '');
    setEditMonto(String(node.extra?.monto ?? ''));
    setEditTipo(node.extra?.tipo ?? '');
    setEditEstado(node.extra?.estado_pago ?? node.extra?.estado ?? node.extra?.estado_lectura ?? '');
    setEditPrioridad(node.extra?.prioridad ?? 'media');
    setEditFecha(toInputDate(node.extra?.fecha_vencimiento ?? node.extra?.fecha_limite));
    setEditUrgente(node.extra?.urgente ?? false);

    // Libros & Proyectos
    setEditAutor(node.extra?.autor ?? '');
    setEditVecesLeido(node.extra?.veces_leido ?? 0);
    setEditPdfUrl(node.extra?.url_pdf ?? node.extra?.descripcion ?? '');
    setEditFechaInicio(toInputDate(node.extra?.fecha_inicio));
    setEditFechaFin(toInputDate(node.extra?.fecha_fin));
    setEditNotas(node.extra?.notas || '');
    // Entity parent id from loaded details
    setEditEntityPadreId(entidadDetails?.entidad_padre_id ?? '');
    setEditIsDestacado(node.extra?.is_destacado ?? (node.id === 'hub_finanzas' ? hubFinanzasDestacado : false));
    setEditEntityOrigenId(node.extra?.entidad_origen_id ?? '');
  }, [entidadDetails, hubFinanzasDestacado]);

  // ── Reset create form ─────────────────────────────────────────────
  const resetCreateForm = useCallback(() => {
    setEditDesc('');
    setEditMonto('');
    setEditTipo('vencimiento_cliente');
    setEditEstado('PENDIENTE');
    setEditPrioridad('media');
    setEditFecha('');
    setEditUrgente(false);
    setEditIsDestacado(false);

    setEditAutor('');
    setEditVecesLeido(0);
    setEditPdfUrl('');
    setNewCitaTexto('');
    setNewCitaPagina('');
    setNewCitaComentario('');
    setSelectedEntidadId('0');
    setEditFechaInicio('');
    setEditFechaFin('');
    setEditNotas('');
    setEditEntityOrigenId('');
    setCreateProyectoId('');
  }, []);

  // ── Node click from secondary panel list (maintains hub/project context) ──
  const handleSelectSecondaryItem = useCallback((itemNode: GraphNode) => {
    const parentToKeep = hubContextNode || (
      drawerNode && (
        drawerNode.type === 'HUB_TAREAS' ||
        drawerNode.type === 'HUB_FINANZAS' ||
        drawerNode.type === 'LINKS' ||
        drawerNode.type === 'PROYECTO' ||
        drawerNode.id?.includes('hub')
      ) ? drawerNode : null
    );

    if (parentToKeep && parentToKeep.id !== itemNode.id) {
      setHubContextNode(parentToKeep);
    } else if (parentToKeep && parentToKeep.id === itemNode.id) {
      setHubContextNode(null);
    }

    setSelectedNode(itemNode);
    setDrawerNode(itemNode);
    setDrawerMode('view');

    if (itemNode.x !== undefined && itemNode.y !== undefined) {
      graphRef.current?.centerAt(itemNode.x, itemNode.y, 800);
      graphRef.current?.zoom(3.5, 800);
    }
  }, [drawerNode, hubContextNode]);

  // ── Node click from canvas (opens full dual-panel drawer: Vínculos + Detalle) ──
  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    if (node && node.x !== undefined && node.y !== undefined) {
      graphRef.current?.centerAt(node.x, node.y, 800);
      graphRef.current?.zoom(3.5, 800);
    }

    if (node) {
      setHubContextNode(null);
      setDrawerNode(node);
      setDrawerMode('view');
      // Always open the full dual-panel view on node click
      setDrawerOpen(true);
      setShowSecondaryPanel(true);
      setSecondaryFilter('ALL');
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerMode('view');
    setSelectedNode(null);
    setTimeout(() => setDrawerNode(null), 350);
  }, []);

  // ── Save edits (PATCH) ────────────────────────────────────────────
  const handleSaveEdit = useCallback(async () => {
    if (!drawerNode) return;
    setSaving(true);

    try {
      // HUB_FINANZAS: synthetic node, save to localStorage only
      if (drawerNode.id === 'hub_finanzas') {
        setHubFinanzasDestacado(editIsDestacado);
        localStorage.setItem('hubFinanzasDestacado', String(editIsDestacado));
        setDrawerMode('view');
        setSaving(false);
        return;
      }

      const numericId = dbId(drawerNode.id);

      if (drawerNode.type === 'FINANZA') {
        await fetch('/api/grafo/finanzas', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: numericId,
            descripcion: editDesc,
            monto: Number(editMonto),
            tipo: editTipo,
            estado_pago: editEstado,
            fecha_vencimiento: editFecha || null,
            ...(editEntityOrigenId !== '' ? { entidad_origen_id: editEntityOrigenId } : {}),
          }),
        });
      } else if (drawerNode.type === 'TAREA') {
        await fetch('/api/grafo/tareas', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: numericId,
            descripcion: editDesc,
            estado: editEstado,
            prioridad: editPrioridad,
            fecha_limite: editFecha || null,
            urgente: editUrgente,
            notas: editNotas || null,
          }),
        });
      } else if (drawerNode.type === 'LIBRO') {
        await fetch('/api/grafo/libros', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: numericId,
            titulo: editDesc,
            autor: editAutor,
            estado_lectura: editEstado,
            veces_leido: Number(editVecesLeido),
            url_pdf: editPdfUrl,
          }),
        });
      } else if (drawerNode.type === 'PROYECTO') {
        await fetch('/api/grafo/proyectos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: numericId,
            nombre: editDesc,
            descripcion: editPdfUrl || null,
            estado: editEstado || 'ACTIVO',
            fecha_inicio: editFechaInicio || null,
            fecha_fin: editFechaFin || null,
            notas: editNotas || null,
            is_destacado: editIsDestacado,
          }),
        });
      } else if (['EMPRESA', 'PERSONA', 'SERVICIO'].includes(drawerNode.type)) {
        await fetch('/api/grafo/entidad', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: numericId,
            nombre: editDesc,
            entidad_padre_id: editEntityPadreId || null,
            is_destacado: editIsDestacado,
          }),
        });
      }

      const freshJson = await fetchData();
      if (freshJson && freshJson.nodes) {
        const updatedNode = freshJson.nodes.find((n: any) => n.id === drawerNode.id);
        if (updatedNode) setDrawerNode(updatedNode);
      }
      setDrawerMode('view');
    } catch (err) {
      console.error('Error guardando:', err);
    } finally {
      setSaving(false);
    }
  }, [drawerNode, editDesc, editMonto, editTipo, editEstado, editPrioridad, editFecha, editAutor, editVecesLeido, editPdfUrl, editFechaInicio, editFechaFin, editNotas, editUrgente, editEntityPadreId, editIsDestacado, setHubFinanzasDestacado, fetchData]);

  // ── Inline finance status change (hot-swap) ────────────────────────
  const handleFinanceStatusChange = useCallback(async (newStatus: string) => {
    if (!drawerNode || drawerNode.type !== 'FINANZA') return;
    const numericId = dbId(drawerNode.id);
    const prevStatus = drawerNode.extra?.estado_pago;
    // Optimistic local update
    setDrawerNode({
      ...drawerNode,
      extra: { ...drawerNode.extra, estado_pago: newStatus },
    });
    try {
      const res = await fetch('/api/grafo/finanzas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: numericId, estado_pago: newStatus }),
      });
      if (res.ok) {
        const freshJson = await fetchData();
        if (freshJson?.nodes) {
          const updatedNode = freshJson.nodes.find((n: any) => n.id === drawerNode.id);
          if (updatedNode) setDrawerNode(updatedNode);
        }
      } else {
        setDrawerNode({
          ...drawerNode,
          extra: { ...drawerNode.extra, estado_pago: prevStatus },
        });
      }
    } catch (err) {
      console.error('Error updating finance status:', err);
      setDrawerNode({
        ...drawerNode,
        extra: { ...drawerNode.extra, estado_pago: prevStatus },
      });
    }
  }, [drawerNode, fetchData]);

  // ── Inline task status change (hot-swap) ────────────────────────────
  const handleTaskStatusChange = useCallback(async (newStatus: string) => {
    if (!drawerNode || drawerNode.type !== 'TAREA') return;
    const numericId = dbId(drawerNode.id);
    const prevStatus = drawerNode.extra?.estado;
    setDrawerNode({
      ...drawerNode,
      extra: { ...drawerNode.extra, estado: newStatus },
    });
    try {
      const res = await fetch('/api/grafo/tareas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: numericId, estado: newStatus }),
      });
      if (res.ok) {
        const freshJson = await fetchData();
        if (freshJson?.nodes) {
          const updatedNode = freshJson.nodes.find((n: any) => n.id === drawerNode.id);
          if (updatedNode) setDrawerNode(updatedNode);
        }
      } else {
        setDrawerNode({
          ...drawerNode,
          extra: { ...drawerNode.extra, estado: prevStatus },
        });
      }
    } catch (err) {
      console.error('Error updating task status:', err);
      setDrawerNode({
        ...drawerNode,
        extra: { ...drawerNode.extra, estado: prevStatus },
      });
    }
  }, [drawerNode, fetchData]);

  // ── Create new record (POST) ──────────────────────────────────────
  const handleCreate = useCallback(async () => {
    setSaving(true);
    try {
      // Try to find a proyecto_id from any connected finanza/tarea in the MES node
      let proyectoId: number | null = null;
      if (drawerNode && data) {
        const connected = data.links
          .filter(l => {
            const tgtId = getNodeId(l.target);
            return tgtId === drawerNode.id;
          })
          .map(l => {
            const srcId = getNodeId(l.source);
            return data.nodes.find(n => n.id === srcId);
          })
          .filter(Boolean);
        const withProject = connected.find(n => n?.extra?.proyecto_id);
        if (withProject?.extra?.proyecto_id) {
          proyectoId = withProject.extra.proyecto_id;
        }
      }

      // Override with explicit project picker in create mode
      if (createType === 'TAREA' && createProyectoId) {
        proyectoId = Number(createProyectoId);
      }

      if (createType === 'FINANZA') {
        await fetch('/api/grafo/finanzas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descripcion: editDesc,
            monto: Number(editMonto),
            tipo: editTipo || 'vencimiento_cliente',
            estado_pago: (editEstado || 'PENDIENTE').toUpperCase(),
            fecha_vencimiento: editFecha || null,
            ...(editEntityOrigenId !== '' ? { entidad_origen_id: editEntityOrigenId } : {}),
            proyecto_id: proyectoId,
            crear_alerta: crearAlerta,
          }),
        });
      } else if (createType === 'TAREA') {
        await fetch('/api/grafo/tareas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descripcion: editDesc,
            estado: editEstado || 'PENDIENTE',
            prioridad: editPrioridad || 'media',
            fecha_limite: editFecha || null,
            proyecto_id: proyectoId,
            urgente: editUrgente,
          }),
        });
      } else if (createType === 'LIBRO' || createType === 'PELICULA' || createType === 'SERIE') {
        let defaultDate = new Date();
        if (drawerNode && drawerNode.type === 'MES') {
          const parts = drawerNode.id.split('-');
          if (parts.length >= 3) {
            defaultDate = new Date(Number(parts[1]), Number(parts[2]) - 1, 15);
          }
        }
        await fetch('/api/grafo/libros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo: editDesc,
            autor: editAutor,
            estado_lectura: editEstado || 'PENDIENTE',
            veces_leido: Number(editVecesLeido),
            url_pdf: editPdfUrl,
            fecha: defaultDate.toISOString(),
            tipo_media: createType,
          }),
        });
      } else if (createType === 'LINK') {
        await fetch('/api/grafo/enlaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: newLinkUrl,
            descripcion: newLinkDesc,
            categoria: newLinkCat || 'OTROS',
            proyecto_id: proyectoId,
          }),
        });
        setNewLinkUrl('');
        setNewLinkDesc('');
      } else if (createType === 'CITA') {
        let bookId = Number(selectedBookId);
        if (bookId === 0) {
          const existingBookNode = data?.nodes.find(n => n.type === 'LIBRO' && n.name === 'Notas Libres');
          if (existingBookNode) {
            bookId = dbId(existingBookNode.id);
          } else {
            const createBookRes = await fetch('/api/grafo/libros', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                titulo: 'Notas Libres',
                autor: 'Segundo Cerebro',
                estado_lectura: 'LEIDO',
                tipo_media: 'LIBRO',
              }),
            });
            const bookJson = await createBookRes.json();
            bookId = bookJson.id;
          }
        }

        await fetch('/api/grafo/citas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            libro_id: bookId,
            texto: newCitaTexto,
            pagina: newCitaPagina ? Number(newCitaPagina) : null,
            comentario: newCitaComentario || null,
          }),
        });
        setNewCitaTexto('');
        setNewCitaPagina('');
        setNewCitaComentario('');
      } else if (createType === 'PROYECTO') {
        const entId = Number(selectedEntidadId);
        const res = await fetch('/api/grafo/proyectos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: editDesc,
            descripcion: editPdfUrl || null,
            estado: editEstado || 'ACTIVO',
            entidad_id: entId > 0 ? entId : null,
            fecha_inicio: editFechaInicio || null,
            fecha_fin: editFechaFin || null,
            notas: editNotas || null,
          }),
        });
        if (res.ok && drawerNode && ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(drawerNode.type) && dbId(drawerNode.id) === entId) {
          const detailRes = await fetch(`/api/grafo/entidad?id=${entId}`);
          const detailData = await detailRes.json();
          setEntidadDetails(detailData);
        }
      }

      await fetchData();
      if (drawerNode?.id === 'global-create') {
        closeDrawer();
      } else {
        setDrawerMode('view');
      }
    } catch (err) {
      console.error('Error creando:', err);
    } finally {
      setSaving(false);
    }
  }, [
    drawerNode,
    data,
    createType,
    editDesc,
    editMonto,
    editTipo,
    editEstado,
    editPrioridad,
    editFecha,
    editAutor,
    editVecesLeido,
    editPdfUrl,
    crearAlerta,
    newLinkUrl,
    newLinkDesc,
    newLinkCat,
    selectedBookId,
    newCitaTexto,
    newCitaPagina,
    newCitaComentario,
    selectedEntidadId,
    editFechaInicio,
    editFechaFin,
    editNotas,
    editUrgente,
    createProyectoId,
    fetchData,
    closeDrawer,
  ]);

  // ── Create new Quote (POST) ───────────────────────────────────────
  const handleCreateCita = useCallback(async () => {
    if (!drawerNode || !newCitaTexto.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/grafo/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libro_id: dbId(drawerNode.id),
          texto: newCitaTexto,
          pagina: newCitaPagina ? Number(newCitaPagina) : null,
          comentario: newCitaComentario || null,
        }),
      });

      if (res.ok) {
        setNewCitaTexto('');
        setNewCitaPagina('');
        setNewCitaComentario('');

        const freshJson = await fetchData();
        if (freshJson && freshJson.nodes) {
          const updatedNode = freshJson.nodes.find((n: any) => n.id === drawerNode.id);
          if (updatedNode) setDrawerNode(updatedNode);
        }
      }
    } catch (err) {
      console.error('Error creando cita:', err);
    } finally {
      setSaving(false);
    }
  }, [drawerNode, newCitaTexto, newCitaPagina, newCitaComentario, fetchData]);

  const handleDeleteNode = useCallback(async (nodeId: string) => {
    if (!window.confirm("¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/grafo/eliminar?id=${nodeId}`, { method: 'DELETE' });
      if (res.ok) {
        const wasViewingDeletedNode = drawerNode && drawerNode.id === nodeId;
        if (wasViewingDeletedNode) {
          closeDrawer();
        }
        
        await fetchData();

        if (!wasViewingDeletedNode && drawerNode && ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(drawerNode.type)) {
          const numericId = dbId(drawerNode.id);
          const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
          const detailData = await detailRes.json();
          setEntidadDetails(detailData);
        }
      } else {
        const errJson = await res.json();
        alert(`Error al eliminar: ${errJson.error}`);
      }
    } catch (err) {
      console.error('Error eliminando nodo:', err);
    } finally {
      setSaving(false);
    }
  }, [closeDrawer, drawerNode, fetchData]);

  const focusNodeById = (nodeId: string) => {
    if (!data) return;
    const node = data.nodes.find((n) => n.id === nodeId);
    if (node) {
      if (node.type === 'PROYECTO' && !showProyectos) {
        setShowProyectos(true);
      }
      setTimeout(() => {
        if (node.x !== undefined && node.y !== undefined) {
          graphRef.current?.centerAt(node.x, node.y, 800);
          graphRef.current?.zoom(3.5, 800);
          setSelectedNode(node);
        }
      }, 50);
    }
  };

  const handleAddEntityProject = async () => {
    if (!newProjectName.trim() || !drawerNode) return;
    setSaving(true);
    try {
      const res = await fetch('/api/grafo/proyectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newProjectName,
          descripcion: newProjectDesc || null,
          estado: newProjectEstado || 'ACTIVO',
          entidad_id: dbId(drawerNode.id),
          fecha_inicio: newProjectFechaInicio || null,
          fecha_fin: newProjectFechaFin || null,
          notas: newProjectNotas || null,
        })
      });
      if (res.ok) {
        setNewProjectName('');
        setNewProjectDesc('');
        setNewProjectEstado('ACTIVO');
        setNewProjectFechaInicio('');
        setNewProjectFechaFin('');
        setNewProjectNotas('');
        setShowNewProjectForm(false);
        await fetchData();
        
        const numericId = dbId(drawerNode.id);
        const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
        const detailData = await detailRes.json();
        setEntidadDetails(detailData);
      } else {
        const errJson = await res.json();
        alert(`Error al crear proyecto: ${errJson.error}`);
      }
    } catch (err) {
      console.error('Error adding project:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddEntityTask = async () => {
    if (!newTaskDesc.trim() || !newTaskProjectId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/grafo/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: newTaskDesc,
          prioridad: newTaskPrioridad,
          fecha_limite: newTaskFecha || null,
          estado: newTaskEstado,
          proyecto_id: Number(newTaskProjectId),
          urgente: newTaskUrgente,
        })
      });
      if (res.ok) {
        setNewTaskDesc('');
        setNewTaskFecha('');
        setNewTaskPrioridad('media');
        setNewTaskEstado('PENDIENTE');
        setNewTaskUrgente(false);
        setShowNewTaskForm(false);
        await fetchData();
        const numericId = dbId(drawerNode!.id);
        const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
        const detailData = await detailRes.json();
        setEntidadDetails(detailData);
      }
    } catch (err) {
      console.error('Error adding task:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddEntityFinance = async (projectId: number) => {
    if (!entityFinDesc.trim() || !entityFinMonto) return;
    setSaving(true);
    try {
      const res = await fetch('/api/grafo/finanzas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
          descripcion: entityFinDesc,
          monto: Number(entityFinMonto),
          tipo: entityFinTipo,
          fecha_vencimiento: entityFinFecha || null,
          proyecto_id: projectId,
          recurrente: entityFinRecurrente,
          frecuencia: entityFinFrecuencia,
          dia_vencimiento: entityFinDiaVencimiento || null,
          mes_vencimiento: entityFinMesVencimiento || null,
          cuota_actual: showCuotaLimite ? (entityFinCuotaActual || 1) : null,
          cuotas_total: showCuotaLimite ? (entityFinCuotasTotal || null) : null,
          ...(entityFinOrigenId !== '' ? { entidad_origen_id: entityFinOrigenId } : {}),
        })
      });
      if (res.ok) {
        setEntityFinDesc('');
        setEntityFinMonto('');
        setEntityFinFecha('');
        setEntityFinRecurrente(false);
        setEntityFinFrecuencia('MENSUAL');
        setEntityFinDiaVencimiento('');
        setEntityFinMesVencimiento('');
        setEntityFinCuotaActual('');
        setEntityFinCuotasTotal('');
        setShowCuotaLimite(false);
        await fetchData();
        const numericId = dbId(drawerNode!.id);
        const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
        const detailData = await detailRes.json();
        setEntidadDetails(detailData);
      }
    } catch (err) {
      console.error('Error adding finance:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddEntityLink = async (projectId: number) => {
    if (!entityLinkUrl.trim() || !entityLinkDesc.trim()) return;
    setSaving(true);
    try {
      if (editingLinkId) {
        await fetch('/api/grafo/enlaces', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingLinkId,
            url: entityLinkUrl,
            descripcion: entityLinkDesc,
            categoria: entityLinkCat,
          }),
        });
      } else {
        await fetch('/api/grafo/enlaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: entityLinkUrl,
            descripcion: entityLinkDesc,
            categoria: entityLinkCat,
            proyecto_id: projectId,
            entidad_id: entityLinkEntidadId || null,
          }),
        });
      }
      setEntityLinkUrl('');
      setEntityLinkDesc('');
      setEntityLinkCat('OTROS');
      setEntityLinkEntidadId('');
      setEditingLinkId(null);
      await fetchData();
      await fetchCategories();
      const numericId = dbId(drawerNode!.id);
      const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
      const detailData = await detailRes.json();
      setEntidadDetails(detailData);
    } catch (err) {
      console.error('Error saving link:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddProjectTask = async () => {
    if (!entityTaskDesc.trim() || !drawerNode || drawerNode.type !== 'PROYECTO') return;
    setSaving(true);
    try {
      const projectId = dbId(drawerNode.id);
      await fetch('/api/grafo/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: entityTaskDesc,
          prioridad: entityTaskPrioridad,
          fecha_limite: entityTaskFecha || null,
          estado: 'PENDIENTE',
          proyecto_id: projectId,
          urgente: false,
        }),
      });
      setEntityTaskDesc('');
      setEntityTaskPrioridad('media');
      setEntityTaskFecha('');
      setShowProjectTaskForm(false);
      await fetchData();
    } catch (err) {
      console.error('Error adding project task:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInlineTask = async () => {
    if (!inlineTaskDesc.trim() || !drawerNode || drawerNode.type !== 'PROYECTO') return;
    setSaving(true);
    try {
      const projectId = dbId(drawerNode.id);
      const res = await fetch('/api/grafo/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: inlineTaskDesc,
          prioridad: inlineTaskPrioridad,
          fecha_limite: inlineTaskFecha || null,
          estado: 'PENDIENTE',
          proyecto_id: projectId,
          urgente: inlineTaskUrgente,
        }),
      });
      if (res.ok) {
        setInlineTaskDesc('');
        setInlineTaskPrioridad('media');
        setInlineTaskFecha('');
        setInlineTaskUrgente(false);
        setShowInlineTaskForm(false);
        await fetchData();
      }
    } catch (err) {
      console.error('Error creating inline task:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddProjectFinance = async () => {
    if (!entityFinDesc.trim() || !entityFinMonto || !drawerNode || drawerNode.type !== 'PROYECTO') return;
    setSaving(true);
    try {
      const projectId = finFormProyectoId || dbId(drawerNode.id);
      await fetch('/api/grafo/finanzas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: entityFinDesc,
          monto: Number(entityFinMonto),
          tipo: entityFinTipo,
          fecha_vencimiento: entityFinFecha || null,
          proyecto_id: projectId,
          recurrente: entityFinRecurrente,
          frecuencia: entityFinFrecuencia,
          dia_vencimiento: entityFinDiaVencimiento || null,
          mes_vencimiento: entityFinMesVencimiento || null,
          cuota_actual: showCuotaLimite ? (entityFinCuotaActual || 1) : null,
          cuotas_total: showCuotaLimite ? (entityFinCuotasTotal || null) : null,
          ...(entityFinOrigenId !== '' ? { entidad_origen_id: entityFinOrigenId } : {}),
        }),
      });
      setEntityFinDesc('');
      setEntityFinMonto('');
      setEntityFinFecha('');
      setEntityFinTipo('vencimiento_cliente');
      setEntityFinRecurrente(false);
      setEntityFinFrecuencia('MENSUAL');
      setEntityFinDiaVencimiento('');
      setEntityFinMesVencimiento('');
      setEntityFinCuotaActual('');
      setEntityFinCuotasTotal('');
      setShowCuotaLimite(false);
      setFinFormProyectoId('');
      await fetchData();
    } catch (err) {
      console.error('Error adding project finance:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddDirectEntityFinance = async () => {
    if (!entityFinDesc.trim() || !entityFinMonto || !drawerNode || !['EMPRESA', 'PERSONA', 'SERVICIO'].includes(drawerNode.type)) return;
    setSaving(true);
    try {
      const entityId = dbId(drawerNode.id);
      await fetch('/api/grafo/finanzas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion: entityFinDesc,
          monto: Number(entityFinMonto),
          tipo: entityFinTipo,
          fecha_vencimiento: entityFinFecha || null,
          entidad_id: entityId,
          recurrente: entityFinRecurrente,
          frecuencia: entityFinFrecuencia,
          dia_vencimiento: entityFinDiaVencimiento || null,
          mes_vencimiento: entityFinMesVencimiento || null,
          cuota_actual: showCuotaLimite ? (entityFinCuotaActual || 1) : null,
          cuotas_total: showCuotaLimite ? (entityFinCuotasTotal || null) : null,
          ...(entityFinOrigenId !== '' ? { entidad_origen_id: entityFinOrigenId } : {}),
        }),
      });
      setEntityFinDesc('');
      setEntityFinMonto('');
      setEntityFinFecha('');
      setEntityFinTipo('vencimiento_cliente');
      setEntityFinRecurrente(false);
      setEntityFinFrecuencia('MENSUAL');
      setEntityFinDiaVencimiento('');
      setEntityFinMesVencimiento('');
      setEntityFinCuotaActual('');
      setEntityFinCuotasTotal('');
      setShowCuotaLimite(false);
      await fetchData();
      const numericId = dbId(drawerNode.id);
      const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
      const detailData = await detailRes.json();
      setEntidadDetails(detailData);
    } catch (err) {
      console.error('Error adding direct entity finance:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntityLink = async (linkId: number) => {
    if (!drawerNode) return;
    setSaving(true);
    try {
      await fetch(`/api/grafo/enlaces?id=${linkId}`, { method: 'DELETE' });
      await fetchData();
      await fetchCategories();
      const numericId = dbId(drawerNode.id);
      const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
      const detailData = await detailRes.json();
      setEntidadDetails(detailData);
    } catch (err) {
      console.error('Error deleting link:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditFinanza = (fin: any) => {
    const data = fin.extra || fin;
    setEntityFinDesc(fin.name || data.descripcion || '');
    setEntityFinMonto(String(Number(data.monto || fin.monto) || 0));
    setEntityFinTipo(data.tipo || 'egreso');
    setEntityFinFecha(data.fecha_vencimiento ? new Date(data.fecha_vencimiento).toISOString().split('T')[0] : '');
    setEntityFinRecurrente(!!data.recurrente);
    setEntityFinFrecuencia(data.frecuencia || 'MENSUAL');
    setEntityFinDiaVencimiento(data.dia_vencimiento || '');
    setEntityFinMesVencimiento(data.mes_vencimiento || '');
    setEntityFinCuotaActual(data.cuota_actual || '');
    setEntityFinCuotasTotal(data.cuotas_total || '');
    setShowCuotaLimite(!!data.cuotas_total);
    setEntityFinOrigenId(data.entidad_origen_id || '');
    setEditingFinanzaId(fin.id ? Number(fin.id.toString().replace('fin-', '')) : fin.id);
  };

  const handleCancelEditFinanza = () => {
    setEntityFinDesc('');
    setEntityFinMonto('');
    setEntityFinTipo('vencimiento_cliente');
    setEntityFinFecha('');
    setEntityFinRecurrente(false);
    setEntityFinFrecuencia('MENSUAL');
    setEntityFinDiaVencimiento('');
    setEntityFinMesVencimiento('');
    setEntityFinCuotaActual('');
    setEntityFinCuotasTotal('');
    setShowCuotaLimite(false);
    setEntityFinOrigenId('');
    setEditingFinanzaId(null);
  };

  const handleSaveEditFinanza = async () => {
    if (!editingFinanzaId || !entityFinDesc.trim() || !entityFinMonto) return;
    setSaving(true);
    try {
      await fetch('/api/grafo/finanzas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingFinanzaId,
          descripcion: entityFinDesc,
          monto: Number(entityFinMonto),
          tipo: entityFinTipo,
          fecha_vencimiento: entityFinFecha || null,
          recurrente: entityFinRecurrente,
          frecuencia: entityFinFrecuencia,
          dia_vencimiento: entityFinDiaVencimiento || null,
          mes_vencimiento: entityFinMesVencimiento || null,
          ...(entityFinOrigenId !== '' ? { entidad_origen_id: entityFinOrigenId } : {}),
        }),
      });
      handleCancelEditFinanza();
      await fetchData();
    } catch (err) {
      console.error('Error saving finanza edit:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddProjectLink = async () => {
    if (!entityLinkUrl.trim() || !entityLinkDesc.trim() || !drawerNode) return;
    setSaving(true);
    try {
      const numericId = dbId(drawerNode.id);
      if (editingLinkId) {
        await fetch('/api/grafo/enlaces', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingLinkId,
            url: entityLinkUrl,
            descripcion: entityLinkDesc,
            categoria: entityLinkCat,
          }),
        });
      } else {
        await fetch('/api/grafo/enlaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: entityLinkUrl,
            descripcion: entityLinkDesc,
            categoria: entityLinkCat,
            proyecto_id: numericId,
            entidad_id: entityLinkEntidadId || null,
          }),
        });
      }
      setEntityLinkUrl('');
      setEntityLinkDesc('');
      setEntityLinkCat('OTROS');
      setEntityLinkEntidadId('');
      setEditingLinkId(null);
      const enlacesRes = await fetch(`/api/grafo/enlaces?proyecto_id=${numericId}`);
      const enlacesData = await enlacesRes.json();
      setProjectEnlaces(Array.isArray(enlacesData) ? enlacesData : []);
      await fetchData();
      await fetchCategories();
    } catch (err) {
      console.error('Error saving project link:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProjectLink = async (linkId: number) => {
    if (!drawerNode) return;
    setSaving(true);
    try {
      await fetch(`/api/grafo/enlaces?id=${linkId}`, { method: 'DELETE' });
      const numericId = dbId(drawerNode.id);
      const enlacesRes = await fetch(`/api/grafo/enlaces?proyecto_id=${numericId}`);
      const enlacesData = await enlacesRes.json();
      setProjectEnlaces(Array.isArray(enlacesData) ? enlacesData : []);
      await fetchData();
      await fetchCategories();
    } catch (err) {
      console.error('Error deleting project link:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditLink = (link: any) => {
    setEntityLinkUrl(link.url || '');
    setEntityLinkDesc(link.descripcion || '');
    setEntityLinkCat(link.categoria || 'OTROS');
    setEditingLinkId(link.id);
  };

  const handleCancelEditLink = () => {
    setEntityLinkUrl('');
    setEntityLinkDesc('');
    setEntityLinkCat('OTROS');
    setEntityLinkEntidadId('');
    setEditingLinkId(null);
  };

  const handleSaveLinkEdit = async () => {
    if (!editingLinkId || !entityLinkUrl.trim() || !entityLinkDesc.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/grafo/enlaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingLinkId,
          url: entityLinkUrl,
          descripcion: entityLinkDesc,
          categoria: entityLinkCat,
        }),
      });
      setEntityLinkUrl('');
      setEntityLinkDesc('');
      setEntityLinkCat('OTROS');
      setEntityLinkEntidadId('');
      setEditingLinkId(null);
      const numericId = drawerNode && drawerNode.type === 'PROYECTO' ? dbId(drawerNode.id) : null;
      if (numericId) {
        const enlacesRes = await fetch(`/api/grafo/enlaces?proyecto_id=${numericId}`);
        const enlacesData = await enlacesRes.json();
        setProjectEnlaces(Array.isArray(enlacesData) ? enlacesData : []);
      }
      await fetchData();
      await fetchCategories();
      if (drawerNode && ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(drawerNode.type)) {
        const detailRes = await fetch(`/api/grafo/entidad?id=${dbId(drawerNode.id)}`);
        const detailData = await detailRes.json();
        setEntidadDetails(detailData);
      }
    } catch (err) {
      console.error('Error saving link edit:', err);
    } finally {
      setSaving(false);
    }
  };

  // Update handleAddEntityLink to support PATCH when editingLinkId is set
  // This is done below by reassigning the function reference

  const allCategories = useMemo(
    () => [...FIXED_CATEGORIES, ...dynamicCategories.filter((c) => !FIXED_CATEGORIES.includes(c))],
    [dynamicCategories]
  );

  const handleConfirmNewCategory = async () => {
    const name = newCategoryInput.trim();
    if (!name) return;
    if (!allCategories.includes(name)) {
      setDynamicCategories((prev) => [...prev.filter((c) => c !== name), name]);
    }
    setEntityLinkCat(name);
    setNewCategoryInput('');
    setIsAddingCategory(false);
  };

  const handleEntityIaSubmit = async () => {
    if (!iaPromptInput.trim()) return;
    setSaving(true);
    try {
      const bodyFormData = new FormData();
      bodyFormData.append('mensaje', iaPromptInput);
      bodyFormData.append('entidad_id', String(dbId(drawerNode!.id)));

      const res = await fetch('/api/procesar', {
        method: 'POST',
        body: bodyFormData
      });

      if (res.ok) {
        const resJson = await res.json();
        setIaPromptInput('');
        if (resJson.grafo) {
          setData(resJson.grafo);
        } else {
          await fetchData();
        }
        const numericId = dbId(drawerNode!.id);
        const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
        const detailData = await detailRes.json();
        setEntidadDetails(detailData);
        alert(resJson.data?.descripcion || 'Solicitud de IA procesada correctamente.');
      } else {
        const errJson = await res.json();
        alert(`Error: ${errJson.error}`);
      }
    } catch (err) {
      console.error('Error processing AI prompt:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateEntity = async (tipo: 'EMPRESA' | 'PERSONA') => {
    if (!entityFormNombre.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/grafo/entidad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: entityFormNombre.trim(), tipo, metadatos: {} }),
      });
      if (res.ok) {
        setEntityFormNombre('');
        setShowEntityForm(null);
        await fetchData();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error('Error creating entity:', err);
      alert('Error al crear entidad');
    } finally {
      setSaving(false);
    }
  };

  const handleGlobalIaSubmit = async () => {
    if (!globalIaPrompt.trim()) return;
    setSaving(true);
    try {
      const bodyFormData = new FormData();
      bodyFormData.append('mensaje', globalIaPrompt);
      bodyFormData.append('is_global_parse', 'true');

      const res = await fetch('/api/procesar', {
        method: 'POST',
        body: bodyFormData
      });

      if (res.ok) {
        const resJson = await res.json();
        setGlobalIaPrompt('');
        if (resJson.grafo) {
          setData(resJson.grafo);
        } else {
          await fetchData();
        }
        closeDrawer();
        alert(resJson.data?.descripcion || 'Registro creado exitosamente por IA.');
      } else {
        const errJson = await res.json();
        alert(`Error: ${errJson.error}`);
      }
    } catch (err) {
      console.error('Error processing global AI prompt:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTaskStatus = async (taskId: number, currentEstado: string) => {
    setSaving(true);
    const newEstado = currentEstado === 'PENDIENTE' ? 'CULMINADO' : 'PENDIENTE';
    try {
      const res = await fetch('/api/grafo/tareas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: taskId,
          estado: newEstado
        })
      });
      if (res.ok) {
        await fetchData();
        const numericId = dbId(drawerNode!.id);
        const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
        const detailData = await detailRes.json();
        setEntidadDetails(detailData);
      }
    } catch (err) {
      console.error('Error toggling task status:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Obsidian-style node renderer (filled circle + label below) ────
  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name || '';
      const isCulminated = node.type === 'PROYECTO' && (node.extra?.estado === 'CULMINADO' || node.extra?.estado === 'culminado');
      let colors = isCulminated
        ? { fill: '#475569', text: '#64748b', glow: 'rgba(71, 85, 105, 0.35)' }
        : (NODE_COLORS[node.type] || NODE_COLORS.DEFAULT);
      let baseRadius = NODE_RADIUS[node.type] || NODE_RADIUS.DEFAULT;
      // Destacado: bigger base radius
      const isDestacado = node.extra?.is_destacado === true;
      if (isDestacado) baseRadius *= 1.8;
      // TAREA state-based styling
      if (node.type === 'TAREA') {
        const est = (node.extra?.estado || '').toUpperCase();
        if (est === 'CULMINADO') {
          colors = { fill: '#475569', text: '#64748b', glow: 'rgba(71, 85, 105, 0.25)' };
          baseRadius = NODE_RADIUS.TAREA * 0.5;
        } else if (est === 'SEGUIMIENTO') {
          colors = { fill: '#06b6d4', text: '#67e8f9', glow: 'rgba(6, 182, 212, 0.40)' };
        }
      }
      // FINANZA state-based styling
      if (node.type === 'FINANZA') {
        const estPagado = (node.extra?.estado_pago || '').toUpperCase();
        if (estPagado === 'PAGADO' || estPagado === 'COBRADO') {
          colors = { fill: '#4b5563', text: '#6b7280', glow: 'transparent' };
          baseRadius = NODE_RADIUS.FINANZA * 0.45;
        }
      }
      const r = baseRadius / Math.max(globalScale * 0.15, 0.6);

      const isHighlighted = highlightNodes.size > 0 && highlightNodes.has(node.id);
      const isDimmed = highlightNodes.size > 0 && !highlightNodes.has(node.id);
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;

      // ─ Glow ─
      if (isHighlighted || isHovered || isSelected) {
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = isSelected ? 28 : 18;
      }

      // ─ Outer ring for highlighted/destacado nodes ─
      if (isDestacado) {
        const time = performance.now() / 500;
        const pulseRadius = r + 4 / globalScale + Math.sin(time) * 3 / globalScale;
        // Outer pulsing ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseRadius, 0, 2 * Math.PI, false);
        ctx.strokeStyle = colors.fill;
        ctx.lineWidth = 2 / globalScale;
        ctx.globalAlpha = isDimmed ? 0.08 : 0.5 + Math.sin(time) * 0.3;
        ctx.stroke();
        ctx.globalAlpha = isDimmed ? 0.15 : 1;
        // Extra glow breathing
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 10 + 6 * (0.5 + Math.sin(time) * 0.3);
      }

      // ─ Filled circle ─
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.globalAlpha = isDimmed ? 0.15 : 1;
      ctx.fillStyle = colors.fill;
      ctx.fill();

      // Subtle outer ring on hover/select
      if (isHovered || isSelected) {
        ctx.strokeStyle = colors.fill;
        ctx.lineWidth = 1.5 / globalScale;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3 / globalScale, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.globalAlpha = isDimmed ? 0.15 : 1;
      }

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // ─ Label below circle ─
      let textWidth = 0;
      let fontSize = 0;
      const shouldShowLabel = showLabels && (isHovered || isSelected || globalScale >= 0.8) && (!ocultarYMostrarEnHover || isHovered || isSelected);
      if (shouldShowLabel) {
        const displayLabel = label.length > 20 ? label.slice(0, 20) + '…' : label;
        fontSize = Math.max(labelSize / globalScale, 1.8);
        ctx.font = `${isHovered || isSelected ? '700' : '500'} ${fontSize}px "Inter", -apple-system, sans-serif`;
        ctx.letterSpacing = `${Math.max(0.5 / globalScale, 0.15)}px`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Dark text-shadow / halo for readability against graph background
        ctx.fillStyle = isDarkMode ? 'rgba(10, 10, 12, 0.85)' : 'rgba(255, 255, 255, 0.9)';
        ctx.globalAlpha = isDimmed ? 0.05 : 0.8;
        ctx.fillText(displayLabel, node.x + 0.8, node.y + r + 10 + 0.8);
        ctx.fillText(displayLabel, node.x - 0.8, node.y + r + 10 - 0.8);
        ctx.fillText(displayLabel, node.x + 1.2, node.y + r + 10);
        ctx.fillText(displayLabel, node.x - 1.2, node.y + r + 10);

        // Foreground label (bright white on hover/selected)
        ctx.fillStyle = isHovered || isSelected ? '#ffffff' : (isDarkMode ? colors.text : '#1d1d1f');
        ctx.globalAlpha = isDimmed ? 0.12 : (isHovered || isSelected ? 1 : 0.9);
        ctx.fillText(displayLabel, node.x, node.y + r + 10);
        textWidth = ctx.measureText(displayLabel).width;
      }

      ctx.globalAlpha = 1;

      // Store dimensions for hit area
      node.__bckgDimensions = [
        Math.max(r * 2, textWidth),
        r * 2 + (shouldShowLabel ? fontSize + 10 / globalScale : 0)
      ];
    },
    [highlightNodes, hoveredNode, selectedNode, showLabels, labelSize, ocultarYMostrarEnHover, isDarkMode]
  );

  // ── Custom link renderer ──────────────────────────────────────────
  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const srcId = getNodeId(link.source);
      const tgtId = getNodeId(link.target);
      const linkKey = `${srcId}-${tgtId}`;
      const isHighlighted = highlightLinks.size > 0 && highlightLinks.has(linkKey);
      const isDimmed = highlightLinks.size > 0 && !highlightLinks.has(linkKey);

      const color = LINK_COLORS[link.type] || LINK_COLORS.DEFAULT;

      // Paid finanza links: dim to background
      const srcNode = typeof link.source === 'object' ? link.source : null;
      const tgtNode = typeof link.target === 'object' ? link.target : null;
      const isPaidFinanza = (n: any) => n?.type === 'FINANZA' && (n?.extra?.estado_pago === 'PAGADO' || n?.extra?.estado_pago === 'COBRADO');
      const touchesPaidFinanza = isPaidFinanza(srcNode) || isPaidFinanza(tgtNode);

      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      ctx.strokeStyle = color;
      ctx.globalAlpha = touchesPaidFinanza ? 0.04 : isDimmed ? 0.04 : isHighlighted ? 0.7 : 0.18;
      ctx.lineWidth = (isHighlighted ? 1.8 : 0.8) / globalScale;
      ctx.stroke();

      // ── Animated traveling dashes (flux effect) ──
      if (!touchesPaidFinanza && !isDimmed) {
        const dashSpeed = isHighlighted ? 80 : 120;
        const time = performance.now();
        const offset = -(time / dashSpeed) % 24;
        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);
        ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.15)';
        ctx.globalAlpha = isHighlighted ? 0.5 : 0.25;
        ctx.lineWidth = (isHighlighted ? 2.2 : 1.2) / globalScale;
        ctx.setLineDash([4, 20]);
        ctx.lineDashOffset = offset;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Link type label (dimmed to reduce visual noise)
      if (globalScale > 3) {
        const midX = (link.source.x + link.target.x) / 2;
        const midY = (link.source.y + link.target.y) / 2;
        const fontSize = Math.max(6 / globalScale, 1);
        ctx.font = `400 ${fontSize}px "Inter", sans-serif`;
        ctx.letterSpacing = `${Math.max(0.3 / globalScale, 0.1)}px`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.globalAlpha = isDimmed ? 0.02 : 0.12;
        ctx.fillText(link.type.replace(/_/g, ' '), midX, midY);
      }

      ctx.globalAlpha = 1;
    },
    [highlightLinks, isDarkMode]
  );

  // ── Get connections for selected node ─────────────────────────────
  const getNodeConnections = (node: GraphNode) => {
    if (!filteredData) return [];
    return filteredData.links
      .filter((l) => {
        const srcId = getNodeId(l.source);
        const tgtId = getNodeId(l.target);
        return srcId === node.id || tgtId === node.id;
      })
      .map((l) => {
        const srcId = getNodeId(l.source);
        const tgtId = getNodeId(l.target);
        const otherId = srcId === node.id ? tgtId : srcId;
        const otherNode = filteredData.nodes.find((n) => n.id === otherId);
        const direction = srcId === node.id ? '→' : '←';
        return { otherNode, type: l.type, direction };
      });
  };

  // ── Get items connected to a MES node ─────────────────────────────
  const getItemsForMes = (mesNode: GraphNode): GraphNode[] => {
    if (!filteredData) return [];
    const connected = new Set<string>();
    filteredData.links.forEach((l) => {
      const srcId = getNodeId(l.source);
      const tgtId = getNodeId(l.target);
      if (tgtId === mesNode.id && (l.type === 'VENCE_EN' || l.type === 'REGISTRADO_EN')) {
        connected.add(srcId);
      }
      if (srcId === mesNode.id && (l.type === 'VENCE_EN' || l.type === 'REGISTRADO_EN')) {
        connected.add(tgtId);
      }
    });
    return filteredData.nodes.filter((n) => connected.has(n.id));
  };

  // ── Stats ─────────────────────────────────────────────────────────
  const getStats = () => {
    if (!filteredData) return {};
    const counts: Record<string, number> = {};
    filteredData.nodes.forEach((n) => { counts[n.type] = (counts[n.type] || 0) + 1; });
    return counts;
  };

  return (
    <div
      ref={containerRef}
      className={`min-h-screen ${isDarkMode ? 'bg-[radial-gradient(circle,_#1e1e1f_0%,_#161617_100%)] text-white' : 'bg-[radial-gradient(circle,_#ffffff_0%,_#f5f5f7_100%)] text-[#1d1d1f]'} font-sans flex flex-col transition-colors duration-500`}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', '--panel-bg': isDarkMode ? 'rgba(45,45,46,0.7)' : 'rgba(255,255,255,0.75)', '--panel-border': isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', '--text-color': isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(29,29,31,0.8)', '--panel-hover': isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' } as React.CSSProperties}
    >
      {/* ── Navigation Bar ──────────────────────────────────────────── */}
      <nav className={`relative z-20 flex items-center justify-between px-5 py-3 border-b ${isDarkMode ? 'border-white/[0.06] bg-[#0a0a0c]/90' : 'border-black/[0.06] bg-white/80'} backdrop-blur-xl transition-colors duration-500`}>
        <div className="flex items-center gap-4">
          <Link href="/" className={`flex items-center gap-2 text-[13px] ${isDarkMode ? 'text-white/50 hover:text-white/80' : 'text-[#1d1d1f]/50 hover:text-[#1d1d1f]/80'} transition-colors`}>
            <ArrowLeft size={14} />
            <span>24onbrain</span>
          </Link>
          <div className={`w-px h-4 ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`} />
          <h1 className={`text-[13px] font-semibold ${isDarkMode ? 'text-white/90' : 'text-[#1d1d1f]'} tracking-tight`}>
            Ecosistema Relacional
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-8 h-8 rounded-lg ${isDarkMode ? 'bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white/90' : 'bg-black/[0.04] hover:bg-black/[0.08] text-[#1d1d1f]/50 hover:text-[#1d1d1f]'} flex items-center justify-center transition-all`}
            title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            <span className="text-[14px]">{isDarkMode ? '☀️' : '🌙'}</span>
          </button>
          <div className="relative">
            <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/30' : 'text-[#1d1d1f]/30'}`} />
            <input
              type="text"
              placeholder="Buscar entidad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${isDarkMode ? 'bg-white/[0.05] border-white/[0.08] text-white/80 placeholder-white/25 focus:border-white/20 focus:bg-white/[0.08]' : 'bg-black/[0.03] border-black/[0.08] text-[#1d1d1f] placeholder-[#1d1d1f]/25 focus:border-black/20 focus:bg-black/[0.06]'} border rounded-lg pl-8 pr-3 py-1.5 text-[12px] outline-none transition-all w-44`}
            />
          </div>

          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg overflow-hidden">
            <button onClick={handleZoomIn} className="p-1.5 hover:bg-white/[0.08] transition-colors text-white/40 hover:text-white/70" title="Acercar">
              <ZoomIn size={13} />
            </button>
            <div className="w-px h-4 bg-white/[0.08]" />
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-white/[0.08] transition-colors text-white/40 hover:text-white/70" title="Alejar">
              <ZoomOut size={13} />
            </button>
            <div className="w-px h-4 bg-white/[0.08]" />
            <button onClick={handleReset} className="p-1.5 hover:bg-white/[0.08] transition-colors text-white/40 hover:text-white/70" title="Recentrar">
              <RotateCcw size={13} />
            </button>
          </div>

          <button onClick={toggleFullscreen} className="p-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg hover:bg-white/[0.08] transition-colors text-white/40 hover:text-white/70" title="Pantalla completa">
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </nav>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        {/* Canvas container — pointer-events managed at canvas level */}
        <div ref={graphContainerRef} className="absolute inset-0" style={{ zIndex: 0 }}>
          {filteredData && graphDimensions.width > 0 && (
            <ForceGraph2D
              ref={graphRef}
              graphData={filteredData}
              nodeId="id"
              width={graphDimensions.width}
              height={graphDimensions.height}
              nodeCanvasObject={paintNode}
              nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
                // Uniform hit-area logic for ALL node types
                let baseRadius = NODE_RADIUS[node.type] || NODE_RADIUS.DEFAULT;
                if (node.extra?.is_destacado === true) baseRadius *= 1.8;
                // TAREA culminada: smaller visual but keep a decent hitbox
                if (node.type === 'TAREA') {
                  const est = (node.extra?.estado || '').toUpperCase();
                  if (est === 'CULMINADO') baseRadius = NODE_RADIUS.TAREA * 0.5;
                }
                // FINANZA pagada
                if (node.type === 'FINANZA') {
                  const est = (node.extra?.estado_pago || '').toUpperCase();
                  if (est === 'PAGADO' || est === 'COBRADO') baseRadius = NODE_RADIUS.FINANZA * 0.45;
                }
                const isHub = node.type?.startsWith('HUB_') || node.type === 'LINKS' || node.id?.includes('hub');
                if (isHub) baseRadius *= 1.4;
                const r = Math.max(baseRadius / Math.max(globalScale * 0.15, 0.6), 6);
                // Generous minimum hitbox of 10px so every node is easily clickable/draggable
                const hitRadius = Math.max(r + (isHub ? 14 : 10), 10);

                // Circle hit area
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, hitRadius, 0, 2 * Math.PI);
                ctx.fill();

                // Label hit area below (same for all nodes)
                const label = node.name || '';
                if (label) {
                  const fontSize = Math.max(labelSize / globalScale, 2);
                  ctx.font = `500 ${fontSize}px "Inter", sans-serif`;
                  const displayLabel = label.length > 20 ? label.slice(0, 20) + '…' : label;
                  const textWidth = ctx.measureText(displayLabel).width;
                  const pad = isHub ? 10 : 6;
                  ctx.fillRect(
                    node.x - textWidth / 2 - pad,
                    node.y + r + 4,
                    textWidth + pad * 2,
                    fontSize + 12
                  );
                }
              }}
              linkCanvasObject={paintLink}
              onNodeClick={handleNodeClick}
              onNodeHover={(node: any) => setHoveredNode(node || null)}
              onNodeDrag={handleNodeDrag}
              onNodeDragEnd={handleNodeDragEnd}
              onBackgroundClick={() => {
                setSelectedNode(null);
                resetCreateForm();
                setDrawerMode('global_create');
                setDrawerNode({ id: 'global-create', name: 'Creación Global', type: 'DEFAULT' });
                setDrawerOpen(true);
              }}
              backgroundColor={isDarkMode ? '#161617' : '#f5f5f7'}
              d3AlphaDecay={0.015}
              d3VelocityDecay={0.25}
              warmupTicks={100}
              cooldownTicks={300}
              cooldownTime={5000}
              enableNodeDrag={true}
              enableZoomInteraction={true}
              enablePanInteraction={true}
            />
          )}
        </div>

        {/* Loading / Error overlays — pointer-events-none so canvas always receives input */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/10 border-t-violet-500 rounded-full animate-spin" />
              <p className="text-[12px] text-white/40 font-medium">Cargando ecosistema...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 max-w-sm text-center">
              <p className="text-red-400 text-sm font-medium mb-1">Error</p>
              <p className="text-red-300/60 text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* ── Settings Toggle Button ──────────────────────────────────── */}
        {!showSettings && (
          <button
            onClick={() => setShowSettings(true)}
            className="absolute top-5 left-5 z-20 w-10 h-10 rounded-2xl bg-white/85 hover:bg-white border border-slate-200/80 text-slate-700 hover:text-slate-900 backdrop-blur-md flex items-center justify-center shadow-lg shadow-black/5 hover:shadow-xl transition-all pointer-events-auto"
            title="Ajustes y Filtros"
          >
            <Sliders size={16} />
          </button>
        )}

        {/* ── Standalone Stats (when no selection and settings closed) ── */}
        {filteredData && !selectedNode && !showSettings && (
          <div className="absolute top-5 right-18 z-10 bg-white/85 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 shadow-xl shadow-black/5 text-slate-800 pointer-events-auto">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Estadísticas</p>
            <div className="space-y-2">
              {Object.entries(getStats()).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between gap-8">
                  <span className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: (NODE_COLORS[type] || NODE_COLORS.DEFAULT).fill }} />
                    {type}
                  </span>
                  <span className="text-[13px] text-slate-900 font-bold tabular-nums">{count}</span>
                </div>
              ))}
              <div className="h-px bg-slate-200/80" />
              <div className="flex items-center justify-between gap-8">
                <span className="text-[11px] text-slate-600 font-medium">Vínculos</span>
                <span className="text-[13px] text-slate-900 font-bold tabular-nums">{filteredData.links.length}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Compact Conexiones Panel (rendered on right when node selected & full drawer closed) ── */}
        {selectedNode && !drawerOpen && (
          <div 
            className={`absolute top-5 right-5 z-20 ${isDarkMode ? 'bg-[#1c1c1e]/90 border-white/10 text-white' : 'bg-white/90 border-black/10 text-[#1d1d1f]'} backdrop-blur-xl border rounded-2xl p-5 w-80 animate-fade-in shadow-2xl ${isDarkMode ? 'shadow-black/60' : 'shadow-black/15'} transition-all duration-300 pointer-events-auto`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div
                  className="inline-block text-[9px] font-bold uppercase tracking-[0.15em] px-2.5 py-0.5 rounded-md mb-2"
                  style={{
                    backgroundColor: (NODE_COLORS[selectedNode.type] || NODE_COLORS.DEFAULT).fill + '20',
                    color: (NODE_COLORS[selectedNode.type] || NODE_COLORS.DEFAULT).fill,
                    border: `1px solid ${(NODE_COLORS[selectedNode.type] || NODE_COLORS.DEFAULT).fill}30`,
                  }}
                >
                  {selectedNode.type}
                </div>
                <h2 className={`text-[15px] font-bold ${isDarkMode ? 'text-white/90' : 'text-[#1d1d1f]'} tracking-tight leading-snug`}>{selectedNode.name}</h2>
              </div>
              <button 
                onClick={() => setSelectedNode(null)} 
                className={`p-1 rounded-lg ${isDarkMode ? 'text-white/30 hover:text-white/80 hover:bg-white/10' : 'text-[#1d1d1f]/30 hover:text-[#1d1d1f]/80 hover:bg-black/5'} transition-colors leading-none mt-0.5`}
                title="Cerrar tarjeta"
              >
                <X size={15} />
              </button>
            </div>

            {selectedNode.alias && selectedNode.alias.length > 0 && (
              <div className="mb-3">
                <p className={`text-[10px] ${isDarkMode ? 'text-white/30' : 'text-[#1d1d1f]/40'} uppercase tracking-wider mb-1.5 font-semibold`}>Alias</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.alias.map((a, i) => (
                    <span key={i} className={`text-[10px] ${isDarkMode ? 'bg-white/[0.05] border-white/[0.08] text-white/60' : 'bg-black/[0.04] border-black/[0.08] text-[#1d1d1f]/70'} border px-2 py-0.5 rounded-md`}>{a}</span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className={`text-[10px] ${isDarkMode ? 'text-white/30' : 'text-[#1d1d1f]/40'} uppercase tracking-wider mb-2 font-semibold flex items-center justify-between`}>
                <span>Conexiones Directas</span>
                <span className="font-bold text-violet-400">{getNodeConnections(selectedNode).length}</span>
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {getNodeConnections(selectedNode).map((conn, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-[11px] ${isDarkMode ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.08]' : 'bg-black/[0.02] border-black/[0.06] hover:bg-black/[0.05]'} border rounded-xl px-3 py-2 transition-colors cursor-pointer`}
                    onClick={() => conn.otherNode && handleNodeClick(conn.otherNode)}
                  >
                    <span className={isDarkMode ? 'text-white/30' : 'text-[#1d1d1f]/30'} style={{ fontSize: '9px' }}>{conn.direction}</span>
                    <span className="font-medium truncate flex-1" style={{ color: (NODE_COLORS[conn.otherNode?.type || 'DEFAULT'] || NODE_COLORS.DEFAULT).text }}>
                      {conn.otherNode?.name}
                    </span>
                    <span className={isDarkMode ? 'text-white/20' : 'text-[#1d1d1f]/25'} style={{ fontSize: '9px' }}>{conn.type.replace(/_/g, ' ')}</span>
                  </div>
                ))}
                {getNodeConnections(selectedNode).length === 0 && (
                  <p className={`text-[11px] ${isDarkMode ? 'text-white/30' : 'text-[#1d1d1f]/30'} italic text-center py-2`}>Sin conexiones directas</p>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setDrawerNode(selectedNode);
                setDrawerMode('view');
                setDrawerOpen(true);
              }}
              className="w-full mt-4 flex items-center justify-center gap-2 text-[11px] font-bold py-2.5 px-3 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 transition-all shadow-sm"
            >
              <span>Ver Ficha Completa / Editar</span>
              <ExternalLink size={13} />
            </button>
          </div>
        )}

        {/* ── Obsidian Settings Panel (iPhone / iOS Light Glassmorphism) ── */}
        {showSettings && filteredData && (
          <div className="absolute top-5 left-5 z-20 w-84 bg-white/85 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-5 shadow-2xl shadow-black/10 text-slate-800 text-[12px] space-y-5 transition-all duration-300 pointer-events-auto max-h-[85vh] overflow-y-auto animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <Sliders size={15} className="text-indigo-600" />
                <span className="text-[14px] tracking-tight">Filtros y Fuerzas</span>
              </div>
              <button 
                onClick={() => setShowSettings(false)} 
                className="w-7 h-7 rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all"
                title="Cerrar panel"
              >
                <X size={13} />
              </button>
            </div>

            {/* Section 1: Filters */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Filtros de Nodo</p>
              <div className="grid grid-cols-2 gap-2">
                <FilterCheckbox label="Empresas" color={NODE_COLORS.EMPRESA.fill} checked={showEmpresas} onChange={setShowEmpresas} />
                <FilterCheckbox label="Personas" color={NODE_COLORS.PERSONA.fill} checked={showPersonas} onChange={setShowPersonas} />
                <FilterCheckbox label="Servicios" color={NODE_COLORS.SERVICIO.fill} checked={showServicios} onChange={setShowServicios} />
                <FilterCheckbox label="Finanzas" color={NODE_COLORS.FINANZA.fill} checked={showFinanzas} onChange={setShowFinanzas} />
                <FilterCheckbox label="Tareas" color={NODE_COLORS.TAREA.fill} checked={showTareas} onChange={setShowTareas} />
                <FilterCheckbox label="Meses" color={NODE_COLORS.MES.fill} checked={showMeses} onChange={setShowMeses} />
                <FilterCheckbox label="Mostrar Libros" color={NODE_COLORS.LIBRO.fill} checked={showLibros} onChange={setShowLibros} />
                <FilterCheckbox label="Mostrar Citas" color={NODE_COLORS.CITA.fill} checked={showCitas} onChange={setShowCitas} />
                <FilterCheckbox label="Películas" color={NODE_COLORS.PELICULA.fill} checked={showPeliculas} onChange={setShowPeliculas} />
                <FilterCheckbox label="Series" color={NODE_COLORS.SERIE.fill} checked={showSeries} onChange={setShowSeries} />
                <FilterCheckbox label="Proyectos" color={NODE_COLORS.PROYECTO.fill} checked={showProyectos} onChange={setShowProyectos} />
                <FilterCheckbox label="Hub LINKS" color={NODE_COLORS.LINKS.fill} checked={showLinks} onChange={setShowLinks} />
                <FilterCheckbox label="Tesorería" color={NODE_COLORS.HUB_FINANZAS.fill} checked={showHubFinanzas} onChange={setShowHubFinanzas} />
                <FilterCheckbox label="Destacados" color="#f59e0b" checked={mostrarSoloDestacados} onChange={setMostrarSoloDestacados} />
              </div>
            </div>

            {/* Section 2: Display */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Visualización</p>
              <div className="space-y-3 bg-white/70 border border-slate-200/60 rounded-2xl p-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Mostrar etiquetas</span>
                  <input 
                    type="checkbox" 
                    checked={showLabels} 
                    onChange={(e) => setShowLabels(e.target.checked)}
                    className="accent-indigo-600 cursor-pointer h-4 w-4 rounded border-slate-300 bg-white"
                  />
                </div>
                {showLabels && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 text-[11px]">Ocultar (mostrar solo en hover)</span>
                      <input 
                        type="checkbox" 
                        checked={ocultarYMostrarEnHover} 
                        onChange={(e) => setOcultarYMostrarEnHover(e.target.checked)}
                        className="accent-indigo-600 cursor-pointer h-4 w-4 rounded border-slate-300 bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-600">
                        <span>Tamaño del texto</span>
                        <span className="font-bold text-indigo-600">{labelSize}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="8" 
                        max="20" 
                        value={labelSize} 
                        onChange={(e) => setLabelSize(Number(e.target.value))}
                        className="w-full accent-indigo-600 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Section 3: Forces */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Fuerzas físicas (D3)</p>
              <div className="space-y-3.5 bg-white/70 border border-slate-200/60 rounded-2xl p-3.5 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Fuerza de repulsión</span>
                    <span className="font-bold text-indigo-600">{repulsionStrength}</span>
                  </div>
                  <input 
                    type="range" 
                    min="-500" 
                    max="0" 
                    step="10"
                    value={repulsionStrength} 
                    onChange={(e) => setRepulsionStrength(Number(e.target.value))}
                    className="w-full accent-indigo-600 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Distancia de repulsión</span>
                    <span className="font-bold text-indigo-600">{repulsionDistance}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="100" 
                    max="500" 
                    step="10"
                    value={repulsionDistance} 
                    onChange={(e) => setRepulsionDistance(Number(e.target.value))}
                    className="w-full accent-indigo-600 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Distancia de vínculo</span>
                    <span className="font-bold text-indigo-600">{linkDistance}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="30" 
                    max="200" 
                    step="5"
                    value={linkDistance} 
                    onChange={(e) => setLinkDistance(Number(e.target.value))}
                    className="w-full accent-indigo-600 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Radio de colisión</span>
                    <span className="font-bold text-indigo-600">{collisionRadius}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="40" 
                    value={collisionRadius} 
                    onChange={(e) => setCollisionRadius(Number(e.target.value))}
                    className="w-full accent-indigo-600 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Statistics */}
            <div className="space-y-3 border-t border-slate-200/80 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Estadísticas del Grafo</p>
              <div className="space-y-1.5 bg-white/70 border border-slate-200/60 rounded-2xl p-3.5 shadow-2xs">
                {Object.entries(getStats()).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: (NODE_COLORS[type] || NODE_COLORS.DEFAULT).fill }} />
                      {type}
                    </span>
                    <span className="text-slate-900 font-bold tabular-nums">{count}</span>
                  </div>
                ))}
                <div className="h-px bg-slate-200/60 my-1.5" />
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 font-medium">Vínculos activos</span>
                  <span className="text-slate-900 font-bold tabular-nums">{filteredData.links.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  Interactive Drawer                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}

        {/* Backdrop — click to close */}
        <div
          className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${drawerOpen ? 'opacity-100 pointer-events-auto cursor-pointer' : 'opacity-0 pointer-events-none'}`}
          onClick={closeDrawer}
        />

        {/* Drawer Panel (Dual View layout) */}
        <div
          className={`fixed top-0 right-0 z-40 h-full flex flex-col md:flex-row shadow-2xl shadow-black/70 transition-all duration-300 ease-in-out transform pointer-events-none ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          } ${
            showSecondaryPanel && drawerNode && drawerNode.id !== 'global-create'
              ? 'w-full lg:w-[940px] xl:w-[1020px]'
              : 'w-full md:w-[480px] lg:w-[520px]'
          }`}
        >
          {/* SECONDARY PANEL: Panel de Vínculos y Tareas Relacionadas (iPhone / iOS Light Glassmorphism) */}
          {showSecondaryPanel && drawerNode && drawerNode.id !== 'global-create' && (
            <div className="w-full md:w-1/2 lg:w-[480px] bg-white/90 backdrop-blur-2xl border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col h-full overflow-hidden pointer-events-auto text-slate-800 shadow-2xl">
              {/* Secondary Header */}
              <div className="px-5 pt-4 pb-3 border-b border-slate-200/70 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0 shadow-2xs">
                    <Sparkles size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-bold text-slate-900 truncate flex items-center gap-1.5">
                      <span>Vínculos & Tareas</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/70">
                        {linkedItems.allItems.length}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 truncate">
                      Asociados a <span className="text-slate-800 font-semibold">"{drawerNode.name}"</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSecondaryPanel(false)}
                  className="p-1.5 rounded-xl bg-slate-200/60 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all shrink-0"
                  title="Ocultar panel de vínculos"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100/70 border-b border-slate-200/60 overflow-x-auto text-[11px]">
                <button
                  onClick={() => setSecondaryFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                    secondaryFilter === 'ALL'
                      ? 'bg-white text-indigo-600 font-bold shadow-2xs border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  Todos ({linkedItems.allItems.length})
                </button>
                <button
                  onClick={() => setSecondaryFilter('TAREAS')}
                  className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                    secondaryFilter === 'TAREAS'
                      ? 'bg-white text-amber-600 font-bold shadow-2xs border border-amber-200'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  Tareas ({linkedItems.tasks.length})
                </button>
                <button
                  onClick={() => setSecondaryFilter('FINANZAS')}
                  className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                    secondaryFilter === 'FINANZAS'
                      ? 'bg-white text-emerald-600 font-bold shadow-2xs border border-emerald-200'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  Finanzas ({linkedItems.finances.length})
                </button>
                <button
                  onClick={() => setSecondaryFilter('ENTIDADES')}
                  className={`px-3 py-1 rounded-lg transition-all shrink-0 ${
                    secondaryFilter === 'ENTIDADES'
                      ? 'bg-white text-indigo-600 font-bold shadow-2xs border border-indigo-200'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  Entidades ({linkedItems.entities.length + linkedItems.projects.length})
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {(() => {
                  let itemsToRender: GraphNode[] = [];
                  if (secondaryFilter === 'ALL') itemsToRender = linkedItems.allItems;
                  else if (secondaryFilter === 'TAREAS') itemsToRender = linkedItems.tasks;
                  else if (secondaryFilter === 'FINANZAS') itemsToRender = linkedItems.finances;
                  else if (secondaryFilter === 'ENTIDADES') itemsToRender = [...linkedItems.entities, ...linkedItems.projects];

                  if (itemsToRender.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-56 p-6 text-center bg-white/60 border border-dashed border-slate-200 rounded-2xl my-4 text-slate-500">
                        <CheckSquare size={32} className="text-slate-300 mb-2.5" />
                        <p className="text-[13px] font-bold text-slate-700">No hay tareas ni elementos vinculados</p>
                        <p className="text-[11px] text-slate-500 mt-1.5 max-w-xs leading-relaxed">
                          {secondaryFilter === 'TAREAS'
                            ? 'No hay tareas urgentes o pendientes en este nodo.'
                            : `Sin registros vinculados en esta sección para "${drawerNode.name}".`}
                        </p>
                      </div>
                    );
                  }

                  return itemsToRender.map((itemNode) => {
                    const isActive = itemNode.id === drawerNode?.id;

                    if (itemNode.type === 'TAREA') {
                      const isConcluida =
                        itemNode.extra?.estado === 'CULMINADO' ||
                        itemNode.extra?.estado === 'CULMINADA' ||
                        itemNode.extra?.estado === 'COMPLETADA';
                      const isSeguimiento = itemNode.extra?.estado === 'SEGUIMIENTO';
                      const isUrgente = itemNode.extra?.urgente;

                      return (
                        <div
                          key={itemNode.id}
                          onClick={() => handleSelectSecondaryItem(itemNode)}
                          className={`p-3.5 rounded-2xl border transition-all text-left flex flex-col gap-2 cursor-pointer ${
                            isActive
                              ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-md'
                              : isConcluida
                              ? 'bg-slate-50/80 border-slate-200/50 opacity-60 hover:opacity-90'
                              : isUrgente
                              ? 'bg-red-50/80 border-red-200 hover:bg-red-50 shadow-2xs'
                              : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isConcluida}
                                disabled={saving}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() =>
                                  handleToggleTaskCheckbox({ id: dbId(itemNode.id), estado: itemNode.extra?.estado })
                                }
                                className="accent-indigo-600 h-4 w-4 mt-0.5 rounded border-slate-300 cursor-pointer shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`text-[12px] font-semibold leading-snug break-words ${
                                    isConcluida ? 'line-through text-slate-400' : 'text-slate-800'
                                  }`}
                                >
                                  <span dangerouslySetInnerHTML={{ __html: renderFormattedText(itemNode.name) }} />
                                </p>

                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  {isActive && (
                                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded text-indigo-600 bg-indigo-100 border border-indigo-200">
                                      Abierto
                                    </span>
                                  )}
                                  {itemNode.extra?.proyecto && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-semibold border border-indigo-100">
                                      {itemNode.extra.proyecto}
                                    </span>
                                  )}
                                  {isUrgente && !isConcluida && (
                                    <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md text-red-600 bg-red-100 border border-red-200 animate-pulse">
                                      🔥 URGENTE
                                    </span>
                                  )}
                                  <span
                                    className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${
                                      isConcluida
                                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                        : isSeguimiento
                                        ? 'text-cyan-700 bg-cyan-50 border-cyan-200'
                                        : 'text-amber-700 bg-amber-50 border-amber-200'
                                    }`}
                                  >
                                    {itemNode.extra?.estado || 'PENDIENTE'}
                                  </span>
                                  {itemNode.extra?.fecha_limite && (
                                    <span className="text-[9px] text-slate-500 font-medium flex items-center gap-1">
                                      📅 {formatDate(itemNode.extra.fecha_limite)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNodeClick(itemNode);
                              }}
                              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all shrink-0"
                              title="Centrar en el grafo"
                            >
                              <ExternalLink size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (itemNode.type === 'FINANZA') {
                      const isPaid = itemNode.extra?.estado_pago === 'PAGADO' || itemNode.extra?.estado_pago === 'COBRADO';

                      return (
                        <div
                          key={itemNode.id}
                          onClick={() => handleSelectSecondaryItem(itemNode)}
                          className={`p-3.5 rounded-2xl border transition-all text-left flex items-start justify-between gap-3 cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-md'
                              : isPaid
                              ? 'bg-slate-50/80 border-slate-200/50 opacity-60 hover:opacity-90'
                              : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs hover:shadow-md'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[13px] font-bold text-emerald-600">
                                {formatGs(itemNode.extra?.monto || 0)}
                              </span>
                              {isActive && (
                                <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-100 border border-emerald-200">
                                  Abierto
                                </span>
                              )}
                              <span
                                className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${
                                  isPaid
                                    ? 'text-slate-500 bg-slate-100 border-slate-200'
                                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                }`}
                              >
                                {itemNode.extra?.estado_pago || 'PENDIENTE'}
                              </span>
                            </div>
                            <p className="text-[12px] font-medium text-slate-800 leading-snug break-words">
                              {itemNode.name}
                            </p>
                            {itemNode.extra?.proyecto && (
                              <p className="text-[9px] text-indigo-600 font-semibold mt-1">
                                Proyecto: {itemNode.extra.proyecto}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNodeClick(itemNode);
                            }}
                            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all shrink-0"
                            title="Centrar en el grafo"
                          >
                            <ExternalLink size={13} />
                          </button>
                        </div>
                      );
                    }

                    // Entity, Project, Link or Book
                    const colors = NODE_COLORS[itemNode.type] || NODE_COLORS.DEFAULT;
                    return (
                      <div
                        key={itemNode.id}
                        onClick={() => handleSelectSecondaryItem(itemNode)}
                        className={`p-3.5 rounded-2xl border transition-all text-left flex items-center justify-between gap-3 cursor-pointer ${
                          isActive
                            ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-md'
                            : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-bold shadow-2xs"
                            style={{
                              backgroundColor: colors.fill + '18',
                              color: colors.fill,
                              border: `1px solid ${colors.fill}35`,
                            }}
                          >
                            {itemNode.type.slice(0, 3)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[12px] font-bold text-slate-800 truncate">{itemNode.name}</p>
                              {isActive && (
                                <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded text-indigo-600 bg-indigo-100 border border-indigo-200 shrink-0">
                                  Abierto
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: colors.fill }}>
                              {itemNode.type}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNodeClick(itemNode);
                          }}
                          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all shrink-0"
                          title="Centrar en el grafo"
                        >
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* MAIN DRAWER PANEL */}
          <div className="flex-1 bg-[#111113]/[0.98] backdrop-blur-2xl flex flex-col h-full overflow-hidden pointer-events-auto">
            {drawerNode && (
              <div className="h-full flex flex-col">
                {/* iOS handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-9 h-1 rounded-full bg-white/15" />
                </div>

                {/* Drawer header */}
                <div className="px-6 pt-3 pb-4 border-b border-white/[0.06]">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: (NODE_COLORS[drawerNode.type] || NODE_COLORS.DEFAULT).fill + '20',
                          border: `1px solid ${(NODE_COLORS[drawerNode.type] || NODE_COLORS.DEFAULT).fill}40`,
                        }}
                      >
                        {drawerNode.type === 'FINANZA' && <DollarSign size={20} style={{ color: NODE_COLORS.FINANZA.fill }} />}
                        {drawerNode.type === 'TAREA' && <CheckSquare size={20} style={{ color: NODE_COLORS.TAREA.fill }} />}
                        {drawerNode.type === 'MES' && <Calendar size={20} style={{ color: NODE_COLORS.MES.fill }} />}
                        {drawerNode.type === 'LIBRO' && <BookOpen size={20} style={{ color: NODE_COLORS.LIBRO.fill }} />}
                        {drawerNode.type === 'CITA' && <FileText size={20} style={{ color: NODE_COLORS.CITA.fill }} />}
                        {['EMPRESA', 'PERSONA', 'SERVICIO'].includes(drawerNode.type) && <Building2 size={20} style={{ color: (NODE_COLORS[drawerNode.type] || NODE_COLORS.DEFAULT).fill }} />}
                      </div>
                      <div>
                        <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-0.5"
                          style={{ color: (NODE_COLORS[drawerNode.type] || NODE_COLORS.DEFAULT).fill }}>
                          {drawerMode === 'create' ? `NUEVA ${createType}` : drawerNode.type}
                        </div>
                        <h2 className="text-[15px] font-bold text-white/90 tracking-tight leading-snug">
                          {drawerMode === 'create' ? 'Nuevo registro' : drawerNode.name}
                        </h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!showSecondaryPanel && drawerNode && drawerNode.id !== 'global-create' && (
                        <button
                          onClick={() => setShowSecondaryPanel(true)}
                          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 transition-all shrink-0 mr-1"
                          title="Mostrar panel de vínculos"
                        >
                          <Sparkles size={12} />
                          <span>Vínculos ({linkedItems.allItems.length})</span>
                        </button>
                      )}
                      {hubContextNode && (
                        <button onClick={() => { setDrawerNode(hubContextNode); setDrawerMode('view'); setHubContextNode(null); }} className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.12] transition-all">
                          <ArrowLeft size={14} />
                        </button>
                      )}
                      <button onClick={closeDrawer} className="w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.12] transition-all">
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                {/* Mode toggle buttons */}
                {drawerNode.type !== 'MES' && drawerMode !== 'create' && (
                  <div className="flex items-center gap-2 mt-3 w-full">
                    <button
                      onClick={() => setDrawerMode('view')}
                      className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all ${drawerMode === 'view' ? 'bg-white/[0.1] text-white/80' : 'text-white/30 hover:text-white/50'}`}
                    >
                      Detalle
                    </button>
                    <button
                      onClick={() => { setDrawerMode('edit'); populateEditForm(drawerNode); }}
                      className={`text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all ${drawerMode === 'edit' ? 'bg-white/[0.1] text-white/80' : 'text-white/30 hover:text-white/50'}`}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteNode(drawerNode.id)}
                      className="text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-all bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>Eliminar</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ── Drawer body ──────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">

                {/* ═══════ VIEW MODE ═══════ */}
                {drawerMode === 'view' && (
                  <>
                    {/* HUB_TAREAS view */}
                    {(drawerNode.type === 'HUB_TAREAS' || drawerNode.id === 'hub-urgentes-tareas') && (
                      <div className="bg-gradient-to-br from-amber-500/15 to-orange-600/10 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] text-amber-400/80 uppercase tracking-wider font-bold">Nodo Hub / Agrupador Maestro</p>
                          <span className="text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                            HUB URGENTES
                          </span>
                        </div>
                        <h3 className="text-[18px] font-bold text-amber-200 tracking-tight flex items-center gap-2">
                          <span>🔥</span> Tareas Urgentes y Pendientes
                        </h3>
                        <p className="text-[12px] text-amber-100/70 mt-1.5 leading-relaxed">
                          Concentra todas las tareas marcadas como urgentes, de alta prioridad o pendientes en tu ecosistema relacional.
                        </p>
                        <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-between text-[11px] text-amber-300/80">
                          <span>Ítems vinculados:</span>
                          <span className="font-bold text-amber-200">{linkedItems.tasks.length} tareas</span>
                        </div>
                      </div>
                    )}

                    {/* HUB_FINANZAS view */}
                    {(drawerNode.type === 'HUB_FINANZAS' || drawerNode.id === 'hub_finanzas') && (
                      <div className="bg-gradient-to-br from-emerald-500/15 to-teal-600/10 border border-emerald-500/30 rounded-2xl p-5 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-bold">Nodo Hub / Tesorería</p>
                          <span className="text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            HUB TESORERÍA
                          </span>
                        </div>
                        <h3 className="text-[18px] font-bold text-emerald-200 tracking-tight flex items-center gap-2">
                          <span>💳</span> Finanzas y Tesorería
                        </h3>
                        <p className="text-[12px] text-emerald-100/70 mt-1.5 leading-relaxed">
                          Concentra todos los cobros, pagos, saldos y movimientos financieros clasificados por unidad originadora.
                        </p>
                        <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-300/80">
                          <span>Movimientos registrados:</span>
                          <span className="font-bold text-emerald-200">{linkedItems.finances.length} registros</span>
                        </div>
                      </div>
                    )}

                    {/* LINKS view */}
                    {(drawerNode.type === 'LINKS' || drawerNode.id === 'links-hub') && (
                      <div className="bg-gradient-to-br from-sky-500/15 to-blue-600/10 border border-sky-500/30 rounded-2xl p-5 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] text-sky-400/80 uppercase tracking-wider font-bold">Nodo Hub / Recursos</p>
                          <span className="text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            HUB LINKS
                          </span>
                        </div>
                        <h3 className="text-[18px] font-bold text-sky-200 tracking-tight flex items-center gap-2">
                          <span>🔗</span> Enlaces, Documentación y Recursos
                        </h3>
                        <p className="text-[12px] text-sky-100/70 mt-1.5 leading-relaxed">
                          Consolida repositorios, URLs, accesos rápidos y documentación técnica vinculada al ecosistema.
                        </p>
                      </div>
                    )}

                    {/* FINANZA view */}
                    {drawerNode.type === 'FINANZA' && drawerNode.extra && (
                      <>
                        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-5">
                          <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-semibold mb-1">Monto</p>
                          <p className="text-[28px] font-bold text-emerald-300 tracking-tight leading-none">
                            {formatGs(drawerNode.extra.monto ?? 0)}
                          </p>
                          {drawerNode.extra.saldo_pendiente != null && drawerNode.extra.saldo_pendiente > 0 && (
                            <p className="text-[12px] text-emerald-400/50 mt-1.5">
                              Saldo pendiente: {formatGs(drawerNode.extra.saldo_pendiente)}
                            </p>
                          )}
                        </div>
                        <div className="space-y-3">
                          <DetailRow icon={<DollarSign size={14} />} label="Tipo" value={drawerNode.extra.tipo ?? '—'} color="#10b981" />
                          <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="opacity-50" style={{ color: '#f59e0b' }}><Clock size={14} /></span>
                              <span className="text-[11px] text-white/40">Estado</span>
                            </div>
                            <select
                              value={(drawerNode.extra.estado_pago ?? 'PENDIENTE').toUpperCase()}
                              onChange={(e) => handleFinanceStatusChange(e.target.value)}
                              disabled={saving}
                              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md cursor-pointer border"
                              style={{
                                backgroundColor: `${['PENDIENTE', 'PAGADO', 'SALDO'].includes((drawerNode.extra.estado_pago ?? 'PENDIENTE').toUpperCase()) ? ((drawerNode.extra.estado_pago ?? 'PENDIENTE').toUpperCase() === 'PENDIENTE' ? '#f59e0b' : (drawerNode.extra.estado_pago ?? 'PENDIENTE').toUpperCase() === 'SALDO' ? '#3b82f6' : '#10b981') : '#64748b'}20`,
                                color: ['PENDIENTE', 'PAGADO', 'SALDO'].includes((drawerNode.extra.estado_pago ?? 'PENDIENTE').toUpperCase()) ? ((drawerNode.extra.estado_pago ?? 'PENDIENTE').toUpperCase() === 'PENDIENTE' ? '#f59e0b' : (drawerNode.extra.estado_pago ?? 'PENDIENTE').toUpperCase() === 'SALDO' ? '#3b82f6' : '#10b981') : '#64748b',
                                borderColor: `${['PENDIENTE', 'PAGADO', 'SALDO'].includes((drawerNode.extra.estado_pago ?? 'PENDIENTE').toUpperCase()) ? ((drawerNode.extra.estado_pago ?? 'PENDIENTE').toUpperCase() === 'PENDIENTE' ? '#f59e0b' : (drawerNode.extra.estado_pago ?? 'PENDIENTE').toUpperCase() === 'SALDO' ? '#3b82f6' : '#10b981') : '#64748b'}30`,
                              }}
                            >
                              <option value="PENDIENTE" className="bg-gray-900 text-amber-400">PENDIENTE</option>
                              <option value="PAGADO" className="bg-gray-900 text-emerald-400">PAGADO</option>
                              <option value="SALDO" className="bg-gray-900 text-blue-400">SALDO</option>
                            </select>
                          </div>
                          <DetailRow icon={<Calendar size={14} />} label="Vencimiento" value={formatDate(drawerNode.extra.fecha_vencimiento)} color="#64748b" />
                          <DetailRow icon={<Calendar size={14} />} label="Transacción" value={formatDate(drawerNode.extra.fecha_transaccion)} color="#64748b" />
                          {drawerNode.extra.proyecto && (
                            <DetailRow icon={<Building2 size={14} />} label="Proyecto" value={drawerNode.extra.proyecto} color="#7c3aed" />
                          )}
                        </div>

                        {/* iOS Destructive Delete Button */}
                        <div className="pt-4 border-t border-white/[0.06] flex justify-end">
                          <button
                            onClick={() => handleDeleteNode(drawerNode.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[11px] font-semibold transition-all disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            Eliminar Registro
                          </button>
                        </div>
                      </>
                    )}

                    {/* TAREA view */}
                    {drawerNode.type === 'TAREA' && drawerNode.extra && (
                      <>
                        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-5">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] text-amber-400/60 uppercase tracking-wider font-semibold">Descripción</p>
                            {drawerNode.extra.urgente && (
                              <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md text-red-400 bg-red-500/15 border border-red-500/20 animate-pulse">
                                🔥 URGENTE
                              </span>
                            )}
                          </div>
                          <p className="text-[14px] text-amber-200/90 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: renderFormattedText(drawerNode.name) }} />
                        </div>
                        {drawerNode.extra?.notas && (
                          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-2">Detalles</p>
                            <p className="text-[12px] text-white/70 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderFormattedText(drawerNode.extra.notas) }} />
                          </div>
                        )}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="opacity-50" style={{ color: '#f59e0b' }}><CheckSquare size={14} /></span>
                              <span className="text-[11px] text-white/40">Estado</span>
                            </div>
                            <select
                              value={(drawerNode.extra.estado ?? 'PENDIENTE').toUpperCase()}
                              onChange={(e) => handleTaskStatusChange(e.target.value)}
                              disabled={saving}
                              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md cursor-pointer border"
                              style={{
                                backgroundColor: `${['PENDIENTE', 'SEGUIMIENTO', 'CULMINADO'].includes((drawerNode.extra.estado ?? 'PENDIENTE').toUpperCase()) ? ((drawerNode.extra.estado ?? 'PENDIENTE').toUpperCase() === 'PENDIENTE' ? '#f59e0b' : (drawerNode.extra.estado ?? 'PENDIENTE').toUpperCase() === 'SEGUIMIENTO' ? '#3b82f6' : '#10b981') : '#64748b'}20`,
                                color: ['PENDIENTE', 'SEGUIMIENTO', 'CULMINADO'].includes((drawerNode.extra.estado ?? 'PENDIENTE').toUpperCase()) ? ((drawerNode.extra.estado ?? 'PENDIENTE').toUpperCase() === 'PENDIENTE' ? '#f59e0b' : (drawerNode.extra.estado ?? 'PENDIENTE').toUpperCase() === 'SEGUIMIENTO' ? '#3b82f6' : '#10b981') : '#64748b',
                                borderColor: `${['PENDIENTE', 'SEGUIMIENTO', 'CULMINADO'].includes((drawerNode.extra.estado ?? 'PENDIENTE').toUpperCase()) ? ((drawerNode.extra.estado ?? 'PENDIENTE').toUpperCase() === 'PENDIENTE' ? '#f59e0b' : (drawerNode.extra.estado ?? 'PENDIENTE').toUpperCase() === 'SEGUIMIENTO' ? '#3b82f6' : '#10b981') : '#64748b'}30`,
                              }}
                            >
                              <option value="PENDIENTE" className="bg-gray-900 text-amber-400">PENDIENTE</option>
                              <option value="SEGUIMIENTO" className="bg-gray-900 text-blue-400">SEGUIMIENTO</option>
                              <option value="CULMINADO" className="bg-gray-900 text-emerald-400">CULMINADO</option>
                            </select>
                          </div>
                          <DetailRow icon={<ChevronRight size={14} />} label="Prioridad" value={drawerNode.extra.prioridad ?? '—'} color={drawerNode.extra.prioridad === 'alta' ? '#ef4444' : '#f59e0b'} badge />
                          <DetailRow icon={<Calendar size={14} />} label="Fecha límite" value={formatDate(drawerNode.extra.fecha_limite)} color="#64748b" />
                          {drawerNode.extra.proyecto && (
                            <DetailRow icon={<Building2 size={14} />} label="Proyecto" value={drawerNode.extra.proyecto} color="#7c3aed" />
                          )}
                        </div>

                        {/* iOS Destructive Delete Button */}
                        <div className="pt-4 border-t border-white/[0.06] flex justify-end">
                          <button
                            onClick={() => handleDeleteNode(drawerNode.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[11px] font-semibold transition-all disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            Eliminar Registro
                          </button>
                        </div>
                      </>
                    )}

                    {/* LIBRO view */}
                    {drawerNode.type === 'LIBRO' && drawerNode.extra && (
                      <>
                        <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-2xl p-5">
                          <p className="text-[10px] text-red-400/60 uppercase tracking-wider font-semibold mb-1">Libro</p>
                          <p className="text-[16px] font-bold text-red-200 tracking-tight leading-snug">
                            {drawerNode.extra.titulo}
                          </p>
                          {drawerNode.extra.autor && (
                            <p className="text-[12px] text-red-400/50 mt-1">
                              por {drawerNode.extra.autor}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          {/* Estado de lectura interactivo */}
                          <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[#eb5757] opacity-50"><BookOpen size={14} /></span>
                              <span className="text-[11px] text-white/40">Estado de lectura</span>
                            </div>
                            <select
                              value={drawerNode.extra.estado_lectura ?? 'PENDIENTE'}
                              disabled={saving}
                              onChange={async (e) => {
                                const newEstado = e.target.value;
                                setSaving(true);
                                try {
                                  await fetch('/api/grafo/libros', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      id: dbId(drawerNode.id),
                                      estado_lectura: newEstado,
                                    }),
                                  });
                                  const freshJson = await fetchData();
                                  if (freshJson && freshJson.nodes) {
                                    const updatedNode = freshJson.nodes.find((n: any) => n.id === drawerNode.id);
                                    if (updatedNode) setDrawerNode(updatedNode);
                                  }
                                } catch (err) {
                                  console.error('Error al actualizar estado:', err);
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              className="text-[10px] font-bold uppercase px-2 py-1 rounded-md bg-[#eb5757]/15 text-[#eb5757] border border-[#eb5757]/30 outline-none cursor-pointer"
                              style={{
                                backgroundColor: 'rgba(235, 87, 87, 0.15)',
                                color: '#eb5757',
                                borderColor: 'rgba(235, 87, 87, 0.3)',
                              }}
                            >
                              <option value="PENDIENTE">PENDIENTE</option>
                              <option value="LEYENDO">LEYENDO</option>
                              <option value="LEIDO">LEIDO</option>
                            </select>
                          </div>
                          
                          {/* Relecturas row */}
                          <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[#eb5757] opacity-50"><RotateCcw size={14} /></span>
                              <span className="text-[11px] text-white/40">Veces leído</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[13px] text-white/80 font-semibold tabular-nums">{drawerNode.extra?.veces_leido ?? 0}</span>
                              <button 
                                onClick={async () => {
                                  setSaving(true);
                                  await fetch('/api/grafo/libros', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      id: dbId(drawerNode.id),
                                      veces_leido: (drawerNode.extra?.veces_leido ?? 0) + 1,
                                    }),
                                  });
                                  const freshJson = await fetchData();
                                  if (freshJson && freshJson.nodes) {
                                    const updatedNode = freshJson.nodes.find((n: any) => n.id === drawerNode.id);
                                    if (updatedNode) setDrawerNode(updatedNode);
                                  }
                                  setSaving(false);
                                }}
                                className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/35 border border-red-500/30 text-red-300 text-[10px] font-bold rounded transition-colors"
                              >
                                +1
                              </button>
                            </div>
                          </div>

                          {/* PDF Row */}
                          <div className="flex flex-col bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className="text-[#eb5757] opacity-50"><FileText size={14} /></span>
                                <span className="text-[11px] text-white/40">Ruta PDF</span>
                              </div>
                              {drawerNode.extra.url_pdf ? (
                                <a 
                                  href={drawerNode.extra.url_pdf} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-[11px] text-red-300 hover:text-red-200 underline"
                                >
                                  Ver PDF
                                </a>
                              ) : (
                                <span className="text-[11px] text-white/20 italic">No subido</span>
                              )}
                            </div>
                            {drawerNode.extra.url_pdf && (
                              <span className="text-[10px] text-white/40 truncate select-all">{drawerNode.extra.url_pdf}</span>
                            )}
                          </div>
                        </div>

                        {/* iOS Destructive Delete Button */}
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => handleDeleteNode(drawerNode.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[11px] font-semibold transition-all disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            Eliminar Libro
                          </button>
                        </div>

                        {/* List of Quotes */}
                        <div className="space-y-3 pt-2">
                          <p className="text-[10px] text-white/25 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                            <FileText size={11} className="text-[#f2c94c]/50" /> Citas del libro
                          </p>
                          {(() => {
                            if (!data) return null;
                            const bookQuotes = data.nodes.filter(n => n.type === 'CITA' && n.extra?.libro_id === dbId(drawerNode.id));
                            return (
                              <div className="space-y-2">
                                {bookQuotes.map(q => (
                                  <div key={q.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 space-y-1.5 hover:bg-white/[0.04] transition-colors cursor-pointer"
                                       onClick={() => { setDrawerNode(q); setDrawerMode('view'); }}>
                                    <p className="text-[12px] text-white/80 leading-relaxed italic">"{q.extra?.texto}"</p>
                                    <div className="flex items-center justify-between text-[10px] text-white/40">
                                      <span>{q.extra?.pagina ? `Pág. ${q.extra.pagina}` : 'Pág. s/n'}</span>
                                      {q.extra?.comentario && <span className="truncate max-w-[200px]">{q.extra.comentario}</span>}
                                    </div>
                                  </div>
                                ))}
                                {bookQuotes.length === 0 && (
                                  <p className="text-[11px] text-white/20 italic text-center py-4 bg-white/[0.01] rounded-xl border border-dashed border-white/5">Sin citas registradas</p>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Add quote form */}
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                          <p className="text-[10px] text-red-300/80 uppercase tracking-wider font-bold">Agregar Cita</p>
                          <div className="space-y-3.5">
                            <FormField label="Cita o Frase">
                              <textarea 
                                value={newCitaTexto} 
                                onChange={(e) => setNewCitaTexto(e.target.value)} 
                                className="drawer-input min-h-[50px] resize-none py-2" 
                                placeholder="Escribe el texto de la cita..."
                              />
                            </FormField>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="col-span-1">
                                <FormField label="Página">
                                  <input 
                                    type="number" 
                                    value={newCitaPagina} 
                                    onChange={(e) => setNewCitaPagina(e.target.value)} 
                                    className="drawer-input py-1.5" 
                                    placeholder="123" 
                                  />
                                </FormField>
                              </div>
                              <div className="col-span-2">
                                <FormField label="Reflexión">
                                  <input 
                                    type="text" 
                                    value={newCitaComentario} 
                                    onChange={(e) => setNewCitaComentario(e.target.value)} 
                                    className="drawer-input py-1.5" 
                                    placeholder="Comentario personal..." 
                                  />
                                </FormField>
                              </div>
                            </div>
                            <button
                              onClick={handleCreateCita}
                              disabled={saving || !newCitaTexto.trim()}
                              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl py-2 transition-colors disabled:opacity-50"
                            >
                              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                              Guardar cita
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {/* CITA view */}
                    {drawerNode.type === 'CITA' && drawerNode.extra && (
                      <>
                        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-5">
                          <p className="text-[10px] text-amber-400/60 uppercase tracking-wider font-semibold mb-1">Cita del Libro</p>
                          <p className="text-[14px] text-amber-200/90 leading-relaxed font-medium italic">
                            "{drawerNode.extra.texto}"
                          </p>
                          {drawerNode.extra?.libro_titulo && (
                            <p className="text-[12px] text-amber-400/50 mt-2 hover:underline cursor-pointer"
                               onClick={() => {
                                 if (data) {
                                   const bookNode = data.nodes.find(n => n.id === `lib-${drawerNode.extra?.libro_id}`);
                                   if (bookNode) {
                                     setDrawerNode(bookNode);
                                     setDrawerMode('view');
                                   }
                                 }
                               }}>
                              — {drawerNode.extra?.libro_titulo}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          {drawerNode.extra.pagina && (
                            <DetailRow icon={<Hash size={14} />} label="Página" value={`Pág. ${drawerNode.extra.pagina}`} color="#f2c94c" />
                          )}
                          {drawerNode.extra.comentario && (
                            <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3.5 space-y-1">
                              <p className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Reflexión / Comentario</p>
                              <p className="text-[12px] text-white/80 leading-relaxed">{drawerNode.extra.comentario}</p>
                            </div>
                          )}
                        </div>

                        {/* iOS Destructive Delete Button */}
                        <div className="pt-4 border-t border-white/[0.06] flex justify-end">
                          <button
                            onClick={() => handleDeleteNode(drawerNode.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[11px] font-semibold transition-all disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            Eliminar Cita
                          </button>
                        </div>
                      </>
                    )}

                    {/* PROYECTO view */}
                    {drawerNode.type === 'PROYECTO' && drawerNode.extra && (
                      <>
                        <div className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/20 rounded-2xl p-5 text-left">
                          <p className="text-[10px] text-violet-400/60 uppercase tracking-wider font-semibold mb-1">Proyecto</p>
                          <p className="text-[16px] font-bold text-violet-200 tracking-tight leading-snug">
                            {drawerNode.name}
                          </p>
                          {drawerNode.extra.descripcion && (
                            <p className="text-[12px] text-white/60 mt-2 leading-relaxed font-normal">
                              {drawerNode.extra.descripcion}
                            </p>
                          )}
                        </div>
                        <div className="space-y-3 text-left">
                          <DetailRow 
                            icon={<CheckSquare size={14} />} 
                            label="Estado" 
                            value={drawerNode.extra.estado ?? 'ACTIVO'} 
                            color={
                              (drawerNode.extra.estado || '').toUpperCase() === 'ACTIVO' ? '#10b981' : 
                              (drawerNode.extra.estado || '').toUpperCase() === 'CULMINADO' ? '#64748b' : 
                              '#f59e0b'
                            } 
                            badge 
                          />
                          {drawerNode.extra.fecha_inicio && (
                            <DetailRow 
                              icon={<Calendar size={14} />} 
                              label="Fecha de Inicio" 
                              value={formatDate(drawerNode.extra.fecha_inicio)} 
                              color="#64748b" 
                            />
                          )}
                          {drawerNode.extra.fecha_fin && (
                            <DetailRow 
                              icon={<Calendar size={14} />} 
                              label="Fecha de Fin" 
                              value={formatDate(drawerNode.extra.fecha_fin)} 
                              color="#64748b" 
                            />
                          )}
                          {drawerNode.extra.fecha_inicio && (() => {
                            const isProjectCulminated = (drawerNode.extra.estado || '').toUpperCase() === 'CULMINADO';
                            if (isProjectCulminated && drawerNode.extra.fecha_fin) {
                              const totalDias = calcularDiasTotales(drawerNode.extra.fecha_inicio, drawerNode.extra.fecha_fin);
                              return (
                                <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3.5 flex justify-between items-center text-[11px]">
                                  <span className="text-white/40">⏱️ Duración Total</span>
                                  <span className="font-semibold text-white/70">{totalDias} días en total</span>
                                </div>
                              );
                            } else {
                              const diasTrans = calcularDiasTranscurridos(drawerNode.extra.fecha_inicio);
                              return (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3.5 flex justify-between items-center text-[11px]">
                                  <span className="text-amber-450 font-medium flex items-center gap-1">⏱️ Presión Temporal</span>
                                  <span className="font-bold text-amber-350">{diasTrans} días transcurridos</span>
                                </div>
                              );
                            }
                          })()}
                          {(() => {
                            const parentLink = data?.links.find(
                              (l) => {
                                const srcId = getNodeId(l.source);
                                return srcId === drawerNode.id && l.type === 'PROYECTO_DE';
                              }
                            );
                            const parentNode = parentLink 
                              ? data?.nodes.find((n) => n.id === getNodeId(parentLink.target))
                              : null;
                            
                            return parentNode ? (
                              <div 
                                className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3 cursor-pointer hover:bg-white/[0.06] transition-colors"
                                onClick={() => handleNodeClick(parentNode)}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="text-violet-400 opacity-50"><Building2 size={14} /></span>
                                  <span className="text-[11px] text-white/40">Entidad Madre</span>
                                </div>
                                <span className="text-[12px] text-violet-300 font-semibold hover:underline">
                                  {parentNode.name}
                                </span>
                              </div>
                            ) : null;
                          })()}
                        </div>

                        {/* List tasks and finances connected to this project node (only when secondary panel is closed) */}
                        {!showSecondaryPanel && (() => {
                          const connectedNodes = data?.links
                            .filter((l) => {
                              const tgtId = getNodeId(l.target);
                              return tgtId === drawerNode.id;
                            })
                            .map((l) => data.nodes.find((n) => n.id === getNodeId(l.source)))
                            .filter(Boolean) as GraphNode[];
                          
                          const allProjectTasks = (connectedNodes?.filter((n) => n.type === 'TAREA') || [])
                            .sort((a: any, b: any) => {
                              const aUrg = (a.extra?.urgente || a.extra?.prioridad === 'alta') ? 1 : 0;
                              const bUrg = (b.extra?.urgente || b.extra?.prioridad === 'alta') ? 1 : 0;
                              if (bUrg !== aUrg) return bUrg - aUrg;
                              const aId = Number(a.id.replace('tar-', ''));
                              const bId = Number(b.id.replace('tar-', ''));
                              return bId - aId;
                            });
                          const filteredTasks = allProjectTasks.filter((t: any) => {
                            const est = (t.extra?.estado || '').toUpperCase();
                            if (proyectoTaskFilter === 'PENDIENTE') return est === 'PENDIENTE';
                            if (proyectoTaskFilter === 'SEGUIMIENTO') return est === 'SEGUIMIENTO';
                            if (proyectoTaskFilter === 'CULMINADO') return est === 'CULMINADO' || isConcluida(est);
                            return true;
                          });
                          const finances = connectedNodes?.filter((n) => n.type === 'FINANZA') || [];
                          const totalGs = finances.reduce((sum, f) => sum + (f.extra?.monto ?? 0), 0);

                          return (
                            <div className="space-y-4 pt-2 text-left">
                              {allProjectTasks.length > 0 && (
                                <div className="bg-white rounded-2xl p-4 space-y-3 border border-gray-200/60 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                                      <CheckSquare size={11} className="text-violet-400" /> Tareas del Proyecto ({allProjectTasks.length})
                                    </p>
                                    <button
                                      onClick={() => setShowInlineTaskForm(!showInlineTaskForm)}
                                      className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg px-2.5 py-1.5 transition-all"
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                                      Nueva Tarea
                                    </button>
                                  </div>
                                  {/* Inline create form */}
                                  {showInlineTaskForm && (
                                    <div className="bg-gray-50 rounded-xl p-3.5 space-y-2.5 border border-gray-200/60">
                                      <textarea
                                        id="inline-task-ta"
                                        value={inlineTaskDesc}
                                        onChange={(e) => setInlineTaskDesc(e.target.value)}
                                        rows={2}
                                        className="w-full text-[12px] px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all resize-none overflow-hidden"
                                        placeholder="Ej. Crear nuevo video..."
                                        onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
                                      />
                                      <div className="flex items-center gap-1">
                                        <button type="button" onClick={() => { const ta = document.querySelector('#inline-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '**', '**'); }} className="text-[11px] font-bold px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors" title="Negrita">B</button>
                                        <button type="button" onClick={() => { const ta = document.querySelector('#inline-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '*', '*'); }} className="text-[11px] font-bold italic px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors" title="Cursiva">I</button>
                                        <button type="button" onClick={() => { const ta = document.querySelector('#inline-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '<u>', '</u>'); }} className="text-[11px] font-bold underline px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors" title="Subrayado">U</button>
                                        <button type="button" onClick={() => { const ta = document.querySelector('#inline-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '==', '=='); }} className="text-[11px] px-2 py-1 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors" title="Resaltar">🖍️</button>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <select
                                          value={inlineTaskPrioridad}
                                          onChange={(e) => setInlineTaskPrioridad(e.target.value)}
                                          className="flex-1 text-[11px] px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                                        >
                                          <option value="baja">Baja</option>
                                          <option value="media">Media</option>
                                          <option value="alta">Alta</option>
                                        </select>
                                        <input
                                          type="date"
                                          value={inlineTaskFecha}
                                          onChange={(e) => setInlineTaskFecha(e.target.value)}
                                          className="flex-1 text-[11px] px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
                                        />
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={inlineTaskUrgente}
                                            onChange={(e) => setInlineTaskUrgente(e.target.checked)}
                                            className="accent-red-500 h-3.5 w-3.5 rounded border-gray-300"
                                          />
                                          <span className="text-[11px] text-gray-600 font-medium">Marcar como Urgente</span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => { setShowInlineTaskForm(false); setInlineTaskDesc(''); setInlineTaskPrioridad('media'); setInlineTaskFecha(''); setInlineTaskUrgente(false); }}
                                            className="text-[11px] font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-all"
                                          >
                                            Cancelar
                                          </button>
                                          <button
                                            onClick={handleCreateInlineTask}
                                            disabled={saving || !inlineTaskDesc.trim()}
                                            className="flex items-center gap-1 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all"
                                          >
                                            {saving ? 'Guardando...' : 'Guardar Tarea'}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {/* Sub-tabs */}
                                  <div className="flex bg-gray-100 p-0.5 rounded-lg">
                                    {(['PENDIENTE', 'SEGUIMIENTO', 'CULMINADO'] as const).map((tab) => {
                                      const count = allProjectTasks.filter((t: any) => {
                                        const est = (t.extra?.estado || '').toUpperCase();
                                        if (tab === 'CULMINADO') return est === 'CULMINADO' || isConcluida(est);
                                        return est === tab;
                                      }).length;
                                      return (
                                        <button
                                          key={tab}
                                          onClick={() => setProyectoTaskFilter(tab)}
                                          className={`flex-1 text-[10px] py-1 rounded-md font-bold transition-all flex items-center justify-center gap-1 ${
                                            proyectoTaskFilter === tab
                                              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                                              : 'text-gray-500 hover:text-gray-700'
                                          }`}
                                        >
                                          {tab === 'PENDIENTE' && '⏳ Pendientes'}
                                          {tab === 'SEGUIMIENTO' && '🔄 Seguimiento'}
                                          {tab === 'CULMINADO' && '✅ Culminadas'}
                                          <span className={`text-[8px] px-1.5 rounded-full ${proyectoTaskFilter === tab ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-gray-500'}`}>
                                            {count}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="space-y-1.5">
                                    {filteredTasks.length === 0 && (
                                      <p className="text-[11px] text-gray-400 italic text-center py-4 border border-dashed border-gray-200 rounded-xl">Sin tareas en esta categoría</p>
                                    )}
                                    {filteredTasks.map((t: any, idx: number) => {
                                      const concluida = isConcluida(t.extra?.estado || '');
                                      return (
                                      <div 
                                        key={t.id} 
                                        className="rounded-xl p-3 transition-colors cursor-pointer bg-gray-50 border border-gray-200/80 hover:bg-gray-100"
                                        onClick={() => handleNodeClick(t)}
                                      >
                                        <p className="text-[12px] leading-snug font-medium text-gray-900">
                                          <span className="text-gray-400 mr-1.5 font-mono text-[11px]">{idx + 1}.</span>
                                          <span dangerouslySetInnerHTML={{ __html: renderFormattedText(t.name) }} />
                                        </p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                          {t.extra?.urgente && !concluida && (
                                            <span className="text-[8px] font-bold uppercase px-2 py-0.5 rounded-full text-red-700 bg-red-100 border border-red-200">
                                              🔥 URGENTE
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                    })}
                                  </div>
                                </div>
                              )}

                              {finances.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[10px] text-white/25 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                                    <DollarSign size={11} className="text-emerald-500/50" /> Cobros/Finanzas ({finances.length})
                                  </p>
                                  <div className="space-y-2">
                                    {finances.map((f) => (
                                      <div 
                                        key={f.id} 
                                        className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 hover:bg-white/[0.04] transition-colors cursor-pointer"
                                        onClick={() => handleNodeClick(f)}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <p className="text-[12px] text-white/70 font-medium leading-snug flex-1">{f.name}</p>
                                          <span className={`text-[11px] tabular-nums shrink-0 ${finanzaDateClass(f)}`}>{shortDate(getFinanceDate(f))}</span>
                                          <p className="text-[12px] text-emerald-400 font-bold tabular-nums whitespace-nowrap">{formatGs(f.extra?.monto ?? 0)}</p>
                                        </div>
                                      </div>
                                    ))}
                                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5 flex justify-between items-center">
                                      <span className="text-[11px] text-white/40">Total Cobros</span>
                                      <span className="text-[14px] font-bold text-emerald-400">{formatGs(totalGs)}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Notes Section */}
                        <div className="border-t border-white/[0.06] pt-4 space-y-2 text-left animate-fade-in">
                          <p className="text-[10px] text-white/25 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                            <span>📝 Notas de Conocimiento / Ayuda-Memoria</span>
                          </p>
                          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 min-h-[120px]">
                            {drawerNode.extra.notas ? (
                              <p className="text-[12px] text-white/80 whitespace-pre-wrap leading-relaxed break-words">
                                {drawerNode.extra.notas}
                              </p>
                            ) : (
                              <p className="text-[12px] text-white/25 italic">
                                Sin anotaciones. Hacé clic en Editar para agregar ideas o accesos...
                              </p>
                            )}
                          </div>
                        </div>

                        {/* iOS Destructive Delete Button */}
                        <div className="pt-4 border-t border-white/[0.06] flex justify-end">
                          <button
                            onClick={() => handleDeleteNode(drawerNode.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[11px] font-semibold transition-all disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            Eliminar Proyecto
                          </button>
                        </div>
                      </>
                    )}

                    {/* PROYECTO Tabs: Enlaces Hub */}
                    {drawerNode.type === 'PROYECTO' && drawerNode.extra && (
                      <div className="space-y-5 pt-4 border-t border-white/[0.06]">
                        <div className="flex bg-white/[0.03] border border-white/[0.05] p-1 rounded-xl">
                          {(['ia', 'proyectos', 'tareas', 'finanzas', 'enlaces'] as const).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setActiveDrawerTab(tab)}
                              className={`flex-1 text-[11px] py-1.5 rounded-lg font-bold transition-all capitalize ${activeDrawerTab === tab ? 'bg-violet-600 text-white shadow-md' : 'text-white/40 hover:text-white/70'}`}
                            >
                              {tab === 'ia' ? 'IA' : tab}
                            </button>
                          ))}
                        </div>

                        {activeDrawerTab === 'enlaces' && (
                          <div className="space-y-3">
                            <div className="relative">
                              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                              <input type="text" value={entityLinkSearch} onChange={(e) => setEntityLinkSearch(e.target.value)} placeholder="Buscar utilidad..." className="drawer-input py-2 pl-8 pr-3 text-[12px]" />
                            </div>
                            <div className="bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 border border-violet-500/20 rounded-xl p-3.5 space-y-2.5">
                              <p className="text-[10px] text-violet-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Plus size={11} /> Agregar Enlace
                              </p>
                              <input type="text" value={entityLinkUrl} onChange={(e) => setEntityLinkUrl(e.target.value)} className="drawer-input py-1.5 text-[12px]" placeholder="URL (https://...)" />
                              <input type="text" value={entityLinkDesc} onChange={(e) => setEntityLinkDesc(e.target.value)} className="drawer-input py-1.5 text-[12px]" placeholder="Uso o descripción (ayuda-memoria)..." />
                              <select value={entityLinkEntidadId} onChange={(e) => setEntityLinkEntidadId(e.target.value ? Number(e.target.value) : '')} className="drawer-input py-1.5 text-[11px]">
                                <option value="">— Sin entidad —</option>
                                <optgroup label="Proyectos">
                                  {allProjects.map((p: any) => <option key={`proj-${p.id}`} value={`${p.id}`}>📁 {p.nombre}</option>)}
                                </optgroup>
                                <optgroup label="Entidades">
                                  {(data?.nodes || []).filter((n: any) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type)).map((n: any) => <option key={n.id} value={dbId(n.id)}>🏢 {n.name}</option>)}
                                </optgroup>
                              </select>
                              <div className="flex items-center gap-2">
                                {isAddingCategory ? (
                                  <>
                                    <input
                                      autoFocus
                                      type="text"
                                      value={newCategoryInput}
                                      onChange={(e) => setNewCategoryInput(e.target.value)}
                                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmNewCategory(); } }}
                                      className="drawer-input py-1.5 text-[12px] flex-1"
                                      placeholder="Nombre de la categoría..."
                                    />
                                    <button onClick={handleConfirmNewCategory} disabled={!newCategoryInput.trim()} className="flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50 whitespace-nowrap">
                                      ✓ Crear
                                    </button>
                                    <button onClick={() => { setIsAddingCategory(false); setNewCategoryInput(''); }} className="flex items-center gap-1 text-[11px] font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap">
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <select value={entityLinkCat} onChange={(e) => { const v = e.target.value; if (v === '__ADD__') { setIsAddingCategory(true); } else { setEntityLinkCat(v); } }} className="drawer-input py-1.5 text-[11px] flex-1">
                                      {allCategories.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                      ))}
                                      <option value="__ADD__">➕ Agregar nueva categoría...</option>
                                    </select>
                                    <button onClick={handleAddProjectLink} disabled={saving || !entityLinkUrl.trim() || !entityLinkDesc.trim()} className="flex items-center gap-1 text-[11px] font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-lg px-3.5 py-1.5 transition-all disabled:opacity-50 whitespace-nowrap">
                                      <Plus size={12} /> Agregar
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="space-y-2">
                              {(() => {
                                const q = entityLinkSearch.toLowerCase();
                                const filtered = q ? projectEnlaces.filter((link: any) =>
                                  (link.descripcion || '').toLowerCase().includes(q) ||
                                  (link.url || '').toLowerCase().includes(q) ||
                                  (link.categoria || '').toLowerCase().includes(q)
                                ) : projectEnlaces;
                                return filtered.length > 0 ? filtered.map((link: any) => (
                                  <div key={link.id} className="flex items-start gap-2 bg-white/[0.02] border border-white/[0.05] hover:border-violet-500/30 hover:bg-white/[0.04] rounded-xl p-3 transition-all group">
                                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">{link.categoria}</span>
                                        <p className="text-[12px] font-semibold text-white/90 truncate group-hover:text-violet-300 transition-colors">{link.descripcion}</p>
                                      </div>
                                      <p className="text-[10px] text-violet-400/60 mt-1.5 truncate flex items-center gap-1"><ExternalLink size={10} />{link.url}</p>
                                    </a>
                                    <div className="flex flex-col gap-1 shrink-0">
                                      <button onClick={(e) => { e.preventDefault(); handleStartEditLink(link); }} disabled={saving} className="text-white/20 hover:text-violet-400 p-1 rounded hover:bg-white/5 transition-all" title="Editar">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                      </button>
                                      <button onClick={(e) => { e.preventDefault(); handleDeleteProjectLink(link.id); }} disabled={saving} className="text-white/20 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-all" title="Eliminar">
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                )) : <p className="text-[11px] text-white/20 italic text-center py-4">{entityLinkSearch ? 'Sin resultados' : 'Sin enlaces registrados'}</p>;
                              })()}
                            </div>
                          </div>
                        )}

                        {activeDrawerTab === 'tareas' && (() => {
                          const projId = dbId(drawerNode.id);
                          const projectTasks = (data?.links || [])
                            .filter((l: any) => {
                              const tgtId = getNodeId(l.target);
                              const srcId = getNodeId(l.source);
                              return (tgtId === drawerNode.id || srcId === drawerNode.id) && l.type === 'TAREA_DE';
                            })
                            .map((l: any) => {
                              const otherId = getNodeId(l.source) === drawerNode.id ? getNodeId(l.target) : getNodeId(l.source);
                              return data?.nodes.find((n: any) => n.id === otherId && n.type === 'TAREA');
                            })
                            .filter(Boolean)
                            .sort((a: any, b: any) => {
                              const aUrg = (a.extra?.urgente || a.extra?.prioridad === 'alta') ? 1 : 0;
                              const bUrg = (b.extra?.urgente || b.extra?.prioridad === 'alta') ? 1 : 0;
                              if (bUrg !== aUrg) return bUrg - aUrg;
                              const aId = Number(a.id.replace('tar-', ''));
                              const bId = Number(b.id.replace('tar-', ''));
                              return bId - aId;
                            });
                          return (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
                                <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Tareas</span>
                                <button
                                  onClick={() => setShowProjectTaskForm(!showProjectTaskForm)}
                                  className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/35 text-violet-300 border border-violet-500/20 transition-all"
                                >
                                  <Plus size={11} />
                                  {showProjectTaskForm ? 'Cerrar' : 'Nueva Tarea'}
                                </button>
                              </div>
                              {showProjectTaskForm && (
                                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2.5">
                                  <textarea
                                    id="entity-task-ta"
                                    value={entityTaskDesc}
                                    onChange={(e) => setEntityTaskDesc(e.target.value)}
                                    rows={2}
                                    className="drawer-input py-1.5 text-[12px] resize-none overflow-hidden"
                                    placeholder="Descripción de la tarea..."
                                    onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
                                  />
                                  <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => { const ta = document.querySelector('#entity-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '**', '**'); }} className="text-[11px] font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Negrita">B</button>
                                    <button type="button" onClick={() => { const ta = document.querySelector('#entity-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '*', '*'); }} className="text-[11px] font-bold italic px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Cursiva">I</button>
                                    <button type="button" onClick={() => { const ta = document.querySelector('#entity-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '<u>', '</u>'); }} className="text-[11px] font-bold underline px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Subrayado">U</button>
                                    <button type="button" onClick={() => { const ta = document.querySelector('#entity-task-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '==', '=='); }} className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Resaltar">🖍️</button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <select value={entityTaskPrioridad} onChange={(e) => setEntityTaskPrioridad(e.target.value)} className="drawer-input py-1.5 text-[11px]">
                                      <option value="baja">Baja</option>
                                      <option value="media">Media</option>
                                      <option value="alta">Alta</option>
                                    </select>
                                    <input type="date" value={entityTaskFecha} onChange={(e) => setEntityTaskFecha(e.target.value)} className="drawer-input py-1.5 text-[11px]" />
                                  </div>
                                  <button onClick={handleAddProjectTask} disabled={saving || !entityTaskDesc.trim()} className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl py-2 transition-colors disabled:opacity-50">
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                    Agregar Tarea
                                  </button>
                                </div>
                              )}
                              <div className="space-y-1.5">
                                {projectTasks.length === 0 ? (
                                  <p className="text-[11px] text-white/20 italic text-center py-4 border border-dashed border-white/5 rounded-xl">Sin tareas registradas</p>
                                ) : projectTasks.map((t: any) => {
                                  const concluida = isConcluida(t.extra?.estado || '');
                                  return (
                                    <div key={t.id} className={`rounded-xl p-3 cursor-pointer transition-colors ${concluida ? 'opacity-50 bg-white/[0.01] border border-white/[0.03]' : 'bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04]'}`} onClick={() => handleNodeClick(t)}>
                                      <p className={`text-[12px] leading-snug ${concluida ? 'text-white/30' : 'text-white/80'}`}><span dangerouslySetInnerHTML={{ __html: renderFormattedText(t.name) }} /></p>
                                      <div className="flex items-center gap-2 mt-1.5">
                                        {t.extra?.urgente && !concluida && <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md text-red-400 bg-red-500/15 animate-pulse">🔥 URGENTE</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {activeDrawerTab === 'finanzas' && (() => {
                          const projId = dbId(drawerNode.id);
                          const graphFinanzas = (data?.links || [])
                            .filter((l: any) => {
                              const tgtId = getNodeId(l.target);
                              const srcId = getNodeId(l.source);
                              return (tgtId === drawerNode.id || srcId === drawerNode.id) && l.type === 'COBRO_DE';
                            })
                            .map((l: any) => {
                              const otherId = getNodeId(l.source) === drawerNode.id ? getNodeId(l.target) : getNodeId(l.source);
                              return data?.nodes.find((n: any) => n.id === otherId && n.type === 'FINANZA');
                            })
                            .filter(Boolean);
                          const consolidatedFromApi: any[] = (entidadDetails?.consolidatedFinanzas || []).map((f: any) => ({
                            id: `fin-${f.id}`,
                            name: f.descripcion,
                            type: 'FINANZA',
                            extra: { monto: Number(f.monto), tipo: f.tipo, estado_pago: f.estado_pago, fecha_vencimiento: f.fecha_vencimiento },
                          }));
                          // Merge graph finanzas with consolidated child finances, deduplicate by id
                          const allFinanzas = [...graphFinanzas];
                          const existingIds = new Set(allFinanzas.map((f: any) => f.id));
                          for (const cf of consolidatedFromApi) {
                            if (!existingIds.has(cf.id)) {
                              allFinanzas.push(cf);
                              existingIds.add(cf.id);
                            }
                          }
                          allFinanzas.sort((a: any, b: any) => {
                            const aId = Number(a.id.replace('fin-', ''));
                            const bId = Number(b.id.replace('fin-', ''));
                            return bId - aId;
                          });
                          const totalGs = allFinanzas.reduce((sum: number, f: any) => sum + (f.extra?.monto ?? 0), 0);
                          const childEntityCount = entidadDetails?.childEntityIds?.length || 0;
                          return (
                            <div className="space-y-3">
                              <p className="text-[10px] text-white/25 uppercase tracking-wider font-semibold border-b border-white/[0.05] pb-2">Cobros / Finanzas{childEntityCount > 0 ? ` (consolidado: ${entidadDetails?.childEntityIds?.length || 0} sub-empresas)` : ''}</p>
                              <div className="bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 border border-violet-500/20 rounded-xl p-3.5 space-y-2.5">
                                <p className="text-[10px] text-violet-300 font-bold uppercase tracking-wider">Agregar Cobro / Monto</p>
                                <input type="text" value={entityFinDesc} onChange={(e) => setEntityFinDesc(e.target.value)} className="drawer-input py-1.5 text-[12px]" placeholder="Descripción / Concepto..." />
                                <div className="grid grid-cols-2 gap-2">
                                  <input type="number" value={entityFinMonto} onChange={(e) => setEntityFinMonto(e.target.value)} className="drawer-input py-1.5 text-[12px]" placeholder="Monto (Gs.)" />
                                  <select value={entityFinTipo} onChange={(e) => setEntityFinTipo(e.target.value)} className="drawer-input py-1.5 text-[11px]">
                                    <option value="egreso">Egreso / Pago</option>
                                    <option value="vencimiento_cliente">Cobro / Saldo</option>
                                  </select>
                                </div>
                                <input type="date" value={entityFinFecha} onChange={(e) => { setEntityFinFecha(e.target.value); if (e.target.value) { const d = new Date(e.target.value); if (!entityFinDiaVencimiento) setEntityFinDiaVencimiento(d.getDate()); if (!entityFinMesVencimiento) setEntityFinMesVencimiento(d.getMonth() + 1); } }} className="drawer-input py-1.5 text-[12px]" />
                                {/* Unidad Originadora */}
                                <select value={entityFinOrigenId} onChange={(e) => setEntityFinOrigenId(e.target.value ? Number(e.target.value) : '')} className="drawer-input py-1.5 text-[11px]">
                                  <option value="">🏢 Unidad Originadora / Beneficiario</option>
                                  {data?.nodes?.filter((n: any) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type)).map((n: any) => (
                                    <option key={n.id} value={dbId(n.id)}>{n.name}</option>
                                  ))}
                                </select>
                                {/* Recurrent toggle */}
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={entityFinRecurrente}
                                    onChange={(e) => setEntityFinRecurrente(e.target.checked)}
                                    className="accent-violet-500 h-3.5 w-3.5 rounded"
                                  />
                                  <span className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">🔄 Configurar como Movimiento Recurrente</span>
                                </label>
                                {entityFinRecurrente && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <select value={entityFinFrecuencia} onChange={(e) => { setEntityFinFrecuencia(e.target.value); if (e.target.value === 'ANUAL') { setEntityFinDiaVencimiento(''); } }} className="drawer-input py-1.5 text-[11px]">
                                      <option value="MENSUAL">Mensual</option>
                                      <option value="ANUAL">Anual</option>
                                      <option value="UNICA">Única</option>
                                    </select>
                                    {entityFinFrecuencia === 'ANUAL' ? (
                                      <div className="grid grid-cols-2 gap-1">
                                        <select value={entityFinMesVencimiento} onChange={(e) => setEntityFinMesVencimiento(e.target.value ? Number(e.target.value) : '')} className="drawer-input py-1.5 text-[11px]">
                                          <option value="">Mes</option>
                                          {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => (
                                            <option key={i + 1} value={i + 1}>{m}</option>
                                          ))}
                                        </select>
                                        <input
                                          type="number"
                                          min={1}
                                          max={31}
                                          value={entityFinDiaVencimiento}
                                          onChange={(e) => setEntityFinDiaVencimiento(e.target.value ? Number(e.target.value) : '')}
                                          className="drawer-input py-1.5 text-[12px]"
                                          placeholder="Día"
                                        />
                                      </div>
                                    ) : (
                                      <input
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={entityFinDiaVencimiento}
                                        onChange={(e) => setEntityFinDiaVencimiento(e.target.value ? Number(e.target.value) : '')}
                                        className="drawer-input py-1.5 text-[12px]"
                                        placeholder="Día de pago"
                                      />
      )}

      {/* ── Edit Finanza Modal ──────────────────────────────────────────── */}
      {editingFinanzaId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCancelEditFinanza} />
          <div className="relative bg-[#1a1a1e] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <p className="text-[10px] text-violet-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
              ✏️ Editar Movimiento
            </p>
            <input type="text" value={entityFinDesc} onChange={(e) => setEntityFinDesc(e.target.value)} className="drawer-input py-1.5 text-[12px] w-full" placeholder="Descripción / Concepto..." />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={entityFinMonto} onChange={(e) => setEntityFinMonto(e.target.value)} className="drawer-input py-1.5 text-[12px]" placeholder="Monto (Gs.)" />
              <select value={entityFinTipo} onChange={(e) => setEntityFinTipo(e.target.value)} className="drawer-input py-1.5 text-[11px]">
                <option value="egreso">Egreso / Pago</option>
                <option value="vencimiento_cliente">Cobro / Saldo</option>
              </select>
            </div>
            <input type="date" value={entityFinFecha} onChange={(e) => setEntityFinFecha(e.target.value)} className="drawer-input py-1.5 text-[12px] w-full" />
            <select value={entityFinOrigenId} onChange={(e) => setEntityFinOrigenId(e.target.value ? Number(e.target.value) : '')} className="drawer-input py-1.5 text-[11px]">
              <option value="">🏢 Unidad Originadora / Beneficiario</option>
              {data?.nodes?.filter((n: any) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type)).map((n: any) => (
                <option key={n.id} value={dbId(n.id)}>{n.name}</option>
              ))}
            </select>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={handleCancelEditFinanza} disabled={saving} className="flex items-center gap-1 text-[11px] font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap">Cancelar</button>
              <button onClick={handleSaveEditFinanza} disabled={saving || !entityFinDesc.trim() || !entityFinMonto} className="flex items-center gap-1 text-[11px] font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-lg px-3.5 py-1.5 transition-all disabled:opacity-50 whitespace-nowrap">
                {saving ? 'Guardando...' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
                                )}
                                {entityFinRecurrente && entityFinFrecuencia === 'MENSUAL' && (
                                  <>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={showCuotaLimite}
                                        onChange={(e) => setShowCuotaLimite(e.target.checked)}
                                        className="accent-violet-500 h-3.5 w-3.5 rounded"
                                      />
                                      <span className="text-[9px] text-white/40 font-semibold uppercase tracking-wider">📌 Definir límite de cuotas (Financiamiento)</span>
                                    </label>
                                    {showCuotaLimite && (
                                      <div className="grid grid-cols-2 gap-2">
                                        <input
                                          type="number"
                                          min={1}
                                          value={entityFinCuotaActual}
                                          onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ''; setEntityFinCuotaActual(v); }}
                                          className="drawer-input py-1.5 text-[12px]"
                                          placeholder="Cuota inicial. ej: 3"
                                        />
                                        <input
                                          type="number"
                                          min={1}
                                          value={entityFinCuotasTotal}
                                          onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ''; setEntityFinCuotasTotal(v); }}
                                          className="drawer-input py-1.5 text-[12px]"
                                          placeholder="Cuotas total. ej: 18"
                                        />
                                      </div>
                                    )}
                                  </>
                                )}
                                <select value={finFormProyectoId} onChange={(e) => setFinFormProyectoId(e.target.value ? Number(e.target.value) : '')} className="drawer-input py-1.5 text-[11px]">
                                  <option value="">— Asociar a Cliente / Proyecto —</option>
                                  {allProjects.map((p: any) => <option key={p.id} value={p.id}>📁 {p.nombre}</option>)}
                                </select>
                                <button onClick={handleAddProjectFinance} disabled={saving || !entityFinDesc.trim() || !entityFinMonto} className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl py-2 transition-all disabled:opacity-50">
                                  {saving ? <Loader2 size={13} className="animate-spin" /> : <DollarSign size={13} />}
                                  Registrar Movimiento
                                </button>
                              </div>
                              <div className="space-y-2">
                                {allFinanzas.length === 0 ? (
                                  <p className="text-[11px] text-white/20 italic text-center py-4 border border-dashed border-white/5 rounded-xl">Sin movimientos registrados</p>
                                ) : allFinanzas.map((f: any) => (
                                  <div key={f.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 hover:bg-white/[0.04] transition-colors cursor-pointer group" onClick={() => handleNodeClick(f)}>
                                    <div className="flex items-start justify-between gap-3">
                                          <p className="text-[12px] text-white/70 font-medium leading-snug flex-1">{f.name}</p>
                                          <span className={`text-[11px] tabular-nums shrink-0 ${finanzaDateClass(f)}`}>{shortDate(getFinanceDate(f))}</span>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[12px] text-emerald-400 font-bold tabular-nums whitespace-nowrap">{formatGs(f.extra?.monto ?? 0)}</span>
                                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                          <button onClick={() => handleStartEditFinanza(f)} disabled={saving} className="text-white/20 hover:text-violet-400 p-1 rounded hover:bg-white/5 transition-all" title="Editar">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                          </button>
                                          <button onClick={() => handleDeleteNode(`fin-${dbId(f.id)}`)} disabled={saving} className="text-white/20 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-all" title="Eliminar">
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {allFinanzas.length > 0 && (
                                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5 flex justify-between items-center">
                                    <span className="text-[11px] text-white/40">Total Cobros</span>
                                    <span className="text-[14px] font-bold text-emerald-400">{formatGs(totalGs)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {(activeDrawerTab === 'ia' || activeDrawerTab === 'proyectos') && (
                          <div className="text-center py-8 text-white/30 text-[12px] italic">
                            {activeDrawerTab === 'ia' ? 'Usá la IA desde la vista de una entidad.' :
                             'Gestioná proyectos desde la vista de una entidad.'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* LINKS master hub view */}
                    {drawerNode.type === 'LINKS' && drawerNode.extra?.enlaces && (
                      <div className="space-y-4">
                        <div className="bg-gradient-to-br from-sky-500/10 to-cyan-600/5 border border-sky-500/20 rounded-2xl p-5">
                          <p className="text-[10px] text-sky-400/60 uppercase tracking-wider font-semibold mb-1">Hub Global</p>
                          <p className="text-[16px] font-bold text-sky-200 tracking-tight leading-snug">🔗 LINKS ({drawerNode.extra.enlaces.length})</p>
                        </div>
                        <div className="relative">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                          <input type="text" value={entityLinkSearch} onChange={(e) => setEntityLinkSearch(e.target.value)} placeholder="Buscar en todos los enlaces..." className="drawer-input py-2 pl-8 pr-3 text-[12px]" />
                        </div>
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                          {(drawerNode.extra.enlaces as any[])
                            .filter((link: any) => {
                              const q = entityLinkSearch.toLowerCase();
                              if (!q) return true;
                              return (link.descripcion || '').toLowerCase().includes(q) || (link.url || '').toLowerCase().includes(q) || (link.categoria || '').toLowerCase().includes(q);
                            })
                            .map((link: any) => (
                              <div key={link.id} className="flex items-start gap-2 bg-white/[0.02] border border-white/[0.05] hover:border-sky-500/30 hover:bg-white/[0.04] rounded-xl p-3 transition-all group">
                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">{link.categoria}</span>
                                    <p className="text-[12px] font-semibold text-white/90 truncate group-hover:text-sky-300 transition-colors">{link.descripcion}</p>
                                  </div>
                                  <p className="text-[10px] text-sky-400/60 mt-1.5 truncate flex items-center gap-1"><ExternalLink size={10} />{link.url}</p>
                                  <div className="flex items-center gap-2 mt-1 text-[9px] text-white/30">
                                    {link.proyectos && <span>📁 {link.proyectos.nombre}</span>}
                                    {link.entidades && <span>🏢 {link.entidades.nombre}</span>}
                                  </div>
                                </a>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* HUB_FINANZAS — Tesorería panel */}
                    {drawerNode.type === 'HUB_FINANZAS' && data && (() => {
                      const hubFinanzas = data.links
                        .filter(l => {
                          const tgt = typeof l.target === 'string' ? l.target : l.target?.id;
                          return tgt === 'hub_finanzas';
                        })
                        .map(l => {
                          const srcId = typeof l.source === 'string' ? l.source : l.source?.id;
                          return data.nodes.find(n => n.id === srcId);
                        })
                        .filter(Boolean);

                      const getParentName = (f: any): string => {
                        const link = data.links.find(l => {
                          const src = typeof l.source === 'string' ? l.source : l.source?.id;
                          return src === f.id && l.type === 'COBRO_DE';
                        });
                        if (!link) return f.extra?.proyecto || '—';
                        const tgtId = typeof link.target === 'string' ? link.target : link.target?.id;
                        const parent = data.nodes.find(n => n.id === tgtId);
                        if (!parent) return f.extra?.proyecto || '—';
                        if (parent.type === 'PROYECTO') {
                          const entLink = data.links.find(l => {
                            const src = typeof l.source === 'string' ? l.source : l.source?.id;
                            return src === parent.id && l.type === 'PROYECTO_DE';
                          });
                          if (entLink) {
                            const entId = typeof entLink.target === 'string' ? entLink.target : entLink.target?.id;
                            const ent = data.nodes.find(n => n.id === entId);
                            if (ent) return `${ent.name} → ${parent.name}`;
                          }
                        }
                        return parent.name;
                      };

                      const tabs = [
                        { key: 'pending_in' as const, label: '📥 Cobros Pendientes', filter: (f: any) => f.extra?.tipo === 'vencimiento_cliente' && f.extra?.estado_pago === 'PENDIENTE' },
                        { key: 'pending_out' as const, label: '📤 Pagos Pendientes', filter: (f: any) => f.extra?.tipo === 'egreso' && f.extra?.estado_pago === 'PENDIENTE' },
                        { key: 'completed_in' as const, label: '✅ Cobros Concluidos', filter: (f: any) => f.extra?.tipo === 'vencimiento_cliente' && (f.extra?.estado_pago === 'COBRADO' || f.extra?.estado_pago === 'PAGADO' || f.extra?.estado_pago === 'CONCRETADO') },
                        { key: 'completed_out' as const, label: '🧾 Pagos Concluidos', filter: (f: any) => f.extra?.tipo === 'egreso' && (f.extra?.estado_pago === 'COBRADO' || f.extra?.estado_pago === 'PAGADO' || f.extra?.estado_pago === 'CONCRETADO') },
                      ] as const;

                      const activeTab = tabs.find(t => t.key === activeFinanzaTab) || tabs[0];
                      const filtered = hubFinanzas.filter(activeTab.filter).sort((a: any, b: any) => {
                        const aDate = getFinanceDate(a);
                        const bDate = getFinanceDate(b);
                        const aTs = aDate ? new Date(aDate).getTime() : Infinity;
                        const bTs = bDate ? new Date(bDate).getTime() : Infinity;
                        return aTs - bTs;
                      });
                      const total = filtered.reduce((s, f: any) => s + (Number(f.extra?.monto) || 0), 0);

                      return (
                        <div className="space-y-4">
                          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-600/5 border border-emerald-500/20 rounded-2xl p-5">
                            <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-semibold mb-1">Tesorería</p>
                            <p className="text-[16px] font-bold text-emerald-200 tracking-tight leading-snug">💳 FINANZAS / TESORERÍA ({hubFinanzas.length})</p>
                          </div>

                          {/* Sub-tabs */}
                          <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.05] rounded-xl overflow-x-auto">
                            {tabs.map(tab => (
                              <button key={tab.key} onClick={() => setActiveFinanzaTab(tab.key)}
                                className={`px-3 py-1.5 text-[11px] font-medium rounded-lg whitespace-nowrap transition-all ${activeFinanzaTab === tab.key ? 'bg-emerald-500/20 text-emerald-300 shadow-sm' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}>
                                {tab.label}
                              </button>
                            ))}
                          </div>

                          {/* Summary row */}
                          <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-2.5">
                            <span className="text-[11px] text-white/40">{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
                            <span className="text-[13px] font-bold text-emerald-400 tabular-nums">{formatGs(total)}</span>
                          </div>

                          {/* Table */}
                          <div className="overflow-x-auto rounded-xl border border-white/[0.05]">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="bg-white/[0.03] border-b border-white/[0.05]">
                                  <th className="text-left px-3 py-2 text-white/30 font-medium w-8">N.º</th>
                                  <th className="text-left px-3 py-2 text-white/30 font-medium">Empresa / Persona</th>
                                  <th className="text-left px-3 py-2 text-white/30 font-medium">Beneficiario</th>
                                  <th className="text-left px-3 py-2 text-white/30 font-medium">Concepto</th>
                                  <th className="text-left px-3 py-2 text-white/30 font-medium">Fecha</th>
                                  <th className="text-right px-3 py-2 text-white/30 font-medium">Monto</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filtered.length === 0 ? (
                                  <tr>
                                    <td colSpan={6} className="text-center py-8 text-white/20 italic">Sin registros</td>
                                  </tr>
                                ) : filtered.map((f: any, i: number) => (
                                  <tr key={f.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer"
                                    onClick={() => { setHubContextNode(drawerNode); setDrawerNode(f); setDrawerMode('view'); }}>
                                    <td className="px-3 py-2.5 text-white/20 tabular-nums">{i + 1}</td>
                                    <td className="px-3 py-2.5 text-white/60 font-medium max-w-[140px] truncate">{getParentName(f)}</td>
                                    <td className="px-3 py-2.5 text-white/60 max-w-[120px] truncate">{f.extra?.entidad_origen_nombre || '—'}</td>
                                    <td className="px-3 py-2.5 text-white/70 max-w-[200px] truncate">{f.name}</td>
                                    <td className={`px-3 py-2.5 tabular-nums ${finanzaDateClass(f)}`}>{shortDate(getFinanceDate(f))}</td>
                                    <td className="px-3 py-2.5 text-right text-emerald-400 font-bold tabular-nums whitespace-nowrap">{formatGs(Number(f.extra?.monto) || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ENTIDAD (EMPRESA / PERSONA / SERVICIO) view */}
                    {['EMPRESA', 'PERSONA', 'SERVICIO'].includes(drawerNode.type) && (
                      <div className="space-y-5">
                        {/* Entity details summary */}
                        <div className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/20 rounded-2xl p-5">
                          <p className="text-[10px] text-violet-400/60 uppercase tracking-wider font-semibold mb-1">Entidad</p>
                          <p className="text-[16px] font-bold text-violet-200 tracking-tight leading-snug">
                            {drawerNode.name}
                          </p>
                          <p className="text-[12px] text-violet-400/50 mt-1">
                            Tipo: {drawerNode.type}
                          </p>
                        </div>

                        {/* Loading indicator */}
                        {loadingDetails && (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 size={18} className="animate-spin text-violet-400" />
                          </div>
                        )}

                        {/* Tabs list (iOS style) */}
                        {!loadingDetails && entidadDetails && (
                          <>
                            {/* ═══ TAREAS URGENTES INTERCONECTADAS ═══ */}
                            {(() => {
                              const urgentTasks: any[] = [];
                              if (entidadDetails.proyectos) {
                                entidadDetails.proyectos.forEach((proj: any) => {
                                  if (proj.tareas) {
                                    proj.tareas.forEach((t: any) => {
                                      if (t.urgente) {
                                        urgentTasks.push({
                                          ...t,
                                          proyectoNombre: proj.nombre,
                                          proyectoId: proj.id,
                                        });
                                      }
                                    });
                                  }
                                });
                              }
                              if (entidadDetails.tareasUrgentesClientes) {
                                entidadDetails.tareasUrgentesClientes.forEach((t: any) => {
                                  const ent = t.proyectos?.entidades;
                                  let clienteNombre = ent?.nombre || '';
                                  if (ent?.metadatos?.alias && Array.isArray(ent.metadatos.alias) && ent.metadatos.alias.length > 0) {
                                    const rawAlias = ent.metadatos.alias[0];
                                    clienteNombre = rawAlias.charAt(0).toUpperCase() + rawAlias.slice(1);
                                  }

                                  const projName = t.proyectos?.nombre || '';
                                  const proyectoNombre = projName.toUpperCase() === 'POSICIONAMIENTO SEO' ? 'SEO' : projName;

                                  urgentTasks.push({
                                    ...t,
                                    proyectoClientePrefix: `[${clienteNombre} - ${proyectoNombre}] `,
                                    proyectoNombre: proyectoNombre,
                                    proyectoId: t.proyecto_id,
                                  });
                                });
                              }
                              if (urgentTasks.length === 0) return null;
                              return (
                                <div className="bg-gradient-to-br from-red-500/10 to-orange-600/5 border border-red-500/25 rounded-2xl p-4 space-y-3 animate-fade-in">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[16px] animate-pulse">🔥</span>
                                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-400">
                                        Tareas Urgentes ({urgentTasks.length})
                                      </span>
                                    </div>
                                    <span className="text-[9px] text-red-400/60 uppercase tracking-wider font-semibold">Interconectadas</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {urgentTasks.map((task) => (
                                      <div
                                        key={task.id}
                                        className="flex items-start justify-between gap-2 bg-red-500/[0.06] border border-red-500/15 rounded-xl p-3 hover:bg-red-500/[0.1] transition-all group text-left"
                                      >
                                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                          <input
                                            type="checkbox"
                                            checked={isConcluida(task.estado)}
                                            disabled={saving}
                                            onChange={() => handleToggleTaskCheckbox(task)}
                                            className="accent-red-500 h-3.5 w-3.5 mt-0.5 rounded cursor-pointer shrink-0"
                                          />
                                          <div className="min-w-0">
                                            <p className="text-[12px] leading-snug font-semibold text-white/85 break-words">
                                              {task.proyectoClientePrefix && (
                                                <span className="text-red-400 font-bold mr-1">{task.proyectoClientePrefix}</span>
                                              )}
                                              {task.descripcion}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                              <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md text-red-400 bg-red-500/15 border border-red-500/20">
                                                🔥 URGENTE
                                              </span>
                                              <span className="text-[8px] text-white/40 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md truncate max-w-[120px]" title={task.proyectoNombre}>
                                                📁 {task.proyectoNombre}
                                              </span>
                                              {task.fecha_limite && (
                                                <span className="text-[8px] text-white/35 flex items-center gap-0.5">
                                                  📅 {formatDate(task.fecha_limite)}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                          <button
                                            onClick={async () => {
                                              setSaving(true);
                                              try {
                                                await fetch('/api/grafo/tareas', {
                                                  method: 'PATCH',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({ id: task.id, urgente: false }),
                                                });
                                                await fetchData();
                                                const numericId = dbId(drawerNode.id);
                                                const detailRes = await fetch(`/api/grafo/entidad?id=${numericId}`);
                                                const detailData = await detailRes.json();
                                                setEntidadDetails(detailData);
                                              } catch (err) { console.error(err); }
                                              finally { setSaving(false); }
                                            }}
                                            disabled={saving}
                                            title="Quitar urgencia"
                                            className="text-red-400/60 hover:text-red-300 p-1 rounded hover:bg-red-500/10 transition-all text-[10px] font-bold"
                                          >
                                            ❌
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                             <div className="flex bg-white/[0.03] border border-white/[0.05] p-1 rounded-xl">
                              {(['ia', 'proyectos', 'tareas', 'finanzas', 'enlaces'] as const).map((tab) => (
                                <button
                                  key={tab}
                                  onClick={() => setActiveDrawerTab(tab)}
                                  className={`flex-1 text-[11px] py-1.5 rounded-lg font-bold transition-all capitalize ${activeDrawerTab === tab ? 'bg-violet-600 text-white shadow-md' : 'text-white/40 hover:text-white/70'}`}
                                >
                                  {tab === 'ia' ? 'IA' : tab}
                                </button>
                              ))}
                            </div>

                            {/* TAB: Carga Inteligente (IA) */}
                            {activeDrawerTab === 'ia' && (
                              <div className="space-y-4">
                                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 space-y-3">
                                  <div className="flex items-center gap-1.5 text-violet-300 font-semibold text-[11px]">
                                    <Sparkles size={13} />
                                    <span>Carga Inteligente con IA (DeepSeek)</span>
                                  </div>
                                  <textarea
                                    value={iaPromptInput}
                                    onChange={(e) => setIaPromptInput(e.target.value)}
                                    className="drawer-input min-h-[80px] resize-none py-2 text-[12px]"
                                    placeholder="Escribe lo que deseas registrar o consultar para esta entidad (ej: 'Recordar pagar hosting de nix mañana y cobrar Gs. 350.000')"
                                  />
                                  <button
                                    onClick={handleEntityIaSubmit}
                                    disabled={saving || !iaPromptInput.trim()}
                                    className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl py-2 transition-colors disabled:opacity-50"
                                  >
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                    Procesar con IA
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* TAB: Proyectos */}
                            {activeDrawerTab === 'proyectos' && (
                              <div className="space-y-4 text-left">
                                <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
                                  <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Módulo de Proyectos</span>
                                  <button
                                    onClick={() => setShowNewProjectForm(!showNewProjectForm)}
                                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/35 text-violet-300 border border-violet-500/20 transition-all"
                                  >
                                    <Plus size={11} />
                                    <span>+ Nuevo Proyecto</span>
                                  </button>
                                </div>

                                {showNewProjectForm && (
                                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3 mb-4 text-left">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] text-violet-300 font-bold uppercase tracking-wider">Detalles del Proyecto</p>
                                      <button onClick={() => setShowNewProjectForm(false)} className="text-white/30 hover:text-white/60 text-[10px] font-semibold">Cancelar</button>
                                    </div>
                                    <div className="space-y-3">
                                      <FormField label="Nombre del Proyecto">
                                        <input
                                          type="text"
                                          value={newProjectName}
                                          onChange={(e) => setNewProjectName(e.target.value)}
                                          className="drawer-input py-1.5 text-[12px]"
                                          placeholder="Ej: REDISEÑO WEB..."
                                        />
                                      </FormField>
                                      
                                      <FormField label="Descripción">
                                        <textarea
                                          value={newProjectDesc}
                                          onChange={(e) => setNewProjectDesc(e.target.value)}
                                          className="drawer-input min-h-[50px] resize-none py-2 text-[12px]"
                                          placeholder="Descripción del proyecto..."
                                        />
                                      </FormField>
                                      
                                      <FormField label="Estado Inicial">
                                        <select
                                          value={newProjectEstado || 'ACTIVO'}
                                          onChange={(e) => setNewProjectEstado(e.target.value)}
                                          className="drawer-input py-1.5 text-[11px]"
                                        >
                                          <option value="ACTIVO">Activo</option>
                                          <option value="CULMINADO">Culminado</option>
                                          <option value="PAUSADO">Pausado</option>
                                        </select>
                                      </FormField>

                                      <div className="grid grid-cols-2 gap-2">
                                        <FormField label="Fecha de Inicio">
                                          <input
                                            type="date"
                                            value={newProjectFechaInicio}
                                            onChange={(e) => setNewProjectFechaInicio(e.target.value)}
                                            className="drawer-input py-1.5 text-[11px]"
                                          />
                                        </FormField>
                                        <FormField label="Fecha de Fin">
                                          <input
                                            type="date"
                                            value={newProjectFechaFin}
                                            onChange={(e) => setNewProjectFechaFin(e.target.value)}
                                            className="drawer-input py-1.5 text-[11px]"
                                          />
                                        </FormField>
                                      </div>
                                      
                                      <FormField label="Notas de Conocimiento / Ayuda-Memoria">
                                        <textarea
                                          value={newProjectNotas}
                                          onChange={(e) => setNewProjectNotas(e.target.value)}
                                          className="drawer-input min-h-[100px] resize-y py-2 text-[12px]"
                                          placeholder="Ideas, accesos, notas extensas del proyecto..."
                                        />
                                      </FormField>

                                      <button
                                        onClick={handleAddEntityProject}
                                        disabled={saving || !newProjectName.trim()}
                                        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl py-2 transition-colors disabled:opacity-50"
                                      >
                                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                        Guardar Proyecto
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Projects List */}
                                <div className="space-y-2.5">
                                  {(!entidadDetails.proyectos || entidadDetails.proyectos.length === 0) ? (
                                    <p className="text-[11px] text-white/30 italic text-center py-6 border border-dashed border-white/5 rounded-xl">
                                      Sin proyectos registrados en esta entidad.
                                    </p>
                                  ) : (
                                    entidadDetails.proyectos.map((proj: any) => {
                                      const isExpanded = expandedProjectId === proj.id;
                                      const pendingTasksCount = proj.tareas ? proj.tareas.filter((t: any) => isPendiente(t.estado)).length : 0;
                                      const financesCount = proj.finanzas ? proj.finanzas.length : 0;

                                      return (
                                        <div
                                          key={proj.id}
                                          className={`bg-white/[0.02] border rounded-xl p-3.5 hover:bg-white/[0.04] transition-all group cursor-pointer ${isExpanded ? 'border-violet-500/40 bg-white/[0.03]' : 'border-white/[0.05]'}`}
                                          onClick={() => {
                                            setExpandedProjectId(isExpanded ? null : proj.id);
                                            focusNodeById(`proj-${proj.id}`);
                                          }}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2">
                                                <h4 className="text-[13px] font-bold text-white/90 truncate">{proj.nombre}</h4>
                                                <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                                  (proj.metadatos?.estado === 'activo' || proj.metadatos?.estado === 'ACTIVO') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                                                  (proj.metadatos?.estado === 'completado' || proj.metadatos?.estado === 'COMPLETADO') ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15' :
                                                  'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                                                }`}>
                                                  {proj.metadatos?.estado || 'activo'}
                                                </span>
                                              </div>

                                              {proj.descripcion && !isExpanded && (
                                                <p className="text-[11px] text-white/40 truncate mt-1">{proj.descripcion}</p>
                                              )}

                                              {/* Expanded details */}
                                              {isExpanded && (
                                                <div className="mt-2.5 space-y-2 border-t border-white/[0.04] pt-2.5 text-[11px] text-white/60 animate-fade-in">
                                                  {proj.descripcion && (
                                                    <p className="leading-relaxed font-normal text-white/70">{proj.descripcion}</p>
                                                  )}
                                                  <div className="flex flex-wrap gap-2 pt-1">
                                                    <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px]">
                                                      ⏳ {pendingTasksCount} tareas pendientes
                                                    </span>
                                                    <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px]">
                                                      💰 {financesCount} cobros/finanzas
                                                    </span>
                                                  </div>
                                                  <div className="flex gap-2 justify-end pt-1">
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const projNode = data?.nodes.find(n => n.id === `proj-${proj.id}`);
                                                        if (projNode) {
                                                          setDrawerNode(projNode);
                                                          setDrawerMode('view');
                                                        }
                                                      }}
                                                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-violet-500/30 bg-violet-600/10 hover:bg-violet-600/25 text-violet-300 transition-all"
                                                    >
                                                      Ver Proyecto en Detalle
                                                    </button>
                                                  </div>
                                                </div>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteNode(`proj-${proj.id}`);
                                                }}
                                                disabled={saving}
                                                title="Eliminar proyecto"
                                                className="text-white/35 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-all"
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )}

                            {/* TAB: Tareas */}
                            {activeDrawerTab === 'tareas' && (() => {
                              // Consolidate all tasks from all projects of the entity
                              const allTasks: any[] = [];
                              if (entidadDetails && entidadDetails.proyectos) {
                                entidadDetails.proyectos.forEach((proj: any) => {
                                  if (proj.tareas) {
                                    proj.tareas.forEach((t: any) => {
                                      allTasks.push({
                                        ...t,
                                        proyectoNombre: proj.nombre,
                                        proyectoId: proj.id
                                      });
                                    });
                                  }
                                });
                              }

                              // Add interconnected urgent tasks from clients
                              if (entidadDetails && (entidadDetails as any).tareasUrgentesClientes) {
                                (entidadDetails as any).tareasUrgentesClientes.forEach((t: any) => {
                                  const ent = t.proyectos?.entidades;
                                  let clienteNombre = ent?.nombre || '';
                                  if (ent?.metadatos?.alias && Array.isArray(ent.metadatos.alias) && ent.metadatos.alias.length > 0) {
                                    const rawAlias = ent.metadatos.alias[0];
                                    clienteNombre = rawAlias.charAt(0).toUpperCase() + rawAlias.slice(1);
                                  }

                                  const projName = t.proyectos?.nombre || '';
                                  const proyectoNombre = projName.toUpperCase() === 'POSICIONAMIENTO SEO' ? 'SEO' : projName;

                                  allTasks.push({
                                    ...t,
                                    proyectoClientePrefix: `[${clienteNombre} - ${proyectoNombre}] `,
                                    proyectoNombre: proyectoNombre,
                                    proyectoId: t.proyecto_id
                                  });
                                });
                              }

                              // Sort all tasks by id descending (newest first), urgentes on top
                              allTasks.sort((a: any, b: any) => {
                                const aUrg = (a.urgente || a.prioridad === 'alta') ? 1 : 0;
                                const bUrg = (b.urgente || b.prioridad === 'alta') ? 1 : 0;
                                if (bUrg !== aUrg) return bUrg - aUrg;
                                return b.id - a.id;
                              });

                              const pendientes = allTasks.filter(t => isPendiente(t.estado));
                              const enSeguimiento = allTasks.filter(t => isSeguimiento(t.estado));
                              const concluidas = allTasks.filter(t => isConcluida(t.estado));

                              return (
                                <div className="space-y-4 text-left">
                                  {/* Nueva Tarea Trigger & Form */}
                                  <div className="flex items-center justify-between border-b border-white/[0.05] pb-2">
                                    <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Módulo de Tareas</span>
                                    <button
                                      onClick={() => setShowNewTaskForm(!showNewTaskForm)}
                                      className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/35 text-violet-300 border border-violet-500/20 transition-all"
                                    >
                                      <Plus size={11} />
                                      <span>Nueva Tarea</span>
                                    </button>
                                  </div>

                                  {showNewTaskForm && (
                                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-3 mb-4">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[10px] text-violet-300 font-bold uppercase tracking-wider">Detalles de la Tarea</p>
                                        <button onClick={() => setShowNewTaskForm(false)} className="text-white/30 hover:text-white/60 text-[10px] font-semibold">Cancelar</button>
                                      </div>
                                      <div className="space-y-3">
                                        <FormField label="Descripción / Tarea">
                                          <input
                                            type="text"
                                            value={newTaskDesc}
                                            onChange={(e) => setNewTaskDesc(e.target.value)}
                                            className="drawer-input py-1.5 text-[12px]"
                                            placeholder="Ej: Revisar presupuesto final..."
                                          />
                                        </FormField>
                                        
                                        <div className="grid grid-cols-2 gap-2">
                                          <FormField label="Prioridad">
                                            <select
                                              value={newTaskPrioridad}
                                              onChange={(e) => setNewTaskPrioridad(e.target.value)}
                                              className="drawer-input py-1.5 text-[11px]"
                                            >
                                              <option value="baja">Baja</option>
                                              <option value="media">Media</option>
                                              <option value="alta">Alta</option>
                                            </select>
                                          </FormField>
                                          
                                          <FormField label="Estado Inicial">
                                            <select
                                              value={newTaskEstado}
                                              onChange={(e) => setNewTaskEstado(e.target.value)}
                                              className="drawer-input py-1.5 text-[11px]"
                                            >
                                              <option value="PENDIENTE">⏳ Pendiente</option>
                                              <option value="SEGUIMIENTO">🔄 En Seguimiento</option>
                                              <option value="CULMINADO">✅ Culminado</option>
                                            </select>
                                          </FormField>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                          <FormField label="Proyecto">
                                            <select
                                              value={newTaskProjectId}
                                              onChange={(e) => setNewTaskProjectId(Number(e.target.value))}
                                              className="drawer-input py-1.5 text-[11px]"
                                            >
                                              <option value="" disabled>Seleccionar proyecto...</option>
                                              {allProjects.map((p: any) => (
                                                <option key={p.id} value={p.id}>
                                                  {p.nombre}{p.entidades ? ` (${p.entidades.nombre})` : ''}
                                                </option>
                                              ))}
                                            </select>
                                          </FormField>
                                          
                                          <FormField label="Fecha límite">
                                            <input
                                              type="date"
                                              value={newTaskFecha}
                                              onChange={(e) => setNewTaskFecha(e.target.value)}
                                              className="drawer-input py-1.5 text-[11px]"
                                            />
                                          </FormField>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                          <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                              type="checkbox"
                                              checked={newTaskUrgente}
                                              onChange={(e) => setNewTaskUrgente(e.target.checked)}
                                              className="accent-red-500 h-3.5 w-3.5 rounded cursor-pointer"
                                            />
                                            <span className="text-[10px] font-bold text-red-400">🔥 Marcar como Urgente</span>
                                          </label>
                                        </div>

                                        <button
                                          onClick={handleAddEntityTask}
                                          disabled={saving || !newTaskDesc.trim() || !newTaskProjectId}
                                          className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl py-2 transition-colors disabled:opacity-50"
                                        >
                                          {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                          Crear Tarea
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Rendering the 3 groups */}
                                  {allTasks.length === 0 ? (
                                    <p className="text-[11px] text-white/20 italic text-center py-6 border border-dashed border-white/5 rounded-xl">
                                      Sin tareas registradas en esta entidad
                                    </p>
                                  ) : (
                                    <div className="space-y-6">
                                      {/* SECTION: PENDIENTES */}
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                                          <span>⏳ Pendientes</span>
                                          <span className="bg-amber-400/10 text-amber-400 px-1.5 py-0.5 rounded text-[9px] border border-amber-500/10">{pendientes.length}</span>
                                        </div>
                                        <div className="space-y-1.5">
                                          {pendientes.map(task => renderTaskItem(task))}
                                          {pendientes.length === 0 && (
                                            <p className="text-[10px] text-white/20 italic pl-1">No hay tareas pendientes</p>
                                          )}
                                        </div>
                                      </div>

                                      {/* SECTION: SEGUIMIENTO */}
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-violet-400">
                                          <span>🔄 En Seguimiento</span>
                                          <span className="bg-violet-400/10 text-violet-400 px-1.5 py-0.5 rounded text-[9px] border border-violet-500/10">{enSeguimiento.length}</span>
                                        </div>
                                        <div className="space-y-1.5">
                                          {enSeguimiento.map(task => renderTaskItem(task))}
                                          {enSeguimiento.length === 0 && (
                                            <p className="text-[10px] text-white/20 italic pl-1">No hay tareas en seguimiento</p>
                                          )}
                                        </div>
                                      </div>

                                      {/* SECTION: CONCLUIDAS */}
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                          <span>✅ Concluidas / Historial</span>
                                          <span className="bg-emerald-400/10 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] border border-emerald-500/10">{concluidas.length}</span>
                                        </div>
                                        <div className="space-y-1.5">
                                          {concluidas.map(task => renderTaskItem(task))}
                                          {concluidas.length === 0 && (
                                            <p className="text-[10px] text-white/20 italic pl-1">No hay tareas concluidas</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* TAB: Finanzas */}
                            {activeDrawerTab === 'finanzas' && (
                              <div className="space-y-4">
                                {/* Unified Add Form */}
                                <div className="bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 border border-violet-500/20 rounded-xl p-3.5 space-y-2.5">
                                  <p className="text-[10px] text-violet-300 font-bold uppercase tracking-wider">Cargar Monto / Cobro</p>
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => setFinFormIsDirect(true)} className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${finFormIsDirect ? 'bg-violet-600 text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/70'}`}>Directo a la Empresa</button>
                                    <button type="button" onClick={() => setFinFormIsDirect(false)} className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${!finFormIsDirect ? 'bg-violet-600 text-white' : 'bg-white/[0.04] text-white/40 hover:text-white/70'}`}>A un Proyecto</button>
                                  </div>
                                  <input type="text" value={entityFinDesc} onChange={(e) => setEntityFinDesc(e.target.value)} className="drawer-input py-1.5 text-[12px]" placeholder="Descripción/Concepto..." />
                                  <div className="grid grid-cols-2 gap-2">
                                    <input type="number" value={entityFinMonto} onChange={(e) => setEntityFinMonto(e.target.value)} className="drawer-input py-1 text-[11px]" placeholder="Monto (Gs)..." />
                                    <select value={entityFinTipo} onChange={(e) => setEntityFinTipo(e.target.value)} className="drawer-input py-1 text-[11px]">
                                      <option value="vencimiento_cliente">Cobro Cliente</option>
                                      <option value="caja_interna">Caja Interna</option>
                                      <option value="egreso">Egreso/Servicio</option>
                                    </select>
                                  </div>
                                  {!finFormIsDirect && (
                                    <select value={finFormProyectoId} onChange={(e) => setFinFormProyectoId(e.target.value ? Number(e.target.value) : '')} className="drawer-input py-1.5 text-[11px]">
                                      <option value="">— Seleccionar Proyecto —</option>
                                      {entidadDetails.proyectos?.map((p: any) => <option key={p.id} value={p.id}>📁 {p.nombre}</option>)}
                                    </select>
                                  )}
                                  <input type="date" value={entityFinFecha} onChange={(e) => { setEntityFinFecha(e.target.value); if (e.target.value) { const d = new Date(e.target.value); if (!entityFinDiaVencimiento) setEntityFinDiaVencimiento(d.getDate()); if (!entityFinMesVencimiento) setEntityFinMesVencimiento(d.getMonth() + 1); } }} className="drawer-input py-1.5 text-[11px]" />
                                  <select value={entityFinOrigenId} onChange={(e) => setEntityFinOrigenId(e.target.value ? Number(e.target.value) : '')} className="drawer-input py-1.5 text-[11px]">
                                    <option value="">🏢 Unidad Originadora / Beneficiario</option>
                                    {data?.nodes?.filter((n: any) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type)).map((n: any) => (
                                      <option key={n.id} value={dbId(n.id)}>{n.name}</option>
                                    ))}
                                  </select>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={entityFinRecurrente} onChange={(e) => setEntityFinRecurrente(e.target.checked)} className="accent-violet-500 h-3.5 w-3.5 rounded" />
                                    <span className="text-[9px] text-white/50 font-semibold uppercase tracking-wider">🔄 Configurar como Movimiento Recurrente</span>
                                  </label>
                                  {entityFinRecurrente && (
                                    <div className="grid grid-cols-2 gap-2">
                                      <select value={entityFinFrecuencia} onChange={(e) => { setEntityFinFrecuencia(e.target.value); if (e.target.value === 'ANUAL') { setEntityFinDiaVencimiento(''); } }} className="drawer-input py-1 text-[11px]">
                                        <option value="MENSUAL">Mensual</option>
                                        <option value="ANUAL">Anual</option>
                                        <option value="UNICA">Única</option>
                                      </select>
                                      {entityFinFrecuencia === 'ANUAL' ? (
                                        <div className="grid grid-cols-2 gap-1">
                                          <select value={entityFinMesVencimiento} onChange={(e) => setEntityFinMesVencimiento(e.target.value ? Number(e.target.value) : '')} className="drawer-input py-1 text-[11px]">
                                            <option value="">Mes</option>
                                            {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => (
                                              <option key={i + 1} value={i + 1}>{m}</option>
                                            ))}
                                          </select>
                                          <input type="number" min={1} max={31} value={entityFinDiaVencimiento} onChange={(e) => setEntityFinDiaVencimiento(e.target.value ? Number(e.target.value) : '')} className="drawer-input py-1 text-[11px]" placeholder="Día" />
                                        </div>
                                      ) : (
                                        <input type="number" min={1} max={31} value={entityFinDiaVencimiento} onChange={(e) => setEntityFinDiaVencimiento(e.target.value ? Number(e.target.value) : '')} className="drawer-input py-1 text-[11px]" placeholder="Día de pago" />
                                      )}
                                    </div>
                                  )}
                                  {entityFinRecurrente && entityFinFrecuencia === 'MENSUAL' && (
                                    <>
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={showCuotaLimite} onChange={(e) => setShowCuotaLimite(e.target.checked)} className="accent-violet-500 h-3.5 w-3.5 rounded" />
                                        <span className="text-[8px] text-white/40 font-semibold uppercase tracking-wider">📌 Definir límite de cuotas (Financiamiento)</span>
                                      </label>
                                      {showCuotaLimite && (
                                        <div className="grid grid-cols-2 gap-2">
                                          <input type="number" min={1} value={entityFinCuotaActual} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ''; setEntityFinCuotaActual(v); }} className="drawer-input py-1 text-[11px]" placeholder="Cuota inicial. ej: 3" />
                                          <input type="number" min={1} value={entityFinCuotasTotal} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : ''; setEntityFinCuotasTotal(v); }} className="drawer-input py-1 text-[11px]" placeholder="Cuotas total. ej: 18" />
                                        </div>
                                      )}
                                    </>
                                  )}
                                  <button
                                    onClick={finFormIsDirect ? handleAddDirectEntityFinance : (() => {
                                      if (!finFormProyectoId) return;
                                      handleAddEntityFinance(Number(finFormProyectoId));
                                    })}
                                    disabled={saving || !entityFinDesc.trim() || !entityFinMonto || (!finFormIsDirect && !finFormProyectoId)}
                                    className="w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-lg py-1.5 transition-colors disabled:opacity-50"
                                  >
                                    <Plus size={11} />
                                    {finFormIsDirect ? 'Agregar Directo' : 'Agregar a Proyecto'}
                                  </button>
                                </div>

                                {/* Direct Finances Section */}
                                {(entidadDetails.directFinanzas?.length > 0) && (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400/70 border-b border-emerald-500/10 pb-1">
                                      <span>⚡ Directo a la Empresa</span>
                                      <span className="text-[10px] text-white/30 font-normal">{entidadDetails.directFinanzas.length} registros</span>
                                    </div>
                                    <div className="space-y-2">
                                      {entidadDetails.directFinanzas.map((fin: any) => (
                                        <div key={fin.id} className="flex items-start justify-between gap-3 bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
                                          <div>
                                            <p className="text-[12px] font-semibold text-white/80">{fin.descripcion}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                              <span className="text-[12px] font-bold text-emerald-400">{formatGs(Number(fin.monto))}</span>
                                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-white/40">{fin.tipo}</span>
                                              <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${(fin.estado_pago ?? '').toUpperCase() === 'PENDIENTE' ? 'bg-amber-500/10 text-amber-400' : (fin.estado_pago ?? '').toUpperCase() === 'SALDO' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                {(fin.estado_pago ?? '').toUpperCase()}
                                              </span>
                                              <span className={`text-[10px] tabular-nums ${shortDateClass(fin.fecha_vencimiento) || 'text-white/30'}`}>
                                                {shortDate(fin.fecha_vencimiento)}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 self-center">
                                            <button onClick={() => handleStartEditFinanza(fin)} disabled={saving} className="text-white/20 hover:text-violet-400 p-0.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                            <button onClick={() => handleDeleteNode(`fin-${fin.id}`)} disabled={saving} className="text-white/20 hover:text-red-400 p-0.5"><Trash2 size={12} /></button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Per-Project Sections */}
                                {entidadDetails.proyectos?.map((proj: any) => (
                                  <div key={proj.id} className="space-y-3">
                                    <div className="flex items-center justify-between text-[11px] font-semibold text-white/50 border-b border-white/5 pb-1">
                                      <span>Proyecto: {proj.nombre}</span>
                                      <span className="text-[10px] text-white/30 font-normal">{proj.finanzas?.length || 0} registros</span>
                                    </div>
                                    <div className="space-y-2">
                                      {proj.finanzas?.length > 0 ? proj.finanzas.map((fin: any) => (
                                        <div key={fin.id} className="flex items-start justify-between gap-3 bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
                                          <div>
                                            <p className="text-[12px] font-semibold text-white/80">{fin.descripcion}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                              <span className="text-[12px] font-bold text-emerald-400">{formatGs(Number(fin.monto))}</span>
                                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-white/40">{fin.tipo}</span>
                                              <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded ${(fin.estado_pago ?? '').toUpperCase() === 'PENDIENTE' ? 'bg-amber-500/10 text-amber-400' : (fin.estado_pago ?? '').toUpperCase() === 'SALDO' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                {(fin.estado_pago ?? '').toUpperCase()}
                                              </span>
                                              <span className={`text-[10px] tabular-nums ${shortDateClass(fin.fecha_vencimiento) || 'text-white/30'}`}>
                                                {shortDate(fin.fecha_vencimiento)}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 self-center">
                                            <button onClick={() => handleStartEditFinanza(fin)} disabled={saving} className="text-white/20 hover:text-violet-400 p-0.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                                            <button onClick={() => handleDeleteNode(`fin-${fin.id}`)} disabled={saving} className="text-white/20 hover:text-red-400 p-0.5"><Trash2 size={12} /></button>
                                          </div>
                                        </div>
                                      )) : (
                                        <p className="text-[11px] text-white/20 italic">Sin finanzas registradas</p>
                                      )}
                                    </div>
                                  </div>
                                ))}

                                {(!entidadDetails.directFinanzas || entidadDetails.directFinanzas.length === 0) && (!entidadDetails.proyectos || entidadDetails.proyectos.length === 0) && (
                                  <p className="text-[11px] text-white/30 italic text-center py-4 bg-white/[0.01] border border-dashed border-white/5 rounded-xl">Crea un proyecto primero o carga un cobro directo para empezar.</p>
                                )}
                              </div>
                            )}

                            {/* TAB: Enlaces */}
                            {activeDrawerTab === 'enlaces' && (
                              <div className="space-y-4">
                                {/* Search bar */}
                                <div className="relative">
                                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                                  <input
                                    type="text"
                                    value={entityLinkSearch}
                                    onChange={(e) => setEntityLinkSearch(e.target.value)}
                                    placeholder="Buscar utilidad..."
                                    className="drawer-input py-2 pl-8 pr-3 text-[12px]"
                                  />
                                </div>

                                {entidadDetails.proyectos.map((proj: any) => {
                                  const filteredEnlaces = proj.enlaces
                                    ? proj.enlaces.filter((link: any) => {
                                        const q = entityLinkSearch.toLowerCase();
                                        if (!q) return true;
                                        return (
                                          (link.descripcion || '').toLowerCase().includes(q) ||
                                          (link.url || '').toLowerCase().includes(q) ||
                                          (link.categoria || '').toLowerCase().includes(q) ||
                                          (link.etiquetas || []).some((t: string) => t.toLowerCase().includes(q))
                                        );
                                      })
                                    : [];

                                  return (
                                    <div key={proj.id} className="space-y-3">
                                      <div className="flex items-center justify-between text-[11px] font-semibold text-white/50 border-b border-white/5 pb-1">
                                        <span>Proyecto: {proj.nombre}</span>
                                        <span className="text-[10px] text-white/30 font-normal">{filteredEnlaces.length} links</span>
                                      </div>

                                      {/* Add Link Form */}
                                      <div className="bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 border border-violet-500/20 rounded-xl p-3.5 space-y-2.5">
                                        <p className="text-[10px] text-violet-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                          <Plus size={11} /> Agregar Enlace
                                        </p>
                                        <input
                                          type="text"
                                          value={entityLinkUrl}
                                          onChange={(e) => setEntityLinkUrl(e.target.value)}
                                          className="drawer-input py-1.5 text-[12px]"
                                          placeholder="URL (https://...)"
                                        />
                                        <input
                                          type="text"
                                          value={entityLinkDesc}
                                          onChange={(e) => setEntityLinkDesc(e.target.value)}
                                          className="drawer-input py-1.5 text-[12px]"
                                          placeholder="Uso o descripción (ayuda-memoria)..."
                                        />
                                        <select value={entityLinkEntidadId} onChange={(e) => setEntityLinkEntidadId(e.target.value ? Number(e.target.value) : '')} className="drawer-input py-1.5 text-[11px]">
                                          <option value="">— Sin entidad —</option>
                                          <optgroup label="Proyectos">
                                            {allProjects.map((p: any) => <option key={`proj-${p.id}`} value={`${p.id}`}>📁 {p.nombre}</option>)}
                                          </optgroup>
                                          <optgroup label="Entidades">
                                            {(data?.nodes || []).filter((n: any) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type)).map((n: any) => <option key={n.id} value={dbId(n.id)}>🏢 {n.name}</option>)}
                                          </optgroup>
                                        </select>
                                        <div className="flex items-center gap-2">
                                          {isAddingCategory ? (
                                            <>
                                              <input
                                                autoFocus
                                                type="text"
                                                value={newCategoryInput}
                                                onChange={(e) => setNewCategoryInput(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmNewCategory(); } }}
                                                className="drawer-input py-1.5 text-[12px] flex-1"
                                                placeholder="Nombre de la categoría..."
                                              />
                                              <button
                                                onClick={handleConfirmNewCategory}
                                                disabled={!newCategoryInput.trim()}
                                                className="flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50 whitespace-nowrap"
                                              >
                                                ✓ Crear
                                              </button>
                                              <button
                                                onClick={() => { setIsAddingCategory(false); setNewCategoryInput(''); }}
                                                className="flex items-center gap-1 text-[11px] font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap"
                                              >
                                                Cancelar
                                              </button>
                                            </>
                                          ) : (
                                            <>
                                              <select
                                                value={entityLinkCat}
                                                onChange={(e) => { const v = e.target.value; if (v === '__ADD__') { setIsAddingCategory(true); } else { setEntityLinkCat(v); } }}
                                                className="drawer-input py-1.5 text-[11px] flex-1"
                                              >
                                                {allCategories.map((cat) => (
                                                  <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                                <option value="__ADD__">➕ Agregar nueva categoría...</option>
                                              </select>
                                              <button
                                                onClick={() => handleAddEntityLink(proj.id)}
                                                disabled={saving || !entityLinkUrl.trim() || !entityLinkDesc.trim()}
                                                className="flex items-center gap-1 text-[11px] font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-lg px-3.5 py-1.5 transition-all disabled:opacity-50 whitespace-nowrap"
                                              >
                                                <Plus size={12} /> Agregar
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                      {/* Links list as cards */}
                                      <div className="space-y-2">
                                        {filteredEnlaces.map((link: any) => (
                                          <div
                                            key={link.id}
                                            className="flex items-start gap-2 bg-white/[0.02] border border-white/[0.05] hover:border-violet-500/30 hover:bg-white/[0.04] rounded-xl p-3 transition-all group"
                                          >
                                            <a
                                              href={link.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex-1 min-w-0"
                                            >
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                                  {link.categoria}
                                                </span>
                                                <p className="text-[12px] font-semibold text-white/90 truncate group-hover:text-violet-300 transition-colors">
                                                  {link.descripcion}
                                                </p>
                                              </div>
                                              <p className="text-[10px] text-violet-400/60 mt-1.5 truncate flex items-center gap-1">
                                                <ExternalLink size={10} />
                                                {link.url}
                                              </p>
                                            </a>
                                            {link.etiquetas && link.etiquetas.length > 0 && (
                                              <div className="hidden sm:flex flex-wrap gap-1 max-w-[120px] self-start">
                                                {link.etiquetas.slice(0, 3).map((tag: string, i: number) => (
                                                  <span key={i} className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-white/30">
                                                    {tag}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                            <div className="flex flex-col gap-1 shrink-0 self-start">
                                              <button onClick={(e) => { e.preventDefault(); handleStartEditLink(link); }} disabled={saving} className="text-white/20 hover:text-violet-400 p-1 rounded hover:bg-white/5 transition-all" title="Editar">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                              </button>
                                              <button onClick={(e) => { e.preventDefault(); handleDeleteEntityLink(link.id); }} disabled={saving} className="text-white/20 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-all" title="Eliminar">
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                        {filteredEnlaces.length === 0 && (
                                          <p className="text-[11px] text-white/20 italic text-center py-4">
                                            {entityLinkSearch ? 'Sin resultados para esta búsqueda' : 'Sin enlaces registrados'}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}

                                {(!entidadDetails.proyectos || entidadDetails.proyectos.length === 0) && (
                                  <p className="text-[11px] text-white/30 italic text-center py-4 bg-white/[0.01] border border-dashed border-white/5 rounded-xl">Crea un proyecto primero para asociar enlaces.</p>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Delete button for entities */}
                        <div className="pt-4 border-t border-white/[0.06] flex justify-end">
                          <button
                            onClick={() => handleDeleteNode(drawerNode.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/25 text-red-400 text-[11px] font-semibold transition-all disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            Eliminar Registro
                          </button>
                        </div>
                      </div>
                    )}

                    {/* MES view */}
                    {drawerNode.type === 'MES' && (
                      <>
                        {(() => {
                          const items = getItemsForMes(drawerNode);
                          const finanzas = items.filter((n) => n.type === 'FINANZA');
                          const tareas = items.filter((n) => n.type === 'TAREA').sort((a: any, b: any) => {
                            const aUrg = (a.extra?.urgente || a.extra?.prioridad === 'alta') ? 1 : 0;
                            const bUrg = (b.extra?.urgente || b.extra?.prioridad === 'alta') ? 1 : 0;
                            return bUrg - aUrg;
                          });
                          const libros = items.filter((n) => n.type === 'LIBRO');
                          const totalGs = finanzas.reduce((sum, f) => sum + (f.extra?.monto ?? 0), 0);

                          return (
                            <>
                              {finanzas.length > 0 && (
                                <div className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border border-slate-500/20 rounded-2xl p-5">
                                  <p className="text-[10px] text-slate-400/60 uppercase tracking-wider font-semibold mb-1">Total pendiente</p>
                                  <p className="text-[26px] font-bold text-slate-200 tracking-tight leading-none">{formatGs(totalGs)}</p>
                                  <p className="text-[11px] text-slate-400/40 mt-1.5">
                                    {finanzas.length} cobro{finanzas.length !== 1 && 's'} · {tareas.length} tarea{tareas.length !== 1 && 's'} · {libros.length} libro{libros.length !== 1 && 's'}
                                  </p>
                                </div>
                              )}

                              {/* Add buttons */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => { setDrawerMode('create'); resetCreateForm(); setCreateType('FINANZA'); }}
                                  className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-xl py-2.5 hover:bg-violet-500/15 transition-colors"
                                >
                                  <Plus size={12} />
                                  Movimiento/Tarea
                                </button>
                                <button
                                  onClick={() => { setDrawerMode('create'); resetCreateForm(); setCreateType('LIBRO'); setEditEstado('LEYENDO'); }}
                                  className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl py-2.5 hover:bg-red-500/15 transition-colors"
                                >
                                  <BookOpen size={12} />
                                  Agregar Libro
                                </button>
                              </div>

                              {libros.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-3 font-semibold flex items-center gap-1.5">
                                    <BookOpen size={11} className="text-[#eb5757]/50" /> Libros del mes ({libros.length})
                                  </p>
                                  <div className="space-y-2">
                                    {libros.map((b) => (
                                      <div key={b.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 hover:bg-white/[0.05] transition-colors cursor-pointer"
                                        onClick={() => { setDrawerNode(b); setDrawerMode('view'); }}>
                                        <div className="flex items-start justify-between gap-3">
                                          <p className="text-[12px] text-white/70 font-medium leading-snug flex-1">{b.name}</p>
                                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{
                                            backgroundColor: b.extra?.estado_lectura === 'LEIDO' ? 'rgba(16,185,129,0.15)' : 'rgba(235,87,87,0.15)',
                                            color: b.extra?.estado_lectura === 'LEIDO' ? '#10b981' : '#eb5757',
                                          }}>{b.extra?.estado_lectura}</span>
                                        </div>
                                        {b.extra?.autor && <p className="text-[10px] text-white/25 mt-1">por {b.extra?.autor}</p>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {finanzas.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-3 font-semibold flex items-center gap-1.5">
                                    <DollarSign size={11} className="text-emerald-500/50" /> Cobros ({finanzas.length})
                                  </p>
                                  <div className="space-y-2">
                                    {finanzas.map((f) => (
                                      <div key={f.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 hover:bg-white/[0.05] transition-colors cursor-pointer"
                                        onClick={() => { setDrawerNode(f); setDrawerMode('view'); }}>
                                        <div className="flex items-start justify-between gap-3">
                                          <p className="text-[12px] text-white/70 font-medium leading-snug flex-1">{f.name}</p>
                                          <span className={`text-[11px] tabular-nums shrink-0 ${finanzaDateClass(f)}`}>{shortDate(getFinanceDate(f))}</span>
                                          <p className="text-[12px] text-emerald-400 font-bold tabular-nums whitespace-nowrap">{formatGs(f.extra?.monto ?? 0)}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {tareas.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-white/25 uppercase tracking-wider mb-3 font-semibold flex items-center gap-1.5">
                                    <CheckSquare size={11} className="text-amber-500/50" /> Tareas ({tareas.length})
                                  </p>
                                  <div className="space-y-2">
                                    {tareas.map((t) => (
                                      <div key={t.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 hover:bg-white/[0.05] transition-colors cursor-pointer"
                                        onClick={() => { setDrawerNode(t); setDrawerMode('view'); }}>
                                        <p className="text-[12px] text-white/70 font-medium leading-snug">{t.name}</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                          {t.extra?.urgente && (
                                            <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md text-red-400 bg-red-500/15 animate-pulse">🔥 URGENTE</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {finanzas.length === 0 && tareas.length === 0 && libros.length === 0 && (
                                <p className="text-[12px] text-white/20 italic text-center py-8">Sin registros vinculados a este mes</p>
                              )}
                            </>
                          );
                        })()}
                      </>
                    )}

                    {/* Connections */}
                    <div>
                      <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2 font-semibold">
                        Conexiones ({getNodeConnections(drawerNode).length})
                      </p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {getNodeConnections(drawerNode).map((conn, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2 hover:bg-white/[0.06] transition-colors cursor-pointer"
                            onClick={() => conn.otherNode && handleNodeClick(conn.otherNode)}>
                            <span className="text-white/20 text-[9px]">{conn.direction}</span>
                            <span className="font-medium" style={{ color: (NODE_COLORS[conn.otherNode?.type || 'DEFAULT'] || NODE_COLORS.DEFAULT).text }}>{conn.otherNode?.name}</span>
                            <span className="text-white/15 text-[9px] ml-auto">{conn.type.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* ═══════ EDIT MODE ═══════ */}
                {drawerMode === 'edit' && (
                  <div className="space-y-4">
                    {drawerNode.type !== 'LIBRO' && drawerNode.type !== 'PROYECTO' && drawerNode.type !== 'TAREA' && (
                      <FormField label="Descripción">
                        <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="drawer-input" />
                      </FormField>
                    )}
                    {['EMPRESA', 'PERSONA', 'SERVICIO'].includes(drawerNode.type) && (
                      <>
                        <FormField label="Entidad Madre / Vincular a...">
                          <select value={editEntityPadreId} onChange={(e) => setEditEntityPadreId(e.target.value ? Number(e.target.value) : '')} className="drawer-input">
                            <option value="">— Ninguna —</option>
                            {data?.nodes?.filter((n: any) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type) && n.id !== drawerNode.id).map((n: any) => (
                              <option key={n.id} value={dbId(n.id)}>{n.name} ({n.type})</option>
                            ))}
                          </select>
                        </FormField>
                        <label className="flex items-center justify-between py-2 px-1 cursor-pointer">
                          <span className="text-[11px] text-white/60 font-medium">🔥 Destacar en el Grafo</span>
                          <div className={`relative w-9 h-5 rounded-full transition-colors ${editIsDestacado ? 'bg-emerald-500' : 'bg-white/10'}`}
                            onClick={() => setEditIsDestacado(!editIsDestacado)}>
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editIsDestacado ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </label>
                      </>
                    )}

                    {drawerNode.type === 'PROYECTO' && (
                      <>
                        <FormField label="Nombre del Proyecto">
                          <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="drawer-input" />
                        </FormField>
                        <FormField label="Descripción">
                          <textarea value={editPdfUrl} onChange={(e) => setEditPdfUrl(e.target.value)} className="drawer-input min-h-[60px] resize-none" />
                        </FormField>
                        <FormField label="Estado">
                          <select value={(editEstado || '').toUpperCase()} onChange={(e) => setEditEstado(e.target.value)} className="drawer-input">
                            <option value="ACTIVO">Activo</option>
                            <option value="CULMINADO">Culminado</option>
                            <option value="PAUSADO">Pausado</option>
                          </select>
                        </FormField>
                        <FormField label="Fecha de Inicio">
                          <input type="date" value={editFechaInicio} onChange={(e) => setEditFechaInicio(e.target.value)} className="drawer-input" />
                        </FormField>
                        <FormField label="Fecha de Finalización / Culminación">
                          <input type="date" value={editFechaFin} onChange={(e) => setEditFechaFin(e.target.value)} className="drawer-input" />
                        </FormField>
                        <FormField label="Notas de Conocimiento / Ayuda-Memoria">
                          <textarea 
                            value={editNotas} 
                            onChange={(e) => setEditNotas(e.target.value)} 
                            className="drawer-input min-h-[180px] font-sans text-[12px] leading-relaxed resize-y" 
                            placeholder="Ideas, accesos, notas extensas del proyecto..."
                          />
                        </FormField>
                        <label className="flex items-center justify-between py-2 px-1 cursor-pointer">
                          <span className="text-[11px] text-white/60 font-medium">🔥 Destacar en el Grafo</span>
                          <div className={`relative w-9 h-5 rounded-full transition-colors ${editIsDestacado ? 'bg-emerald-500' : 'bg-white/10'}`}
                            onClick={() => setEditIsDestacado(!editIsDestacado)}>
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editIsDestacado ? 'translate-x-4' : 'translate-x-0'}`} />
                          </div>
                        </label>
                      </>
                    )}

                    {drawerNode.type === 'HUB_FINANZAS' && (
                      <label className="flex items-center justify-between py-2 px-1 cursor-pointer">
                        <span className="text-[11px] text-white/60 font-medium">🔥 Destacar en el Grafo</span>
                        <div className={`relative w-9 h-5 rounded-full transition-colors ${editIsDestacado ? 'bg-emerald-500' : 'bg-white/10'}`}
                          onClick={() => setEditIsDestacado(!editIsDestacado)}>
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editIsDestacado ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </label>
                    )}

                    {drawerNode.type === 'FINANZA' && (
                      <>
                        <FormField label="Monto (Gs.)">
                          <input type="number" value={editMonto} onChange={(e) => setEditMonto(e.target.value)} className="drawer-input" />
                        </FormField>
                        <FormField label="Tipo">
                          <input type="text" value={editTipo} onChange={(e) => setEditTipo(e.target.value)} className="drawer-input" />
                        </FormField>
                        <FormField label="🏢 Unidad Originadora / Beneficiario">
                          <select value={editEntityOrigenId} onChange={(e) => setEditEntityOrigenId(e.target.value ? Number(e.target.value) : '')} className="drawer-input">
                            <option value="">— Seleccionar —</option>
                            {data?.nodes?.filter((n: any) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type)).map((n: any) => (
                              <option key={n.id} value={dbId(n.id)}>{n.name}</option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label="Estado de pago">
                          <select value={editEstado} onChange={(e) => setEditEstado(e.target.value)} className="drawer-input">
                            <option value="pendiente">Pendiente</option>
                            <option value="pagado">Pagado</option>
                            <option value="parcial">Parcial</option>
                          </select>
                        </FormField>
                        <FormField label="Fecha de vencimiento">
                          <input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} className="drawer-input" />
                        </FormField>
                      </>
                    )}

                    {drawerNode.type === 'TAREA' && (
                      <>
                        <FormField label="DESCRIPCIÓN">
                          <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="drawer-input" placeholder="Título o resumen corto" />
                        </FormField>
                        <FormField label="DETALLES">
                          <textarea
                            id="edit-task-drawer-ta"
                            value={editNotas}
                            onChange={(e) => setEditNotas(e.target.value)}
                            rows={3}
                            className="drawer-input resize-none overflow-hidden"
                            placeholder="Notas extendidas con formato…"
                            onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
                          />
                          <div className="flex items-center gap-1 mt-1">
                            <button type="button" onClick={() => { const ta = document.querySelector('#edit-task-drawer-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '**', '**'); }} className="text-[11px] font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Negrita">B</button>
                            <button type="button" onClick={() => { const ta = document.querySelector('#edit-task-drawer-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '*', '*'); }} className="text-[11px] font-bold italic px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Cursiva">I</button>
                            <button type="button" onClick={() => { const ta = document.querySelector('#edit-task-drawer-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '<u>', '</u>'); }} className="text-[11px] font-bold underline px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Subrayado">U</button>
                            <button type="button" onClick={() => { const ta = document.querySelector('#edit-task-drawer-ta') as HTMLTextAreaElement; if (ta) wrapSelection(ta, '==', '=='); }} className="text-[11px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white/70 transition-colors" title="Resaltar">🖍️</button>
                          </div>
                        </FormField>
                        <FormField label="Estado">
                          <select value={editEstado} onChange={(e) => setEditEstado(e.target.value)} className="drawer-input">
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="SEGUIMIENTO">Seguimiento</option>
                            <option value="CULMINADO">Culminado</option>
                          </select>
                        </FormField>
                        <FormField label="Prioridad">
                          <select value={editPrioridad} onChange={(e) => setEditPrioridad(e.target.value)} className="drawer-input">
                            <option value="baja">Baja</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                          </select>
                        </FormField>
                        <FormField label="Fecha límite">
                          <input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} className="drawer-input" />
                        </FormField>
                        <div className="flex items-center gap-2 pt-1.5 pl-1">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={editUrgente}
                              onChange={(e) => setEditUrgente(e.target.checked)}
                              className="accent-red-500 h-3.5 w-3.5 rounded cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-red-400">🔥 Marcar como Urgente</span>
                          </label>
                        </div>
                      </>
                    )}

                    {drawerNode.type === 'LIBRO' && (
                      <>
                        <FormField label="Título del libro">
                          <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="drawer-input" />
                        </FormField>
                        <FormField label="Autor">
                          <input type="text" value={editAutor} onChange={(e) => setEditAutor(e.target.value)} className="drawer-input" />
                        </FormField>
                        <FormField label="Estado de lectura">
                          <select value={editEstado} onChange={(e) => setEditEstado(e.target.value)} className="drawer-input">
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="LEYENDO">Leyendo</option>
                            <option value="LEIDO">Leído</option>
                          </select>
                        </FormField>
                        <FormField label="Veces leído">
                          <input type="number" value={editVecesLeido} onChange={(e) => setEditVecesLeido(Number(e.target.value))} className="drawer-input" />
                        </FormField>
                        <FormField label="Ruta / URL del PDF">
                          <input type="text" value={editPdfUrl} onChange={(e) => setEditPdfUrl(e.target.value)} className="drawer-input" placeholder="Ej: /storage/clean-code.pdf" />
                        </FormField>
                      </>
                    )}

                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 text-[12px] font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl py-3 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                )}

                {/* ═══════ CREATE MODE ═══════ */}
                {drawerMode === 'create' && (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2 text-[11px] font-semibold text-white/75">
                      <span>
                        {createType === 'FINANZA' && '💰 Nueva Finanza'}
                        {createType === 'TAREA' && '⏰ Nuevo Recordatorio'}
                        {createType === 'LIBRO' && '📕 Nuevo Libro'}
                        {createType === 'CITA' && '📝 Nueva Nota Libre'}
                        {createType === 'LINK' && '🔗 Nuevo Enlace'}
                        {createType === 'PELICULA' && '🎬 Nueva Película'}
                        {createType === 'SERIE' && '🎬 Nueva Serie'}
                        {createType === 'PROYECTO' && '📁 Nuevo Proyecto'}
                      </span>
                      <button
                        onClick={() => { setDrawerMode('global_create'); resetCreateForm(); }}
                        className="text-violet-400 hover:text-violet-300 text-[10px] underline"
                      >
                        ← Volver al Menú
                      </button>
                    </div>

                    {createType === 'FINANZA' && (
                      <>
                        <FormField label="Descripción / Concepto">
                          <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="drawer-input" placeholder="Ej: Pago de hosting Nix" />
                        </FormField>
                        <FormField label="Monto (Gs.)">
                          <input type="number" value={editMonto} onChange={(e) => setEditMonto(e.target.value)} className="drawer-input" placeholder="250000" />
                        </FormField>
                        <FormField label="Tipo">
                          <select value={editTipo || 'egreso'} onChange={(e) => setEditTipo(e.target.value)} className="drawer-input">
                            <option value="egreso">Egreso / Pago de la Agencia</option>
                            <option value="vencimiento_cliente">Cobro / Saldo a Favor</option>
                          </select>
                        </FormField>
                        <FormField label="🏢 Unidad Originadora / Beneficiario">
                          <select value={editEntityOrigenId} onChange={(e) => setEditEntityOrigenId(e.target.value ? Number(e.target.value) : '')} className="drawer-input">
                            <option value="">— Seleccionar —</option>
                            {data?.nodes?.filter((n: any) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type)).map((n: any) => (
                              <option key={n.id} value={dbId(n.id)}>{n.name}</option>
                            ))}
                          </select>
                        </FormField>
                        <FormField label="Fecha de vencimiento">
                          <input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} className="drawer-input" />
                        </FormField>
                        <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-white/80">Programar Alerta de Vencimiento</span>
                            <span className="text-[9px] text-white/40">Crea una tarea/alarma asociada en el calendario</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={crearAlerta} 
                            onChange={(e) => setCrearAlerta(e.target.checked)}
                            className="accent-violet-500 cursor-pointer h-4 w-4 rounded border-white/10 bg-white/5"
                          />
                        </div>
                      </>
                    )}

                    {createType === 'TAREA' && (
                      <>
                        <FormField label="Descripción">
                          <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="drawer-input" placeholder="Ej: Llamar a Xavier" />
                        </FormField>
                        <FormField label="Prioridad">
                          <select value={editPrioridad || 'media'} onChange={(e) => setEditPrioridad(e.target.value)} className="drawer-input">
                            <option value="baja">Baja</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                          </select>
                        </FormField>
                        <FormField label="Fecha límite">
                          <input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} className="drawer-input" />
                        </FormField>
                        <FormField label="Proyecto">
                          <select value={createProyectoId} onChange={(e) => setCreateProyectoId(Number(e.target.value))} className="drawer-input">
                            {allProjects.length === 0 && <option value="">Cargando proyectos…</option>}
                            {allProjects.map((p: any) => (
                              <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                          </select>
                        </FormField>
                        <div className="flex items-center gap-2 pt-1.5 pl-1">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={editUrgente}
                              onChange={(e) => setEditUrgente(e.target.checked)}
                              className="accent-red-500 h-3.5 w-3.5 rounded cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-red-400">🔥 Marcar como Urgente</span>
                          </label>
                        </div>
                      </>
                    )}

                    {createType === 'LIBRO' && (
                      <>
                        <FormField label="Título del libro">
                          <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="drawer-input" placeholder="Ej: Clean Code" />
                        </FormField>
                        <FormField label="Autor">
                          <input type="text" value={editAutor} onChange={(e) => setEditAutor(e.target.value)} className="drawer-input" placeholder="Robert C. Martin" />
                        </FormField>
                        <FormField label="Estado de lectura">
                          <select value={editEstado || 'PENDIENTE'} onChange={(e) => setEditEstado(e.target.value)} className="drawer-input">
                            <option value="PENDIENTE">Pendiente</option>
                            <option value="LEYENDO">Leyendo</option>
                            <option value="LEIDO">Leído</option>
                          </select>
                        </FormField>
                        <FormField label="Veces leído">
                          <input type="number" value={editVecesLeido} onChange={(e) => setEditVecesLeido(Number(e.target.value))} className="drawer-input" />
                        </FormField>
                        <FormField label="Ruta / URL del PDF">
                          <input type="text" value={editPdfUrl} onChange={(e) => setEditPdfUrl(e.target.value)} className="drawer-input" placeholder="Ej: /storage/clean-code.pdf" />
                        </FormField>
                      </>
                    )}

                    {(createType === 'PELICULA' || createType === 'SERIE') && (
                      <>
                        <FormField label={`Título de la ${createType === 'SERIE' ? 'Serie' : 'Película'}`}>
                          <input type="text" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="drawer-input" placeholder="Ej: Matrix" />
                        </FormField>
                        <FormField label="Director / Creador">
                          <input type="text" value={editAutor} onChange={(e) => setEditAutor(e.target.value)} className="drawer-input" placeholder="Ej: Wachowskis" />
                        </FormField>
                        <FormField label="Estado">
                          <select value={editEstado || 'PENDIENTE'} onChange={(e) => setEditEstado(e.target.value)} className="drawer-input">
                            <option value="PENDIENTE">Pendiente / Por ver</option>
                            <option value="VIENDO">Viendo</option>
                            <option value="VISTO">Visto</option>
                          </select>
                        </FormField>
                        <FormField label="Veces Visto">
                          <input type="number" value={editVecesLeido} onChange={(e) => setEditVecesLeido(Number(e.target.value))} className="drawer-input" />
                        </FormField>
                        <FormField label="Streaming URL / Nota">
                          <input type="text" value={editPdfUrl} onChange={(e) => setEditPdfUrl(e.target.value)} className="drawer-input" placeholder="Ej: Netflix, HBO Max..." />
                        </FormField>
                      </>
                    )}

                    {createType === 'LINK' && (
                      <>
                        <FormField label="URL Completa">
                          <input type="text" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} className="drawer-input" placeholder="https://example.com" />
                        </FormField>
                        <FormField label="Descripción / Concepto">
                          <input type="text" value={newLinkDesc} onChange={(e) => setNewLinkDesc(e.target.value)} className="drawer-input" placeholder="Ej: Repositorio principal" />
                        </FormField>
                        <FormField label="Categoría">
                          <select value={newLinkCat} onChange={(e) => setNewLinkCat(e.target.value)} className="drawer-input">
                            <option value="TUTORIAL">Tutorial</option>
                            <option value="CONTENIDO_YOUTUBE">Contenido YouTube</option>
                            <option value="IDEAS_PUBLICIDAD">Ideas Publicidad</option>
                            <option value="OTROS">Otros</option>
                          </select>
                        </FormField>
                      </>
                    )}

                    {createType === 'CITA' && (
                      <>
                        <FormField label="Libro Asociado">
                          <select value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)} className="drawer-input">
                            <option value="0">Notas Libres (General)</option>
                            {data?.nodes
                              .filter((n) => n.type === 'LIBRO')
                              .map((book) => (
                                <option key={book.id} value={dbId(book.id)}>
                                  {book.name}
                                </option>
                              ))}
                          </select>
                        </FormField>
                        <FormField label="Texto de la Nota / Cita">
                          <textarea
                            value={newCitaTexto}
                            onChange={(e) => setNewCitaTexto(e.target.value)}
                            className="drawer-input min-h-[80px] resize-none py-2"
                            placeholder="Escribe el texto aquí..."
                          />
                        </FormField>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-1">
                            <FormField label="Página">
                              <input
                                type="number"
                                value={newCitaPagina}
                                onChange={(e) => setNewCitaPagina(e.target.value)}
                                className="drawer-input py-1.5"
                                placeholder="Pág."
                              />
                            </FormField>
                          </div>
                          <div className="col-span-2">
                            <FormField label="Reflexión (Opcional)">
                              <input
                                type="text"
                                value={newCitaComentario}
                                onChange={(e) => setNewCitaComentario(e.target.value)}
                                className="drawer-input py-1.5"
                                placeholder="Reflexión personal..."
                              />
                            </FormField>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {createType === 'PROYECTO' && (
                      <>
                        <FormField label="Nombre del Proyecto">
                          <input
                            type="text"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="drawer-input"
                            placeholder="Ej: Rediseño Web..."
                          />
                        </FormField>
                        <FormField label="Descripción">
                          <textarea
                            value={editPdfUrl}
                            onChange={(e) => setEditPdfUrl(e.target.value)}
                            className="drawer-input min-h-[60px] resize-none"
                            placeholder="Descripción corta del proyecto..."
                          />
                        </FormField>
                        <FormField label="Estado">
                          <select
                            value={editEstado || 'ACTIVO'}
                            onChange={(e) => setEditEstado(e.target.value)}
                            className="drawer-input"
                          >
                            <option value="ACTIVO">Activo</option>
                            <option value="CULMINADO">Culminado</option>
                            <option value="PAUSADO">Pausado</option>
                          </select>
                        </FormField>
                        <FormField label="Fecha de Inicio">
                          <input
                            type="date"
                            value={editFechaInicio}
                            onChange={(e) => setEditFechaInicio(e.target.value)}
                            className="drawer-input"
                          />
                        </FormField>
                        <FormField label="Fecha de Finalización / Culminación">
                          <input
                            type="date"
                            value={editFechaFin}
                            onChange={(e) => setEditFechaFin(e.target.value)}
                            className="drawer-input"
                          />
                        </FormField>
                        <FormField label="Notas de Conocimiento / Ayuda-Memoria">
                          <textarea 
                            value={editNotas} 
                            onChange={(e) => setEditNotas(e.target.value)} 
                            className="drawer-input min-h-[120px] font-sans text-[12px] leading-relaxed resize-y" 
                            placeholder="Ideas, accesos, notas extensas del proyecto..."
                          />
                        </FormField>
                        <FormField label="Vincular a Entidad">
                          <select
                            value={selectedEntidadId}
                            onChange={(e) => setSelectedEntidadId(e.target.value)}
                            className="drawer-input"
                          >
                            <option value="0">Ninguna (General)</option>
                            {data?.nodes
                              .filter((n) => ['EMPRESA', 'PERSONA', 'SERVICIO'].includes(n.type))
                              .map((ent) => (
                                <option key={ent.id} value={dbId(ent.id)}>
                                  {ent.name} ({ent.type})
                                </option>
                              ))}
                          </select>
                        </FormField>
                      </>
                    )}

                    <button
                      onClick={handleCreate}
                      disabled={
                        saving ||
                        (createType === 'LINK' && (!newLinkUrl.trim() || !newLinkDesc.trim())) ||
                        (createType === 'CITA' && !newCitaTexto.trim()) ||
                        (createType !== 'LINK' && createType !== 'CITA' && !editDesc.trim())
                      }
                      className="w-full flex items-center justify-center gap-2 text-[12px] font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl py-3 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      {saving ? 'Creando...' : 'Crear Registro'}
                    </button>
                  </div>
                )}

                {/* ═══════ GLOBAL CREATE MODE ═══════ */}
                {drawerMode === 'global_create' && (
                  <div className="space-y-5">
                    {/* Parseo Inteligente de Texto Libre */}
                    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 space-y-3 shadow-xl">
                      <div className="flex items-center gap-2 text-violet-300 font-bold text-[11px] uppercase tracking-wider">
                        <Sparkles size={14} />
                        <span>Carga Inteligente con IA</span>
                      </div>
                      <p className="text-[10px] text-white/40 leading-snug">
                        Escribí o dictá en lenguaje natural. DeepSeek creará e interconectará finanzas, recordatorios o libros de forma automática.
                      </p>
                      <textarea
                        value={globalIaPrompt}
                        onChange={(e) => setGlobalIaPrompt(e.target.value)}
                        className="drawer-input min-h-[90px] resize-none py-2 text-[12px]"
                        placeholder='Ej: "Vencimiento de pago de hosting de Nix el 5 de julio Gs 250.000"'
                      />
                      <button
                        onClick={handleGlobalIaSubmit}
                        disabled={saving || !globalIaPrompt.trim()}
                        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl py-2.5 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        Procesar con DeepSeek
                      </button>
                    </div>

                    {/* Separator */}
                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-white/[0.05]"></div>
                      <span className="flex-shrink mx-3 text-[10px] uppercase font-bold tracking-widest text-white/20">O Creación Manual</span>
                      <div className="flex-grow border-t border-white/[0.05]"></div>
                    </div>

                    {/* Selector Multitarget grid */}
                    <div className="grid grid-cols-1 gap-2.5">
                      <button
                        onClick={() => setShowEntityForm(showEntityForm === 'EMPRESA' ? null : 'EMPRESA')}
                        className="flex items-center justify-between w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] hover:border-violet-500/20 transition-all text-left text-white/80 group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[16px] group-hover:scale-110 transition-transform">🏢</span>
                          <div>
                            <span className="text-[12px] font-bold block text-white/90">Crear Nueva Empresa</span>
                            <span className="text-[10px] text-white/40 block mt-0.5">Registrá una nueva firma o marca en el sistema</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </button>
                      {showEntityForm === 'EMPRESA' && (
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2.5 ml-4">
                          <input
                            value={entityFormNombre}
                            onChange={(e) => setEntityFormNombre(e.target.value)}
                            className="drawer-input py-1.5 text-[12px]"
                            placeholder="Nombre de la empresa"
                          />
                          <button
                            onClick={() => handleCreateEntity('EMPRESA')}
                            disabled={saving || !entityFormNombre.trim()}
                            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl py-2 transition-all disabled:opacity-50"
                          >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            {saving ? 'Creando...' : 'Crear Empresa'}
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => setShowEntityForm(showEntityForm === 'PERSONA' ? null : 'PERSONA')}
                        className="flex items-center justify-between w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] hover:border-pink-500/20 transition-all text-left text-white/80 group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[16px] group-hover:scale-110 transition-transform">👤</span>
                          <div>
                            <span className="text-[12px] font-bold block text-white/90">Registrar Nueva Persona</span>
                            <span className="text-[10px] text-white/40 block mt-0.5">Añadí un nuevo cliente, proveedor o contacto humano</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </button>
                      {showEntityForm === 'PERSONA' && (
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2.5 ml-4">
                          <input
                            value={entityFormNombre}
                            onChange={(e) => setEntityFormNombre(e.target.value)}
                            className="drawer-input py-1.5 text-[12px]"
                            placeholder="Nombre de la persona"
                          />
                          <button
                            onClick={() => handleCreateEntity('PERSONA')}
                            disabled={saving || !entityFormNombre.trim()}
                            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white bg-pink-600 hover:bg-pink-500 rounded-xl py-2 transition-all disabled:opacity-50"
                          >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            {saving ? 'Creando...' : 'Crear Persona'}
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => { setCreateType('PROYECTO'); resetCreateForm(); setDrawerMode('create'); }}
                        className="flex items-center justify-between w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] hover:border-violet-500/20 transition-all text-left text-white/80 group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-violet-400 text-[16px] group-hover:scale-110 transition-transform">📁</span>
                          <div>
                            <span className="text-[12px] font-bold block text-white/90">Crear Nuevo Proyecto</span>
                            <span className="text-[10px] text-white/40 block mt-0.5">Cargá un proyecto y asocialo a una entidad</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </button>

                      <button
                        onClick={() => { setCreateType('LIBRO'); resetCreateForm(); setDrawerMode('create'); }}
                        className="flex items-center justify-between w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] hover:border-red-500/20 transition-all text-left text-white/80 group"
                      >
                        <div className="flex items-center gap-3">
                          <BookOpen size={16} className="text-red-400 group-hover:scale-110 transition-transform" />
                          <div>
                            <span className="text-[12px] font-bold block text-white/90">Cargar Libro / Lectura</span>
                            <span className="text-[10px] text-white/40 block mt-0.5">Agregá tu próximo objetivo de lectura</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </button>

                      <button
                        onClick={() => { setCreateType('FINANZA'); resetCreateForm(); setDrawerMode('create'); }}
                        className="flex items-center justify-between w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] hover:border-emerald-500/20 transition-all text-left text-white/80 group"
                      >
                        <div className="flex items-center gap-3">
                          <DollarSign size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                          <div>
                            <span className="text-[12px] font-bold block text-white/90">Cargar Finanzas (Gastos / Pagos)</span>
                            <span className="text-[10px] text-white/40 block mt-0.5">Registrá cobros o pagos con alertas</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </button>

                      <button
                        onClick={() => { setCreateType('TAREA'); resetCreateForm(); setDrawerMode('create'); }}
                        className="flex items-center justify-between w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] hover:border-amber-500/20 transition-all text-left text-white/80 group"
                      >
                        <div className="flex items-center gap-3">
                          <Clock size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
                          <div>
                            <span className="text-[12px] font-bold block text-white/90">Cargar Recordatorio / Vencimiento</span>
                            <span className="text-[10px] text-white/40 block mt-0.5">Añadí alarmas o tareas al calendario</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </button>

                      <button
                        onClick={() => { setCreateType('CITA'); resetCreateForm(); setDrawerMode('create'); }}
                        className="flex items-center justify-between w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] hover:border-yellow-500/20 transition-all text-left text-white/80 group"
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={16} className="text-yellow-400 group-hover:scale-110 transition-transform" />
                          <div>
                            <span className="text-[12px] font-bold block text-white/90">Anotación / Nota Libre</span>
                            <span className="text-[10px] text-white/40 block mt-0.5">Escribí reflexiones o fragmentos de texto</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </button>

                      <button
                        onClick={() => { setCreateType('LINK'); resetCreateForm(); setDrawerMode('create'); }}
                        className="flex items-center justify-between w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-white/[0.06] hover:border-blue-500/20 transition-all text-left text-white/80 group"
                      >
                        <div className="flex items-center gap-3">
                          <Hash size={16} className="text-blue-400 group-hover:scale-110 transition-transform" />
                          <div>
                            <span className="text-[12px] font-bold block text-white/90">Guardar Link / Documento</span>
                            <span className="text-[10px] text-white/40 block mt-0.5">Almacená repositorios, drives o URLs</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => { setCreateType('PELICULA'); resetCreateForm(); setDrawerMode('create'); }}
                          className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-xl px-3.5 py-3 hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all text-left text-white/80 group"
                        >
                          <div className="flex items-center gap-2">
                            <span>🎬</span>
                            <span className="text-[11px] font-bold text-white/95">Película</span>
                          </div>
                          <ChevronRight size={12} className="text-white/20" />
                        </button>
                        <button
                          onClick={() => { setCreateType('SERIE'); resetCreateForm(); setDrawerMode('create'); }}
                          className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-xl px-3.5 py-3 hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all text-left text-white/80 group"
                        >
                          <div className="flex items-center gap-2">
                            <span>📺</span>
                            <span className="text-[11px] font-bold text-white/95">Serie</span>
                          </div>
                          <ChevronRight size={12} className="text-white/20" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Drawer input styles */}
      <style jsx global>{`
        .drawer-input {
          width: 100%;
          background: rgba(241, 245, 249, 0.9);
          border: 1px solid rgba(203, 213, 225, 0.8);
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 13px;
          color: #0f172a;
          outline: none;
          transition: all 0.2s;
          font-family: inherit;
        }
        .drawer-input:focus {
          border-color: rgba(99, 102, 241, 0.8);
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }
        .drawer-input::placeholder {
          color: #94a3b8;
        }
        .drawer-input option {
          background: #ffffff;
          color: #0f172a;
        }
      `}</style>

      {/* ── Edit Link Modal ───────────────────────────────────────────── */}
      {editingLinkId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCancelEditLink} />
          <div className="relative bg-[#1a1a1e] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <p className="text-[10px] text-violet-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
              ✏️ Editar Enlace
            </p>
            <input type="text" value={entityLinkUrl} onChange={(e) => setEntityLinkUrl(e.target.value)} className="drawer-input py-1.5 text-[12px] w-full" placeholder="URL (https://...)" />
            <input type="text" value={entityLinkDesc} onChange={(e) => setEntityLinkDesc(e.target.value)} className="drawer-input py-1.5 text-[12px] w-full" placeholder="Uso o descripción (ayuda-memoria)..." />
            {isAddingCategory ? (
              <div className="flex items-center gap-2">
                <input autoFocus type="text" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmNewCategory(); } }} className="drawer-input py-1.5 text-[12px] flex-1" placeholder="Nombre de la categoría..." />
                <button onClick={handleConfirmNewCategory} disabled={!newCategoryInput.trim()} className="flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50 whitespace-nowrap">✓ Crear</button>
                <button onClick={() => { setIsAddingCategory(false); setNewCategoryInput(''); }} className="flex items-center gap-1 text-[11px] font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap">Cancelar</button>
              </div>
            ) : (
              <select value={entityLinkCat} onChange={(e) => { const v = e.target.value; if (v === '__ADD__') { setIsAddingCategory(true); } else { setEntityLinkCat(v); } }} className="drawer-input py-1.5 text-[11px] w-full">
                {allCategories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                <option value="__ADD__">➕ Agregar nueva categoría...</option>
              </select>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={handleCancelEditLink} disabled={saving} className="flex items-center gap-1 text-[11px] font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap">Cancelar</button>
              <button onClick={handleSaveLinkEdit} disabled={saving || !entityLinkUrl.trim() || !entityLinkDesc.trim()} className="flex items-center gap-1 text-[11px] font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-lg px-3.5 py-1.5 transition-all disabled:opacity-50 whitespace-nowrap">
                {saving ? 'Guardando...' : '💾 Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] text-white/30 uppercase tracking-wider font-semibold mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ icon, label, value, color, badge }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  badge?: boolean;
}) {
  return (
    <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span style={{ color }} className="opacity-50">{icon}</span>
        <span className="text-[11px] text-white/40">{label}</span>
      </div>
      {badge ? (
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
          style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}30` }}>
          {value}
        </span>
      ) : (
        <span className="text-[12px] text-white/70 font-medium">{value}</span>
      )}
    </div>
  );
}

function FilterCheckbox({ label, color, checked, onChange }: {
  label: string;
  color: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between bg-white/90 border border-slate-200/80 hover:border-slate-300 hover:bg-white rounded-xl px-3 py-2 cursor-pointer transition-all shadow-2xs">
      <span className="flex items-center gap-2 text-slate-700 font-semibold text-[11.5px]">
        <span className="w-2 h-2 rounded-full shadow-2xs" style={{ backgroundColor: color }} />
        {label}
      </span>
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={(e) => onChange(e.target.checked)}
        className="accent-indigo-600 cursor-pointer h-3.5 w-3.5 rounded border-slate-300 bg-white"
      />
    </label>
  );
}
