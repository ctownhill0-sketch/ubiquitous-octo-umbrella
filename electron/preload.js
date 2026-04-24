const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('leadstack', {
  // Call the Python backend API
  api: (method, endpoint, data) =>
    ipcRenderer.invoke('api-call', { method, endpoint, data }),

  // Open a URL in the default browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Show a native Mac notification
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),

  // Open the system phone dialer
  dial: (phone) => ipcRenderer.invoke('dial', phone),

  // Open the default email client
  email: (to, subject, body) => ipcRenderer.invoke('email', { to, subject, body }),

  // Platform info
  platform: process.platform,
  isElectron: true,
});
