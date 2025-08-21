export function setShutdown(fn: any): any;
export function createEngine(allOptions: any): Promise<{
    api: () => void;
    dispose: () => Promise<void>;
}>;
export function makeFacade2(portal: any): () => void;
