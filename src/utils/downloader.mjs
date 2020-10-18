import axios from "axios";
import cheerio from "cheerio";
import {
  getBookAudioRawFilePath,
  getBookAudioFinalFilePath,
} from "./paths.mjs";
import {
  doesBookExistAsync,
  saveChapterAudioFileAsync,
  saveBookDetailsAsync,
  appendBookToBookListAsync,
  getBookDetailsAsync,
  saveBookCoverAsync,
} from "./storage.mjs";
import { concatAudioFilesAsync, enrichAudioAsync } from "./audio.mjs";
import { getOrCreateRssCacheAsync } from "./cache.mjs";

const BASE_URL = "https://www.blinkist.com";

export async function scrapeDailyBlinkAsync(language) {
  console.log("Start scraping", language);

  const overviewUrl = `${BASE_URL}/${language}/nc/daily/`;
  const bookUrl = await getBookUrl(overviewUrl);

  console.log("Getting details of", overviewUrl);

  const bookId = await retrieveBookId(BASE_URL + bookUrl);

  if (await doesBookExistAsync(bookId)) {
    const existingBook = await getBookDetailsAsync(bookId);
    console.log(
      "Skipping because book already exists",
      language,
      bookId,
      existingBook.title
    );
    return;
  }

  const bookDetails = await retrieveBookDetails(bookId);

  console.log("Downloading...", language, bookDetails.id, bookDetails.title);

  await retrieveAndSaveCover(bookDetails);
  await retrieveAndSaveAudioFiles(bookDetails);

  console.log(
    "Concatinating audio files...",
    language,
    bookDetails.id,
    bookDetails.title
  );
  const concatAudioFilePath = getBookAudioRawFilePath(bookDetails.id);
  await concatAudioFilesAsync(bookDetails, concatAudioFilePath);

  const enrichedAudioFilePath = getBookAudioFinalFilePath(bookDetails.id);

  console.log(
    "Adding chapter marks...",
    language,
    bookDetails.id,
    bookDetails.title
  );
  await enrichAudioAsync(
    concatAudioFilePath,
    bookDetails,
    enrichedAudioFilePath
  );

  await appendBookToBookListAsync(bookDetails, language);
  await saveBookDetailsAsync(bookDetails);
  await getOrCreateRssCacheAsync(bookDetails);

  console.log("Finished scraping", language, bookDetails.id, bookDetails.title);
}

async function getBookUrl(url) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  return $("a.daily-book__cta").attr("href");
}

async function retrieveBookId(url) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  return $("[data-book-id]").attr("data-book-id");
}

async function retrieveBookDetails(id) {
  const url = `https://api.blinkist.com/v4/books/${id}`;
  const { data } = await axios.get(url);
  return data.book;
}

function retrieveAndSaveAudioFiles(book) {
  return Promise.all(
    book.chapters.map(async ({ id }) => {
      const url = `${BASE_URL}/api/books/${book.id}/chapters/${id}/audio`;

      const { data: downloadData } = await axios.get(url, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      const audioUrl = downloadData.url;

      const { data: audioData } = await axios.get(audioUrl, {
        responseType: "arraybuffer",
      });

      return await saveChapterAudioFileAsync(book.id, id, audioData);
    })
  );
}

async function retrieveAndSaveCover(book) {
  let url = book.image_url;

  // try to get square image
  if (book.images.types.indexOf("1_1") >= 0) {
    const maxSize = book.images.sizes[book.images.sizes.length - 1];
    url = book.images.url_template
      .replace("%type%", "1_1")
      .replace("%size%", maxSize);
  }

  const { data } = await axios.get(url, {
    responseType: "arraybuffer",
  });
  await saveBookCoverAsync(book, data);
}
