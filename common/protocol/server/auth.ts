import { field, optionalField, serverPacket, t } from "../define";
import { K } from "../keys";

export const authMessages = {
  signedIn: serverPacket(K.USER_SIGN_IN, {
    user: field(K.USER_ID, t.object({
      username: optionalField(K.USERNAME, t.string),
      token: field(K.TOKEN, t.string),
      objectId: optionalField(K.OBJECT_ID, t.string),
      userObjectId: field(K.USER_OBJECT_ID, t.string)
    }))
  }),

  /** error: -9 капча, -8 нет данных, -7 позже, -4 неактивна, -3 пароль, -1 не зарегистрирован */
  signInError: serverPacket(K.SIGN_IN_ERROR, {
    error: field(K.ERROR, t.number)
  }),

  userBlocked: serverPacket(K.USER_BLOCKED, {
    reason: optionalField(K.REASON, t.string),
    secondsRemaining: optionalField(K.TIME_SEC_REMAINING, t.number)
  }),

  userInactiveBlocked: serverPacket(K.USER_INACTIVE_BLOCKED, {
    secondsRemaining: optionalField(K.TIME_SEC_REMAINING, t.number)
  }),

  emailNotVerified: serverPacket(K.EMAIL_NOT_VERIFIED, {})
};
