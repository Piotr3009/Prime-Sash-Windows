import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const container = document.getElementById('root-3d') || document.getElementById('root');
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);