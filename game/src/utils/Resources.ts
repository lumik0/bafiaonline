import fs from "../../../core/src/fs/fs";
import App from "../App";
import { Role } from "../enums";
import PacketDataKeys from "../../../core/src/PacketDataKeys";

export async function getAvatarImg(user?: any): Promise<string> {
  if(!user) return App.resources['unknownChat'];

  const ph = user[PacketDataKeys.PHOTO] ?? user.photo;
  const uo = user[PacketDataKeys.OBJECT_ID] ?? user.objectId;

  const cacheKey = `avatars_${uo}`;
  if(App.resources[cacheKey]) {
    return App.resources[cacheKey];
  }

  const defaultImage = async () => {
    const avatar = await getDefaultAvatar(ph);
    App.resources[cacheKey] = avatar;
    return avatar;
  };

  const loadImage = (url: string) =>
    new Promise<string>((resolve) => {
      const img = new Image();
      let finished = false;

      img.onload = () => {
        if(finished) return;
        finished = true;
        App.resources[cacheKey] = url;
        resolve(url);
      };

      img.onerror = async () => {
        if(finished) return;
        finished = true;
        resolve(null as any);
      };

      img.src = url;

      setTimeout(() => {
        if(!finished) {
          finished = true;
          resolve(null as any);
        }
      }, 10000);
    });

  const byPhoto = await loadImage(`https://dottap.com/mafia/profile_photo/default/${ph}.jpg`);
  if(byPhoto) return byPhoto;

  const byObjectId = await loadImage(`https://dottap.com/mafia/profile_photo/${uo}.jpg?v=${Math.random()}`);

  if(byObjectId) return byObjectId;
  return defaultImage();
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
