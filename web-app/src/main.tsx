import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NakamaProvider } from './context/NakamaContext';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NakamaProvider>
      <App />
    </NakamaProvider>
  </StrictMode>,
);
