import fs from '../../core/src/fs/fs';
import App from './App';
import Launcher from './Launcher';
import Window from './Window';

async function main(){
    await fs.init('Indexeddb');
    App.launcher = new Launcher();
}

(async function(){
    await(new Promise<void>(async(res)=>{
        await document.fonts.ready;
        const iid = setInterval(()=>{
            if(document.body && document.readyState == "interactive" || document.readyState == "complete"){
                clearInterval(iid);
                res();
            }
        }, 10);
    }));
})().then(main);