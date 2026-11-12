let n = 0;

/** `prefix` plus a number no other call in this build has returned, for ids a page may repeat. */
export const uid = (prefix: string): string => `${prefix}-${++n}`;
