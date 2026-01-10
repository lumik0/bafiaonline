import App from './App';
import config, { Config } from '../../core/src/config';
import IWindow from '../../core/src/IWindow'
import fs from '../../core/src/fs/fs';

async function pre() {
}

// @ts-ignore
window.main = async function(conf: Config, win: IWindow, element: HTMLElement){
  // @ts-ignore
  delete window.main;
  App.config = config(conf);
  App.win = win;
  App.element = element;
  await fs.init('Indexeddb');
  await App.init();
}

// @ts-ignore
window['App'] = App;

(async function(){
  await pre();
})();
