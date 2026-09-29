//! Узел Reticulum для Bastyon: rns-net (стек, интерфейсы) и lxmf-rs (LXMF,
//! узлы доставки) плюс то, чего в них нет, — скачивание с узла доставки,
//! страницы NomadNet, штампы при отправке. Общий для десктопа (Tauri,
//! src-tauri/src/rns) и Android (JNI, crates/bastyon-rns-jni).
//!
//! rns-net собирается только под unix (serial, сокеты, /dev/urandom); на
//! остальных платформах `node` — заглушка с тем же интерфейсом.

pub mod types;

#[cfg(unix)]
pub mod node;
#[cfg(not(unix))]
#[path = "node_unsupported.rs"]
pub mod node;
