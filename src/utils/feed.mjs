import RSS from "rss";
import {
  getBookDetailsAsync,
  getBookListEntriesAsync,
  getBookDownloadDateAsync,
  getBookListLastModifiedDateAsync,
} from "./storage.mjs";

import { getBookAudioFinalFilePath } from "./paths.mjs";

import {
  getAudioLengthAsync,
  getChaptersWithAudioLengthsAsync,
} from "./audio.mjs";

import { getAbsoluteUrl } from "./url.mjs";

export async function createFeedAsync(reqOrBaseUrl, language) {
  const feed = await createFeedBase(reqOrBaseUrl, language);

  const ids = await getBookListEntriesAsync(language);
  const books = await Promise.all(ids.map((id) => getBookDetailsAsync(id)));

  for (let book of books) {
    const url = getAbsoluteUrl(reqOrBaseUrl, `/book/${book.id}/audio`);
    const filePath = getBookAudioFinalFilePath(book.id);
    const duration = await getAudioLengthAsync(filePath);
    const pubDate = await getBookDownloadDateAsync(book.id);
    const imageUrl = getAbsoluteUrl(reqOrBaseUrl, `/book/${book.id}/cover`);
    const showNotes = await getShowNotesAsync(book);
    feed.item({
      title: book.title,
      description: book.about_the_book,
      url,
      guid: book.id,
      author: book.author,
      date: pubDate,
      enclosure: { url, file: filePath },
      image: {
        url: imageUrl,
        title: book.title,
      },
      custom_elements: [
        { "itunes:author": book.author },
        { "itunes:subtitle": book.subtitle },
        {
          "itunes:image": {
            _attr: {
              href: imageUrl,
            },
          },
        },
        { "itunes:duration": duration },
        {
          "content:encoded": {
            _cdata: showNotes,
          },
        },
      ],
    });
  }

  return feed.xml();
}

async function createFeedBase(reqOrBaseUrl, language) {
  const pubDate = await getBookListLastModifiedDateAsync(language);
  const feedImg = getAbsoluteUrl(reqOrBaseUrl, `/assets/cover-${language}.jpg`);
  return new RSS({
    title: `Daily Blinks ${language.toUpperCase()}`,
    description: "This feed offers the daily blinks from Blinkist",
    feed_url: getAbsoluteUrl(reqOrBaseUrl, `/feed/${language}`),
    site_url: getAbsoluteUrl(reqOrBaseUrl, `/`),
    generator: "Daily Blinks Podcast",
    image_url: feedImg,
    language: language,
    pubDate: pubDate,
    ttl: 5,
    custom_namespaces: {
      itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
      content: "http://purl.org/rss/1.0/modules/content/",
    },
    custom_elements: [
      { "itunes:subtitle": "This feed offers the daily blinks from Blinkist" },
      { "itunes:author": "Blinkist" },
      {
        "itunes:image": {
          _attr: {
            href: feedImg,
          },
        },
      },
    ],
  });
}

async function getShowNotesAsync(book) {
  const chapterList = await getChapterListHtmlAsync(book);
  const title = `<p><strong>${book.title}</strong> - ${book.author}<br/><small>${book.subtitle}</small></p>`;
  const readLink = `<p><a href="https://www.blinkist.com/books/${book.slug}">👉 Blinkist.com</a></p>`;
  return [title, book.about_the_book, chapterList, readLink].join("");
}

async function getChapterListHtmlAsync(book) {
  const chapters = await getChaptersWithAudioLengthsAsync(book);
  let items = [],
    totalSec = 0;

  for (let chapter of chapters) {
    const length = chapter.length;
    var min = Math.floor(totalSec / 60);
    var sec = Math.floor(totalSec % 60);

    const minStr = (min < 10 ? "0" : "") + min;
    const secStr = (sec < 10 ? "0" : "") + sec;

    items.push(`${minStr}:${secStr} | ${chapter.title}`);

    totalSec += length;
  }

  return `<p>${items.join("<br />")}</p>`;
}
