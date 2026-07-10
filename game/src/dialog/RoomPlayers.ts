import PacketDataKeys from "../../../core/src/PacketDataKeys";
import { createElement } from "../../../core/src/utils/DOM";
import { noXSS } from "../../../core/src/utils/utils";
import App from "../App";
import Room from "../screen/Room";
import { getAvatarImg } from "../utils/Resources";
import Box from "./Box";
import ProfileInfo from "./ProfileInfo";

export default async function(roomId: string) {
  const height = 450;
  const box = new Box({ title: 'ИГРОКИ В КОМНАТЕ:', width: 350, height, canCloseAnywhere: true });

  const div = createElement('div', {
    css: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  });
  box.content.appendChild(div);

  const list = createElement('div', {
    css: {
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'overlay',
      height: (height-80)+'px',
      width: '100%',
      alignItems: 'left'
    }
  });
  div.appendChild(list);

  App.server.send(PacketDataKeys.GET_PLAYERS, {
    [PacketDataKeys.ROOM_OBJECT_ID]: roomId
  });
  const data = await App.server.awaitPacket(PacketDataKeys.PLAYERS_IN_ROOM);

  for(const pl of data[PacketDataKeys.PLAYERS]) {
    const e = createElement('div', {
      css: {
        display: 'flex',
        alignItems: 'center',
        marginLeft: '10px',
        marginRight: '10px'
      }
    });
    const avatar = createElement('img', {
      css: {
        borderRadius: '100%',
        margin: '5px'
      },
      width: 30,
      height: 30,
    });
    getAvatarImg(pl).then(e => avatar.src = e);
    avatar.onclick = () => ProfileInfo(pl[PacketDataKeys.PLAYER_OBJECT_ID]);
    const nick = createElement('span', {
      text: noXSS(pl[PacketDataKeys.USERNAME]),
      css: {
        width: '99%'
      },
      className: 'black'
    });
    const alive = createElement('span', {
      text: pl[PacketDataKeys.ALIVE] ? 'Жив' : 'Умер',
      css: {
        color: pl[PacketDataKeys.ALIVE] ? '#186400' : '#940000'
      },
      className: 'black'
    });

    e.appendChild(avatar);
    e.appendChild(nick);
    e.appendChild(alive);
    list.appendChild(e);
  }

  const btnOk = document.createElement('button');
  btnOk.textContent = 'ВОЙТИ';
  btnOk.style.width = '80%';
  btnOk.addEventListener('click', () => {
    box.close();
    App.screen = new Room(roomId);
  });
  div.appendChild(btnOk);

  await box.wait('destroy');
}
