import PacketDataKeys from "../../../core/src/PacketDataKeys";
import { createElement } from "../../../core/src/utils/DOM";
import App from "../App";
import Box from "../dialog/Box";
import { getBackgroundImg, getTexture } from "../utils/Resources";
import Dashboard from "./Dashboard";
import Screen from "./Screen";

function formatSeconds(totalSeconds: number, pad: boolean = false): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const f = (n: number) => pad ? n.toString().padStart(2, '0') : n;

  return `${f(hours)}ч. ${f(minutes)}м. ${f(seconds)}с.`;
}

const emojis = ["1","⌚","⌛","⏰","⏳","☀","☁","☔","☎","☕","☝","☺","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","♠","♣","♥","♦","⚓","⚡","⚽","⚾","⛔","⛅","⛪","⛲","⛳","⛵","⛽","⛺","✊","✋","✌","❄","❤","⭐","🌀","🌁","🌂","🌃","🌄","🌅","🌆","🌇","🌈","🌉","🌊","🌋","🌌","🌍","🌎","🌏","🌐","🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘","🌙","🌚","🌛","🌜","🌝","🌞","🌟","🌠","🌡","🌤","🌥","🌦","🌧","🌨","🌩","🌪","🌫","🌬","🌭","🌮","🌯","🌵","🌶","🌷","🌸","🌹","🌺","🌻","🌼","🌽","🌾","🌿","🍀","🍁","🍂","🍃","🍄","🍅","🍆","🍇","🍈","🍉","🍊","🍋","🍌","🍍","🍎","🍏","🍐","🍑","🍒","🍓","🍔","🍕","🍖","🍗","🍘","🍙","🍚","🍛","🍜","🍝","🍞","🍟","🍠","🍡","🍢","🍣","🍤","🍥","🍦","🍧","🍨","🍩","🍪","🍫","🍬","🍭","🍮","🍯","🍰","🍱","🍲","🍳","🍴","🍵","🍶","🍷","🍸","🍹","🍺","🍻","🍼","🍽","🍾","🍿","🎀","🎁","🎂","🎃","🎄","🎅","🎆","🎇","🎈","🎉","🎊","🎋","🎌","🎍","🎎","🎏","🎐","🎑","🎒","🎓","🎖","🎗","🎙","🎚","🎛","🎞","🎟","🎠","🎡","🎢","🎣","🎤","🎥","🎦","🎧","🎨","🎩","🎪","🎫","🎬","🎭","🎮","🎯","🎰","🎱","🎲","🎳","🎴","🎵","🎶","🎷","🎸","🎹","🎺","🎻","🎼","🎽","🎾","🎿","🏀","🏁","🏂","🏃","🏄","🏅","🏆","🏇","🏈","🏉","🏊","🏋","🏌","🏍","🏎","🏏","🏐","🏑","🏒","🏓","🏔","🏕","🏖","🏗","🏘","🏙","🏚","🏛","🏜","🏝","🏞","🏟","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏧","🏨","🏩","🏪","🏫","🏬","🏭","🏮","🏯","🏰","🏳","🏴","🏵","🏷","🏸","🏹","🏺","🐀","🐁","🐂","🐃","🐄","🐅","🐆","🐇","🐈","🐉","🐊","🐋","🐌","🐍","🐎","🐏","🐐","🐑","🐒","🐓","🐔","🐕","🐖","🐗","🐘","🐙","🐚","🐛","🐜","🐝","🐞","🐟","🐠","🐡","🐢","🐣","🐤","🐥","🐦","🐧","🐨","🐩","🐪","🐫","🐬","🐭","🐮","🐯","🐰","🐱","🐲","🐳","🐴","🐵","🐶","🐷","🐸","🐹","🐺","🐻","🐼","🐽","🐾","🐿","👀","👁","👂","👃","👄","👅","👆","👇","👈","👉","👊","👋","👌","👍","👎","👏","👐","👑","👒","👓","👔","👕","👖","👗","👘","👙","👚","👛","👜","👝","👞","👟","👠","👡","👢","👣","👤","👥","👦","👧","👨","👩","👪","👫","👬","👭","👮","👯","👰","👱","👲","👳","👴","👵","👶","👷","👸","👹","👺","👻","👼","👽","👾","👿","💀","💁","💂","💃","💄","💅","💆","💇","💈","💉","💊","💋","💌","💍","💎","💏","💐","💑","💒","💓","💔","💕","💖","💗","💘","💙","💚","💛","💜","💝","💞","💟","💠","💡","💢","💣","💤","💥","💦","💧","💨","💩","💪","💫","💬","💭","💮","💯","💰","💱","💲","💳","💴","💵","💶","💷","💸","💹","💺","💻","💼","💽","💾","💿","📀","📁","📂","📃","📄","📅","📆","📇","📈","📉","📊","📋","📌","📍","📎","📏","📐","📑","📒","📓","📔","📕","📖","📗","📘","📙","📚","📛","📜","📝","📞","📟","📠","📡","📢","📣","📤","📥","📦","📧","📨","📩","📪","📫","📬","📭","📮","📯","📰","📱","📲","📳","📴","📵","📶","📷","📸","📹","📺","📻","📼","📽","📿","🔊","🔋","🔞","🔥","🔦","🔧","🔨","🔩","🔪","🔫","🔬","🔭","🔮","🔯","🕊","🕋","🕌","🕍","🕎","🕯","🕰","🕴","🕵","🕶","🕷","🕸","🕹","🕺","🖐","🖖","🖤","🗡","🗜","🗝","🗞","🗻","🗼","🗽","🗿","😀","😁","😂","😃","😄","😅","😆","😇","😈","😉","😊","😋","😌","😍","😎","😏","😐","😑","😒","😓","😔","😕","😖","😗","😘","😙","😚","😛","😜","😝","😞","😟","😠","😡","😢","😣","😤","😥","😦","😧","😨","😩","😪","😫","😬","😭","😮","😯","😰","😱","😲","😳","😴","😵","😶","😷","😸","😹","😺","😻","😼","😽","😾","😿","🙀","🙁","🙂","🙃","🙄","🙅","🙆","🙇","🙈","🙉","🙊","🙋","🙌","🙍","🙎","🙏","🚀","🚁","🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚋","🚌","🚍","🚎","🚏","🚐","🚑","🚒","🚓","🚔","🚕","🚖","🚗","🚘","🚙","🚚","🚛","🚜","🚝","🚞","🚟","🚠","🚡","🚢","🚣","🚤","🚥","🚦","🚧","🚨","🚩","🚪","🚫","🚬","🚭","🚮","🚯","🚰","🚱","🚲","🚳","🚴","🚵","🚶","🚷","🚸","🚹","🚺","🚻","🚼","🚽","🚾","🚿","🛀","🛁","🛂","🛃","🛄","🛅","🛋","🛌","🛍","🛎","🛏","🛐","🛑","🛒","🛕","🛖","🛗","🛠","🛡","🛢","🛣","🛤","🛥","🛩","🛫","🛬","🛰","🛳","🛴","🛵","🛶","🛷","🛸","🛹","🛺","🛻","🛼","🟠","🟡","🟢","🟣","🟤","🟥","🟦","🟧","🟨","🟩","🟪","🟫","🤌","🤍","🤎","🤏","🤐","🤑","🤒","🤓","🤔","🤕","🤖","🤗","🤘","🤙","🤚","🤛","🤜","🤝","🤞","🤟","🤠","🤡","🤢","🤣","🤤","🤥","🤦","🤧","🤨","🤩","🤪","🤫","🤬","🤭","🤮","🤯","🤰","🤱","🤲","🤳","🤴","🤵","🤶","🤷","🤸","🤹","🤺","🤼","🤽","🤾","🤿","🥀","🥁","🥂","🥃","🥄","🥅","🥇","🥈","🥉","🥊","🥋","🥌","🥍","🥎","🥏","🥐","🥑","🥒","🥓","🥔","🥕","🥖","🥗","🥘","🥙","🥚","🥛","🥜","🥝","🥞","🥟","🥠","🥡","🥢","🥣","🥤","🥥","🥦","🥧","🥨","🥩","🥪","🥫","🥬","🥭","🥮","🥯","🥰","🥱","🥲","🥳","🥴","🥵","🥶","🥷","🥸","🥺","🥻","🥼","🥽","🥾","🥿","🦀","🦁","🦂","🦃","🦄","🦅","🦆","🦇","🦈","🦉","🦊","🦋","🦌","🦍","🦎","🦏","🦐","🦑","🦒","🦓","🦔","🦕","🦖","🦗","🦘","🦙","🦚","🦛","🦜","🦝","🦞","🦟","🦠","🦡","🦢","🦣","🦤","🦥","🦦","🦧","🦨","🦩","🦪","🦫","🦬","🦭","🦮","🦯","🦴","🦵","🦶","🦷","🦸","🦹","🦺","🦻","🦼","🦽","🦾","🦿","🧀","🧁","🧂","🧃","🧄","🧅","🧆","🧇","🧈","🧉","🧊","🧋","🧍","🧎","🧏","🧐","🧑","🧒","🧓","🧔","🧕","🧖","🧗","🧘","🧙","🧚","🧛","🧜","🧝","🧞","🧟","🧠","🧡","🧢","🧣","🧤","🧥","🧦","🧧","🧨","🧩","🧪","🧫","🧬","🧭","🧮","🧯","🧰","🧱","🧲","🧳","🧴","🧵","🧶","🧷","🧸","🧹","🧺","🧻","🧼","🧽","🧾","🧿","🩰","🩱","🩲","🩳","🩴","🩸","🩹","🩺","🪀","🪁","🪂","🪃","🪄","🪅","🪆","🪐","🪑","🪒","🪓","🪔","🪕","🪖","🪗","🪘","🪙","🪚","🪛","🪜","🪝","🪞","🪟","🪠","🪡","🪢","🪣","🪤","🪥","🪦","🪧","🪨","🪰","🪱","🪲","🪳","🪴","🪵","🪶","🫀","🫁","🫂","🫐","🫑","🫒","🫓","🫔","🫕","🫖"];

