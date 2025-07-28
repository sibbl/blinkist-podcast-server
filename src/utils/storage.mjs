import fs from "fs";
import prependFile from "prepend-file";
import readline from "readline";

import {
  getDataRootDir,
  getBookListFilePath,
  getBookDirectory,
  getBookDataPath,
  getChapterAudioFilePath,
  getBookAudioRawFilePath,
  getBookAudioFinalFilePath,
  getBookCoverFilePath,
} from "./paths.mjs";
import { getBookRssCachePath } from "./paths.mjs";

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
  await fs.promises.mkdir(getDataRootDir(), { recursive: true });
  const filePath = getBookListFilePath(language);
  await prependFile(filePath, book.id + "\r\n");
}

export async function getBookListEntriesAsync(language, maxEntries = null) {
  const { entries } = await getBookListEntriesPageAsync(language, 0, maxEntries);
  return entries;
}

export async function getBookListEntriesPageAsync(language, offset = 0, limit = null) {
  const filePath = getBookListFilePath(language);

  const exists = await fileExistsAsync(filePath);
  if (!exists) {
    return { entries: [], hasMore: false };
  }

  return await new Promise((resolve, reject) => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(filePath),
    });
    let lineCounter = 0;
    let result = [];
    let hasMore = false;
    const stopAt =
      limit != null ? offset + limit + 1 : Infinity;
    lineReader.on("line", (line) => {
      lineCounter++;
      if (lineCounter > offset && (limit == null || result.length < limit)) {
        result.push(line);
      }
      if (lineCounter >= stopAt) {
        hasMore = true;
        lineReader.close();
      }
    });
    lineReader.on("close", () => {
      resolve({ entries: result.filter((x) => x), hasMore });
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

export async function getBookRssCacheAsync(bookId) {
  const filePath = getBookRssCachePath(bookId);
  const fileContent = await fs.promises.readFile(filePath);
  return JSON.parse(fileContent);
}

export async function saveBookRssCacheAsync(bookId, cacheData) {
  const filePath = getBookRssCachePath(bookId);
  await fs.promises.writeFile(
    filePath,
    JSON.stringify(cacheData, undefined, 4)
  );
  return filePath;
}

export function doesBookRssCacheExistAsync(bookId) {
  return fileExistsAsync(getBookRssCachePath(bookId));
}

export async function cleanTemporaryAudioFilesAsync(book) {
  const chapterFilePaths = book.chapters.map(({id}) => getChapterAudioFilePath(book.id, id));
  const pathsToDelete = [...chapterFilePaths, getBookAudioRawFilePath(book.id)]
  await Promise.all(pathsToDelete.map(x => fs.promises.unlink(x)));
}
