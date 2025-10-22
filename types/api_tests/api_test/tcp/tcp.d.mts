export namespace tcp {
    /**
     * Test context availability in the tcp module.
     * @function testContext
     * @returns {object} Context test results
     */
    function testContext(): object;
    /**
     * Create a test TCP server that tests context propagation in EventEmitter callbacks.
     * @function createTestServer
     * @param {number} [port=0] - Port to listen on (0 for random)
     * @returns {Promise<{port: number, server: NetServer}>} Server instance and port
     */
    function createTestServer(port?: number): Promise<{
        port: number;
        server: NetServer;
    }>;
}
export type NetServer = import("node:net").Server;
//# sourceMappingURL=tcp.d.mts.map