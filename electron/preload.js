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
  },
  // local backup file helpers
  getLocalBackupPath: async () => {
    return await ipcRenderer.invoke('storage:path');
  },
  readLocalBackup: async () => {
    return await ipcRenderer.invoke('storage:read');
  },
  writeLocalBackup: async (payload) => {
    return await ipcRenderer.invoke('storage:write', payload);
  }
});
