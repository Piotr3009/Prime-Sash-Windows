import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Hero 3D on index page
const heroContainer = document.getElementById('hero-3d');
if (heroContainer) {
  import('./components/HeroWindow.jsx').then(({ default: HeroWindow }) => {
    ReactDOM.createRoot(heroContainer).render(
      <React.StrictMode>
        <HeroWindow />
      </React.StrictMode>,
    );
  });
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
  // Both exist - mount both (unlikely but safe)
  ReactDOM.createRoot(appContainer).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}