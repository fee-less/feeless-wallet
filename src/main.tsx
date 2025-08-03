import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App'
import { useEffect } from 'react';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
})

function PanelReadyNotifier() {
  useEffect(() => {
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
      window.chrome.runtime.sendMessage({ type: 'panel-ready' });
    }
  }, []);
  return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <PanelReadyNotifier />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
) 