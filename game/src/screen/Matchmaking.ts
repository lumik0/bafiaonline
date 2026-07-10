import App from "../App";
import Screen from "./Screen";
import { wrap } from "../../../core/src/utils/TypeScript";
import fs from "../../../core/src/fs/fs";
import { getBackgroundImg, getImage, getRoleImg, getTexture } from "../utils/Resources";
import { createElement } from "../../../core/src/utils/DOM";
import Dashboard from "./Dashboard";
import PacketDataKeys from "../../../core/src/PacketDataKeys";
import MessageBox from "../dialog/MessageBox";
import { Role, RuRoles } from "../enums";
import Room from "./Room";
import format from "../../../core/src/utils/format";

export default class Matchmaking extends Screen {
  online = 0;

  el!: HTMLDivElement

  constructor(){
    super('Matchmaking');

    App.title = 'Соревновательный';

    (async() => this.element.style.background = `url(${await getBackgroundImg('menu3')}) 0% 0% / cover`)();

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
    const titleElem = document.createElement('label');
    titleElem.textContent = 'Соревновательный';
    header.appendChild(titleElem);

    this.on('back', () => {
      App.screen = new Dashboard();
    });

    this.init();
  }

  async init(){
    App.server.send("mmgsk", {
      [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
      [PacketDataKeys.TOKEN]: App.user.token
    });

    App.server.send('mmguiabk', { mmbpa: 12 });
    App.server.awaitPacket("mmuiabk").then(e => this.online = e.mmuiabk);
    const data = await App.server.awaitPacket(["mmms", 'mmrr', 'mmag']);
    if(data.ty == 'mmrr') {
      App.screen = new Room(data.rr.o, {
        isMM: true,
        sendRoomEnter: false,
        dontWaitForAnswer: true,
        selectedRoles: data.rr.sr
      });
      return;
    }
    if(data.ty == 'mmsr') {
      this.selectRole(data.mmlt, data.mmcusr);
      return;
    }
    this.search(data);
  }

  async search(data: any){
    this.removeInterval('selection');
    this.removeInterval('search');
    this.removeByKey('search');
    let isSearching = false, isAccepting = false, timer = 0, roomMM = false;
    this.el = createElement('div', {
      css: {
        display: 'flex',
        flexDirection: 'column',
        padding: '20px'
      },
      appendTo: this.element
    });
    const info = createElement('div', {
      text: 'Сейчас играют: ' + this.online,
      css: {
        margin: '5px'
      },
      appendTo: this.el
    })
    const btn = createElement('button', { text: 'Начать поиск', appendTo: this.el });
    const btn2 = createElement('button', { text: 'Вернуться в игру', appendTo: this.el, hide: true });

    if(data.ty == 'mmag'){
      timer = data.mmlt;
      isAccepting = true;
      btn.innerHTML = `Принять (${timer})`;
      info.innerText = `Приняли: ${data.mmagua}`;
    }

    this.setInterval('search', () => {
      if(!isAccepting) return;
      try {
        timer--;
        btn.innerHTML = `Принять (${timer})`;
      }catch{}
    }, 1000);

    if(data.mmms) {
      if(data.mmms.mmuir){
        btn2.style.display = 'block';
        btn2.onclick = () => {
          App.server.send('mmrtr', {})
        }
        roomMM = true;
      }
    }

    btn.onclick = async() => {
      if(isAccepting) {
        App.server.send('mmag', {});
        btn.disabled = true;
        return;
      }
      if(isSearching) {
        App.server.send('mmruk', {});
        App.server.send('mmguiabk', { mmbpa: 12 });
        btn.innerHTML = 'Начать поиск';
        info.innerText = 'Сейчас играют: ' + this.online;
        if(roomMM)
          btn2.style.display = 'block';
      } else {
        App.server.send('mmauk', { mmbpa: 12 });

        btn.innerHTML = 'Отменить поиск';
        info.innerText = 'В поиске..';
        btn2.style.display = 'none';
      }
      isSearching = !isSearching;
    }

    this.on('message', d => {
      if(d[PacketDataKeys.TYPE] == 'mmfun'){
        info.innerText = 'Найдено игроков (' + d.mmfun + '/12)';
      } else if(d[PacketDataKeys.TYPE] == 'mmuiabk') {
        this.online = d.mmuiabk;
        if(!isSearching) info.innerText = 'Сейчас играют: ' + this.online;
      } else if(d[PacketDataKeys.TYPE] == 'mmag'){
        isAccepting = true;
        btn.innerHTML = 'Принять';
        info.innerText = 'Приняли: 0';
      } else if(d[PacketDataKeys.TYPE] == 'mmagu'){
        info.innerText = 'Приняли: ' + d.mmagua;
      } else if(d[PacketDataKeys.TYPE] == 'mmsr') {
        this.selectRole(d.mmlt, d.mmcusr);
      } else if(d[PacketDataKeys.TYPE] == 'mmib') {
        const type = d.mmbt;
        const timeout = d.mmbut;
        const reason = type == 1 ? `Вы не присоединились к предыдущей игре` : `тип причины: ${type}`;

        isSearching = false;
        btn.innerHTML = 'Начать поиск';
        info.innerText = 'Сейчас играют: ' + this.online;
        MessageBox(`Поиск игр временно заблокирован.\n\n${reason}\n\nОставшееся время блокировки:\n${format(timeout, 'genitive')}`, { height: 250 });
      } else if(d[PacketDataKeys.TYPE] == 'mmrr') {
        const room = {
          objectId: d[PacketDataKeys.OBJECT_ID]
        }

        App.server.send('mmruk', {});
        App.screen = new Room(room.objectId, {
          isMM: true,
          sendRoomEnter: false,
          dontWaitForAnswer: true
        });
      }
    }).key('search');
  }

  async selectRole(timer = 30, roles: Role[] = []) {
    const self = this;
    this.removeInterval('search');
    this.removeInterval('selection');
    this.removeByKey('search');

    try {this.el.remove();
    }catch{}
    this.el = createElement('div', {
      css: {
        display: 'flex',
        flexDirection: 'column',
        padding: '20px'
      },
      appendTo: this.element
    });
    const info = createElement('div', {
      text: '' + timer,
      css: {
        margin: '5px'
      },
      appendTo: this.el
    })

    const eroles: Record<string, {
      element: HTMLDivElement,
      right: HTMLSpanElement
      many: number
    }> = {}
    function addRole(role: Role){
      const e = createElement('div', {
        css: {
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: '5px',
          margin: '3px',
          borderRadius: '5px',
          background: 'linear-gradient(90deg, transparent, #81be81)',
        },
        appendTo: self.el
      });
      const img = createElement('img', {
        width: 30,
        appendTo: e
      });
      const inp = createElement('input', {
        type: 'checkbox',
        css: {
          zoom: 2
        },
        checked: true,
        appendTo: e
      });
      const span = createElement('span', {
        text: RuRoles[role - 1],
        css: {
          marginLeft: '5px'
        },
        appendTo: e
      });
      const right = createElement('span', {
        text: '12 / 12',
        css: {
          marginLeft: '5px',
          marginRight: '0 auto'
        },
        appendTo: e
      });
      inp.onchange = () => {
        if(inp.checked) {
          App.server.send('mmsr', { r: role });
        } else {
          App.server.send('mmusr', { r: role });
        }
      }
      getRoleImg(role).then(e => img.src = e);
      eroles[role + ''] = { element: e, right, many: 12 };
    }
    // for(let i of roles) addRole(i);
    addRole(Role.TERRORIST);
    addRole(Role.BARMAN);
    addRole(Role.INFORMER);
    addRole(Role.DOCTOR);
    addRole(Role.LOVER);
    addRole(Role.JOURNALIST);
    addRole(Role.BODYGUARD);
    addRole(Role.SPY);

    this.setInterval('selection', () => {
      try {
        timer--;
        info.innerHTML = '' + timer;
      }catch{}
    }, 1000);

    this.on('message', d => {
      if(d[PacketDataKeys.TYPE] == 'mmrc'){
        for(let r in d.mmrc) {
          const i = d.mmrc[r];
          const e = eroles[r];
          if(e) {
            e.many = i;
            if(e.many > 5) {
              e.element.style.background = 'linear-gradient(90deg, transparent, #81be81)';
            } else {
              e.element.style.background = 'linear-gradient(90deg, transparent, #c05656)';
            }

            e.right.innerHTML = `${i} / 12`;
          }
        }
      } else if(d[PacketDataKeys.TYPE] == 'mmrr') {
        const room = {
          objectId: d[PacketDataKeys.OBJECT_ID]
        }

        App.server.send('mmruk', {});
        App.screen = new Room(room.objectId, {
          isMM: true,
          sendRoomEnter: false,
          dontWaitForAnswer: true
        });
      }
    });
  }
}