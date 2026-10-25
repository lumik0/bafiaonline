import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import type { NotificationOptions } from "@common/ui/notifications/center";
import { MessageAlerts } from "./message-alerts";
import { User } from "./user";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function setup(canPoll = true) {
  const network = createFakeNetwork();
  const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
  client.connect();
  await tick();
  const user = new User();
  user.signIn("uo1", "token");
  user.applyDashboard({ user: { username: "Я", playerObjectId: "me" } });
  client.session = { userObjectId: "uo1", token: "token" };
  // список друзей: у Васи два непрочитанных
  network.respond = (packet, socket) => { if(packet.ty == "acfl") socket.receive({ ty: "frl", frl: { frl: [{ o: "f1", ff: { puo: "p9", u: "Вася", on: true }, nm: "2", up: 1 }, { o: "f2", ff: { puo: "p8", u: "Петя", on: false }, up: 1 }] } }); };
  const shown: NotificationOptions[] = [];
  let chat = false;
  const alerts = new MessageAlerts({ client, user, notifier: { show: options => { shown.push(options); }, dismiss() {} }, chatOpen: () => chat, intervalMs: 0, canPoll: () => canPoll });
  alerts.start();
  const dashboard = (nm: number, fr = 0) => network.last.receive({ ty: "db", db: { du: { u: "Я", puo: "me" }, uac: { gcns: 1, scns: 1 }, fr, nm } });
  return { network, client, user, shown, alerts, dashboard, openChat: (value: boolean) => { chat = value; } };
}

describe("MessageAlerts", () => {
  test("первый дашборд после входа запоминается, рост счётчика сообщений и заявок даёт баннер", async() => {
    const { shown, dashboard } = await setup();
    dashboard(4, 1);
    expect(shown).toEqual([]);                      // старые непрочитанные при входе не повод для баннера

    dashboard(5, 1);
    await tick(); await tick();
    expect(shown).toHaveLength(1);
    // имя берётся из списка друзей: у кого есть непрочитанные
    expect(shown[0]).toMatchObject({ title: "Вася", text: "Новых сообщений: 2", key: "private-message" });

    dashboard(5, 2);
    await tick();
    expect(shown.at(-1)).toMatchObject({ title: "Новая заявка в друзья" });
    dashboard(3, 2);                                // прочитал часть: уменьшение баннера не даёт
    await tick();
    expect(shown).toHaveLength(2);
  });

  test("в личном чате баннера нет; сообщение пришло снаружи - показывается начало текста; своё не считается", async() => {
    const { network, shown, dashboard, openChat } = await setup();
    dashboard(0);
    openChat(true);
    dashboard(1);
    network.last.receive({ ty: "pcmr", m: { o: "m1", puo: "p9", tx: "привет", c: 1 } });
    expect(shown).toEqual([]);

    openChat(false);
    network.last.receive({ ty: "pcmr", m: { o: "m2", puo: "p9", tx: "  зайдёшь   в комнату?  ", c: 2 } });
    expect(shown).toHaveLength(1);
    expect(shown[0]!.text).toBe("зайдёшь в комнату?");

    network.last.receive({ ty: "pcmr", m: { o: "m3", puo: "me", tx: "это я сам", c: 3 } });
    expect(shown).toHaveLength(1);
  });

  test("опрос: запрос дашборда обновляет игрока (значки в меню пропадают), одновременные опросы не наслаиваются", async() => {
    const { network, user, alerts } = await setup();
    user.newMessages = 4;
    user.friendRequests = 1;
    network.respond = (packet, socket) => { if(packet.ty == "acd") socket.receive({ ty: "db", db: { du: { u: "Я", puo: "me" }, uac: { gcns: 1, scns: 1 }, fr: 0, nm: 0 } }); };

    await Promise.all([alerts.poll(), alerts.poll()]);
    expect(network.last.sent.filter(packet => packet.ty == "acd")).toHaveLength(1);
    expect([user.newMessages, user.friendRequests]).toEqual([0, 0]);
  });

  test("вне меню запрос дашборда не шлётся: он сбил бы подписку (в комнате остановился бы таймер игры)", async() => {
    const { network, alerts } = await setup(false);
    await alerts.poll();
    expect(network.last.sent.filter(packet => packet.ty == "acd")).toHaveLength(0);
  });

  test("заявки вне меню: первый ответ запоминается, новая входящая даёт баннер с ником; исходящие не считаются", async() => {
    const { network, shown, alerts } = await setup(false);
    const requests = [{ o: "r1", uu: { puo: "p1", u: "Старый" }, a: 0 }, { o: "r2", uu: { puo: "p2", u: "Я просил" }, a: 1 }];
    network.respond = (packet, socket) => { if(packet.ty == "gsfrl") socket.receive({ ty: "frl", frl: { frl: requests } }); };

    await alerts.pollRequests();
    expect(shown).toEqual([]);
    expect(network.last.sent.filter(packet => packet.ty == "acd" || packet.ty == "acfl")).toHaveLength(0);   // подписку не трогаем

    requests.push({ o: "r3", uu: { puo: "p3", u: "Новичок" }, a: 0 });
    await alerts.pollRequests();
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ title: "Новая заявка в друзья", text: "Новичок хочет добавить тебя в друзья." });

    await alerts.pollRequests();                     // та же заявка второй раз баннера не даёт
    expect(shown).toHaveLength(1);
  });

  test("после stop ничего не показывается", async() => {
    const { shown, alerts, dashboard } = await setup();
    dashboard(0);
    alerts.stop();
    dashboard(3);
    expect(shown).toEqual([]);
  });
});
