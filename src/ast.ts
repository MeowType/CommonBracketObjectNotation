export abstract class Unit { }
export class Null extends Unit {}
export class Str extends Unit {
    val: string
    constructor(val: string) {
        super()
        this.val = val
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
export class Key extends Unit {
    key: string
    constructor(key: string) {
        super()
        this.key = key
    }
}
export class KeyVal extends Unit {
    key: Key
    val: Unit
    constructor(key: Key, val: Unit) {
        super()
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