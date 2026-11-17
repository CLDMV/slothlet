/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/browser/serialize-tojson.browser.test.mjs
 *	@Date: 2026-11-16T00:02:33-08:00 (1794816153)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:09-08:00 (1794882489)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview In a browser, serializing data whose `toJSON` is its own leaves out each member the reader may not
 * read, as in Node.
 *
 * @description
 * Runs in a real browser. An in-memory owner module exports a class instance serializing through its prototype's
 * `toJSON`, one reading a private field, a plain object whose own `toJSON` gives other data, such an instance nested in
 * a plain object, and one held in an array; a reader serializes them. The expected answers are plain JavaScript's on
 * the same values with what the reader may not read left out.
 * @module tests/browser/serialize-tojson
 */

import { describe, it, expect } from "vitest";
import { self } from "@cldmv/slothlet/runtime";

/** A class whose instances serialize as their own members. */
class Settings {
	/**
	 * The instance's own members.
	 * @returns {object} A copy of them.
	 */
	toJSON() {
		return { ...this };
	}
}

/** A class whose instances serialize a private field and nested data. */
class Sealed {
	#hidden = "H";
	pub = 1;
	/**
	 * The public member, the private one under `hidden`, and nested data.
	 * @returns {object} The serialized form.
	 */
	toJSON() {
		return { pub: this.pub, hidden: this.#hidden, deep: { hidden: "H", ok: 2 } };
	}
}

const held = { pub: 1, hidden: "H" };

/**
 * The owner's data, made fresh.
 * @returns {object} The exports.
 */
const data = () => ({
	cfg: Object.assign(new Settings(), { pub: 1, hidden: "H" }),
	sealed: new Sealed(),
	own: { pub: 1, toJSON: () => held },
	holder: { pub: 1, inner: new Sealed() },
	list: [Object.assign(new Settings(), { pub: 1, hidden: "H" })]
});

const NAMES = ["cfg", "sealed", "own", "holder", "list"];
const DENIED = ["cfg.hidden", "sealed.hidden", "sealed.deep.hidden", "own.hidden", "holder.inner.hidden", "list.0.hidden"];

/**
 * Plain JavaScript's serialization of each export, with the members at the denied paths left out.
 * @param {string[]} denied - Paths below `owner`.
 * @returns {Record<string, string>} The JSON text by export.
 */
function expected(denied) {
	const plain = data();
	const out = {};
	for (const name of NAMES) {
		const value = JSON.parse(JSON.stringify(plain[name]));
		for (const path of denied.filter((p) => p.startsWith(`${name}.`))) {
			const keys = path.split(".").slice(1);
			const last = keys.pop();
			const holder = keys.reduce((node, key) => node?.[key], value);
			if (holder) delete holder[last];
		}
		out[name] = JSON.stringify(value);
	}
	return out;
}

describe.each(["eager", "lazy"].flatMap((mode) => ["precise", "fast"].map((attribution) => ({ mode, attribution }))))(
	"browser serialization through a toJSON of the data's own > $mode / $attribution",
	({ mode, attribution }) => {
		const boot = async (rules) => {
			const mod = await import("@cldmv/slothlet");
			const slothlet = mod.default ?? mod.slothlet;
			const api = await slothlet({
				loader: { platform: "browser" },
				mode,
				silent: true,
				permissions: { policy: "allow", caller: { attribution }, rules }
			});
			await api.slothlet.api.add("owner", { exports: data() }, { moduleID: "owner" });
			await api.slothlet.api.add(
				"reader",
				{ exports: { json: () => Object.fromEntries(NAMES.map((name) => [name, JSON.stringify(self.owner[name])])) } },
				{ moduleID: "reader" }
			);
			return api;
		};

		it("leaves out each member the reader may not read", async () => {
			const api = await boot(DENIED.map((path) => ({ caller: "reader.**", target: `owner.${path}`, effect: "deny" })));
			expect(await api.reader.json()).toEqual(expected(DENIED));
			await api.shutdown();
		});

		it("serializes everything for a reader no rule names", async () => {
			const api = await boot([]);
			expect(await api.reader.json()).toEqual(expected([]));
			await api.shutdown();
		});
	}
);
