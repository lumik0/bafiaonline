export interface ImageSlot {
  /** путь картинки внутри ассетов */
  path: string
  label: string
}

/** картинки, которые игрок может заменить своими в оформлении. Новые слоты добавляются сюда */
export const imageSlots: readonly ImageSlot[] = [
  { path: "textures/backgrounds/menu3.png", label: "Фон меню" },
  { path: "textures/backgrounds/day3.png", label: "Фон дня" },
  { path: "textures/backgrounds/night3.png", label: "Фон ночи" },
  { path: "textures/logo/avatar.jpg", label: "Аватар по умолчанию" }
];
