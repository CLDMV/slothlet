/**
 * @fileoverview Simplified command queue utilities for testing.
 */
export function addUserCommand(commandFunction: any, _?: {}): Promise<{
    success: boolean;
    id: string;
}>;
export function addUpdateCommand(commandFunction: any, _?: {}): Promise<{
    success: boolean;
    id: string;
}>;
export function queueUpdateCommands(updateCommands: any, _?: {}): Promise<{
    success: boolean;
    queued: any;
}>;
export function getPendingUserCommandCount(): number;
export function getPendingUpdateCommandCount(): number;
export function isUpdateCommandPending(commandId: any): boolean;
export function clearPendingUpdateCommands(_?: {}): {
    success: boolean;
    cleared: number;
};
export function getQueueStats(): {
    userCommands: number;
    updateCommands: number;
};
//# sourceMappingURL=command-queue.d.mts.map