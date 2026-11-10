use super::{DesktopAction, validate_desktop_action};

#[test]
fn only_the_main_windows_window_may_request_caption_actions() {
    for action in [
        "ready",
        "fallback",
        "state",
        "menu",
        "minimize",
        "toggle_maximize",
        "close",
        "drag",
    ] {
        assert!(validate_desktop_action(false, "main", action).is_err());
        for label in ["", "other", "main-child", "MAIN"] {
            assert!(validate_desktop_action(true, label, action).is_err());
        }
    }
}

#[test]
fn main_windows_actions_are_parsed_before_native_effects() {
    for (input, expected) in [
        ("ready", DesktopAction::Ready),
        ("fallback", DesktopAction::Fallback),
        ("state", DesktopAction::State),
        ("menu", DesktopAction::Menu),
        ("minimize", DesktopAction::Minimize),
        ("toggle_maximize", DesktopAction::ToggleMaximize),
        ("close", DesktopAction::Close),
        ("drag", DesktopAction::Drag),
    ] {
        assert_eq!(validate_desktop_action(true, "main", input), Ok(expected));
    }
    for unknown in ["", "quit", "Close", "close ", "open_link", "close;ready"] {
        assert!(validate_desktop_action(true, "main", unknown).is_err());
    }
}
