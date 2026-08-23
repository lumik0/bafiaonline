import PacketDataKeys from "../../../core/src/PacketDataKeys";
import { formatDate } from "../../../core/src/utils/format";
import { isMobile } from "../../../core/src/utils/mobile";
import { noXSS } from "../../../core/src/utils/utils";
import App from "../App";
import ProfileInfo from "../dialog/ProfileInfo";
import { MessageStyle } from "../enums";
import { createElement, insertAtCaret } from '../../../core/src/utils/DOM'
import { getAvatarImg, getBackgroundImg, getTexture } from "../utils/Resources";
import Friends from "./Friends";
import Screen from "./Screen";

export default class PrivateChat extends Screen {
  messagesElem!: HTMLDivElement
  writingElem!: HTMLDivElement
  input!: HTMLInputElement
  emojiPanel!: HTMLDivElement;

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

    const data = await App.server.awaitPacket("pcmsr");

    this.messagesElem = document.createElement('div');
    this.messagesElem.style.height = (App.height - (isMobile() ? 110 : 90)) + 'px';
    this.messagesElem.style.textAlign = 'center';
    this.messagesElem.style.overflowX = 'hidden';
    this.messagesElem.style.overflowY = 'overlay';
    this.messagesElem.style.margin = '10px 10px 5px 10px';
    this.messagesElem.style.outline = '2px solid #c0c0c0';
    this.messagesElem.style.borderRadius = '3px';
    this.messagesElem.style.background = 'rgba(255,255,255,.5)';
    this.messagesElem.style.display = 'flex';
    this.messagesElem.style.flexDirection = 'column';
    this.messagesElem.style.justifyContent = 'flex-start';
    this.element.appendChild(this.messagesElem);

    this.writingElem = createElement('div', {
      css: {
        width: '100%',
        display: 'none'
      },
      appendTo: this.element
    });

