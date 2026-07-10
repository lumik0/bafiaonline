import fs from "../../../core/src/fs/fs";
import App from "../App";
import { Role } from "../enums";
import PacketDataKeys from "../../../core/src/PacketDataKeys";

let activeRequests = 0;
const imageQueue: { url: string; resolve: (value: string) => void }[] = [];
const MAX_CONCURRENT_REQUESTS = 5;
const pendingPromises: Map<string, Promise<string>> = new Map();
function processQueue() {
  if(imageQueue.length === 0 || activeRequests >= MAX_CONCURRENT_REQUESTS) return;
  
  const { url, resolve } = imageQueue.shift()!;
  activeRequests++;
  
  const img = new Image();
  let finished = false;
  let timeoutId: number;
  
  img.onload = () => {
    if(finished) return;
    finished = true;
    clearTimeout(timeoutId);
    activeRequests--;
    resolve(url);
    processQueue();
  };
  
  img.onerror = () => {
    if(finished) return;
    finished = true;
    clearTimeout(timeoutId);
    activeRequests--;
    resolve(null as any);
    processQueue();
  };
  
  img.src = url;
  
  timeoutId = window.setTimeout(() => {
    if(!finished) {
      finished = true;
      activeRequests--;
      resolve(null as any);
      processQueue();
    }
  }, 5000);
}
function loadImageWithQueue(url: string, cacheKey: string): Promise<string> {
  if(App.resources[cacheKey]) {
    return Promise.resolve(App.resources[cacheKey]);
  }
  
  const promiseKey = `url_${url}`;
  if(pendingPromises.has(promiseKey)) {
    return pendingPromises.get(promiseKey)!;
  }
  
  const promise = new Promise<string>((resolve) => {
    imageQueue.push({ 
      url, 
      resolve(result) {
        pendingPromises.delete(promiseKey);
        if(result) {
          App.resources[cacheKey] = result;
        }
        resolve(result);
      }
    });
    processQueue();
  });
  
  pendingPromises.set(promiseKey, promise);
  return promise;
}
export async function getAvatarImg(user?: any): Promise<string> {
  if(user == 'Бармен') return App.resources['barmanChat'];
  if(user == 'Информатор') return App.resources['unknownChat'];
  if(user == 'Мафия') return App.resources['mafiaChat'];
  if(!user || typeof user == 'string') return App.resources['unknownChat'];

  const ph = user[PacketDataKeys.PHOTO] ?? user.photo;
  const uo = user[PacketDataKeys.OBJECT_ID] ?? user[PacketDataKeys.PLAYER_OBJECT_ID] ?? user.playerObjectId;

  const cacheKey = `avatars_${ph}`;
  if(App.resources[cacheKey]) {
    return App.resources[cacheKey];
  }

  const pendingKey = `avatar_${ph}`;
  if(pendingPromises.has(pendingKey)) {
    return pendingPromises.get(pendingKey)!;
  }

  const defaultImage = async () => {
    const avatar = await getDefaultAvatar(ph);
    App.resources[cacheKey] = avatar;
    return avatar;
  };

  const avatarPromise = (async () => {
    const photoUrl = `https://dottap.com/mafia/profile_photo/${ph}`;
    const byPhoto = await loadImageWithQueue(photoUrl, cacheKey);
    if(byPhoto) {
      pendingPromises.delete(pendingKey);
      return byPhoto;
    }

    const objectIdUrl = `https://dottap.com/mafia/profile_photo/${uo}?v=${Math.random()}`;
    const byObjectId = await loadImageWithQueue(objectIdUrl, cacheKey);
    if(byObjectId) {
      pendingPromises.delete(pendingKey);
      return byObjectId;
    }
    
    const defaultImg = await defaultImage();
    pendingPromises.delete(pendingKey);
    return defaultImg;
  })();

  pendingPromises.set(pendingKey, avatarPromise);
  
  return avatarPromise;
}
export async function getDefaultAvatar(ph = ""){
  if(App.resources[`defaultAvatars_${ph}`]) return App.resources[`defaultAvatars_${ph}`];
  App.resources[`defaultAvatars_${ph}`] = await fs.loadImageAsDataURL(`${App.config.path}/assets/textures/logo/avatar.jpg`);
  return App.resources[`defaultAvatars_${ph}`];
}
export async function getRoleImg(role: Role){
  if(App.resources[`role_${role}`]) return App.resources[`role_${role}`];
  App.resources[`role_${role}`] = await fs.loadImageAsDataURL(`${App.config.path}/assets/textures/roles/${role}.png`);
  return App.resources[`role_${role}`];
}
export async function getBackgroundImg(bg: string){
  if(App.resources[`background_${bg}`]) return App.resources[`background_${bg}`]
  App.resources[`background_${bg}`] = await fs.loadImageAsDataURL(`${App.config.path}/assets/textures/backgrounds/${bg}.png`);
  return App.resources[`background_${bg}`]
}
export async function getTexture(path: string){
  if(App.resources[`assets/textures/`+path]) return App.resources[`assets/textures/`+path]
  App.resources[`assets/textures/`+path] = await fs.loadImageAsDataURL(`${App.config.path}/assets/textures/${path}`);
  return App.resources[`assets/textures/`+path];
}
export async function getImage(path: string){
  if(App.resources[path]) return App.resources[path];
  App.resources[path] = await fs.loadImageAsDataURL(`${App.config.path}/${path}`);
  return App.resources[path];
}
