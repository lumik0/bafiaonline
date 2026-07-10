import App from "../App";
import { MessageStyle } from "../enums";
import PacketDataKeys from "../../../core/src/PacketDataKeys";
import Dashboard from "./Dashboard";
import Screen from "./Screen";
import { createElement, insertAtCaret, processEmojis } from '../../../core/src/utils/DOM'
import ProfileInfo from "../dialog/ProfileInfo";
import fs from "../../../core/src/fs/fs";
import { getAvatarImg, getBackgroundImg, getTexture } from "../utils/Resources";
import { getZoom, noXSS, wait } from "../../../core/src/utils/utils";
import { isMobile } from "../../../core/src/utils/mobile";
import users from '../../../core/users.json'
import CommandManager from "../command/CommandManager";

export default class GlobalChat extends Screen {
  // хз как назвать
  listPlayersFromInput!: HTMLDivElement
  showListPlayersFromInput = false

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
    back.onclick = () => this.emit('back');
    header.appendChild(back);
    const backImg = document.createElement('img');
    backImg.width = 24;
    getTexture(`ui/Jb.png`).then(e => backImg.src = e);
    back.appendChild(backImg);
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

    this.listPlayersFromInput = createElement('div', {
      css: {
        position: 'absolute',
        background: 'rgba(255,255,255,.5)'
      }
    });
    this.element.appendChild(this.listPlayersFromInput);

    this.playersListElem = createElement('div', {
      css: {
        height: '155px',
        overflow: 'overlay',
        margin: '10px',
        outline: '2px solid #c0c0c0',
        borderRadius: '3px',
        background: 'rgba(255,255,255,.5)',
        display: 'flex',
        flexWrap: 'wrap',
        flexDirection: 'column'
      },
      appendTo: this.element
    });

    this.messagesElem = createElement('div', {
      css: {
        height: (App.height - (isMobile() ? 270 : 250)) + 'px',
        textAlign: 'center',
        overflowX: 'hidden',
        overflowY: 'overlay',
        margin: '10px 10px 5px 10px',
        outline: '2px solid #c0c0c0',
        borderRadius: '3px',
        background: 'rgba(255,255,255,.5)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start'
      },
      appendTo: this.element
    });

    const data = await App.server.awaitPacket(PacketDataKeys.MESSAGES);
    for(const m of data[PacketDataKeys.MESSAGES]) this.addMessage(m, false);

    this.messagesElem.scrollTop = this.messagesElem.scrollHeight;

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

    this.input = document.createElement('input');
    this.input.className = 'input-chat'
    this.input.type = `text`;
    this.input.placeholder = `Сообщение`;
    this.input.onkeydown = e => {
      if(e.key == 'Enter' && this.input.value != ''){
        const msg = this.input.value;
        this.input.value = '';
        this.sendMessage(msg);
      }
    }
    this.input.oninput = () => {
      const winZoom = App.zoom;
      const zoom = getZoom();
      const e = this.input.value.substring((this.input.selectionStart ?? 1)-1);
      if(e == '@'){
        this.showListPlayersFromInput = true;
        this.listPlayersFromInput.style.display = 'block';
        // надо там где курсор
        
        this.listPlayersFromInput.style.left = ((this.input.offsetLeft + this.input.offsetWidth - 10) / winZoom / zoom) + 'px';
        this.listPlayersFromInput.style.top = ((this.input.offsetTop + 20) / winZoom / zoom) + 'px';
      } else if(e == ' ') {
        this.showListPlayersFromInput = false;
        this.listPlayersFromInput.style.display = 'none';
      }
    }

