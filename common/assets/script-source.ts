import type { AssetsSource } from "./sync";
import type { AssetsMeta } from "./pack";

interface BafiaGlobals {
  assetsMeta?: AssetsMeta
  assetsData?: string
}

const globals = () => ((window as unknown as { __bafia?: BafiaGlobals }).__bafia ??= {});

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => { script.remove(); resolve(); };
    script.onerror = () => { script.remove(); reject(new Error(`Не удалось загрузить ${src}`)); };
    document.head.appendChild(script);
  });
}

/** образ из `bin/assets.*.js`: работает и с диска (file://), в отличие от fetch */
export const scriptAssetsSource = (base = "./bin"): AssetsSource => ({
  async meta() {
    await loadScript(`${base}/assets.meta.js`);
    const meta = globals().assetsMeta;
    delete globals().assetsMeta;
    if(!meta) throw new Error("В assets.meta.js нет оглавления");
    return meta;
  },
  async data() {
    await loadScript(`${base}/assets.js`);
    const data = globals().assetsData;
    delete globals().assetsData;
    if(!data) throw new Error("В assets.js нет данных");
    return data;
  }
});
