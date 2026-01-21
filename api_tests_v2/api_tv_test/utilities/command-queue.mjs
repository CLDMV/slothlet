/**
 * @fileoverview Simplified command queue utilities for testing.
 */

export async function addUserCommand(commandFunction, _ = {}) {
	return { success: true, id: "user_cmd_1" };
}

export async function addUpdateCommand(commandFunction, _ = {}) {
	return { success: true, id: "update_cmd_1" };
}

export async function queueUpdateCommands(updateCommands, _ = {}) {
	return { success: true, queued: updateCommands.length };
}

export function getPendingUserCommandCount() {
	return 0;
}

export function getPendingUpdateCommandCount() {
	return 0;
}

export function isUpdateCommandPending(_) {
	return false;
}

export function clearPendingUpdateCommands(_ = {}) {
	return { success: true, cleared: 0 };
}

export function getQueueStats() {
	return { userCommands: 0, updateCommands: 0 };
}
