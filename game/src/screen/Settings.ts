import Screen from './Screen';
import App from '../App';
import { getBackgroundImg, getTexture } from '../utils/Resources';
import Dashboard from './Dashboard';
import MessageBox from '../dialog/MessageBox';
import { isMobile } from '../../../core/src/utils/mobile';

export default class Settings extends Screen{
    constructor(){
        super('Settings');
        
        this.element.style.overflow = 'hidden';
        
        App.title = 'Настройки';
                
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
        title.textContent = 'Настройки';
        header.appendChild(title);
        
        this.on('back', () => {
            App.screen = new Dashboard();
        });
        
        this.init();
    }

    init(){
        const e = document.createElement('div');
        e.style.display = 'flex';
        e.style.padding = '5px';
        e.style.flexDirection = 'column';

        // TODO: all className (лень)
        function addCheckbox(text: string, onChange: (v: boolean) => void){
            const d = document.createElement('div');
            d.style.borderRadius = '10px';
            d.style.background = 'gray';
            d.style.height = '30px';
            d.style.padding = '5px';
            d.style.margin = '2px';
            d.style.display = 'flex';
            d.style.alignItems = 'center';
            d.style.justifyContent = 'space-between';
            e.appendChild(d);
            const t = document.createElement('span');
            t.className = 'black';
            t.style.marginLeft = '10px';
            t.textContent = text;
            d.appendChild(t);
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.onchange = () => onChange(cb.checked);
            d.appendChild(cb);
        }
        function addInput(text: string, onChange: (v: string) => void, value = "", placeholder = ""){
            const d = document.createElement('div');
            d.style.borderRadius = '10px';
            d.style.background = 'gray';
            d.style.height = '30px';
            d.style.padding = '5px';
            d.style.margin = '2px';
            d.style.display = 'flex';
            d.style.alignItems = 'center';
            d.style.justifyContent = 'space-between';
            e.appendChild(d);
            const t = document.createElement('span');
            t.className = 'black';
            t.style.marginLeft = '10px';
            t.textContent = text;
            d.appendChild(t);
            const inp = document.createElement('input');
            inp.value = value;
            inp.placeholder = placeholder
            inp.onchange = () => onChange(inp.value);
            d.appendChild(inp);
        }
        function addSlider(text: string, onChange: (v: number) => void, min = 1, max = 10, value = 1, step = 1){
            const d = document.createElement('div');
            d.style.borderRadius = '10px';
            d.style.background = 'gray';
            d.style.height = '30px';
            d.style.padding = '5px';
            d.style.margin = '2px';
            d.style.display = 'flex';
            d.style.alignItems = 'center';
            d.style.justifyContent = 'space-between';
            e.appendChild(d);
            const t = document.createElement('span');
            t.className = 'black';
            t.style.marginLeft = '10px';
            t.textContent = text;
            d.appendChild(t);
            const cb = document.createElement('input');
            cb.type = 'range';
            cb.min = min+'';
            cb.max = max+'';
            cb.step = step+'';
            cb.value = value+'';
            cb.onchange = () => onChange(Number(cb.value));
            d.appendChild(cb);
        }
        function addSelect(text: string, values: string[], onClick: (v: string) => void){
            
        }
        function addButton(text: string, btnText: string, onClick: () => void){
            const d = document.createElement('div');
            d.style.borderRadius = '10px';
            d.style.background = 'gray';
            d.style.height = '30px';
            d.style.padding = '5px';
            d.style.margin = '2px';
            d.style.display = 'flex';
            d.style.alignItems = 'center';
            d.style.justifyContent = 'space-between';
            e.appendChild(d);
            const t = document.createElement('span');
            t.className = 'black';
            t.style.marginLeft = '10px';
            t.textContent = text;
            d.appendChild(t);
            const btn = document.createElement('button');
            btn.textContent = btnText;
            btn.onclick = onClick;
            d.appendChild(btn);
        }
        addButton('Тема', 'Настроить', () => MessageBox('Скоро..'));
        addSlider('Масштаб', v => {
            App.settings.data.window.zoom = v;
            App.element.style.zoom = v + '';
        }, isMobile() ? .4 : .3, isMobile() ? .9 : 1.5, App.settings.data.window.zoom, .1);
        addInput('Начинать опьянение с', v => {
            App.settings.data.game.barmanEffect = v;
        }, App.settings.data.game.barmanEffect);
        
        // addSelect('Сервер', ['русский', 'английский'], v => {});

        this.element.appendChild(e);
    }
}