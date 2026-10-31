//! Свободное место на диске с папкой скачанного. `None` — не узнать; тогда
//! загрузка не отказывает заранее, а встанет на паузу, если место кончится.

use std::path::Path;

#[cfg(unix)]
pub fn free_bytes(path: &Path) -> Option<u64> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;
    let c_path = CString::new(path.as_os_str().as_bytes()).ok()?;
    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    // SAFETY: путь — валидная C-строка, stat — место под ответ.
    let rc = unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) };
    if rc != 0 {
        return None;
    }
    #[allow(clippy::unnecessary_cast)]
    Some(stat.f_bavail as u64 * stat.f_frsize as u64)
}

#[cfg(windows)]
pub fn free_bytes(path: &Path) -> Option<u64> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let mut free: u64 = 0;
    // SAFETY: строка с нулём на конце живёт до конца вызова.
    unsafe { GetDiskFreeSpaceExW(PCWSTR(wide.as_ptr()), Some(&mut free), None, None) }.ok()?;
    Some(free)
}

#[cfg(not(any(unix, windows)))]
pub fn free_bytes(_path: &Path) -> Option<u64> {
    None
}

/// Ошибка записи — кончилось место (ENOSPC, ERROR_DISK_FULL, ERROR_HANDLE_DISK_FULL).
pub fn is_disk_full(e: &std::io::Error) -> bool {
    if e.kind() == std::io::ErrorKind::StorageFull {
        return true;
    }
    match e.raw_os_error() {
        #[cfg(unix)]
        Some(code) => code == libc::ENOSPC,
        #[cfg(windows)]
        Some(code) => code == 112 || code == 39,
        #[cfg(not(any(unix, windows)))]
        Some(_) => false,
        None => false,
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn free_space_of_temp_is_known() {
        let free = super::free_bytes(&std::env::temp_dir());
        assert!(free.is_some_and(|f| f > 0));
    }
}
