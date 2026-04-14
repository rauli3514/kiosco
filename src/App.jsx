import React from 'react';
import Booth from './pages/Booth';
import Admin from './pages/Admin';

function App() {
  const path = window.location.pathname;

  // Funciona tanto en local (/admin) como en GitHub Pages (/kiosco/admin)
  if (path.includes('/admin')) {
    return <Admin />;
  }

  // Cualquier otra ruta asume que es el kiosco (ej: /kiosco/miboda)
  return <Booth />;
}

export default App;
