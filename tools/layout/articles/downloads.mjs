const encoder = new TextEncoder();

export function cleanFilename(value, fallback = '图文排版') {
  const safe = String(value ?? '').trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ');
  return Array.from(safe).slice(0, 36).join('') || fallback;
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  try {
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Store-only ZIP follows the existing card-download format; PNG is already compressed.
export function zipFiles(files, { maxFiles = 200, maxBytes = 200 * 1024 * 1024 } = {}) {
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 512 || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 256 * 1024 * 1024) throw new Error('压缩包限制无效。');
  if (!Array.isArray(files) || !files.length || files.length > maxFiles) throw new Error(`压缩包支持1至${maxFiles}个文件。`);
  const chunks = [], directory = [], names = new Set();
  let offset = 0, directoryLength = 0, total = 0;
  for (const file of files) {
    if (!file || typeof file.name !== 'string' || !file.name || file.name === '..' || /[/\\:\u0000-\u001f\u007f]/.test(file.name)) throw new Error('下载文件名无效。');
    if (names.has(file.name)) throw new Error('下载文件名重复。');
    names.add(file.name);
    if (!(file.bytes instanceof Uint8Array)) throw new Error('下载文件数据无效。');
    total += file.bytes.length;
    if (total > maxBytes) throw new Error('压缩包内容过大，请减少图片或分批保存。');
    const name = encoder.encode(file.name);
    if (name.length > 255) throw new Error('下载文件名过长。');
    const checksum = crc32(file.bytes);
    const local = new Uint8Array(30 + name.length), view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
    view.setUint16(12, 0x21, true); view.setUint32(14, checksum, true); view.setUint32(18, file.bytes.length, true); view.setUint32(22, file.bytes.length, true); view.setUint16(26, name.length, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length), entry = new DataView(central.buffer);
    entry.setUint32(0, 0x02014b50, true); entry.setUint16(4, 20, true); entry.setUint16(6, 20, true); entry.setUint16(8, 0x0800, true); entry.setUint16(14, 0x21, true);
    entry.setUint32(16, checksum, true); entry.setUint32(20, file.bytes.length, true); entry.setUint32(24, file.bytes.length, true); entry.setUint16(28, name.length, true); entry.setUint32(42, offset, true); central.set(name, 46);
    chunks.push(local, file.bytes); directory.push(central); offset += local.length + file.bytes.length; directoryLength += central.length;
  }
  const end = new Uint8Array(22), endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true); endView.setUint32(12, directoryLength, true); endView.setUint32(16, offset, true);
  const result = new Uint8Array(offset + directoryLength + end.length);
  let cursor = 0;
  for (const chunk of [...chunks, ...directory, end]) { result.set(chunk, cursor); cursor += chunk.length; }
  return result;
}
