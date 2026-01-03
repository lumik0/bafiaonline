import fs from "../../../core/src/fs/fs";
import App from "../App";
import ConfirmBox from "../dialog/ConfirmBox";
import ProfileInfo from "../dialog/ProfileInfo";
import PromptBox from "../dialog/PromptBox";
import PacketDataKeys from "../../../core/src/PacketDataKeys";
import { getAvatarImg, getBackgroundImg, getDefaultAvatar } from "../utils/Resources";
import GlobalChat from "./GlobalChat";
import Rooms from "./Rooms";
import Screen from "./Screen";
import { isMobile } from "../../../core/src/utils/mobile";

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
        btnRooms.addEventListener('click', () => App.screen = new Rooms());
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
        btnGlobalChat.addEventListener('click', () => App.screen = new GlobalChat());
        div.appendChild(btnGlobalChat);
        div.appendChild(document.createElement('br'));

        const btnFriends = document.createElement('button');
        btnFriends.textContent = 'Друзья';
        btnFriends.style.width = '60%'
        btnFriends.style.margin = '3px'
        btnFriends.disabled = true;
        div.appendChild(btnFriends);
        div.appendChild(document.createElement('br'));

        const btnBackpack = document.createElement('button');
        btnBackpack.textContent = 'Рюкзак';
        btnBackpack.style.width = '60%'
        btnBackpack.style.margin = '3px'
        btnBackpack.disabled = true;
        div.appendChild(btnBackpack);
        div.appendChild(document.createElement('br'));

        const btnShop = document.createElement('button');
        btnShop.textContent = 'Магазин';
        btnShop.style.width = '60%';
        btnShop.style.margin = '3px';
        btnShop.disabled = true;
        div.appendChild(btnShop);
        div.appendChild(document.createElement('br'));

        const btnSettings = document.createElement('button');
        btnSettings.textContent = 'Настройки';
        btnSettings.style.width = '60%'
        btnSettings.style.margin = '3px'
        btnSettings.disabled = true;
        div.appendChild(btnSettings);
        div.appendChild(document.createElement('br'));

        const btnProfile = document.createElement('button');
        btnProfile.textContent = 'Профиль';
        btnProfile.style.width = '60%'
        btnProfile.style.margin = '3px'
        btnProfile.addEventListener('click', () => ProfileInfo(App.user.objectId));
        div.appendChild(btnProfile);
        div.appendChild(document.createElement('br'));

        const btnRules = document.createElement('button');
        btnRules.textContent = 'Правила';
        btnRules.style.width = '60%'
        btnRules.style.margin = '3px'
        btnRules.disabled = true;
        div.appendChild(btnRules);
        div.appendChild(document.createElement('br'));

        if(isMobile()){
            const btnFullScreen = document.createElement('button');
            btnFullScreen.textContent = 'Включить полноэкранный режим';
            btnFullScreen.style.width = '60%'
            btnFullScreen.style.margin = '3px';
            btnFullScreen.onclick = async() => {
                // @ts-ignore
                const fsElem = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
                
                if(!fsElem) await App.screen.element.requestFullscreen()
                else await document.exitFullscreen();
                if(fsElem){
                    btnFullScreen.textContent = 'Включить полноэкранный режим';
                } else {
                    btnFullScreen.textContent = 'Выключить полноэкранный режим';
                }
            }
            div.appendChild(btnFullScreen);
            
            const btnClose = document.createElement('button');
            btnClose.textContent = 'Закрыть игру';
            btnClose.style.width = '60%'
            btnClose.style.margin = '3px';
            btnClose.onclick = async() => App.win.close()
            div.appendChild(btnClose);
        }
        
        App.server.send(PacketDataKeys.ADD_CLIENT_TO_DASHBOARD, {
            [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
            [PacketDataKeys.TOKEN]: App.user.token
        });
        const data = await App.server.awaitPacket(PacketDataKeys.DASHBOARD);
        const du = data[PacketDataKeys.DASHBOARD][PacketDataKeys.DASHBOARD_USER];
        App.user.update(du);
        App.user.goldCoins = data[PacketDataKeys.DASHBOARD][PacketDataKeys.USER_ACCOUNT_COINS][PacketDataKeys.GOLD_COINS];
        App.user.sliverCoins = data[PacketDataKeys.DASHBOARD][PacketDataKeys.USER_ACCOUNT_COINS][PacketDataKeys.SILVER_COINS];

        nick.textContent = du[PacketDataKeys.USERNAME];
        // avatar.src = await getAvatarImg(du);
    }
}