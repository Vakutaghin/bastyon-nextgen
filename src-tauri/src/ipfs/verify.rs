//! Проверка файла, скачанного через публичный шлюз.
//!
//! Шлюзу не доверяем: он отдаёт CAR — блоки вместе с их CID, — а файл
//! собирается обходом DAG от корня из ссылки. Каждый блок перед использованием
//! сверяется с хэшем из CID, по которому на него сослались: корень — из самой
//! ссылки, остальные — из уже проверенных родителей. Поэтому подменить ни
//! байты, ни структуру шлюз не может — чужой блок не совпадёт с хэшем.
//!
//! Поддержано то, что делают Kubo и другие реализации UnixFS по умолчанию и с
//! распространёнными флагами: CIDv0/CIDv1, sha2-256/sha2-512/identity, dag-pb
//! (файлы, каталоги, шардированные HAMT-каталоги) и raw-листья. Остальное
//! (blake3, dag-cbor, симлинки) — отказ `Unsupported`: такой файл открывается
//! через локальную ноду, которая проверяет блоки сама.

use sha2::{Digest, Sha256, Sha512};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom, Write};
use thiserror::Error;

const CODEC_RAW: u64 = 0x55;
const CODEC_DAG_PB: u64 = 0x70;
const HASH_IDENTITY: u64 = 0x00;
const HASH_SHA2_256: u64 = 0x12;
const HASH_SHA2_512: u64 = 0x13;
/// murmur3-x64-64 — хэш имён в HAMT-каталогах UnixFS.
const HASH_MURMUR3_X64_64: u64 = 0x22;

const UNIXFS_RAW: u64 = 0;
const UNIXFS_DIRECTORY: u64 = 1;
const UNIXFS_FILE: u64 = 2;
const UNIXFS_SYMLINK: u64 = 4;
const UNIXFS_HAMT_SHARD: u64 = 5;

/// Блоков крупнее не делает ни одна реализация (Bitswap режет на 2 МиБ).
const MAX_BLOCK_SIZE: u64 = 4 * 1024 * 1024;
/// identity хранит данные прямо в CID — длинный такой CID подозрителен.
const MAX_IDENTITY_SIZE: usize = 4096;
const MAX_CAR_HEADER: u64 = 64 * 1024;
/// Потолок числа блоков и посещений узлов: DAG может ссылаться на один блок
/// многократно, и без потолка «бомба» из переиспользованных узлов росла бы
/// экспоненциально.
const MAX_BLOCKS: usize = 1_000_000;
const MAX_VISITS: u64 = 10_000_000;

#[derive(Debug, Error)]
pub enum VerifyError {
    /// Блок не совпал со своим CID: шлюз прислал чужие данные.
    #[error("verify-mismatch: block {0} does not match its CID")]
    Mismatch(String),
    /// Формат, который здесь не проверить (хэш, кодек, версия CAR).
    #[error("verify-unsupported: {0}")]
    Unsupported(String),
    #[error("verify-missing: the gateway did not send block {0}")]
    MissingBlock(String),
    #[error("verify-not-found: {0}")]
    NotFound(String),
    #[error("verify-directory: the link points to a directory")]
    IsDirectory,
    #[error("verify-malformed: {0}")]
    Malformed(String),
    #[error("verify-too-large")]
    TooLarge,
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
}

type Result<T> = std::result::Result<T, VerifyError>;

fn malformed(what: &str) -> VerifyError {
    VerifyError::Malformed(what.to_string())
}

// ---------------------------------------------------------------------------
// varint, multibase
// ---------------------------------------------------------------------------

/// Беззнаковый varint (multiformats: не длиннее 9 байт).
fn uvarint(b: &[u8]) -> Result<(u64, usize)> {
    let mut x: u64 = 0;
    for (i, &byte) in b.iter().enumerate().take(9) {
        x |= u64::from(byte & 0x7f) << (7 * i);
        if byte & 0x80 == 0 {
            return Ok((x, i + 1));
        }
    }
    Err(malformed("varint"))
}

/// Varint из потока. None — поток кончился ровно перед ним.
fn read_uvarint<R: Read>(r: &mut R) -> Result<Option<(u64, usize)>> {
    let mut x: u64 = 0;
    for i in 0..9 {
        let mut byte = [0u8; 1];
        if r.read(&mut byte)? == 0 {
            return if i == 0 { Ok(None) } else { Err(malformed("truncated varint")) };
        }
        x |= u64::from(byte[0] & 0x7f) << (7 * i);
        if byte[0] & 0x80 == 0 {
            return Ok(Some((x, i + 1)));
        }
    }
    Err(malformed("varint"))
}

