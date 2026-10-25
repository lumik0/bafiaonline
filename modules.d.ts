declare module "*.tsrx";
declare module "babel-preset-solid";
declare module "@babel/preset-typescript";

/** Встроенные моды: код, собранный в один скрипт (см. scripts/mod-plugin.ts) */
declare module "mod:*" {
  const code: string;
  export default code;
}