    const footer = createElement('div', {
      css: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%'
      },
      appendTo: this.element
    });
    const footer2 = createElement('div', {
      css: {
        display: 'flex',
        width: '100%'
      },
      appendTo: footer
    });

    let lastValue = '';
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
    
    this.emojiPanel = createElement('div', {
      css: {
        display: 'none'
      },
      appendTo: footer
    });
    for(const e of ['sm1','sm2','sm3','sm4','sm5','sm6']) {
      const img = createElement('img', {
        width: 50, height: 50,
        css: {},
        appendTo: this.emojiPanel
      });
      getTexture(`emoji/${e}.png`).then(e => img.src = e);
      img.onclick = () => {
        insertAtCaret(this.input, `:${e}:`);
      }
    }

    const emojiBtn = createElement('img', {
      width: isMobile() ? 40 : 25, height: isMobile() ? 40 : 25,
      css: {},
      appendTo: footer2
    });
    getTexture('emoji/sm1.png').then(e => emojiBtn.src = e);
    emojiBtn.onclick = () => {
      this.emojiPanel.style.display = this.emojiPanel.style.display == 'none' ? 'block' : 'none';
      if(this.emojiPanel.style.display == 'block') {
        this.messagesElem.style.height = (App.height - (isMobile() ? 110 : 90)-60) + 'px';
      } else {
        this.messagesElem.style.height = (App.height - (isMobile() ? 110 : 90)) + 'px';
      }
    }

    this.on('keydown', e => e.key == 'Enter' && this.input.focus());
    footer2.appendChild(this.input);

    const sendBtn = createElement('img', {
      width: isMobile() ? 40 : 25, height: isMobile() ? 40 : 25,
      css: {},
      appendTo: footer2
    });
    getTexture('ui/6p.png').then(e => sendBtn.src = e);
    sendBtn.onclick = () => {
      if(this.input.value != ''){
        const msg = this.input.value;
        this.input.value = '';
        this.sendMessage(msg);
      }
    }

    this.on('message', data => {
      if(data[PacketDataKeys.TYPE] == "pcmr"){
        this.addMessage(data[PacketDataKeys.MESSAGE]);
      } else if(data[PacketDataKeys.TYPE] == 'pruint'){
        this.writingElem.style.display = 'none';
      } else if(data[PacketDataKeys.TYPE] == 'pruit') {
        this.writingElem.style.display = 'block';
      }
    });

    this.on('resize', () => {
      this.messagesElem.style.height = (App.height - (isMobile() ? 110 : 90)) + 'px';
    });

    for(const m of data[PacketDataKeys.MESSAGES]) this.addMessage(m, false);
    this.messagesElem.scrollTop = this.messagesElem.scrollHeight;

    App.server.send(PacketDataKeys.ACCEPT_MESSAGES, {
      [PacketDataKeys.FRIENDSHIP]: this.friendObjectId
    });
  }

  messages = 0
  lastMessage!: {
    objectId?: string
    playerObjectId?: string,
    divM?: HTMLElement
  }
  lastMessageDate!: {
    objectId?: string
    playerObjectId?: string,
    elem?: HTMLElement
  }
  addMessage(m: any, deleteFirst = this.messages > 100 ? true : false){
    const text = m[PacketDataKeys.TEXT];
    const type = m[PacketDataKeys.MESSAGE_TYPE];
    const sticker = m[PacketDataKeys.MESSAGE_STICKER];
    const objectId = m[PacketDataKeys.OBJECT_ID];
    const playerObjectId = m[PacketDataKeys.PLAYER_OBJECT_ID];
    const isMe = App.user.playerObjectId == playerObjectId;
    const user = isMe ? App.user : this.user;
    const username = isMe ? App.user.username : this.user[PacketDataKeys.USERNAME];
    const created = m[PacketDataKeys.CREATED];
    const accepted = m[PacketDataKeys.ACCEPTED];

    if(objectId && !m.isDate){
      if(this.lastMessage && this.lastMessage.divM && this.lastMessage.playerObjectId == playerObjectId){
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
        avatar.onclick = () => ProfileInfo(playerObjectId);
        const nick = document.createElement('span');
        // if(user[PacketDataKeys.VIP]) {
        //   const img = createElement('img', { width: 20, height: 20 });
        //   getTexture(`vip/0M.png`).then(e => img.src = e);
        //   nick.appendChild(img);
        // }
        createElement('span', { css: { marginLeft: '2px' }, text: user[PacketDataKeys.VIP] ? username + ` ${user[PacketDataKeys.VIP]}` : username, appendTo: nick });
        if(App.settings.data.hideUsername && username == App.user.username) nick.style.filter = 'blur(5px)';
        nick.className = 'black';
        nick.onclick = () => this.addNickToInput(username);
        const msg = document.createElement('span');
        msg.textContent = noXSS(text);
        msg.style.color = 'black';
        msg.style.userSelect = 'text';
        this.messagesElem.appendChild(div);
        this.lastMessage = { objectId, playerObjectId, divM }
        div.appendChild(avatar);
        div.appendChild(divM);
        divM.appendChild(nick);
        divM.appendChild(msg);

        this.addMessage({ isDate: true, [PacketDataKeys.TEXT]: `${formatDate(created)}`, [PacketDataKeys.ACCEPTED]: accepted, [PacketDataKeys.OBJECT_ID]: objectId }, deleteFirst);
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
      this.lastMessageDate = { objectId, playerObjectId, elem: div };
    }
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
    if(message.startsWith(App.settings.data.game.barmanEffect)){
      const symbols = "?!&@#%^~<>*";
      message = Array.from({ length: [...message].length-1 }, () => symbols[Math.random() * symbols.length | 0]).join("");
    }

    App.server.send(PacketDataKeys.PRIVATE_CHAT_MESSAGE_CREATE, {
      [PacketDataKeys.FRIENDSHIP]: this.friendObjectId,
      [PacketDataKeys.MESSAGE]: {
        [PacketDataKeys.TEXT]: message,
        [PacketDataKeys.MESSAGE_STYLE]: 3,
        [PacketDataKeys.MESSAGE_STICKER]: false
      }
    });
  }
}
