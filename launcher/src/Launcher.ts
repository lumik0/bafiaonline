import Window from './Window';
import { readImage } from '../../core/src/image'
import fs from '../../core/src/fs/fs';
import config, { Config } from '../../core/src/config';
import { Version, Profile } from './enums'
import { uriServer } from '../../core/src/Constants';
import { createScript, noXSS, wait } from '../../core/src/utils/utils'
import PacketDataKeys from '../../core/src/PacketDataKeys'
import MD5 from '../../core/src/utils/md5'
import { isMobile } from '../../core/src/utils/mobile';
import App from './App';

function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16));
}
function tokenHex(nBytes: number): string {
    const bytes = new Uint8Array(nBytes);
    crypto.getRandomValues(bytes);
    return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

export default class Launcher {
    win: Window

    openedWindows: Window[] = [];

    versions: Version[] = [];
    profiles: Profile[] = [];
    
    statusText!: HTMLDivElement
    progressBar!: HTMLProgressElement
    btnPlay!: HTMLButtonElement
    
    constructor(){
        this.win = new Window({
            title: `Лаунчер (${App.version})`,
            // width: 700,
            width: 400,
            height: 300,
            center: true
        });

        this.#init();
    }

    async readVersion(src: string): Promise<Version|null> {
        try {
            await createScript({ src });
            // @ts-ignore
            const version: Version = window['version'];
            // @ts-ignore
            delete window['version'];
            return version;
        } catch {
            try{
                const t = await(await fetch(src)).text();
                window['eval'](t);
                // @ts-ignore
                const version: Version = window['version'];
                // @ts-ignore
                delete window['version'];
                return version;
            }catch{
                return null;
            }
        }
        return null;
    }

    async #init(){
        await this.readData();

        this.#initContent();

        if(this.versions.length == 0){
            this.statusText.textContent = `Скачивание версии..`;
            console.log(`Downloading default version [vanilla]..`);
            try{
                const src = `https://raw.githubusercontent.com/lumik0/bafiaonline/refs/heads/master/run/images/vanilla.js?v=${Math.random()}`;
                const version = await this.readVersion(src);
                if(version) await this.downloadVersion({...version, scriptPath: src});
            }catch(e){
                console.error(e);
            }
        }
    }

    async writeData(){
        await fs.writeFile(`/versions.json`, JSON.stringify(this.versions));
        await fs.writeFile(`/profiles.json`, JSON.stringify(this.profiles));
    }
    async readData(){
        if(!(await fs.existsFile('/urlsVersions.json'))) fs.writeFile(`/urlsVersions.json`, JSON.stringify(['./images/vanilla.js', './vanilla.js']));
        if(!(await fs.existsFile('/versions.json'))) fs.writeFile(`/versions.json`, '[]');
        if(!(await fs.existsFile('/profiles.json'))) fs.writeFile(`/profiles.json`, '[]');
        this.versions = JSON.parse(await fs.readFile(`/versions.json`));
        this.profiles = JSON.parse(await fs.readFile(`/profiles.json`));
    }

    async #initContent(checkVersions = true){
        const updateVersions = [];
        this.win.content.innerHTML = '';

        const div = document.createElement('div');
        div.style.padding = '5px';
        this.win.content.appendChild(div);

        this.statusText = document.createElement('div');
        this.statusText.style.margin = '5px 5px 0 5px';
        div.appendChild(this.statusText);

        this.progressBar = document.createElement('progress');
        this.progressBar.value = 0
        this.progressBar.style.width = '100%'
        div.appendChild(this.progressBar);

        const versions = document.createElement('div');
        versions.style.display = 'flex';
        versions.style.alignItems = 'center';
        versions.style.fontSize = '13px';
        const txtVersions = document.createElement('span');
        txtVersions.style.minWidth = '70px'
        txtVersions.textContent = `Версии:`;
        versions.appendChild(txtVersions);
        const listVersions = document.createElement(`select`);
        listVersions.value = 'Выберите версию..';
        listVersions.style.width = '100%';
        for(const ver of this.versions){
            const el = document.createElement('option');
            el.innerHTML = ver.name;
            if(ver.scriptPath && checkVersions) updateVersions.push(ver);
            listVersions.appendChild(el);
        }
        versions.appendChild(listVersions);
        const btnAddVersion = document.createElement('button');
        btnAddVersion.innerHTML = `+`;
        btnAddVersion.onclick = () => this.addVersion();
        versions.appendChild(btnAddVersion);
        const btnRemoveVersion = document.createElement('button');
        btnRemoveVersion.innerHTML = `-`;
        btnRemoveVersion.onclick = async() => {
            const p = this.versions.findIndex(e => e.name == listVersions.value);
            if(p != -1){
                btnRemoveVersion.disabled = true;
                this.versions.splice(p, 1);
                await this.writeData();
                this.#initContent();
            }
        }
        versions.appendChild(btnRemoveVersion);
        div.appendChild(versions);

        const profiles = document.createElement('div');
        profiles.style.display = 'flex';
        profiles.style.alignItems = 'center';
        profiles.style.fontSize = '13px'
        const txtProfiles = document.createElement('span');
        txtProfiles.style.minWidth = '70px'
        txtProfiles.textContent = `Профили:`;
        profiles.appendChild(txtProfiles);
        const listProfiles = document.createElement(`select`);
        listProfiles.value = 'Выберите профиль..';
        listProfiles.style.width = '100%';
        for(const pr of this.profiles){
            const el = document.createElement('option');
            el.innerHTML = pr.name;
            listProfiles.appendChild(el);
        }
        profiles.appendChild(listProfiles);
        const btnAddProfile = document.createElement('button');
        btnAddProfile.innerHTML = `+`;
        btnAddProfile.onclick = () => this.addProfile();
        profiles.appendChild(btnAddProfile);
        const btnRemoveProfile = document.createElement('button');
        btnRemoveProfile.innerHTML = `-`;
        btnRemoveProfile.onclick = async() => {
            const p = this.profiles.findIndex(e => e.name == listProfiles.value);
            if(p != -1){
                btnRemoveProfile.disabled = true;
                this.profiles.splice(p, 1);
                await this.writeData();
                this.#initContent();
            }
        }
        profiles.appendChild(btnRemoveProfile);
        div.appendChild(profiles);

        const btns = document.createElement('div');
        btns.style.display = 'flex';
        btns.style.margin = '5px';
        btns.style.justifyContent = 'center';
        div.appendChild(btns);
        this.btnPlay = document.createElement('button');
        this.btnPlay.innerHTML = `Играть`;
        this.btnPlay.onclick = async() => {
            const v = this.versions.find(e => e.name == listVersions.value);
            const p = this.profiles.find(e => e.name == listProfiles.value);
            if(v) {
                if(!p){
                    const e = confirm(`у вас нет профиля. Вы можете создать его в лаунчере, вы уверены что будете входить в игре?\n\nС профилем автоматический вход будет`);
                    if(!e) {
                        btnAddProfile.style.transition = '1s'
                        btnAddProfile.style.transform = 'scale(5)';
                        await wait(1000);
                        btnAddProfile.style.transform = 'none';
                        return;
                    }
                }
                this.runGame(v, p);
            } else {
                alert(`Не найдена версия`);
                btnAddVersion.style.transition = '1s'
                btnAddVersion.style.transform = 'scale(5)';
                await wait(1000);
                btnAddVersion.style.transform = 'none';
            }
        };
        btns.appendChild(this.btnPlay);

        for await(const ver of updateVersions){
            this.statusText.textContent = 'Проверка..';
            
            const version = await this.readVersion(ver.scriptPath!);
            if(version) await this.downloadVersion({...version, ...ver});
        }
    }

    addProfile(){
        const self = this;
        this.win.lock();
        let webSocket: WebSocket;
        const width = isMobile() ? window.innerWidth-150 : 300
        const win = new Window({
            title: 'Добавление профиля',
            width,
            height: 220,
            resizable: false,
            moveable: false,
            noMobile: true,
            minButton: false,
            maxButton: false,
            x: this.win.x + (this.win.width - width) / 2,
            y: this.win.y + (this.win.height - 200) / 2,
        });
        win.content.style.overflow = 'hidden'
        win.on('close', () => {
            this.win.unlock();
        });

        const div = document.createElement('div');
        div.style.padding = '10px';
        win.content.appendChild(div);

        const status = document.createElement('div');
        status.innerHTML = `Подключение к серверу..`
        status.style.textAlign = 'center';
        const inputEmail = document.createElement('input');
        inputEmail.style.width = '-webkit-fill-available';
        inputEmail.placeholder = 'e-mail или никнейм';
        div.appendChild(inputEmail);
        const inputPassword = document.createElement('input');
        inputPassword.style.width = '-webkit-fill-available';
        inputPassword.placeholder = 'пароль';
        div.appendChild(inputPassword);
        const or = document.createElement('div');
        or.style.textAlign = 'center';
        or.style.width = '100%';
        or.style.margin = '2px';
        or.innerHTML = 'или';
        div.appendChild(or);
        const inputToken = document.createElement('input');
        inputToken.style.width = '-webkit-fill-available';
        inputToken.placeholder = 'токен';
        div.appendChild(inputToken);
        const inputUserId = document.createElement('input');
        inputUserId.style.width = '-webkit-fill-available';
        inputUserId.placeholder = 'ID пользователя';
        div.appendChild(inputUserId);
        const btn = document.createElement('button');
        btn.style.width = '100%'
        btn.innerHTML = 'Создать';
        btn.disabled = true;

        function createWebSocket(){
            webSocket = new WebSocket(uriServer);
            webSocket.onerror = e => console.error(e);
            webSocket.onmessage = async e => {
                const json = JSON.parse(e.data);

                if(json[PacketDataKeys.TYPE] == PacketDataKeys.SIGN_IN_ERROR){
                    btn.disabled = false;
                    status.innerHTML = `Ошибка. Код ошибки: ${json[PacketDataKeys.ERROR]}`;
                    status.style.color = 'red';
                } else if(json[PacketDataKeys.TYPE] == PacketDataKeys.USER_SIGN_IN){
                    self.profiles.push({
                        name: json[PacketDataKeys.USER][PacketDataKeys.USERNAME],
                        email: inputEmail.value,
                        password: inputPassword.value,
                        token: json[PacketDataKeys.USER][PacketDataKeys.TOKEN],
                        userId: json[PacketDataKeys.USER][PacketDataKeys.OBJECT_ID]
                    });
                    await self.writeData();
                    win.close();
                    self.#initContent();
                }
                console.log(json);
            }
            webSocket.onopen = () => {
                status.innerHTML = `Подключено`
                btn.disabled = false;
            }
            webSocket.onclose = () => {
                btn.disabled = true;
                status.innerHTML = `Соединение закрыто.. Нажмите чтобы переподключиться`
                status.onclick = () => {
                    status.innerHTML = `Подключение к серверу..`
                    status.onclick = null;
                    createWebSocket();
                }
            }
        }
        createWebSocket();

        btn.onclick = () => {
            status.innerHTML = ``;
            
            if(inputEmail.value != '' && inputPassword.value != ''){
                btn.disabled = true;
                webSocket.send(JSON.stringify({
                    [PacketDataKeys.TYPE]: PacketDataKeys.SIGN_IN,
                    [PacketDataKeys.EMAIL]: inputEmail.value,
                    [PacketDataKeys.PASSWORD]: MD5(inputPassword.value),
                    [PacketDataKeys.DEVICE_ID]: tokenHex(8)
                }));
            } else if(inputToken.value != '' && inputUserId.value != '') {
                btn.disabled = true;
                webSocket.send(JSON.stringify({
                    [PacketDataKeys.TYPE]: PacketDataKeys.SIGN_IN,
                    [PacketDataKeys.OBJECT_ID]: inputUserId.value,
                    [PacketDataKeys.TOKEN]: inputToken.value
                }));
            }
        }
        div.appendChild(btn);
        div.appendChild(status);
        
        const why = document.createElement('div');
        why.style.width = '100%'
        why.style.textAlign = 'center';
        why.style.fontSize = '12px';
        why.style.color = '#8888f8';
        why.style.textDecoration = 'underline';
        why.style.cursor = 'pointer';
        why.style.userSelect = 'none';
        why.innerHTML = 'Почему?';
        why.onclick = () => {
            alert(`Мы не собираем данные аккаунтов\n\nНаш исходный код открыт https://github.com/lumik0/bafiaonline\n\nВы в любом случае можете войти с второго аккаунта`);
        }
        div.appendChild(why);
        
        const whereIsReg = document.createElement('div');
        whereIsReg.style.width = '100%'
        whereIsReg.style.textAlign = 'center';
        whereIsReg.style.fontSize = '12px';
        whereIsReg.style.color = '#8888f8';
        whereIsReg.style.textDecoration = 'underline';
        whereIsReg.style.cursor = 'pointer';
        whereIsReg.style.userSelect = 'none';
        whereIsReg.innerHTML = 'А где регистрация?';
        whereIsReg.onclick = () => {
            alert(`потом будет`);
        }
        div.appendChild(whereIsReg);
    }

    async addVersion(version?: Version){
        const self = this;
        if(version){
            if(!(await fs.existsFile(`${version.path}/config.json`))){
                const conf = config();
                conf.path = version.path;
                await fs.writeFile(`${version.path}/config.json`, JSON.stringify(conf));
            }
            if(!version.uuid) version.uuid = uuidv4();
            const i = this.versions.findIndex(e => e.path == version.path)
            if(i != -1) {
                this.versions[i] = version;
            } else {
                this.versions.push(version);
            }
            await this.writeData();
            if(i == -1) await this.#initContent(false);
            return;
        }
        this.win.lock();
        const width = isMobile() ? window.innerWidth-150 : 300
        const win = new Window({
            title: 'Добавление версии',
            width,
            height: 200,
            resizable: false,
            moveable: false,
            noMobile: true,
            minButton: false,
            maxButton: false,
            x: this.win.x + (this.win.width - width) / 2,
            y: this.win.y + (this.win.height - 200) / 2,
        });
        win.content.style.overflow = 'hidden'
        win.on('close', () => {
            this.win.unlock();
        });

        const btnLoadFile = document.createElement('button');
        btnLoadFile.style.width = '100%'
        btnLoadFile.innerHTML = 'Загрузить файл';
        btnLoadFile.onclick = () => this.readDownloadVersion();
        win.content.appendChild(btnLoadFile);

        const div = document.createElement('div');
        div.style.display = 'flex';
        const inputPathScript = document.createElement('input');
        inputPathScript.placeholder = `Путь к скрипту`;
        div.appendChild(inputPathScript);
        const btnLoadScript = document.createElement('button');
        btnLoadScript.style.width = '100%'
        btnLoadScript.innerHTML = 'Загрузить скрипт';
        btnLoadScript.onclick = async() => {
            const src = inputPathScript.value;
            try{
                const version = await this.readVersion(src);
                if(version){
                    win.lock();
                    await self.downloadVersion({...version, scriptPath: src});
                    win.close();
                } else {
                    alert(`Ошибка: ${e}`);
                }
            } catch(e) {
                alert(`Ошибка: ${e}`);
            }
        }
        div.appendChild(btnLoadScript);
        win.content.appendChild(div);

        const foundScripts = document.createElement('div');
        foundScripts.style.display = 'flex';
        foundScripts.style.flexDirection = 'column';
        const e = document.createElement('p');
        e.style.margin = '5px'
        e.textContent = `Найдены версии:`;
        foundScripts.appendChild(e);
        const urls = JSON.parse(await fs.readFile(`/urlsVersions.json`));
        let found = false;
        for await(const url of urls){
            try{
                const version = await this.readVersion(url);
                if(version){
                    const e = document.createElement('button');
                    e.textContent = noXSS(url);
                    e.onclick = async() => {
                        win.lock();
                        await self.downloadVersion({...version, scriptPath: url});
                        win.close();
                    }
                    foundScripts.appendChild(e);
                    found = true;
                }
            } catch{}
        }
        if(found) win.content.appendChild(foundScripts);
    }
    async downloadVersion(version: Version){
        const self = this;
        const dirName = version.name.replaceAll(`/`,`_`);
        if(!version.path) version.path = `/versions/${dirName}`;
        let size = 0, total = 0;
        this.btnPlay.disabled = true;
        await readImage('image', `${version.path}/`, false, {
            startProcessFS(s) {
                size = s;
                self.progressBar.max = s;
            },
            processFS(path, write) {
                total++
                self.progressBar.value = total
                if(write) {
                    self.statusText.textContent = `Скачан файл (${total}/${size})`;
                    console.log(`downloading..`, path);
                } else
                    self.statusText.textContent = `Проверка (${total}/${size})`;
            },
        });
        this.btnPlay.disabled = false;
        self.statusText.textContent = ``;
        self.addVersion(version);
    }

    readDownloadVersion(){
        const self = this;
        const input = document.createElement('input');
        input.type = 'file';

        return new Promise<boolean>((res, rej) => {
            input.onchange = e => {
                if(!e.target) return;
                // @ts-ignore
                const file = e.target.files[0]; 

                const reader = new FileReader();
                reader.readAsText(file, 'UTF-8');
                // reader.readAsArrayBuffer(file);

                reader.onload = async readerEvent => {
                    // @ts-ignore
                    const content = readerEvent.target.result;
                    // @ts-ignore
                    window['eval'](content);
                    // @ts-ignore
                    const version = window['version'];
                    // @ts-ignore
                    delete window['version'];
                    await self.downloadVersion(version);
                    res(true);
                }
                reader.onerror = () => res(false);
            }
            
            input.click();
        });
    }

    async runGame(version: Version, profile?: Profile){
        const config = JSON.parse(await fs.readFile(`${version.path}/config.json`)) as Config;
        const mainScript = await fs.readFile(`${version.path}/main.js`);

        window['eval'](mainScript);

        // @ts-ignore
        if(!window['main']){
            console.error(`No main function`);
            return;
        }

        if(profile){
            config.auth = {
                email: profile.email,
                password: profile.password
                // token: profile.token,
                // userId: profile.userId
            }
        }

        const win = new Window({
            title: `${version.name}`,
            width: 400,
            height: 500,
            minWidth: 250,
            minHeight: 400,
            center: true,
            zoom: .7
        });

        // @ts-ignore
        window['main'](config, win, win.content);

        this.openedWindows.push(win);
    }
}