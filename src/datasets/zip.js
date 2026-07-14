import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - 22 - 65535);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  throw new Error("Zip end-of-central-directory record not found");
}

function readEntryData(buffer, centralOffset) {
  const method = buffer.readUInt16LE(centralOffset + 10);
  const compressedSize = buffer.readUInt32LE(centralOffset + 20);
  const localOffset = buffer.readUInt32LE(centralOffset + 42);

  if (buffer.readUInt32LE(localOffset) !== LOCAL_HEADER_SIGNATURE) {
    throw new Error("Zip local file header signature mismatch");
  }
  const localNameLength = buffer.readUInt16LE(localOffset + 26);
  const localExtraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + localNameLength + localExtraLength;
  const data = buffer.subarray(dataStart, dataStart + compressedSize);

  if (method === 0) {
    return Buffer.from(data);
  }
  if (method === 8) {
    return inflateRawSync(data);
  }
  throw new Error(`Unsupported zip compression method ${method}`);
}

export function extractZipEntries(archiveBuffer) {
  const buffer = Buffer.from(archiveBuffer);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  const entries = new Map();
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Zip central directory signature mismatch");
    }
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    if (!name.endsWith("/")) {
      entries.set(name, readEntryData(buffer, offset));
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
