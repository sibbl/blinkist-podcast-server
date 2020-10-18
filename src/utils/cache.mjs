import {
  getAudioLengthAsync,
  getChaptersWithAudioLengthsAsync,
} from "./audio.mjs";
import { getBookAudioFinalFilePath } from "./paths.mjs";
import {
  getBookRssCacheAsync,
  doesBookRssCacheExistAsync,
  getBookDownloadDateAsync,
  saveBookRssCacheAsync,
} from "./storage.mjs";

export async function getOrCreateRssCacheAsync(book) {
  const cacheExists = await doesBookRssCacheExistAsync(book.id);

  if (cacheExists) {
    return getBookRssCacheAsync(book.id);
  }

  const filePath = getBookAudioFinalFilePath(book.id);

  const [duration, pubDate, chapterData] = await Promise.all([
    getAudioLengthAsync(filePath),
    getBookDownloadDateAsync(book.id),
    getChaptersWithAudioLengthsAsync(book),
  ]);

  const cacheContent = { duration, pubDate, chapterData };

  await saveBookRssCacheAsync(book.id, cacheContent);

  return cacheContent;
}
