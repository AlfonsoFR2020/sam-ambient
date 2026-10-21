export interface BuildProvenance {
  schema: number;
  visualIdentity: string;
  sourceCommit: string | null;
  sourceDirty: boolean | null;
  sourceDigestSha256Lf: string;
  sourceFiles: Record<string, string>;
}

export function createBuildProvenance(root?: string): BuildProvenance;
