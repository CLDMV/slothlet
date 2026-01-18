/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/multi_defaults/volume.mjs
 *	@Date: 2025-10-23 11:19:22 -07:00 (1761243562)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-23 11:20:11 -07:00 (1761243611)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */
export function up(step?: number): string;
export function down(step?: number): string;
export function mute(muted?: boolean): "Volume muted" | "Volume unmuted";
export default setVolume;
declare function setVolume(level: any): string;
//# sourceMappingURL=volume.d.mts.map