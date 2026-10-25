import Events from "../../utils/emitter";

/** карта экранов: имя → параметры. `{ menu: {}, room: { id: string } }` */
export type RouteMap = Record<string, object>;

export interface Entry<R extends RouteMap, K extends keyof R = keyof R> {
  /** уникален даже для одного и того же экрана, открытого дважды */
  key: number
  name: K
  params: R[K]
}

export type TransitionType = "push" | "pop" | "replace" | "reset" | "none";

export interface Transition<R extends RouteMap> {
  type: TransitionType
  from?: Entry<R>
  to: Entry<R>
  /** false - перехода рисовать не нужно (жест «назад» уже доехал сам) */
  animate: boolean
}

/** как рисуется каждый экран: имя → функция от параметров */
export type Screens<R extends RouteMap> = {
  [K in keyof R]: (props: { params: R[K], navigator: Navigator<R> }) => unknown
};

type Params<R extends RouteMap, K extends keyof R> = {} extends R[K] ? [params?: R[K]] : [params: R[K]];

let nextKey = 1;

/** стек экранов как на Android: открыть поверх, вернуться назад. Анимации рисует NavHost */
export class Navigator<R extends RouteMap> extends Events<{ change: (transition: Transition<R>) => void }> {
  private stack: Entry<R>[] = [];

  /** нижний экран нельзя закрыть «назад» */
  get canGoBack() { return this.stack.length > 1; }
  get top(): Entry<R> | undefined { return this.stack.at(-1); }
  get previous(): Entry<R> | undefined { return this.stack.at(-2); }
  get depth() { return this.stack.length; }

  private entry<K extends keyof R>(name: K, params: R[K] | undefined): Entry<R, K> {
    return { key: nextKey++, name, params: (params ?? {}) as R[K] };
  }

  push<K extends keyof R>(name: K, ...[params]: Params<R, K>) {
    const from = this.top;
    const to = this.entry(name, params);
    this.stack.push(to as Entry<R>);
    this.emit("change", { type: "push", from, to: to as Entry<R>, animate: !!from });
  }

  /** возвращает false, если назад идти некуда */
  pop(animate = true): boolean {
    if(!this.canGoBack) return false;
    const from = this.stack.pop()!;
    this.emit("change", { type: "pop", from, to: this.top!, animate });
    return true;
  }

  /** заменяет верхний экран (например, вход → меню): в историю «назад» первый не попадает */
  replace<K extends keyof R>(name: K, ...[params]: Params<R, K>) {
    const from = this.stack.pop();
    const to = this.entry(name, params);
    this.stack.push(to as Entry<R>);
    this.emit("change", { type: "replace", from, to: to as Entry<R>, animate: !!from });
  }

  /** очищает историю и открывает экран как корневой (выход из аккаунта) */
  reset<K extends keyof R>(name: K, ...[params]: Params<R, K>) {
    const from = this.top;
    const to = this.entry(name, params);
    this.stack = [to as Entry<R>];
    this.emit("change", { type: "reset", from, to: to as Entry<R>, animate: !!from });
  }
}
