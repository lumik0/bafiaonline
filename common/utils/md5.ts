import { md5 } from "js-md5";

/** так сервер Мафии хранит пароли и пароли комнат: md5 с солью, 5 раз */
export function md5salt(value: string, salt = "azxsw", iterations = 5): string {
  let result = value;
  for(let i = 0; i < iterations; i++) result = md5(result + salt);
  return result;
}
