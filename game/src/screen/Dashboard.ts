import fs from "../../../core/src/fs/fs";
import App from "../App";
import ConfirmBox from "../dialog/ConfirmBox";
import ProfileInfo from "../dialog/ProfileInfo";
import PromptBox from "../dialog/PromptBox";
import PacketDataKeys from "../../../core/src/PacketDataKeys";
import { getAvatarImg, getBackgroundImg, getDefaultAvatar, getTexture } from "../utils/Resources";
import GlobalChat from "./GlobalChat";
import Rooms from "./Rooms";
import Screen from "./Screen";
import { isMobile } from "../../../core/src/utils/mobile";
import Friends from "./Friends";
import MessageBox from "../dialog/MessageBox";
import Settings from "./Settings";
import Box from "../dialog/Box";

function pngToJpgBase64(file: File, quality = 0.9): Promise<string> {
    return new Promise((resolve, reject) => {
        if(file.type != 'image/png') {
            reject(new Error('Файл не PNG'));
            return;
        }

        const img = new Image();
        const reader = new FileReader();

        reader.onload = () => {
            img.src = reader.result as string;
        };

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;

            const ctx = canvas.getContext('2d');
            if(!ctx) {
                reject(new Error('Canvas недоступен'));
                return;
            }

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.drawImage(img, 0, 0);

            const jpgBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(jpgBase64);
        };

        img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
        reader.onerror = () => reject(new Error('Ошибка чтения файла'));

        reader.readAsDataURL(file);
    });
}

export default class Dashboard extends Screen {
    constructor(){
        super('Dashboard');

        App.title = 'Меню';
        
        (async()=> this.element.style.background = `url(${await getBackgroundImg('menu3')}) 0% 0% / cover`)();
        
        const header = document.createElement('div');
        header.className = 'header';
        this.element.appendChild(header);
        const logo = document.createElement('label');
        logo.textContent = 'Бафия онлайн';
        header.appendChild(logo);

        this.on('back', () => App.win.close())

        this.init();
    }
    async init(){
        const div = document.createElement('div');
        div.style.textAlign = 'center';
        this.element.appendChild(div);

        const avatar = document.createElement('img');
        const nick = document.createElement('span');
        avatar.style.borderRadius = '100%'
        avatar.width = avatar.height = 100;
        avatar.style.margin = '5px';
        avatar.onclick = async() => {
            App.server.send(PacketDataKeys.USER_GET_DEFAULT_PHOTOS, {});
            const data = await App.server.awaitPacket(PacketDataKeys.USER_DEFAULT_PHOTOS);
            const photos = data[PacketDataKeys.USER_DEFAULT_PHOTOS][PacketDataKeys.USER_DEFAULT_PHOTOS_IDS] as string[];
            photos.sort((a, b) => {
                const [ta, na] = [a[0], Number(a.slice(1))];
                const [tb, nb] = [b[0], Number(b.slice(1))];

                if(ta !== tb) return ta === 'm' ? -1 : 1;
                return na - nb;
            });
            
            const box = new Box({ title: 'ФОТО ПРОФИЛЯ', width: '325px', height: '240px', canCloseAnywhere: true });
            const e = document.createElement('div');
            e.style.display = 'flex';
            e.style.padding = '5px'
            e.style.alignItems = 'center';
            e.style.flexDirection = 'column';
            box.content.appendChild(e);
            const btnUpload = document.createElement('button');
            btnUpload.textContent = 'Загрузить';
            btnUpload.onclick = () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/png, image/jpeg';
                input.style.display = 'none';

                input.onchange = async() => {
                    const file = input.files?.[0];
                    if(!file) return;

                    if(!['image/png', 'image/jpeg'].includes(file.type)) {
                        MessageBox('Допустимы только PNG и JPG');
                        return;
                    }

                    let base64: string;

                    try {
                        if(file.type == 'image/png') {
                            const jpgDataUrl = await pngToJpgBase64(file);
                            base64 = jpgDataUrl.split(',')[1];
                        } else {
                            base64 = await new Promise<string>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                                reader.onerror = () => reject();
                                reader.readAsDataURL(file);
                            });
                        }
                    } catch {
                        MessageBox('Ошибка обработки изображения');
                        return;
                    }

                    App.server.send(PacketDataKeys.UPLOAD_PHOTO, {
                        [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
                        [PacketDataKeys.TOKEN]: App.user.token,
                        [PacketDataKeys.FILE]: base64
                    });

                    const data = await App.server.awaitPacket([
                        PacketDataKeys.DASHBOARD,
                        PacketDataKeys.WRONG_FILE_TYPE
                    ]);

                    if(data[PacketDataKeys.TYPE] == PacketDataKeys.WRONG_FILE_TYPE) {
                        MessageBox('Допустимы только PNG и JPG');
                        return;
                    }

                    delete App.resources[`avatars_${App.user.objectId}`];
                    App.user.photo = '1';
                    await box.close();
                    App.screen = new Dashboard();
                };

                document.body.appendChild(input);
                input.click();
                input.remove();
            }
            e.appendChild(btnUpload);
            const orList = document.createElement('span');
            orList.textContent = 'или выберите из списка:';
            orList.style.padding = '10px';
            orList.style.color = 'black';
            e.appendChild(orList);
            const images = document.createElement('div');
            images.style.display = 'flex';
            images.style.flexWrap = 'wrap'
            images.style.width = '300px';
            images.style.height = '100px';
            images.style.background = '#969696';
            images.style.borderRadius = '10px';
            images.style.overflowY = 'overlay';
            images.style.padding = '5px';
            for(const p of photos){
                const img = document.createElement('img');
                img.src = `https://dottap.com/mafia/profile_photo/default/${p}.jpg`;
                img.width = img.height = 50;
                img.style.borderRadius = '100%';
                img.style.padding = '2px';
                img.onmousedown = e => e.preventDefault();
                img.onclick = async() => {
                    App.server.send('ussdph', {
                        [PacketDataKeys.PHOTO]: p,
                        [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
                        [PacketDataKeys.TOKEN]: App.user.token
                    });
                    await App.server.awaitPacket('ussdph');
                    delete App.resources[`avatars_${App.user.objectId}`];
                    App.user.photo = p;
                    avatar.src = img.src;
                }
                images.appendChild(img);
            }
            e.appendChild(images);

            await box.wait('destroy');
        }
        avatar.onmousedown = e => e.preventDefault();
        getAvatarImg({
            [PacketDataKeys.OBJECT_ID]: App.user.objectId,
            [PacketDataKeys.PHOTO]: App.user.photo,
        }).then(e => avatar.src = e);
        nick.textContent = App.user.username;
        div.appendChild(avatar);
        div.appendChild(document.createElement('br'));
        div.appendChild(nick);

