import PacketDataKeys from "../../../core/src/PacketDataKeys";
import Server from "./Server";
import App from "../App";
import Loading from "../screen/Loading";
import Authorization from '../screen/Authorization'
import MessageBox from "../dialog/MessageBox";
import Dashboard from "../screen/Dashboard";
import MD5 from '../../../core/src/utils/md5'
import fs from "../../../core/src/fs/fs";
import { Profile } from "../../../launcher/src/enums";

function generateRandomToken(length = 32) {
  const hex = '0123456789abcdef';
  let result = '';

  for(let i = 0; i < length; i++) {
    result += hex[Math.floor(Math.random() * hex.length)];
  }

  return result;
}
function tokenHex(nBytes: number): string {
  const bytes = new Uint8Array(nBytes);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

export default class Auth {
  lastAuth?: {
    token: string
    userId: string
  }

  constructor(private server: Server) { }

  async addProfile({ name, email, password, token, userId }: { name?: string, email?: string, password?: string, token?: string, userId?: string }): Promise<boolean> {
    const profiles = JSON.parse(await fs.readFile(App.getPathProfiles())) as Profile[];

    if(profiles.find(e => e.email == email || e.token == token || e.userId == userId)) return false;

    profiles.push({
      name: name ?? '',
      email,
      password,
      token,
      userId
    });

    await fs.writeFile(App.getPathProfiles(), JSON.stringify(profiles));
    return true;
  }

  async auth(auth?: { email?: string, password?: string, token?: string, userId?: string }){
    // @ts-ignore
    if(!auth) auth = App.config.auth;

    if(App.screen.name == 'Loading') (App.screen as Loading).title = 'Авторизация..';
    if(auth){
      const data = await this.signIn(auth.email, auth.password, auth.token, auth.userId);
      if(data[PacketDataKeys.TYPE] == PacketDataKeys.SIGN_IN_ERROR) {
        const err = data[PacketDataKeys.ERROR];

        if(err == -7){
          await MessageBox(`Повторите позже\nКод ошибки: -7`, { title: `ОШИБКА` });
        } else if(err == -4) {
          await MessageBox(`Сессия неактивна\nКод ошибки: -4`, { title: `ОШИБКА` });
        } else if(err == -3) {
          await MessageBox(`Неверный пароль\nКод ошибки: -3`, { title: `ОШИБКА` });
        } else if(err == -1) {
          await MessageBox(`Неверная почта\nКод ошибки: -1`, { title: `ОШИБКА` });
        }
        App.screen = new Authorization();
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.USER_SIGN_IN) {
        const token = auth.token ?? data[PacketDataKeys.USER][PacketDataKeys.TOKEN];
        const userId = auth.userId ?? data[PacketDataKeys.USER][PacketDataKeys.OBJECT_ID];

        const isReconnect = this.lastAuth && this.lastAuth.userId == userId;

        this.lastAuth = {
          token,
          userId
        }

        this.addProfile({
          email: auth.email,
          password: auth.password,
          token,
          userId
        });

        App.user.update(data[PacketDataKeys.USER]);

        App.user.bToken = generateRandomToken();
        if(isReconnect) {
          App.screen.reconnect()
        } else {
          App.screen = new Dashboard();
        }
        return true;
      }
    } else {
      await MessageBox('У тебя нет профили');
    }
    return false;
  }

  async signIn(email?: string, password?: string, token?: string, userId?: string){
    if(email && password){
      this.server.send(PacketDataKeys.SIGN_IN, { [PacketDataKeys.EMAIL]: email, [PacketDataKeys.PASSWORD]: MD5(password), [PacketDataKeys.DEVICE_ID]: tokenHex(8) });
    } else if(userId && token) {
      this.server.send(PacketDataKeys.SIGN_IN, { [PacketDataKeys.OBJECT_ID]: userId, [PacketDataKeys.TOKEN]: token, [PacketDataKeys.DEVICE_ID]: tokenHex(8) });
    }
    return await this.server.awaitPacket([PacketDataKeys.USER_SIGN_IN, PacketDataKeys.SIGN_IN_ERROR]);
  }

  async signUp({ email, password }: { email: string, password: string }) {
    if(!email || !password) return;

    const data = await fetch(`https://api.mafia.dottap.com/user/sign_up`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: new URLSearchParams({
        email,
        username: '',
        password: MD5(password),
        deviceId: tokenHex(8),
        lang: 'RUS'
      })
    });
    const result = await data.json();
    if(result.error){
      if(result.error == 'USING_TEMP_EMAIL'){
        await MessageBox(`Запрещено использовать сервисы для временной регистрации email.\nИспользуйте популярные сервисы, например Gmail, Mail.Ru, Yandex, Yahoo и тд.`);
      } else if(result.error == 'EMAIL_EXISTS'){
        await MessageBox(`Данный email уже зарегистрирован`);
      }
      return;
    }

    if(result[PacketDataKeys.OBJECT_ID]) {
      const userId = result[PacketDataKeys.OBJECT_ID];
      const token = result[PacketDataKeys.TOKEN];

      this.addProfile({
        name: '',
        email,
        password,
        token,
        userId
      });

      App.user.bToken = generateRandomToken();
      App.screen = new Dashboard();
    }
  }
}
