import fs from "../../../core/src/fs/fs";
import App from "../App";
import { Role } from "../enums";
import PacketDataKeys from "../../../core/src/PacketDataKeys";

export async function getAvatarImg(user?: any){
    if(!user) return App.resources['unknownChat'];
    const ph = user[PacketDataKeys.PHOTO];
    const uo = user[PacketDataKeys.OBJECT_ID];
    if(ph == "1") return `https://dottap.com/mafia/profile_photo/${uo}.jpg`;
    if(App.resources[`avatars_${uo}`]) return App.resources[`avatars_${uo}`];
    App.resources[`avatars_${uo}`] = await getDefaultAvatar(ph);
    return App.resources[`avatars_${uo}`];
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