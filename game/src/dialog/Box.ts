import App from "../App";
import Events, { EventHandle } from "../../../core/src/Events";
import { wait } from "../../../core/src/utils/utils";

interface BoxEvents {
    tick: (dt: number) => void
    close: (event: {
        isCancelled: boolean
    }) => void
    destroy: () => void
}

// @ts-ignore
export default class Box extends Events<BoxEvents> {
    content: HTMLElement
    background: HTMLElement
    loop: EventHandle<(dt: number) => void>
    id = -1;

    constructor(options: {
        title?: string
        width?: string
        height?: string
        canCloseAnywhere?: boolean
    } = {}, public element: HTMLElement = document.createElement('div')){
        super();
        const self = this;

        this.id = App.boxs.length;
        App.boxs.push(this);
        
        App.screen.element.style.pointerEvents = 'none';

        this.element.style.transition = '.2s';
        this.element.style.width = options.width ?? '300px';
        this.element.style.height = options.height ?? '150px';
        this.element.style.position = 'absolute';
        this.element.style.top = '50%';
        this.element.style.left = '50%';
        this.element.style.opacity = '0';
        this.element.style.transform = 'translate(-50%, -45%)';

        this.background = document.createElement('div');
        this.background.style.background = 'black'
        this.background.style.position = 'fixed';
        this.background.style.transition = 'opacity .5s';
        this.background.style.opacity = '0';
        this.background.style.width = '100%';
        this.background.style.height = '100%';
        this.background.style.left = '0';
        this.background.style.top = '0';
        App.element.appendChild(this.background);

        const div = document.createElement('div');
        div.style.background = '#D1343C';
        div.style.width = '100%'
        // div.style.height = '100%';
        div.style.borderRadius = '10px';
        this.element.appendChild(div);

        const titleBar = document.createElement('div');
        titleBar.style.width = '100%'
        titleBar.style.height = '35px';
        titleBar.style.display = 'flex';
        titleBar.style.justifyContent = 'center';
        titleBar.style.alignItems = 'center';
        titleBar.textContent = options.title ?? 'Информация'
        div.appendChild(titleBar);

        const contentBackground = document.createElement('div');
        contentBackground.style.width = '100%';
        contentBackground.style.height = '100%';
        contentBackground.style.display = 'flex';
        contentBackground.style.justifyContent = 'center';
        div.appendChild(contentBackground);

        this.content = document.createElement('div');
        this.content.style.background = '#B4AEAC';
        this.content.style.margin = '0 5px 5px 5px';
        this.content.style.width = '100%';
        this.content.style.height = options.height ? (parseInt(options.height.replace('px', '')) - 40) + 'px' : 'calc(150px - 40px)' //options.heightContent ?? '74%';
        this.content.style.borderRadius = '10px';
        contentBackground.appendChild(this.content);

        App.element.appendChild(this.element);
        if(options.canCloseAnywhere) {
            this.background.addEventListener('click', e => {
                self.close();
            });
        }
        
        wait(50).then(() => {
            this.background.style.opacity = '.6';
            this.element.style.transform = 'translate(-50%, -50%)';
            this.element.style.opacity = '1';
        });

        this.loop = App.on('tick', dt => this.emit('tick', dt));
    }

    async close(){
        const e = await this.call('close', { isCancelled: false });
        if(e.isCancelled) return;
        this.background.style.opacity = '0';
        // App.screen.element.style.pointerEvents = 'all';
        // App.screen.element.style.opacity = '1';
        this.element.style.transform = 'translate(-50%, -55%)';
        this.element.style.opacity = '0';
        wait(200).then(() => this.#destroy());
    }

    #destroy(){
        this.emit('destroy');
        App.boxs.splice(this.id, 1);
        if(App.boxs.length == 0) App.screen.element.style.pointerEvents = 'all';
        try{App.element.removeChild(this.element);}catch{}
        try{App.element.removeChild(this.background);}catch{}
        this.element.remove();
        this.background.remove();
    }
}