//! Программа модуля mesh-сетей — вся работа в библиотеке (lib.rs).

#[tokio::main]
async fn main() {
    bastyon_mesh::run().await
}
