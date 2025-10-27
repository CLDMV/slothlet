/**
 * @fileoverview Simplified LG TV app functionality for testing.
 */
export function setApp(appName: any, _?: {}): Promise<{
    success: boolean;
    app: any;
}>;
export function getAllApps(): string[];
export function getCurrentApp(): string;
export function retrieveCurrentApp(_?: {}): Promise<{
    app: string;
    appId: string;
}>;
//# sourceMappingURL=app.d.mts.map