import App from "../App";
import { MessageStyle } from "../enums";
import PacketDataKeys from "../../../core/src/PacketDataKeys";
import Dashboard from "./Dashboard";
import Screen from "./Screen";
import { insertAtCaret } from '../utils/DOM'
import ProfileInfo from "../dialog/ProfileInfo";
import fs from "../../../core/src/fs/fs";
import { getAvatarImg, getBackgroundImg } from "../utils/Resources";
import { noXSS } from "../../../core/src/utils/utils";

export default class GlobalChat extends Screen {
    playersListElem!: HTMLDivElement
    messagesElem!: HTMLDivElement
    input!: HTMLInputElement

    constructor(){
        super('GlobalChat');

        App.title = 'Общий чат';
        
        (async()=> this.element.style.background = `url(${await getBackgroundImg('day3')}) 0% 0% / cover`)();
        
        const header = document.createElement('div');
        header.className = 'header';
        this.element.appendChild(header);
        const back = document.createElement('button');
        back.className = 'back';
        back.textContent = '<';
        back.onclick = () => this.emit('back');
        header.appendChild(back);
        const logo = document.createElement('label');
        logo.textContent = 'Общий чат';
        header.appendChild(logo);

        this.init();
    }
    async init(){
        App.server.send(PacketDataKeys.ADD_CLIENT_TO_CHAT, {
            [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
            [PacketDataKeys.TOKEN]: App.user.token
        });

        this.playersListElem = document.createElement('div');
        this.playersListElem.style.height = '155px';//(App.height - 225) + 'px';
        this.playersListElem.style.overflow = 'overlay';
        this.playersListElem.style.margin = '10px';
        this.playersListElem.style.outline = '2px solid #c0c0c0';
        this.playersListElem.style.borderRadius = '3px';
        this.playersListElem.style.background = 'rgba(255,255,255,.5)';
        this.playersListElem.style.display = 'flex';
        this.playersListElem.style.flexWrap = 'wrap';
        this.playersListElem.style.flexDirection = 'column';
        this.element.appendChild(this.playersListElem);

        this.messagesElem = document.createElement('div');
        this.messagesElem.style.height = (App.height - 250) + 'px';
        this.messagesElem.style.textAlign = 'center';
        this.messagesElem.style.overflowX = 'hidden';
        this.messagesElem.style.overflowY = 'overlay';
        this.messagesElem.style.margin = '10px';
        this.messagesElem.style.outline = '2px solid #c0c0c0';
        this.messagesElem.style.borderRadius = '3px';
        this.messagesElem.style.background = 'rgba(255,255,255,.5)';
        this.messagesElem.style.display = 'flex';
        this.messagesElem.style.flexDirection = 'column';
        this.messagesElem.style.justifyContent = 'flexEnd';
        this.element.appendChild(this.messagesElem);
        
        const data = await App.server.awaitPacket(PacketDataKeys.MESSAGES);
        for(const m of data[PacketDataKeys.MESSAGES]) this.addMessage(m, false);

        this.messagesElem.scrollTop = this.messagesElem.scrollHeight;

        const footer = document.createElement('div');
        footer.style.position = 'absolute';
        footer.style.width = '100%';
        footer.style.bottom = '2px';
        this.element.appendChild(footer);

        this.input = document.createElement('input');
        this.input.className = 'input-chat'
        this.input.type = `text`;
        this.input.placeholder = `Сообщение`;
        this.input.addEventListener('keydown', e => {
            if(e.key == 'Enter' && this.input.value != ''){
                const msg = this.input.value;
                this.input.value = '';
                this.sendMessage(msg);
            }
        });
        this.on('keydown', e => e.key == 'Enter' && this.input.focus());
        footer.appendChild(this.input);

        this.on('message', data => {
            if(data[PacketDataKeys.TYPE] == PacketDataKeys.MESSAGE){
                this.addMessage(data[PacketDataKeys.MESSAGE]);
            } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.USERS){
                this.updateUsers(data[PacketDataKeys.USERS]);
            }
        });

        this.on('back', () => {
            App.screen = new Dashboard();
        });
    }

