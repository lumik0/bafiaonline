import PacketDataKeys from "../../../core/src/PacketDataKeys";
import { formatDate } from "../../../core/src/utils/format";
import { isMobile } from "../../../core/src/utils/mobile";
import { noXSS } from "../../../core/src/utils/utils";
import App from "../App";
import ProfileInfo from "../dialog/ProfileInfo";
import { MessageStyle } from "../enums";
import { insertAtCaret } from "../utils/DOM";
import { getAvatarImg, getBackgroundImg, getTexture } from "../utils/Resources";
import Friends from "./Friends";
import Screen from "./Screen";

export default class PrivateChat extends Screen {
    messagesElem!: HTMLDivElement
    input!: HTMLInputElement

    constructor(public friendObjectId: string, public friendUserObjectId: string, public user: any){
        super('PrivateChat');
                
        App.title = user[PacketDataKeys.USERNAME];
        
        (async()=> this.element.style.background = `url(${await getBackgroundImg('day3')}) 0% 0% / cover`)();
        
        const header = document.createElement('div');
        header.className = 'header';
        this.element.appendChild(header);
        const back = document.createElement('button');
        back.className = 'back';
        back.onclick = () => this.emit('back');
        header.appendChild(back);
        const backImg = document.createElement('img');
        backImg.width = 24;
        getTexture(`ui/Jb.png`).then(e => backImg.src = e);
        back.appendChild(backImg);
        const title = document.createElement('label');
        title.textContent = user[PacketDataKeys.USERNAME];
        header.appendChild(title);
        
        this.on('back', () => {
            App.screen = new Friends();
        });
        
        this.init();
    }

