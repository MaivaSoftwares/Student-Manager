const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  syncPush: async (payload) => {
    return await ipcRenderer.invoke('sync:push', payload);
  },
  // credential management
  setCredential: async (service, account, value) => {
    return await ipcRenderer.invoke('credentials:set', { service, account, value });
  },
  getCredential: async (service, account) => {
    return await ipcRenderer.invoke('credentials:get', { service, account });
  },
  deleteCredential: async (service, account) => {
    return await ipcRenderer.invoke('credentials:delete', { service, account });
  },
  hasCredential: async (service, account) => {
    return await ipcRenderer.invoke('credentials:has', { service, account });
  }
});