    joinLeaveMessages: Record<string, HTMLElement> = {};
    lastMessage!: {
        user?: any,
        divM?: HTMLElement
    }
    addMessage(m: any, deleteFirst = true){
        const text = m[PacketDataKeys.TEXT];
        const type = m[PacketDataKeys.MESSAGE_TYPE];
        const sticker = m[PacketDataKeys.MESSAGE_STICKER];
        const user = m[PacketDataKeys.USER];

        if(user){
            if(this.lastMessage && this.lastMessage.divM && this.lastMessage.user[PacketDataKeys.USERNAME] == user[PacketDataKeys.USERNAME]){
                const msg = document.createElement('span');
                msg.textContent = noXSS(text);
                msg.style.color = 'black';
                msg.style.userSelect = 'text';
                this.lastMessage.divM.appendChild(msg);
            } else {
                const div = document.createElement('div');
                const avatar = document.createElement('img');
                const divM = document.createElement('div');
                const nick = document.createElement('span');
                const msg = document.createElement('span');
                getAvatarImg(user).then(e => avatar.src = e);
                avatar.style.borderRadius = '100%'
                avatar.width = 35;
                avatar.height = 35;
                avatar.style.margin = '5px';
                avatar.onmousedown = e => e.preventDefault();
                avatar.onclick = () => ProfileInfo(user[PacketDataKeys.OBJECT_ID]);
                nick.textContent = noXSS(user[PacketDataKeys.USERNAME]);
                nick.style.color = 'black';
                nick.onclick = () => this.addNickToInput(user[PacketDataKeys.USERNAME]);
                msg.textContent = noXSS(text);
                msg.style.color = type == 9 ? '#22640A' : type == 11 ? 'gray' : type == 17 ? '#1D3E67' : type == 27 ? '#7D080E' : 'black';
                msg.style.userSelect = 'text';
                divM.style.display = 'flex';
                divM.style.flexDirection = 'column';
                divM.style.justifyContent = 'center';
                divM.style.wordBreak = 'auto-phrase';
                div.style.display = 'flex';
                div.style.textAlign = 'left';
                div.appendChild(avatar);
                div.appendChild(divM);
                divM.appendChild(nick);
                divM.appendChild(msg);
                this.messagesElem.appendChild(div);
                this.lastMessage = { user, divM }
            }
        } else {
            const div = document.createElement('div');
            div.textContent = noXSS(type == 2 ? `Игрок ${text} вошёл` : type == 3 ? `Игрок ${text} вышел` : text);
            div.style.color = type == 2 ? '#22640A' : type == 3 ? '#7D080E' : 'black';
            div.style.userSelect = 'text';
            div.style.margin = '3px'
            this.messagesElem.appendChild(div);
            this.lastMessage = { user: undefined, divM: undefined };

            if(type == 2 || type == 3){
                if(this.joinLeaveMessages[text])
                    this.messagesElem.removeChild(this.joinLeaveMessages[text]);
                this.joinLeaveMessages[text] = div;
            }
        }
        // console.log(this.messages.scrollTop, this.messages.scrollHeight)
        if(this.messagesElem.scrollHeight - App.height - this.messagesElem.scrollTop < 75)
            this.messagesElem.scroll({ top: this.messagesElem.scrollHeight, behavior: 'smooth' });

        if(deleteFirst && this.messagesElem.firstElementChild)
            this.messagesElem.removeChild(this.messagesElem.firstElementChild);
    }

    addNickToInput(username: string){
        if(this.input.value.includes(`[${username}]`)) {
            const posStart = this.input.value.indexOf(`[${username}]`);
            const posEnd = this.input.value.lastIndexOf(`[${username}]`);
            if(posEnd == 0){
                this.input.value = this.input.value.replace(`[${username}] `, '');
            } else {
                if(this.input.value.substring(0, posStart).endsWith(' '))
                    this.input.value = this.input.value.replace(` [${username}] `, '');
                else
                    this.input.value = this.input.value.replace(`[${username}]`, '');
            }
        } else {
            if(['',' '].includes(this.input.value.substring((this.input.selectionStart??1)-1)))
                insertAtCaret(this.input, `[${username}] `);
            else
                insertAtCaret(this.input, ` [${username}] `);
        }
    }
    
    sendMessage(message: string, options: { messageStyle?: MessageStyle, messageSticker?: boolean } = {}){
        if(message.startsWith('!')){
            const symbols = "?!&@#%^~<>*";
            message = Array.from({ length: [...message].length-1 }, () => symbols[Math.random() * symbols.length | 0]).join("");
        }
        
        App.server.send(PacketDataKeys.CHAT_MESSAGE_CREATE, {
            [PacketDataKeys.MESSAGE]: {
                [PacketDataKeys.MESSAGE_STYLE]: options.messageStyle ?? 0,
                [PacketDataKeys.MESSAGE_STICKER]: options.messageSticker ?? false,
                [PacketDataKeys.TEXT]: message
            }
        });
    }

    updateUsers(users: any[]){
        this.playersListElem.innerHTML = '';
        for(let i = 0; i < users.length; i++){
            const user = users[i];
            const div = document.createElement('div');
            const avatar = document.createElement('img');
            const nick = document.createElement('span');
            getAvatarImg(user).then(e => avatar.src = e);
            avatar.style.borderRadius = '100%'
            avatar.width = avatar.height = 25;
            avatar.style.margin = '5px';
            avatar.onmousedown = e => e.preventDefault();
            avatar.onclick = () => ProfileInfo(user[PacketDataKeys.OBJECT_ID]);
            nick.textContent = noXSS(user[PacketDataKeys.USERNAME]);
            nick.style.color = 'black';
            nick.onclick = () => this.addNickToInput(user[PacketDataKeys.USERNAME]);
            div.style.display = 'flex';
            div.style.textAlign = 'left';
            div.style.alignItems = 'center';
            div.appendChild(avatar);
            div.appendChild(nick);
            this.playersListElem.appendChild(div);
        }
    }
}