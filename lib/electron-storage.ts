export type LocalBackupPayload = {
  courses?: any[];
  tasks?: any[];
  settings?: any;
  exportDate?: string;
  version?: string;
};

function getElectronAPI() {
  if (typeof window === 'undefined') return null;
  return (window as any).electronAPI || null;
}

export function isElectronAvailable(): boolean {
  const api = getElectronAPI();
  return !!api?.readLocalBackup && !!api?.writeLocalBackup;
}

export async function getLocalBackupPath(): Promise<string | null> {
  const api = getElectronAPI();
  if (api?.getLocalBackupPath) return await api.getLocalBackupPath();
  return null;
}

export async function readLocalBackup(): Promise<LocalBackupPayload | null> {
  const api = getElectronAPI();
  if (api?.readLocalBackup) return await api.readLocalBackup();
  throw new Error('Electron API not available');
}

export async function writeLocalBackup(payload: LocalBackupPayload): Promise<{ ok: boolean; path?: string }> {
  const api = getElectronAPI();
  if (api?.writeLocalBackup) return await api.writeLocalBackup(payload);
  throw new Error('Electron API not available');
}
