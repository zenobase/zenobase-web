import type { InjectionKey } from 'vue';

export const reloadBucketsKey: InjectionKey<() => void> = Symbol('reloadBuckets');
