// поддельный игровой сервер для разработки, когда настоящий не работает
// запуск: bun run fakeserver [порт], потом открой игру с ?server=ws://localhost:7091
const PORT = Number(process.argv[2] ?? 7091);

const me = { u: "Тестер", puo: "p1", t: "token", o: "o1", uo: "uo1" };
const rooms = [
  { o: "r1", tt: "Открытая", mnl: 1, mnp: 5, mxp: 8, pn: 3, s: 0, sr: [2, 9] },
  { o: "r2", tt: "Закрытая", mnl: 3, mnp: 5, mxp: 8, pn: 7, s: 0, pw: "hash", sr: [] },
  // режим рулетки: хост - Игрок3 (p3); в «Позоре мафии 2.0» он не участвует, в «Рулетке» играет как все
  { o: "r3", tt: "Рулетка", mnl: 1, mnp: 5, mxp: 8, pn: 8, s: 0, sr: [2, 9], rco: "p3" },
  { o: "r4", tt: "Позор мафии 2.0", mnl: 1, mnp: 5, mxp: 8, pn: 8, s: 0, sr: [2, 9], rco: "p3" }
];
const friends = [{ o: "fr1", uu: { puo: "p2", u: "Друг" }, a: 1 }];
const chat = [{ tx: "привет всем", uu: { u: "Игрок", puo: "p3" } }];

let lastRoom = "";
const players = Array.from({ length: 8 }, (_, i) => ({ o: `o${i + 1}`, pu: { puo: i == 0 ? me.puo : `p${i + 1}`, u: i == 0 ? me.u : `Игрок${i + 1}` } }));

type Packet = Record<string, any>;

// ответы на запросы клиента; чего тут нет, то сервер молча игнорирует
function reply(packet: Packet): Packet[] {
  switch(packet.ty) {
    case "sin": return [{ ty: "usi", usid: { u: me.u, t: me.t, o: me.o, uo: me.uo } }];
    case "acd": return [{ ty: "db", db: { du: { u: me.u, puo: me.puo, l: 14, ex: 1454710, nle: 1530520, mmscr: 814 }, uac: { gcns: 0, scns: 262368 }, nm: 0, fr: 0 } }];
    case "acrl": return [{ ty: "rs", rs: rooms }];
    case "acfl": return [{ ty: "frl", frl: { frl: friends } }];
    case "acc": return [{ ty: "ms", ms: chat }, { ty: "u", u: [{ u: "Игрок", puo: "p3" }] }];
    case "re": { lastRoom = packet.ro; const room = rooms.find(other => other.o == packet.ro); return [{ ty: "re", rr: { o: packet.ro, rmt: 0, tt: room?.tt ?? "Открытая", mxp: 8, mnp: 5, mnl: 1, sr: [2], rco: (room as { rco?: string } | undefined)?.rco } }]; }
    // вход в комнату: сразу идёт игра днём, ты мирный, роли остальных неизвестны (для проверки подсказок)
    case "cp": {
      // в комнатах рулетки сразу идёт голосование (день), Игрок4 уже мёртв: видно, что его пропускают
      const roulette = lastRoom == "r3" || lastRoom == "r4";
      return [{ ty: "rst", rst: { gs: { s: 3, t: 600, d: roulette ? 3 : 0 }, pls: players, data: [{ puo: me.puo, a: true, r: 1 }, ...players.slice(1).map((player, i) => ({ puo: player.pu.puo, a: !(roulette && i == 2), r: 0 }))], rls: { "1": 6, "3": 1, "4": 1 }, ms: [{ tx: "добро пожаловать", uu: { u: "Игрок2", puo: "p2" } }] } }];
    }
    case "rc": return [{ ty: "rcd", rr: { o: "new1" } }];
    case "gup": return [{ ty: "uup", uup: { pud: { u: "Игрок", puo: packet.puo ?? "p2", l: 12, ex: 10, nle: 100, on: true, pg: 20 }, uac: { scns: 1500, gcns: 3 } } }];
    case "uns": return [{ ty: "uns", u: packet.u }];
    case "pcmsr": return [{ ty: "pcmsr", ms: [] }];
    case "af": case "rf": return [{ ty: packet.ty }];
    default: return [];
  }
}

Bun.serve({
  port: PORT,
  fetch(request, server) {
    return server.upgrade(request) ? undefined : new Response("fake server", { status: 426 });
  },
  websocket: {
    message(socket, data) {
      let packet: Packet;
      try { packet = JSON.parse(String(data)); } catch { return; }
      console.log("<-", JSON.stringify(packet));
      for(const answer of reply(packet)) socket.send(JSON.stringify(answer));
      // сценарий подсказки про шерифа: в комнате двое по очереди называют себя шерифом
      if(packet.ty == "cp") for(const [delay, name, puo, tx] of [[5000, "Игрок2", "p2", "я шер, чек Игрок3 маф"], [40000, "Игрок5", "p5", "я шериф, всем привет"]] as const)
        setTimeout(() => socket.send(JSON.stringify({ ty: "m", m: { tx, uu: { u: name, puo } } })), delay);
    },
    open() { console.log("[fakeserver] клиент подключился"); },
    close() { console.log("[fakeserver] клиент отключился"); }
  }
});

console.log(`[fakeserver] ws://localhost:${PORT}`);
