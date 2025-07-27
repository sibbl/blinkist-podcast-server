import axios from "axios";
import { load } from "cheerio";
import {
  getBookAudioRawFilePath,
  getBookAudioFinalFilePath
} from "./paths.mjs";
import {
  doesBookExistAsync,
  saveChapterAudioFileAsync,
  saveBookDetailsAsync,
  appendBookToBookListAsync,
  getBookDetailsAsync,
  saveBookCoverAsync,
  cleanTemporaryAudioFilesAsync
} from "./storage.mjs";
import { concatAudioFilesAsync, enrichAudioAsync } from "./audio.mjs";
import { getOrCreateRssCacheAsync } from "./cache.mjs";
import Crawler from "./crawler.mjs";

const BASE_URL = "https://www.blinkist.com";

export default class Scraper {
  constructor({ language, headless }) {
    this.language = language;
    this.headless = headless;
  }
  async scrape() {
    console.log("Start scraping", this.language);

    try {
      this.crawler = new Crawler(60000, this.headless);
      await this.crawler.start();

      const overviewUrl = `${BASE_URL}/${this.language}/content/daily`;
      console.log("Navigating to free daily page", overviewUrl);
      await this.crawler.goToAndGetHtml(overviewUrl);

      const bookId = await this.retrieveBookId();
      console.log("Retrieved book id", bookId);

      if (await doesBookExistAsync(bookId)) {
        const existingBook = await getBookDetailsAsync(bookId);
        console.log(
          "Skipping because book already exists",
          this.language,
          bookId,
          existingBook.title
        );
        return;
      }

      const bookDetails = await this.retrieveBookDetails(bookId);

      console.log(
        "Downloading...",
        this.language,
        bookDetails.id,
        bookDetails.title
      );

      await this.retrieveAndSaveCover(bookDetails);
      await this.retrieveAndSaveAudioFiles(bookDetails);

      console.log(
        "Concatinating audio files...",
        this.language,
        bookDetails.id,
        bookDetails.title
      );
      const concatAudioFilePath = getBookAudioRawFilePath(bookDetails.id);
      await concatAudioFilesAsync(bookDetails, concatAudioFilePath);

      const enrichedAudioFilePath = getBookAudioFinalFilePath(bookDetails.id);

      console.log(
        "Adding chapter marks...",
        this.language,
        bookDetails.id,
        bookDetails.title
      );
      await enrichAudioAsync(
        concatAudioFilePath,
        bookDetails,
        enrichedAudioFilePath
      );

      await appendBookToBookListAsync(bookDetails, this.language);
      await saveBookDetailsAsync(bookDetails);
      await getOrCreateRssCacheAsync(bookDetails);
      await cleanTemporaryAudioFilesAsync(bookDetails);

      console.log(
        "Finished scraping",
        this.language,
        bookDetails.id,
        bookDetails.title
      );
    } catch (e) {
      console.error("Failed to scrape", this.language, e);
    } finally {
      this.crawler.close();
    }
  }

  async getBookUrl(url) {
    try {
      const data = await this.crawler.goToAndGetHtml(url);

      const $ = load(data);
      return $("a[data-test-id=view-daily-blink-button]").attr("href");
    } catch (e) {
      console.error("Failed to get", url, e);
      throw e;
    }
  }

  async retrieveBookId() {      
    const freeDailyUrl = `${BASE_URL}/api/free_daily?locale=${this.language}`;
    console.log("Getting free daily data", freeDailyUrl);
    const freeDailyData = await this.crawler.downloadJsonViaXhr(freeDailyUrl);
    return freeDailyData.book.id;
  }

  async retrieveBookDetails(id) {
    const url = `https://api.blinkist.com/v4/books/${id}`;

    const data = await this.crawler.downloadJsonViaXhr(url);
    // const { data } = await axios.get(url);
    return data.book;
  }

  async retrieveAndSaveAudioFiles(book) {
    return await Promise.all(
      book.chapters.map(async ({ id }) => {
        const url = `${BASE_URL}/api/books/${book.id}/chapters/${id}/audio`;

        const downloadData = await this.crawler.downloadJsonViaXhr(url);

        const audioUrl = downloadData.url;

        const { data: audioData } = await axios.get(audioUrl, {
          responseType: "arraybuffer"
        });

        return await saveChapterAudioFileAsync(book.id, id, audioData);
      })
    );
  }

  async retrieveAndSaveCover(book) {
    let url = book.image_url;

    // try to get square image
    if (book.images.types.indexOf("1_1") >= 0) {
      const maxSize = book.images.sizes[book.images.sizes.length - 1];
      url = book.images.url_template
        .replace("%type%", "1_1")
        .replace("%size%", maxSize);
    }

    const { data } = await axios.get(url, {
      responseType: "arraybuffer"
    });
    await saveBookCoverAsync(book, data);
  }
}
