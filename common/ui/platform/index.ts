import { appPlatform } from "../../utils/native";
import { applyAndroidPlatform } from "./android";
import { applyIosPlatform } from "./ios";

/** включает вид той системы, в которой запущено приложение (Android - Material, iOS - свой) */
export function applyPlatform(root: HTMLElement = document.documentElement) {
  (appPlatform() == "ios" ? applyIosPlatform : applyAndroidPlatform)(root);
}
