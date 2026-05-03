import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react';

const Asistencia = ({ shortCode }) => {
  const [attendanceMode, setAttendanceMode] = useState(null);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [dbData, setDbData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmAttendance, setConfirmAttendance] = useState(null);
  const [markStatus, setMarkStatus] = useState({ state: 'idle', message: '' });

  useEffect(() => {
    const resolveCode = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/.netlify/functions/getShortLinkInfo?code=${shortCode}`);
        const result = await response.json();
        if (response.ok) {
          setAttendanceMode({
            classId: result.claseId,
            className: result.className,
            date: result.fecha.split('T')[0]
          });

          // Also fetch students for this class
          const dbResponse = await fetch(`/.netlify/functions/getClases?date=${result.fecha.split('T')[0]}`);
          const dbResult = await dbResponse.json();
          if (dbResponse.ok) {
            setDbData(dbResult);
          }
        } else {
          setError("El enlace no es válido o ha expirado.");
        }
      } catch (err) {
        setError("Error de conexión. Inténtalo de nuevo.");
      } finally {
        setLoading(false);
      }
    };
    resolveCode();
  }, [shortCode]);

  const markStudentAttendance = async (student) => {
    setMarkStatus({ state: 'loading', message: '' });
    console.log("Marking attendance for:", student.id, "on date:", attendanceMode.date);
    try {
      const response = await fetch('/.netlify/functions/markAttendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId: student.id,
          fecha: attendanceMode.date
        })
      });
      console.log("Response status:", response.status);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c10]">
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-emerald-500 font-black tracking-widest uppercase text-sm">Cargando Asistencia...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0c10] p-8">
        <div className="bg-white/5 border border-red-500/20 p-12 rounded-[2.5rem] text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto">
            <AlertCircle size={48} />
          </div>
          <h1 className="text-3xl font-black text-white">Error</h1>
          <p className="text-slate-400 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const students = dbData && attendanceMode ? dbData[attendanceMode.className]?.students : [];

  return (
    <div className="min-h-screen bg-[#0a0c10] text-white p-4 md:p-8 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full space-y-8 py-8">
        <header className="text-center space-y-4">
          <div className="w-24 h-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 mx-auto border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
            <Search size={48} />
          </div>
          <h1 className="text-4xl font-black tracking-tight">{attendanceMode.className}</h1>
          <p className="text-slate-400 font-bold tracking-widest uppercase bg-white/5 inline-block px-4 py-1 rounded-full text-xs border border-white/5">
            Registro de Asistencia • {attendanceMode.date.split('-').reverse().slice(0, 2).join(' ')}
          </p>
        </header>

        <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] shadow-2xl space-y-8 backdrop-blur-xl">
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-emerald-500 ml-2">Busca tu nombre y dale click</label>
            <div className="relative group">
              <input
                autoFocus
                type="text"
                placeholder="Escribe al menos 3 letras..."
                value={attendanceSearch}
                onChange={(e) => setAttendanceSearch(e.target.value)}
                className="w-full bg-white/5 border-2 border-white/10 rounded-3xl p-6 pl-14 text-xl font-bold focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
              />
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
            </div>
          </div>

          <div className="space-y-3 min-h-[200px]">
            {attendanceSearch.length >= 3 && students
              .filter(s => s.nombre.toLowerCase().includes(attendanceSearch.toLowerCase()))
              .map(student => (
                <motion.button
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  key={student.id}
                  onClick={() => setConfirmAttendance(student)}
                  className="w-full p-6 bg-white/5 border border-white/5 hover:border-emerald-500/50 rounded-3xl text-left font-bold text-xl flex items-center justify-between group transition-all"
                >
                  {student.nombre}
                  <ChevronRight size={24} className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
                </motion.button>
              ))
            }
            {attendanceSearch.length >= 3 && students.filter(s => s.nombre.toLowerCase().includes(attendanceSearch.toLowerCase())).length === 0 && (
              <p className="text-center py-12 text-slate-500 font-medium italic">No se encontraron coincidencias</p>
            )}
            {attendanceSearch.length > 0 && attendanceSearch.length < 3 && (
              <p className="text-center py-8 text-xs font-black text-slate-500 uppercase tracking-widest animate-pulse">Sigue escribiendo...</p>
            )}
          </div>
        </div>

      {/* Success/Error Overlay */}
      <AnimatePresence>
        {markStatus.message && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className={`relative p-12 rounded-[3rem] text-center space-y-6 max-w-sm w-full border-2 shadow-2xl ${
                markStatus.state === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
              }`}
            >
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${
                markStatus.state === 'error' ? 'bg-red-500/20' : 'bg-emerald-500/20'
              }`}>
                {markStatus.state === 'error' ? <AlertCircle size={60} /> : <CheckCircle size={60} />}
              </div>
              <h2 className="text-3xl font-black leading-tight">{markStatus.message}</h2>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Cerrando automáticamente...</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>

      <AnimatePresence>
        {confirmAttendance && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setConfirmAttendance(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-[#161b22] border border-white/10 rounded-[3rem] p-10 shadow-2xl text-center space-y-8">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 mx-auto border border-emerald-500/20">
                <AlertCircle size={40} />
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-black">Hola, {confirmAttendance.nombre.split(' ')[0]}</h2>
                <p className="text-slate-400 text-lg font-medium">¿Confirmas tu asistencia para el día de hoy?</p>
              </div>
              <div className="flex flex-col gap-3">
                <button 
                  disabled={markStatus.state === 'loading'}
                  onClick={() => markStudentAttendance(confirmAttendance)} 
                  className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-wait text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  {markStatus.state === 'loading' ? (
                    <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : "Sí, marcar asistencia"}
                </button>
                <button 
                  disabled={markStatus.state === 'loading'}
                  onClick={() => setConfirmAttendance(null)} 
                  className="w-full py-5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-bold text-lg transition-all"
                >
                  No soy yo, cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Asistencia;
