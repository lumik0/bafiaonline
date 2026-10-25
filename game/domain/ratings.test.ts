import { describe, expect, test } from "bun:test";
import { Connection, ServerClient } from "@common/net";
import { createFakeNetwork, instantDelay } from "@common/net/testing";
import { Ratings } from "./ratings";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

describe("Ratings", () => {
  test("запрос типа и периода без токена; игроки по порядку, без id пропускаются, украшения читаются", async() => {
    const network = createFakeNetwork();
    const client = new ServerClient(new Connection({ url: "ws://test", createSocket: () => network.createSocket(), delay: instantDelay }));
    client.connect();
    await tick();
    network.respond = (packet, socket) => packet.ty == "gr" && socket.receive({
      ty: "rtg", rt: packet.rt,
      rul: [{ puo: "p1", u: "Первый", ph: "a.jpg", rv: 1500, on: 1, dcrs: { "8": { "1": "#FFFF0000" } } }, { u: "без id" }, { puo: "p2", u: "Второй", rv: 900 }]
    });

    const users = await new Ratings(client).load("wins", "today");
    expect(network.last.sent[0]).toEqual({ ty: "gr", rt: "wins", rmd: "today" });
    expect(users.map(user => [user.username, user.value, user.isOnline])).toEqual([["Первый", 1500, true], ["Второй", 900, false]]);
    expect(users[0]!.decorations).toEqual({ "8": { "1": "#FFFF0000" } });
  });
});
