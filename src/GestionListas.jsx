import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  Upload, FileText, ChevronLeft, ChevronRight,
  CheckCircle, Search, Database, AlertCircle,
  X, Trash2, Filter, CloudUpload, Calendar, Link, Copy, ExternalLink, UserCheck,
  QrCode, Scissors, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';

// Initialize PDF.js worker using Vite's URL import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const ITEMS_PER_PAGE = 10;

const GestionListas = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [currentPage, setCurrentPage] = useState({});
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncStatus, setSyncStatus] = useState({ state: 'idle', message: '' });
  const [viewMode, setViewMode] = useState('upload'); // 'upload' or 'database'
  const [appPath, setAppPath] = useState(window.location.pathname.replace(/^\/|\/$/g, ''));
  const [dbData, setDbData] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showGeneralSummary, setShowGeneralSummary] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState('all'); // 'all' or className
  const [activeDbClass, setActiveDbClass] = useState(null);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [currentClassInfo, setCurrentClassInfo] = useState(null); // { id, name, date }
  const [linkLoading, setLinkLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };
  const [attendanceMode, setAttendanceMode] = useState(null); // { classId, className, date }
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [isResolving, setIsResolving] = useState(() => {
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    return path && path !== 'GestionListas' && path.length === 6;
  });
  const [confirmAttendance, setConfirmAttendance] = useState(null); // student object
  const [markStatus, setMarkStatus] = useState({ state: 'idle', message: '' });
  const [showAttendanceOnly, setShowAttendanceOnly] = useState(false);
  const [showQRPrint, setShowQRPrint] = useState(false);
  const [qrSettings, setQrSettings] = useState({
    selectedClasses: [],
    cols: 2,
    rows: 2,
    layout: 'vertical' // 'vertical' (portrait card) or 'horizontal' (landscape card)
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + (7 - d.getDay()) % 7);
    return d;
  });

  const changeDate = (weeks) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (weeks * 7));
    setSelectedDate(newDate);
  };

  const formatDate = (date) => {
    if (!date) return "";
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '').toLowerCase();
  };

  useEffect(() => {
    if (viewMode === 'database') fetchDbData();
  }, [viewMode, selectedDate]);

  const toggleLock = async () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const newLockState = !isLocked;
    try {
      const response = await fetch(`/.netlify/functions/toggleAttendanceLock?fecha=${dateStr}&lock=${newLockState}`);
      if (response.ok) {
        setIsLocked(newLockState);
        showToast(newLockState ? "Asistencia cerrada" : "Asistencia abierta");
      }
    } catch (error) {
      showToast("Error al cambiar estado", "error");
    }
  };

  const generateClassLink = async (className) => {
    setLinkLoading(true);
    try {
      const classInfo = dbData[className];
      const dateStr = selectedDate.toISOString().split('T')[0];

      const response = await fetch(`/.netlify/functions/getOrCreateShortLink?claseId=${classInfo.id}&fecha=${dateStr}`);
      const result = await response.json();

      if (response.ok && result.code) {
        const shortUrl = `${window.location.origin}/${result.code}`;
        setGeneratedLink(shortUrl);
        setCurrentClassInfo({ id: classInfo.id, name: className, date: dateStr });
      }
    } catch (error) {
      console.error("Link generation error:", error);
    } finally {
      setLinkLoading(false);
    }
  };

  const copyQr = async () => {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        const item = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([item]);
        showToast("¡Código QR copiado!");
      });
    } catch (err) {
      console.error("QR copy error:", err);
      // Fallback: download
      const link = document.createElement('a');
      link.download = 'asistencia-qr.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  const markStudentAttendance = async (student) => {
    setMarkStatus({ state: 'loading', message: '' });
    try {
      const response = await fetch('/.netlify/functions/markAttendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId: student.id,
          fecha: attendanceMode.date
        })
      });
      if (response.ok) {
        setMarkStatus({ state: 'success', message: `¡Asistencia marcada para ${student.nombre}!` });
        setConfirmAttendance(null);
        setAttendanceSearch('');
        setTimeout(() => setMarkStatus({ state: 'idle', message: '' }), 3000);
      } else {
        throw new Error("Error al marcar asistencia");
      }
    } catch (error) {
      setMarkStatus({ state: 'error', message: error.message });
    }
  };

  const fetchDbData = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await fetch(`/.netlify/functions/getClases?date=${dateStr}`);
      const result = await response.json();
      if (response.ok) {
        setDbData(result.classes);
        setIsLocked(result.isLocked);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Fetch DB error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'database' || attendanceMode) fetchDbData();
  }, [viewMode, attendanceMode, selectedDate]);

  const copyAttendanceList = () => {
    if (!dbData) return;

    const attendees = Object.entries(dbData)
      .filter(([name]) => summaryFilter === 'all' || name === summaryFilter)
      .flatMap(([_, data]) => data.students.filter(s => s.asistio).map(s => s.nombre))
      .sort((a, b) => a.localeCompare(b.nombre));

    if (attendees.length === 0) {
      showToast("No hay asistentes para copiar", "error");
      return;
    }

    const text = attendees.join('|');
    navigator.clipboard.writeText(text);
    showToast(`¡${attendees.length} nombres copiados!`);
  };

  const formatDateForLCR = (date) => {
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${date.getDate().toString().padStart(2, '0')} ${months[date.getMonth()]}`;
  };

  const copyFullScript = () => {
    if (!dbData) return;
    
    const attendees = Object.entries(dbData)
      .filter(([name]) => summaryFilter === 'all' || name === summaryFilter)
      .flatMap(([_, data]) => data.students.filter(s => s.asistio).map(s => s.nombre))
      .sort((a, b) => a.localeCompare(b.nombre));
    
    if (attendees.length === 0) {
      showToast("No hay asistentes para generar script", "error");
      return;
    }

    const columna = formatDateForLCR(selectedDate);
    const namesArray = JSON.stringify(attendees);

    const script = `
(function() {
  const columnaBuscada = "${columna}";
  const alumnos = ${namesArray};

  async function marcar(columnaBuscada, alumnos) {
    const esperar = ms => new Promise(r => setTimeout(r, ms));
    const tabla = document.querySelector('table');
    if (!tabla) return alert("No se encontró tabla de asistencia");

    const headers = [...tabla.querySelectorAll('thead th')];
    let indice = headers.findIndex(th => th.innerText.toLowerCase().includes(columnaBuscada.toLowerCase()));
    
    if (indice === -1) return alert("Columna '" + columnaBuscada + "' no encontrada");

    let mios = [], existentes = [], noEncontrados = [];

    for (const nombre of alumnos) {
      const filas = [...tabla.querySelectorAll('tbody tr')];
      let fila = filas.find(tr => tr.innerText.toLowerCase().includes(nombre.toLowerCase()));

      if (!fila) { noEncontrados.push(nombre); continue; }

      let boton = fila.querySelectorAll('td')[indice]?.querySelector('button');
      if (!boton) { noEncontrados.push(nombre); continue; }

      const path = boton.querySelector('svg path');
      const d = path?.getAttribute('d') || '';
      const esCheck = d.includes('l-') || d.includes('M'); // Ajuste según ícono de check

      if (esCheck) {
        existentes.push(nombre);
      } else {
        boton.click();
        mios.push(nombre);
        await esperar(600);
      }
    }
    mostrarReporte(mios, existentes, noEncontrados);
  }

  function mostrarReporte(mios, existentes, noEncontrados) {
    let div = document.createElement("div");
    Object.assign(div.style, {
      position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      background: "#1e293b", color: "#f8fafc", padding: "30px", borderRadius: "20px",
      zIndex: "10000", maxHeight: "80vh", overflow: "auto", minWidth: "400px",
      boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)",
      fontFamily: "sans-serif"
    });

    div.innerHTML = \`
      <h3 style="margin-top:0; font-size:24px; font-weight:900; color:#10b981">Reporte de Asistencia</h3>
      <p style="color:#94a3b8; font-weight:bold; font-size:12px; text-transform:uppercase; letter-spacing:1px">Columna: \${columnaBuscada}</p>
      
      <div style="margin: 20px 0">
        <b style="color:#10b981">✅ Marcados ahora (\${mios.length}):</b>
        <ul style="font-size:14px; opacity:0.8">\${mios.map(n => \`<li>\${n}</li>\`).join("")}</ul>
        
        <b style="color:#60a5fa">🔵 Ya estaban (\${existentes.length}):</b>
        <ul style="font-size:14px; opacity:0.8">\${existentes.map(n => \`<li>\${n}</li>\`).join("")}</ul>
        
        <b style="color:#f87171">❌ No encontrados (\${noEncontrados.length}):</b>
        <ul style="font-size:14px; opacity:0.8">\${noEncontrados.map(n => \`<li>\${n}</li>\`).join("")}</ul>
      </div>
      
      <button id="closeRep" style="width:100%; padding:12px; background:#334155; border:none; color:white; border-radius:12px; font-weight:bold; cursor:pointer">Cerrar Reporte</button>
    \`;
    document.body.appendChild(div);
    document.getElementById("closeRep").onclick = () => div.remove();
  }

  marcar(columnaBuscada, alumnos);
})();
    `.trim();

    navigator.clipboard.writeText(script);
    showToast("¡Script completo copiado!");
  };

  const togglePrintClass = (className) => {
    setQrSettings(prev => ({
      ...prev,
      selectedClasses: prev.selectedClasses.includes(className)
        ? prev.selectedClasses.filter(c => c !== className)
        : [...prev.selectedClasses, className]
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const syncData = async () => {
    if (!data) return;
    setSyncStatus({ state: 'loading', message: 'Sincronizando...' });
    try {
      const response = await fetch('/.netlify/functions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });

      const contentType = response.headers.get("content-type");
      let result;

      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(text || `Error ${response.status}`);
      }

      if (response.ok) {
        setSyncStatus({ state: 'success', message: '¡Base de datos actualizada!' });
        if (viewMode === 'database') fetchDbData();
        setTimeout(() => setSyncStatus({ state: 'idle', message: '' }), 4000);
      } else {
        throw new Error(result?.error || 'Error en sync');
      }
    } catch (error) {
      setSyncStatus({ state: 'error', message: error.message });
    }
  };

  const parsePDF = async (file) => {
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const classes = {};
        let currentClass = null;
        let isGlobalExtracting = false;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const items = textContent.items.sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5];
            if (Math.abs(yDiff) < 5) return a.transform[4] - b.transform[4];
            return yDiff;
          });

          let isPageSuppressed = false;
          let hasSkippedNameOnThisPage = false;

          items.forEach(item => {
            const text = item.str.trim();
            if (!text) return;

            const classMatch = text.match(/Lista de asistencia de\s+[“"]([^”"]+)[”"]/i);
            if (classMatch) {
              currentClass = classMatch[1].trim();
              if (!classes[currentClass]) classes[currentClass] = [];
              isPageSuppressed = false;
              isGlobalExtracting = false;
              return;
            }

            if (text.toUpperCase() === "MAESTROS") {
              isGlobalExtracting = true;
              isPageSuppressed = false;
              hasSkippedNameOnThisPage = false;
              return;
            }

            if (text.toUpperCase().includes("MIEMBROS EN LA LISTA")) {
              isPageSuppressed = true;
              return;
            }

            if (currentClass && isGlobalExtracting && !isPageSuppressed) {
              const isNoise = /^(?:P[áa]g|Fecha|Firma|ID|N[o0]|Total|Faltas|Tardanzas|Estudiante|Alumno|Nombre|Maestros|Asistentes|Oficiales|Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic|X|\.|_|\d{2}\/\d{2}\/\d{4})/i.test(text) ||
                text.toUpperCase().includes("ESTACA LIMA") ||
                text.toUpperCase().includes("LISTAS DE ASISTENCIA") ||
                text.length < 3 || /^\d+$/.test(text);

              if (!isNoise) {
                if (!hasSkippedNameOnThisPage) {
                  hasSkippedNameOnThisPage = true;
                  return;
                }
                if (text.split(' ').length > 1) classes[currentClass].push(text);
              }
            }
          });
        }
        const cleanData = {};
        Object.entries(classes).forEach(([k, v]) => { if (v.length) cleanData[k] = v; });
        setData(cleanData);
        if (Object.keys(cleanData).length) setActiveTab(Object.keys(cleanData)[0]);
        setLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const getFilteredData = (className) => {
    if (!data || !data[className]) return [];
    return data[className].filter(n => n.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const findDuplicates = (names) => {
    if (!names) return [];
    const counts = {};
    names.forEach(n => counts[n] = (counts[n] || 0) + 1);
    return Object.entries(counts).filter(([_, c]) => c > 1).map(([n, c]) => ({ nombre: n, count: c }));
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-12 text-center">
        <motion.h1
          className="text-4xl md:text-6xl font-black mb-4 title-gradient"
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        >
          Asistencia Escuela Dominical
        </motion.h1>

        <div className="inline-flex p-1 bg-white/5 backdrop-blur-md rounded-full border border-white/10 mt-6">
          <button
            onClick={() => setViewMode('upload')}
            className={`px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all cursor-pointer ${viewMode === 'upload' ? 'bg-primary text-white shadow-lg' : 'text-text-muted hover:text-white'}`}
          >
            <Upload size={18} /> Subir PDF
          </button>
          <button
            onClick={() => setViewMode('database')}
            className={`px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all cursor-pointer ${viewMode === 'database' ? 'bg-primary text-white shadow-lg' : 'text-text-muted hover:text-white'}`}
          >
            <Database size={18} /> Base de Datos
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {viewMode === 'upload' ? (
          <div className="space-y-8">
            {!data && !loading && (
              <motion.div
                className="glass-effect p-12 text-center group cursor-pointer"
                whileHover={{ scale: 1.01 }}
              >
                <label className="flex flex-col items-center gap-6 cursor-pointer">
                  <input type="file" className="hidden" accept=".pdf" onChange={e => e.target.files[0] && parsePDF(e.target.files[0])} />
                  <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <CloudUpload size={40} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Comienza Aquí</h2>
                    <p className="text-text-muted">Arrastra o selecciona el archivo TodasLasListas.pdf</p>
                  </div>
                </label>
              </motion.div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-text-muted font-medium">Procesando registros de la Escuela Dominical...</p>
              </div>
            )}

            {data && (
              <div className="space-y-6">
                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 glass-effect p-4 px-6 mb-8">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={syncData}
                      disabled={syncStatus.state === 'loading'}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${syncStatus.state === 'loading' ? 'bg-white/10 text-white/50 cursor-wait' : 'bg-primary hover:bg-primary-hover text-white'
                        }`}
                    >
                      {syncStatus.state === 'loading' ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Database size={18} />}
                      {syncStatus.state === 'loading' ? 'Sincronizando...' : 'Sincronizar con BD'}
                    </button>
                    <AnimatePresence>
                      {syncStatus.message && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          className={`text-sm font-bold flex items-center gap-2 ${syncStatus.state === 'error' ? 'text-red-400' : 'text-accent'}`}
                        >
                          {syncStatus.state === 'error' ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
                          {syncStatus.message}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <button onClick={() => setData(null)} className="flex items-center gap-2 text-text-muted hover:text-white transition-colors text-sm font-bold">
                    <Trash2 size={16} /> Limpiar Todo
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 pb-4">
                  {Object.keys(data).map(name => (
                    <button
                      key={name}
                      onClick={() => setActiveTab(name)}
                      className={`px-6 py-3 rounded-2xl whitespace-nowrap font-bold transition-all border ${activeTab === name ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white/5 border-white/5 text-text-muted hover:bg-white/10'
                        }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                {/* Class View */}
                <AnimatePresence mode="wait">
                  {activeTab && (
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                      className="glass-effect overflow-hidden"
                    >
                      <div className="p-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-white/[0.02]">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-primary/10 rounded-xl text-primary">
                            <FileText size={24} />
                          </div>
                          <div>
                            <h2 className="text-xl font-extrabold">{activeTab}</h2>
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">{getFilteredData(activeTab).length} Alumnos</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button onClick={() => setShowDuplicates(true)} className="text-sm font-bold text-primary hover:underline">Duplicados</button>
                          <div className="flex items-center bg-white/5 rounded-full px-4 py-2 border border-white/10 focus-within:border-primary/50 transition-all">
                            <Search size={16} className="text-text-muted" />
                            <input
                              type="text" placeholder="Filtrar..."
                              value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(p => ({ ...p, [activeTab]: 0 })); }}
                              className="bg-transparent border-none outline-none pl-3 text-sm font-medium w-32 md:w-48"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-white/[0.02] text-text-muted text-xs uppercase font-bold text-left">
                              <th className="px-6 py-4">#</th>
                              <th className="px-6 py-4">Nombre</th>
                              <th className="px-6 py-4 text-right">Estatus</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {getFilteredData(activeTab).slice((currentPage[activeTab] || 0) * ITEMS_PER_PAGE, ((currentPage[activeTab] || 0) + 1) * ITEMS_PER_PAGE).map((name, i) => (
                              <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4 text-sm text-text-muted">{((currentPage[activeTab] || 0) * ITEMS_PER_PAGE) + i + 1}</td>
                                <td className="px-6 py-4 font-bold">{name}</td>
                                <td className="px-6 py-4 text-right">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-bold">
                                    <CheckCircle size={12} /> Presente
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {getFilteredData(activeTab).length > ITEMS_PER_PAGE && (
                        <div className="p-6 bg-white/[0.02] flex items-center justify-between border-t border-white/10">
                          <span className="text-sm text-text-muted">Página <b>{(currentPage[activeTab] || 0) + 1}</b> de <b>{Math.ceil(getFilteredData(activeTab).length / ITEMS_PER_PAGE)}</b></span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setCurrentPage(p => ({ ...p, [activeTab]: Math.max(0, (p[activeTab] || 0) - 1) }))}
                              disabled={(currentPage[activeTab] || 0) === 0}
                              className="p-2 hover:bg-white/10 disabled:opacity-30 rounded-lg transition-colors"
                            >
                              <ChevronLeft size={20} />
                            </button>
                            <button
                              onClick={() => setCurrentPage(p => ({ ...p, [activeTab]: (p[activeTab] || 0) + 1 }))}
                              disabled={(currentPage[activeTab] || 0) >= Math.ceil(getFilteredData(activeTab).length / ITEMS_PER_PAGE) - 1}
                              className="p-2 hover:bg-white/10 disabled:opacity-30 rounded-lg transition-colors"
                            >
                              <ChevronRight size={20} />
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : (
          /* Database View */
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4 bg-white/5 p-2 rounded-[2rem] border border-white/10">
                <button
                  onClick={() => setShowGeneralSummary(false)}
                  className={`px-6 py-2.5 rounded-[1.5rem] font-black transition-all text-sm cursor-pointer ${!showGeneralSummary ? 'bg-primary text-white shadow-lg' : 'text-text-muted hover:text-white'}`}
                >
                  Por Clases
                </button>
                <button
                  onClick={() => setShowGeneralSummary(true)}
                  className={`px-6 py-2.5 rounded-[1.5rem] font-black transition-all text-sm cursor-pointer ${showGeneralSummary ? 'bg-primary text-white shadow-lg' : 'text-text-muted hover:text-white'}`}
                >
                  Resumen General
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-6">
                {/* Global Date Selector */}
                <div className="inline-flex items-center gap-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-1 shadow-xl">
                  <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-text-muted cursor-pointer">
                    <ChevronLeft size={20} />
                  </button>
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-xl text-primary border border-primary/30 min-w-[140px] justify-center">
                    <span className="text-lg font-black uppercase tracking-tighter">{formatDate(selectedDate)}</span>
                  </div>
                  <button onClick={() => changeDate(1)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-text-muted cursor-pointer">
                    <ChevronRight size={20} />
                  </button>
                </div>

                <button
                  onClick={toggleLock}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all border cursor-pointer ${isLocked ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
                    }`}
                >
                  {isLocked ? <><X size={18} /> Cerrada</> : <><CheckCircle size={18} /> Abierta</>}
                </button>
                <button 
                  onClick={() => setShowQRPrint(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black transition-all border border-white/10 cursor-pointer"
                >
                  <QrCode size={18} /> Imprimir QRs
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center py-20 gap-4"><div className="w-10 h-10 border-4 border-t-primary rounded-full animate-spin" /><p className="text-text-muted">Consultando registros...</p></div>
            ) : dbData && showGeneralSummary ? (
              /* General Summary View */
              <div className="space-y-12">
                {/* Global Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-effect p-8 border-l-4 border-primary">
                    <p className="text-xs font-black uppercase tracking-widest text-text-muted mb-2">Total Asistentes</p>
                    <h4 className="text-5xl font-black">
                      {Object.values(dbData).reduce((acc, c) => acc + c.students.filter(s => s.asistio).length, 0)}
                    </h4>
                  </div>
                  <div className="glass-effect p-8 border-l-4 border-accent">
                    <p className="text-xs font-black uppercase tracking-widest text-text-muted mb-2">Clases con Asistencia</p>
                    <h4 className="text-5xl font-black">{Object.values(dbData).filter(c => c.students.some(s => s.asistio)).length}</h4>
                  </div>
                  <div className="glass-effect p-8 border-l-4 border-white/20">
                    <p className="text-xs font-black uppercase tracking-widest text-text-muted mb-2">Fecha del Reporte</p>
                    <h4 className="text-3xl font-black uppercase">{formatDate(selectedDate)}</h4>
                  </div>
                </div>

                {/* Filter Cards */}
                <div className="space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
                    <Filter size={18} /> Filtrar por Clase
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={() => setSummaryFilter('all')}
                      className={`px-6 py-3 rounded-2xl font-bold transition-all border cursor-pointer ${summaryFilter === 'all' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 border-white/10 text-text-muted hover:border-white/30'}`}
                    >
                      Todos
                    </button>
                    {Object.keys(dbData).sort().map(className => {
                      const count = dbData[className].students.filter(s => s.asistio).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={className}
                          onClick={() => setSummaryFilter(className)}
                          className={`px-6 py-3 rounded-2xl font-bold transition-all border flex items-center gap-3 cursor-pointer ${summaryFilter === className ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white/5 border-white/10 text-text-muted hover:border-white/30'}`}
                        >
                          {className}
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${summaryFilter === className ? 'bg-white/20' : 'bg-white/10'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Unified Attendance Table */}
                <div className="glass-effect overflow-hidden">
                  <div className="p-6 border-b border-white/10 flex items-center justify-between flex-wrap gap-4">
                    <h3 className="text-2xl font-black">
                      {summaryFilter === 'all' ? 'Lista Completa de Asistencia' : `Asistencia: ${summaryFilter}`}
                    </h3>
                    <div className="flex gap-3">
                      <button 
                        onClick={copyAttendanceList}
                        className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black text-sm transition-all border border-white/10 flex items-center gap-2 cursor-pointer"
                      >
                        <Copy size={16} /> Copiar Nombres
                      </button>
                      <button 
                        onClick={copyFullScript}
                        className="px-6 py-2 bg-accent text-slate-900 rounded-xl font-black text-sm hover:scale-[1.02] transition-all flex items-center gap-2 shadow-lg shadow-accent/20 cursor-pointer"
                      >
                        <Scissors size={16} /> Copiar Script
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs font-black uppercase text-text-muted border-b border-white/5">
                          <th className="p-6">#</th>
                          <th className="p-6">Nombre del Alumno</th>
                          <th className="p-6">Clase</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {Object.entries(dbData)
                          .filter(([name]) => summaryFilter === 'all' || name === summaryFilter)
                          .flatMap(([className, data]) =>
                            data.students.filter(s => s.asistio).map(s => ({ ...s, className }))
                          )
                          .sort((a, b) => a.nombre.localeCompare(b.nombre))
                          .map((student, i) => (
                            <tr key={`${student.className}-${student.id}`} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-6 text-text-muted font-medium">{i + 1}</td>
                              <td className="p-6 font-bold text-lg">{student.nombre}</td>
                              <td className="p-6">
                                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black uppercase border border-primary/20">
                                  {student.className}
                                </span>
                              </td>
                            </tr>
                          ))
                        }
                        {Object.entries(dbData)
                          .filter(([name]) => summaryFilter === 'all' || name === summaryFilter)
                          .flatMap(([_, data]) => data.students.filter(s => s.asistio)).length === 0 && (
                            <tr>
                              <td colSpan="3" className="p-20 text-center text-text-muted italic font-medium">
                                No se encontraron registros de asistencia para esta selección.
                              </td>
                            </tr>
                          )
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : dbData ? (
              /* Per-Class Cards View */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.keys(dbData).map((className, i) => (
                  <motion.div
                    key={className}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    onClick={() => setActiveDbClass(className)}
                    className="glass-effect p-8 flex flex-col items-center gap-4 cursor-pointer hover:border-primary/50 group"
                  >
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <FileText size={32} />
                    </div>
                    <h3 className="text-xl font-extrabold text-center">{className}</h3>
                    <p className="text-sm text-text-muted font-bold tracking-widest uppercase">{dbData[className].students.length} Alumnos</p>
                    <div className="flex flex-col gap-2 w-full mt-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAttendanceOnly(false); setActiveDbClass(className); fetchDbData(); }}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-sm transition-all border border-white/5 flex items-center justify-center gap-2"
                      >
                        <Search size={14} /> Ver Lista
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAttendanceOnly(true); setActiveDbClass(className); fetchDbData(); }}
                        className="w-full py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl font-bold text-sm transition-all border border-accent/20 flex items-center justify-center gap-2"
                      >
                        <UserCheck size={14} /> Ver Asistencia
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); generateClassLink(className); }}
                        disabled={linkLoading}
                        className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold text-sm transition-all border border-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {linkLoading ? <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /> : <Link size={14} />}
                        Generar URL
                      </button>
                    </div>
                  </motion.div>
                ))}
                {Object.keys(dbData).length === 0 && (
                  <div className="col-span-full py-20 text-center opacity-50 flex flex-col items-center gap-4">
                    <Database size={64} />
                    <p className="text-xl font-bold">Base de datos vacía</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {(showDuplicates || activeDbClass || generatedLink || confirmAttendance) && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => { setShowDuplicates(false); setActiveDbClass(null); setGeneratedLink(null); setConfirmAttendance(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/20 rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Link Modal Content */}
              {generatedLink && (
                <div className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Link size={28} />
                      </div>
                      <h2 className="text-3xl font-black">Enlace de Asistencia</h2>
                    </div>
                    <button
                      onClick={() => setGeneratedLink(null)}
                      className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-8 items-center">
                    {/* QR Code Section */}
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-white rounded-3xl shadow-xl">
                        <QRCodeCanvas
                          id="qr-canvas"
                          value={generatedLink}
                          size={180}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                      <button
                        onClick={copyQr}
                        className="flex items-center gap-2 text-primary font-bold hover:underline"
                      >
                        <Copy size={16} /> Copiar QR como imagen
                      </button>
                    </div>

                    {/* URL Section */}
                    <div className="flex-1 space-y-4 w-full">
                      <p className="text-text-muted font-medium">Comparte este enlace con los alumnos para que registren su asistencia:</p>

                      <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4">
                        <input
                          readOnly value={generatedLink}
                          className="bg-transparent border-none outline-none flex-1 text-sm font-mono opacity-60 overflow-hidden text-ellipsis"
                        />
                        <button
                          onClick={() => { navigator.clipboard.writeText(generatedLink); showToast("¡Enlace copiado!"); }}
                          className="p-3 bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors"
                          title="Copiar Link"
                        >
                          <Copy size={18} />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => window.open(generatedLink, '_blank')}
                          className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-white/5"
                        >
                          <ExternalLink size={18} /> Probar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => setGeneratedLink(null)}
                      className="w-full py-4 bg-primary text-white rounded-2xl font-black text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmation Modal Content */}
              {confirmAttendance && (
                <div className="p-10 text-center space-y-8">
                  <div className="w-24 h-24 bg-accent/10 rounded-full flex items-center justify-center text-accent mx-auto">
                    <UserCheck size={48} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black">¿Confirmar Asistencia?</h2>
                    <p className="text-xl text-text-muted">Hola <span className="text-white font-bold">{confirmAttendance.nombre}</span>, ¿deseas marcar tu asistencia para hoy?</p>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => setConfirmAttendance(null)}
                      className="flex-1 py-5 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-lg transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => markStudentAttendance(confirmAttendance)}
                      disabled={markStatus.state === 'loading'}
                      className="flex-1 py-5 bg-accent hover:bg-accent/80 text-slate-900 rounded-2xl font-black text-lg shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2"
                    >
                      {markStatus.state === 'loading' ? <div className="w-6 h-6 border-4 border-slate-900/20 border-t-slate-900 rounded-full animate-spin" /> : "Sí, marcar asistencia"}
                    </button>
                  </div>
                </div>
              )}

              {/* Standard List View */}
              {(showDuplicates || activeDbClass) && (
                <>
                  <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                    <h2 className="text-2xl font-black">
                      {showDuplicates ? 'Duplicados' : (showAttendanceOnly ? `Asistencia: ${activeDbClass}` : activeDbClass)}
                    </h2>
                    <button onClick={() => { setShowDuplicates(false); setActiveDbClass(null); }} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                      <X size={24} />
                    </button>
                  </div>
                  <div className="p-8 max-h-[60vh] overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs font-black uppercase text-text-muted pb-4"><th className="pb-4">#</th><th className="pb-4">Nombre</th>{showDuplicates && <th className="pb-4 text-right">Cantidad</th>}</tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {((showDuplicates && data) ? findDuplicates(data[activeTab]) :
                          ((showAttendanceOnly && dbData && dbData[activeDbClass]) ? dbData[activeDbClass].students.filter(s => s.asistio) :
                            (dbData && dbData[activeDbClass] ? dbData[activeDbClass].students : []))
                        ).map((item, i) => (
                          <tr key={i} className="text-lg">
                            <td className="py-4 text-text-muted">{i + 1}</td>
                            <td className="py-4 font-bold flex items-center gap-3">
                              {item.nombre}
                              {item.asistio && (
                                <span className="bg-accent/20 text-accent p-1 rounded-full border border-accent/20">
                                  <CheckCircle size={14} />
                                </span>
                              )}
                            </td>
                            {showDuplicates && <td className="py-4 text-right"><span className="bg-red-400/20 text-red-400 px-3 py-1 rounded-full text-xs font-black">{item.count}</span></td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-6 border-t border-white/10 bg-white/[0.02] flex justify-end">
                    <button
                      onClick={() => { setShowDuplicates(false); setActiveDbClass(null); }}
                      className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black transition-colors"
                    >
                      Entendido
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-6 py-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toast.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-accent/20 text-accent'}`}>
              {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            </div>
            <span className="font-bold text-white whitespace-nowrap">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {/* QR Print Modal */}
      <AnimatePresence>
        {showQRPrint && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
              onClick={() => setShowQRPrint(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl bg-slate-900 border border-white/20 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh]"
            >
              {/* Controls Sidebar */}
              <div className="w-full md:w-80 border-r border-white/10 p-8 overflow-y-auto space-y-8 bg-white/[0.02]">
                <div>
                  <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                    <QrCode size={20} className="text-primary" /> Configurar QRs
                  </h3>
                  
                  <div className="space-y-4">
                    <label className="text-sm font-black uppercase tracking-widest text-text-muted">Distribución (Filas x Columnas)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-text-muted">FILAS</span>
                        <input 
                          type="number" min="1" max="5" 
                          value={qrSettings.rows} 
                          onChange={e => setQrSettings(s => ({...s, rows: parseInt(e.target.value) || 1}))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-center font-black"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-text-muted">COLUMNAS</span>
                        <input 
                          type="number" min="1" max="5" 
                          value={qrSettings.cols} 
                          onChange={e => setQrSettings(s => ({...s, cols: parseInt(e.target.value) || 1}))}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-center font-black"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-black uppercase tracking-widest text-text-muted">Orientación del QR</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setQrSettings(s => ({...s, layout: 'vertical'}))}
                      className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${qrSettings.layout === 'vertical' ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-text-muted'}`}
                    >
                      VERTICAL
                    </button>
                    <button 
                      onClick={() => setQrSettings(s => ({...s, layout: 'horizontal'}))}
                      className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all ${qrSettings.layout === 'horizontal' ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/10 text-text-muted'}`}
                    >
                      HORIZONTAL
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-black uppercase tracking-widest text-text-muted">Seleccionar Clases</label>
                    <button 
                      onClick={() => setQrSettings(s => ({...s, selectedClasses: s.selectedClasses.length === Object.keys(dbData || {}).length ? [] : Object.keys(dbData || {})}))}
                      className="text-[10px] font-black text-primary uppercase hover:underline"
                    >
                      {qrSettings.selectedClasses.length === Object.keys(dbData || {}).length ? 'Ninguna' : 'Todas'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {Object.keys(dbData || {}).sort().map(className => (
                      <label key={className} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={qrSettings.selectedClasses.includes(className)}
                          onChange={() => togglePrintClass(className)}
                          className="w-4 h-4 rounded border-white/20 bg-transparent text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-bold truncate">{className}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <button 
                    onClick={handlePrint}
                    disabled={qrSettings.selectedClasses.length === 0}
                    className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-900 rounded-2xl font-black text-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={20} /> Imprimir / PDF
                  </button>
                  <button 
                    onClick={() => setShowQRPrint(false)}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              {/* Preview Area */}
              <div className="flex-1 bg-black/40 p-12 flex flex-col items-center overflow-y-auto custom-scrollbar">
                <div className="mb-8 flex items-center justify-between w-full max-w-[500px]">
                  <div className="space-y-1">
                    <h4 className="text-xl font-black uppercase tracking-tight">Vista Previa Real</h4>
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Formato A4 • {qrSettings.selectedClasses.length} QRs</p>
                  </div>
                  <span className="text-xs font-black text-primary bg-primary/10 px-4 py-2 rounded-full border border-primary/20">
                    {Math.ceil(qrSettings.selectedClasses.length / (qrSettings.cols * qrSettings.rows))} Página(s)
                  </span>
                </div>
                
                {/* Multiple Simulated A4 Pages */}
                <div className="space-y-12 pb-12">
                  {(() => {
                    const pageSize = qrSettings.cols * qrSettings.rows;
                    const pages = [];
                    for (let i = 0; i < qrSettings.selectedClasses.length; i += pageSize) {
                      pages.push(qrSettings.selectedClasses.slice(i, i + pageSize));
                    }
                    if (pages.length === 0) pages.push([]);

                    return pages.map((pageClasses, pageIdx) => (
                      <div key={pageIdx} className="bg-white shadow-[0_0_50px_rgba(0,0,0,0.3)] relative overflow-hidden flex flex-col flex-shrink-0" style={{ width: '450px', height: '636px' }}>
                        <div 
                          className="grid gap-4 p-8 w-full h-full"
                          style={{ 
                            gridTemplateColumns: `repeat(${qrSettings.cols}, 1fr)`,
                            gridTemplateRows: `repeat(${qrSettings.rows}, 1fr)`
                          }}
                        >
                          {pageClasses.map(className => (
                            <div 
                              key={className} 
                              className={`border border-slate-200 rounded-lg flex items-center justify-center p-3 gap-2 transition-all ${qrSettings.layout === 'horizontal' ? 'rotate-90 scale-90' : 'flex-col text-center'}`}
                            >
                              <div className="bg-white">
                                <QRCodeCanvas 
                                  value={`${window.location.origin}/mark?c=${dbData[className]?.id}&d=${selectedDate.toISOString().split('T')[0]}`}
                                  size={qrSettings.layout === 'horizontal' ? 60 : 90}
                                  level="M"
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] font-black text-slate-900 uppercase leading-none truncate">{className}</p>
                                <p className="text-[7px] font-bold text-slate-400 mt-1 uppercase">{formatDate(selectedDate)}</p>
                              </div>
                            </div>
                          ))}
                          {/* Fill empty slots with placeholders ONLY on the last page if needed */}
                          {pageIdx === pages.length - 1 && Array.from({ length: Math.max(0, pageSize - pageClasses.length) }).map((_, i) => (
                            <div key={`empty-${i}`} className="border border-dashed border-slate-100 rounded-lg flex items-center justify-center opacity-20">
                              <QrCode size={20} className="text-slate-300" />
                            </div>
                          ))}
                        </div>
                        
                        <div className="absolute bottom-4 right-8 text-[7px] font-black text-slate-200 uppercase tracking-widest">
                          Página {pageIdx + 1} de {pages.length}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                
                <p className="text-sm text-text-muted font-medium max-w-md text-center bg-white/5 p-4 rounded-2xl border border-white/5">
                  <span className="text-primary font-bold">Tip:</span> Los QRs en la vista previa son 100% funcionales. Puedes probarlos con tu celular ahora mismo.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Print Container */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
        {/* We divide selected classes into chunks based on page capacity */}
        {(() => {
          const pageSize = qrSettings.cols * qrSettings.rows;
          const pages = [];
          for (let i = 0; i < qrSettings.selectedClasses.length; i += pageSize) {
            pages.push(qrSettings.selectedClasses.slice(i, i + pageSize));
          }

          return pages.map((pageClasses, pageIdx) => (
            <div key={pageIdx} className="w-[210mm] h-[297mm] p-[15mm] bg-white relative overflow-hidden" style={{ pageBreakAfter: pageIdx === pages.length - 1 ? 'auto' : 'always' }}>
              <div 
                className="grid gap-[10mm] w-full h-full"
                style={{ 
                  gridTemplateColumns: `repeat(${qrSettings.cols}, 1fr)`,
                  gridTemplateRows: `repeat(${qrSettings.rows}, 1fr)`
                }}
              >
                {pageClasses.map(className => {
                   const classId = dbData[className]?.id;
                   const dateStr = selectedDate.toISOString().split('T')[0];
                   // Note: In a real environment, we'd need these pre-generated or use a dynamic URL that redirects.
                   // For now, we use a link that works if the server is running.
                   const qrUrl = `${window.location.origin}/mark?c=${classId}&d=${dateStr}`;
                   
                   return (
                     <div 
                      key={className} 
                      className={`border border-slate-200 rounded-[5mm] p-[5mm] flex items-center justify-center gap-[4mm] transition-all ${qrSettings.layout === 'horizontal' ? 'rotate-90' : 'flex-col text-center'}`}
                     >
                       <div className="print-qr-wrapper">
                         <QRCodeCanvas 
                            value={qrUrl}
                            size={qrSettings.layout === 'horizontal' ? 120 : 180}
                            level="H"
                            includeMargin={false}
                         />
                       </div>
                       <div className="space-y-[1mm]">
                         <h4 className="text-[14pt] font-black text-black uppercase tracking-tighter leading-none">{className}</h4>
                         <p className="text-[10pt] font-bold text-slate-500 uppercase">{formatDate(selectedDate)}</p>
                       </div>
                     </div>
                   );
                })}
              </div>
              <div className="absolute bottom-[5mm] left-1/2 -translate-x-1/2 text-[8pt] font-black text-slate-300 uppercase tracking-widest">
                Asistencia Escuela Dominical • Página {pageIdx + 1}
              </div>
            </div>
          ));
        })()}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:block { position: absolute; left: 0; top: 0; width: 100%; height: auto !important; overflow: visible !important; }
          @page { size: A4 portrait; margin: 0; }
        }
        .a4-preview {
          background-image: linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}} />
    </div>
  );
};

export default GestionListas;
