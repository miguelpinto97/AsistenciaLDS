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
        setDbData(result);
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
    const counts = {};
    names.forEach(n => counts[n] = (counts[n] || 0) + 1);
    return Object.entries(counts).filter(([_, c]) => c > 1).map(([n, c]) => ({ name: n, count: c }));
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
            className={`px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all ${viewMode === 'upload' ? 'bg-primary text-white shadow-lg' : 'text-text-muted hover:text-white'}`}
          >
            <Upload size={18} /> Subir PDF
          </button>
          <button 
            onClick={() => setViewMode('database')}
            className={`px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-all ${viewMode === 'database' ? 'bg-primary text-white shadow-lg' : 'text-text-muted hover:text-white'}`}
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
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${
                        syncStatus.state === 'loading' ? 'bg-white/10 text-white/50 cursor-wait' : 'bg-primary hover:bg-primary-hover text-white'
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
                      className={`px-6 py-3 rounded-2xl whitespace-nowrap font-bold transition-all border ${
                        activeTab === name ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white/5 border-white/5 text-text-muted hover:bg-white/10'
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
                              value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(p => ({...p, [activeTab]: 0})); }}
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
                              onClick={() => setCurrentPage(p => ({...p, [activeTab]: Math.max(0, (p[activeTab] || 0) - 1)}))}
                              disabled={(currentPage[activeTab] || 0) === 0}
                              className="p-2 hover:bg-white/10 disabled:opacity-30 rounded-lg transition-colors"
                            >
                              <ChevronLeft size={20} />
                            </button>
                            <button 
                              onClick={() => setCurrentPage(p => ({...p, [activeTab]: (p[activeTab] || 0) + 1}))}
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
            {/* Global Date Selector */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-1.5 shadow-2xl">
                <button 
                  onClick={() => changeDate(-1)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all text-text-muted hover:text-white"
                >
                  <ChevronLeft size={24} />
                </button>
                <div className="flex items-center gap-3 px-6 py-2.5 bg-primary/20 rounded-xl text-primary border border-primary/30 min-w-[160px] justify-center">
                  <Calendar size={18} />
                  <span className="text-xl font-black uppercase tracking-tighter">
                    {formatDate(selectedDate)}
                  </span>
                </div>
                <button 
                  onClick={() => changeDate(1)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all text-text-muted hover:text-white"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center py-20 gap-4"><div className="w-10 h-10 border-4 border-t-primary rounded-full animate-spin" /><p className="text-text-muted">Consultando registros...</p></div>
            ) : dbData ? (
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
                        {(showDuplicates ? findDuplicates(data[activeTab]) : 
                          (showAttendanceOnly ? dbData[activeDbClass].students.filter(s => s.asistio) : dbData[activeDbClass].students)
                        ).map((item, i) => (
                          <tr key={i} className="text-lg">
                            <td className="py-4 text-text-muted">{i+1}</td>
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
    </div>
  );
};

export default GestionListas;
