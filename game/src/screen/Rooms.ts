import fs from "../../../core/src/fs/fs";
import App from "../App";
import PromptBox from "../dialog/PromptBox";
import PacketDataKeys from "../../../core/src/PacketDataKeys";
import { getBackgroundImg, getRoleImg, getTexture } from "../utils/Resources";
import Dashboard from "./Dashboard";
import GlobalChat from "./GlobalChat";
import Room from "./Room";
import Screen from "./Screen";
import Box from "../dialog/Box";
import MessageBox from "../dialog/MessageBox";
import ContextMenu from "../component/ContextMenu";
import { when } from "../../../core/src/utils/TypeScript";
import LoadingBox from "../dialog/LoadingBox";
import { noXSS, wait } from "../../../core/src/utils/utils";
import RoomCreation from "./RoomCreation";
import md5salt from "../../../core/src/utils/md5";
import format, { formatDate } from "../../../core/src/utils/format";
import ConfirmBox from "../dialog/ConfirmBox";
import { History } from "./History";
import RoomPlayers from "../dialog/RoomPlayers";
import { createElement } from "../../../core/src/utils/DOM";
import { Role } from "../enums";

const defaultFilterOptions = {
  minPl: 5,
  maxPl: 21,
  minLvl: 1,
  maxLvl: 11,
  friends: false,
  vip: false,
  withoutVip: false,
  withPassword: false,
  withoutPassword: false,
  isRegistration: true,
  isStarted: true,
  roles: [2,5,6,7,8,9,10,11],
  noRoles: false
}

export default class Rooms extends Screen {
  div!: HTMLDivElement
  titleElem: HTMLLabelElement

  search = "";

  filterOptions = { ...defaultFilterOptions }

  constructor(){
    super('Rooms');

    App.title = 'Комнаты';

    this.element.style.overflow = 'hidden';
    (async()=> this.element.style.background = `url(${await getBackgroundImg('menu3')}) 0% 0% / cover`)();

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
    this.titleElem = document.createElement('label');
    this.titleElem.textContent = 'Комнаты';
    header.appendChild(this.titleElem);

    this.on('back', () => {
      App.screen = new Dashboard();
    });

    this.init();
  }

