import React from 'react';
import Booth from './pages/Booth';
import Admin from './pages/Admin';

function App() {
  const path = window.location.pathname;

  // Simple Router native (sin necesidad de react-router-dom para evitar npm install)
  if (path.startsWith('/admin')) {
    return <Admin />;
  }

  // Cualquier otra ruta asume que es el kiosco (ej: /miboda)
  return <Booth />;
}

export default App;
