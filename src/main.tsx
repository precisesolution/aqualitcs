import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { StoreProvider } from './data/store';
import { SettingsProvider } from './data/settings';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>
);
