import { Config } from '@worldcoin/idkit';

declare const IDKit: {
    init: (config: Config) => void;
    update: (config: Config) => void;
    open: () => Promise<unknown>;
    close: () => Promise<unknown>;
    reset: () => void;
    readonly isInitialized: boolean;
};
declare global {
    interface Window {
        IDKit: typeof IDKit;
    }
}