export default class Backpack extends Screen {
  div!: HTMLDivElement

  constructor(){
    super('Backpack');

    App.title = 'Рюкзак';

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
    titleElem.textContent = 'Рюкзак';
    header.appendChild(titleElem);

    this.on('back', () => {
      App.screen = new Dashboard();
    });

    this.init();
  }

  async init(){
    this.div = createElement('div', {
      css: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '10px'
      }
    });
    this.element.appendChild(this.div);

    this.update();
  }

  async update(){
    // @ts-ignore
    this.call('update_backpack');
    App.server.send("bpg", {
      [PacketDataKeys.USER_OBJECT_ID]: App.user.objectId,
      [PacketDataKeys.TOKEN]: App.user.token
    });

    const d = await App.server.awaitPacket("bpg");
    const data = d.bp;
    const baits = data.baits;
    const bits = data.bits;
    const bds = data.bds;
    const bads = data.bads;
    const maxSize = data.bps;

    if(baits && baits.length > 0){
      createElement('span', { text: `Активные предметы`, appendTo: this.div });
      baits.forEach(async(bait: any) => {
        const id = bait.aio;
        const itmt = bait.itmt;
        const baitEl = createElement('div', {
          css: {
            display: 'flex',
            flexDirection: 'column',
            background: '#f4f4f433',
            borderRadius: '5px',
            padding: '10px',
            color: 'white',
            gap: '5px'
          },
          appendTo: this.div
        });
        if(itmt == 0){
          const emoji = bait.itmsps['1'] == 1 ? '👑' : emojis[bait.itmsps['1']];
          const title = createElement('span', { text: `VIP-аккаунт (${emoji})`, appendTo: baitEl });
          if(bait.iea > 0){
            let show = bait.itmsps['0'] == 0;
            const da = createElement('div', { text: `Изменить значок: `, appendTo: baitEl });
            const options = emojis.map((e, i) => `<option value="${i}" ${bait.itmsps['1'] == i ? 'selected' : ''}>${i == 0 ? 'по умолчанию' : e}</option>`).join('');
            const select = createElement('select', {
              html: options,
              appendTo: da
            });
            select.onchange = async() => {
              App.server.send('baied', {
                bied: {
                  bio: id,
                  itmps: {
                    '1': parseInt(select.value)
                  }
                }
              });
              await App.server.awaitPacket('baiedd');
              // @ts-ignore
              title.innerText = `VIP-аккаунт (${emojis[select.value]})`;
            }
            const vbtn = createElement('button', {
              text: !show ? 'Показывать иконку' : 'Скрывать иконку',
              appendTo: baitEl
            });
            vbtn.onclick = async()=>{
              App.server.send('baied', {
                bied: {
                  bio: id,
                  itmps: {
                    '0': show ? 1 : 0
                  }
                }
              });
              await App.server.awaitPacket('baiedd');
              show = !show;
              vbtn.innerText = !show ? 'Показывать иконку' : 'Скрывать иконку';
            }
          } else {
            const vbtn = createElement('button', {
              text: 'Удалить',
              appendTo: baitEl
            });
            App.server.send('bairm', {
              birm: {
                bio: id
              }
            });
            await App.server.awaitPacket('bairmd');
            this.update();
          }
          const timer = createElement('span', { text: formatSeconds(bait.iea), appendTo: baitEl });
          if(bait.iea > 0) {
            this.setInterval('bait_timer_' + id, () => {
              if(bait.iea < 1) return;
              timer.innerText = formatSeconds(--bait.iea);
            }, 1000);
            // @ts-ignore
            this.once('update_backpack', () => {
              this.removeInterval('bait_timer_' + id);
            });
          }
        }
      });
    }

    const size = (bits ? bits.length : 0) + (bds ? bds.length : 0) + (bads ? bads.length : 0);
    createElement('span', { text: `У вас: ${size} предмет${(size%100>10 && size%100<20) ? 'ов' : [0,1].includes(size%10) ? (size%10==1 ? '' : 'ов') : 'а'}`, appendTo: this.div });
    createElement('span', { text: `Размер: ${maxSize} ячеек`, css: { fontSize: 'smaller' }, appendTo: this.div });

    if(bits){
      for(let i = 0; i < bits.length; i++) {
        const bio = bits[i];
        const button = createElement('button', {
          text: 'Применить VIP-аккаунт',
          appendTo: this.div
        });
        button.onclick = async () => {
          App.server.send('bia', { bio });
          await App.server.awaitPacket('biad');
        }
      }
    }

    createElement('span', { text: `Не все есть, скоро рюкзак будет обновляться`, css: { fontSize: 'smaller' }, appendTo: this.div })
  }
}