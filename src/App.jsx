import React from 'react';
import Booth from './pages/Booth';
import Admin from './pages/Admin';

function App() {
  const path = window.location.pathname + window.location.search;

  // Funciona tanto en local (/admin) como en GitHub Pages (/kiosco/admin o ?/admin)
  if (path.includes('/admin')) {
    return <Admin />;
  }

  // Cualquier otra ruta asume que es el kiosco
  return <Booth />;
}

export default App;
