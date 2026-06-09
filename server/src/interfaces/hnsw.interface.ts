export interface HNSWIndexConfig {
  m: number; // Max number of connections per node (default 16)
  efConstruction: number; // Size of dynamic candidate list for index building (default 64)
  efSearch: number; // Size of dynamic candidate list for querying (default 40)
}

export interface IHNSWIndexingProvider {
  /**
   * Re-builds or configures the pgvector HNSW index dynamically.
   */
  configureIndex(tableName: string, columnName: string, config: HNSWIndexConfig): Promise<void>;
}

export class PlaceholderHNSWIndexingProvider implements IHNSWIndexingProvider {
  async configureIndex(_tableName: string, _columnName: string, _config: HNSWIndexConfig): Promise<void> {
    throw new Error('Method not implemented. IHNSWIndexingProvider is a Phase 2 placeholder.');
  }
}
