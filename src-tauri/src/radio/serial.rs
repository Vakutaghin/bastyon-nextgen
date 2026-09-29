//! USB-serial до радио (MeshCore companion, Meshtastic, RNode).
//!
//! Открыть можно только порт из текущего списка системы: иначе команда
//! открывала бы любой путь, который ей передали. Чтение идёт в своём потоке с
//! коротким таймаутом — так поток замечает закрытие без отдельного сигнала.

use super::{EventSink, RadioEvent};
use serde::Serialize;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

/// Скорость по умолчанию у companion-прошивок MeshCore и у Meshtastic.
pub const DEFAULT_BAUD: u32 = 115_200;
const READ_TIMEOUT: Duration = Duration::from_millis(100);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SerialPortDto {
    pub path: String,
    /// `usb`, `bluetooth`, `pci` или `unknown`.
    pub kind: &'static str,
    pub vid: Option<u16>,
    pub pid: Option<u16>,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial_number: Option<String>,
}

/// Порты системы. На macOS каждый порт есть дважды: `/dev/tty.*` ждёт сигнал
/// DCD при открытии, а для исходящего подключения нужен `/dev/cu.*`. Оставляем
/// только `cu`.
pub fn list_ports() -> Result<Vec<SerialPortDto>, String> {
    let ports = serialport::available_ports().map_err(|e| format!("list_failed: {e}"))?;
    let mut out: Vec<SerialPortDto> = ports.into_iter().map(to_dto).collect();
    if cfg!(target_os = "macos") {
        let callout: Vec<String> = out
            .iter()
            .filter_map(|p| p.path.strip_prefix("/dev/cu.").map(str::to_string))
            .collect();
        out.retain(|p| match p.path.strip_prefix("/dev/tty.") {
            Some(name) => !callout.iter().any(|c| c == name),
            None => true,
        });
    }
    out.sort_by(|a, b| (a.kind != "usb", &a.path).cmp(&(b.kind != "usb", &b.path)));
    Ok(out)
}

fn to_dto(p: serialport::SerialPortInfo) -> SerialPortDto {
    use serialport::SerialPortType;
    match p.port_type {
        SerialPortType::UsbPort(usb) => SerialPortDto {
            path: p.port_name,
            kind: "usb",
            vid: Some(usb.vid),
            pid: Some(usb.pid),
            manufacturer: usb.manufacturer,
            product: usb.product,
            serial_number: usb.serial_number,
        },
        other => SerialPortDto {
            path: p.port_name,
            kind: match other {
                SerialPortType::BluetoothPort => "bluetooth",
                SerialPortType::PciPort => "pci",
                _ => "unknown",
            },
            vid: None,
            pid: None,
            manufacturer: None,
            product: None,
            serial_number: None,
        },
    }
}

/// Путь есть среди портов системы прямо сейчас.
pub fn is_listed(path: &str, listed: &[SerialPortDto]) -> bool {
    listed.iter().any(|p| p.path == path)
}

pub struct SerialLink {
    writer: Arc<Mutex<Box<dyn serialport::SerialPort>>>,
    stop: Arc<AtomicBool>,
    /// Поток чтения: выходит сам по флагу `stop`, его не ждём.
    _reader: JoinHandle<()>,
}

impl SerialLink {
    /// Открыть порт из списка системы.
    pub fn open(
        path: &str,
        baud: u32,
        sink: EventSink,
        on_gone: Box<dyn FnOnce() + Send>,
    ) -> Result<Self, String> {
        let listed = list_ports()?;
        if !is_listed(path, &listed) {
            return Err(format!("port_not_found: {path}"));
        }
        let baud = if (1_200..=3_000_000).contains(&baud) { baud } else { DEFAULT_BAUD };
        Self::open_unchecked(path, baud, sink, on_gone)
    }

