import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

export function getDataRootDir() {
  return DATA_DIR;
}

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
