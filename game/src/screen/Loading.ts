import App from "../App";
import Screen from "./Screen";
import { wrap } from "../../../core/src/utils/TypeScript";
import fs from "../../../core/src/fs/fs";
import { getBackgroundImg, getTexture } from "../utils/Resources";

export default class Loading extends Screen {
    loadingElem!: HTMLImageElement
    rotation = 0

    constructor(public title: string){
        super('Loading');

        App.title = 'Загрузка';
        
        (async()=> this.element.style.background = `url(${await getBackgroundImg('menu3')}) 0% 0% / cover`)();
        
        const header = document.createElement('div');
        header.className = 'header';
        this.element.appendChild(header);
        const logo = document.createElement('label');
        logo.innerHTML = 'Бафия онлайн';
        header.appendChild(logo);
        
        const div = document.createElement('div');
        div.style.textAlign = 'center';
        this.element.appendChild(div);

        const text = document.createElement('p');
        text.innerHTML = title;
        div.appendChild(text);

        wrap(this, 'title', (v: string) => text.innerHTML = v);

        (async()=>{
            this.loadingElem = document.createElement('img');
            this.loadingElem.src = await getTexture(`loading/2f.png`);
            div.appendChild(this.loadingElem);
        })();
    }

    tick(dt: number){
        if(dt % 2 < 1) return;
        if(this.loadingElem) this.loadingElem.style.transform = `rotateZ(${this.rotation % 360}deg)`
        this.rotation+=30;
    }
}