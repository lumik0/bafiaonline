// поддельный игровой сервер для разработки, когда настоящий не работает
// запуск: bun run fakeserver [порт], потом открой игру с ?server=ws://localhost:7091
const PORT = Number(process.argv[2] ?? 7091);

const me = { u: "Тестер", puo: "p1", t: "token", o: "o1", uo: "uo1" };
const rooms = [
  { o: "r1", tt: "Открытая", mnl: 1, mnp: 5, mxp: 8, pn: 3, s: 0, sr: [2, 9] },
  { o: "r2", tt: "Закрытая", mnl: 3, mnp: 5, mxp: 8, pn: 7, s: 0, pw: "hash", sr: [] }
];
const friends = [{ o: "fr1", uu: { puo: "p2", u: "Друг" }, a: 1 }];
const chat = [{ tx: "привет всем", uu: { u: "Игрок", puo: "p3" } }];

type Packet = Record<string, any>;

// ответы на запросы клиента; чего тут нет, то сервер молча игнорирует
function reply(packet: Packet): Packet[] {
  switch(packet.ty) {
    case "sin": return [{ ty: "usi", usid: { u: me.u, t: me.t, o: me.o, uo: me.uo } }];
    case "acd": return [{ ty: "db", db: { du: { u: me.u, puo: me.puo, l: 14, ex: 1454710, nle: 1530520, mmscr: 814 }, uac: { gcns: 0, scns: 262368 }, nm: 0, fr: 0 } }];
    case "acrl": return [{ ty: "rs", rs: rooms }];
    case "acfl": return [{ ty: "frl", frl: { frl: friends } }];
    case "acc": return [{ ty: "ms", ms: chat }, { ty: "u", u: [{ u: "Игрок", puo: "p3" }] }];
    case "re": return [{ ty: "re", rr: { o: packet.ro, rmt: 0, tt: "Открытая", mxp: 8, mnp: 5, mnl: 1, sr: [2] } }];
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
    },
    open() { console.log("[fakeserver] клиент подключился"); },
    close() { console.log("[fakeserver] клиент отключился"); }
  }
});

console.log(`[fakeserver] ws://localhost:${PORT}`);
