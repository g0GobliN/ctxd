# The desktop shell

```bash
# once, on a machine with a Rust toolchain
cargo build --release --manifest-path packages/desktop/Cargo.toml

ctxd desktop
```

A Tauri 2 window onto the local ctxd interface. It is **packaging, never a
foundation** (§67, §26): no context logic, no memory access, no second copy of
any decision the core already makes.

Everything ctxd does works with this binary absent. `tests/e2e/desktop.test.ts`
asserts that — `ctxd status` and `ctxd doctor` neither fail nor mention the
shell when no binary is present, and the test suite needs no Rust toolchain at
all. A shell the rest of the product depended on would have stopped being
packaging.

## What it is

```
ctxd desktop
  ├── starts the same loopback API as `ctxd ui`   (Node)
  └── spawns the window with CTXD_UI_URL set      (Rust)
```

The window loads the interface **over HTTP** rather than bundling the assets.
That is deliberate: a bundled copy would be a second build of the front end that
can drift from the API it talks to, and a stale interface disagreeing with a
current backend is exactly what `Cache-Control: no-cache` exists to prevent on
the web path. There is one front end, and the window is a browser pointed at it.

The API is started by the **Node process, not by the shell**. Having the window
own the server would be a second way to start ctxd, with its own lifetime and
its own bugs. This way there is one server, and closing the window stops it.

The API binds port 0 by default — any free port — and the shell is told where it
actually landed via `CTXD_UI_URL`. Nothing is reserved in advance or guessed at.

## Options

```bash
ctxd desktop [--dir <path>] [--port <n>] [--no-window]
```

| Option | Meaning |
|---|---|
| `--dir <path>` | Directory the interface inspects (default: `.`) |
| `--port <n>` | Port for the local API (default: 0, any free port) |
| `--no-window` | Start the API and print the URL without opening a window |

`--no-window` is how the TypeScript half is tested without a Rust toolchain, and
it is also the honest fallback when the shell has not been built.

## The token, and why the window does not ask for one

Mutating routes require the local API token (§62). A browser tab is told it once
in Settings; the desktop window is not asked at all.

`ctxd desktop` passes the token to the shell in `CTXD_UI_TOKEN`, and the shell
injects it into its own webview with an initialisation script that runs before
the page loads. The interface then finds it in `localStorage`, which is the same
key the browser path uses — one key, not two.

The point is what this *avoids*. Serving the token over HTTP would let anything
able to `GET /` read a credential that today requires reading a `0600` file.
Handing it to the shell keeps that closed: the window can write, and the port
still gives the token to nobody.

Only a hexadecimal value is injected. The token is interpolated into a script,
so anything able to close the string literal and continue would be code
execution in the webview — `only_a_hex_token_reaches_the_injected_script` tests
that with `'); alert(1); ('` among its cases. A missing or malformed token is
not fatal: the window opens, reads work, and Settings still accepts one by hand.

## Security

§27 requires that Tauri expose no shell access and hold strict permissions. That
holds by construction rather than by configuration:

- **No `invoke_handler`, no `#[tauri::command]`.** The crate registers no
  commands, so there is no IPC surface to permit or deny
- **No shell plugin.** `Cargo.toml` depends on `tauri` with `features = []`
- **No capabilities file.** Tauri 2 grants nothing by default, and the window
  loads an *external* URL, which cannot reach IPC without an explicit
  remote-domain capability that is not present
- **Loopback only.** `is_loopback` refuses any URL that is not `127.0.0.1`,
  `localhost` or `[::1]`, and is not fooled by `localhost.example.com` or
  `127.0.0.1.example.com`

That last check matters more than it looks. §62 binds ctxd to loopback; the
shell is a browser, so without it the desktop build would be the one way to
point ctxd's interface at a remote origin — a hole the HTTP server itself does
not have.

The engineering interfaces remain the CLI, core, API and MCP. The shell is a
presentation layer (§27).

## Building it

Prerequisites:

| Requirement | Why |
|---|---|
| Rust toolchain | the crate is Rust |
| A C toolchain — MSVC build tools (Windows), or MinGW binutils for the `gnu` target | linking |
| Windows SDK (Windows) | `kernel32.lib` and the rest of the system libraries |
| WebView2 runtime (Windows) | the webview itself; present by default on Windows 11 |

```bash
cargo build --release --manifest-path packages/desktop/Cargo.toml
```

`pnpm build` does **not** build this crate, and nothing in CI does either. That
is intentional: making the suite require a Rust toolchain would make the shell a
foundation, which §67 says it must never be.

### Two Windows traps

Both cost real time and neither error names its own cause.

**Git's `link.exe` shadows the MSVC linker.** With Git for Windows on PATH,
`cargo build` resolves `link.exe` to `C:\Program Files\Git\usr\bin\link.exe` —
GNU coreutils `link`, not a linker at all. The failure reads:

```
error: linking with `link.exe` failed: exit code: 1
  = note: link: extra operand '...rcgu.o'
          Try 'link --help' for more information.
```

Nothing there suggests PATH. Build from a Visual Studio developer shell, or
otherwise ensure the MSVC `bin\Hostx64\x64` directory precedes Git's `usr\bin`.

**`cl.exe` existing does not mean the toolchain is ready.** The MSVC compiler is
installed well before the Windows SDK. Linking against a compiler with no SDK
fails on the system libraries. Check for the SDK, not the compiler:

```bash
ls "C:/Program Files (x86)/Windows Kits/10/Lib"/*/um/x64/kernel32.lib
```

## Status

**Verified on Windows 11 (x86_64-pc-windows-msvc).** The crate compiles, its
unit tests pass, and `ctxd desktop` opens a window that loads the interface from
the local API:

```
Finished `release` profile [optimized] target(s) in 7m 34s
running 3 tests
test tests::accepts_the_local_interface ... ok
test tests::is_not_fooled_by_a_hostname_that_merely_contains_localhost ... ok
test tests::refuses_anything_that_is_not_loopback ... ok
test result: ok. 3 passed; 0 failed
```

The Rust source had never been compiled or type-checked before this, and it
compiled without a single source error. The only defect in the crate was a
missing `icons/icon.ico`, which `tauri-build` requires to generate the Windows
resource file.

Not yet verified on macOS or Linux — nobody has built it there.

## Not built

**No installer.** [`tauri.conf.json`](../packages/desktop/tauri.conf.json) sets
`"bundle": { "active": false }`, so `cargo build` produces a bare executable and
no `.msi`, `.dmg` or `.AppImage`. The window is also not self-contained — it
needs the Node API running beside it — so a bundle today would install something
that cannot start on its own.

**No system tray.** §26 lists a tray, quick status and pause-worker as a
possible future, and says plainly: do not implement the tray before core desktop
packaging works.

## See also

- [ui.md](ui.md) — the interface the window displays
- [api.md](api.md) — the local API and its security model
- [cli.md](cli.md) — `ctxd desktop` alongside every other command
- [roadmap.md](roadmap.md) — what is built, what is not, and what never will be
