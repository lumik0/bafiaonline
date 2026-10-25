export type ConnectionStage = "connecting" | "slow" | "down";

/**
 * что сказать игроку без связи: `slow` - отвечает медленно, `down` - не отвечает
 * `attempts` - сколько попыток соединения не удалось; `online` - есть ли у устройства сеть
 */
export function connectionText(stage: ConnectionStage, attempts: number, online = true): string {
  const count = attempts > 0 ? ` (${attempts})` : "";
  if(stage == "connecting") return "Подключение…";
  if(!online) return `Нет подключения к интернету.\nПроверь сеть: игра подключится сама, как только она появится.${count}`;
  if(stage == "slow") return `Не удаётся подключиться к серверу.\nПродолжаем попытки…${count}`;
  return `Сервер не отвечает.\nВозможно, он временно выключен или недоступен у твоего провайдера. Можно не ждать: загляни позже, игра продолжит попытки сама.${count}`;
}

/**
 * случайный выбор смайлика для экрана загрузки: идёт «мешком» (пока все не показаны, повторов нет),
 * а новый мешок никогда не начинается с того, чем закончился предыдущий - два одинаковых подряд не бывает
 */
export function createPicker(count: number, random: () => number = Math.random) {
  let bag: number[] = [];
  let last = -1;

  const refill = () => {
    bag = Array.from({ length: count }, (_, index) => index);
    for(let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [bag[i], bag[j]] = [bag[j]!, bag[i]!];
    }
    // последний из мешка достаётся первым (pop): он не должен совпасть с прошлым выбором
    if(count > 1 && bag.at(-1) == last) [bag[0], bag[bag.length - 1]] = [bag.at(-1)!, bag[0]!];
  };

  return {
    next(): number {
      if(!bag.length) refill();
      last = bag.pop()!;
      return last;
    }
  };
}
