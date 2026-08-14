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

use tauri::{WebviewUrl, WebviewWindowBuilder};

/// Where `ctxd ui` listens by default (§9).
const DEFAULT_URL: &str = "http://127.0.0.1:4317";

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
    let token = std::env::var("CTXD_UI_TOKEN").ok()?;

    if !is_hex_token(&token) {
        eprintln!("ctxd desktop: ignoring a CTXD_UI_TOKEN that is not hexadecimal");
        return None;
    }

    // Stored where the interface already looks for it, so the browser path and
    // the desktop path read one key rather than two.
    Some(format!(
        "try {{ window.localStorage.setItem('ctxd.apiToken', '{token}'); }} catch (e) {{}}"
    ))
}

fn main() {
    let url = match resolve_url() {
        Ok(url) => url,
        Err(message) => {
            eprintln!("ctxd desktop: {message}");
            std::process::exit(1);
        }
    };

    let parsed = match url.parse() {
        Ok(parsed) => parsed,
        Err(error) => {
            eprintln!("ctxd desktop: {url} is not a valid URL ({error})");
            std::process::exit(1);
        }
    };

    tauri::Builder::default()
        .setup(move |app| {
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
        .run(tauri::generate_context!())
        .expect("ctxd desktop: failed to start the window");
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
