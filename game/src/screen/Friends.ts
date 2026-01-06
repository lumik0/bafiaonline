import PacketDataKeys from '../../../core/src/PacketDataKeys';
import { formatDate } from '../../../core/src/utils/format';
import { wait } from '../../../core/src/utils/utils';
import App from '../App';
import ConfirmBox from '../dialog/ConfirmBox';
import ProfileInfo from '../dialog/ProfileInfo';
import { getAvatarImg, getBackgroundImg, getTexture } from '../utils/Resources';
import Dashboard from './Dashboard';
import PrivateChat from './PrivateChat';
import Room from './Room';
import Screen from './Screen';

export default class Friends extends Screen {
    div!: HTMLDivElement
    list!: HTMLDivElement

    constructor(){
        super('Friends');

        this.element.style.overflow = 'hidden';
        
        App.title = 'Друзья';
                
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
        const title = document.createElement('label');
        title.textContent = 'Друзья';
        header.appendChild(title);
        
        this.on('back', () => {
            App.screen = new Dashboard();
        });
        
        this.init();
    }

    async init(){
        App.server.send(PacketDataKeys.ADD_CLIENT_TO_FRIENDSHIP_LIST, {
            [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
            [PacketDataKeys.TOKEN]: App.user.token
        });

        this.div = document.createElement('div');
        this.div.style.display = 'flex';
        this.div.style.padding = '10px';
        this.div.style.flexDirection = 'column';
        this.element.appendChild(this.div);
        const btns = document.createElement('div');
        btns.style.display = 'flex';
        btns.style.width = '100%';
        this.div.appendChild(btns);
        const friends = document.createElement('button');
        friends.className = 'gray';
        friends.style.width = '100%';
        friends.style.margin = '2px';
        friends.textContent = 'Друзья';
        friends.onclick = async() => {
            App.server.send(PacketDataKeys.ADD_CLIENT_TO_FRIENDSHIP_LIST, {
                [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
                [PacketDataKeys.TOKEN]: App.user.token
            });
            const data = await App.server.awaitPacket([PacketDataKeys.FRIENDSHIP_LIST]);
            friends.className = 'gray';
            requests.className = 'dark-gray';
            this.updateFriends(data[PacketDataKeys.FRIENDSHIP_LIST][PacketDataKeys.FRIENDSHIP_LIST]);
        }
        btns.appendChild(friends);
        const requests = document.createElement('button');
        requests.className = 'dark-gray';
        requests.style.width = '100%';
        requests.style.margin = '2px';
        requests.textContent = `Запросы`;
        requests.onclick = async() => {
            App.server.send(PacketDataKeys.GET_SENT_FRIEND_REQUESTS_LIST, {
                [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
                [PacketDataKeys.TOKEN]: App.user.token
            });
            const data = await App.server.awaitPacket([PacketDataKeys.FRIENDSHIP_LIST]);
            friends.className = 'dark-gray';
            requests.className = 'gray';
            this.updateFriends(data[PacketDataKeys.FRIENDSHIP_LIST][PacketDataKeys.FRIENDSHIP_LIST]);
        }
        btns.appendChild(requests);

        this.list = document.createElement('div');
        this.list.style.overflowY = 'overlay';
        this.list.style.height = (App.height - 125) + 'px';
        this.div.appendChild(this.list);

        this.on('resize', () => {
            this.list.style.height = (App.height - 125) + 'px';
        });
        
        const data = await App.server.awaitPacket([PacketDataKeys.FRIENDSHIP_LIST]);
        this.updateFriends(data[PacketDataKeys.FRIENDSHIP_LIST][PacketDataKeys.FRIENDSHIP_LIST]);
    }

    updateFriends(data: any){
        this.list.innerHTML = '';
        for(const f of data){
            const isFriend = !!f[PacketDataKeys.FRIEND];
            const user = isFriend ? f[PacketDataKeys.FRIEND] : f[PacketDataKeys.USER];
            const objectId = f[PacketDataKeys.OBJECT_ID];
            const userObjectId = user[PacketDataKeys.OBJECT_ID];
            const username = user[PacketDataKeys.USERNAME];
            let isClicked = false;

            const e = document.createElement('div');
            e.style.background = 'rgba(200,200,200,.4)';
            e.style.padding = '7px';
            e.style.margin = '5px';
            e.style.borderRadius = '10px';
            e.style.display = 'flex';
            e.onclick = () => {
                wait(10).then(() => {
                    if(!isClicked) App.screen = new PrivateChat(objectId, userObjectId, user)
                });
            }
            
            const avatar = document.createElement('img');
            avatar.width = avatar.height = 40;
            avatar.style.borderRadius = '100%';
            avatar.onmousedown = e => e.preventDefault();
            avatar.onclick = () => {
                isClicked = true;
                ProfileInfo(userObjectId);
            }
            getAvatarImg(user).then(s => avatar.src = s);
            e.appendChild(avatar);

            const badge = document.createElement('div');
            badge.style.width = badge.style.height = '15px';
            badge.style.minWidth = badge.style.minHeight = '15px';
            badge.style.maxWidth = badge.style.maxHeight = '15px';
            badge.style.boxSizing = 'border-box';
            badge.style.background = user[PacketDataKeys.IS_ONLINE] ? '#3fe33f' : '#636363';
            badge.style.border = '2px solid white';
            badge.style.borderRadius = '100%';
            badge.style.position = 'relative';
            badge.style.left = '-45px'
            e.appendChild(badge);

            const d = document.createElement('div');
            d.style.display = 'flex';
            d.style.flexDirection = 'column';
            d.style.width = '300px';
            e.appendChild(d);

            const nick = document.createElement('span');
            nick.textContent = username;
            nick.style.padding = '0 5px 7px 10px';
            nick.style.color = 'black';
            d.appendChild(nick);

            const date = document.createElement('span');
            date.textContent = formatDate(f[PacketDataKeys.UPDATED]);
            date.style.padding = '0 5px 0 5px';
            date.style.fontSize = '11px'
            date.style.color = 'black';
            d.appendChild(date);

            const btns = document.createElement('div');
            btns.style.display = 'flex';
            btns.style.width = '100%';
            btns.style.justifyContent = 'flex-end';
            e.appendChild(btns);

            if(f[PacketDataKeys.ROOM]){
                const btnRoom = document.createElement('button');
                btnRoom.textContent = 'В комнате';
                btnRoom.onclick = () => {
                    isClicked = true;
                    App.screen = new Room(f[PacketDataKeys.ROOM][PacketDataKeys.OBJECT_ID]);
                }
                btns.appendChild(btnRoom);
            }

            const btnRemoveFriend = document.createElement('button');
            btnRemoveFriend.className = 'gray';
            btnRemoveFriend.textContent = 'X';
            btnRemoveFriend.onclick = async() => {
                isClicked = true;
                const c = await ConfirmBox(`Удалить данного пользователя из друзей? Все личные сообщения так-же будут удалены.`, { title: `УДАЛИТЬ ИЗ ДРУЗЕЙ`, height: '175px' });
                if(c) {
                    App.server.send(PacketDataKeys.REMOVE_FRIEND, {
                        [PacketDataKeys.FRIEND_USER_OBJECT_ID]: userObjectId
                    });
                    const data = await App.server.awaitPacket([PacketDataKeys.REMOVE_FRIEND]);
                    if(data[PacketDataKeys.TYPE] == PacketDataKeys.REMOVE_FRIEND)
                        e.remove();
                }
            }
            btns.appendChild(btnRemoveFriend);

            this.list.appendChild(e);
        }
    }
}