        const info = document.createElement('div');
        info.innerHTML = `Добро пожаловать в Бафию онлайн`.replaceAll(`\n`,'<br/>');
        info.style.padding = '10px';
        div.appendChild(info);

        const btnRooms = document.createElement('button');
        btnRooms.textContent = 'Комнаты';
        btnRooms.style.width = '60%'
        btnRooms.style.margin = '3px'
        btnRooms.onclick = () => App.screen = new Rooms();
        div.appendChild(btnRooms);
        div.appendChild(document.createElement('br'));

        const btnMM = document.createElement('button');
        btnMM.textContent = 'Соревновательный';
        btnMM.style.width = '60%'
        btnMM.style.margin = '3px'
        btnMM.disabled = true;
        div.appendChild(btnMM);
        div.appendChild(document.createElement('br'));

        const btnGlobalChat = document.createElement('button');
        btnGlobalChat.textContent = 'Чат';
        btnGlobalChat.style.width = '60%'
        btnGlobalChat.style.margin = '3px'
        btnGlobalChat.onclick = () => App.screen = new GlobalChat();
        div.appendChild(btnGlobalChat);
        div.appendChild(document.createElement('br'));

        const btnFriends = document.createElement('button');
        btnFriends.textContent = 'Друзья';
        btnFriends.style.width = '60%'
        btnFriends.style.margin = '3px'
        btnFriends.onclick = () => App.screen = new Friends();
        div.appendChild(btnFriends);
        div.appendChild(document.createElement('br'));

        // const btnBackpack = document.createElement('button');
        // btnBackpack.textContent = 'Рюкзак';
        // btnBackpack.style.width = '60%'
        // btnBackpack.style.margin = '3px'
        // btnBackpack.disabled = true;
        // div.appendChild(btnBackpack);
        // div.appendChild(document.createElement('br'));

        // const btnShop = document.createElement('button');
        // btnShop.textContent = 'Магазин';
        // btnShop.style.width = '60%';
        // btnShop.style.margin = '3px';
        // btnShop.disabled = true;
        // div.appendChild(btnShop);
        // div.appendChild(document.createElement('br'));

