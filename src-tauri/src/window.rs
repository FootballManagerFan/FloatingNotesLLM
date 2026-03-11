#[cfg(target_os = "macos")]
use tauri::LogicalPosition;
use tauri::{App, AppHandle, Manager, Runtime, WebviewWindow, WebviewWindowBuilder};

// Previously used for the 54px top-bar positioning — no longer needed with the 400×600 chat window.
// Position is now handled by `center: true` in tauri.conf.json.

// On Windows, the first click on an unfocused window activates it but the click is consumed
// (not delivered to the webview). On macOS this is solved with NSWindowStyleMaskNonActivatingPanel.
// On Windows we intercept WM_MOUSEACTIVATE and return MA_ACTIVATE so the window activates AND
// the click is delivered to the webview — giving single-click behavior.
#[cfg(target_os = "windows")]
mod win32_click_fix {
    use std::ffi::c_void;

    const WM_MOUSEACTIVATE: u32 = 0x0021;
    const MA_ACTIVATE: isize = 1;

    // DWM attributes
    const DWMWA_WINDOW_CORNER_PREFERENCE: u32 = 33; // Windows 11+ rounded corners
    const DWMWCP_ROUND: i32 = 2;
    const DWMWA_BORDER_COLOR: u32 = 34;             // Windows 11+ accent border colour
    const DWMWA_COLOR_NONE: u32 = 0xFFFF_FFFF;      // "no border" sentinel

    // Window style flags
    const GWL_STYLE: i32 = -16;
    const WS_BORDER: usize = 0x0080_0000;
    const SWP_FRAMECHANGED: u32 = 0x0020;
    const SWP_NOMOVE: u32 = 0x0002;
    const SWP_NOSIZE: u32 = 0x0001;
    const SWP_NOZORDER: u32 = 0x0004;

    type SubclassProc = unsafe extern "system" fn(
        hwnd: *mut c_void,
        msg: u32,
        wparam: usize,
        lparam: isize,
        uid_subclass: usize,
        dw_ref_data: usize,
    ) -> isize;

    #[link(name = "comctl32")]
    extern "system" {
        fn SetWindowSubclass(
            hwnd: *mut c_void,
            pfn_subclass: SubclassProc,
            uid_subclass: usize,
            dw_ref_data: usize,
        ) -> i32;

        fn DefSubclassProc(
            hwnd: *mut c_void,
            msg: u32,
            wparam: usize,
            lparam: isize,
        ) -> isize;
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetWindowLongPtrW(hwnd: *mut c_void, n_index: i32) -> isize;
        fn SetWindowLongPtrW(hwnd: *mut c_void, n_index: i32, dw_new_long: isize) -> isize;
        fn SetWindowPos(
            hwnd: *mut c_void,
            hwnd_insert_after: *mut c_void,
            x: i32,
            y: i32,
            cx: i32,
            cy: i32,
            u_flags: u32,
        ) -> i32;
    }

