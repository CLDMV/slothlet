export namespace config {
    namespace defaults {
        let manufacturer: string;
        let host: string;
        let port: number;
    }
    function get(key: any): any;
    function update(keyOrConfig: any, value: any): {
        success: boolean;
        key: any;
        value: any;
    };
    function set(key: any, value: any): {
        success: boolean;
        key: any;
        value: any;
    };
    function getDefaultPort(_: any): number;
    function validate(config: any, _?: any[]): {
        isValid: boolean;
        missing: any[];
        config: any;
    };
    function merge(userConfig?: {}, _?: string): {
        manufacturer: string;
        host: string;
        port: number;
    };
    function createManufacturerConfig(manufacturer: any, options?: {}): {
        manufacturer: any;
    };
}
export default config;
//# sourceMappingURL=config.d.mts.map