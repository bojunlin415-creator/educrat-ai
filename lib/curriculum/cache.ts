import { revalidatePath } from "next/cache";

export function revalidateCurriculumPaths(...paths: readonly string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // Cache invalidation is a post-commit synchronization hint. Lifecycle
      // mutations must not be reported as failed after the database operation
      // has already succeeded, especially in direct route-handler unit tests.
    }
  }
}
