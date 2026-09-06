import type { CachedDesignAsset, DesignAssetSearchResult } from "./design-assets";
import {
  cacheSketchfabAsset,
  readCachedAssetBundle,
  searchSketchfabAssets,
  sketchfabStatus,
  saveSketchfabToken,
  clearSketchfabToken,
  SketchfabProvider
} from "./design-assets";

export type DesignAssetProviderId = "sketchfab";
export type DesignAssetBundle = ReturnType<typeof readCachedAssetBundle>;

/**
 * Stable facade used by Electron IPC. Additional providers (Poly Haven,
 * local library, etc.) can be registered here without coupling the renderer
 * or Sophenic Brain to one vendor.
 */
export class DesignAssetEngine {
  readonly providers = { sketchfab: new SketchfabProvider() } as const;

  async status(test = false) {
    return { sketchfab: await sketchfabStatus(test) };
  }

  async saveSketchfabToken(token: string) {
    return { sketchfab: await saveSketchfabToken(token) };
  }

  clearSketchfabToken() {
    return { sketchfab: clearSketchfabToken() };
  }

  async search(provider: DesignAssetProviderId, query: string, limit = 12): Promise<DesignAssetSearchResult[]> {
    if (provider !== "sketchfab") throw new Error(`Provider 3D non supporté : ${provider}`);
    return searchSketchfabAssets(query, limit);
  }

  async cache(provider: DesignAssetProviderId, input: DesignAssetSearchResult): Promise<CachedDesignAsset> {
    if (provider !== "sketchfab") throw new Error(`Provider 3D non supporté : ${provider}`);
    return cacheSketchfabAsset(input);
  }

  bundle(cacheId: string): DesignAssetBundle {
    return readCachedAssetBundle(cacheId);
  }
}

export const designAssetEngine = new DesignAssetEngine();
