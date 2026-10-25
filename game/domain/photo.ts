const MAX_SIDE = 1024;

/**
 * подготавливает фото для сервера: он принимает JPEG. PNG перекодируется (прозрачность заливается белым),
 * слишком большие картинки уменьшаются. Возвращает base64 без префикса `data:`
 */
export async function fileToJpegBase64(file: File, quality = .9): Promise<string> {
  if(!["image/png", "image/jpeg"].includes(file.type)) throw new Error("Допустимы только PNG и JPG");

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);

  const context = canvas.getContext("2d");
  if(!context) throw new Error("Не удалось обработать изображение");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL("image/jpeg", quality).split(",")[1]!;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Не удалось прочитать изображение")); };
    image.src = url;
  });
}
