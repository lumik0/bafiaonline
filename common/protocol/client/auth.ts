import { clientPacket, field, t } from "../define";
import { K } from "../keys";

export const authPackets = {
  /** password - уже MD5, хеширует вызывающий */
  signInWithPassword: clientPacket(K.SIGN_IN, {
    email: field(K.EMAIL, t.string),
    password: field(K.PASSWORD, t.string),
    captcha: field("cpt", t.string),
    source: field("ds", t.string),
    deviceId: field(K.DEVICE_ID, t.string)
  }),

  resetPassword: clientPacket(K.USER_RESET_PASSWORD, {
    email: field(K.EMAIL, t.string),
    language: field(K.APP_LANGUAGE, t.string)
  })
};
