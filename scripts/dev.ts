import index from "../dev/index.html";
import { networkInterfaces } from "node:os";
import { buildAssets } from "./assets";

const PORT = Number(process.env.PORT ?? 8080);

// образ ассетов собирается при первом запросе и пересобирается при перезапуске
let assets: ReturnType<typeof buildAssets> | undefined;
const getAssets = () => assets ??= buildAssets();
const script = (body: string) => new Response(body, { headers: { "Content-Type": "text/javascript" } });

Bun.serve({
  port: PORT,
  // слушаем все интерфейсы, чтобы открыть игру с телефона по адресу компьютера в локальной сети
  hostname: "0.0.0.0",
  development: { hmr: true, console: true },
  routes: {
    "/": index,
    "/bin/assets.meta.js": async() => script((await getAssets()).metaJs),
    "/bin/assets.js": async() => script((await getAssets()).dataJs)
  }
});

const lan = Object.values(networkInterfaces()).flat()
  .filter(address => address?.family == "IPv4" && !address.internal)
  .map(address => `http://${address!.address}:${PORT}`);
console.log(`[dev] http://localhost:${PORT}`);
if(lan.length) console.log(`[dev] с телефона (одна сеть): ${lan.join("  ")}`);