    async init(){
        App.server.send(PacketDataKeys.ADD_CLIENT_TO_PRIVATE_CHAT, {
            [PacketDataKeys.TOKEN]: App.user.token,
            [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
            [PacketDataKeys.FRIENDSHIP]: this.friendObjectId
        });
        
        const data = await App.server.awaitPacket(PacketDataKeys.PRIVATE_CHAT_LIST_MESSAGES);

        this.messagesElem = document.createElement('div');
        this.messagesElem.style.height = (App.height - 80) + 'px';
        this.messagesElem.style.textAlign = 'center';
        this.messagesElem.style.overflowX = 'hidden';
        this.messagesElem.style.overflowY = 'overlay';
        this.messagesElem.style.margin = '10px';
        this.messagesElem.style.outline = '2px solid #c0c0c0';
        this.messagesElem.style.borderRadius = '3px';
        this.messagesElem.style.background = 'rgba(255,255,255,.5)';
        this.messagesElem.style.display = 'flex';
        this.messagesElem.style.flexDirection = 'column';
        this.messagesElem.style.justifyContent = 'flex-start';
        this.element.appendChild(this.messagesElem);

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
        if(isMobile()){
            this.input.addEventListener('focus', () => {
                App.width = innerWidth;
                App.height = innerHeight-1;
                // this.messagesElem.scrollTop = this.messagesElem.scrollHeight;
            });
            this.input.addEventListener('blur', () => {
                App.width = innerWidth;
                App.height = innerHeight-2;
            });
        }

        this.on('keydown', e => e.key == 'Enter' && this.input.focus());
        footer.appendChild(this.input);

        this.on('message', data => {
            if(data[PacketDataKeys.TYPE] == PacketDataKeys.PRIVATE_CHAT_LAST_MESSAGE){
                this.addMessage(data[PacketDataKeys.MESSAGE]);
            }
        });
                
        this.on('resize', () => {
            this.messagesElem.style.height = (App.height - 80) + 'px';
        });

        for(const m of data[PacketDataKeys.MESSAGES]) this.addMessage(m, false);
        this.messagesElem.scrollTop = this.messagesElem.scrollHeight;

        App.server.send(PacketDataKeys.ACCEPT_MESSAGES, {
            [PacketDataKeys.FRIENDSHIP]: this.friendObjectId
        });
    }

    messages = 0
    lastMessage!: {
        userObjectId?: string,
        divM?: HTMLElement
    }
    lastMessageDate!: {
        userObjectId?: string,
        elem?: HTMLElement
    }
    addMessage(m: any, deleteFirst = this.messages > 100 ? true : false){
        const text = m[PacketDataKeys.TEXT];
        const type = m[PacketDataKeys.MESSAGE_TYPE];
        const sticker = m[PacketDataKeys.MESSAGE_STICKER];
        const userObjectId = m[PacketDataKeys.USER_OBJECT_ID];
        const user = App.user.objectId == userObjectId ? App.user : this.user;
        const username = App.user.objectId == userObjectId ? App.user.username : this.user[PacketDataKeys.USERNAME]
        const created = m[PacketDataKeys.CREATED];
        const accepted = m[PacketDataKeys.ACCEPTED];

        if(userObjectId && !m.isDate){
            if(this.lastMessage && this.lastMessage.divM && this.lastMessage.userObjectId == userObjectId){
                const msg = document.createElement('span');
                msg.textContent = noXSS(text);
                msg.className = 'black';
                msg.style.userSelect = 'text';
                this.lastMessage.divM.appendChild(msg);
            } else {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.textAlign = 'left';
                if(!accepted) div.style.background = '#c5c5c5';
                const divM = document.createElement('div');
                divM.style.display = 'flex';
                divM.style.flexDirection = 'column';
                divM.style.justifyContent = 'center';
                divM.style.wordBreak = 'auto-phrase';
                const avatar = document.createElement('img');
                getAvatarImg(user).then(e => avatar.src = e);
                avatar.style.borderRadius = '100%'
                avatar.width = 35;
                avatar.height = 35;
                avatar.style.margin = '5px';
                avatar.onmousedown = e => e.preventDefault();
                avatar.onclick = () => ProfileInfo(userObjectId);
                const nick = document.createElement('span');
                nick.textContent = noXSS(username);
                nick.className = 'black';
                nick.onclick = () => this.addNickToInput(username);
                const msg = document.createElement('span');
                msg.textContent = noXSS(text);
                msg.style.color = 'black';
                msg.style.userSelect = 'text';
                this.messagesElem.appendChild(div);
                this.lastMessage = { userObjectId, divM }
                div.appendChild(avatar);
                div.appendChild(divM);
                divM.appendChild(nick);
                divM.appendChild(msg);

                this.addMessage({ isDate: true, [PacketDataKeys.TEXT]: `${formatDate(created)}`, [PacketDataKeys.ACCEPTED]: accepted, [PacketDataKeys.USER_OBJECT_ID]: userObjectId }, deleteFirst);
            }
        } else {
            const div = document.createElement('div');
            div.textContent = noXSS(text);
            div.style.color = 'black';
            div.style.userSelect = 'text';
            if(!accepted) div.style.background = '#c5c5c5'
            div.style.textAlign = 'right';
            div.style.padding = '3px';
            this.messagesElem.appendChild(div);
            this.lastMessageDate = { userObjectId, elem: div };
        }
        // console.log(this.messages.scrollTop, this.messages.scrollHeight)
        if(this.messagesElem.scrollHeight - App.height - this.messagesElem.scrollTop < 75)
            this.messagesElem.scroll({ top: this.messagesElem.scrollHeight, behavior: 'smooth' });

        if(deleteFirst && this.messagesElem.firstElementChild)
            this.messagesElem.removeChild(this.messagesElem.firstElementChild);

        this.messages++
    }

    addNickToInput(username: string){
        const isFocused = document.activeElement == this.input;

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

        if(isMobile()) this.input.focus();
    }
    
    sendMessage(message: string, options: { messageStyle?: MessageStyle, messageSticker?: boolean } = {}){
        if(message.startsWith('!')){
            const symbols = "?!&@#%^~<>*";
            message = Array.from({ length: [...message].length-1 }, () => symbols[Math.random() * symbols.length | 0]).join("");
        }
        
        App.server.send(PacketDataKeys.PRIVATE_CHAT_MESSAGE_CREATE, {
            [PacketDataKeys.MESSAGE]: {
                [PacketDataKeys.FRIENDSHIP]: this.friendObjectId,
                [PacketDataKeys.MESSAGE_STYLE]: options.messageStyle ?? 0,
                [PacketDataKeys.MESSAGE_STICKER]: options.messageSticker ?? false,
                [PacketDataKeys.TEXT]: message
            }
        });
    }
}