    /// Без сверки со списком и без проверки скорости — для тестов на
    /// псевдотерминале (на macOS ему нельзя задать скорость: ENOTTY, поэтому 0).
    pub(crate) fn open_unchecked(
        path: &str,
        baud: u32,
        sink: EventSink,
        on_gone: Box<dyn FnOnce() + Send>,
    ) -> Result<Self, String> {
        let builder = serialport::new(path, baud).timeout(READ_TIMEOUT);
        #[cfg(unix)]
        let mut port: Box<dyn serialport::SerialPort> = {
            use std::os::fd::AsRawFd;
            let native = builder.open_native().map_err(open_error)?;
            keep_lines_on_close(native.as_raw_fd());
            Box::new(native)
        };
        #[cfg(not(unix))]
        let mut port = builder.open().map_err(open_error)?;
        // DTR: платы с TinyUSB (nRF52, RP2040) отдают данные только при
        // выставленном DTR. RTS — вместе с ним, как pyserial и node-serialport:
        // оба выставлены = схема автосброса ESP32 не дёргает EN.
        let _ = port.write_data_terminal_ready(true);
        let _ = port.write_request_to_send(true);
        let reader_port = port.try_clone().map_err(|e| format!("open_failed: {e}"))?;
        let stop = Arc::new(AtomicBool::new(false));
        let reader = spawn_reader(reader_port, stop.clone(), sink, on_gone);
        Ok(Self {
            writer: Arc::new(Mutex::new(port)),
            stop,
            _reader: reader,
        })
    }

    pub async fn write(&self, data: Vec<u8>) -> Result<(), String> {
        let writer = self.writer.clone();
        tokio::task::spawn_blocking(move || {
            let mut port = writer.lock().map_err(|_| "write_failed: lock".to_string())?;
            // Без flush: он ждёт (tcdrain), пока байты физически уйдут, — лишняя
            // задержка на каждый кадр. Ядро передаст их само.
            port.write_all(&data).map_err(|e| format!("write_failed: {e}"))
        })
        .await
        .map_err(|e| format!("write_failed: {e}"))?
    }

