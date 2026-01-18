/**
 * @fileoverview Simplified TV app management functionality for testing.
 */
export function setApp(appName: any, _?: {}): Promise<{
    success: boolean;
    app: any;
}>;
export function getCurrentApp(): string;
export function getAllApps(): string[];
export function retrieveCurrentApp(_?: {}): Promise<{
    app: string;
    appId: string;
}>;
//# sourceMappingURL=app.d.mts.map