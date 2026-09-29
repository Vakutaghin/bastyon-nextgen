//! Узел Reticulum для Bastyon: rns-net (стек, интерфейсы) и lxmf-rs (LXMF,
//! узлы доставки) плюс то, чего в них нет, — скачивание с узла доставки,
//! страницы NomadNet, штампы при отправке. Общий для десктопа (Tauri,
//! src-tauri/src/rns) и Android (JNI, crates/bastyon-rns-jni).
//!
//! На Windows нет интерфейсов на последовательном порту (RNode) и локальных
//! сокетов общего экземпляра — только хабы по TCP и локальная сеть.

pub mod node;
pub mod types;
