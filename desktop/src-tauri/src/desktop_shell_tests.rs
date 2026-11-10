use super::{DesktopAction, validate_desktop_action, validate_menu_position};

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

#[test]
fn native_popup_accepts_a_finite_position_inside_the_main_window() {
    let position = validate_menu_position(Some(640.0), Some(42.0), 1280.0, 820.0).unwrap();
    assert_eq!(position.x, 640.0);
    assert_eq!(position.y, 42.0);
}

#[test]
fn native_popup_refuses_missing_nonfinite_and_outside_coordinates() {
    for (x, y) in [
        (None, Some(42.0)),
        (Some(640.0), None),
        (Some(f64::NAN), Some(42.0)),
        (Some(640.0), Some(f64::INFINITY)),
        (Some(-1.0), Some(42.0)),
        (Some(1281.0), Some(42.0)),
        (Some(640.0), Some(821.0)),
    ] {
        assert!(validate_menu_position(x, y, 1280.0, 820.0).is_err());
    }
    for (width, height) in [(0.0, 820.0), (1280.0, -1.0), (f64::INFINITY, 820.0)] {
        assert!(validate_menu_position(Some(0.0), Some(0.0), width, height).is_err());
    }
}
