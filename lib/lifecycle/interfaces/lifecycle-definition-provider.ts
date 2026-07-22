export interface LifecycleDefinitionProvider {
  getDefinitions(): readonly unknown[];
}
