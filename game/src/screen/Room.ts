import App from "../App";
import { MessageStyle, Role, RuRoles } from "../enums";
import PacketDataKeys from "../../../core/src/PacketDataKeys";
import Screen from "./Screen";
import { insertAtCaret } from '../../../core/src/utils/DOM'
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

export function isMafia(role: Role): boolean {
    return [Role.MAFIA, Role.BARMAN, Role.TERRORIST, Role.INFORMER].includes(role);
}

export default class Room extends Screen {
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
    input!: HTMLInputElement

    meElem?: HTMLElement
    yourRoleElem?: HTMLSpanElement
    deadImgElem?: HTMLImageElement
    myVoteElem?: HTMLDivElement
    affectedByRolesElem?: HTMLDivElement
    
    localAffectedByRoles: Role[] = [];
    
    clearMessages = true

    modelType = 0;
    title = 'Комната';
    maxPlayers = 8
    minPlayers = 1
    minLevel = 1;
    isVipEnabled = false
    selectedRoles: Role[] = [];
    status = 0; // 0 - регистрация, 2 - игра
    get isGame() { return this.status == 2; }
    gameDayTime = 0;
    timer = 0;
    playersStat: any

    oldAppSettingsData: any;

    usersWaiting: string[] = [];
    playersData: Record<string, {
        index?: number
        username?: string
        alive?: boolean
        userObjectId?: string
        role?: number
        affectedByRoles?: Role[]
        isDayActionUsed?: boolean
        isNightActionAlternative?: boolean
        isNightActionUsed?: boolean
        autoClick?: boolean
        didAutoClick?: boolean
        vote?: number
    }> = {}
    players: any[] = [];
    joinLeaveMessages: Record<string, HTMLElement> = {};
    lastMessage!: {
        username?: any,
        divM?: HTMLElement
    }

