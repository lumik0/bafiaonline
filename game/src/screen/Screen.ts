import App from "../App";
import Events from "../../../core/src/Events";
import { wait } from "../../../core/src/utils/utils";

interface ScreenEvents {
  tick: (dt: number) => void
  preBack: () => void
  back: () => void
  resize: (e: { oldWidth: number, oldHeight: number }) => void
  keydown: (e: KeyboardEvent) => void
  keyup: (e: KeyboardEvent) => void
  click: (e: PointerEvent) => void
  message: (data: any) => void
}

// @ts-ignore
export default class Screen extends Events<ScreenEvents> {
  element: HTMLDivElement

  constructor(public name = "Screen"){
    super();
    this.element = document.createElement('div');
    this.element.tabIndex = 1;
    this.element.style.width = '100%';
    this.element.style.height = '100%';

    wait(50).then(() => {
      App.on('resize', e => this.emit('resize', e)).key(`screen_${name}`);
      App.on('keydown', e => this.emit('keydown', e)).key(`screen_${name}`);
      App.on('keyup', e => this.emit('keyup', e)).key(`screen_${name}`);
      App.on('click', e => this.emit('click', e)).key(`screen_${name}`);
      App.server.on('message', data => this.emit('message', data)).key(`screen_${name}`);
      this.element.focus();
    });

    this.on('preBack', () => {
      if(App.boxs.length > 0)
        App.boxs[0].close();
      else
        this.emit('back');
    });
    this.on('keydown', e => {
      if(e.key == 'Escape') {
        this.emit('preBack');
      }
    });
  }

  tick(dt: number){
    this.emit('tick', dt);
  }

  destroy(){
    this.removeAllEvents();
    App.removeByKey(`screen_${this.name}`);
    App.server.removeByKey(`screen_${this.name}`);
    App.element.removeChild(this.element);
    this.element.remove();
  }
}
