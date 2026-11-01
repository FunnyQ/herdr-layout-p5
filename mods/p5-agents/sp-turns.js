// SP as 100 minus the turns taken. Copy this file to sp.js to use it;
// sp-context.js is the alternative.

export const startSp = () => {};

export const sp = (_address, turn) => Math.max(0, 100 - turn);