    constructor(public roomObjectId: string, public options: {
        password?: string
        sendRoomEnter?: boolean
    } = {}){
        super('Room');

        if(typeof options.sendRoomEnter != 'boolean') options.sendRoomEnter = true;

        App.title = 'Комната';

        this.oldAppSettingsData = JSON.parse(JSON.stringify(App.settings.data));
        
        (async()=> this.element.style.background = `url(${await getBackgroundImg('day3')}) 0% 0% / cover`)();
        
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
            App.screen = new Rooms();
        });

        this.init();
    }

    tick(dt: number){
        if(dt % 2 < 1) return;
        if(this.loadingElem)
            this.loadingElem.style.transform = `rotateZ(${this.rotation % 360}deg)`
        this.rotation+=30;
    }
    
    async init(){
        if(this.options.sendRoomEnter) App.server.send(PacketDataKeys.ROOM_ENTER, {
            [PacketDataKeys.ROOM_PASS]: this.options.password ? md5salt(this.options.password) : '',
            [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId
        });
        const rData = await App.server.awaitPacket([PacketDataKeys.ROOM_ENTER, PacketDataKeys.ROOM_PASSWORD_IS_WRONG_ERROR, PacketDataKeys.GAME_STARTED, PacketDataKeys.USER_IN_ANOTHER_ROOM, PacketDataKeys.USER_USING_DOUBLE_ACCOUNT, PacketDataKeys.USER_LEVEL_NOT_ENOUGH, PacketDataKeys.USER_KICKED, PacketDataKeys.ROOM_CREATED], 2000);
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
        } else if(rData[PacketDataKeys.TYPE] == PacketDataKeys.USER_USING_DOUBLE_ACCOUNT){
            App.screen = new Rooms();
            MessageBox(`В данной комнате уже есть игрок, который подключен к тому же интернет подключению, что и вы

Вероятно вы и этот игрок используете общую точку доступа к сети интернет

Если вы хотите играть с данным игроком в одной комнате - создайте комнату с паролем или убедитесь, что вы подключены каждый к своей точке доступа или мобильным данным`, { height: 360 });
            return;
        } else if(rData[PacketDataKeys.TYPE] == PacketDataKeys.USER_LEVEL_NOT_ENOUGH){
            App.screen = new Rooms();
            MessageBox('Ваш уровень маленький');
            return;
        } else if(rData[PacketDataKeys.TYPE] == PacketDataKeys.USER_KICKED){
            App.screen = new Rooms();
            MessageBox('Вас выгнали');
            return;
        }
        const roomData = rData[PacketDataKeys.ROOM];
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
        App.server.send(PacketDataKeys.CREATE_PLAYER, {
            [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
            [PacketDataKeys.TOKEN]: App.user.token,
            [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId,
            [PacketDataKeys.ROOM_MODEL_TYPE]: 0
        });
        const data = await App.server.awaitPacket(PacketDataKeys.ROOM_STATISTICS);
        this.loadingDivElem.remove();
        
        this.on('message', data => {
            if(data[PacketDataKeys.TYPE] == PacketDataKeys.MESSAGE){
                this.addMessage(data[PacketDataKeys.MESSAGE]);
            } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.USERS && !this.isGame){
                this.updatePlayersWaiting(data[PacketDataKeys.USERS]);
            } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.ADD_PLAYER && !this.isGame){
                this.players.push(data[PacketDataKeys.PLAYER]);
                this.updatePlayersWaiting(this.players);
            } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.REMOVE_PLAYER && !this.isGame){
                this.players.splice(this.players.findIndex(e => e[PacketDataKeys.USER][PacketDataKeys.USER_OBJECT_ID] == data[PacketDataKeys.USER_OBJECT_ID]), 1);
                this.updatePlayersWaiting(this.players);
            } else if(typeof data[PacketDataKeys.TIMER] == 'number' && typeof data[PacketDataKeys.TYPE] == 'undefined' && !this.isGame){
                this.infoElem.textContent = noXSS(`Игра начнётся через ${data[PacketDataKeys.TIMER]}`);
            } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.PLAYERS_STAT){
                this.playersStat = data;
            } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.ROOM_STATISTICS){
                if(data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.PLAYERS]) {
                    let i = 0;
                    for(const pl of data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.PLAYERS]){
                        const u = pl[PacketDataKeys.USER];
                        const uo = u[PacketDataKeys.OBJECT_ID];
                        const username = u[PacketDataKeys.USERNAME];
                        if(!this.playersData[uo]) this.playersData[uo] = {};
                        this.playersData[uo].index = i;
                        this.playersData[uo].username = username;
                        i++;
                    }
                }
                if(data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.PLAYERS_DATA]) {
                    for(const pl of data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.PLAYERS_DATA]){
                        const uo = pl[PacketDataKeys.USER_OBJECT_ID];
                        if(!this.playersData[uo]) this.playersData[uo] = {};
                        this.playersData[uo].affectedByRoles = pl[PacketDataKeys.AFFECTED_BY_ROLES];
                        if(typeof pl[PacketDataKeys.ALIVE] == 'boolean') this.playersData[uo].alive = pl[PacketDataKeys.ALIVE];
                        this.playersData[uo].isDayActionUsed = pl[PacketDataKeys.IS_DAY_ACTION_USED];
                        this.playersData[uo].isNightActionAlternative = pl[PacketDataKeys.IS_NIGHT_ACTION_ALTERNATIVE];
                        this.playersData[uo].isNightActionUsed = pl[PacketDataKeys.IS_NIGHT_ACTION_USED];
                        if(typeof pl[PacketDataKeys.ROLE] == 'number') this.playersData[uo].role = pl[PacketDataKeys.ROLE];
                        if(typeof pl[PacketDataKeys.VOTE] == 'number') this.playersData[uo].vote = pl[PacketDataKeys.VOTE];
                        this.playersData[uo].userObjectId = uo;
                    }
                    this.updatePlayersGame();
                }
                this.status = data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.GAME_STATUS][PacketDataKeys.STATUS];
                this.timer = data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.GAME_STATUS][PacketDataKeys.TIMER];
                if(this.isGame) {
                    if(this.clearMessages){
                        this.lastMessage = {}
                        this.messagesElem.innerHTML = '';
                    }
                    for(const m of data[PacketDataKeys.ROOM_STATISTICS][PacketDataKeys.MESSAGES]) this.addMessage(m, false);
                    this.initGame();
                    if(this.status == 3)
                        this.updatePlayersGame();
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
            }
        });

        const rolesElem = document.createElement('div');
        rolesElem.style.display = 'flex';
        rolesElem.style.width = '100%';
        rolesElem.style.marginRight = '10px';
        rolesElem.style.flexDirection = 'row-reverse';
        rolesElem.style.alignItems = 'center';
        for(const r of this.selectedRoles){
            const img = document.createElement('img');
            img.src = await getRoleImg(r);
            img.width = 25;
            img.height = 35;
            img.onmousedown = e => e.preventDefault();
            rolesElem.appendChild(img);
        }
        this.headerElem.appendChild(rolesElem);

        App.title = `Комната: ${this.title}`;
        this.titleElem.innerHTML = noXSS(this.title);

        this.infoElem = document.createElement('div');
        this.infoElem.className = 'black';
        this.infoElem.style.textAlign = 'center';
        this.infoElem.style.margin = '5px 0';
        this.infoElem.innerHTML = `Загрузка комнаты..`
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

        this.gameInfoElem = document.createElement('div');
        this.gameInfoElem.style.height = '125px';
        this.gameInfoElem.style.margin = '5px 10px';
        this.gameInfoElem.style.outline = '2px solid #c0c0c0';
        this.gameInfoElem.style.borderRadius = '3px';
        this.gameInfoElem.style.background = 'rgba(255,255,255,.5)';
        this.gameInfoElem.style.display = 'none';
        // this.gameInfo.style.flexWrap = 'wrap';
        // this.gameInfo.style.flexDirection = 'column';
        this.element.appendChild(this.gameInfoElem);

        this.messagesElem = document.createElement('div');
        this.messagesElem.style.height = (App.height - (isMobile() ? 285 : 265)) + 'px';
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
        
        const rs = data[PacketDataKeys.ROOM_STATISTICS];
        for(const m of rs[PacketDataKeys.MESSAGES]) {
            wait(50).then(() => this.addMessage(m, false));
        }
        this.players = rs[PacketDataKeys.PLAYERS];
        this.titleElem.textContent = `${this.title} (${this.players.length}/${this.maxPlayers})`;
        if(rs[PacketDataKeys.GAME_STATUS]){
            this.infoElem.innerHTML = `Запуск игры..`
            this.status = rs[PacketDataKeys.GAME_STATUS][PacketDataKeys.STATUS];
            this.gameDayTime = rs[PacketDataKeys.GAME_STATUS][PacketDataKeys.DAYTIME];
            this.timer = rs[PacketDataKeys.GAME_STATUS][PacketDataKeys.TIMER];
            if(rs[PacketDataKeys.PLAYERS_DATA]) {
                let i = 0;
                for(const pl of rs[PacketDataKeys.PLAYERS_DATA]){
                    this.playersData[pl[PacketDataKeys.USER_OBJECT_ID]] = {
                        index: i,
                        alive: pl[PacketDataKeys.ALIVE] ?? true,
                        affectedByRoles: pl[PacketDataKeys.AFFECTED_BY_ROLES] ?? [],
                        isDayActionUsed: pl[PacketDataKeys.IS_DAY_ACTION_USED],
                        isNightActionAlternative: pl[PacketDataKeys.IS_NIGHT_ACTION_ALTERNATIVE],
                        isNightActionUsed: pl[PacketDataKeys.IS_NIGHT_ACTION_USED],
                        userObjectId: pl[PacketDataKeys.USER_OBJECT_ID],
                        role: pl[PacketDataKeys.ROLE],
                        vote: pl[PacketDataKeys.VOTE] ?? 0
                    }
                    i++;
                }
            }
            if(rs[PacketDataKeys.PLAYERS]) {
                for(const pl of rs[PacketDataKeys.PLAYERS]){
                    const u = pl[PacketDataKeys.USER];
                    const uo = u[PacketDataKeys.OBJECT_ID];
                    const username = u[PacketDataKeys.USERNAME];
                    if(!this.playersData[uo]) this.playersData[uo] = {};
                    this.playersData[uo].username = username;
                }
            }
        } else {
            this.infoElem.innerHTML = `Регистрация`
            this.updatePlayersWaiting(rs[PacketDataKeys.PLAYERS]);
        }

        const footer = document.createElement('div');
        footer.style.width = '100%';
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
        
        this.on('resize', () => {
            this.messagesElem.style.height = (App.height - (isMobile() ? 285 : 265)) + 'px';
        }).key('waiting');
        
        if(this.isGame) this.initGame();

        this.messagesElem.scrollTop = this.messagesElem.scrollHeight;
    }

    async initGame(){
        this.element.removeChild(this.infoElem);
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
        this.resizablePLElem.style.height = (App.height - (isMobile() ? 100 : 80)) + 'px';
        this.messagesElem.style.height = (App.height - (isMobile() ? 235 : 215)) + 'px';
        
        this.changeDayTime();

        this.on('resize', () => {
            this.playersListElem.style.height = (App.height - (isMobile() ? 100 : 80)) + 'px';
            this.resizablePLElem.style.height = (App.height - (isMobile() ? 100 : 80)) + 'px';
            this.messagesElem.style.height = (App.height - (isMobile() ? 235 : 215)) + 'px';
        });

        const yourRoleMsg = `Вы<br/>${RuRoles[this.playersData[App.user.objectId].role??0]}`;
        let timer: HTMLDivElement, mafia: HTMLDivElement, mir: HTMLDivElement, giveUpButton: HTMLButtonElement;
        {
            this.gameInfoElem.style.display = 'flex';
            { // me
                const nick = document.createElement('span');
                const myRoleImg = document.createElement('img');
                this.deadImgElem = document.createElement('img');
                this.deadImgElem.src = await getTexture(`roles/dead.png`);
                this.deadImgElem.width = 50;
                this.deadImgElem.height = 70;
                this.deadImgElem.style.display = 'none';
                this.deadImgElem.style.position = 'absolute';
                // this.deadImg.style.left = '2px';
                this.deadImgElem.style.top = '56px';
                this.deadImgElem.onmousedown = e => e.preventDefault();
                this.myVoteElem = document.createElement('div');
                this.myVoteElem.style.background = 'red';
                this.myVoteElem.style.color = 'white';
                this.myVoteElem.style.padding = '3px'
                this.myVoteElem.style.position = 'absolute';
                this.myVoteElem.style.right = '5px';
                this.myVoteElem.style.bottom = '20px';
                this.myVoteElem.style.borderRadius = '3px';
                this.myVoteElem.style.display = 'none';
                this.affectedByRolesElem = document.createElement('div');
                this.affectedByRolesElem.style.width = '125px';
                this.affectedByRolesElem.style.height = '100%';
                this.affectedByRolesElem.style.marginLeft = '5px';
                this.affectedByRolesElem.style.display = 'flex';
                this.affectedByRolesElem.style.alignItems = 'center';
                this.affectedByRolesElem.style.justifyContent = 'flex-start';
                this.affectedByRolesElem.style.flexWrap = 'wrap';
                this.affectedByRolesElem.style.alignContent = 'center';
                this.meElem = document.createElement('div');
                this.meElem.style.position = 'relative';
                this.meElem.style.display = 'flex';
                this.meElem.style.flexDirection = 'column';
                this.meElem.style.justifyContent = 'center';
                this.meElem.style.alignItems = 'center';
                this.meElem.style.padding = '0 5px';
                this.yourRoleElem = document.createElement('span');
                this.yourRoleElem.innerHTML = yourRoleMsg;
                this.yourRoleElem.className = 'black';
                this.yourRoleElem.style.fontSize = 'smaller';
                this.yourRoleElem.style.textAlign = 'center';
                this.yourRoleElem.style.padding = '1px';
                nick.textContent = noXSS(App.user.username);
                nick.className = 'black';
                nick.style.fontSize = 'smaller';
                nick.style.textAlign = 'center';
                nick.style.padding = '1px';
                myRoleImg.src = await getRoleImg(this.playersData[App.user.objectId].role ?? 1);
                myRoleImg.width = 50;
                myRoleImg.height = 70;
                myRoleImg.onmousedown = e => e.preventDefault();
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
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.alignItems = 'flex-end';
                div.style.flexDirection = 'column';
                div.style.padding = '8px';
                div.style.width = '100%';
                mafia = document.createElement('div');
                mafia.textContent = noXSS(`Мафия: ${playersStat[PacketDataKeys.MAFIA_ALL]} | ${playersStat[PacketDataKeys.MAFIA_ALIVE]}`);
                mafia.style.color = '#940000';
                mir = document.createElement('div');
                mir.textContent = noXSS(`Мирные: ${playersStat[PacketDataKeys.CIVILIAN_ALL]} | ${playersStat[PacketDataKeys.CIVILIAN_ALIVE]}`);
                mir.style.color = '#186400';
                timer = document.createElement('div');
                timer.textContent = noXSS(this.timer+'');
                timer.className = 'black';
                timer.style.float = 'right';
                timer.style.fontSize = '35px';
                timer.style.fontWeight = 'bold';
                timer.style.marginTop = '15px';
                timer.style.padding = '5px';
                giveUpButton = document.createElement('button');
                giveUpButton.textContent = 'Сдаться';
                giveUpButton.style.marginTop = '-5px';
                giveUpButton.style.display = 'none';
                {
                    const role = this.playersData[App.user.objectId].role ?? 1;
                    if(this.playersData[App.user.objectId].alive && ((playersStat[PacketDataKeys.MAFIA_ALIVE] == 1 && isMafia(role)) || (playersStat[PacketDataKeys.CIVILIAN_ALIVE] == 1 && !isMafia(role)))) {
                        timer.style.marginTop = '0';
                        giveUpButton.style.display = 'block';
                    }
                }
                giveUpButton.onclick = () => App.server.send(PacketDataKeys.GIVE_UP, { [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId });
                div.appendChild(mafia);
                div.appendChild(mir);
                div.appendChild(timer);
                div.appendChild(giveUpButton);
                this.gameInfoElem.appendChild(div);
            }
        }

        if(!this.playersData[App.user.objectId].alive){
            this.deadImgElem.style.top = (this.yourRoleElem.clientHeight + 1)+'px';
            this.deadImgElem.style.display = 'flex';
        }

        this.on('message', data => {
            if(!this.isGame) return;
            if(data[PacketDataKeys.TYPE] == PacketDataKeys.GAME_DAYTIME){
                this.gameDayTime = data[PacketDataKeys.DAYTIME];
                timer.textContent = noXSS(data[PacketDataKeys.TIMER]);
                this.changeDayTime();
                this.updatePlayersGame()
            } else if(typeof data[PacketDataKeys.TIMER] == 'number'){
                this.timer = data[PacketDataKeys.TIMER];
                timer.textContent = noXSS(data[PacketDataKeys.TIMER]);
            } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.PLAYERS_STAT){
                mafia.textContent = noXSS(`Мафия: ${data[PacketDataKeys.MAFIA_ALL]} | ${data[PacketDataKeys.MAFIA_ALIVE]}`);
                mir.textContent = noXSS(`Мирные: ${data[PacketDataKeys.CIVILIAN_ALL]} | ${data[PacketDataKeys.CIVILIAN_ALIVE]}`);

                const role = this.playersData[App.user.objectId].role ?? 1;
                if(this.playersData[App.user.objectId].alive && ((data[PacketDataKeys.MAFIA_ALIVE] == 1 && isMafia(role)) || (data[PacketDataKeys.CIVILIAN_ALIVE] == 1 && !isMafia(role)))) {
                    giveUpButton.style.display = 'block';
                    timer.style.marginTop = '0';
                }
            } else if(data[PacketDataKeys.TYPE] == PacketDataKeys.USER_DATA){
                for(const p in data[PacketDataKeys.PLAYERS_DATA]) {
                    const pl = data[PacketDataKeys.PLAYERS_DATA][p];
                    const uo = pl[PacketDataKeys.USER_OBJECT_ID];

                    if(pl[PacketDataKeys.AFFECTED_BY_ROLES]) this.playersData[uo].affectedByRoles = pl[PacketDataKeys.AFFECTED_BY_ROLES];
                    if(typeof pl[PacketDataKeys.ALIVE] == 'boolean') this.playersData[uo].alive = pl[PacketDataKeys.ALIVE];
                    if(typeof pl[PacketDataKeys.IS_DAY_ACTION_USED] == 'boolean') this.playersData[uo].isDayActionUsed = pl[PacketDataKeys.IS_DAY_ACTION_USED];
                    if(typeof pl[PacketDataKeys.IS_NIGHT_ACTION_ALTERNATIVE] == 'boolean') this.playersData[uo].isNightActionAlternative = pl[PacketDataKeys.IS_NIGHT_ACTION_ALTERNATIVE];
                    if(typeof pl[PacketDataKeys.IS_NIGHT_ACTION_USED] == 'boolean') this.playersData[uo].isNightActionUsed = pl[PacketDataKeys.IS_NIGHT_ACTION_USED];
                    if(typeof pl[PacketDataKeys.ROLE] == 'number') this.playersData[uo].role = pl[PacketDataKeys.ROLE];
                    if(typeof pl[PacketDataKeys.VOTE] == 'number') this.playersData[uo].vote = pl[PacketDataKeys.VOTE];

                    if(data[PacketDataKeys.PLAYERS_DATA].length == 1 && uo != App.user.objectId) {
                        if(typeof pl[PacketDataKeys.VOTE] != 'number') this.playersData[uo].vote = (this.playersData[uo].vote ?? 0) + 1;
                    }
                }

                this.updatePlayersGame();
            }
        });

        this.updatePlayersGame();
    }

    async changeDayTime(){
        if(this.gameDayTime < 2) {
            this.element.style.background = `url(${await getBackgroundImg('night')}) 0% 0% / cover`;
            
            this.playersListElem.style.outline = '2px solid rgb(128 128 128)';
            this.playersListElem.style.background = 'rgb(255 255 255 / 50%)';

            this.gameInfoElem.style.outline = '2px solid rgb(128 128 128)';
            this.gameInfoElem.style.background = 'rgb(255 255 255 / 50%)';

            this.messagesElem.style.outline = '2px solid rgb(128 128 128)';
            this.messagesElem.style.background = 'rgb(255 255 255 / 50%)'
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
            if(App.user.objectId == pl.userObjectId) {
                if(this.deadImgElem && this.deadImgElem.style.display == 'none' && this.yourRoleElem && pl.alive == false) {
                    this.deadImgElem.style.top = (this.yourRoleElem.clientHeight + 1)+'px';
                    this.deadImgElem.style.display = 'flex';
                    MessageBox(`Вы умерли`);
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
                const cx = new ContextMenu(self.playersData[uo].alive ?
                    ['Пользователь', `${self.playersData[uo].autoClick ? '✅ ' : ''}Авто-клик`] :
                    ['Пользователь']
                , event);
                const result = await cx.waitForResult();
                if(result == `${self.playersData[uo].autoClick ? '✅ ' : ''}Авто-клик`){
                    self.playersData[uo].autoClick = !self.playersData[uo].autoClick;
                    self.playersData[uo].didAutoClick = false;
                } else if(result == 'Пользователь'){
                    ProfileInfo(uo);
                }
            }

            const username = this.playersData[uo].username ?? '?';
            const div = document.createElement('div');
            div.style.margin = '2px';
            div.style.width = '50px';
            div.style.textAlign = 'center';
            div.style.position = 'relative';
            div.style.height = '100px';
            const nick = document.createElement('div');
            nick.textContent = noXSS(username);
            nick.className = 'black';
            nick.style.wordBreak = 'break-all';
            nick.style.textAlign = 'center';
            nick.style.fontSize = '12px';
            nick.style.marginTop = '-2px';
            const roleImg = document.createElement('img');
            getRoleImg(pl.role ?? 0).then(e => roleImg.src = e);
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
            let isActionUsed = this.gameDayTime < 2 ? this.playersData[App.user.objectId].isNightActionUsed : this.playersData[App.user.objectId].isDayActionUsed
            when(this.playersData[App.user.objectId].role)
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
                    if(this.playersData[App.user.objectId].isNightActionUsed) action = '';
                })())
                .case(Role.BARMAN, () => this.gameDayTime == 1 && (() => { action = '_9' })())
                .case(Role.INFORMER, () => this.gameDayTime == 1 && (() => {
                    action = 'check';
                    if(this.playersData[uo].affectedByRoles?.includes(11)) action = '';
                })());
            if(action == '' && this.gameDayTime == 3) action = 'kill';
            if(this.gameDayTime == 1 && this.playersData[App.user.objectId].affectedByRoles?.includes(9) && !isActionUsed) isActionUsed = true;
            if(action != '' && this.status != 3 && !isActionUsed && this.playersData[App.user.objectId].alive && this.playersData[uo].alive){
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
                        [PacketDataKeys.USER_OBJECT_ID]: uo,
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
        const text = m[PacketDataKeys.TEXT] as string;
        const type = m[PacketDataKeys.MESSAGE_TYPE] as number;
        const sticker = m[PacketDataKeys.MESSAGE_STICKER];
        const user = m[PacketDataKeys.USER];
        const objectId = user ? user[PacketDataKeys.OBJECT_ID] : '';

        if(user || type == 10 || type == 25 || type == 26){
            const username = user ? user[PacketDataKeys.USERNAME] : type == 25 || type == 26 ? 'Информатор' : type == 10 ? 'Мафия' : '???';
            let msgText = text, color = 'black';
            if(type == 9 || type == 13 || type == 26) { msgText = `Голосует за [${text}]`; color = '#186400' }
            else if(type == 11) { color = `#545454` }
            else if(type == 17) { color = '#113B81' }
            else if(type == 18) { msgText = `ВЗОРВАЛ игрока [${text}]`; color = '#940000' }
            else if(type == 21) { msgText = `ВЗОРВАЛ игрока [${text}], но игрок был под защитой телохранителя и остался жив!`; color = '#940000' }
            else if(type == 27) { msgText = `Сдался`; color = '#940000' };
            if(this.lastMessage && this.lastMessage.divM && this.lastMessage.username == username){
                const msg = document.createElement('span');
                // @ts-ignore
                msg.innerHTML = users[objectId] == 'dev' ? msgText : noXSS(msgText);
                msg.style.color = color;
                msg.style.userSelect = 'text';
                this.lastMessage.divM.appendChild(msg);
            } else {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.textAlign = 'left';
                const avatar = document.createElement('img');
                getAvatarImg(user).then(e => avatar.src = e);
                avatar.style.borderRadius = '100%';
                avatar.width = 35;
                avatar.height = 35;
                avatar.style.margin = '5px';
                avatar.onmousedown = e => e.preventDefault();
                avatar.onclick = () => ProfileInfo(objectId);
                const divM = document.createElement('div');
                divM.style.display = 'flex';
                divM.style.flexDirection = 'column';
                divM.style.justifyContent = 'center';
                divM.style.wordBreak = 'auto-phrase';
                const nick = document.createElement('span');
                nick.textContent = noXSS(username);
                nick.style.color = type == 17 ? '#4B4483' : type == 11 ? '#545454' : 'black'
                nick.onclick = () => this.addNickToInput(username)
                const msg = document.createElement('span');
                // @ts-ignore
                msg.innerHTML = users[objectId] == 'dev' ? msgText : noXSS(msgText);
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
            let msg = text, color = 'black', xssAllowed = false;
            if(type == 2) { msg = `Игрок ${text} вошёл`; color = '#186400' }
            else if(type == 3) { msg = `Игрок ${text} вышел`; color = '#940000' }
            else if(type == 4) { msg = `Игра началась` }
            else if(type == 5) { msg = `Наступила ночь [МАФИЯ в чате]`; color = '#113B81' }
            else if(type == 6) { msg = `[МАФИЯ выбирает жертву]`; color = '#113B81' }
            else if(type == 7) { msg = `Наступил день [Все общаются в чате]`; color = '#C46509' }
            else if(type == 8) { msg = `[Все голосуют] Выберите игрока, которого хотите казнить`; color = '#C46509' }
            else if(type == 12) { msg = `Игрок [${text}] УБИТ!`; color = '#940000' }
            else if(type == 14) { msg = `ВСЕ остались живы. Никого не удалось убить!`; color = '#186400' }
            else if(type == 15) { msg = `Игра окончена! МИРНЫЕ ЖИТЕЛИ победили!`; color = '#186400' }
            else if(type == 16) { msg = `Игра окончена! МАФИЯ победила!`; color = '#186400' }
            else if(type == 19) { msg = `СРОЧНАЯ НОВОСТЬ!\nЖурналист провел расследование и как оказалось игроки [${text.split('#')[0]}] и [${text.split('#')[2]}] играют в одной команде`; color = '#940000' }
            else if(type == 20) { msg = `СРОЧНАЯ НОВОСТЬ!\nЖурналист провел расследование и как оказалось игроки [${text.split('#')[0]}] и [${text.split('#')[2]}] играют в разных командах`; color = '#940000' }
            else if(type == 22) { msg = `ничья` }
            else if(type == 23) {
                msg = `[${text.split('#')[0]}] начал голосование, чтобы выгнать игрока [${text.split('#')[2]}] из комнаты\n`;
                xssAllowed = true;
                color = '#113B81';
            }
            else if(type == 24) { msg = `Завершилось голосование. Выгнать игрока?\nРезультат голосования:\nДа: ${text.split('|')[0]} | Нет: ${text.split('|')[1]}`; color = '#113B81' }
            div.innerHTML = (xssAllowed ? msg : noXSS(msg)).replaceAll(`\n`,'<br/>');
            div.style.color = color;
            div.style.userSelect = 'text';
            div.style.margin = '3px'
            this.messagesElem.appendChild(div);
            this.lastMessage = {};

            if(type == 23){
                const timer = document.createElement('p');
                timer.style.margin = '5px';
                timer.textContent = `10`;
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
                        [PacketDataKeys.VOTE]: true
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
                            this.removeByKey('kick');
                        }
                    }
                }).key('kick');
            }

            if(type == 2 || type == 3){
                if(this.joinLeaveMessages[text])
                    this.joinLeaveMessages[text].remove();
                this.joinLeaveMessages[text] = div;
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
        this.usersWaiting = players.map(e => e[PacketDataKeys.USER][PacketDataKeys.OBJECT_ID]);
        this.titleElem.textContent = `${this.title} (${players.length}/${this.maxPlayers})`;
        this.gamePlayersListElem.innerHTML = '';
        for(let i = 0; i < players.length; i++){
            const player = players[i];
            const user = player[PacketDataKeys.USER];
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
            nick.className = 'black';
            nick.onclick = () => this.addNickToInput(user[PacketDataKeys.USERNAME]);
            div.style.display = 'flex';
            div.style.textAlign = 'left';
            div.style.alignItems = 'center';
            div.appendChild(avatar);
            div.appendChild(nick);
            this.gamePlayersListElem.appendChild(div);
        }
    }

    destroy() {
        App.server.send(PacketDataKeys.REMOVE_PLAYER, {
            [PacketDataKeys.ROOM_OBJECT_ID]: this.roomObjectId,
        });
        super.destroy();
    }
}