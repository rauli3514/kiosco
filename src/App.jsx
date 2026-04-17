import React from 'react';
import Booth from './pages/Booth';
import Admin from './pages/Admin';
import PublicDisplay from './pages/PublicDisplay';

function App() {
  const path = window.location.pathname + window.location.search;

  // Lógica de navegación simple
  if (path.includes('/admin')) {
    return <Admin />;
  }

  if (path.includes('/display')) {
    // Para simplificar sin Router formal, extraemos el slug de la URL manualmente si es necesario, 
    // pero PublicDisplay usa react-router-dom. 
    // Vamos a envolverlo en caso de que lo necesites o ajustar PublicDisplay.
    return <PublicDisplay />;
  }

  // Cualquier otra ruta asume que es el kiosco
  return <Booth />;
}

export default App;
