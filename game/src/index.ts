import App from './App';
import config, { Config } from '../../core/src/config';
import IWindow from '../../core/src/IWindow'
import fs from '../../core/src/fs/fs';

// @ts-ignore
window.main = async function (conf: Config, win: IWindow, element: HTMLElement) {
  // @ts-ignore
  if(!window['apps']) window['apps'] = [];
  // @ts-ignore
  window['apps'].push(App);

  // @ts-ignore
  delete window.main;
  App.config = config(conf);
  App.win = win;
  App.element = element;
  await fs.init('Indexeddb');
  await App.init();
}
