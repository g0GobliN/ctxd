// Hide the console window on Windows release builds. In debug it stays, because
// a shell that fails silently is harder to diagnose than one that prints.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! The ctxd desktop shell (UI-10, §67).
//!
//! Packaging, never a foundation. This crate opens a window onto the local
//! ctxd API and does nothing else — no context logic, no memory access, no
//! second copy of any decision the core already makes. The interface it shows
//! is byte-for-byte the one a browser gets from `ctxd ui`, because it is
//! literally the same server.
//!
//! Loading the interface over HTTP rather than bundling the assets is
//! deliberate. A bundled copy would be a second build of the front end that can
//! drift from the API it talks to, and a stale interface disagreeing with a
//! current backend is precisely the failure `Cache-Control: no-cache` exists to
//! prevent on the web path.
//!
//! The CLI keeps working with or without this binary. Nothing here is required
//! by anything else.

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::Duration;

use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// Where `ctxd ui` listens by default (§9).
const DEFAULT_URL: &str = "http://127.0.0.1:4317";

/// How long to wait for a bundled backend to report its address.
const SIDECAR_READY_TIMEOUT: Duration = Duration::from_secs(60);

/// The line `ctxd ui` prints once the socket is listening.
const LISTENING_PREFIX: &str = "ctxd api listening on ";

/// Strip Windows' verbatim `\\?\` prefix from a path.
///
/// Tauri resolves the resource directory to a canonical path, which on Windows
/// carries that prefix. Rust handles it; Node does not — its module resolver
/// mis-parses the drive and fails with
/// `EISDIR: illegal operation on a directory, lstat 'C:'`, which names neither
/// the path nor the prefix that caused it.
///
/// A no-op everywhere else.
fn strip_verbatim(path: &Path) -> PathBuf {
    let text = path.to_string_lossy();
    match text.strip_prefix(r"\\?\") {
        Some(plain) => PathBuf::from(plain),
        None => path.to_path_buf(),
    }
}

/// Locate the Node runtime and the application bundled beside this binary.
fn sidecar_paths(resource_dir: &Path) -> (PathBuf, PathBuf) {
    let base = strip_verbatim(resource_dir);

    let node = base
        .join("runtime")
        .join(if cfg!(windows) { "node.exe" } else { "node" });

    let entry = base
        .join("app")
        .join("node_modules")
        .join("@ctxd")
        .join("cli")
        .join("dist")
        .join("index.js");

    (node, entry)
}

/// Start the bundled backend and wait until it says where it is listening.
///
/// This is the installed-application path. `ctxd desktop` starts the API itself
/// and passes `CTXD_UI_URL`, which stays the tested arrangement and keeps one
/// server with one lifetime; but a person who double-clicks an icon has no
/// terminal and nothing to start it for them, so here the shell does.
///
/// The port is **read, never assumed**. `--port 0` lets the operating system
/// choose, and the address is taken from the line the backend prints. Guessing
/// 4317 would collide with a `ctxd ui` the developer already has running, and
/// the window would then attach to a server inspecting a different directory.
fn start_sidecar(resource_dir: &Path) -> Result<(Child, String), String> {
    let (node, entry) = sidecar_paths(resource_dir);

    if !node.exists() {
        return Err(format!("bundled Node runtime is missing at {}", node.display()));
    }
    if !entry.exists() {
        return Err(format!("bundled application is missing at {}", entry.display()));
    }

    // The working directory decides which project `ctxd ui` inspects. An app
    // launched from a desktop icon inherits something arbitrary — often the
    // system root — so it is pinned to the user's home instead, and real
    // projects are registered from the Projects panel.
    let home = dirs_home().unwrap_or_else(|| resource_dir.to_path_buf());

    let mut child = Command::new(&node)
        .arg(&entry)
        .arg("ui")
        .arg("--port")
        .arg("0")
        .arg("--dir")
        .arg(&home)
        // The working directory is deliberately not set. `--dir` already says
        // which project to inspect, and an inherited cwd from a desktop
        // launcher is arbitrary — leaving it alone is one fewer thing that
        // differs between running from a terminal and running from an icon.
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("could not start the bundled backend: {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "the backend produced no output stream".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "the backend produced no error stream".to_string())?;

    // **Both** streams are drained, on their own threads.
    //
    // A piped stream nobody reads fills its buffer and then blocks the writer
    // forever. Reading only stdout is the version of this bug that looks like
    // a backend which started and then went silent — which is exactly how it
    // presented: the process was alive, the port was never announced, and the
    // window timed out with nothing to show for it.
    let collected = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
    let sink = std::sync::Arc::clone(&collected);
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            if let Ok(mut buffer) = sink.lock() {
                buffer.push_str(&line);
                buffer.push('\n');
            }
        }
    });

    // Read on a worker thread so a backend that never prints cannot hang the
    // window forever — the timeout below is what makes that a failure rather
    // than a freeze.
    let (sender, receiver) = mpsc::channel::<String>();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(url) = line.strip_prefix(LISTENING_PREFIX) {
                let _ = sender.send(url.trim().to_string());
                return;
            }
        }
    });

    match receiver.recv_timeout(SIDECAR_READY_TIMEOUT) {
        Ok(url) => Ok((child, url)),
        Err(_) => {
            let _ = child.kill();
            // Whatever the backend managed to say travels with the failure. An
            // error that only says "timed out" sends the next person to read
            // this code instead of to the actual cause.
            let said = collected
                .lock()
                .map(|buffer| buffer.trim().to_string())
                .unwrap_or_default();

            Err(if said.is_empty() {
                "the bundled backend did not report an address in time, and said nothing"
                    .to_string()
            } else {
                format!("the bundled backend did not start: {said}")
            })
        }
    }
}

