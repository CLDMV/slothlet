# Issue: Throw-vs-Event Convention for Module Discovery Errors

**Scope:** New module discovery + mount API (`api.slothlet.api.modules.*`)
**Severity:** Low — design question, not a bug
**Status:** Open — deferred to a later iteration

---

## Background

Slothlet's existing runtime API surface throws on errors. Reading the codebase confirms this: `src/lib/handlers/api-manager.mjs` contains ~30+ `throw new SlothletError(...)` calls across the `add` / `remove` / `reload` paths, with typed `code` values like `INVALID_CONFIG_API_PATH_INVALID`, `INVALID_CONFIG_DIR_INVALID`, `INVALID_CONFIG_NOT_LOADED`, `PERMISSION_DENIED`, and so on. Validation errors at the metadata, permission, and version layers follow the same throw convention.

Slothlet's lifecycle event system (`api.slothlet.lifecycle.on/off/emit`) is reserved for **observable state changes** — events like `"impl:created"`, `"impl:removed"`, `"impl:changed"`. It is not used for error reporting.

The new module discovery + mount API adds a set of typed error codes (`MODULE_MANIFEST_INVALID`, `MODULE_MANIFEST_NOT_FOUND`, `MODULE_MANIFEST_UNKNOWN_FIELD`, `MODULE_MANIFEST_NAME_MISMATCH`, `MODULE_MANIFEST_VERSION_MISMATCH`, `MODULE_PATH_TRAVERSAL`, `MODULE_VERSION_UNSUPPORTED`, `MODULE_PACKAGE_NOT_FOUND`, `MODULE_RESERVED_MOUNTPATH`, `MODULE_DUPLICATE_NAME_VERSION_MISMATCH`, `MODULE_MOUNT_COLLISION`) plus rich observability events (`modules:discover-start`, `modules:discover-complete`, `modules:mount-start`, `modules:mount-complete`, `modules:loaded`).

The current design has these errors **throw** consistent with slothlet's existing convention. This issue documents an open question about whether to deviate.

---

## The Question

Should module discovery errors deviate from slothlet's throw-everywhere convention and emit on a dedicated event channel (e.g. `lifecycle.on("modules:error", ...)`) instead of, or in addition to, throwing?

**Arguments for emitting events instead of (or alongside) throwing:**

- **Observability for tooling and monitoring.** A host running module discovery in production may want to capture every failure as a structured event for telemetry pipelines, not interrupt the caller flow.
- **Best-effort loaders.** With `onFailure: "best-effort"` (per G4 of the review), the caller already opts into collecting failures without throwing — emitting per-failure events would be a natural extension of that.
- **Decoupled error handlers.** Events let a host register a single error handler for all module discovery failures, regardless of which call site triggered them. With throws, each call site must wrap its own try/catch.

**Arguments for staying with throws:**

- **Consistency with the rest of slothlet.** Every other runtime API throws. Introducing an event-based error channel for one subsystem creates an irregular surface that future maintainers must learn.
- **The error-handling story is already complete.** Throws are catchable; the `onFailure: "best-effort"` mode collects them into an aggregate return value. A separate event channel duplicates information already available.
- **Events for state changes, errors for problems.** Slothlet's existing distinction is clean. Mixing the two muddies the semantic of what an event subscriber receives.
- **Risk of silent failures.** If errors only emit and don't throw, callers who forget to register a handler get silent failures. Throws are loud by default.

---

## Proposed Approaches (when this is revisited)

1. **Throws only (current design).** Module discovery errors throw `SlothletError` instances with typed `MODULE_*` codes. `onFailure: "best-effort"` aggregates them in the return value. No event-based error channel.

2. **Throws + observability events.** Throws stay as the primary failure mechanism. Additionally, every thrown error also fires a `modules:error` lifecycle event with the same context. Callers who want telemetry register an event handler; callers who want exceptions catch them as today. Some redundancy; lets each consumer pick.

3. **Configurable per-call.** Add an `errorChannel: "throw" | "event" | "both"` option to the module helpers. Default `"throw"`. Hosts that want pure-event style opt in. Most flexible; widest API surface.

4. **Events only.** Errors never throw from the module discovery helpers; they only emit `modules:error` events. Caller must register a handler or failures are silent. Largest deviation from slothlet's convention; most surprising to existing users.

---

## Recommendation

**Defer until real usage validates which shape is needed.** The current design ships with **option 1 (throws only)** — fully consistent with slothlet's existing convention. If telemetry / observability needs emerge from real consumers, revisit and likely move to **option 2** (throws + events) as the additive least-disruptive change. Option 3's per-call configurability is appealing but adds API surface for what may turn out to be a niche concern.

---

## When to Revisit

- A consuming project explicitly asks for module-discovery error telemetry.
- Real-world usage shows the existing `onFailure: "best-effort"` aggregate doesn't cover a common need.
- Slothlet adopts an event-based error channel for other subsystems too, making module discovery the inconsistent one if it doesn't follow suit.

Until then, the throw convention stands as the simpler and more consistent default.
