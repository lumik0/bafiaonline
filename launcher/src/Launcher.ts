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

    options = {
        version: '',
        profile: '',
        theme: 'macos'
    }
    versions: Version[] = [];
    profiles: Profile[] = [];
    
    statusText!: HTMLDivElement
    progressBar!: HTMLProgressElement
    playBtn!: HTMLButtonElement
    updateBtn!: HTMLButtonElement
    
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
            this.playBtn.disabled = true;
            this.updateBtn.disabled = true;
            this.statusText.textContent = `Скачивание версии..`;
            console.log(`Downloading default version [vanilla]..`);
            try{
                const src = `https://raw.githubusercontent.com/lumik0/bafiaonline/refs/heads/master/run/images/vanilla.js?v=${Math.random()}`;
                const version = await this.readVersion(src);
                if(version) await this.downloadVersion({...version, scriptPath: src});
            }catch(e){
                console.error(e);
                this.playBtn.disabled = false;
                this.updateBtn.disabled = false;
            }
        }
    }

    async writeData(){
        await fs.writeFile(`/versions.json`, JSON.stringify(this.versions));
        await fs.writeFile(`/profiles.json`, JSON.stringify(this.profiles));
        await fs.writeFile(`/options.json`, JSON.stringify(this.options));
    }
    async readData(){
        if(!(await fs.existsFile('/urlsVersions.json'))) fs.writeFile(`/urlsVersions.json`, JSON.stringify(['./images/vanilla.js', './vanilla.js']));
        if(!(await fs.existsFile('/versions.json'))) fs.writeFile(`/versions.json`, '[]');
        if(!(await fs.existsFile('/profiles.json'))) fs.writeFile(`/profiles.json`, '[]');
        if(!(await fs.existsFile('/options.json'))) fs.writeFile(`/options.json`, JSON.stringify({
            version: '',
            profile: '',
            theme: 'macos'
        }));
        this.versions = JSON.parse(await fs.readFile(`/versions.json`));
        this.profiles = JSON.parse(await fs.readFile(`/profiles.json`));
        this.options = JSON.parse(await fs.readFile(`/options.json`));
    }

    async #initContent(checkVersions = true){
        const updateVersions: Version[] = [];
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
        listVersions.value = this.options.version;
        for(const ver of this.versions){
            const el = document.createElement('option');
            el.innerHTML = ver.name;
            if(ver.scriptPath && checkVersions) updateVersions.push(ver);
            listVersions.appendChild(el);
        }
        versions.appendChild(listVersions);
        const addVersionBtn = document.createElement('button');
        addVersionBtn.innerHTML = `+`;
        addVersionBtn.onclick = () => this.addVersion();
        versions.appendChild(addVersionBtn);
        const removeVersionBtn = document.createElement('button');
        removeVersionBtn.innerHTML = `-`;
        removeVersionBtn.onclick = async() => {
            const p = this.versions.findIndex(e => e.name == listVersions.value);
            if(p != -1){
                const version = this.versions[p];
                removeVersionBtn.disabled = true;
                this.versions.splice(p, 1);
                await fs.deleteDirectory(version.path, true);
                await this.writeData();
                this.#initContent();
            }
        }
        versions.appendChild(removeVersionBtn);
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
        listProfiles.value = this.options.profile;
        for(const pr of this.profiles){
            const el = document.createElement('option');
            el.innerHTML = pr.name;
            if(pr.name == '') {
                pr.name = 'Новый аккаунт';
                el.style.background = '#57e057';
            }
            listProfiles.appendChild(el);
        }
        profiles.appendChild(listProfiles);
        const addProfileBtn = document.createElement('button');
        addProfileBtn.innerHTML = `+`;
        addProfileBtn.onclick = () => this.addProfile();
        profiles.appendChild(addProfileBtn);
        const removeProfileBtn = document.createElement('button');
        removeProfileBtn.innerHTML = `-`;
        removeProfileBtn.onclick = async() => {
            const p = this.profiles.findIndex(e => e.name == listProfiles.value);
            if(p != -1){
                removeProfileBtn.disabled = true;
                this.profiles.splice(p, 1);
                await this.writeData();
                this.#initContent();
            }
        }
        profiles.appendChild(removeProfileBtn);
        div.appendChild(profiles);

        const btns = document.createElement('div');
        btns.style.display = 'flex';
        btns.style.margin = '5px';
        btns.style.justifyContent = 'center';
        div.appendChild(btns);
        this.playBtn = document.createElement('button');
        this.playBtn.innerHTML = `Играть`;
        this.playBtn.style.margin = '1px';
        this.playBtn.onclick = async() => {
            const v = this.versions.find(e => e.name == listVersions.value);
            const p = this.profiles.find(e => e.name == listProfiles.value);
            if(v) {
                if(!p){
                    const e = confirm(`у вас нет профиля. Вы можете создать его в лаунчере, вы уверены что будете входить в игре?\n\nС профилем автоматический вход будет`);
                    if(!e) {
                        addProfileBtn.style.transition = '1s'
                        addProfileBtn.style.transform = 'scale(5)';
                        await wait(1000);
                        addProfileBtn.style.transform = 'none';
                        return;
                    }
                }
                this.runGame(v, p);
            } else {
                alert(`Не найдена версия`);
                addVersionBtn.style.transition = '1s'
                addVersionBtn.style.transform = 'scale(5)';
                await wait(1000);
                addVersionBtn.style.transform = 'none';
            }
        };
        btns.appendChild(this.playBtn);

        this.updateBtn = document.createElement('button');
        this.updateBtn.innerHTML = `Обновить`;
        this.updateBtn.style.margin = '1px';
        this.updateBtn.onclick = async() => {
            for await(const ver of updateVersions){
                this.statusText.textContent = 'Проверка..';
                
                const version = await this.readVersion(ver.scriptPath!);
                if(version) await this.downloadVersion({...version, ...ver});
            }
        }
        btns.appendChild(this.updateBtn);

        const githubBtn = document.createElement('button');
        githubBtn.innerHTML = `Github`;
        githubBtn.style.margin = '1px';
        githubBtn.onclick = () => window.open('https://github.com/lumik0/bafiaonline', '_blank');
        btns.appendChild(githubBtn);

        this.updateBtn.click();
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
                    const u = json[PacketDataKeys.USER][PacketDataKeys.USERNAME];
                    if(u == '') return;
                    self.profiles.push({
                        name: u,
                        email: inputEmail.value,
                        password: inputPassword.value,
                        token: json[PacketDataKeys.USER][PacketDataKeys.TOKEN],
                        userId: json[PacketDataKeys.USER][PacketDataKeys.OBJECT_ID]
                    });
                    await self.writeData();
                    win.close();
                    self.#initContent();
                } else if(json[PacketDataKeys.TYPE] == PacketDataKeys.USERNAME_HAS_WRONG_SYMBOLS){
                    alert(`Для никнейма вы можете использовать только 0-9 а-Я a-Z символы`);
                    const uu = prompt(`Для игры и общения с другими игроками у вас должен быть установлен Никнэйм`);
                    webSocket.send(JSON.stringify({
                        [PacketDataKeys.TYPE]: PacketDataKeys.USERNAME_SET,
                        [PacketDataKeys.OBJECT_ID]: inputUserId.value,
                        [PacketDataKeys.TOKEN]: inputToken.value,
                        [PacketDataKeys.USERNAME]: uu
                    }));
                } else if(json[PacketDataKeys.TYPE] == PacketDataKeys.USERNAME_IS_EXISTS){
                    alert(`Данный никнейм уже зарегистрирован`);
                    const uu = prompt(`Для игры и общения с другими игроками у вас должен быть установлен Никнэйм`);
                    webSocket.send(JSON.stringify({
                        [PacketDataKeys.TYPE]: PacketDataKeys.USERNAME_SET,
                        [PacketDataKeys.OBJECT_ID]: inputUserId.value,
                        [PacketDataKeys.TOKEN]: inputToken.value,
                        [PacketDataKeys.USERNAME]: uu
                    }));
                } else if(json[PacketDataKeys.TYPE] == PacketDataKeys.USERNAME_IS_OUT_OF_BOUNDS){
                    alert(`Никнейм слишком короткий или длинный.\nНикнейм должен состоять из 3-12 символы`);
                    const uu = prompt(`Для игры и общения с другими игроками у вас должен быть установлен Никнэйм`);
                    webSocket.send(JSON.stringify({
                        [PacketDataKeys.TYPE]: PacketDataKeys.USERNAME_SET,
                        [PacketDataKeys.OBJECT_ID]: inputUserId.value,
                        [PacketDataKeys.TOKEN]: inputToken.value,
                        [PacketDataKeys.USERNAME]: uu
                    }));
                } else if(json[PacketDataKeys.TYPE] == PacketDataKeys.USERNAME_IS_EMPTY){
                    alert(`Никнейм не может быть пустым`);
                    const uu = prompt(`Для игры и общения с другими игроками у вас должен быть установлен Никнэйм`);
                    webSocket.send(JSON.stringify({
                        [PacketDataKeys.TYPE]: PacketDataKeys.USERNAME_SET,
                        [PacketDataKeys.OBJECT_ID]: inputUserId.value,
                        [PacketDataKeys.TOKEN]: inputToken.value,
                        [PacketDataKeys.USERNAME]: uu
                    }));
                } else if(json[PacketDataKeys.TYPE] == PacketDataKeys.USERNAME_SET){
                    const acc = self.profiles.find(e => e.name == '');
                    if(!acc){
                        alert('Нет аккаунта');
                        return;
                    }
                    acc.name = json[PacketDataKeys.USERNAME];
                    await self.writeData();
                    win.close();
                    self.#initContent();
                } else if(json[PacketDataKeys.TYPE] == PacketDataKeys.USER_RESET_PASSWORD_SENDED){
                    alert(`Отправлено письмо на сброс пароля`);
                } else if(json[PacketDataKeys.TYPE] == PacketDataKeys.USER_WITH_EMAIL_NOT_EXISTS){
                    alert(`Пользователь с таким email не найден. Возможно, вы забыли свой email?`);
                } else if(json[PacketDataKeys.TYPE] == PacketDataKeys.USTMR){
                    alert(`Вы можете запросить сброс пароля после ${json[PacketDataKeys.USRSFR]} секунд`);
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

        const regBtn = document.createElement('button');
        regBtn.style.width = '100%'
        regBtn.innerHTML = 'Регистрация';
        regBtn.onclick = async() => {
            if(this.profiles.find(e => e.name == '')){
                const uu = prompt(`Найден аккаунт без никнейма.\nДля игры и общения с другими игроками у вас должен быть установлен Никнэйм`);
                webSocket.send(JSON.stringify({
                    [PacketDataKeys.TYPE]: PacketDataKeys.USERNAME_SET,
                    [PacketDataKeys.OBJECT_ID]: inputUserId.value,
                    [PacketDataKeys.TOKEN]: inputToken.value,
                    [PacketDataKeys.USERNAME]: uu
                }));
                return;
            }

            if(inputEmail.value != '' && inputPassword.value != ''){
                const data = await fetch(`https://api.mafia.dottap.com/user/sign_up`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                    },
                    body: new URLSearchParams({
                        email: inputEmail.value,
                        username: '',
                        password: MD5(inputPassword.value),
                        deviceId: tokenHex(8),
                        lang: 'RUS'
                    })
                });
                const result = await data.json();
                if(result.error){
                    if(result.error == 'USING_TEMP_EMAIL'){
                        alert(`Запрещено использовать сервисы для временной регистрации email.\nИспользуйте популярные сервисы, например Gmail, Mail.Ru, Yandex, Yahoo и тд.`);
                    } else if(result.error == 'EMAIL_EXISTS'){
                        alert(`Данный email уже зарегистрирован`);
                    }
                    return;
                }

                if(result[PacketDataKeys.OBJECT_ID]){
                    btn.disabled = true;

                    self.profiles.push({
                        name: '',
                        email: inputEmail.value,
                        password: inputPassword.value,
                        token: result[PacketDataKeys.TOKEN],
                        userId: result[PacketDataKeys.OBJECT_ID]
                    });
                    this.writeData();

                    const uu = prompt(`Для игры и общения с другими игроками у вас должен быть установлен Никнэйм`);
                    webSocket.send(JSON.stringify({
                        [PacketDataKeys.TYPE]: PacketDataKeys.USERNAME_SET,
                        [PacketDataKeys.OBJECT_ID]: inputUserId.value,
                        [PacketDataKeys.TOKEN]: inputToken.value,
                        [PacketDataKeys.USERNAME]: uu
                    }));
                }
            }
        }
        div.appendChild(regBtn);

        div.appendChild(status);

        const links = document.createElement('div');
        links.style.display = 'flex';
        links.style.justifyContent = 'center';
        div.appendChild(links);
        
        const why = document.createElement('div');
        why.style.margin = '3px';
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
        links.appendChild(why);
        
        const forgetPass = document.createElement('div');
        forgetPass.style.margin = '3px';
        forgetPass.style.textAlign = 'center';
        forgetPass.style.fontSize = '12px';
        forgetPass.style.color = '#8888f8';
        forgetPass.style.textDecoration = 'underline';
        forgetPass.style.cursor = 'pointer';
        forgetPass.style.userSelect = 'none';
        forgetPass.innerHTML = 'Забыл пароль?';
        forgetPass.onclick = () => {
            const email = prompt(`Для сброса пароля, пожалуйста, введите зарегистрированный в игре email`);
            if(email != '') webSocket.send(JSON.stringify({
                [PacketDataKeys.TYPE]: PacketDataKeys.USER_RESET_PASSWORD,
                [PacketDataKeys.EMAIL]: email,
                [PacketDataKeys.APP_LANGUAGE]: 'RUS',
            }));
        }
        links.appendChild(forgetPass);
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

        const loadFileBtn = document.createElement('button');
        loadFileBtn.style.width = '100%'
        loadFileBtn.innerHTML = 'Загрузить файл';
        loadFileBtn.onclick = () => this.readDownloadVersion();
        win.content.appendChild(loadFileBtn);

        const div = document.createElement('div');
        div.style.display = 'flex';
        const inputPathScript = document.createElement('input');
        inputPathScript.placeholder = `Путь к скрипту`;
        div.appendChild(inputPathScript);
        const loadScriptBtn = document.createElement('button');
        loadScriptBtn.style.width = '100%'
        loadScriptBtn.innerHTML = 'Загрузить скрипт';
        loadScriptBtn.onclick = async() => {
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
        div.appendChild(loadScriptBtn);
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
        let size = 0, total = 0, updated = false;
        this.playBtn.disabled = true;
        this.updateBtn.disabled = true;
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
                    updated = true;
                } else
                    self.statusText.textContent = `Проверка (${total}/${size})`;
            },
        });
        this.playBtn.disabled = false;
        this.updateBtn.disabled = false;
        self.statusText.textContent = updated ? `Обновлено` : '';
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
        if(this.options.version != version.name || this.options.profile != profile?.name){
            this.options.version = version.name;
            this.options.profile = profile ? profile.name : '';
            this.writeData();
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