import { scriptAssetsSource } from "@common/assets/script-source";
import { startGame } from "@game/app";
import { startLauncher } from "@launcher/index";

document.body.style.margin = "0";

startLauncher(document.getElementById("root")!, host => startGame(host).then(() => {}), scriptAssetsSource());
