//! Разговор с приложением: одна строка JSON — одно сообщение.
//!
//! Приложение → модуль (stdin): `{"id":1,"cmd":"radio_write","args":{…}}`.
//! Модуль → приложение (stdout):
//! - первой строкой `{"hello":{"protocol":1,"version":"…"}}`;
//! - ответ `{"id":1,"ok":…}` или `{"id":1,"err":"код: подробности"}`;
//! - событие стока `{"sink":5,"ev":…}` и его конец `{"sink":5,"end":true}`.
//!
//! Номер стока выдаёт приложение вместе с командой, которая открывает
//! соединение или узел: события, пришедшие раньше ответа, ему уже есть куда
//! отдать. Байты — массивом чисел, как их ждёт интерфейс.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::Write;

/// Версия разговора. Приложение не запускает модуль с другой: команды или их
/// ответы могли поменяться.
pub const PROTOCOL: u32 = 1;

#[derive(Debug, Deserialize)]
pub struct Request {
    pub id: u64,
    pub cmd: String,
    #[serde(default)]
    pub args: Value,
}

/// Строка в stdout целиком: потоки модуля пишут вперемешку, но строки не рвутся.
pub fn send(msg: &Value) {
    let mut line = msg.to_string();
    line.push('\n');
    let mut out = std::io::stdout().lock();
    // Приложения больше нет — писать некому; модуль закончит работу, когда
    // stdin закроется.
    let _ = out.write_all(line.as_bytes());
    let _ = out.flush();
}

pub fn hello() {
    send(&serde_json::json!({
        "hello": { "protocol": PROTOCOL, "version": env!("CARGO_PKG_VERSION") }
    }));
}

pub fn reply(id: u64, result: Result<Value, String>) {
    send(&match result {
        Ok(ok) => serde_json::json!({ "id": id, "ok": ok }),
        Err(err) => serde_json::json!({ "id": id, "err": err }),
    });
}

/// Сток событий одного соединения или узла. Когда его последняя копия уходит
/// (соединение закрыто), приложение узнаёт об этом и забывает канал окна.
pub struct Sink {
    id: u64,
}

impl Sink {
    pub fn new(id: u64) -> Self {
        Self { id }
    }

    pub fn send<T: Serialize>(&self, ev: &T) {
        match serde_json::to_value(ev) {
            Ok(ev) => send(&serde_json::json!({ "sink": self.id, "ev": ev })),
            Err(e) => log::warn!("sink {}: {e}", self.id),
        }
    }
}

impl Drop for Sink {
    fn drop(&mut self) {
        send(&serde_json::json!({ "sink": self.id, "end": true }));
    }
}
