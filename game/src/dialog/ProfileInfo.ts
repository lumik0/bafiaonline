import App from '../App';
import { Role } from '../enums';
import PacketDataKeys from "../../../core/src/PacketDataKeys";
import Box from './Box';
import fs from '../../../core/src/fs/fs';
import { getAvatarImg } from '../utils/Resources';
import { getZoom, wait } from '../../../core/src/utils/utils';
import Rooms from '../screen/Rooms';
import { formatDate } from '../../../core/src/utils/format';

function calculateStatsWithRoles(profile: any) {
    const mafiaRoles = [Role.MAFIA, Role.TERRORIST, Role.BARMAN, Role.INFORMER];
    const peacefulRoles = [Role.CIVILIAN, Role.DOCTOR, Role.SHERIFF, Role.LOVER, Role.JOURNALIST, Role.BODYGUARD, Role.SPY];
    
    let gamesAsMafia = 0;
    let gamesAsPeaceful = 0;
    
    mafiaRoles.forEach(roleId => {
        gamesAsMafia += profile.roleStats[roleId] || 0;
    });
    
    peacefulRoles.forEach(roleId => {
        gamesAsPeaceful += profile.roleStats[roleId] || 0;
    });
    
    const totalGamesFromRoles = gamesAsMafia + gamesAsPeaceful;
    const totalWins = profile.winsAsPeaceful + profile.winsAsMafia;
    
    const overallWinRate = (totalWins * 100 / profile.playedGames).toFixed(2);
    
    const mafiaWinRatePercentOfTotalWins = (profile.winsAsMafia * 100 / totalWins).toFixed(1);
    const peacefulWinRatePercentOfTotalWins = (profile.winsAsPeaceful * 100 / totalWins).toFixed(1);
    
    const mafiaWinRatePercentOfGamesAsMafia = gamesAsMafia > 0 ? Math.round(profile.winsAsMafia * 100 / gamesAsMafia) : 0;
    const peacefulWinRatePercentOfGamesAsPeaceful = gamesAsPeaceful > 0 ? Math.round(profile.winsAsPeaceful * 100 / gamesAsPeaceful) : 0;
    
    return {
        totalWins: `(${overallWinRate}%) ${totalWins}`,
        winsAsMafia: `(${mafiaWinRatePercentOfTotalWins}%) ${profile.winsAsMafia}`,
        winsAsPeaceful: `(${peacefulWinRatePercentOfTotalWins}%) ${profile.winsAsPeaceful}`,
        
        gamesAsMafia,
        gamesAsPeaceful,
        mafiaWinRatePercentOfGamesAsMafia, // ≈41%
        peacefulWinRatePercentOfGamesAsPeaceful // ≈47%
    };
}

