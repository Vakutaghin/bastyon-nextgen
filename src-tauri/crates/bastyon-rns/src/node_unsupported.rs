//! Заглушка узла Reticulum для платформ, где rns-net не собирается (Windows):
//! тот же интерфейс, что у node.rs, но всё отвечает `unsupported`.

use std::collections::HashMap;
use std::path::PathBuf;

use crate::types::{Attachment, Method, Page, RnsEvent, StartOptions, Started, Status};

const UNSUPPORTED: &str = "unsupported";

pub fn identity_hash(_prv: &[u8]) -> Result<String, String> {
    Err(UNSUPPORTED.into())
}

pub enum Runtime {}

pub struct Handle;

impl Runtime {
    pub fn start(
        _options: StartOptions,
        _dir: PathBuf,
        _sink: impl Fn(RnsEvent) + Send + Sync + 'static,
    ) -> Result<Runtime, String> {
        Err(UNSUPPORTED.into())
    }

    pub fn started(&self) -> Started {
        match *self {}
    }

    pub fn status(&self) -> Status {
        match *self {}
    }

    pub fn announce(&self) -> Result<(), String> {
        match *self {}
    }

    pub fn send(
        &self,
        _: [u8; 16],
        _: &str,
        _: &str,
        _: &[Attachment],
        _: Method,
    ) -> Result<String, String> {
        match *self {}
    }

    pub fn paper(&self, _: [u8; 16], _: &str) -> Result<String, String> {
        match *self {}
    }

    pub fn ingest(&self, _: &str) -> Result<(), String> {
        match *self {}
    }

    pub fn request_path(&self, _: [u8; 16]) -> Result<(), String> {
        match *self {}
    }

    pub fn set_propagation_node(&self, _: Option<[u8; 16]>) -> Result<(), String> {
        match *self {}
    }

    pub fn sync(&self) -> Result<(), String> {
        match *self {}
    }

    pub fn handle(&self) -> Handle {
        match *self {}
    }

    pub fn stop(self) {
        match self {}
    }
}

impl Handle {
    pub fn page(&self, _: [u8; 16], _: &str, _: &HashMap<String, String>) -> Result<Page, String> {
        Err(UNSUPPORTED.into())
    }
}
