import { Config } from "../../core/src/config";
import Box from "./dialog/Box";
import Events from "../../core/src/Events";
import Loading from "./screen/Loading";
import Screen from "./screen/Screen";
import User from "./server/User";
import Server from "./server/Server";
import style from "./style";
import Settings from './Settings';
import { wrap } from '../../core/src/utils/TypeScript';
import { isMobile } from '../../core/src/utils/mobile';
import fs from "../../core/src/fs/fs";
import Component from "./component/Component";
import IWindow from "../../core/src/IWindow";

interface AppEvents {
    tick: (dt: number) => void
    resize: (e: { oldWidth: number, oldHeight: number }) => void
    focus: (e: FocusEvent) => void
    click: (e: PointerEvent) => void
    contextmenu: (e: PointerEvent) => void
    unfocus: (e: FocusEvent) => void
    keydown: (e: KeyboardEvent) => void
    keyup: (e: KeyboardEvent) => void
    wheel: (e: WheelEvent) => void
    screenChange: (screen: Screen) => void
}

// @ts-ignore
class App extends Events<AppEvents> {
    version = 'Alpha 1.1'

    element!: HTMLElement
    config!: Config
    win!: IWindow
    screen!: Screen
    server!: Server
    settings = new Settings();
    user = new User();

    title = "";
    width = 0;
    height = 0;
    
    resources: Record<string, string> = {};
    
    boxs: Box[] = [];
    components: Component[] = [];

    #isInitialized = false

    constructor(){
        super()

        wrap(this, 'title', (v: string) => this.win.title = `${v} - Бафия онлайн (vanilla ${this.version})`);
        wrap(this, 'screen', (v: Screen) => {
            this.call('screenChange', v);
            this.screen?.destroy();
            this.element.appendChild(v.element);
            // console.log(this.screen?.name, v.name);
            // console.log(this.customListeners);
        });

        let dt = 0;
        setInterval(() => {
            this.tick(dt);
            dt++;
        }, 50);
    }

    async init(){
        if(this.#isInitialized) return;
        this.#isInitialized = true;

        await this.settings.init();

        if(isMobile()) this.settings.data.window.zoom = .6;

        this.element.tabIndex = 0;
        this.element.style.zoom = this.settings.data.window.zoom + '';
        this.element.appendChild(await style(`${this.config.path}/assets/styles/main.json`));
        if(isMobile()) this.element.appendChild(await style(`${this.config.path}/assets/styles/mobile.json`));
        this.width = this.element.clientWidth;
        this.height = this.element.clientHeight;
        this.server = new Server();
        this.screen = new Loading('Подключение к серверу..');

        this.#loadImgs();
        this.#initEvents();
    }
    
    async #loadImgs(){
        for(let i = 1; i < 11; i++){
            this.resources[`role_${i}`] = await fs.loadImageAsDataURL(`${this.config.path}/assets/textures/roles/${i}.png`);
        }
        this.resources['unknownChat'] = await fs.loadImageAsDataURL(`${this.config.path}/assets/textures/roles/unknown_chat.png`);
    }
    #initEvents(){
        this.element.addEventListener('focus', (e) => this.emit('focus', e), true);
        this.element.addEventListener('blur', (e) => this.emit('unfocus', e), true);
        this.element.addEventListener('click', (e) => this.emit('click', e), true);
        this.element.addEventListener('contextmenu', (e) => this.emit('contextmenu', e), true);
        this.element.addEventListener('keydown', (e) => this.emit('keydown', e), true);
        this.element.addEventListener('keyup', (e) => this.emit('keyup', e), true);
        this.element.addEventListener('wheel', (e) => this.emit('wheel', e), true);

        this.on('wheel', e => {
            if(e.ctrlKey){
                let zoom = parseFloat(this.element.style.zoom), oldZoom = zoom;
                if(e.deltaY < 0){ // up
                    if(zoom > 2.5) return;
                    zoom += .1;
                } else { // down
                    if(zoom < 0.2) return;
                    zoom -= .1;
                }
                
                if(zoom != oldZoom) {
                    this.settings.data.window.zoom = zoom;
                    this.element.style.zoom = zoom+''
                }
                
                e.preventDefault();
            }
        });
        this.on('keydown', e => {
            if(e.ctrlKey){
                let zoom = parseFloat(this.element.style.zoom), oldZoom = zoom;
                if(e.key == '=' || e.key == '+'){
                    e.preventDefault();
                    if(zoom > 2.5) return;
                    zoom += .1;
                } else if(e.key == '-') {
                    e.preventDefault();
                    if(zoom < 0.2) return;
                    zoom -= .1;
                }
                
                if(zoom != oldZoom) {
                    this.settings.data.window.zoom = zoom;
                    this.element.style.zoom = zoom+''
                }
            }
        });

        this.win.on('close', () => this.destroy());
    }

    private tick(dt: number){
        this.emit('tick', dt);

        if(this.width != this.element.clientWidth || this.height != this.element.clientHeight) {
            const oldWidth = this.width;
            const oldHeight = this.height;
            this.width = this.element.clientWidth;
            this.height = this.element.clientHeight;
            this.emit('resize', { oldWidth, oldHeight });
        }

        this.screen?.tick(dt);
    }

    get zoom(){
        return this.settings.data.window.zoom
    }

    destroy(){
        this.resources = {};
        this.components.forEach(e => e.destroy());
        this.boxs.forEach(e => e.destroy());
        this.element.remove();
        this.removeAllEvents();
        this.server.destroy();
    }
}

export default new App();