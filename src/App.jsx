import React, { useState, useEffect } from 'react';
import GestionListas from './GestionListas';
import Asistencia from './Asistencia';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

const App = () => {
  const [route, setRoute] = useState(() => {
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    if (path === 'GestionListas') return 'gestion';
    if (path.length === 6) return 'asistencia';
    return 'error';
  });

  const [shortCode, setShortCode] = useState(() => {
    const path = window.location.pathname.replace(/^\/|\/$/g, '');
    return path.length === 6 ? path : null;
  });

  if (route === 'gestion') {
    return <GestionListas />;
  }

  if (route === 'asistencia') {
    return <Asistencia shortCode={shortCode} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0c10] p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white/5 border border-red-500/20 p-12 rounded-[2.5rem] text-center space-y-6 max-w-md shadow-2xl backdrop-blur-xl"
      >
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto border border-red-500/20">
          <AlertCircle size={48} />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-white">Acceso Restringido</h1>
          <p className="text-slate-400 font-medium leading-relaxed">
            La ruta ingresada es incompleta o incorrecta.<br/>Por favor, verifica el enlace recibido.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default App;
