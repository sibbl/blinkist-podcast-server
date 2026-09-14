import axios from "axios";
import { load } from "cheerio";
import {
  getBookAudioFinalFilePath
} from "./paths.mjs";
import {
  doesBookExistAsync,
  saveBookRawAudioFileAsync,
  saveBookDetailsAsync,
  appendBookToBookListAsync,
  getBookDetailsAsync,
  saveBookCoverAsync,
  cleanTemporaryAudioFilesAsync
} from "./storage.mjs";
import { enrichAudioAsync } from "./audio.mjs";
import { getOrCreateRssCacheAsync } from "./cache.mjs";
import Crawler from "./crawler.mjs";

const BASE_URL = "https://www.blinkist.com";

export default class Scraper {
  constructor({ language, headless, audioBitrate }) {
    this.language = language;
    this.headless = headless;
    this.audioBitrate = audioBitrate;
  }
  async scrape() {
    console.log("Start scraping", this.language);

    try {
      this.crawler = new Crawler(60000, this.headless);
      await this.crawler.start();

      const overviewUrl = `${BASE_URL}/${this.language}/content/daily`;
      console.log("Navigating to free daily page", overviewUrl);
      const overviewHtml = await this.crawler.goToAndGetHtml(overviewUrl);

      const bookId = await this.retrieveBookId(overviewHtml);
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
      const bookWithAudioMeta = await this.enrichBookWithTranscript(bookDetails);

      console.log(
        "Downloading...",
        this.language,
        bookWithAudioMeta.id,
        bookWithAudioMeta.title
      );

      await this.retrieveAndSaveCover(bookWithAudioMeta);
      const rawAudioFilePath = await this.retrieveAndSaveAudioFile(
        bookWithAudioMeta
      );

      const enrichedAudioFilePath = getBookAudioFinalFilePath(bookWithAudioMeta.id);

      console.log(
        "Adding chapter marks...",
        this.language,
        bookWithAudioMeta.id,
        bookWithAudioMeta.title
      );
      await enrichAudioAsync(
        rawAudioFilePath,
        bookWithAudioMeta,
        enrichedAudioFilePath,
        this.audioBitrate
      );

      await appendBookToBookListAsync(bookWithAudioMeta, this.language);
      await saveBookDetailsAsync(bookWithAudioMeta);
      await getOrCreateRssCacheAsync(bookWithAudioMeta);
      await cleanTemporaryAudioFilesAsync(bookWithAudioMeta);

      console.log(
        "Finished scraping",
        this.language,
        bookWithAudioMeta.id,
        bookWithAudioMeta.title
      );
    } catch (e) {
      console.error("Failed to scrape", this.language, e);
    } finally {
      await this.crawler.close();
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

  async retrieveBookId(overviewHtml) {      
    const freeDailyUrl = `${BASE_URL}/api/free_daily?locale=${this.language}`;
    console.log("Getting free daily data", freeDailyUrl);
    try {
      const freeDailyData = await this.crawler.downloadJsonViaXhr(freeDailyUrl);
      if (freeDailyData?.book?.id) {
        return freeDailyData.book.id;
      }
    } catch (e) {
      console.warn(
        "Failed to get free daily data from API, falling back to overview HTML",
        this.language,
        e.message
      );
    }

    if (overviewHtml) {
      const matchProps = overviewHtml.match(
        /&quot;freeDaily&quot;:\[0,\{&quot;book&quot;:\[0,\{&quot;id&quot;:\[0,&quot;([a-f0-9]+)&quot;\]/
      );
      if (matchProps && matchProps[1]) {
        console.log("Retrieved book id from page props", matchProps[1]);
        return matchProps[1];
      }

      const matchImg = overviewHtml.match(
        /https:\/\/images\.blinkist\.io\/images\/books\/([a-f0-9]{24})\//
      );
      if (matchImg && matchImg[1]) {
        console.log("Retrieved book id from cover image URL", matchImg[1]);
        return matchImg[1];
      }
    }

    throw new Error(`Failed to retrieve book ID for ${this.language}`);
  }

  async retrieveBookDetails(id) {
    const url = `https://api.blinkist.com/v4/books/${id}`;

    const data = await this.crawler.downloadJsonViaXhr(url);
    if (!data?.book) {
      throw new Error(
        `Failed to retrieve book details for ${id}: response does not contain book`
      );
    }
    return data.book;
  }

  async enrichBookWithTranscript(book) {
    const transcriptStarts = await this.retrieveChapterStartsFromTranscript(book);
    if (transcriptStarts) {
      return this.mergeChapterStarts(book, transcriptStarts);
    }

    const readerStarts = await this.retrieveChapterStartsFromReader(book);
    if (readerStarts) {
      return this.mergeChapterStarts(book, readerStarts);
    }

    return book;
  }

  async retrieveChapterStartsFromTranscript(book) {
    try {
      const url = `https://api.blinkist.com/transcripts/${book.id}?language=${this.language}`;
      const { data } = await axios.get(url);
      const transcriptSections = data?.transcript?.transcriptSections || [];
      const sectionStarts = transcriptSections.map((section) => section.start);
      return this.validateChapterStarts(book, sectionStarts)
        ? sectionStarts
        : null;
    } catch (error) {
      console.warn(
        "Failed to load transcript chapter starts",
        this.language,
        book.id,
        error.message
      );
      return null;
    }
  }

  async retrieveChapterStartsFromReader(book) {
    try {
      const url = `${BASE_URL}/${this.language}/reader/books/${book.slug}`;
      const readerChapters = await this.crawler.getReaderChapterStarts(url);
      const chapterStarts = readerChapters.map((chapter) => chapter.start);
      return this.validateChapterStarts(book, chapterStarts) ? chapterStarts : null;
    } catch (error) {
      console.warn(
        "Failed to load reader chapter starts",
        this.language,
        book.id,
        error.message
      );
      return null;
    }
  }

  validateChapterStarts(book, chapterStarts) {
    return (
      chapterStarts.length === book.chapters.length &&
      chapterStarts.every((start) => Number.isFinite(start))
    );
  }

  mergeChapterStarts(book, chapterStarts) {
    return {
      ...book,
      chapters: book.chapters.map((chapter, index) => ({
        ...chapter,
        start: chapterStarts[index]
      }))
    };
  }

  async retrieveAndSaveAudioFile(book) {
    const url = `https://api.blinkist.com/v4/audio/${book.id}.m4a?language=${this.language}`;
    const { data } = await axios.get(url, {
      responseType: "arraybuffer"
    });
    return await saveBookRawAudioFileAsync(book.id, data);
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
