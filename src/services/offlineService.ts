import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'krishix_offline_db';
const STORE_NAME = 'diagnostic_queue';

export interface QueuedDiagnostic {
  id?: number;
  mode: string;
  imageData: string;
  timestamp: number;
}

class OfflineService {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
      },
    });
  }

  async queueDiagnostic(mode: string, imageData: string) {
    const db = await this.dbPromise;
    return db.add(STORE_NAME, {
      mode,
      imageData,
      timestamp: Date.now(),
    });
  }

  async getQueuedDiagnostics(): Promise<QueuedDiagnostic[]> {
    const db = await this.dbPromise;
    return db.getAll(STORE_NAME);
  }

  async clearQueuedDiagnostic(id: number) {
    const db = await this.dbPromise;
    return db.delete(STORE_NAME, id);
  }

  async getQueueCount(): Promise<number> {
    const db = await this.dbPromise;
    return db.count(STORE_NAME);
  }
}

export const offlineService = new OfflineService();
