export class TkPos {
    count: number
    char: number
    line: number
    constructor(count: number, char: number, line: number) {
        this.count = count
        this.char = char
        this.line = line
    }
}
export class TkRange {
    from: TkPos
    to: TkPos
    constructor(from: TkPos, to: TkPos) {
        this.from = from
        this.to = to
    }
}