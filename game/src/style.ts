import fs from "../../core/src/fs/fs";
import { getCSS } from "../../core/src/utils/utils";
import App from "./App";

function applyImportant(obj: any): void {
    for(const key in obj) {
        const value = obj[key];

        if(typeof value === "string") {
            if(!value.includes("!important")) {
                obj[key] = value + " !important";
            }
        } else if(typeof value === "object" && value !== null) {
            applyImportant(value);
        }
    }
}

async function readCSS(path: string){
    const obj = JSON.parse(await fs.readFile(path));
    obj[`#${App.element.id}`] = obj[`&`];
    delete obj[`&`];
    
    // applyImportant(obj);

    return obj;
}

export default async function(path: string): Promise<HTMLStyleElement>{
    const mainCSS = await readCSS(path);

    const style = document.createElement('style');
    style.innerHTML = getCSS(mainCSS);
    return style;
}