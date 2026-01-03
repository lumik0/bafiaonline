import { getZoom, wait } from "../../../core/src/utils/utils";
import App from "../App";
import Component from "./Component";

export default class ContextMenu extends Component {
    result?: string

    constructor(public menu: string[] = [], public event: PointerEvent){
        super();

        const zoom = getZoom();
        const winZoom = App.zoom

        const elem = document.createElement('div');
        elem.style.position = 'fixed';
        elem.style.display = 'flex';
        elem.style.flexDirection = 'column';
        elem.style.left = (event.pageX / winZoom / zoom) + 'px';
        elem.style.top = (event.pageY / winZoom / zoom) + 'px';
        for(let i = 0; i < menu.length; i++){
            const btn = menu[i];
            const e = document.createElement('button');
            e.style.borderRadius = i == 0 ? '7px 7px 0 0' : i == menu.length-1 ? '0 0 7px 7px' : '0';
            e.textContent = btn;
            e.onclick = () => this.result = btn;
            elem.appendChild(e);
        }
        this.elem.appendChild(elem);

        this.on('click', async() => { await wait(0); this.destroy() });
        this.on('contextmenu', async() => { await wait(0); this.destroy() });
    }

    waitForResult(){
        return new Promise<string|undefined>(async(res, rej) => {
            await this.wait('destroy');
            res(this.result);
        });
    }
}