    /// Остановить чтение. Поток выходит на следующем таймауте (~100 мс), порт
    /// закрывается вместе с последним дескриптором.
    pub fn close(&self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

/// Снять HUPCL: иначе при закрытии порта ОС сбрасывает DTR, и платы с
/// автосбросом (ESP32) перезагружаются — теряя накопленные в памяти
/// сообщения. Так же делает официальный клиент Meshtastic на Python.
#[cfg(unix)]
fn keep_lines_on_close(fd: std::os::fd::RawFd) {
    // SAFETY: fd — открытый дескриптор порта, живёт весь вызов; termios
    // читается и пишется целиком.
    unsafe {
        let mut t: libc::termios = std::mem::zeroed();
        if libc::tcgetattr(fd, &mut t) == 0 {
            t.c_cflag &= !libc::HUPCL;
            let _ = libc::tcsetattr(fd, libc::TCSANOW, &t);
        }
    }
}

fn open_error(e: serialport::Error) -> String {
    let text = e.to_string();
    let busy = text.contains("busy")
        || text.contains("Access is denied")
        || text.contains("Resource temporarily unavailable");
    if matches!(e.kind(), serialport::ErrorKind::NoDevice) {
        format!("port_not_found: {text}")
    } else if busy {
        format!("port_busy: {text}")
    } else if text.contains("ermission") {
        format!("port_permission: {text}")
    } else {
        format!("open_failed: {text}")
    }
}

fn spawn_reader(
    mut port: Box<dyn serialport::SerialPort>,
    stop: Arc<AtomicBool>,
    sink: EventSink,
    on_gone: Box<dyn FnOnce() + Send>,
) -> JoinHandle<()> {
    std::thread::spawn(move || {
        let mut buf = [0u8; 1024];
        let mut reason: Option<String> = None;
        while !stop.load(Ordering::SeqCst) {
            match port.read(&mut buf) {
                Ok(0) => continue,
                Ok(n) => sink(RadioEvent::Data {
                    bytes: buf[..n].to_vec(),
                }),
                Err(e) if e.kind() == std::io::ErrorKind::TimedOut => continue,
                Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(e) => {
                    reason = Some(format!("device_lost: {e}"));
                    break;
                }
            }
        }
        // Закрытие по просьбе интерфейса интерфейсу не сообщаем — он знает.
        if !stop.load(Ordering::SeqCst) {
            sink(RadioEvent::Closed { reason });
            on_gone();
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn port(path: &str, kind: &'static str) -> SerialPortDto {
        SerialPortDto {
            path: path.into(),
            kind,
            vid: None,
            pid: None,
            manufacturer: None,
            product: None,
            serial_number: None,
        }
    }

    #[test]
    fn only_listed_ports_may_be_opened() {
        let listed = vec![port("/dev/cu.usbserial-0001", "usb"), port("COM3", "usb")];
        assert!(is_listed("/dev/cu.usbserial-0001", &listed));
        assert!(is_listed("COM3", &listed));
        assert!(!is_listed("/etc/passwd", &listed));
        assert!(!is_listed("/dev/cu.usbserial-0002", &listed));
    }

    /// Настоящий обмен через псевдотерминал: то, что пишет «устройство»,
    /// приходит событием `data`, а запись из приложения доходит до устройства.
    #[cfg(unix)]
    #[tokio::test]
    async fn bytes_flow_both_ways_over_a_pty() {
        use std::os::fd::FromRawFd;
        use std::sync::mpsc;

        let mut master: libc::c_int = 0;
        let mut slave: libc::c_int = 0;
        let mut name = [0 as libc::c_char; 128];
        let rc = unsafe {
            libc::openpty(
                &mut master,
                &mut slave,
                name.as_mut_ptr(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        assert_eq!(rc, 0, "openpty");
        let slave_path = unsafe { std::ffi::CStr::from_ptr(name.as_ptr()) }
            .to_string_lossy()
            .into_owned();
        // Режим raw, чтобы терминал не превращал байты (эхо, \n → \r\n).
        // HUPCL включён, как у настоящего порта: открытие должно его снять.
        let termios = |fd: libc::c_int| unsafe {
            let mut t: libc::termios = std::mem::zeroed();
            libc::tcgetattr(fd, &mut t);
            t
        };
        unsafe {
            let mut t = termios(slave);
            libc::cfmakeraw(&mut t);
            t.c_cflag |= libc::HUPCL;
            libc::tcsetattr(slave, libc::TCSANOW, &t);
        }
        let mut device = unsafe { std::fs::File::from_raw_fd(master) };

        let (tx, rx) = mpsc::channel::<RadioEvent>();
        let sink: EventSink = Arc::new(move |ev| {
            let _ = tx.send(ev);
        });
        let baud = if cfg!(target_os = "macos") { 0 } else { DEFAULT_BAUD };
        let link = SerialLink::open_unchecked(&slave_path, baud, sink, Box::new(|| {}))
            .expect("open pty");
        assert_eq!(termios(slave).c_cflag & libc::HUPCL, 0, "HUPCL снят");

        device.write_all(&[0x3e, 0x01, 0x00, 0x0a]).unwrap();
        let mut got = Vec::new();
        while got.len() < 4 {
            match rx.recv_timeout(Duration::from_secs(3)).expect("data event") {
                RadioEvent::Data { bytes } => got.extend(bytes),
                other => panic!("unexpected {other:?}"),
            }
        }
        assert_eq!(got, vec![0x3e, 0x01, 0x00, 0x0a]);

        link.write(vec![0x3c, 0x01, 0x00, 0x0a]).await.unwrap();
        let mut echo = [0u8; 4];
        device.read_exact(&mut echo).unwrap();
        assert_eq!(echo, [0x3c, 0x01, 0x00, 0x0a]);

        link.close();
        unsafe { libc::close(slave) };
    }
}