        const btnSettings = document.createElement('button');
        btnSettings.textContent = 'Настройки';
        btnSettings.style.width = '60%'
        btnSettings.style.margin = '3px'
        btnSettings.onclick = () => App.screen = new Settings();
        div.appendChild(btnSettings);
        div.appendChild(document.createElement('br'));

        const btnProfile = document.createElement('button');
        btnProfile.textContent = 'Профиль';
        btnProfile.style.width = '60%'
        btnProfile.style.margin = '3px'
        btnProfile.onclick = () => ProfileInfo(App.user.objectId);
        div.appendChild(btnProfile);
        div.appendChild(document.createElement('br'));

        // const btnRules = document.createElement('button');
        // btnRules.textContent = 'Правила';
        // btnRules.style.width = '60%'
        // btnRules.style.margin = '3px'
        // btnRules.disabled = true;
        // div.appendChild(btnRules);
        // div.appendChild(document.createElement('br'));

        if(isMobile()){
            const btnFullScreen = document.createElement('button');
            btnFullScreen.textContent = 'Включить полноэкранный режим';
            btnFullScreen.style.width = '60%'
            btnFullScreen.style.margin = '3px';
            btnFullScreen.onclick = async() => {
                const elem = document.body;
                // @ts-ignore
                const fsElem = document.fullscreenElement ?? document.webkitFullscreenElement ?? document.mozFullScreenElement ?? document.msFullscreenElement;

                if(!elem.requestFullscreen){
                    MessageBox(`Полноэкранный режим в этом браузере не работает, увы..`);
                    btnFullScreen.disabled = true;
                    return;
                }
                
                try{
                    if(!fsElem) await elem.requestFullscreen();
                    else await document.exitFullscreen();
                    if(fsElem){
                        btnFullScreen.textContent = 'Включить полноэкранный режим';
                    } else {
                        btnFullScreen.textContent = 'Выключить полноэкранный режим';
                    }
                }catch(e){
                    MessageBox(`Ошибка: ${e}`);
                }
            }
            div.appendChild(btnFullScreen);
            
            const btnClose = document.createElement('button');
            btnClose.textContent = 'Закрыть игру';
            btnClose.style.width = '60%'
            btnClose.style.margin = '3px';
            btnClose.onclick = () => App.win.close()
            div.appendChild(btnClose);
        }
        
        App.server.send(PacketDataKeys.ADD_CLIENT_TO_DASHBOARD, {
            [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
            [PacketDataKeys.TOKEN]: App.user.token
        });
        const data = await App.server.awaitPacket(PacketDataKeys.DASHBOARD);
        const db = data[PacketDataKeys.DASHBOARD];
        const du = db[PacketDataKeys.DASHBOARD_USER];
        App.user.update(du);
        App.user.goldCoins = db[PacketDataKeys.USER_ACCOUNT_COINS][PacketDataKeys.GOLD_COINS];
        App.user.sliverCoins = db[PacketDataKeys.USER_ACCOUNT_COINS][PacketDataKeys.SILVER_COINS];
        
        nick.textContent = du[PacketDataKeys.USERNAME];

        const requests = Number(db[PacketDataKeys.FRIENDSHIP_REQUESTS]);
        const newMessages = Number(db[PacketDataKeys.NEW_MESSAGES]);
        
        // пиздец говнокод, похуй
        if(newMessages > 0 || requests > 0){
            btnFriends.innerHTML = '';
            const div = document.createElement('div');
            div.textContent = `Друзья`;
            btnFriends.appendChild(div);
            {
                const div1 = document.createElement('div');
                div1.style.display = 'flex';
                div1.style.alignItems = 'center';
                div1.textContent = newMessages > 0 ? newMessages + '' : '';
                if(newMessages > 0) {
                    const img = document.createElement('img');
                    img.width = 18;
                    img.height = 14;
                    img.style.marginLeft = '5px';
                    getTexture('ui/0Y.png').then(e => img.src = e);
                    div1.appendChild(img);
                }
                btnFriends.appendChild(div1);
                {
                    const e = document.createElement('div');
                    e.style.display = 'flex';
                    e.style.alignItems = 'center';
                    e.style.justifyContent = 'flex-end';
                    e.textContent = requests > 0 ? requests + '' : '';
                    if(requests > 0) {
                        const img = document.createElement('img');
                        img.width = 18;
                        img.height = 18;
                        img.style.marginLeft = '5px';
                        getTexture('ui/-8.png').then(e => img.src = e);
                        e.appendChild(img);
                    }
                    div1.appendChild(e);
                }
            }
        }
    }
}