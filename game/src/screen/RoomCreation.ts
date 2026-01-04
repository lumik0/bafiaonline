import fs from "../../../core/src/fs/fs";
import PacketDataKeys from "../../../core/src/PacketDataKeys";
import md5salt from "../../../core/src/utils/md5";
import { getZoom } from "../../../core/src/utils/utils";
import App from "../App";
import { Role } from "../enums";
import { getBackgroundImg, getRoleImg, getTexture } from "../utils/Resources";
import Room from "./Room";
import Rooms from "./Rooms";
import Screen from "./Screen";

export default class RoomCreation extends Screen {
    data!: {
        title: string
        dayTime: number
        minPlayers: number
        maxPlayers: number
        minLevel: number
        selectedRoles: Role[]
        password: string
        vip: boolean
    }

    constructor(){
        super('RoomCreation');

        App.title = 'Создание комнаты';
        
        (async()=> this.element.style.background = `url(${await getBackgroundImg('menu3')}) 0% 0% / cover`)();
        
        const header = document.createElement('div');
        header.className = 'header';
        this.element.appendChild(header);
        const back = document.createElement('button');
        back.className = 'back';
        back.textContent = '<';
        back.onclick = () => this.emit('back');
        header.appendChild(back);
        const title = document.createElement('label');
        title.textContent = 'Создание комнаты';
        header.appendChild(title);
        
        this.on('back', () => {
            App.screen = new Rooms();
        });

        this.data = App.settings.data.roomCreate;

        this.init();
    }

