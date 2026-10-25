/** куда ведут кнопки главного меню */
export interface MenuActions {
  rooms(): void
  competitive(): void
  chat(): void
  friends(): void
  backpack(): void
  ratings(): void
  rules(): void
  history(): void
  shop(): void
  settings(): void
  profile(): void
  changePhoto(): void
  telegram(): void
}