/// The user's home directory, without taking a dependency for one lookup.
fn dirs_home() -> Option<PathBuf> {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
}

/// The bundled backend, held so it can be stopped when the app is.
///
/// Killed on drop rather than left to the operating system: a server still
/// listening after its window has gone is a port nobody can account for and a
/// database still locked against the next launch.
struct SidecarProcess(std::sync::Mutex<Option<Child>>);

impl SidecarProcess {
    /// Stop the backend. Safe to call more than once.
    fn stop(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

/// A backstop, not the mechanism.
///
/// Tauri ends the process without unwinding, so managed state is not dropped on
/// exit — closing the window left the backend running, holding its port and the
/// database against the next launch. `RunEvent::Exit` is what actually stops it;
/// this only covers the paths where the value is dropped normally.
impl Drop for SidecarProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

/// The local API token, read from disk when no one handed it to us.
///
/// `ctxd desktop` passes `CTXD_UI_TOKEN`. The installed app starts the backend
/// itself, so nothing sets that variable and the token is read from the file
/// the backend just wrote — the same `0600` file the CLI reads. It still never
/// travels over HTTP, which is the property worth keeping.
fn token_from_disk() -> Option<String> {
    let path = dirs_home()?.join(".ctxd").join("api-token");
    let token = std::fs::read_to_string(path).ok()?.trim().to_string();
    if is_hex_token(&token) {
        Some(token)
    } else {
        None
    }
}

/// Hosts the shell will open.
///
/// §62 binds ctxd to loopback and nothing else. This shell is a browser, so the
/// same rule has to hold here or the desktop build would be the one way to
/// point ctxd's interface at a remote origin — a hole the HTTP server itself
/// does not have.
fn is_loopback(url: &str) -> bool {
    let rest = match url.strip_prefix("http://") {
        Some(rest) => rest,
        None => return false,
    };

    let host = rest.split('/').next().unwrap_or("");
    let host = host.rsplit_once(':').map_or(host, |(name, _port)| name);

    host == "127.0.0.1" || host == "localhost" || host == "[::1]"
}

fn resolve_url() -> Result<String, String> {
    // Set by `ctxd desktop`, which knows the port the API actually bound —
    // which is not always the configured one, since a port can be taken.
    let url = std::env::var("CTXD_UI_URL").unwrap_or_else(|_| DEFAULT_URL.to_string());

    if !is_loopback(&url) {
        return Err(format!(
            "refusing to open {url}: the ctxd interface is loopback-only. \
             Set CTXD_UI_URL to a http://127.0.0.1 address."
        ));
    }

    Ok(url)
}

/// The local API token, if `ctxd desktop` supplied one.
///
/// Only a hex token is accepted. The value is interpolated into a script the
/// webview runs, so anything that could close a string literal and continue
/// with code of its own must never reach it — and the real token is 32 random
/// bytes rendered as hex, so this rejects nothing legitimate.
///
/// A missing or malformed token is not an error: the window still opens and
/// reads work, and the Settings panel accepts a token by hand. Refusing to
/// start would make an unreadable environment variable fatal to a viewer that
/// does not need one.
fn is_hex_token(token: &str) -> bool {
    !token.is_empty() && token.chars().all(|c| c.is_ascii_hexdigit())
}

fn token_script() -> Option<String> {
    let token = match std::env::var("CTXD_UI_TOKEN") {
        Ok(supplied) => {
            if !is_hex_token(&supplied) {
                eprintln!("ctxd desktop: ignoring a CTXD_UI_TOKEN that is not hexadecimal");
                return None;
            }
            supplied
        }
        // The installed app starts its own backend, so nothing handed it a
        // token; the backend has just written one to disk.
        Err(_) => token_from_disk()?,
    };

    // Stored where the interface already looks for it, so the browser path and
    // the desktop path read one key rather than two.
    Some(format!(
        "try {{ window.localStorage.setItem('ctxd.apiToken', '{token}'); }} catch (e) {{}}"
    ))
}

fn main() {
    // Two ways in, and which one applies is decided by whether a backend is
    // already running:
    //
    //   `ctxd desktop`      → CTXD_UI_URL is set; attach to that server.
    //   the installed app   → nothing is running; start the bundled backend.
    //
    // The first is the arrangement the tests cover and it is left exactly as it
    // was: one server, owned by the process that started it.
    let attached = std::env::var("CTXD_UI_URL").is_ok();

    tauri::Builder::default()
        .setup(move |app| {
            let url = if attached {
                resolve_url().map_err(|message| -> Box<dyn std::error::Error> { message.into() })?
            } else {
                let resource_dir = app.path().resource_dir()?;
                let (child, url) = start_sidecar(&resource_dir)
                    .map_err(|message| -> Box<dyn std::error::Error> { message.into() })?;

                // Held for the lifetime of the app so the backend is killed
                // when the window closes. A server left listening after its
                // window is gone is a port nobody can explain and a database
                // still locked.
                app.manage(SidecarProcess(std::sync::Mutex::new(Some(child))));

                if !is_loopback(&url) {
                    return Err(format!("the backend reported a non-loopback address: {url}").into());
                }
                url
            };

            let parsed = url
                .parse()
                .map_err(|error| format!("{url} is not a valid URL ({error})"))?;
            // Built here rather than declared in tauri.conf.json because the URL
            // is only known at run time: `ctxd desktop` passes the address the
            // API actually bound to.
            let mut window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(parsed))
                .title("ctxd")
                .inner_size(1280.0, 860.0)
                .min_inner_size(720.0, 520.0);

            // Runs before the page loads, so the interface finds the token
            // already present rather than asking for it. This is the whole
            // reason the desktop build can write without the paste a browser
            // needs: the script reaches only this webview.
            if let Some(script) = token_script() {
                window = window.initialization_script(&script);
            }

            window.build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("ctxd desktop: failed to start the window")
        .run(|handle, event| {
            // Tauri ends the process without unwinding, so a backend started
            // here has to be stopped here. Relying on `Drop` left it running
            // after the window closed — a port nobody could account for and a
            // database still locked against the next launch.
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(sidecar) = handle.try_state::<SidecarProcess>() {
                    sidecar.stop();
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::is_loopback;

    #[test]
    fn accepts_the_local_interface() {
        assert!(is_loopback("http://127.0.0.1:4317"));
        assert!(is_loopback("http://localhost:4317/"));
        assert!(is_loopback("http://[::1]:4317"));
        assert!(is_loopback("http://127.0.0.1:4317/graph"));
    }

    #[test]
    fn refuses_anything_that_is_not_loopback() {
        // The desktop build must not become the one way to point ctxd's
        // interface at a remote origin (§62).
        assert!(!is_loopback("http://192.168.1.10:4317"));
        assert!(!is_loopback("http://example.com"));
        assert!(!is_loopback("https://example.com"));
        assert!(!is_loopback("file:///etc/passwd"));
        assert!(!is_loopback(""));
    }

    #[test]
    fn strips_the_windows_verbatim_prefix() {
        use std::path::{Path, PathBuf};

        // Rust canonicalises to \\?\C:\..., which Node's module resolver
        // mis-parses — it fails on the drive with EISDIR lstat 'C:', naming
        // neither the path nor the prefix responsible.
        assert_eq!(
            super::strip_verbatim(Path::new(r"\\?\C:\Users\x\app")),
            PathBuf::from(r"C:\Users\x\app")
        );

        // Anything already plain is left exactly as it was.
        assert_eq!(
            super::strip_verbatim(Path::new(r"C:\Users\x\app")),
            PathBuf::from(r"C:\Users\x\app")
        );
        assert_eq!(
            super::strip_verbatim(Path::new("/usr/lib/ctxd")),
            PathBuf::from("/usr/lib/ctxd")
        );
    }

    #[test]
    fn only_a_hex_token_reaches_the_injected_script() {
        // The guard that matters: the token is interpolated into JavaScript, so
        // a value able to close the string literal would be code execution in
        // the webview. A real token is 32 random bytes as hex.
        assert!(super::is_hex_token("4b584d1be060999fb6d2047247551196"));
        assert!(super::is_hex_token("ABCDEF0123456789"));

        assert!(!super::is_hex_token(""));
        assert!(!super::is_hex_token("'); alert(1); ('"));
        assert!(!super::is_hex_token("deadbeef'"));
        assert!(!super::is_hex_token("not-hex-at-all"));
        assert!(!super::is_hex_token("dead beef"));
    }

    #[test]
    fn is_not_fooled_by_a_hostname_that_merely_contains_localhost() {
        // `localhost.example.com` resolves wherever its owner says.
        assert!(!is_loopback("http://localhost.example.com/"));
        assert!(!is_loopback("http://127.0.0.1.example.com/"));
    }
}
