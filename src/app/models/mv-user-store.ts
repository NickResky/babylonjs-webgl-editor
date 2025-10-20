export interface MVUserStore {
  entityBasePath: string;
  entityName: string;
  sessionId: string;
  productionMode: boolean;
  conversionInputDirectory?: string;
  conversionOutputDirectory?: string;
  blenderPath?: string;
  nodePath?: string;
}
