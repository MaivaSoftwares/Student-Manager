// Small helper to call Electron main's sync:push via preload bridge.
// This file should only be imported on the client (browser) side.
export async function pushSync(payload: { courses?: any[]; tasks?: any[] }) {
  // window.electronAPI is injected by the preload script when running inside Electron.
  if (typeof (window as any).electronAPI?.syncPush === 'function') {
    return await (window as any).electronAPI.syncPush(payload);
  }
  throw new Error('Electron API not available');
}

export async function setCredential(service: string, account: string, value: string) {
  if (typeof (window as any).electronAPI?.setCredential === 'function') {
    return await (window as any).electronAPI.setCredential(service, account, value);
  }
  throw new Error('Electron API not available');
}

export async function getCredential(service: string, account: string) {
  if (typeof (window as any).electronAPI?.getCredential === 'function') {
    return await (window as any).electronAPI.getCredential(service, account);
  }
  throw new Error('Electron API not available');
}

export async function deleteCredential(service: string, account: string) {
  if (typeof (window as any).electronAPI?.deleteCredential === 'function') {
    return await (window as any).electronAPI.deleteCredential(service, account);
  }
  throw new Error('Electron API not available');
}

export async function hasCredential(service: string, account: string) {
  if (typeof (window as any).electronAPI?.hasCredential === 'function') {
    return await (window as any).electronAPI.hasCredential(service, account);
  }
  throw new Error('Electron API not available');
}
