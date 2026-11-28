/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/diff.mjs
 *	@Date: 2026-11-16T16:13:38-08:00 (1794874418)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:34-08:00 (1795869034)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Unified line diff (Myers) for the dry-run output.
 * @module @cldmv/slothlet-migrate/lib/diff
 * @internal
 */

/**
 * Shortest edit script between two line arrays.
 * @param {string[]} a - Old lines.
 * @param {string[]} b - New lines.
 * @returns {Array<{ op: " "|"-"|"+", line: string }>} Operations in order.
 */
export function diffLines(a, b) {
	const n = a.length;
	const m = b.length;
	const max = n + m;
	const offset = max + 1;
	const v = new Int32Array(2 * max + 3);
	const trace = [];
	outer: for (let d = 0; d <= max; d++) {
		trace.push(v.slice());
		for (let k = -d; k <= d; k += 2) {
			let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
			let y = x - k;
			while (x < n && y < m && a[x] === b[y]) {
				x++;
				y++;
			}
			v[offset + k] = x;
			if (x >= n && y >= m) break outer;
		}
	}
	const ops = [];
	let x = n;
	let y = m;
	for (let d = trace.length - 1; d >= 0; d--) {
		const t = trace[d];
		const k = x - y;
		const prevK = k === -d || (k !== d && t[offset + k - 1] < t[offset + k + 1]) ? k + 1 : k - 1;
		const prevX = t[offset + prevK];
		const prevY = prevX - prevK;
		while (x > prevX && y > prevY) {
			ops.push({ op: " ", line: a[x - 1] });
			x--;
			y--;
		}
		if (d > 0) {
			if (x === prevX) ops.push({ op: "+", line: b[--y] });
			else ops.push({ op: "-", line: a[--x] });
		}
	}
	return ops.reverse();
}

/**
 * Unified diff text.
 * @param {string} before - Old text.
 * @param {string} after - New text.
 * @param {string} file - File name for the header.
 * @param {number} [context] - Context lines.
 * @returns {string} Diff ("" when equal).
 */
export function unifiedDiff(before, after, file, context = 3) {
	if (before === after) return "";
	const a = before.split("\n");
	const b = after.split("\n");
	const ops = diffLines(a, b);
	const hunks = [];
	let i = 0;
	let oldLine = 1;
	let newLine = 1;
	const positions = ops.map((o) => {
		const p = { o, oldLine, newLine };
		if (o.op !== "+") oldLine++;
		if (o.op !== "-") newLine++;
		return p;
	});
	while (i < positions.length) {
		if (positions[i].o.op === " ") {
			i++;
			continue;
		}
		const start = Math.max(0, i - context);
		let end = i;
		while (end < positions.length) {
			if (positions[end].o.op !== " ") {
				end++;
				continue;
			}
			let run = end;
			while (run < positions.length && positions[run].o.op === " ") run++;
			if (run >= positions.length || run - end > context * 2) {
				end = Math.min(positions.length, end + context);
				break;
			}
			end = run;
		}
		const slice = positions.slice(start, end);
		const oldCount = slice.filter((p) => p.o.op !== "+").length;
		const newCount = slice.filter((p) => p.o.op !== "-").length;
		const head = `@@ -${slice[0].oldLine},${oldCount} +${slice[0].newLine},${newCount} @@`;
		hunks.push([head, ...slice.map((p) => p.o.op + p.o.line)].join("\n"));
		i = end;
	}
	return `--- a/${file}\n+++ b/${file}\n${hunks.join("\n")}\n`;
}
