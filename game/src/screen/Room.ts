// не читайте код пж, иначе глаза выпадут
// хочу переписать но хз когда

import App from "../App";
import { MessageStyle, Role, RuRoles } from "../enums";
import PacketDataKeys from "../../../core/src/PacketDataKeys";
import Screen from "./Screen";
import { createElement, insertAtCaret, processEmojis } from '../../../core/src/utils/DOM'
import Rooms from "./Rooms";
import MessageBox from "../dialog/MessageBox";
import { when } from "../../../core/src/utils/TypeScript";
import ProfileInfo from "../dialog/ProfileInfo";
import { getAvatarImg, getBackgroundImg, getRoleImg, getTexture } from "../utils/Resources";
import fs from "../../../core/src/fs/fs";
import { getZoom, noXSS, wait } from "../../../core/src/utils/utils";
import LoadingBox from "../dialog/LoadingBox";
import { isMobile } from "../../../core/src/utils/mobile";
import md5salt from "../../../core/src/utils/md5";
import ContextMenu from "../component/ContextMenu";
import users from '../../../core/users.json';
import { History } from "./History";
import CommandManager from "../command/CommandManager";
import Dashboard from "./Dashboard";
import { Logger } from "../../../core/src/logger";

export function isMafia(role: Role): boolean {
  return [Role.MAFIA, Role.BARMAN, Role.TERRORIST, Role.INFORMER].includes(role);
}

export default class Room extends Screen {
  logger = new Logger(this.constructor.name);
  headerElem: HTMLDivElement

  loadingDivElem!: HTMLDivElement
  loadingElem!: HTMLImageElement
  rotation = 0

  titleElem!: HTMLLabelElement
  gameInfoElem!: HTMLDivElement
  playersListElem!: HTMLDivElement
  rangeZoomElem!: HTMLInputElement
  gamePlayersListElem!: HTMLDivElement
  resizablePLElem!: HTMLDivElement
  messagesElem!: HTMLDivElement
  infoElem!: HTMLDivElement;
  emojiPanel!: HTMLDivElement;
  input!: HTMLInputElement
  rolesElem!: HTMLDivElement;
  timerEl!: HTMLDivElement;

  meElem?: HTMLElement
  yourRoleElem?: HTMLSpanElement
  deadImgElem?: HTMLImageElement
  myVoteElem?: HTMLDivElement
  affectedByRolesElem?: HTMLDivElement

  localFirstMessages: any[] = [];
  localAffectedByRoles: Role[] = [];

  clearMessages = true

  isInitialized = false
  preInitCallback: Function = () => {}

  modelType = 0;
  title = 'Комната';
  maxPlayers = 8
  minPlayers = 1
  minLevel = 1;
  isVipEnabled = false
  selectedRoles: Role[] = [];
  playerRoles: Record<string, number> = {};
  status = 0; // 0 - регистрация, 2 - подготовка, 3 - игра, 4 - конец игры
  get isGame() { return this.status == 3; }
  gameDayTime = 0;
  timer = 0;
  playersStat: any
  isHistory = false

  oldAppSettingsData: any;

  kicks: Record<string, number> = {}

  usersWaiting: string[] = [];
  playersData: Record<string, {
    index?: number
    username?: string
    alive?: boolean
    userObjectId?: string
    playerObjectId?: string
    role?: Role
    preRole?: Role
    affectedByRoles?: Role[]
    isDayActionUsed?: boolean
    isNightActionAlternative?: boolean
    isNightActionUsed?: boolean
    autoClick?: boolean
    didAutoClick?: boolean
    vote?: number
  }> = {}
  players: any[] = [];

  messages: any[] = [];
  joinLeaveMessages: Record<string, HTMLElement> = {};
  lastMessage!: {
    username?: any,
    divM?: HTMLElement
  }

  constructor(public roomObjectId: string, public options: {
    password?: string
    sendRoomEnter?: boolean
    isHistory?: boolean
    isMM?: boolean
    dontWaitForAnswer?: boolean
    data?: any,
    selectedRoles?: Role[]
  } = {}){
    super('Room');

    if(typeof options.sendRoomEnter != 'boolean') options.sendRoomEnter = true;
    if(options.isHistory) {
      this.isHistory = true;
      this.status = 3;
      this.title = options.data.title;
      this.playersData = options.data.playersData;
      this.playersStat = options.data.playersStat;
      this.selectedRoles = options.data.selectedRoles;
      this.localFirstMessages = options.data.messages;
    }
    App.title = 'Комната';
    
    if(options.isMM){
      this.title = 'Соревновательный режим';
      App.title = 'Соревновательный режим';
      this.maxPlayers = 12;
      this.modelType = 1;
    }
    if(options.selectedRoles){
      this.selectedRoles = options.selectedRoles;
    }

    this.oldAppSettingsData = JSON.parse(JSON.stringify(App.settings.data));

    (async () => {
      this.element.style.transition = 'background 1s';
      this.element.style.background = `url(${await getBackgroundImg('day3')}) 0% 0% / cover`
      this.clearMessages = App.settings.data.game.clearMessages
    })();

    this.headerElem = document.createElement('div');
    this.headerElem.className = 'header';
    this.element.appendChild(this.headerElem);
    const back = document.createElement('button');
    back.className = 'back';
    back.onclick = () => this.emit('back');
    const backImg = document.createElement('img');
    backImg.width = 24;
    getTexture(`ui/Jb.png`).then(e => backImg.src = e);
    back.appendChild(backImg);
    this.headerElem.appendChild(back);
    this.titleElem = document.createElement('label');
    this.titleElem.textContent = ``;
    this.titleElem.style.width = '300px';
    this.titleElem.style.userSelect = 'text';
    this.headerElem.appendChild(this.titleElem);

    this.loadingDivElem = document.createElement('div');
    this.loadingDivElem.style.display = 'flex';
    this.loadingDivElem.style.justifyContent = 'center';
    this.loadingDivElem.style.margin = '15px'
    this.element.appendChild(this.loadingDivElem);
    this.loadingElem = document.createElement('img');
    this.loadingElem.style.textAlign = 'center';
    getTexture(`loading/2f.png`).then(e => this.loadingElem.src = e);
    this.loadingDivElem.appendChild(this.loadingElem);

    this.on('back', () => {
      App.screen = this.options.isMM ? new Dashboard() : this.isHistory ? new History() : new Rooms();
    });

    this.init();
  }

  tick(dt: number){
    if(dt % 2 < 1) return;
    if(this.loadingElem)
      this.loadingElem.style.transform = `rotateZ(${this.rotation % 360}deg)`
    this.rotation+=30;
  }