export default async function(userObjectId: string){
    const zoom = getZoom();
    const box = new Box({ title: 'ПРОФИЛЬ', width: `${(App.width/zoom)/.75}px`, height: `${(App.height/zoom)/.75}px`, canCloseAnywhere: true });
    box.element.style.zoom = (zoom / 1.75) + '';

    box.content.style.overflowY = 'overlay';

    App.server.send(PacketDataKeys.GET_USER_PROFILE, {
        [PacketDataKeys.USER_RECEIVER]: userObjectId,
        [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
        [PacketDataKeys.TOKEN]: App.user.token
    });
    const data = await App.server.awaitPacket(PacketDataKeys.USER_PROFILE);
    const ud = data[PacketDataKeys.USER_PROFILE];
    const room = ud[PacketDataKeys.ROOM];
    const pud = ud[PacketDataKeys.PROFILE_USER_DATA];
    const profile = {
        isOnline: pud[PacketDataKeys.IS_ONLINE],
        experience: pud[PacketDataKeys.EXPERIENCE],
        level: pud[PacketDataKeys.LEVEL],
        matchMakingScore: pud[PacketDataKeys.MATCH_MAKING_SCORE],
        nextLevelExperience: pud[PacketDataKeys.NEXT_LEVEL_EXPERIENCE],
        prevLevelExperience: pud[PacketDataKeys.PREVIOUS_LEVEL_EXPERIENCE],
        objectId: pud[PacketDataKeys.OBJECT_ID],
        photo: pud[PacketDataKeys.PHOTO],
        roleStats: pud[PacketDataKeys.PLAYER_ROLE_STATISTICS],
        sex: pud[PacketDataKeys.SEX],
        playedGames: pud[PacketDataKeys.PLAYED_GAMES],
        serverLanguage: pud[PacketDataKeys.SERVER_LANGUAGE],
        status: pud[PacketDataKeys.STATUS],
        updated: pud[PacketDataKeys.UPDATED],
        username: pud[PacketDataKeys.USERNAME],
        vip: pud[PacketDataKeys.VIP],
        winsAsMafia: pud[PacketDataKeys.WINS_AS_MAFIA],
        winsAsPeaceful: pud[PacketDataKeys.WINS_AS_PEACEFUL],

        sliver: ud[PacketDataKeys.USER_ACCOUNT_COINS][PacketDataKeys.SILVER_COINS],
        gold: ud[PacketDataKeys.USER_ACCOUNT_COINS][PacketDataKeys.GOLD_COINS],
    }

    const isMe = typeof profile.gold == 'number';

    let isViewingAvatar = false;

    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.alignItems = 'center';
    div.style.overflowY = 'overlay';
    const badge = document.createElement('div');
    badge.style.width = badge.style.height = '15px';
    badge.style.background = profile.isOnline ? '#3fe33f' : '#636363';
    badge.style.border = '2px solid white';
    badge.style.borderRadius = '100%';
    badge.style.position = 'relative';
    badge.style.left = '-40px'
    badge.style.top = '-80px'
    const avatar = document.createElement('img');
    avatar.src = await getAvatarImg(pud);
    avatar.style.borderRadius = '100%'
    avatar.width = avatar.height = 100;
    avatar.style.margin = '5px';
    avatar.style.transition = '.5s';
    avatar.style.marginBottom = '-10px';
    avatar.onmousedown = e => e.preventDefault();
    avatar.onclick = () => {
        const zoom = getZoom();
        if(isViewingAvatar){
            avatar.style.position = 'static';
            avatar.style.width = ''
            avatar.style.height = ''
            avatar.style.borderRadius = '100%';
            wait(500).then(() => badge.style.display = 'block');
        } else {
            avatar.style.position = 'relative';
            avatar.style.width = (App.width/zoom)/1.75 + 'px';
            avatar.style.height = (App.width/zoom)/1.75 + 'px';
            avatar.style.borderRadius = '0'
            badge.style.display = 'none';
        }
        isViewingAvatar = !isViewingAvatar;
    }
    div.appendChild(avatar);
    div.appendChild(badge);

    function addH(text: string, userSelect = false){
        const h = document.createElement('h4');
        if(userSelect) h.style.userSelect = 'text';
        h.style.color = 'black';
        h.style.margin = '5px';
        h.textContent = text;
        div.appendChild(h);
    }
    
    addH(profile.username, true);

    const btns = document.createElement('div');
    btns.style.width = '80%';
    btns.style.textAlign = 'center';
    div.appendChild(btns);
    function addButton(text: string, callback: (this: GlobalEventHandlers, ev: PointerEvent) => any){
        const e = document.createElement('button');
        e.style.margin = '1px';
        e.textContent = text;
        e.onclick = callback;
        btns.appendChild(e);
    }

    if(userObjectId != App.user.objectId) {
        addButton('Добавить в друзья', () => {});
    }

    if(room){
        if(room[PacketDataKeys.SAME_ROOM] && !isMe)
            addButton('Выгнать игрока', () => {});
        addH(`Сейчас играет в комнате`);
        const roomElem = Rooms.getRoomElement(room);
        roomElem.addEventListener('click', () => box.close());
        roomElem.style.width = '90%';
        div.appendChild(roomElem);
    }
    if(!isMe) addButton('Подать жалобу', () => {});
    
    addH(`Статистика`);

    const stat = document.createElement('div');
    stat.style.display = 'flex';
    stat.style.flexDirection = 'column';
    stat.style.alignItems = 'stretch';
    stat.style.width = '95%';
    div.appendChild(stat);
    function add(stat: HTMLElement, text: string, value: any){
        const d = document.createElement('div');
        d.style.color = 'black';
        d.style.background = 'rgb(189 184 184)';
        d.style.padding = '5px';
        d.style.margin = '1px';
        d.style.borderRadius = '5px'
        const k = document.createElement('span');
        k.textContent = `${text}:`;
        const v = document.createElement('span');
        v.textContent = value;
        v.style.float = 'right'
        v.style.userSelect = 'text';
        d.appendChild(k);
        d.appendChild(v);
        stat.appendChild(d);
    }

    const dataStats = calculateStatsWithRoles(profile);

    add(stat, 'Сыграно игр', profile.playedGames);
    add(stat, 'Сыграно игр за Мафию', dataStats.gamesAsMafia);
    add(stat, 'Сыграно игр за Мирных', dataStats.gamesAsPeaceful);
    add(stat, 'Всего побед', dataStats.totalWins);
    add(stat, 'Побед за Мафию', dataStats.winsAsMafia);
    add(stat, 'Побед за Мирных', dataStats.winsAsPeaceful);
    add(stat, 'M/M', (Number(profile.winsAsPeaceful) / Number(profile.winsAsMafia)).toFixed(2));

    addH(`Сыгранные роли`);
    const statRoles = document.createElement('div');
    statRoles.style.display = 'flex';
    statRoles.style.flexDirection = 'row';
    statRoles.style.flexWrap = 'wrap';
    statRoles.style.alignItems = 'stretch';
    statRoles.style.justifyContent = 'center';
    statRoles.style.width = '95%';
    async function addRole(id: number){
        const d = document.createElement('div');
        d.style.color = 'black';
        d.style.background = 'rgb(189 184 184)';
        d.style.padding = '5px';
        d.style.margin = '1px';
        d.style.borderRadius = '5px'
        const img = document.createElement('img');
        img.src = await fs.loadImageAsDataURL(`${App.config.path}/assets/textures/roles/${id}.png`);
        img.width = 50;
        img.height = 70;
        img.onmousedown = e => e.preventDefault();
        const v = document.createElement('div');
        v.textContent = profile.roleStats[id];
        v.style.textAlign = 'center';
        d.appendChild(img);
        d.appendChild(v);
        statRoles.appendChild(d);
    }
    div.appendChild(statRoles);
    for(let i=1;i<11;i++) await addRole(i);

    addH(`Подробная информация`);

    const statDev = document.createElement('div');
    statDev.style.display = 'flex';
    statDev.style.flexDirection = 'column';
    statDev.style.alignItems = 'stretch';
    statDev.style.width = '95%';
    add(statDev, `ID Объекта`, userObjectId);
    add(statDev, `Последний вход`, formatDate(profile.updated));
    add(statDev, `Сервер`, profile.serverLanguage);
    div.appendChild(statDev);

    box.content.appendChild(div);

    return await box.wait('destroy');
}