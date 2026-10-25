import { clientPacket, field, t } from "../define";
import { K } from "../keys";

export const profilePackets = {
  getUserProfile: clientPacket(K.GET_USER_PROFILE, {
    playerObjectId: field(K.USER_RECEIVER, t.string)
  }, { auth: true }),

  setUsername: clientPacket(K.USERNAME_SET, {
    username: field(K.USERNAME, t.string)
  }, { auth: true }),

  setServerLanguage: clientPacket(K.USER_SET_SERVER_LANGUAGE, {
    language: field(K.SERVER_LANGUAGE, t.string)
  }, { auth: true }),

  /** сменить пол: 0 - мужской, 1 - женский; ответа нет, профиль перечитывается */
  setSex: clientPacket(K.USER_CHANGE_SEX, {
    sex: field(K.SEX, t.number)
  }, { auth: true }),

  getDefaultPhotos: clientPacket(K.USER_GET_DEFAULT_PHOTOS, {}),

  setDefaultPhoto: clientPacket("ussdph", {
    photo: field(K.PHOTO, t.string),
    playerObjectId: field(K.PLAYER_OBJECT_ID, t.string)
  }, { auth: true }),

  /** file - base64 */
  uploadPhoto: clientPacket(K.UPLOAD_PHOTO, {
    file: field(K.FILE, t.string)
  }, { auth: true }),

  removePhoto: clientPacket(K.REMOVE_PHOTO, {}, { auth: true }),

  getBackpack: clientPacket(K.BACKPACK_GET, {}, { auth: true }),

  /** применить предмет: id внутри `bia`, как у украшений */
  activateBackpackItem: clientPacket("bia", {
    item: field("bia", t.object({ itemId: field("bio", t.string) }))
  }),

  /** params: номер параметра предмета → значение, например { 0: 1 } показать иконку VIP */
  updateBackpackItem: clientPacket("baied", {
    item: field("bied", t.object({
      itemId: field("bio", t.string),
      params: field("itmps", t.record(t.number))
    }))
  }),

  /** надеть украшение из рюкзака */
  activateBackpackDecoration: clientPacket("bda", {
    item: field("bia", t.object({ itemId: field("bio", t.string) }))
  }),

  /** выбросить украшение из рюкзака */
  removeBackpackDecoration: clientPacket("bdrm", {
    item: field("birm", t.object({ itemId: field("bio", t.string) }))
  }),

  /** снять надетое украшение */
  removeActiveDecoration: clientPacket("badrm", {
    item: field("birm", t.object({ itemId: field("bio", t.string) }))
  }),

  removeBackpackItem: clientPacket("bairm", {
    item: field("birm", t.object({
      itemId: field("bio", t.string)
    }))
  })
};