    #[repr(C)]
    struct MARGINS {
        cx_left_width: i32,
        cx_right_width: i32,
        cy_top_height: i32,
        cy_bottom_height: i32,
    }

    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: *mut c_void,
            dw_attribute: u32,
            pv_attribute: *const i32,
            cb_attribute: u32,
        ) -> i32;

        fn DwmExtendFrameIntoClientArea(
            hwnd: *mut c_void,
            p_mar_inset: *const MARGINS,
        ) -> i32;
    }

    unsafe extern "system" fn subclass_proc(
        hwnd: *mut c_void,
        msg: u32,
        wparam: usize,
        lparam: isize,
        _uid_subclass: usize,
        _dw_ref_data: usize,
    ) -> isize {
        if msg == WM_MOUSEACTIVATE {
            return MA_ACTIVATE;
        }
        DefSubclassProc(hwnd, msg, wparam, lparam)
    }

    /// Install a window-message hook that makes the first click on an unfocused window
    /// both activate it AND deliver the click to the webview (single-click behaviour).
    ///
    /// Also removes all visible window borders:
    /// - Strips WS_BORDER from the window style so Windows doesn't draw its own edge.
    /// - Disables the DWM 1px accent stroke drawn by the compositor (Windows 11+).
    /// - Requests native DWM rounded corners (Windows 11+) so CSS border-radius and the
    ///   compositor-level clipping stay in sync.
    pub fn enable(hwnd: *mut c_void) {
        unsafe {
            SetWindowSubclass(hwnd, subclass_proc, 1, 0);

            // ── 1. Remove WS_BORDER from the window style ────────────────────────────
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
            SetWindowLongPtrW(hwnd, GWL_STYLE, style & !(WS_BORDER as isize));
            // Apply the style change immediately.
            SetWindowPos(
                hwnd,
                std::ptr::null_mut(),
                0, 0, 0, 0,
                SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER,
            );

            // ── 2. Remove the DWM 1px accent border (Windows 11+) ────────────────────
            // Silently ignored on Windows 10.
            let no_border = DWMWA_COLOR_NONE as i32;
            DwmSetWindowAttribute(
                hwnd,
                DWMWA_BORDER_COLOR,
                &no_border,
                std::mem::size_of::<u32>() as u32,
            );

            // ── 3. Request native DWM rounded corners (Windows 11+) ──────────────────
            let pref = DWMWCP_ROUND;
            DwmSetWindowAttribute(
                hwnd,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &pref,
                std::mem::size_of::<i32>() as u32,
            );

            // ── 4. Extend DWM frame into entire client area ───────────────────────────
            // Setting all margins to -1 collapses the frame/client distinction: the
            // compositor treats every pixel as a frame pixel, so no separate window
            // chrome layer is drawn. The CSS rounded content is composited directly
            // against the desktop with no black/grey border artefact.
            let margins = MARGINS {
                cx_left_width: -1,
                cx_right_width: -1,
                cy_top_height: -1,
                cy_bottom_height: -1,
            };
            DwmExtendFrameIntoClientArea(hwnd, &margins);
        }
    }
}

/// Sets up the main window. Position is handled by `center: true` in tauri.conf.json.
pub fn setup_main_window(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let window = app
        .get_webview_window("main")
        .or_else(|| app.get_webview_window("pluely"))
        .or_else(|| app.webview_windows().values().next().cloned())
        .ok_or("No window found")?;

    #[cfg(target_os = "windows")]
    {
        use raw_window_handle::HasWindowHandle;
        if let Ok(handle) = window.window_handle() {
            if let raw_window_handle::RawWindowHandle::Win32(win32) = handle.as_raw() {
                let hwnd = win32.hwnd.get() as *mut std::ffi::c_void;
                win32_click_fix::enable(hwnd);
            }
        }
    }

    Ok(())
}

/// Positions a window at the top center of the screen with a specified Y offset
pub fn position_window_top_center(
    window: &WebviewWindow,
    y_offset: i32,
) -> Result<(), Box<dyn std::error::Error>> {
    // Get the primary monitor
    if let Some(monitor) = window.primary_monitor()? {
        let monitor_size = monitor.size();
        let window_size = window.outer_size()?;

        // Calculate center X position
        let center_x = (monitor_size.width as i32 - window_size.width as i32) / 2;

        // Set the window position
        window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: center_x,
            y: y_offset,
        }))?;
    }

    Ok(())
}

/// Future function for centering window completely (both X and Y)
#[allow(dead_code)]
pub fn center_window_completely(window: &WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(monitor) = window.primary_monitor()? {
        let monitor_size = monitor.size();
        let window_size = window.outer_size()?;

        let center_x = (monitor_size.width as i32 - window_size.width as i32) / 2;
        let center_y = (monitor_size.height as i32 - window_size.height as i32) / 2;

        window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: center_x,
            y: center_y,
        }))?;
    }

    Ok(())
}

/// Focus the main (bar) window. Call when the user moves the pointer over the bar so the first
/// click is delivered to the webview instead of being consumed by Windows/macOS for activation.
#[tauri::command]
pub fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .or_else(|| app.get_webview_window("pluely"))
        .ok_or("Main window not found")?;
    window
        .set_focus()
        .map_err(|e| format!("Failed to focus main window: {}", e))?;
    Ok(())
}

/// Hide the main window (e.g. before taking a screenshot so the window is not in the capture).
#[tauri::command]
pub fn hide_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .or_else(|| app.get_webview_window("pluely"))
        .ok_or("Main window not found")?;
    window
        .hide()
        .map_err(|e| format!("Failed to hide main window: {}", e))?;
    Ok(())
}

