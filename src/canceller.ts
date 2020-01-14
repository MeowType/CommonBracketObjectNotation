export type Canceller = () => boolean
export type AsyncCanceller = () => Promise<boolean>

export function AlwaysFalse(): false { return false }