import App from "../App";
import PacketDataKeys from "../../../core/src/PacketDataKeys";
import Auth from "./Auth";
import Events from "../../../core/src/Events";
import MessageBox from "../dialog/MessageBox";
import Authorization from "../screen/Authorization";
import Dashboard from "../screen/Dashboard";
import format from '../../../core/src/utils/format';

interface ServerEvents {
    connect: () => void
    message: (data: any) => void
    close: () => void
}

// @ts-ignore
export default class Server extends Events<ServerEvents> {
    webSocket!: WebSocket

    auth = new Auth(this);
    config = {
        CONNECTION_CHECKER_PERIOD: 2000,
        CONNECTION_INACTIVE_TIMEOUT: 6000,
        KICK_USER_PRICE: 200,
        PRICE_USERNAME_SET: 5000,
        SERVER_LANGUAGE_CHANGE_TIME: 21600000,
        SERVER_ROOM_PASSWORD_MINIMAL_LEVEL: 0,
        SERVER_ROOM_TITLE_MINIMAL_LEVEL: 3,
        SET_PROFILE_PHOTO_MINIMAL_LEVEL: 3,
        SHOW_PASSWORD_ROOM_INFO_BUTTON: true,
        mmguiqik: -1
    }
    
    constructor(){
        super();
        this.#connect();
    }

    #connect(){
        console.log(`Connecting to server.. ${App.config.uriServer}`);
        this.webSocket = new WebSocket(App.config.uriServer);
        this.webSocket.addEventListener('open', this.#init.bind(this));
        this.webSocket.addEventListener('error', (e) => console.error(e));
        this.webSocket.addEventListener('close', () => {
            console.log(`Connection is closed.. Reconnecting in 2 seconds..`);
            this.call('close');
            setTimeout(() => this.#connect.bind(this), 2000);
        });
        
        const ReversePacketDataKeys = Object.fromEntries(Object.entries(PacketDataKeys).map(([k, v]) => [v, k]));

        function decodePacket(value: any): any {
            // примитивы — возвращаем как есть
            if(value === null || typeof value !== 'object') {
                return value;
            }

            // массив
            if(Array.isArray(value)) {
                return value.map(decodePacket);
            }

            // объект
            const result = {};

            for(const key in value) {
                const decodedKey = ReversePacketDataKeys[key] ?? key; // @ts-ignore
                result[decodedKey] = decodePacket(value[key]);
            }

            return result;
        }

        this.webSocket.addEventListener('message', e => {
            const json = JSON.parse(e.data);

            this.call('message', json);
            // try {
            //     const packet = ServerPacket.deserialize(event.data);
            //     this.call('packet', packet);
            // } catch(err) {
            //     logger.error('Failed to deserialize packet', err);
            // }
            console.log(json, decodePacket(json));
            // console.log('-', json)
            // console.log(decodePacket(json));
        });
    }

    async #init(){
        this.call('connect');
        console.log(`Connected to server`);

        if(App.config.auth){
            await this.auth.auth();
        } else {
            App.screen = new Authorization();
        }

        this.on('message', data => {
            if(data[PacketDataKeys.TYPE] == PacketDataKeys.USER_BLOCKED){
                const reason = data[PacketDataKeys.REASON];
                const tsr = data[PacketDataKeys.TIME_SEC_REMAINING];
                App.screen = new Dashboard();
                MessageBox(`Вы были заблокированы по причине [${reason}]\n\nОставшееся время блокировки:\n${format(tsr, 'genitive')}`, { height: '200px' });
            } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.USER_INACTIVE_BLOCKED){
                App.screen = new Dashboard();
                const tsr = data[PacketDataKeys.TIME_SEC_REMAINING];
                MessageBox(`Вы были неактивны\n\nОставшееся время блокировки:\n${format(tsr, 'genitive')}`, { height: '200px' });
            } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.SIGN_IN_ERROR){
                if(data[PacketDataKeys.ERROR] == -4){
                    App.screen = new Authorization();
                    MessageBox(`Сессия не валидна. Авторизуйтесь снова`);
                }
            }
        });
    }

    send(data: object): void
    send(type: string, data: object): void
    send(type: string|object, data?: object){
        if(typeof type == 'object'){
            this.webSocket.send(JSON.stringify(type));
        } else {
            this.webSocket.send(JSON.stringify({ [PacketDataKeys.TYPE]: type, ...data}));
        }
    }

    async awaitPacket(type: string|string[], timeout = 10_000_000): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.off('message', onMessage as any);
                reject(new Error(`awaitPacket timeout: ${type}`));
            }, timeout);
    
            const onMessage = (message: any) => {
                if(typeof type == 'string' ? message[PacketDataKeys.TYPE] == type : type.includes(message[PacketDataKeys.TYPE])) {
                    clearTimeout(timer);
                    this.off('message', onMessage as any);
                    resolve(message);
                }
            };

            this.on("message", onMessage);
        });
    }
}