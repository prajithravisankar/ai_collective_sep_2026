// Number formatting so every tab prints the same way.

export const lb = (n: number) => `${n.toFixed(1)} lb`;
export const pct = (n: number) => `${Math.round(n)}%`;
export const cuft = (n: number) => `${n.toFixed(1)} cu ft`;
export const cuin = (n: number) => `${Math.round(n).toLocaleString()} cu in`;
