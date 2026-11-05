export interface ProfileCardData {
  nick: string
  status?: string
  level: number
  games: number
  winsMafia: number
  winsPeaceful: number
  /** фон: цвет или два цвета градиента */
  background: string[]
  text: string
  banner?: string
  avatar?: string
}

/** картинка по адресу; чужой сервер без разрешения запрещает чтение пикселей, тогда картинки просто не будет */
function load(url: string | undefined): Promise<HTMLImageElement | undefined> {
  if(!url) return Promise.resolve(undefined);
  return new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(undefined);
    image.src = url;
  });
}

/** рисует визитку профиля 800x480 для отправки друзьям: баннер, аватарка, ник, статус и статистика */
export async function renderProfileCard(data: ProfileCardData): Promise<Blob | undefined> {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 480;
  const context = canvas.getContext("2d");
  if(!context) return undefined;
  const [banner, avatar] = await Promise.all([load(data.banner), load(data.avatar)]);

  // фон
  const fill = context.createLinearGradient(0, 0, 800, 480);
  data.background.forEach((color, index) => fill.addColorStop(data.background.length == 1 ? 0 : index / (data.background.length - 1), color));
  context.fillStyle = data.background.length == 1 ? data.background[0]! : fill;
  context.fillRect(0, 0, 800, 480);

  // баннер: обрезается по центру до полосы 800x180
  if(banner) {
    const scale = Math.max(800 / banner.width, 180 / banner.height);
    const width = banner.width * scale, height = banner.height * scale;
    context.drawImage(banner, (800 - width) / 2, (180 - height) / 2, width, height);
  } else {
    context.fillStyle = "rgba(128,128,128,.25)";
    context.fillRect(0, 0, 800, 180);
  }

  // аватарка кругом, внахлёст на баннер
  context.save();
  context.beginPath();
  context.arc(400, 180, 62, 0, Math.PI * 2);
  context.closePath();
  context.fillStyle = "rgba(255,255,255,.9)";
  context.fill();
  context.beginPath();
  context.arc(400, 180, 58, 0, Math.PI * 2);
  context.closePath();
  context.clip();
  if(avatar) context.drawImage(avatar, 342, 122, 116, 116);
  else { context.fillStyle = "#c0392b"; context.fillRect(342, 122, 116, 116); }
  context.restore();

  context.fillStyle = data.text;
  context.textAlign = "center";
  context.font = "bold 36px sans-serif";
  context.fillText(data.nick, 400, 285, 700);
  if(data.status) {
    context.font = "20px sans-serif";
    context.globalAlpha = .85;
    context.fillText(data.status, 400, 318, 700);
    context.globalAlpha = 1;
  }

  // статистика тремя плитками
  const tiles: [string, number][] = [["сыграно игр", data.games], ["побед за мафию", data.winsMafia], ["побед за мирных", data.winsPeaceful]];
  tiles.forEach(([label, value], index) => {
    const x = 60 + index * 245;
    context.fillStyle = "rgba(128,128,128,.22)";
    context.beginPath();
    context.roundRect(x, 350, 230, 90, 14);
    context.fill();
    context.fillStyle = data.text;
    context.font = "bold 32px sans-serif";
    context.fillText(String(value), x + 115, 395);
    context.font = "16px sans-serif";
    context.fillText(label, x + 115, 424);
  });
  context.font = "14px sans-serif";
  context.globalAlpha = .6;
  context.fillText(`Бафия онлайн - уровень ${data.level}`, 400, 467);
  context.globalAlpha = 1;

  return new Promise(resolve => {
    try { canvas.toBlob(blob => resolve(blob ?? undefined), "image/png"); } catch { resolve(undefined); }
  });
}

/** отправляет картинку через системное меню «поделиться»; где его нет - скачивает файл */
export async function shareImage(blob: Blob, name: string): Promise<"shared" | "saved"> {
  const file = new File([blob], name, { type: "image/png" });
  if(navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch(error) {
      // игрок закрыл меню: не повод скачивать файл
      if((error as { name?: string }).name == "AbortError") return "shared";
    }
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  return "saved";
}
