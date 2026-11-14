fn main() {
    // Only these app commands are available for capability grants; plugins stay private to Rust.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&["open_link", "save_export", "desktop_shell"])),
    )
    .expect("build the Tauri app");
}
