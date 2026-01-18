/**
 * Plugin config file in config subfolder.
 * Should appear as api.plugins.config.{functions} (NOT flattened)
 */
export function getPluginConfig(): string;
export function setPluginConfig(value: any): string;
export namespace configDefaults {
    let enabled: boolean;
    let timeout: number;
}
//# sourceMappingURL=settings.d.mts.map