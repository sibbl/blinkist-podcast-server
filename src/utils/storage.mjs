import fs from "fs";
import util from "util";
import prependFile from "prepend-file";
import readline from "readline";

import {
  getBookListFilePath,
  getBookDirectory,
  getBookDataPath,
  getChapterAudioFilePath,
  getBookAudioRawFilePath,
  getBookAudioFinalFilePath,
  getBookCoverFilePath,
} from "./paths.mjs";

const prependFileAsync = util.promisify(prependFile);

async function fileExistsAsync(filePath) {
  try {
    await fs.promises.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export function doesBookExistAsync(bookId) {
  return fileExistsAsync(getBookDataPath(bookId));
}

export async function saveChapterAudioFileAsync(bookId, chapterId, audioData) {
  await fs.promises.mkdir(getBookDirectory(bookId), { recursive: true });
  const filePath = getChapterAudioFilePath(bookId, chapterId);
  await fs.promises.writeFile(filePath, audioData);
  return filePath;
}

export async function saveBookDetailsAsync(book) {
  await fs.promises.mkdir(getBookDirectory(book.id), { recursive: true });
  const filePath = getBookDataPath(book.id);
  await fs.promises.writeFile(filePath, JSON.stringify(book, undefined, 4));
  return filePath;
}

export async function getBookDetailsAsync(bookId) {
  const filePath = getBookDataPath(bookId);
  const data = await fs.promises.readFile(filePath);
  return JSON.parse(data);
}

export async function appendBookToBookListAsync(book, language) {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const filePath = getBookListFilePath(language);
  await prependFileAsync(filePath, book.id + "\r\n");
}

export async function getBookListEntriesAsync(language, maxEntries = null) {
  const filePath = getBookListFilePath(language);

  const exists = await fileExistsAsync(filePath);
  if (!exists) {
    return [];
  }

  return await new Promise((resolve, reject) => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(filePath),
    });
    let lineCounter = 0;
    let result = [];
    lineReader.on("line", (line) => {
      lineCounter++;
      result.push(line);
      if (maxEntries != null && lineCounter == maxEntries) {
        lineReader.close();
      }
    });
    lineReader.on("close", () => {
      resolve(result.filter((x) => x));
    });
    lineReader.on("error", (err) => {
      reject(err);
    });
  });
}

export async function saveBookCoverAsync(book, coverData) {
  await fs.promises.mkdir(getBookDirectory(book.id), { recursive: true });
  const filePath = getBookCoverFilePath(book.id);
  await fs.promises.writeFile(filePath, coverData);
  return filePath;
}

export async function getBookCoverAsync(book) {
  const filePath = getBookCoverFilePath(book.id);
  return await fs.promises.readFile(filePath);
}

export async function getBookDownloadDateAsync(bookId) {
  const filePath = getBookDataPath(bookId);
  const stat = await fs.promises.stat(filePath);
  return new Date(stat.mtime);
}

export async function getBookAudioDataAsync(book) {
  const filePath = getBookAudioFinalFilePath(book.id);
  return await fs.promises.readFile(filePath);
}

export async function getBookListLastModifiedDateAsync(language) {
  const filePath = getBookListFilePath(language);
  const stat = await fs.promises.stat(filePath);
  return new Date(stat.mtime);
}