fn push_uvarint(out: &mut Vec<u8>, mut x: u64) {
    while x >= 0x80 {
        out.push((x as u8) | 0x80);
        x >>= 7;
    }
    out.push(x as u8);
}

const BASE58_BTC: &[u8] = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE36_LOWER: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
const BASE32_LOWER: &[u8] = b"abcdefghijklmnopqrstuvwxyz234567";

/// base58/base36: число в системе счисления алфавита, ведущие «нули» — нулевые байты.
fn decode_base_x(s: &str, alphabet: &[u8]) -> Result<Vec<u8>> {
    let base = alphabet.len() as u32;
    let mut le: Vec<u8> = Vec::new();
    for c in s.bytes() {
        let mut carry = alphabet
            .iter()
            .position(|&a| a == c)
            .ok_or_else(|| malformed("CID character"))? as u32;
        for byte in le.iter_mut() {
            carry += u32::from(*byte) * base;
            *byte = (carry & 0xff) as u8;
            carry >>= 8;
        }
        while carry > 0 {
            le.push((carry & 0xff) as u8);
            carry >>= 8;
        }
    }
    let zeros = s.bytes().take_while(|&c| c == alphabet[0]).count();
    le.extend(std::iter::repeat(0).take(zeros));
    le.reverse();
    Ok(le)
}

