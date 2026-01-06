import fs from "../../core/src/fs/fs";
import { isMobile } from "../../core/src/utils/mobile";
import { wrap } from "../../core/src/utils/TypeScript";
import App from "./App";
import MessageBox from "./dialog/MessageBox";

export default class Settings {
    data = {
        version: 2,
        window: {
            zoom: isMobile() ? .6 : 1
        },
        game: {
            widthPL: 130,
            zoomPL: 1,
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
                if(typeof obj[key] == 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    this.#wrapObject(obj[key]);
                }
                
                wrap(obj, key, () => this.#isInitialized && this.write());
            }
        }
    }

    async init(){
        if(this.#isInitialized) return;
        this.#isInitialized = true;
        
        await this.read();
    }

    async write() {
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
        
        // Миграция с v1 на v2
        if(savedVersion == 1 && currentVersion >= 2) {
            if(typeof data.settings == 'undefined') {
                data.settings = {
                    title: "",
                    dayTime: 0,
                    minPlayers: 5,
                    maxPlayers: 8,
                    minLevel: 1,
                    selectedRoles: [6, 9, 11, 2, 5, 7, 8, 10],
                    password: '',
                    vip: false
                };
            }
            data.version = 2;
        }
        
        return data;
    }
}