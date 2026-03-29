import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import HeroWindow from './components/HeroWindow';
import './styles.css';

// Hero 3D on index page
const heroContainer = document.getElementById('hero-3d');
if (heroContainer) {
  try {
    ReactDOM.createRoot(heroContainer).render(
      <React.StrictMode>
        <HeroWindow />
      </React.StrictMode>,
    );
  } catch (e) {
    console.warn('Hero 3D failed to mount:', e);
    heroContainer.style.display = 'none';
    var fb = document.getElementById('hero-3d-fallback');
    if (fb) fb.style.display = 'flex';
  }
}

// Full configurator on online-estimate page
const appContainer = document.getElementById('root-3d') || document.getElementById('root');
if (appContainer && !heroContainer) {
  ReactDOM.createRoot(appContainer).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} else if (appContainer && heroContainer) {
  ReactDOM.createRoot(appContainer).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}