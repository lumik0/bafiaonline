import fs from "../../core/src/fs/fs";
import { isMobile } from "../../core/src/utils/mobile";
import { when, wrap } from "../../core/src/utils/TypeScript";
import App from "./App";
import MessageBox from "./dialog/MessageBox";

export default class Settings {
  data = {
    version: 5,
    debug: false,
    developer: false,
    window: {
      zoom: isMobile() ? .6 : 1
    },
    game: {
      widthPL: 130,
      zoomPL: 1,
      showYouDiedMessage: true,
      saveHistory: true,
      clearMessages: true,
      barmanEffect: '!'
    },
    roomCreate: {
      title: "",
      dayTime: 0,
      minPlayers: 5,
      maxPlayers: 8,
      minLevel: 1,
      selectedRoles: [6, 9, 11, 2, 5, 7, 8, 10],
      password: '',
      vip: false
    }
  }

  #isInitialized = false;

  #wrapObject(obj: any) {
    for(const key in obj) {
      if(obj.hasOwnProperty(key)) {
        let value = obj[key];
        if(typeof obj[key] == 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          this.#wrapObject(obj[key]);
        }

        wrap(obj, key, v => {
          value = v;
          this.write()
        }, () => value);
      }
    }
  }

  async init(){
    if(this.#isInitialized) return;
    this.#isInitialized = true;

    await this.read();
  }

  async write() {
    // console.log(JSON.stringify(this.data));
    await fs.writeFile(`${App.config.path}/settings.json`, JSON.stringify(this.data));
  }

  async read() {
    if(!(await fs.existsFile(`${App.config.path}/settings.json`))) {
      await this.write();
      return;
    }

    const savedData = JSON.parse(await fs.readFile(`${App.config.path}/settings.json`));

    const migratedData = this.#migrate(savedData);

    Object.assign(this.data, migratedData);

    console.log(`Settings:`, this.data);

    this.#wrapObject(this.data);
  }

  #migrate(savedData: any) {
    const savedVersion = savedData.version || 1;
    const currentVersion = this.data.version;

    if(savedVersion >= currentVersion) {
      return savedData;
    }

    let data = { ...savedData };

    when(savedVersion)
      .case(4, () => currentVersion >= 5 && (() => {
        data.game.saveHistory = true
        data.game.clearMessages = true
        data.version = 5;
      })());

    return data;
  }
}