  async reconnect() {
    super.reconnect();

    this.rooms = [];
    this.updateRooms();
    App.server.send(PacketDataKeys.ADD_CLIENT_TO_ROOMS_LIST, {
      [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
      [PacketDataKeys.TOKEN]: App.user.token
    });
    const data = await App.server.awaitPacket(PacketDataKeys.ROOMS);
    const rooms = this.getRooms(data[PacketDataKeys.ROOMS]);
    for(const room of rooms) this.addRoom(room);
  }

  async init(){
    const self = this;
    App.server.send(PacketDataKeys.ADD_CLIENT_TO_ROOMS_LIST, {
      [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
      [PacketDataKeys.TOKEN]: App.user.token
    });
    // const loading = LoadingBox();
    const data = await App.server.awaitPacket(PacketDataKeys.ROOMS);
    // loading.done();

    if(!(await fs.existsFile(App.config.path + '/filter.json')))
      await fs.writeFile(App.config.path + '/filter.json', JSON.stringify(defaultFilterOptions));
    try {
      const filter = await fs.readFile(App.config.path + '/filter.json');
      this.filterOptions = JSON.parse(filter);
    } catch {}

    const filterElem = document.createElement('div');
    filterElem.className = 'rooms-filter';
    this.element.appendChild(filterElem);
    {
      const inputSearch = document.createElement('input');
      inputSearch.placeholder = 'Поиск';
      inputSearch.size = 30;
      inputSearch.onchange = inputSearch.onkeyup = () => {
        this.search = inputSearch.value;
        this.updateRooms();
      }
      filterElem.appendChild(inputSearch);

      const updateBtn = document.createElement('button');
      updateBtn.textContent = `Обновить`;
      updateBtn.onclick = async() => {
        this.rooms = [];
        this.updateRooms();
        App.server.send(PacketDataKeys.ADD_CLIENT_TO_ROOMS_LIST, {
          [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
          [PacketDataKeys.TOKEN]: App.user.token
        });
        const data = await App.server.awaitPacket(PacketDataKeys.ROOMS);
        const rooms = this.getRooms(data[PacketDataKeys.ROOMS]);
        for(const room of rooms) this.addRoom(room);
      }
      filterElem.appendChild(updateBtn);

      const filterBtn = document.createElement('button');
      filterBtn.textContent = `Фильтр`;
      filterBtn.onclick = () => {
        const box = new Box({ title: 'ФИЛЬТР', width: 300, height: 350, canCloseAnywhere: true });
        box.content.style.overflowY = 'overlay';
        const e = createElement('div', {
          css: {
            display: 'flex',
            flexDirection: 'column',
            padding: '10px',
            color: 'black'
          },
          appendTo: box.content
        });
        function add<T extends string | number | boolean>(name: string, value: T, onChange?: (value: T) => void){
          const isBool = typeof value == 'boolean';
          const isNum = typeof value == 'number';

          const el = createElement('div', {
            css: {
              display: 'flex',
              flexDirection: isBool ? 'row' : 'column',
              justifyContent: isBool ? 'space-between' : 'flex-start',
              alignItems: isBool ? 'center' : 'stretch',
              marginBottom: '12px',
              gap: '6px'
            },
            appendTo: e
          });

          createElement('span', {
            css: {
              fontSize: '14px',
              color: '#333'
            },
            text: name,
            appendTo: el
          });

          const val = createElement('input', {
            type: isBool ? 'checkbox' : isNum ? 'number' : 'text',
            css: {
              padding: isBool ? '0' : '6px 8px',
              borderRadius: '4px',
              border: isBool ? 'none' : '1px solid #ccc',
              zoom: isBool ? '1.5' : undefined
            },
            appendTo: el
          });

          if(isBool) {
            (val as HTMLInputElement).checked = value as boolean;
          } else {
            val.value = String(value ?? '');
          }

          val.onchange = () => {
            if(!onChange) return;

            if(isBool) {
              onChange((val as HTMLInputElement).checked as T);
            } else if(isNum) {
              const parsed = parseInt(val.value, 10);
              onChange((isNaN(parsed) ? 0 : parsed) as T);
            } else {
              onChange(val.value as T);
            }

            self.updateRooms();
            fs.writeFile(App.config.path + '/filter.json', JSON.stringify(self.filterOptions));
          };
        }
        function addBtn(text: string, onClick?: () => void){
          const btn = createElement('button', {
            text,
            css: {
              width: '100%'
            },
            appendTo: e
          });
          btn.onclick = () => onClick?.();
        }
        function addH(text: string, { fontSize = 16, margin = '10px' } = {}){
          const h = document.createElement('p');
          h.style.textAlign = 'center';
          h.style.fontSize = fontSize + 'px';
          h.style.margin = margin;
          h.innerHTML = text;
          e.appendChild(h);
        }
        function addRole(name: string, key: number, image: Promise<string>){
          const div = createElement('div', {
            css: {
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              gap: '6px'
            },
            appendTo: e
          });
          e.appendChild(div);
          const img = document.createElement('img');
          img.width = 25;
          image.then(e => img.src = e);
          div.appendChild(img);
          const span = document.createElement('span');
          span.style.width = '100%'
          span.style.textAlign = 'left';
          span.textContent = name;
          div.appendChild(span);
          const cb = document.createElement('input');
          cb.style.zoom = '1.5';
          cb.type = 'checkbox';
          cb.checked = self.filterOptions.roles.includes(key);
          cb.onchange = () => {
            self.filterOptions.roles =
              self.filterOptions.roles.includes(key)
                ? self.filterOptions.roles.filter(v => v !== key)
                : [...self.filterOptions.roles, key];
            self.updateRooms();
          }
          div.appendChild(cb);
        }
        addBtn('Сбросить', () => {
          this.filterOptions = { ...defaultFilterOptions };
          fs.writeFile(App.config.path + '/filter.json', JSON.stringify(defaultFilterOptions));
          this.updateRooms();
          box.destroy();
          filterBtn.click();
        });
        add('Мин. игроков', this.filterOptions.minPl, v => this.filterOptions.minPl = v);
        add('Макс. игроков', this.filterOptions.maxPl, v => this.filterOptions.maxPl = v);
        add('Мин. лвл', this.filterOptions.minLvl, v => this.filterOptions.minLvl = v);
        add('Макс. лвл', this.filterOptions.maxLvl, v => this.filterOptions.maxLvl = v);
        add('Есть друзья в комнате', this.filterOptions.friends, v => this.filterOptions.friends = v);
        add('Только VIP комнаты', this.filterOptions.vip, v => this.filterOptions.vip = v);
        add('Без VIP комнат', this.filterOptions.withoutVip, v => this.filterOptions.withoutVip = v);
        add('Комнаты без пароля', this.filterOptions.withoutPassword, v => this.filterOptions.withoutPassword = v);
        add('Комнаты с паролем', this.filterOptions.withPassword, v => this.filterOptions.withPassword = v);
        addH(`Статус комнаты`, { fontSize: 13, margin: '5px' });
        add('Идет регистрация', this.filterOptions.isRegistration, v => this.filterOptions.isRegistration = v);
        add('Игра началась', this.filterOptions.isStarted, v => this.filterOptions.isStarted = v);
        addH(`Команда мафии`, { fontSize: 13, margin: '5px' });
        addRole(`Террорист`, 6, getRoleImg(Role.TERRORIST))
        addRole(`Бармен`, 9, getRoleImg(Role.BARMAN))
        addRole(`Информатор`, 11, getRoleImg(Role.INFORMER))
        addH(`Команда мирных жителей`, { fontSize: 13, margin: '5px' });
        addRole(`Доктор`, 2, getRoleImg(Role.DOCTOR))
        addRole(`Любовница`, 5, getRoleImg(Role.LOVER))
        addRole(`Журналист`, 7, getRoleImg(Role.JOURNALIST))
        addRole(`Телохранитель`, 8, getRoleImg(Role.BODYGUARD))
        addRole(`Шпион`, 10, getRoleImg(Role.SPY));
        add('Только комнаты без этих ролей', this.filterOptions.noRoles, v => this.filterOptions.noRoles = v);
      }
      filterElem.appendChild(filterBtn);

      const sortBtn = document.createElement('button');
      sortBtn.textContent = `Сортировка`;
      sortBtn.onclick = () => {
        MessageBox('Скоро..');
        // const box = new Box({ title: 'СОРТИРОВКА', width: 150, height: 150, canCloseAnywhere: true });
      }
      filterElem.appendChild(sortBtn);

      this.on('keydown', e => {
        if(e.ctrlKey && e.key == 'f'){
          inputSearch.focus();
          e.preventDefault();
        }
      });
    }

    this.div = document.createElement('div');
    this.div.style.textAlign = 'center';
    this.div.style.overflowY = 'overlay';
    this.div.style.height = (App.height - (95 + filterElem.clientHeight)) + 'px';
    this.element.appendChild(this.div);

    const rooms = this.getRooms(data[PacketDataKeys.ROOMS]);
    for(const room of rooms) this.addRoom(room);

    const divBtns = document.createElement('div');
    divBtns.style.textAlign = 'center';
    divBtns.style.margin = '3px'
    this.element.appendChild(divBtns);

    const btnCreateRoom = document.createElement('button');
    btnCreateRoom.textContent = 'Создать комнату';
    btnCreateRoom.style.width = '99%';
    btnCreateRoom.onclick = () => App.screen = new RoomCreation();
    divBtns.appendChild(btnCreateRoom);

    this.on('message', data => {
      if(data[PacketDataKeys.TYPE] == PacketDataKeys.ROOM_IN_LOBBY_STATE){
        // this.rooms[data[PacketDataKeys.ROOM_IN_LOBBY_STATE][PacketDataKeys.ROOM_OBJECT_ID]].rils(data[PacketDataKeys.ROOM_IN_LOBBY_STATE]);
        // this.rooms[data[PacketDataKeys.ROOM_IN_LOBBY_STATE][PacketDataKeys.ROOM_OBJECT_ID]].room[PacketDataKeys.PLAYERS_NUM] = data[PacketDataKeys.ROOM_IN_LOBBY_STATE][PacketDataKeys.PLAYERS_IN_ROOM];
        // this.updateRooms();

        // this.getRoomByObjectId(data[PacketDataKeys.ROOM_IN_LOBBY_STATE][PacketDataKeys.ROOM_OBJECT_ID])!.room[PacketDataKeys.PLAYERS_NUM] = data[PacketDataKeys.ROOM_IN_LOBBY_STATE][PacketDataKeys.PLAYERS_IN_ROOM];
        // this.updateRooms();

        const room = this.getRoomByObjectId(data[PacketDataKeys.ROOM_IN_LOBBY_STATE][PacketDataKeys.ROOM_OBJECT_ID])
        if(room)
          room.rils(data[PacketDataKeys.ROOM_IN_LOBBY_STATE]);
        this.updateRooms();
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.GAME_STATUS_IN_ROOMS_LIST){
        // this.rooms[data[PacketDataKeys.ROOM_OBJECT_ID]].room.status = data[PacketDataKeys.STATUS];
        // this.updateRooms();

        const room = this.getRoomByObjectId(data[PacketDataKeys.ROOM_OBJECT_ID]);
        if(room)
          room.room.status = data[PacketDataKeys.STATUS];
        this.updateRooms();
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.ADD){
        this.addRoom(data[PacketDataKeys.ROOM], true);
        // this.updateRooms();
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.REMOVE){
        const room = this.getRoomByObjectId(data[PacketDataKeys.ROOM_OBJECT_ID]);
        const id = this.getRoomIdByObjectId(data[PacketDataKeys.ROOM_OBJECT_ID]);
        this.rooms.splice(id, 1);
        // this.rooms[data[PacketDataKeys.ROOM_OBJECT_ID]].remove();
        // delete this.rooms[data[PacketDataKeys.ROOM_OBJECT_ID]];
        if(room && room.elem) {
          room.elem.style.animation = 'deleteRoom 1s ease-out forwards';
          setTimeout(() => room.remove(), 1250);
        } else {
          this.updateRooms();
        }
      }
    });

    this.on('resize', e => {
      this.div.style.height = (App.height - (85 + filterElem.clientHeight + 5)) + 'px';
    });
  }

  // <ROOM_OBJECT_ID, data>
  rooms: ({ id: number, room: any, elem?: HTMLDivElement, rils: (data: any) => void, remove: () => void })[] = []
  roomsId = 0

  getRoomByObjectId(objectId: string){
    return this.rooms.find(e => e.room[PacketDataKeys.OBJECT_ID] == objectId);
  }
  getRoomIdByObjectId(objectId: string){
    return this.rooms.findIndex(e => e.room[PacketDataKeys.OBJECT_ID] == objectId);
  }

  getRooms(data: any){
    const rooms = (data as any[]).sort((a, b) => {
      // 1. ROOM_STATUS
      const roomStatusDiff = a[PacketDataKeys.ROOM_STATUS] - b[PacketDataKeys.ROOM_STATUS];
      if(roomStatusDiff !== 0) return roomStatusDiff;

      // 2. STATUS
      const statusDiff = a[PacketDataKeys.STATUS] - b[PacketDataKeys.STATUS];
      if(statusDiff !== 0) return statusDiff;

      // 3. MIN_LEVEL
      return a[PacketDataKeys.MIN_LEVEL] - b[PacketDataKeys.MIN_LEVEL];
    })

    const title = `Комнаты: (${(data as any[]).length}/${rooms.length})`
    this.titleElem.textContent = noXSS(title);
    App.title = title;

    return rooms;
  }

  updateRooms(){
    this.div.innerHTML = '';
    let roomsData = [];
    // for(let i in this.rooms){
    //     const room = this.rooms[i];
    //     roomsData.unshift(room.room);
    //     // roomsData.push(room.room);
    //     // room.remove();
    //     // delete this.rooms[i];
    // }
    // for(let i in this.rooms) delete this.rooms[i];

    for(let room of this.rooms)
      roomsData.push(room.room);

    const rooms = this.getRooms(roomsData);

    // this.rooms = {};
    this.rooms = [];
    for(const room of rooms) {
      this.addRoom(Object.assign({}, room));
    }
  }

  filter(room: any): boolean {
    if(!room) return false;

    const searchStr = this.search.trim().toLowerCase();
    if(searchStr !== '') {
      const title = (room[PacketDataKeys.TITLE] as string || '').toLowerCase();
      if(!title.includes(searchStr)) return false;
    }

    const status = room[PacketDataKeys.STATUS];
    if(status == 0 && !this.filterOptions.isRegistration) return false;
    if(status == 3 && !this.filterOptions.isStarted) return false;

    const roomLvl = room[PacketDataKeys.MIN_LEVEL];
    if(roomLvl < this.filterOptions.minLvl || roomLvl > this.filterOptions.maxLvl) return false;

    if(room[PacketDataKeys.MIN_PLAYERS] < this.filterOptions.minPl) return false;
    if(room[PacketDataKeys.MAX_PLAYERS] > this.filterOptions.maxPl) return false;

    if(!room[PacketDataKeys.VIP] && this.filterOptions.vip) return false;
    if(room[PacketDataKeys.VIP] && this.filterOptions.withoutVip) return false;

    if(!room[PacketDataKeys.PASSWORD] && this.filterOptions.withPassword) return false;
    if(room[PacketDataKeys.PASSWORD] && this.filterOptions.withoutPassword) return false;

    if(!room[PacketDataKeys.FRIEND_IN_ROOM] && this.filterOptions.friends) return false;

    const roomRoles: number[] = room[PacketDataKeys.SELECTED_ROLES] || [];
    const hasMatch = roomRoles.some(role => this.filterOptions.roles.includes(role));

    if(this.filterOptions.noRoles) {
      if(hasMatch) return false;
    } else {
      if(!hasMatch) return false;
    }

    return true;
  }

  static orderRoles = [2, 7, 10, 11, 9, 5, 6, 8];
  static getRoomElement(room: any): {
    elem: HTMLDivElement
    onJoin: (callback: Function) => void
    onViewRoomPlayers: (callback: Function) => void
  } {
    const isHistory = typeof room.isHistory == 'boolean' && room.isHistory;
    const isProfileInfo = typeof room[PacketDataKeys.SAME_ROOM] == 'boolean';
    const objectId = room[PacketDataKeys.OBJECT_ID];
    const level = room[PacketDataKeys.MIN_LEVEL];
    const myStatus = typeof room.status == 'number' ? room.status : isProfileInfo ? 2 : room[PacketDataKeys.ROOM_STATUS];
    const statusText = room.statusText;
    const rank = level == 3 ? 2 : level == 5 ? 3 : level == 7 ? 4 : level == 9 ? 5 : level == 11 ? 6 : 1;
    const selectedRoles = room[PacketDataKeys.SELECTED_ROLES] ?? [];
    const hasPassword = room[PacketDataKeys.PASSWORD];
    const friends = room[PacketDataKeys.FRIEND_IN_ROOM];

    let clickType = '';
    let joinCallback: Function = () => {}
    let viewRoomPlayersCallback: Function = () => {}

    async function join() {
      await new Promise(res => setTimeout(res, 0));
      if(clickType) {
        viewRoomPlayersCallback();
        RoomPlayers(objectId);
        clickType = '';
        return;
      }
      joinCallback();
      if(hasPassword) {
        let password = await PromptBox(`Эта комната под замком\n\nПожалуйста введите пароль`, { btnText: `Применить`, placeholder: `Пароль`, title: 'ВВЕСТИ ПАРОЛЬ', height: 200, canCloseAnywhere: true });
        if(password == '') return;

        App.server.send(PacketDataKeys.ROOM_ENTER, {
          [PacketDataKeys.ROOM_PASS]: md5salt(password),
          [PacketDataKeys.ROOM_OBJECT_ID]: objectId
        });
        const rData = await App.server.awaitPacket([PacketDataKeys.ROOM_ENTER, PacketDataKeys.ROOM_PASSWORD_IS_WRONG_ERROR, PacketDataKeys.GAME_STARTED, PacketDataKeys.USER_IN_ANOTHER_ROOM, PacketDataKeys.USER_USING_DOUBLE_ACCOUNT, PacketDataKeys.USER_LEVEL_NOT_ENOUGH, PacketDataKeys.USER_KICKED]);
        if(rData[PacketDataKeys.TYPE] == PacketDataKeys.ROOM_PASSWORD_IS_WRONG_ERROR){
          await MessageBox('Неправильный пароль!');
          join();
          return;
        }
        App.screen = new Room(objectId, { password, sendRoomEnter: true });
        return;
      }
      if(isHistory) {
        App.screen = new Room(objectId, { isHistory, data: room.data });
      } else {
        App.screen = new Room(objectId);
      }
    }

    const div = document.createElement('div');
    div.className = 'room';
    const levelImg = document.createElement('img');
    levelImg.className = 'room-lvl'
    const title = document.createElement('div');
    title.className = 'room-title'
    const status = document.createElement('div');
    status.className = 'room-status'
    const btnPlayers = document.createElement('div');
    btnPlayers.className = 'room-btn-players'
    if(myStatus == 0){
      const text = document.createElement('div');
      text.className = 'black';
      text.style.textAlign = 'center';
      text.style.padding = '5px';
      text.textContent = statusText ?? `Вы играете в этой комнате`;
      div.appendChild(text);
    } else if(myStatus == 1){
      const text = document.createElement('div');
      text.className = 'black';
      text.style.textAlign = 'center';
      text.style.padding = '5px';
      text.textContent = statusText ?? `Вас убили в этой комнате`;
      div.appendChild(text);
    }
    div.style.background = myStatus == 0 ? 'rgb(137 242 165 / 40%)' : myStatus == 1 ? 'rgb(255 138 146 / 40%)' : 'rgba(200,200,200,.4)';
    if(selectedRoles.length == 0) div.style.height = myStatus < 2 ? '110px' : '80px';
    div.onmouseenter = () => myStatus == 0 ? 'rgb(114 202 137 / 40%)' : myStatus == 1 ? 'rgb(219 103 111 / 40%)' : div.style.background = 'rgba(200,200,200,.3)';
    div.onmouseleave = () => myStatus == 0 ? 'rgb(137 242 165 / 40%)' : myStatus == 1 ? 'rgb(255 138 146 / 40%)' : div.style.background = 'rgba(200,200,200,.4)';
    div.onclick = () => join();
    if(!isProfileInfo) div.oncontextmenu = async(e)=>{
      e.preventDefault();
      const joinPl = `Зайти, когда ${room[PacketDataKeys.MAX_PLAYERS]-1} игроков будет`;
      const cx = new ContextMenu(isHistory ? ['Посмотреть', 'Удалить'] : ['Зайти',joinPl,'Скопировать object id'], e);
      const result = await cx.waitForResult();
      when(result)
        .case(joinPl, async() => {
          const loading = LoadingBox({ title: 'ЖДЁМ', text: `Кол-во игроков в комнате: ${room[PacketDataKeys.PLAYERS_NUM]}`, canCloseAnywhere: true });
          const maxPl = room[PacketDataKeys.MAX_PLAYERS];
          App.server.on('message', async data => {
            if(data[PacketDataKeys.TYPE] == PacketDataKeys.ROOM_IN_LOBBY_STATE) {
              const oid = data[PacketDataKeys.ROOM_IN_LOBBY_STATE][PacketDataKeys.ROOM_OBJECT_ID];
              const numPl = data[PacketDataKeys.ROOM_IN_LOBBY_STATE][PacketDataKeys.PLAYERS_IN_ROOM];
              if(objectId == oid){
                loading.changeText(`Кол-во игроков в комнате: ${numPl}`);
                if(maxPl - numPl == 1){
                  await wait(50);
                  loading.done();
                  join();
                }
              }
            } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.GAME_STATUS_IN_ROOMS_LIST){
              const oid = data[PacketDataKeys.ROOM_IN_LOBBY_STATE][PacketDataKeys.ROOM_OBJECT_ID];
              if(objectId == oid){
                const status = data[PacketDataKeys.STATUS];
                if(status == 2){
                  loading.done();
                  MessageBox(`Игра началась`);
                }
              }
            }
          }).key('waitingRils');
          loading.box.on('destroy', () => App.server.removeByKey('waitingRils'));
        })
        .case('Посмотреть', () => join())
        .case('Зайти', () => join())
        .case('Удалить', async () => {
          if(!isHistory) return;
          if(!(await ConfirmBox(`Вы уверены что хотите удалить?`))) return;
          if(!(await fs.existsFile(`${App.config.path}/history.json`)))
            await fs.writeFile(`${App.config.path}/history.json`, JSON.stringify({ rooms: [] }));
          const history = JSON.parse(await fs.readFile(`${App.config.path}/history.json`));

          history.rooms.splice(Number(objectId), 1);

          await fs.writeFile(`${App.config.path}/history.json`, JSON.stringify(history));
          App.screen = new History();
        })
        .case(`Скопировать object id`, () => {

        });
    };
    getTexture(`rank/rank${rank}_36.png`).then(e => levelImg.src = e);
    title.textContent = `${room[PacketDataKeys.PASSWORD] ? '🔒 ' : ''}` + room[PacketDataKeys.TITLE];// + ` (${room[PacketDataKeys.MIN_LEVEL]})`;
    status.textContent = isHistory ? formatDate(room['created']) : room[PacketDataKeys.STATUS] == 0 ? `Регистрация` : room[PacketDataKeys.STATUS] == 3 ? `Игра началась` : 'Подготовка';
    status.style.color = isHistory ? 'black' : room[PacketDataKeys.STATUS] == 0 ? `green` : `red`
    title.prepend(levelImg);
    title.appendChild(status);
    div.appendChild(title);
    const arr = selectedRoles.slice().sort((a: number, b: number) => this.orderRoles.indexOf(a) - this.orderRoles.indexOf(b));
    for(const role of arr){
      const img = document.createElement('img');
      getRoleImg(role).then(e => img.src = e);
      img.width = 25;
      img.height = 35;
      img.style.margin = '1px';
      img.onmousedown = e => e.preventDefault();
      div.appendChild(img);
    }
    if(friends > 0) {
      const img = createElement('img', { width: 20, height: 20, css: { verticalAlign: 'text-bottom' } });
      getTexture(`ui/4v.png`).then(e => img.src = e);
      btnPlayers.appendChild(img);
    }
    createElement('span', { css: { marginLeft: '2px' }, text: typeof room[PacketDataKeys.MIN_PLAYERS] == 'number' ? `Игроки: ${room[PacketDataKeys.PLAYERS_NUM]} [${room[PacketDataKeys.MIN_PLAYERS]}/${room[PacketDataKeys.MAX_PLAYERS]}] ⭣` : `Игроки: [${room[PacketDataKeys.PLAYERS_NUM]}]`, appendTo: btnPlayers });
    btnPlayers.onclick = () => clickType = 'btnPlayers';
    div.appendChild(btnPlayers);

    return {
      elem: div,
      onJoin: (c) => joinCallback = c,
      onViewRoomPlayers: (c) => viewRoomPlayersCallback = c,
    };
  }

  addRoom(room: any, animation = false){
    const self = this;
    const objectId = room[PacketDataKeys.OBJECT_ID];
    if(!this.filter(room)) {
      const roomObj = this.getRoomByObjectId(objectId);
      if(roomObj)
        this.rooms.splice(this.getRoomIdByObjectId(objectId), 1);
      this.rooms.push(Object.assign({}, {
        room,
        id: this.roomsId,
        elem: roomObj?.elem,
        rils(){},
        remove(){}
      }));
      return;
    }
    const roomElem = Rooms.getRoomElement(room);
    if(animation) {
      roomElem.elem.style.animation = 'newRoom 1s ease-out forwards';
    }
    this.div.appendChild(roomElem.elem);

    // if(this.rooms[room[PacketDataKeys.OBJECT_ID]]) delete this.rooms[room[PacketDataKeys.OBJECT_ID]];
    // this.rooms[room[PacketDataKeys.OBJECT_ID]] = Object.assign({}, {

    if(this.getRoomByObjectId(objectId))
      this.rooms.splice(this.getRoomIdByObjectId(objectId), 1);

    this.rooms.push(Object.assign({}, {
      room,
      id: this.roomsId,
      elem: roomElem.elem,
      rils(data: any){
        const playersInRoom = data[PacketDataKeys.PLAYERS_IN_ROOM];
        const min = room[PacketDataKeys.MIN_PLAYERS];
        const max = room[PacketDataKeys.MAX_PLAYERS];
      },
      remove(){
        // if(self.rooms[this.room[PacketDataKeys.OBJECT_ID]].id != this.id) return;
        self.div.removeChild(roomElem.elem);
      }
    }));
    this.roomsId++;
  }
}
