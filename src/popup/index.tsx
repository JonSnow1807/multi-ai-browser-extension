import React from 'react';
import ReactDOM from 'react-dom/client';
import { Popup } from './Popup';
import '../styles/global.css';

// Initialize React root
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Render popup
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);