    createRoom(data: {
        title: string
        dayTime: number
        minPlayers: number
        maxPlayers: number
        minLevel: number
        selectedRoles: Role[]
        password?: string
        vip: boolean
    }){
        App.server.send(PacketDataKeys.ROOM_CREATE, {
            [PacketDataKeys.TOKEN]: App.user.token,
            [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
            [PacketDataKeys.ROOM]: {
                [PacketDataKeys.TITLE]: data.title,
                [PacketDataKeys.DAYTIME]: 0,
                [PacketDataKeys.MIN_PLAYERS]: data.minPlayers,
                [PacketDataKeys.MAX_PLAYERS]: data.maxPlayers,
                [PacketDataKeys.MIN_LEVEL]: data.minLevel,
                [PacketDataKeys.SELECTED_ROLES]: data.selectedRoles,
                [PacketDataKeys.PASSWORD]: data.password ? md5salt(data.password) : '',
                [PacketDataKeys.VIP_ENABLED]: data.vip
            }
        });
        App.screen = new Room('', {
            sendRoomEnter: false
        });
    }

    init(){
        const self = this;
        const e = document.createElement('div');
        e.style.display = 'flex';
        e.style.padding = '10px'
        e.style.justifyContent = 'center';
        e.style.flexDirection = 'column';
        this.element.appendChild(e);

        function addH(text: string, { fontSize = 16, margin = '10px' } = {}){
            const h = document.createElement('p');
            h.style.textAlign = 'center';
            h.style.fontSize = fontSize + 'px';
            h.style.margin = margin;
            h.innerHTML = text;
            e.appendChild(h);
        }
        function addCheckbox(text: string, key: string|number, image: Promise<string>){
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.padding = '3px';
            e.appendChild(div);
            const img = document.createElement('img');
            img.width = 25;
            image.then(e => img.src = e);
            div.appendChild(img);
            const cb = document.createElement('input');
            cb.style.zoom = '1.5';
            cb.type = 'checkbox';
            // @ts-ignore
            cb.checked = typeof key == 'string' ? !!self.data[key] : self.data.selectedRoles.includes(key);
            cb.onchange = () => {
                if(typeof key == 'string') {
                    // @ts-ignore тупой тайпскрипт
                    self.data[key] = cb.checked
                } else {
                    self.data.selectedRoles =
                        self.data.selectedRoles.includes(key)
                            ? self.data.selectedRoles.filter(v => v !== key)
                            : [...self.data.selectedRoles, key];
                }
                console.log(self.data);
            }
            div.appendChild(cb);
            const span = document.createElement('span');
            span.textContent = text;
            div.appendChild(span);
        }
        function addSlider(type: 'players' | 'lvl') {
            function attachTooltip(wrapper: HTMLElement, input: HTMLInputElement, getText: () => string) {
                const tip = document.createElement('div');
                tip.className = 'range-tooltip';
                wrapper.appendChild(tip);

                function update() {
                    const minVal = Number(input.min);
                    const maxVal = Number(input.max);
                    const val = Number(input.value);

                    const width = wrapper.clientWidth;
                    const px = ((val - minVal) / (maxVal - minVal) * width) / App.zoom / getZoom();

                    tip.style.left = px + 'px';
                    tip.textContent = getText();
                }

                input.addEventListener('pointerdown', () => {
                    update();
                    tip.style.opacity = '1';
                });

                input.addEventListener('input', update);

                function hide() {
                    tip.style.opacity = '0';
                }

                input.addEventListener('pointerup', hide);
                input.addEventListener('pointercancel', hide);
                input.addEventListener('pointerleave', hide);
            }

            if(type == 'lvl'){
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';
                e.appendChild(wrapper);

                const el = document.createElement('input');
                el.style.width = '100%';
                el.type = 'range';
                el.min = '1';
                el.max = '13';
                el.value = String(self.data.minLevel);
                wrapper.appendChild(el);

                attachTooltip(wrapper, el, () => `${el.value}`);

                el.oninput = () => {
                    self.data.minLevel = Number(el.value);
                };
                return;
            }

            const wrapper = document.createElement('div');
            wrapper.className = 'range-wrapper';
            e.appendChild(wrapper);

            const track = document.createElement('div');
            track.className = 'range-track';
            wrapper.appendChild(track);

            const active = document.createElement('div');
            active.className = 'range-active';
            wrapper.appendChild(active);

            const min = document.createElement('input');
            const max = document.createElement('input');
            
            attachTooltip(wrapper, min, () => String(self.data.minPlayers));
            attachTooltip(wrapper, max, () => String(self.data.maxPlayers));

            min.type = max.type = 'range';
            min.min = max.min = '1';
            min.max = max.max = '21';

            min.value = String(self.data.minPlayers);
            max.value = String(self.data.maxPlayers);

            function sync(source?: HTMLInputElement) {
                let a = Number(min.value);
                let b = Number(max.value);

                if(a > b) {
                    if(source == min) b = a;
                    else a = b;
                }

                min.value = String(a);
                max.value = String(b);

                self.data.minPlayers = a;
                self.data.maxPlayers = b;

                const width = wrapper.clientWidth;
                const leftPx = ((a - 1) / (21 - 1) * width) / App.zoom / getZoom();
                const rightPx = ((b - 1) / (21 - 1) * width) / App.zoom / getZoom();

                active.style.left = leftPx + 'px';
                active.style.width = (rightPx - leftPx) + 'px';
            }

            min.oninput = () => sync(min);
            max.oninput = () => sync(max);

            wrapper.appendChild(min);
            wrapper.appendChild(max);

            sync();
        }
        
        const roomName = document.createElement('input');
        roomName.placeholder = `Название комнаты`;
        roomName.style.width = '100%';
        roomName.value = App.settings.data.roomCreate.title;
        roomName.oninput = () => this.data.title = roomName.value;
        e.appendChild(roomName);
        
        addH(`Количество игроков`);
        addSlider(`players`);
        addH(`Уровень комнаты`);
        addSlider(`lvl`);
        addH(`Дополнительные настройки`);
        addCheckbox('VIP комната', 'vip', getTexture(`vip/_u.png`));
        addH(`Дополнительные роли`, { margin: '10px 0 5px 0' });
        addH(`Команда мафии`, { fontSize: 13, margin: '5px' });
        addCheckbox(`Включить роль - Террорист`, 6, getRoleImg(Role.TERRORIST))
        addCheckbox(`Включить роль - Бармен`, 9, getRoleImg(Role.BARMAN))
        addCheckbox(`Включить роль - Информатор`, 11, getRoleImg(Role.INFORMER))
        addH(`Команда мирных жителей`, { fontSize: 13, margin: '5px' });
        addCheckbox(`Включить роль - Доктор`, 2, getRoleImg(Role.DOCTOR))
        addCheckbox(`Включить роль - Любовница`, 5, getRoleImg(Role.LOVER))
        addCheckbox(`Включить роль - Журналист`, 7, getRoleImg(Role.JOURNALIST))
        addCheckbox(`Включить роль - Телохранитель`, 8, getRoleImg(Role.BODYGUARD))
        addCheckbox(`Включить роль - Шпион`, 10, getRoleImg(Role.SPY));
        
        const roomPass = document.createElement('input');
        roomPass.placeholder = `Пароль (Оставьте пустым для выключения)`;
        roomPass.style.width = '100%';
        roomPass.value = App.settings.data.roomCreate.password;
        roomPass.oninput = () => this.data.password = roomPass.value;
        e.appendChild(roomPass);

        const btnCreate = document.createElement('button');
        btnCreate.textContent = 'Создать';
        btnCreate.onclick = () => this.createRoom(this.data);
        e.appendChild(btnCreate);
    }

    destroy() {
        super.destroy();
        App.settings.data.roomCreate = this.data;
    }
}