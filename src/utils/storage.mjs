import path from "path";
import fs from "fs";
import util from "util";
import prependFile from "prepend-file";
import readline from "readline";

const DATA_DIR = path.join(process.cwd(), "data");

const prependFileAsync = util.promisify(prependFile);

export function getBookListFilePath(language) {
  return path.join(DATA_DIR, `list_${language}.txt`);
}

export function getBookDirectory(bookId) {
  return path.join(DATA_DIR, bookId);
}

export function getBookDataPath(bookId) {
  return path.join(getBookDirectory(bookId), "data.json");
}

export function getChapterAudioFilePath(bookId, chapterId) {
  return path.join(DATA_DIR, bookId, chapterId);
}

export function getBookAudioRawFilePath(bookId) {
  return path.join(DATA_DIR, bookId, "raw.m4a");
}

export function getBookAudioFinalFilePath(bookId) {
  return path.join(DATA_DIR, bookId, "final.m4a");
}

export function getBookCoverFilePath(bookId) {
  return path.join(DATA_DIR, bookId, "cover.jpg");
}

async function fileExists(filePath) {
  try {
    await fs.promises.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export function doesBookExist(bookId) {
  return fileExists(getBookDataPath(bookId));
}

export async function saveChapterAudioFile(bookId, chapterId, audioData) {
  await fs.promises.mkdir(getBookDirectory(bookId), { recursive: true });
  const filePath = getChapterAudioFilePath(bookId, chapterId);
  await fs.promises.writeFile(filePath, audioData);
  return filePath;
}

export async function saveBookDetails(book) {
  await fs.promises.mkdir(getBookDirectory(book.id), { recursive: true });
  const filePath = getBookDataPath(book.id);
  await fs.promises.writeFile(filePath, JSON.stringify(book, undefined, 4));
  return filePath;
}

export async function getBookDetails(bookId) {
  const filePath = getBookDataPath(bookId);
  const data = await fs.promises.readFile(filePath);
  return JSON.parse(data);
}

export async function appendBookToBookList(book, language) {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const filePath = getBookListFilePath(language);
  await prependFileAsync(filePath, book.id + "\r\n");
}

export async function getBookListEntries(language, maxEntries = null) {
  const filePath = getBookListFilePath(language);

  const exists = await fileExists(filePath);
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
      resolve(result);
    });
    lineReader.on("error", (err) => {
      reject(err);
    });
  });
}

export async function saveBookCover(book, coverData) {
  await fs.promises.mkdir(getBookDirectory(book.id), { recursive: true });
  const filePath = getBookCoverFilePath(book.id);
  await fs.promises.writeFile(filePath, coverData);
  return filePath;
}

export async function getBookCover(book) {
  const filePath = getBookCoverFilePath(book.id);
  return await fs.promises.readFile(filePath);
}

export async function getBookDownloadDate(bookId) {
  const filePath = getBookDataPath(bookId);
  const stat = await fs.promises.stat(filePath);
  return new Date(stat.mtime);
}

export async function getBookAudioData(book) {
  const filePath = getBookAudioFinalFilePath(book.id);
  return await fs.promises.readFile(filePath);
}

export async function getBookListLastModifiedDate(language) {
  const filePath = getBookListFilePath(language);
  const stat = await fs.promises.stat(filePath);
  return new Date(stat.mtime);
}