  async reconnect() {
    super.reconnect();

    if(this.isHistory) return;

    const self = this;
    if(this.options.sendRoomEnter) App.server.send(PacketDataKeys.ROOM_ENTER, {
      [PacketDataKeys.ROOM_PASS]: this.options.password ? md5salt(this.options.password) : '',
      [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId
    });
    let stats = await this.waitAndGetStats();
    App.server.send(PacketDataKeys.CREATE_PLAYER, {
      [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
      [PacketDataKeys.TOKEN]: App.user.token,
      [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId,
      [PacketDataKeys.ROOM_MODEL_TYPE]: this.modelType
    });

    if(!stats) stats = await App.server.awaitPacket(PacketDataKeys.ROOM_STATISTICS);

    function preInit() {
      const rs = stats![PacketDataKeys.ROOM_STATISTICS];
      if(self.messagesElem) {
        self.messages = [];
        self.messagesElem.innerHTML = '';
        for(const m of rs[PacketDataKeys.MESSAGES])
          wait(50).then(() => self.addMessage(m, false));
      } else {
        self.localFirstMessages = rs[PacketDataKeys.MESSAGES];
      }
      self.players = rs[PacketDataKeys.PLAYERS];
      self.titleElem.textContent = `${self.title} ${self.players.length} [${self.minPlayers}/${self.maxPlayers}]`;
      if(rs[PacketDataKeys.GAME_STATUS]) {
        self.status = rs[PacketDataKeys.GAME_STATUS][PacketDataKeys.STATUS];
        self.gameDayTime = rs[PacketDataKeys.GAME_STATUS][PacketDataKeys.DAYTIME];
        self.timer = rs[PacketDataKeys.GAME_STATUS][PacketDataKeys.TIMER];
      }
      if(self.status == 3) {
        if(rs[PacketDataKeys.PLAYERS]) {
          let i = 0;
          for(const pl of rs[PacketDataKeys.PLAYERS]){
            const u = pl[PacketDataKeys.PLAYER_USER];
            const uo = u[PacketDataKeys.PLAYER_OBJECT_ID];
            const username = u[PacketDataKeys.USERNAME];
            if(!self.playersData[uo]) self.playersData[uo] = {};
            self.playersData[uo].index = i;
            self.playersData[uo].username = username;
            i++;
          }
        }
        if(rs[PacketDataKeys.PLAYERS_DATA]) {
          let i = 0;
          for(const pl of rs[PacketDataKeys.PLAYERS_DATA]){
            const uo = pl[PacketDataKeys.PLAYER_OBJECT_ID];
            const index = self.playersData[uo] ? self.playersData[uo].index : i;
            const username = self.playersData[uo] ? self.playersData[uo].username : 'no nickname';
            self.playersData[uo] = {
              index,
              username,
              alive: pl[PacketDataKeys.ALIVE] ?? true,
              affectedByRoles: pl[PacketDataKeys.AFFECTED_BY_ROLES] ?? [],
              isDayActionUsed: pl[PacketDataKeys.IS_DAY_ACTION_USED],
              isNightActionAlternative: pl[PacketDataKeys.IS_NIGHT_ACTION_ALTERNATIVE],
              isNightActionUsed: pl[PacketDataKeys.IS_NIGHT_ACTION_USED],
              userObjectId: uo,
              playerObjectId: uo,
              role: pl[PacketDataKeys.ROLE],
              vote: pl[PacketDataKeys.VOTE] ?? 0
            }
            i++;
          }
          // console.log(self.playersData["61092974-8103-41af-954b-7f6bc553b807"]);
        }
        if(rs[PacketDataKeys.PLAYER_ROLES]){
          self.playerRoles = rs.rls;
        }
      } else {
        self.infoElem.innerHTML = `Регистрация`;
        self.updatePlayersWaiting(rs[PacketDataKeys.PLAYERS]);
      }
    }

    if(this.isInitialized) preInit();
    else this.preInitCallback = preInit;
  }

  async waitAndGetStats(){
    let stats: any;
    if(!this.options.dontWaitForAnswer){
      const rData = await App.server.awaitPacket([PacketDataKeys.ROOM_ENTER, PacketDataKeys.ROOM_PASSWORD_IS_WRONG_ERROR, PacketDataKeys.GAME_STARTED, PacketDataKeys.USER_IN_ANOTHER_ROOM, PacketDataKeys.USER_USING_DOUBLE_ACCOUNT, PacketDataKeys.USER_LEVEL_NOT_ENOUGH, PacketDataKeys.USER_KICKED, PacketDataKeys.ROOM_CREATED, PacketDataKeys.MAXIMUM_PLAYERS], 2000);
      if(rData[PacketDataKeys.TYPE] == PacketDataKeys.ROOM_PASSWORD_IS_WRONG_ERROR){
        App.screen = new Rooms();
        MessageBox('Неправильный пароль!');
        return;
      } else if(rData[PacketDataKeys.TYPE] == PacketDataKeys.GAME_STARTED){
        App.screen = new Rooms();
        MessageBox('Игра уже началась');
        return;
      } else if(rData[PacketDataKeys.TYPE] == PacketDataKeys.USER_IN_ANOTHER_ROOM){
        App.screen = new Rooms();
        MessageBox('Нельзя зайти');
        return;
      } else if(rData[PacketDataKeys.TYPE] == PacketDataKeys.USER_LEVEL_NOT_ENOUGH){
        App.screen = new Rooms();
        MessageBox('Ваш уровень маленький');
        return;
      } else if(rData[PacketDataKeys.TYPE] == PacketDataKeys.USER_KICKED){
        App.screen = new Rooms();
        MessageBox('Вас выгнали');
        return;
      } else if(rData[PacketDataKeys.TYPE] == PacketDataKeys.MAXIMUM_PLAYERS) {
        App.screen = new Rooms();
        MessageBox('Комната переполнена');
        return;
      } else if(rData[PacketDataKeys.TYPE] == PacketDataKeys.USER_IS_NOT_VIP) {
        App.screen = new Rooms();
        MessageBox('Только VIP игроки могут присоединиться к VIP комнате');
        return;
      } else if(rData[PacketDataKeys.TYPE] == PacketDataKeys.ROOM_CREATED) {
      } else if(rData[PacketDataKeys.TYPE] == PacketDataKeys.ROOM_STATISTICS) {
        stats = rData;
      } else if(rData[PacketDataKeys.TYPE] != PacketDataKeys.ROOM_ENTER) {
        App.screen = new Rooms();
        MessageBox('Ошибка.. ' + JSON.stringify(rData));
        return;
      }

      const roomData = rData[PacketDataKeys.ROOM];
      if(roomData && roomData[PacketDataKeys.OBJECT_ID] && typeof roomData[PacketDataKeys.ROOM_MODEL_TYPE] == 'number'){
        this.roomObjectId = roomData[PacketDataKeys.OBJECT_ID]
        this.modelType = roomData[PacketDataKeys.ROOM_MODEL_TYPE];
        this.title = roomData[PacketDataKeys.TITLE];
        this.maxPlayers = roomData[PacketDataKeys.MAX_PLAYERS];
        this.minPlayers = roomData[PacketDataKeys.MIN_PLAYERS];
        this.minLevel = roomData[PacketDataKeys.MIN_LEVEL];
        this.isVipEnabled = roomData[PacketDataKeys.VIP_ENABLED];
        this.selectedRoles = roomData[PacketDataKeys.SELECTED_ROLES];
        this.status = roomData[PacketDataKeys.STATUS];
        this.gameDayTime = roomData[PacketDataKeys.DAYTIME];
      }
    }

    return stats;
  }

  getPlayerDataFromPUO(puo: string){
    for(const uo in this.playersData){
      const pl = this.playersData[uo];
      if(pl.playerObjectId == puo)
        return pl;
    }
    return null;
  }

  me(){
    return this.playersData[App.user.playerObjectId];
  }

  async init() {
    const rData = await this.reconnect();

    this.loadingDivElem.remove();

    if(!this.isHistory) this.on('message', async data => {
      if(data[PacketDataKeys.TYPE] == PacketDataKeys.USER_USING_DOUBLE_ACCOUNT){
        App.screen = new Rooms();
        MessageBox(`В данной комнате уже есть игрок, который подключен к тому же интернет подключению, что и вы

  Вероятно вы и этот игрок используете общую точку доступа к сети интернет

  Если вы хотите играть с данным игроком в одной комнате - создайте комнату с паролем или убедитесь, что вы подключены каждый к своей точке доступа или мобильным данным`, { height: 360 });
        return;
      }

      if(data[PacketDataKeys.TYPE] == PacketDataKeys.MESSAGE){
        this.addMessage(data[PacketDataKeys.MESSAGE]);
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.USERS && !this.isGame){
        this.updatePlayersWaiting(data[PacketDataKeys.USERS]);
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.ADD_PLAYER && !this.isGame){
        this.players.push(data[PacketDataKeys.PLAYER]);
        this.updatePlayersWaiting(this.players);
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.REMOVE_PLAYER && !this.isGame){
        this.players = this.players.filter(e => e[PacketDataKeys.PLAYER_USER][PacketDataKeys.PLAYER_OBJECT_ID] !== data[PacketDataKeys.PLAYER_OBJECT_ID]);
        this.updatePlayersWaiting(this.players);
      } else if(typeof data[PacketDataKeys.TIMER] == 'number' && typeof data[PacketDataKeys.TYPE] == 'undefined' && !this.isGame){
        if(this.status == 2){
          this.infoElem.textContent = noXSS(`Подготовка через ${data[PacketDataKeys.TIMER]}`);
        } else {
          this.infoElem.textContent = noXSS(`Игра начнётся через ${data[PacketDataKeys.TIMER]}`);
        }
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.PLAYERS_STAT){
        this.playersStat = data;
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.GAME_STATUS){
        this.status = data[PacketDataKeys.GAME_STATUS][PacketDataKeys.STATUS];
        this.timer = data[PacketDataKeys.GAME_STATUS][PacketDataKeys.TIMER];
        if(this.status == 0){
          this.infoElem.textContent = noXSS(`Регистрация`);
        }
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.ROOM_STATISTICS){
        if(data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.GAME_STATUS]){
          this.status = data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.GAME_STATUS][PacketDataKeys.STATUS];
          this.timer = data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.GAME_STATUS][PacketDataKeys.TIMER];
        }
        if(data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.PLAYER_ROLES]){
          this.playerRoles = data[PacketDataKeys.ROOM_STATISTICS].rls;
        }
        if(this.status == 3) {
          if(data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.PLAYERS]) {
            let i = 0;
            for(const pl of data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.PLAYERS]){
              const u = pl[PacketDataKeys.PLAYER_USER];
              const uo = pl[PacketDataKeys.OBJECT_ID];
              const puo = u[PacketDataKeys.PLAYER_OBJECT_ID];
              const username = u[PacketDataKeys.USERNAME];
              if(!this.playersData[puo]) this.playersData[puo] = {};
              this.playersData[puo].index = i;
              this.playersData[puo].username = username;
              this.playersData[puo].playerObjectId = puo;
              i++;
            }
          }
          if(data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.PLAYERS_DATA]) {
            for(const pl of data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.PLAYERS_DATA]){
              const puo = pl[PacketDataKeys.PLAYER_OBJECT_ID];
              const pu = this.getPlayerDataFromPUO(puo);
              if(pu){
                pu.affectedByRoles = pl[PacketDataKeys.AFFECTED_BY_ROLES];
                if(typeof pl[PacketDataKeys.ALIVE] == 'boolean') pu.alive = pl[PacketDataKeys.ALIVE];
                pu.isDayActionUsed = pl[PacketDataKeys.IS_DAY_ACTION_USED];
                pu.isNightActionAlternative = pl[PacketDataKeys.IS_NIGHT_ACTION_ALTERNATIVE];
                pu.isNightActionUsed = pl[PacketDataKeys.IS_NIGHT_ACTION_USED];
                if(typeof pl[PacketDataKeys.ROLE] == 'number') pu.role = pl[PacketDataKeys.ROLE];
                if(typeof pl[PacketDataKeys.VOTE] == 'number') pu.vote = pl[PacketDataKeys.VOTE];
                // pu.userObjectId = uo;
              }
            }
            this.updatePlayersGame();
          }
        }

        if(this.isGame) {
          if(this.clearMessages) {
            this.messages = [];
            this.lastMessage = {}
            this.messagesElem.innerHTML = '';
          }
          for(const m of data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.MESSAGES]) this.addMessage(m, false);
          this.initGame();
          if(this.status == 3)
            this.updatePlayersGame();
        } else {
          this.updatePlayersWaiting(data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.PLAYERS])
        }

        if(this.status == 4) {
          if(App.settings.data.game.saveHistory) {
            if(!(await fs.existsFile(`${App.config.path}/history.json`)))
              await fs.writeFile(`${App.config.path}/history.json`, JSON.stringify({ rooms: [] }));
            const history = JSON.parse(await fs.readFile(`${App.config.path}/history.json`));

            history.rooms.unshift({
              messages: this.messages,
              playersStat: this.playersStat,
              playersData: this.playersData,
              modelType: this.modelType,
              title: this.title,
              maxPlayers: this.maxPlayers,
              minPlayers: this.minPlayers,
              minLevel: this.minLevel,
              isVipEnabled: this.isVipEnabled,
              selectedRoles: this.selectedRoles,
              gameDayTime: this.gameDayTime,
              isMM: this.options.isMM,
              createdAt: Date.now()
            });

            await fs.writeFile(`${App.config.path}/history.json`, JSON.stringify(history));

            App.logger.info(`Saved`);
          }
        }
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.ROLES){
        for(const pl of data[PacketDataKeys.ROLES]){
          const uo = pl[PacketDataKeys.USER_OBJECT_ID];
          const role = pl[PacketDataKeys.ROLE];
          if(this.playersData[uo])
            this.playersData[uo].role = role;
          else
            this.playersData[uo] = { role };
        }
        this.updatePlayersGame();
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.GAME_FINISHED) {
        this.status = 3;
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.PLAYER_ROLES){
        for(const pl of data[PacketDataKeys.PLAYER_ROLES]){
          const puo = pl[PacketDataKeys.PLAYER_OBJECT_ID];
          const role = pl[PacketDataKeys.ROLE];
          if(this.playersData[puo])
            this.playersData[puo].role = role;
        }
        // // TODO: FIX IT
        // App.screen = new Rooms();
        // await wait(500);
        // App.screen = new Room(this.roomObjectId, this.options);
      } else if(data[PacketDataKeys.TYPE] == data[PacketDataKeys.KICK_USER]){
        const kicker = data[PacketDataKeys.KICK_USER_OBJECT_ID];
        const puo = data[PacketDataKeys.PLAYER_OBJECT_ID];
        const timer = data[PacketDataKeys.TIMER];
        this.kicks[puo] = timer;
      }
    });

    this.rolesElem = document.createElement('div');
    this.rolesElem.style.display = 'flex';
    this.rolesElem.style.width = '100%';
    this.rolesElem.style.marginRight = '10px';
    this.rolesElem.style.flexDirection = 'row-reverse';
    this.rolesElem.style.alignItems = 'center';
    for(const r of this.selectedRoles){
      const img = document.createElement('img');
      getRoleImg(r).then(e => img.src = e);
      img.width = 25;
      img.height = 35;
      img.onmousedown = e => e.preventDefault();
      this.rolesElem.appendChild(img);
    }
    this.headerElem.appendChild(this.rolesElem);

    App.title = `Комната: ${this.title}`;
    this.titleElem.innerHTML = noXSS(this.title);

    this.infoElem = document.createElement('div');
    this.infoElem.className = 'black';
    this.infoElem.style.textAlign = 'center';
    this.infoElem.style.margin = '5px 0';
    this.infoElem.innerHTML = `Регистрация`
    this.element.appendChild(this.infoElem);

    this.playersListElem = document.createElement('div');
    this.playersListElem.style.overflow = 'overlay';
    this.playersListElem.style.margin = '5px 1px';
    this.playersListElem.style.outline = '2px solid #c0c0c0';
    this.playersListElem.style.borderRadius = '3px';
    this.playersListElem.style.background = 'rgba(255,255,255,.5)';
    this.element.appendChild(this.playersListElem);

    const miniSettingsPLElem = document.createElement('div');
    miniSettingsPLElem.style.width = '100%';
    let isDown = false;
    this.rangeZoomElem = document.createElement('input');
    this.rangeZoomElem.style.display = 'none';
    this.rangeZoomElem.style.width = '100%';
    this.rangeZoomElem.type = 'range';
    this.rangeZoomElem.min = '25'
    this.rangeZoomElem.max = '50'
    this.rangeZoomElem.value = (this.oldAppSettingsData.game.zoomPL * 25) + '';
    this.rangeZoomElem.onmousedown = () => isDown = true;
    this.rangeZoomElem.onmouseup = () => isDown = false;
    this.rangeZoomElem.onmousemove = () => {
      if(!isDown) return;
      const zoom = (parseInt(this.rangeZoomElem.value) / 25);
      App.settings.data.game.zoomPL = zoom;
      this.gamePlayersListElem.style.zoom = zoom + '';
    }
    miniSettingsPLElem.appendChild(this.rangeZoomElem);
    this.playersListElem.appendChild(miniSettingsPLElem);

    this.gamePlayersListElem = document.createElement('div');
    this.gamePlayersListElem.style.height = '155px';//(App.height - 225) + 'px';
    this.gamePlayersListElem.style.display = 'flex';
    this.gamePlayersListElem.style.flexWrap = 'wrap';
    this.gamePlayersListElem.style.flexDirection = 'column';
    this.gamePlayersListElem.style.zoom = '1';
    this.playersListElem.appendChild(this.gamePlayersListElem);

    this.resizablePLElem = document.createElement('div');
    this.resizablePLElem.style.margin = '2px'
    this.resizablePLElem.style.cursor = 'e-resize';
    this.resizablePLElem.style.float = 'right';
    this.resizablePLElem.style.width = '5px';
    this.resizablePLElem.style.display = 'none';
    this.resizablePLElem.onmousedown = event => {
      const el = this.playersListElem;
      const zoom = getZoom();
      const startX = event.clientX / zoom;
      const startWidth = el.clientWidth;
      const minWidth = 5;

      function moveHandler(e: MouseEvent) {
        const currX = e.clientX / zoom;

        let newWidth = startWidth;

        newWidth = Math.max(minWidth, startWidth - (currX - startX));

        e.stopPropagation?.();
        e.preventDefault?.();

        el.style.width = newWidth + 'px';
      }

      function upHandler(e: MouseEvent) {
        App.settings.data.game.widthPL = parseInt(el.style.width.replace('px', ''));
        document.removeEventListener("mousemove", moveHandler, true);
        document.removeEventListener("mouseup", upHandler, true);
        e.stopPropagation?.();
      }

      document.addEventListener("mousemove", moveHandler, true);
      document.addEventListener("mouseup", upHandler, true);

      event.stopPropagation?.();
      event.preventDefault?.();
    }
    this.element.appendChild(this.resizablePLElem);

    this.gameInfoElem = createElement('div', {
      css: {
        height: '125px',
        margin: '5px 10px',
        outline: '2px solid #c0c0c0',
        borderRadius: '3px',
        background: 'rgba(255,255,255,.5)',
        display: 'none',
      }
    });
    this.element.appendChild(this.gameInfoElem);

    this.messagesElem = createElement('div', {
      css: {
        height: (App.height - (isMobile() ? 295 : 275)) + 'px',
        textAlign: 'center',
        overflowX: 'hidden',
        overflowY: 'overlay',
        margin: '10px 10px 5px 10px',
        outline: '2px solid #c0c0c0',
        borderRadius: '3px',
        background: 'rgba(255,255,255,.5)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }
    });
    this.element.appendChild(this.messagesElem);

    for(const m of this.localFirstMessages) wait(50).then(() => this.addMessage(m, false));

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
    this.input.addEventListener('input', e => {
      const value = this.input.value;
      const oldValue = lastValue || '';
      lastValue = value;
      
      if(value.length > oldValue.length && value.endsWith(' ') && !oldValue.endsWith(' ')) {
        const match = value.match(/(?:^|\s)@(\d+)\s$/);
        
        if(match) {
          const number = match[1];
          const playerName = this.getPlayer((parseInt(number) - 1).toString());
          
          if(playerName) {
            const hasSpaceBefore = value.match(/\s@\d+\s$/) ? ' ' : '';
            const newValue = value.replace(/(?:^|\s)@\d+\s$/, `${hasSpaceBefore}[${playerName[PacketDataKeys.USER][PacketDataKeys.USERNAME]}] `);
            this.input.value = newValue;
            lastValue = newValue;
            
            this.input.setSelectionRange(newValue.length, newValue.length);
          }
        }
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
      this.#changeHeightMessagesElem();
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

    this.on('resize', () => {
      this.#changeHeightMessagesElem();
    }).key('waiting');

    this.isInitialized = true
    this.preInitCallback();

    if(this.isGame) this.initGame();

    this.setTimeout('scroll messages', () => {
      this.messagesElem.scrollTop = this.messagesElem.scrollHeight;
    }, 500);
  }
  
  #changeHeightMessagesElem(){
    const ch = this.emojiPanel.style.display == 'block' ? 60 : 0;
    if(this.isGame) {
      this.messagesElem.style.height = (App.height - (isMobile() ? 245 : 225) - ch) + 'px';
      this.playersListElem.style.height = (App.height - (isMobile() ? 110 : 90) - ch) + 'px';
      this.resizablePLElem.style.height = (App.height - (isMobile() ? 110 : 90) - ch) + 'px';
    } else {
      this.messagesElem.style.height = (App.height - (isMobile() ? 295 : 275) - ch) + 'px';
    }
  }

  async initGame(){
    this.logger.info('запуск игры..');
    // console.log('запуск игры..');
    try{this.element.removeChild(this.infoElem);}catch{}
    this.removeByKey('waiting');

    this.playersListElem.style.float = 'right';
    this.playersListElem.style.flexFlow = 'column wrap';
    this.playersListElem.style.overflowX = 'hidden';
    this.playersListElem.style.overflowY = 'overlay';
    this.playersListElem.style.width = (isMobile() ? 115 : this.oldAppSettingsData.game.widthPL) + 'px';
    this.playersListElem.style.height = (App.height - (isMobile() ? 100 : 80)) + 'px';

    this.gamePlayersListElem.style.flexDirection = 'row'
    this.gamePlayersListElem.style.alignContent = 'flex-start'
    this.gamePlayersListElem.style.justifyContent = 'center';
    this.gamePlayersListElem.style.zoom = this.oldAppSettingsData.game.zoomPL + '';
    this.gamePlayersListElem.innerHTML = '';

    if(!isMobile()) this.rangeZoomElem.style.display = 'block';
    this.resizablePLElem.style.display = 'block';
    this.#changeHeightMessagesElem();

    this.changeDayTime();

    this.on('resize', () => {
      this.#changeHeightMessagesElem();
    });

    if(this.playerRoles){
      this.rolesElem.innerHTML = '';
      for(const r in this.playerRoles){
        const amount = this.playerRoles[r];
        const img = document.createElement('img');
        getRoleImg((r as unknown as Role)).then(e => img.src = e);
        img.width = 25;
        img.height = 35;
        img.onmousedown = e => e.preventDefault();
        if(amount == 0) img.style.opacity = '.5';
        this.rolesElem.appendChild(img);
      }
    }

    const yourRoleMsg = `Вы<br/>${RuRoles[this.me()?.role! - 1]}`;
    let mafia: HTMLDivElement, mir: HTMLDivElement, giveUpButton: HTMLButtonElement;
    {
      this.gameInfoElem.innerHTML = '';
      this.gameInfoElem.style.display = 'flex';
      { // me
        const nick = createElement('span', {
          html: (App.settings.data.game.showIndexPl ? `<span style="color: #ab1457; font-weight: bold">${(this.me()?.index ?? 0) + 1}</span> ` : '') + noXSS(App.user.username),
          className: 'black',
          css: {
            fontSize: 'smaller',
            textAlign: 'center',
            filter: App.settings.data.hideUsername ? 'blur(5px)' : '',
            padding: '1px'
          }
        });
        const myRoleImg = createElement('img', {
          width: 50,
          height: 70
        });
        getRoleImg(this.me()?.role ?? 1).then(e => myRoleImg.src = e);
        myRoleImg.onmousedown = e => e.preventDefault();
        this.deadImgElem = createElement('img', {
          width: 50,
          height: 70,
          css: {
            display: 'none',
            position: 'absolute',
            top: '56px'
          }
        });
        getTexture(`roles/dead.png`).then(e => this.deadImgElem!.src = e);
        this.deadImgElem.onmousedown = e => e.preventDefault();
        this.myVoteElem = createElement('div', {
          css: {
            background: 'red',
            color: 'white',
            padding: '3px',
            position: 'absolute',
            right: '5px',
            bottom: '20px',
            borderRadius: '3px',
            display: 'none'
          }
        });
        this.affectedByRolesElem = createElement('div', {
          css: {
            width: '125px',
            height: '100%',
            marginLeft: '5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            flexWrap: 'wrap',
            alignContent: 'center'
          }
        });
        this.meElem = createElement('div', {
          css: {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 5px'
          }
        });
        this.yourRoleElem = createElement('span', {
          html: yourRoleMsg,
          className: 'black',
          css: {
            fontSize: 'smaller',
            textAlign: 'center',
            padding: '1px'
          }
        });
        this.meElem.appendChild(this.yourRoleElem);
        this.meElem.appendChild(myRoleImg);
        this.meElem.appendChild(this.deadImgElem);
        this.meElem.appendChild(this.myVoteElem);
        this.meElem.appendChild(nick);
        this.gameInfoElem.appendChild(this.meElem);
        this.gameInfoElem.appendChild(this.affectedByRolesElem);
      }
      { // PLAYERS_STAT, timer, giveUp
        const playersStat = this.playersStat ?? {}
        const div = createElement('div', {
          css: {
            display: 'flex',
            alignItems: 'flex-end',
            flexDirection: 'column',
            padding: '8px',
            width: '100%'
          }
        });
        mafia = document.createElement('div');
        mafia.textContent = noXSS(`Мафия: ${playersStat[PacketDataKeys.MAFIA_ALL]} | ${playersStat[PacketDataKeys.MAFIA_ALIVE]}`);
        mafia.style.color = '#940000';
        mir = document.createElement('div');
        mir.textContent = noXSS(`Мирные: ${playersStat[PacketDataKeys.CIVILIAN_ALL]} | ${playersStat[PacketDataKeys.CIVILIAN_ALIVE]}`);
        mir.style.color = '#186400';
        this.timerEl = createElement('div', {
          text: noXSS(this.timer + ''),
          className: 'black',
          css: {
            float: 'right',
            fontSize: '35px',
            fontWeight: 'bold',
            marginTop: '15px',
            padding: '5px',
            transition: 'color 3s'
          }
        });
        giveUpButton = createElement('button', {
          text: 'Сдаться',
          css: {
            marginTop: '-5px',
            display: 'none'
          }
        });
        {
          const role = this.me()?.role ?? 1;
          if(this.players.length > 7 && this.me()?.alive && ((playersStat[PacketDataKeys.MAFIA_ALIVE] == 1 && isMafia(role)) || (playersStat[PacketDataKeys.CIVILIAN_ALIVE] == 1 && !isMafia(role)))) {
            this.timerEl.style.marginTop = '0';
            giveUpButton.style.display = 'block';
          }
        }
        giveUpButton.onclick = () => App.server.send(PacketDataKeys.GIVE_UP, { [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId });
        div.appendChild(mafia);
        div.appendChild(mir);
        div.appendChild(this.timerEl);
        div.appendChild(giveUpButton);
        this.gameInfoElem.appendChild(div);
      }
    }

    if(!this.me()?.alive){
      this.deadImgElem.style.top = (this.yourRoleElem.clientHeight + 1)+'px';
      this.deadImgElem.style.display = 'flex';
    }

    this.on('message', data => {
      if(!this.isGame) return;
      if(data[PacketDataKeys.TYPE] == PacketDataKeys.GAME_DAYTIME){
        this.gameDayTime = data[PacketDataKeys.DAYTIME];
        this.changeTimer(data[PacketDataKeys.TIMER]);
        this.changeDayTime();
        this.updatePlayersGame()
      } else if(typeof data[PacketDataKeys.TIMER] == 'number'){
        this.timer = data[PacketDataKeys.TIMER];
        this.changeTimer(data[PacketDataKeys.TIMER]);
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.PLAYERS_STAT) {
        mafia.textContent = noXSS(`Мафия: ${data[PacketDataKeys.MAFIA_ALL]} | ${data[PacketDataKeys.MAFIA_ALIVE]}`);
        mir.textContent = noXSS(`Мирные: ${data[PacketDataKeys.CIVILIAN_ALL]} | ${data[PacketDataKeys.CIVILIAN_ALIVE]}`);

        wait(500).then(() => {
          const role = this.me()?.role ?? 1;
          if(this.players.length > 7 && this.me()?.alive && ((data[PacketDataKeys.MAFIA_ALIVE] == 1 && isMafia(role)) || (data[PacketDataKeys.CIVILIAN_ALIVE] == 1 && !isMafia(role)))) {
            giveUpButton.style.display = 'block';
            this.timerEl.style.marginTop = '0';
          }
        });
      } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.USER_DATA){
        for(const pl of data[PacketDataKeys.PLAYERS_DATA]) {
          // const pl = data[PacketDataKeys.PLAYERS_DATA][p];
          const uo = pl[PacketDataKeys.PLAYER_OBJECT_ID];

          if(pl[PacketDataKeys.AFFECTED_BY_ROLES]) this.playersData[uo].affectedByRoles = pl[PacketDataKeys.AFFECTED_BY_ROLES];
          if(typeof pl[PacketDataKeys.ALIVE] == 'boolean') this.playersData[uo].alive = pl[PacketDataKeys.ALIVE];
          if(typeof pl[PacketDataKeys.IS_DAY_ACTION_USED] == 'boolean') this.playersData[uo].isDayActionUsed = pl[PacketDataKeys.IS_DAY_ACTION_USED];
          if(typeof pl[PacketDataKeys.IS_NIGHT_ACTION_ALTERNATIVE] == 'boolean') this.playersData[uo].isNightActionAlternative = pl[PacketDataKeys.IS_NIGHT_ACTION_ALTERNATIVE];
          if(typeof pl[PacketDataKeys.IS_NIGHT_ACTION_USED] == 'boolean') this.playersData[uo].isNightActionUsed = pl[PacketDataKeys.IS_NIGHT_ACTION_USED];
          if(typeof pl[PacketDataKeys.ROLE] == 'number') this.playersData[uo].role = pl[PacketDataKeys.ROLE];
          if(typeof pl[PacketDataKeys.VOTE] == 'number') this.playersData[uo].vote = pl[PacketDataKeys.VOTE];

          // if(data[PacketDataKeys.PLAYERS_DATA].length == 1 && uo != App.user.objectId) {
          //   if(typeof pl[PacketDataKeys.VOTE] != 'number') this.playersData[uo].vote = (this.playersData[uo].vote ?? 0) + 1;
          // }
        }

        this.updatePlayersGame();
      }
    });

    this.updatePlayersGame();
  }

  changeTimer(t = this.timer){
    this.timer = t;
    this.timerEl.textContent = `${t}`;
    if(t <= 5) {
      this.timerEl.style.color = 'darkred';
    } else if(t <= 10) {
      this.timerEl.style.color = 'red';
    } else if(t <= 15) {
      this.timerEl.style.color = 'orange';
    } else {
      this.timerEl.style.color = 'black';
    }
  }

  async changeDayTime(){
    if(this.gameDayTime < 2) {
      this.element.style.background = `url(${await getBackgroundImg('night3')}) 0% 0% / cover`;

      this.playersListElem.style.outline = '2px solid rgb(128 128 128)';
      this.playersListElem.style.background = 'rgb(255 255 255 / 30%)';

      this.gameInfoElem.style.outline = '2px solid rgb(128 128 128)';
      this.gameInfoElem.style.background = 'rgb(255 255 255 / 30%)';

      this.messagesElem.style.outline = '2px solid rgb(128 128 128)';
      this.messagesElem.style.background = 'rgb(255 255 255 / 30%)'
    } else {
      this.element.style.background = `url(${await getBackgroundImg('day3')}) 0% 0% / cover`;

      this.playersListElem.style.outline = '2px solid #c0c0c0';
      this.playersListElem.style.background = 'rgba(255,255,255,.5)';

      this.gameInfoElem.style.outline = '2px solid #c0c0c0';
      this.gameInfoElem.style.background = 'rgba(255,255,255,.5)';

      this.messagesElem.style.outline = '2px solid #c0c0c0';
      this.messagesElem.style.background = 'rgba(255,255,255,.5)';
    }

    for(const uo in this.playersData){
      this.playersData[uo].didAutoClick = false;
    }
  }

  updatePlayersGame(){
    const self = this;
    const entries = Object.entries(this.playersData).sort(([, a], [, b]) => (a.index ?? 0) - (b.index ?? 0));

    this.gamePlayersListElem.innerHTML = '';

    for(const [uo, pl] of entries) {
      if(pl.username == App.user.username) {
        if(this.deadImgElem && this.deadImgElem.style.display == 'none' && this.yourRoleElem && pl.alive == false) {
          this.deadImgElem.style.top = (this.yourRoleElem.clientHeight + 1)+'px';
          this.deadImgElem.style.display = 'flex';
          if(App.settings.data.game.showYouDiedMessage) MessageBox(`Вы умерли`);
        }
        if(this.myVoteElem){
          if(typeof this.playersData[uo].vote == 'number' && this.playersData[uo].vote > 0){
            this.myVoteElem.style.display = 'block';
            this.myVoteElem.textContent = noXSS(this.playersData[uo].vote+'');
          } else {
            this.myVoteElem.style.display = 'none';
          }
        }
        if(this.affectedByRolesElem){
          const affectedByRole = this.playersData[uo].affectedByRoles ?? [];
          const equal = this.localAffectedByRoles.length == affectedByRole.length && this.localAffectedByRoles.every((value, index) => value == affectedByRole[index]);
          if(!equal) {
            this.localAffectedByRoles = affectedByRole;
            this.affectedByRolesElem.innerHTML = '';
            for(const r of affectedByRole) {
              const img = document.createElement('img');
              getRoleImg(r).then(e => img.src = e);
              img.width = 28;
              img.height = 40;
              img.style.opacity = '0';
              img.style.animation = '1s opacity linear alternate infinite';
              // img.style.animationDelay = '1s';
              img.style.margin = '1px'
              img.onmousedown = e => e.preventDefault();
              this.affectedByRolesElem.appendChild(img);
            }
          }
        }
        continue;
      }
      async function contextMenuCallback(event: PointerEvent){
        const cx = new ContextMenu(
          self.playersData[uo].alive ?
            typeof self.playersData[uo].role == 'number' ?
              ['Пользователь', `${self.playersData[uo].autoClick ? '✅ ' : ''}Авто-клик`]
            :
              ['Пользователь', `${self.playersData[uo].autoClick ? '✅ ' : ''}Авто-клик`, `Отметить роль`]
          : ['Пользователь']
        , event);
        const result = await cx.waitForResult();
        if(result == `${self.playersData[uo].autoClick ? '✅ ' : ''}Авто-клик`){
          self.playersData[uo].autoClick = !self.playersData[uo].autoClick;
          self.playersData[uo].didAutoClick = false;
        } else if(result == 'Пользователь'){
          ProfileInfo(uo);
        } else if(result == 'Отметить роль'){
          const cx2 = new ContextMenu(['Убрать', ...RuRoles], event);
          const r = await cx2.waitForResult();
          if(r == 'Убрать') self.playersData[uo].preRole = undefined;
          else self.playersData[uo].preRole = (RuRoles.findIndex(e => e == r)) + 1;
          self.updatePlayersGame();
        }
      }

      const username = pl.username ?? '?';
      const div = createElement('div', {
        css: {
          margin: '2px',
          width: '50px',
          textAlign: 'center',
          position: 'relative',
          height: '100px'
        }
      });
      const nick = document.createElement('div');
      nick.innerHTML = (App.settings.data.game.showIndexPl ? `<span style="color: #ab1457; font-weight: bold">${(pl.index ?? 0) + 1}</span> ` : '') + noXSS(username);
      nick.className = 'black';
      nick.style.wordBreak = 'break-all';
      nick.style.textAlign = 'center';
      nick.style.fontSize = '12px';
      nick.style.marginTop = '-2px';
      const roleImg = document.createElement('img');
      // console.log(pl.playerObjectId == "61092974-8103-41af-954b-7f6bc553b807", pl);
      getRoleImg(pl.role as number ?? 0).then(e => roleImg.src = e);
      roleImg.width = 50;
      roleImg.height = 70;
      roleImg.oncontextmenu = contextMenuCallback
      roleImg.onmousedown = e => e.preventDefault();
      div.appendChild(roleImg);
      if(!pl.alive){
        const deadImg = document.createElement('img');
        getTexture(`roles/dead.png`).then(e => deadImg.src = e);
        deadImg.width = 50;
        deadImg.height = 70;
        deadImg.style.position = 'absolute';
        deadImg.style.left = '0';
        deadImg.onmousedown = e => e.preventDefault();
        deadImg.onclick = () => this.addNickToInput(username);
        deadImg.oncontextmenu = contextMenuCallback
        div.appendChild(deadImg);
      }
      if(!pl.role && typeof pl.preRole == 'number' && pl.preRole > -1){
        const roleImg = document.createElement('img');
        // console.log(pl.preRole);
        getTexture(`roles/a${pl.preRole}.png`).then(e => roleImg.src = e).catch(console.error);
        roleImg.width = 50;
        roleImg.height = 70;
        roleImg.style.position = 'absolute';
        roleImg.style.left = '0';
        roleImg.onmousedown = e => e.preventDefault();
        roleImg.onclick = () => this.addNickToInput(username);
        roleImg.oncontextmenu = contextMenuCallback
        div.appendChild(roleImg);
      }

      if(typeof this.playersData[uo].vote == 'number' && this.playersData[uo].vote > 0){
        const vote = this.playersData[uo].vote;
        const text = document.createElement('div');
        text.style.background = 'red';
        text.style.color = 'white';
        text.style.padding = '3px'
        text.style.position = 'absolute';
        text.style.right = '0';
        text.style.bottom = '30px';
        text.style.borderRadius = '3px';
        text.textContent = noXSS(vote+'');
        div.appendChild(text);
      }

      let action = '';
      let isActionUsed = this.gameDayTime < 2 ? this.me()?.isNightActionUsed : this.me()?.isDayActionUsed
      when(this.me()?.role)
        .case(Role.DOCTOR, () => this.gameDayTime == 1 && (() => { action = '_2'; })())
        .case(Role.SHERIFF, () => this.gameDayTime == 1 && (() => {
          action = 'check';
          if(this.playersData[uo].affectedByRoles?.includes(3)) action = '';
        })())
        .case(Role.MAFIA, () => this.gameDayTime == 1 && (() => {
          action = 'kill';
          if(isMafia(this.playersData[uo].role ?? 1)) action = '';
        })())
        .case(Role.LOVER, () => this.gameDayTime == 0 && (() => { action = '_5' })())
        .case(Role.TERRORIST, () => this.gameDayTime == 3 && (() => { action = '_6' })())
        .case(Role.JOURNALIST, () => this.gameDayTime == 1 && (() => {
          if(!this.playersData[uo].affectedByRoles?.includes(7)) action = '_7';
        })())
        .case(Role.BODYGUARD, () => this.gameDayTime == 2 && (() => {
          action = '_8';
          if(this.me()?.isNightActionUsed) action = '';
        })())
        .case(Role.BARMAN, () => this.gameDayTime == 1 && (() => { action = '_9' })())
        .case(Role.INFORMER, () => this.gameDayTime == 1 && (() => {
          action = 'check';
          if(this.playersData[uo].affectedByRoles?.includes(11)) action = '';
        })());
      if(action == '' && this.gameDayTime == 3) action = 'kill';
      if(this.gameDayTime == 1 && this.me()?.affectedByRoles?.includes(9) && !this.me()?.isNightActionUsed) isActionUsed = false;
      if(action != '' && this.status == 3 && !isActionUsed && this.me()?.alive && this.playersData[uo].alive){
        const actionImg = document.createElement('img');
        getTexture(`roles/${action}.png`).then(e => actionImg.src = e);
        actionImg.width = 50;
        actionImg.height = 70;
        actionImg.style.position = 'absolute';
        actionImg.style.left = '0';
        actionImg.style.transform = 'scale(0)';
        actionImg.style.animation = '.7s zoom-in-zoom-out alternate infinite';
        actionImg.style.animationDelay = '.3s';
        actionImg.onmousedown = e => e.preventDefault();
        actionImg.oncontextmenu = contextMenuCallback
        actionImg.onclick = roleImg.onclick = () => {
          App.server.send(PacketDataKeys.ROLE_ACTION, {
            [PacketDataKeys.PLAYER_OBJECT_ID]: uo,
            [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId,
            [PacketDataKeys.ROOM_MODEL_TYPE]: this.modelType
          });
          this.updatePlayersGame();
        }
        div.appendChild(actionImg);

        if(this.playersData[uo].autoClick && !this.playersData[uo].didAutoClick) {
          this.playersData[uo].didAutoClick = true;
          actionImg.click();
        }
      } else {
        roleImg.onclick = () => this.addNickToInput(username);
      }

      div.appendChild(nick);
      this.gamePlayersListElem.appendChild(div);
    }
  }

  addMessage(m: any, deleteFirst = false){
    const text = m[PacketDataKeys.TEXT];
    const type = m[PacketDataKeys.MESSAGE_TYPE] as number;
    const sticker = m[PacketDataKeys.MESSAGE_STICKER];
    const user = m[PacketDataKeys.USER];
    const objectId = m[PacketDataKeys.OBJECT_ID] ?? '';
    const playerObjectId = user ? user[PacketDataKeys.PLAYER_OBJECT_ID] : '';

    this.messages.push(m);

    if((user ? type != 2 && type != 3 && type != 13 && type != 24 && type != 25 : user) || type == 11 || type == 26 || type == 29){
      const username = user ? user[PacketDataKeys.USERNAME] : type == 26 ? 'Информатор' : type == 29 ? 'Бармен' : type == 11 ? 'Мафия' : '???';
      let msgText = text || '', color = 'black';
      if(type == 10 || type == 14) { msgText = `Голосует за [${text}]`; color = '#186400' }
      else if(type == 12) { color = `#545454` }
      else if(type == 28) { msgText = `Сдался`; color = '#940000' }
      else if(type == 18) { color = '#113B81' }
      else if(type == 19) { msgText = `ВЗОРВАЛ игрока [${text}]`; color = '#940000' }
      else if(type == 22) { msgText = `ВЗОРВАЛ игрока [${text}], но игрок был под защитой телохранителя и остался жив!`; color = '#940000' }
      if(this.lastMessage && this.lastMessage.divM && this.lastMessage.username == username){
        const msg = document.createElement('span');
        // @ts-ignore
        let cleanText = (users[objectId] == 'dev') ? msgText : noXSS(msgText);
        if(msgText.includes(`[${App.user.username}]`))
          cleanText = cleanText.replaceAll(`${App.user.username}`, `<span style="${App.settings.data.hideUsername ? 'filter: blur(5px)' : 'color: #ab1457; font-weight: bold'}">${App.user.username}</span>`);
        processEmojis(msg, cleanText);
        msg.style.color = color;
        msg.style.userSelect = 'text';
        this.lastMessage.divM.appendChild(msg);
      } else {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.textAlign = 'left';
        const avatar = document.createElement('img');
        getAvatarImg(user ?? username).then(e => avatar.src = e);
        avatar.style.borderRadius = '100%';
        avatar.width = 35;
        avatar.height = 35;
        avatar.style.margin = '5px';
        avatar.onmousedown = e => e.preventDefault();
        avatar.onclick = () => ProfileInfo(playerObjectId);
        const divM = document.createElement('div');
        divM.style.display = 'flex';
        divM.style.flexDirection = 'column';
        divM.style.justifyContent = 'center';
        divM.style.wordBreak = 'auto-phrase';
        const nick = document.createElement('span');
        if(this.isGame && App.settings.data.game.showIndexPlChat){
          const e = createElement('span', { text: ((this.playersData[objectId]?.index ?? 0) + 1) + ' ', css: { color: '#ab1457', fontWeight: 'bold' } })
          nick.appendChild(e);
        }
        createElement('span', { css: { marginLeft: '2px' }, text: user && user[PacketDataKeys.VIP] ? username + ` ${user[PacketDataKeys.VIP]}` : username, appendTo: nick });
        if(username == App.user.username && App.settings.data.hideUsername) nick.style.filter = 'blur(5px)';
        nick.style.color = type == 17 ? '#4B4483' : type == 12 ? '#545454' : 'black'
        nick.onclick = () => this.addNickToInput(username)
        const msg = document.createElement('span');
        // @ts-ignore
        let cleanText = (users[objectId] == 'dev') ? msgText : noXSS(msgText);
        if(msgText.includes(`[${App.user.username}]`))
          cleanText = cleanText.replaceAll(`${App.user.username}`, `<span style="${App.settings.data.hideUsername ? 'filter: blur(5px)' : 'color: #ab1457; font-weight: bold'}">${App.user.username}</span>`);
        processEmojis(msg, cleanText);
        msg.style.color = color
        msg.style.userSelect = 'text';
        div.appendChild(avatar);
        div.appendChild(divM);
        divM.appendChild(nick);
        divM.appendChild(msg);
        this.messagesElem.appendChild(div);
        this.lastMessage = { username, divM };
      }
    } else {
      const div = document.createElement('div');
      const username = user?.[PacketDataKeys.USERNAME];
      let msg = text, color = 'black', xssAllowed = false,
        nickElement = `<span style="${username == App.user.username && App.settings.data.hideUsername ? 'filter: blur(5px)' : ''}">${username}</span>`,
        nick1Element = text && text.split('#').length > 1 ? `<span style="${text.split('#')[0] == App.user.username && App.settings.data.hideUsername ? 'filter: blur(5px)' : ''}">${text.split('#')[0]}</span>` : '',
        nick2Element = text && text.split('#').length > 1 ? `<span style="${text.split('#')[2] == App.user.username && App.settings.data.hideUsername ? 'filter: blur(5px)' : ''}">${text.split('#')[2]}</span>` : '',
        nick3Element = m[PacketDataKeys.USERNAME] ? `<span style="${m[PacketDataKeys.USERNAME]["0"][PacketDataKeys.USERNAME] == App.user.username && App.settings.data.hideUsername ? 'filter: blur(5px)' : ''}">${m[PacketDataKeys.USERNAME]["0"][PacketDataKeys.USERNAME]}</span>` : '';
      if(type == 2) { msg = `Игрок ${nickElement} вошёл`; color = '#186400'; xssAllowed = true }
      else if(type == 3) { msg = `Игрок ${nickElement} вышел`; color = '#940000'; xssAllowed = true }
      else if(type == 4) { msg = `Игра началась` }
      else if(type == 7) { msg = `Наступила ночь [МАФИЯ в чате]`; color = '#113B81' }
      else if(type == 6) { msg = `[МАФИЯ выбирает жертву]`; color = '#113B81' }
      else if(type == 8) { msg = `Наступил день [Все общаются в чате]`; color = '#C46509' }
      else if(type == 9) { msg = `[Все голосуют] Выберите игрока, которого хотите казнить`; color = '#C46509' }
      else if(type == 13) { msg = `Игрок [${nickElement}] УБИТ!`; color = '#940000'; xssAllowed = true }
      else if(type == 15) { msg = `ВСЕ остались живы. Никого не удалось убить!`; color = '#186400' }
      else if(type == 16) { msg = `Игра окончена! МИРНЫЕ ЖИТЕЛИ победили!`; color = '#186400' }
      else if(type == 17) { msg = `Игра окончена! МАФИЯ победила!`; color = '#186400' }
      else if(type == 20) { msg = `СРОЧНАЯ НОВОСТЬ!\nЖурналист провел расследование и как оказалось игроки [${nick1Element}] и [${nick2Element}] играют в одной команде`; color = '#940000'; xssAllowed = true }
      else if(type == 21) { msg = `СРОЧНАЯ НОВОСТЬ!\nЖурналист провел расследование и как оказалось игроки [${nick1Element}] и [${nick2Element}] играют в разных командах`; color = '#940000'; xssAllowed = true }
      else if(type == 22) { msg = `ничья` }
      else if(type == 24) {
        // console.log(this.kicks);
        // console.log(typeof this.kicks[m[PacketDataKeys.USERNAME]["0"][PacketDataKeys.PLAYER_OBJECT_ID]] == 'number');
        msg = `[${nickElement}] начал голосование, чтобы выгнать игрока [${nick3Element}] из комнаты\n`;
        xssAllowed = true;
        color = '#113B81';
      }
      else if(type == 25) { msg = `Завершилось голосование. Выгнать игрока?\nРезультат голосования:\nДа: ${text.split('|')[0]} | Нет: ${text.split('|')[1]}`; color = '#113B81' }
      div.innerHTML = (xssAllowed ? msg : noXSS(msg)).replaceAll(`\n`,'<br/>');
      div.style.color = color;
      div.style.userSelect = 'text';
      div.style.margin = '3px'
      this.messagesElem.appendChild(div);
      this.lastMessage = {};

      // && typeof this.kicks[m[PacketDataKeys.USERNAME]["0"][PacketDataKeys.PLAYER_OBJECT_ID]] == 'number'
      if(type == 24 && m[PacketDataKeys.USERNAME]){
        const t = this.kicks[m[PacketDataKeys.USERNAME]["0"][PacketDataKeys.PLAYER_OBJECT_ID]] ?? 10;
        const timer = document.createElement('p');
        timer.style.margin = '5px';
        timer.textContent = `${t}`;
        div.appendChild(timer);
        const btnYes = document.createElement('button');
        btnYes.textContent = `Выгнать`;
        btnYes.onclick = () => {
          App.server.send(PacketDataKeys.KICK_USER_VOTE, {
            [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId,
            [PacketDataKeys.VOTE]: true
          });
          btnYes.disabled = true;
          btnNo.disabled = true;
        }
        div.appendChild(btnYes);
        const btnNo = document.createElement('button');
        btnNo.textContent = `Не выгонять`;
        btnNo.onclick = () => {
          App.server.send(PacketDataKeys.KICK_USER_VOTE, {
            [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId,
            [PacketDataKeys.VOTE]: false
          });
          btnYes.disabled = true;
          btnNo.disabled = true;
        }
        div.appendChild(btnNo);

        this.on('message', data => {
          if(data[PacketDataKeys.TYPE] == PacketDataKeys.KICK_TIMER){
            const t = data[PacketDataKeys.TIMER];
            timer.textContent = t;
            if(t < 1){
              delete this.kicks[m[PacketDataKeys.USERNAME][0][PacketDataKeys.PLAYER_OBJECT_ID]];
              this.removeByKey('kick');
            }
          }
        }).key('kick');
      }

      if(type == 2 || type == 3){
        if(this.joinLeaveMessages[username])
          this.joinLeaveMessages[username].remove();
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

    App.server.send(PacketDataKeys.ROOM_MESSAGE_CREATE, {
      [PacketDataKeys.MESSAGE]: {
        [PacketDataKeys.MESSAGE_STYLE]: options.messageStyle ?? 0,
        [PacketDataKeys.MESSAGE_STICKER]: options.messageSticker ?? false,
        [PacketDataKeys.TEXT]: message
      },
      [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId,
      [PacketDataKeys.ROOM_MODEL_TYPE]: this.modelType
    });

    this.messagesElem.scroll({ top: this.messagesElem.scrollHeight, behavior: 'smooth' });
  }

  updatePlayersWaiting(players: any[]){
    if(this.status == 4 || this.status == 3) return;
    this.usersWaiting = players.map(e => e[PacketDataKeys.OBJECT_ID]);
    this.titleElem.textContent = `${this.title} ${players.length} [${this.minPlayers}/${this.maxPlayers}]`;
    this.gamePlayersListElem.innerHTML = '';
    for(let i = 0; i < players.length; i++){
      const player = players[i];
      // console.log('players', player);
      const uo = player[PacketDataKeys.OBJECT_ID]
      const playerUser = player[PacketDataKeys.PLAYER_USER];
      const playerObjectId = playerUser[PacketDataKeys.PLAYER_OBJECT_ID];
      const username = playerUser[PacketDataKeys.USERNAME];
      const div = document.createElement('div');
      const avatar = document.createElement('img');
      getAvatarImg(playerUser).then(e => avatar.src = e);
      avatar.style.borderRadius = '100%'
      avatar.width = avatar.height = 25;
      avatar.style.margin = '5px';
      avatar.onmousedown = e => e.preventDefault();
      avatar.onclick = () => ProfileInfo(playerObjectId);
      const nick = document.createElement('span');
      // if(playerUser[PacketDataKeys.VIP]) {
        // const img = createElement('img', { width: 20, height: 20, css: { verticalAlign: 'text-bottom' } });
        // getTexture(`vip/0M.png`).then(e => img.src = e);
        // nick.appendChild(img);
      // }
      createElement('span', { css: { marginLeft: '2px' }, text: playerUser[PacketDataKeys.VIP] ? username + ` ${playerUser[PacketDataKeys.VIP]}` : username, appendTo: nick });
      if(username == App.user.username && App.settings.data.hideUsername) nick.style.filter = 'blur(5px)';
      nick.className = 'black';
      nick.onclick = () => this.addNickToInput(username);
      div.style.display = 'flex';
      div.style.textAlign = 'left';
      div.style.alignItems = 'center';
      div.appendChild(avatar);
      div.appendChild(nick);
      this.gamePlayersListElem.appendChild(div);
    }
  }
  
  getPlayer(arg: string){
    const pl = this.players.find(e => arg == e[PacketDataKeys.USER][PacketDataKeys.USERNAME]) || this.players[parseInt(arg)];
    return pl;
  }

  destroy() {
    App.server.send(PacketDataKeys.REMOVE_PLAYER, {
      [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId,
    });
    super.destroy();
  }
}
