/** копирует текст; без https `navigator.clipboard` нет - тогда через скрытое поле */
export async function copyText(text: string): Promise<void> {
  if(navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // запрещено браузером - пробуем старый способ
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  document.body.appendChild(area);
  area.select();
  try {
    if(!document.execCommand("copy")) throw new Error("Не удалось скопировать");
  } finally {
    area.remove();
  }
}
