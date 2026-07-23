import type { DependencyCheckRequest } from "@/lib/dependency/domain/request";

export interface DependencyGraph {
  findDependencies(
    request: DependencyCheckRequest,
  ): Promise<readonly unknown[]>;
}
