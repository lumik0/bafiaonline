export default interface IWindow {
    isAlive: boolean
    isActivated: boolean
    isMaximum: boolean
    isLocked: boolean
    
    title: string
    x: number
    y: number
    width: number
    height: number
    minWidth: number
    minHeight: number
    titleBarHeight: number
    resizable: boolean
    moveable: boolean
    hasTitleBar: boolean
    closeButton: boolean
    minButton: boolean
    maxButton: boolean
    zoom: number

    activate: () => void
    deactivate: () => void
    lock: () => void
    unlock: () => void
    show: () => void
    hide: () => void
    min: () => void
    max: () => void
    close: (force?: boolean) => void
}