/// RFC 4648 base32 без паддинга (алфавит в нижнем регистре).
fn decode_base32(s: &str) -> Result<Vec<u8>> {
    let mut out = Vec::with_capacity(s.len() * 5 / 8);
    let (mut buf, mut bits) = (0u32, 0u32);
    for c in s.bytes() {
        let v = BASE32_LOWER
            .iter()
            .position(|&a| a == c)
            .ok_or_else(|| malformed("CID character"))? as u32;
        buf = (buf << 5) | v;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// CID
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Cid {
    pub codec: u64,
    pub hash_code: u64,
    pub digest: Vec<u8>,
}

impl Cid {
    /// CID из ссылки: CIDv0 (`Qm…`, base58btc) или CIDv1 в multibase
    /// (b/B — base32, k/K — base36, z — base58btc, f/F — base16).
    pub fn parse(s: &str) -> Result<Cid> {
        let bytes = if s.len() == 46 && s.starts_with("Qm") {
            decode_base_x(s, BASE58_BTC)?
        } else {
            let mut chars = s.chars();
            let prefix = chars.next().ok_or_else(|| malformed("empty CID"))?;
            let rest = chars.as_str();
            match prefix {
                'b' => decode_base32(rest)?,
                'B' => decode_base32(&rest.to_ascii_lowercase())?,
                'k' => decode_base_x(rest, BASE36_LOWER)?,
                'K' => decode_base_x(&rest.to_ascii_lowercase(), BASE36_LOWER)?,
                'z' => decode_base_x(rest, BASE58_BTC)?,
                'f' | 'F' => hex::decode(rest.to_ascii_lowercase()).map_err(|_| malformed("hex CID"))?,
                other => return Err(VerifyError::Unsupported(format!("multibase '{other}'"))),
            }
        };
        let (cid, used) = Cid::from_bytes(&bytes)?;
        if used != bytes.len() {
            return Err(malformed("trailing bytes after CID"));
        }
        Ok(cid)
    }

    /// Двоичный CID (из CAR или ссылки dag-pb) и сколько байт он занял.
    pub fn from_bytes(b: &[u8]) -> Result<(Cid, usize)> {
        // CIDv0 — голый multihash sha2-256 длиной 32.
        if b.len() >= 2 && b[0] == 0x12 && b[1] == 0x20 {
            if b.len() < 34 {
                return Err(malformed("truncated CIDv0"));
            }
            let cid = Cid {
                codec: CODEC_DAG_PB,
                hash_code: HASH_SHA2_256,
                digest: b[2..34].to_vec(),
            };
            return Ok((cid, 34));
        }
        let (version, mut pos) = uvarint(b)?;
        if version != 1 {
            return Err(VerifyError::Unsupported(format!("CID version {version}")));
        }
        let (codec, n) = uvarint(&b[pos..])?;
        pos += n;
        let (hash_code, n) = uvarint(&b[pos..])?;
        pos += n;
        let (len, n) = uvarint(&b[pos..])?;
        pos += n;
        let len = usize::try_from(len).map_err(|_| malformed("digest length"))?;
        let end = pos.checked_add(len).ok_or_else(|| malformed("digest length"))?;
        if b.len() < end {
            return Err(malformed("truncated CID"));
        }
        let cid = Cid {
            codec,
            hash_code,
            digest: b[pos..end].to_vec(),
        };
        Ok((cid, end))
    }

    /// Ключ блока — multihash: блок один и тот же, сослались на него через
    /// CIDv0 или CIDv1.
    fn multihash(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(self.digest.len() + 4);
        push_uvarint(&mut out, self.hash_code);
        push_uvarint(&mut out, self.digest.len() as u64);
        out.extend_from_slice(&self.digest);
        out
    }

    /// Короткий идентификатор для сообщений об ошибках.
    fn short(&self) -> String {
        hex::encode(&self.digest[..self.digest.len().min(8)])
    }

    /// Данные совпадают с хэшем из CID?
    fn verify(&self, data: &[u8]) -> Result<()> {
        let ok = match (self.hash_code, self.digest.len()) {
            (HASH_SHA2_256, 32) => Sha256::digest(data).as_slice() == self.digest.as_slice(),
            (HASH_SHA2_512, 64) => Sha512::digest(data).as_slice() == self.digest.as_slice(),
            (HASH_IDENTITY, _) => data == self.digest.as_slice(),
            (code, len) => {
                return Err(VerifyError::Unsupported(format!(
                    "hash function 0x{code:x} (digest length {len})"
                )))
            }
        };
        if ok {
            Ok(())
        } else {
            Err(VerifyError::Mismatch(self.short()))
        }
    }
}

// ---------------------------------------------------------------------------
// protobuf: dag-pb и UnixFS
// ---------------------------------------------------------------------------

enum PbValue<'a> {
    Varint(u64),
    Bytes(&'a [u8]),
}

/// Поля protobuf-сообщения по порядку. Неизвестные типы 1/5 пропускаются.
fn pb_fields(mut b: &[u8]) -> Result<Vec<(u64, PbValue<'_>)>> {
    let mut out = Vec::new();
    while !b.is_empty() {
        let (key, n) = uvarint(b)?;
        b = &b[n..];
        let field = key >> 3;
        match key & 7 {
            0 => {
                let (v, n) = uvarint(b)?;
                b = &b[n..];
                out.push((field, PbValue::Varint(v)));
            }
            2 => {
                let (len, n) = uvarint(b)?;
                b = &b[n..];
                let len = usize::try_from(len).map_err(|_| malformed("protobuf length"))?;
                if b.len() < len {
                    return Err(malformed("truncated protobuf field"));
                }
                out.push((field, PbValue::Bytes(&b[..len])));
                b = &b[len..];
            }
            1 if b.len() >= 8 => b = &b[8..],
            5 if b.len() >= 4 => b = &b[4..],
            _ => return Err(malformed("protobuf wire type")),
        }
    }
    Ok(out)
}

struct PbLink {
    cid: Cid,
    name: String,
}

struct PbNode {
    links: Vec<PbLink>,
    data: Option<Vec<u8>>,
}

fn decode_dag_pb(block: &[u8]) -> Result<PbNode> {
    let mut node = PbNode {
        links: Vec::new(),
        data: None,
    };
    for (field, value) in pb_fields(block)? {
        match (field, value) {
            (1, PbValue::Bytes(d)) => node.data = Some(d.to_vec()),
            (2, PbValue::Bytes(l)) => node.links.push(decode_link(l)?),
            _ => return Err(malformed("dag-pb field")),
        }
    }
    Ok(node)
}

fn decode_link(b: &[u8]) -> Result<PbLink> {
    let mut cid = None;
    let mut name = String::new();
    for (field, value) in pb_fields(b)? {
        match (field, value) {
            (1, PbValue::Bytes(h)) => {
                let (c, used) = Cid::from_bytes(h)?;
                if used != h.len() {
                    return Err(malformed("link hash"));
                }
                cid = Some(c);
            }
            (2, PbValue::Bytes(n)) => {
                name = String::from_utf8(n.to_vec()).map_err(|_| malformed("link name"))?;
            }
            _ => {} // Tsize и прочее не нужно
        }
    }
    Ok(PbLink {
        cid: cid.ok_or_else(|| malformed("link without hash"))?,
        name,
    })
}

struct UnixFs {
    kind: u64,
    data: Option<Vec<u8>>,
    hash_type: Option<u64>,
    fanout: Option<u64>,
}

fn decode_unixfs(node: &PbNode) -> Result<UnixFs> {
    let bytes = node
        .data
        .as_deref()
        .ok_or_else(|| malformed("dag-pb node without UnixFS data"))?;
    let mut fs = UnixFs {
        kind: u64::MAX,
        data: None,
        hash_type: None,
        fanout: None,
    };
    for (field, value) in pb_fields(bytes)? {
        match (field, value) {
            (1, PbValue::Varint(k)) => fs.kind = k,
            (2, PbValue::Bytes(d)) => fs.data = Some(d.to_vec()),
            (5, PbValue::Varint(h)) => fs.hash_type = Some(h),
            (6, PbValue::Varint(f)) => fs.fanout = Some(f),
            _ => {} // filesize, blocksizes, mode, mtime
        }
    }
    if fs.kind == u64::MAX {
        return Err(malformed("UnixFS without type"));
    }
    Ok(fs)
}

// ---------------------------------------------------------------------------
// CAR
// ---------------------------------------------------------------------------

/// Блоки CAR-файла на диске: где лежит каждый. Хэш проверяется при чтении
/// (`get`) — у тех блоков, на которые реально сослались.
pub struct CarBlocks {
    file: File,
    index: HashMap<Vec<u8>, (u64, usize)>,
}

impl CarBlocks {
    /// Индексирует CARv1. Дубликаты блоков (dups=y) не мешают.
    pub fn open(mut file: File) -> Result<Self> {
        let mut index = HashMap::new();
        {
            let mut r = BufReader::new(&mut file);
            let (header_len, n) =
                read_uvarint(&mut r)?.ok_or_else(|| malformed("empty CAR"))?;
            if header_len > MAX_CAR_HEADER {
                return Err(malformed("CAR header too large"));
            }
            let mut header = vec![0u8; header_len as usize];
            r.read_exact(&mut header)?;
            // dag-cbor {roots, version: 1}: ключ «version» (0x67) и значение 1.
            if !header.windows(9).any(|w| w == b"\x67version\x01") {
                return Err(VerifyError::Unsupported("CAR version".into()));
            }
            let mut pos = n as u64 + header_len;
            while let Some((section_len, n)) = read_uvarint(&mut r)? {
                pos += n as u64;
                if section_len > MAX_BLOCK_SIZE + 128 {
                    return Err(malformed("CAR section too large"));
                }
                let mut section = vec![0u8; section_len as usize];
                r.read_exact(&mut section)?;
                let (cid, used) = Cid::from_bytes(&section)?;
                index
                    .entry(cid.multihash())
                    .or_insert((pos + used as u64, section.len() - used));
                pos += section_len;
                if index.len() > MAX_BLOCKS {
                    return Err(VerifyError::TooLarge);
                }
            }
        }
        Ok(CarBlocks { file, index })
    }

    /// Проверенный блок по CID. identity — данные прямо из CID.
    fn get(&mut self, cid: &Cid) -> Result<Vec<u8>> {
        if cid.hash_code == HASH_IDENTITY {
            if cid.digest.len() > MAX_IDENTITY_SIZE {
                return Err(VerifyError::Unsupported("oversized identity CID".into()));
            }
            return Ok(cid.digest.clone());
        }
        let &(offset, len) = self
            .index
            .get(&cid.multihash())
            .ok_or_else(|| VerifyError::MissingBlock(cid.short()))?;
        self.file.seek(SeekFrom::Start(offset))?;
        let mut block = vec![0u8; len];
        self.file.read_exact(&mut block)?;
        cid.verify(&block)?;
        Ok(block)
    }

    fn get_dag_pb(&mut self, cid: &Cid) -> Result<(PbNode, UnixFs)> {
        if cid.codec != CODEC_DAG_PB {
            return Err(VerifyError::Unsupported(format!("codec 0x{:x}", cid.codec)));
        }
        let node = decode_dag_pb(&self.get(cid)?)?;
        let fs = decode_unixfs(&node)?;
        Ok((node, fs))
    }
}

// ---------------------------------------------------------------------------
// Обход
// ---------------------------------------------------------------------------

/// CID по пути от корня: обычные каталоги и шардированные (HAMT).
pub fn resolve_path(blocks: &mut CarBlocks, root: &Cid, path: &[String]) -> Result<Cid> {
    let mut cur = root.clone();
    for name in path {
        if cur.codec != CODEC_DAG_PB {
            return Err(VerifyError::NotFound(name.clone()));
        }
        let (node, fs) = blocks.get_dag_pb(&cur)?;
        cur = match fs.kind {
            UNIXFS_DIRECTORY => node
                .links
                .into_iter()
                .find(|l| l.name == *name)
                .map(|l| l.cid)
                .ok_or_else(|| VerifyError::NotFound(name.clone()))?,
            UNIXFS_HAMT_SHARD => hamt_find(blocks, node, fs, name)?,
            _ => return Err(VerifyError::NotFound(name.clone())),
        };
    }
    Ok(cur)
}

/// Поиск имени в HAMT-каталоге UnixFS: murmur3 от имени режется на куски по
/// log2(fanout) бит, старшие первыми; каждый кусок — номер слота на своём
/// уровне. Ссылка слота называется HEX-номером (`0A`) — это вложенный шард, или
/// номером с именем (`0Af10.txt`) — это сама запись.
fn hamt_find(blocks: &mut CarBlocks, root: PbNode, root_fs: UnixFs, name: &str) -> Result<Cid> {
    if root_fs.hash_type != Some(HASH_MURMUR3_X64_64) {
        return Err(VerifyError::Unsupported("HAMT hash function".into()));
    }
    let fanout = root_fs.fanout.ok_or_else(|| malformed("HAMT without fanout"))?;
    if !fanout.is_power_of_two() || !(2..=4096).contains(&fanout) {
        return Err(malformed("HAMT fanout"));
    }
    let bits = fanout.trailing_zeros();
    let pad = format!("{:X}", fanout - 1).len();
    let hash = murmur3_x64_64(name.as_bytes());

    let mut node = root;
    let mut consumed = 0u32;
    loop {
        if consumed + bits > 64 {
            return Err(VerifyError::NotFound(name.to_string()));
        }
        let slot = (hash << consumed) >> (64 - bits);
        consumed += bits;
        let prefix = format!("{slot:0pad$X}");
        let link = node
            .links
            .into_iter()
            .find(|l| l.name.starts_with(&prefix))
            .ok_or_else(|| VerifyError::NotFound(name.to_string()))?;
        if link.name.len() == pad {
            let (child, fs) = blocks.get_dag_pb(&link.cid)?;
            if fs.kind != UNIXFS_HAMT_SHARD || fs.fanout != Some(fanout) {
                return Err(malformed("HAMT sub-shard"));
            }
            node = child;
            continue;
        }
        return if link.name[pad..] == *name {
            Ok(link.cid)
        } else {
            Err(VerifyError::NotFound(name.to_string()))
        };
    }
}

/// Байты файла UnixFS по порядку: данные узла, затем его дети слева направо.
pub fn write_file<W: Write>(
    blocks: &mut CarBlocks,
    entity: &Cid,
    out: &mut W,
    max_bytes: u64,
) -> Result<u64> {
    let mut stack = vec![entity.clone()];
    let (mut written, mut visits) = (0u64, 0u64);
    while let Some(cid) = stack.pop() {
        visits += 1;
        if visits > MAX_VISITS {
            return Err(VerifyError::TooLarge);
        }
        let data = match cid.codec {
            CODEC_RAW => blocks.get(&cid)?,
            CODEC_DAG_PB => {
                let (node, fs) = blocks.get_dag_pb(&cid)?;
                match fs.kind {
                    UNIXFS_FILE | UNIXFS_RAW => {
                        stack.extend(node.links.into_iter().rev().map(|l| l.cid));
                        fs.data.unwrap_or_default()
                    }
                    UNIXFS_DIRECTORY | UNIXFS_HAMT_SHARD => return Err(VerifyError::IsDirectory),
                    UNIXFS_SYMLINK => return Err(VerifyError::Unsupported("symlink".into())),
                    other => return Err(VerifyError::Malformed(format!("UnixFS type {other}"))),
                }
            }
            other => return Err(VerifyError::Unsupported(format!("codec 0x{other:x}"))),
        };
        written += data.len() as u64;
        if written > max_bytes {
            return Err(VerifyError::TooLarge);
        }
        out.write_all(&data)?;
    }
    Ok(written)
}

/// Файл из CAR: путь от корня ссылки, каждый блок проверен. Возвращает размер.
pub fn extract_file<W: Write>(
    car: File,
    root: &Cid,
    path: &[String],
    out: &mut W,
    max_bytes: u64,
) -> Result<u64> {
    let mut blocks = CarBlocks::open(car)?;
    let entity = resolve_path(&mut blocks, root, path)?;
    write_file(&mut blocks, &entity, out, max_bytes)
}

// ---------------------------------------------------------------------------
// murmur3
// ---------------------------------------------------------------------------

/// Первые 64 бита MurmurHash3_x64_128 с seed 0 — как `murmur3.New64` в
/// go-unixfs (он же и в Kubo): ими адресуются слоты HAMT.
fn murmur3_x64_64(data: &[u8]) -> u64 {
    murmur3_x64_128(data, 0).0
}

fn fmix64(mut k: u64) -> u64 {
    k ^= k >> 33;
    k = k.wrapping_mul(0xff51_afd7_ed55_8ccd);
    k ^= k >> 33;
    k = k.wrapping_mul(0xc4ce_b9fe_1a85_ec53);
    k ^ (k >> 33)
}

fn murmur3_x64_128(data: &[u8], seed: u64) -> (u64, u64) {
    const C1: u64 = 0x87c3_7b91_1142_53d5;
    const C2: u64 = 0x4cf5_ad43_2745_937f;
    let (mut h1, mut h2) = (seed, seed);
    let mut blocks = data.chunks_exact(16);
    for block in &mut blocks {
        let mut k1 = u64::from_le_bytes(block[..8].try_into().expect("8 bytes"));
        let mut k2 = u64::from_le_bytes(block[8..].try_into().expect("8 bytes"));
        k1 = k1.wrapping_mul(C1).rotate_left(31).wrapping_mul(C2);
        h1 ^= k1;
        h1 = h1.rotate_left(27).wrapping_add(h2).wrapping_mul(5).wrapping_add(0x52dc_e729);
        k2 = k2.wrapping_mul(C2).rotate_left(33).wrapping_mul(C1);
        h2 ^= k2;
        h2 = h2.rotate_left(31).wrapping_add(h1).wrapping_mul(5).wrapping_add(0x3849_5ab5);
    }
    let tail = blocks.remainder();
    let (mut k1, mut k2) = (0u64, 0u64);
    for (i, &byte) in tail.iter().enumerate() {
        if i < 8 {
            k1 ^= u64::from(byte) << (8 * i);
        } else {
            k2 ^= u64::from(byte) << (8 * (i - 8));
        }
    }
    if tail.len() > 8 {
        h2 ^= k2.wrapping_mul(C2).rotate_left(33).wrapping_mul(C1);
    }
    if !tail.is_empty() {
        h1 ^= k1.wrapping_mul(C1).rotate_left(31).wrapping_mul(C2);
    }
    let len = data.len() as u64;
    h1 ^= len;
    h2 ^= len;
    h1 = h1.wrapping_add(h2);
    h2 = h2.wrapping_add(h1);
    h1 = fmix64(h1);
    h2 = fmix64(h2);
    h1 = h1.wrapping_add(h2);
    h2 = h2.wrapping_add(h1);
    (h1, h2)
}

#[cfg(test)]
mod tests {
    //! Фикстуры — testdata/*.car, сняты Kubo v0.43.0 скриптом
    //! testdata/make-fixtures.sh (CID — в testdata/cids.env).
    use super::*;

    const SMALL_V0: &str = "QmWmkE7shY3Z4JnHqMYqvzLvsAR5ZYhkHSuskPXSCdHKSF";
    const CHUNKED_V0: &str = "QmYdDbAGaTRc5KgQhznmX9F5mEfzyFrdzcPZrEukdrXvbd";
    const DEEP_V1: &str = "bafybeib6r2qk4qrwf3f4otzo5qiyac7mfoqq2m4oyfy5ml6icssb52dul4";
    const SITE_V1: &str = "bafybeifson4pvbi2mutnpylre426pghwfo6wszesnksilpofbap6imhl6e";
    const INLINE_V1: &str = "bafyaagascifaoakvaabwq2ikcicwcltupb2bqaykaieac";
    const SHA512_V1: &str = "bafkrgqaxh7dctookfe4ftocaedcpc2gb77xactevfeqjfiqvaf7fnv2qjqqmeb62xmak5pbapfby5x3wxqkjxufpmvibk7pjkaohqbo5sx2rw";
    const BLAKE3_V1: &str = "bafkr4igxau6eosyvmifupkb4u37mmsht6am7gtu44a4pyie3wd5nzc64hu";
    const HAMT_V1: &str = "bafybeiebhxtf6cz7c2cxa74wbun33b2jybubkgqrtsbqlpa7w4sjrdpqma";

    /// Содержимое сгенерированных файлов — как `pattern` в make-fixtures.sh.
    fn pattern(n: usize) -> Vec<u8> {
        (0..n).map(|i| ((i * 37 + 11) % 256) as u8).collect()
    }

    fn fixture(name: &str) -> Vec<u8> {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src/ipfs/testdata")
            .join(name);
        std::fs::read(path).expect("fixture")
    }

    /// CAR-байты во временный файл (verify работает с файлом на диске).
    fn car_file(bytes: &[u8]) -> File {
        static COUNTER: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
        let n = COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        let path = std::env::temp_dir().join(format!("verify-test-{}-{n}.car", std::process::id()));
        std::fs::write(&path, bytes).unwrap();
        let file = File::open(&path).unwrap();
        let _ = std::fs::remove_file(&path); // unix: файл живёт, пока открыт
        file
    }

    fn extract(car: &[u8], root: &str, path: &[&str]) -> Result<Vec<u8>> {
        let path: Vec<String> = path.iter().map(|s| s.to_string()).collect();
        let mut out = Vec::new();
        extract_file(car_file(car), &Cid::parse(root)?, &path, &mut out, u64::MAX)?;
        Ok(out)
    }

    /// Смещения секций CAR: (начало секции, начало данных блока, конец).
    fn sections(car: &[u8]) -> Vec<(usize, usize, usize)> {
        let (header_len, n) = uvarint(car).unwrap();
        let mut pos = n + header_len as usize;
        let mut out = Vec::new();
        while pos < car.len() {
            let start = pos;
            let (len, n) = uvarint(&car[pos..]).unwrap();
            pos += n;
            let (_, used) = Cid::from_bytes(&car[pos..]).unwrap();
            out.push((start, pos + used, pos + len as usize));
            pos += len as usize;
        }
        out
    }

    #[test]
    fn parses_one_cid_in_every_supported_multibase() {
        let v0 = Cid::parse(SMALL_V0).unwrap();
        for s in [
            "bafybeid5jnarnbmxfdidpcgqdsxu5jz5dtmqcjkt2k43wcmbvul5prf4ea",
            "BAFYBEID5JNARNBMXFDIDPCGQDSXU5JZ5DTMQCJKT2K43WCMBVUL5PRF4EA",
            "k2jmtxuhj5f39u2z4xn2ic1y13n5gfntzemkxymxbg3xc5opph03esrk",
            "zdj7WdrzbYwZ1X9w26Da6WToNBVVNcXH67t9mKQRBv724rDcB",
            "f017012207d4b4116859728d03788d01caf4ea73d1cd9012553d2b9bb0981ad17d7c4bc20",
        ] {
            assert_eq!(Cid::parse(s).unwrap(), v0, "{s}");
        }
        assert_eq!(v0.codec, CODEC_DAG_PB);
        assert_eq!(v0.hash_code, HASH_SHA2_256);
    }

    #[test]
    fn rejects_garbage_cids() {
        assert!(Cid::parse("").is_err());
        assert!(Cid::parse("bafy!!!").is_err());
        assert!(Cid::parse("xabc").is_err()); // неизвестный multibase
        assert!(Cid::parse("Qm11111111111111111111111111111111111111111111").is_err());
    }

    #[test]
    fn murmur3_matches_reference_vectors() {
        assert_eq!(murmur3_x64_128(b"", 0), (0, 0));
        // Эталон MurmurHash3_x64_128 (seed 0) — первые 64 бита, как в go murmur3.Sum64.
        assert_eq!(murmur3_x64_64(b"hello"), 0xcbd8_a7b3_41bd_9b02);
    }

    #[test]
    fn extracts_cidv0_files() {
        assert_eq!(extract(&fixture("small-v0.car"), SMALL_V0, &[]).unwrap(), b"hello bastyon\n");
        // 16 dag-pb-листьев (UnixFS Raw) под корнем File.
        assert_eq!(extract(&fixture("chunked-v0.car"), CHUNKED_V0, &[]).unwrap(), pattern(1000));
    }

    #[test]
    fn extracts_a_deep_raw_leaves_tree() {
        assert_eq!(extract(&fixture("deep-v1.car"), DEEP_V1, &[]).unwrap(), pattern(6000));
    }

    #[test]
    fn resolves_paths_through_directories() {
        let car = fixture("site-v1.car");
        assert_eq!(extract(&car, SITE_V1, &["index.html"]).unwrap(), b"<h1>hi</h1>\n");
        assert_eq!(extract(&car, SITE_V1, &["assets", "app.js"]).unwrap(), pattern(3000));
        assert!(matches!(extract(&car, SITE_V1, &[]), Err(VerifyError::IsDirectory)));
        assert!(matches!(extract(&car, SITE_V1, &["assets"]), Err(VerifyError::IsDirectory)));
        assert!(matches!(extract(&car, SITE_V1, &["nope.js"]), Err(VerifyError::NotFound(_))));
        // Путь «сквозь» файл.
        assert!(matches!(
            extract(&car, SITE_V1, &["index.html", "x"]),
            Err(VerifyError::NotFound(_))
        ));
    }

    #[test]
    fn finds_every_entry_of_a_sharded_directory() {
        let car = fixture("hamt-v1.car");
        let mut blocks = CarBlocks::open(car_file(&car)).unwrap();
        let root = Cid::parse(HAMT_V1).unwrap();
        let (_, fs) = blocks.get_dag_pb(&root).unwrap();
        assert_eq!(fs.kind, UNIXFS_HAMT_SHARD);
        for i in 0..300 {
            let name = format!("f{i}.txt");
            let cid = resolve_path(&mut blocks, &root, std::slice::from_ref(&name)).unwrap();
            let mut out = Vec::new();
            write_file(&mut blocks, &cid, &mut out, u64::MAX).unwrap();
            assert_eq!(out, format!("entry {i}\n").as_bytes(), "{name}");
        }
        assert!(matches!(
            resolve_path(&mut blocks, &root, &["f300.txt".into()]),
            Err(VerifyError::NotFound(_))
        ));
    }

    #[test]
    fn identity_and_sha512_cids_are_verified_too() {
        // Каталог и файл целиком внутри CID: в CAR блоков нет вовсе.
        assert_eq!(extract(&fixture("inline-v1.car"), INLINE_V1, &["a.txt"]).unwrap(), b"hi\n");
        assert_eq!(extract(&fixture("sha512-v1.car"), SHA512_V1, &[]).unwrap(), b"hello bastyon\n");
    }

    #[test]
    fn unverifiable_hash_is_refused_not_trusted() {
        assert!(matches!(
            extract(&fixture("blake3-v1.car"), BLAKE3_V1, &[]),
            Err(VerifyError::Unsupported(_))
        ));
    }

    #[test]
    fn a_tampered_block_is_rejected() {
        let mut car = fixture("deep-v1.car");
        // Портим байт в данных последнего блока (листа файла).
        let (_, data_start, end) = *sections(&car).last().unwrap();
        car[(data_start + end) / 2] ^= 0x01;
        assert!(matches!(extract(&car, DEEP_V1, &[]), Err(VerifyError::Mismatch(_))));
    }

    #[test]
    fn a_substituted_root_is_rejected() {
        // Шлюз отдал чужой (но корректный) CAR: корень из ссылки в нём не найдётся.
        assert!(matches!(
            extract(&fixture("small-v0.car"), CHUNKED_V0, &[]),
            Err(VerifyError::MissingBlock(_))
        ));
    }

    #[test]
    fn a_missing_block_is_reported() {
        let car = fixture("deep-v1.car");
        let (start, _, _) = *sections(&car).last().unwrap();
        assert!(matches!(
            extract(&car[..start], DEEP_V1, &[]),
            Err(VerifyError::MissingBlock(_))
        ));
    }

    #[test]
    fn duplicated_blocks_do_not_matter() {
        let car = fixture("chunked-v0.car");
        let (start, _, end) = sections(&car)[1];
        let mut dup = car.clone();
        dup.extend_from_slice(&car[start..end]);
        assert_eq!(extract(&dup, CHUNKED_V0, &[]).unwrap(), pattern(1000));
    }

    #[test]
    fn size_limit_stops_the_output() {
        let path: Vec<String> = Vec::new();
        let mut out = Vec::new();
        let res = extract_file(
            car_file(&fixture("deep-v1.car")),
            &Cid::parse(DEEP_V1).unwrap(),
            &path,
            &mut out,
            1000,
        );
        assert!(matches!(res, Err(VerifyError::TooLarge)));
        assert!(out.len() <= 1000);
    }

    #[test]
    fn not_a_car_is_rejected() {
        let path: Vec<String> = Vec::new();
        let root = Cid::parse(SMALL_V0).unwrap();
        let html = b"<html>504 Gateway Timeout</html>";
        assert!(extract_file(car_file(html), &root, &path, &mut Vec::new(), u64::MAX).is_err());
        assert!(extract_file(car_file(b""), &root, &path, &mut Vec::new(), u64::MAX).is_err());
    }
}
