export abstract class Unit { }
export class Null extends Unit {}
export class Str extends Unit {
    val: string
    col: '"' | "'"
    constructor(val: string, col: '"' | "'") {
        super()
        this.val = val
        this.col = col
    }
}
export class Num extends Unit {
    val: number
    constructor(val: number) {
        super()
        this.val = val
    }
}
export class Bool extends Unit {
    val: boolean
    constructor(val: boolean) {
        super()
        this.val = val
    }
}
export class Key {
    key: string | Str
    constructor(key: string | Str) {
        this.key = key
    }
}
export class KeyVal {
    key: Key
    val: Unit
    constructor(key: Key, val: Unit) {
        this.key = key
        this.val = val
    }
}
export class Block extends Unit {
    items: KeyVal[]
    constructor(items: KeyVal[]) {
        super()
        this.items = items
    }
}
export class Arr extends Unit {
    items: Unit[]
    constructor(items: Unit[]) {
        super()
        this.items = items
    }
}
export class Docs extends Unit {
    items: (Block | Arr)[]
    constructor(items: (Block | Arr)[]) {
        super()
        this.items = items
    }
}