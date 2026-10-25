// bun scripts/bundle-mod-cli.ts <index.ts> - печатает собранный скрипт мода в stdout
import { bundleMod } from "./bundle-mod";

process.stdout.write(await bundleMod(process.argv[2]!));
