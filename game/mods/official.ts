import officialCode from "mod:official";
import { parseManifest, type ModPackage } from "@mods/index";
import manifest from "../../mods/official/manifest.json";

/** официальный мод Бафии: код собирается из mods/official/index.ts при сборке игры */
export const officialMod: ModPackage = { manifest: parseManifest(manifest), code: officialCode };
