import fs from "../../../core/src/fs/fs";
import App from "../App";
import { Role } from "../enums";
import PacketDataKeys from "../../../core/src/PacketDataKeys";

export async function getAvatarImg(user?: any): Promise<string> {
    if(!user) return App.resources['unknownChat'];

    const ph = user[PacketDataKeys.PHOTO];
    const uo = user[PacketDataKeys.OBJECT_ID];

    if(App.resources[`avatars_${uo}`]) {
        return App.resources[`avatars_${uo}`];
    }

    const defaultImage = async () => {
        const avatar = await getDefaultAvatar(ph);
        App.resources[`avatars_${uo}`] = avatar;
        return avatar;
    };

    const avatarUrl = `https://dottap.com/mafia/profile_photo/${uo}.jpg`;

    const loadImage = () =>
        new Promise<string>((resolve) => {
            const img = new Image();
            let finished = false;

            img.onload = () => {
                finished = true;
                App.resources[`avatars_${uo}`] = avatarUrl;
                resolve(avatarUrl);
            };

            img.onerror = async () => {
                if(!finished) {
                    finished = true;
                    resolve(await defaultImage());
                }
            };

            img.src = avatarUrl;

            setTimeout(async () => {
                if(!finished) {
                    finished = true;
                    resolve(await defaultImage());
                }
            }, 10000);
        });

    return loadImage();
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