    const emojiPanel = createElement('div', {
      css: {
        display: 'none'
      },
      appendTo: footer
    });
    for(const e of ['sm1','sm2','sm3','sm4','sm5','sm6']) {
      const img = createElement('img', {
        width: 50, height: 50,
        css: {},
        appendTo: emojiPanel
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
      emojiPanel.style.display = emojiPanel.style.display == 'none' ? 'block' : 'none';
      if(emojiPanel.style.display == 'block') {
        this.messagesElem.style.height = (App.height - (isMobile() ? 270 : 250)-60) + 'px';
      } else {
        this.messagesElem.style.height = (App.height - (isMobile() ? 270 : 250)) + 'px';
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
      if(data[PacketDataKeys.TYPE] == PacketDataKeys.MESSAGE){
        this.addMessage(data[PacketDataKeys.MESSAGE]);
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.USERS){
        this.updateUsers(data[PacketDataKeys.USERS]);
      }
    });

    this.on('resize', () => {
      this.messagesElem.style.height = (App.height - (isMobile() ? 270 : 250)) + 'px';
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
    const objectId = user ? user[PacketDataKeys.OBJECT_ID] : '';
    const playerObjectId = user ? user[PacketDataKeys.PLAYER_OBJECT_ID] : '';
    const username = user?.[PacketDataKeys.USERNAME] ?? '';

    if(user ? type != 2 && type != 3 : user){
      if(this.lastMessage && this.lastMessage.divM && this.lastMessage.user[PacketDataKeys.USERNAME] == user[PacketDataKeys.USERNAME]) {
        const msg = document.createElement('span');
        // @ts-ignore
        let cleanText = (users[objectId] == 'dev') ? text : noXSS(text);
        if(text.includes(`[${App.user.username}]`))
          cleanText = cleanText.replaceAll(`${App.user.username}`, `<span style="${App.settings.data.hideUsername ? 'filter: blur(5px)' : 'color: #ab1457; font-weight: bold'}">${App.user.username}</span>`);
        processEmojis(msg, cleanText);
        msg.className = 'black';
        msg.style.userSelect = 'text';
        this.lastMessage.divM.appendChild(msg);
      } else {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.textAlign = 'left';
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
        if(username == App.user.username && App.settings.data.hideUsername) nick.style.filter = 'blur(5px)';
        nick.className = 'black';
        nick.onclick = () => this.addNickToInput(username);
        const msg = document.createElement('span');
        // @ts-ignore
        let cleanText = (users[objectId] == 'dev') ? text : noXSS(text);
        if(text.includes(`[${App.user.username}]`))
          cleanText = cleanText.replaceAll(`${App.user.username}`, `<span style="${App.settings.data.hideUsername ? 'filter: blur(5px)' : 'color: #ab1457; font-weight: bold'}">${App.user.username}</span>`);
        processEmojis(msg, cleanText);
        msg.style.color = type == 9 ? '#186400' : type == 11 ? 'gray' : type == 17 ? '#113B81' : type == 27 ? '#940000' : 'black';
        msg.style.userSelect = 'text';
        div.appendChild(avatar);
        div.appendChild(divM);
        divM.appendChild(nick);
        divM.appendChild(msg);
        this.messagesElem.appendChild(div);
        this.lastMessage = { user, divM }
      }
    } else {
      const div = document.createElement('div');
      const nickElement = `<span style="${text == App.user.username && App.settings.data.hideUsername ? 'filter: blur(5px)' : ''}">${username}</span>`;
      if(type == 2 || type == 3) div.innerHTML = type == 2 ? `Игрок ${nickElement} вошёл` : `Игрок ${nickElement} вышел`;
      else div.textContent = noXSS(text);
      div.style.color = type == 2 ? '#22640A' : type == 3 ? '#940000' : 'black';
      div.style.userSelect = 'text';
      div.style.margin = '3px'
      this.messagesElem.appendChild(div);
      this.lastMessage = { user: undefined, divM: undefined };

      if(type == 2 || type == 3){
        if(this.joinLeaveMessages[username])
          this.messagesElem.removeChild(this.joinLeaveMessages[username]);
        this.joinLeaveMessages[username] = div;
      }
    }

    if(this.messagesElem.scrollHeight - App.height - this.messagesElem.scrollTop < 75)
      this.messagesElem.scroll({ top: this.messagesElem.scrollHeight, behavior: 'smooth' });

    if(deleteFirst && this.messagesElem.firstElementChild)
      this.messagesElem.removeChild(this.messagesElem.firstElementChild);
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
    
    if(CommandManager.executeCommand(message)) return;

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
      const username = user[PacketDataKeys.USERNAME];
      const playerUser = user[PacketDataKeys.PLAYER_USER];
      const playerObjectId = user[PacketDataKeys.PLAYER_OBJECT_ID];
      const div = document.createElement('div');
      div.style.display = 'flex';
      div.style.textAlign = 'left';
      div.style.alignItems = 'center';
      const avatar = document.createElement('img');
      getAvatarImg(user).then(e => avatar.src = e);
      avatar.style.borderRadius = '100%'
      avatar.width = avatar.height = 25;
      avatar.style.margin = '5px';
      avatar.onmousedown = e => e.preventDefault();
      avatar.onclick = () => ProfileInfo(playerObjectId);
      const nick = document.createElement('span');
      // if(user[PacketDataKeys.VIP]) {
      //   const img = createElement('img', { width: 20, height: 20, css: { verticalAlign: 'text-bottom' } });
      //   getTexture(`vip/0M.png`).then(e => img.src = e);
      //   nick.appendChild(img);
      // }
      createElement('span', { css: { marginLeft: '2px' }, text: user[PacketDataKeys.VIP] ? username + ` ${user[PacketDataKeys.VIP]}` : username, appendTo: nick });
      if(username == App.user.username && App.settings.data.hideUsername) nick.style.filter = 'blur(5px)';
      nick.className = 'black';
      nick.onclick = () => this.addNickToInput(username);
      div.appendChild(avatar);
      div.appendChild(nick);
      this.playersListElem.appendChild(div);
    }
  }
}