/// Show the main window (e.g. after taking a screenshot).
#[tauri::command]
pub fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .or_else(|| app.get_webview_window("pluely"))
        .ok_or("Main window not found")?;
    window
        .show()
        .map_err(|e| format!("Failed to show main window: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn set_window_height(window: tauri::WebviewWindow, height: u32) -> Result<(), String> {
    use tauri::{LogicalSize, Size};

    // Simply set the window size with fixed width and new height
    let new_size = LogicalSize::new(600.0, height as f64);
    window
        .set_size(Size::Logical(new_size))
        .map_err(|e| format!("Failed to resize window: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn open_dashboard(app: tauri::AppHandle) -> Result<(), String> {
    show_dashboard_window(&app)
}

#[tauri::command]
pub fn toggle_dashboard(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(dashboard_window) = app.get_webview_window("dashboard") {
        match dashboard_window.is_visible() {
            Ok(true) => {
                // Window is visible, hide it
                dashboard_window
                    .hide()
                    .map_err(|e| format!("Failed to hide dashboard window: {}", e))?;
            }
            Ok(false) => {
                // Window is hidden, show and focus it
                dashboard_window
                    .show()
                    .map_err(|e| format!("Failed to show dashboard window: {}", e))?;
                dashboard_window
                    .set_focus()
                    .map_err(|e| format!("Failed to focus dashboard window: {}", e))?;
            }
            Err(e) => {
                return Err(format!("Failed to check dashboard visibility: {}", e));
            }
        }
    } else {
        // Window doesn't exist, create and show it
        show_dashboard_window(&app)?;
    }

    Ok(())
}

#[tauri::command]
pub fn move_window(app: tauri::AppHandle, direction: String, step: i32) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let current_pos = window
            .outer_position()
            .map_err(|e| format!("Failed to get window position: {}", e))?;

        let (new_x, new_y) = match direction.as_str() {
            "up" => (current_pos.x, current_pos.y - step),
            "down" => (current_pos.x, current_pos.y + step),
            "left" => (current_pos.x - step, current_pos.y),
            "right" => (current_pos.x + step, current_pos.y),
            _ => return Err(format!("Invalid direction: {}", direction)),
        };

        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: new_x,
                y: new_y,
            }))
            .map_err(|e| format!("Failed to set window position: {}", e))?;
    } else {
        return Err("Main window not found".to_string());
    }

    Ok(())
}

pub fn create_dashboard_window<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<WebviewWindow<R>, tauri::Error> {
    let base_builder =
        WebviewWindowBuilder::new(app, "dashboard", tauri::WebviewUrl::App("/chats".into()));

    #[cfg(target_os = "macos")]
    let base_builder = base_builder
        .title("Pluely - Dashboard")
        .center()
        .decorations(true)
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .hidden_title(true)
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .content_protected(true)
        .visible(true)
        .traffic_light_position(LogicalPosition::new(14.0, 18.0));

    #[cfg(not(target_os = "macos"))]
    let base_builder = base_builder
        .title("Pluely - Dashboard")
        .center()
        .decorations(true)
        .inner_size(800.0, 600.0)
        .min_inner_size(800.0, 600.0)
        .content_protected(true)
        .visible(false);

    let window = base_builder.build()?;

    // Set up close event handler - hide window instead of destroying it
    setup_dashboard_close_handler(&window);

    Ok(window)
}

/// Sets up the close event handler for the dashboard window
fn setup_dashboard_close_handler<R: Runtime>(window: &WebviewWindow<R>) {
    let window_clone = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            // Prevent the window from being destroyed
            api.prevent_close();
            // Hide the window instead
            if let Err(e) = window_clone.hide() {
                eprintln!("Failed to hide dashboard window on close: {}", e);
            }
        }
    });
}

/// Shows the dashboard window and brings it to focus
pub fn show_dashboard_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if let Some(dashboard_window) = app.get_webview_window("dashboard") {
        // Window exists, show and focus it
        dashboard_window
            .show()
            .map_err(|e| format!("Failed to show dashboard window: {}", e))?;
        dashboard_window
            .set_focus()
            .map_err(|e| format!("Failed to focus dashboard window: {}", e))?;
    } else {
        // Window doesn't exist, create it and then show it
        let window = create_dashboard_window(app)
            .map_err(|e| format!("Failed to create dashboard window: {}", e))?;
        window
            .show()
            .map_err(|e| format!("Failed to show new dashboard window: {}", e))?;
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus new dashboard window: {}", e))?;
    }
    Ok(())
}
