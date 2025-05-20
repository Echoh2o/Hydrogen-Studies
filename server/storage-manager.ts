import { IStorage } from './storage-types';

/**
 * Storage Manager class
 * Manages the transition between in-memory and database storage
 */
export class StorageManager {
  // Default to using in-memory storage for safety
  private useDb: boolean = false;
  
  // Reference to the in-memory and database storage implementations
  private memStorage: IStorage;
  private dbStorage: IStorage;
  
  /**
   * Create a new storage manager
   * @param memStore In-memory storage implementation
   * @param dbStore Database storage implementation
   * @param useDbByDefault Whether to use database by default
   */
  constructor(memStore: IStorage, dbStore: IStorage, useDbByDefault: boolean = false) {
    this.memStorage = memStore;
    this.dbStorage = dbStore;
    this.useDb = useDbByDefault;
    
    console.log(`Storage manager initialized. Using ${this.useDb ? 'database' : 'in-memory'} storage.`);
  }
  
  /**
   * Get the current storage implementation based on configuration
   * @returns The selected storage implementation
   */
  getStorage(): IStorage {
    return this.useDb ? this.dbStorage : this.memStorage;
  }
  
  /**
   * Switch to using database storage
   */
  useDatabase(): void {
    this.useDb = true;
    console.log('Switched to database storage.');
  }
  
  /**
   * Switch to using in-memory storage
   */
  useMemory(): void {
    this.useDb = false;
    console.log('Switched to in-memory storage.');
  }
  
  /**
   * Check if currently using database storage
   * @returns True if using database, false if using in-memory
   */
  isUsingDatabase(): boolean {
    return this.useDb;
  }
}

// Export a function to create a storage manager with the provided implementations
export function createStorageManager(
  memStore: IStorage, 
  dbStore: IStorage,
  useDbByDefault: boolean = false
): StorageManager {
  return new StorageManager(memStore, dbStore, useDbByDefault);
}