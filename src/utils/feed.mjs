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
    const pubDateStr = jsDateToPubDateString(pubDate);
    const chapterList = await getChapterListHtmlAsync(book);
    feed.item({
      title: book.title,
      description: book.about_the_book,
      url,
      guid: book.id,
      author: book.author,
      date: pubDateStr,
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
            _cdata: `${book.about_the_book} ${chapterList}`,
          },
        },
      ],
    });
  }

  return feed.xml();
}

async function createFeedBase(reqOrBaseUrl, language) {
  const pubDate = await getBookListLastModifiedDateAsync(language);
  const pubDateStr = jsDateToPubDateString(pubDate);
  const feedImg = getAbsoluteUrl(reqOrBaseUrl, `/assets/cover-${language}.jpg`);
  return new RSS({
    title: `Daily Blinks ${language.toUpperCase()}`,
    description: "This feed offers the daily blinks from Blinkist",
    feed_url: getAbsoluteUrl(reqOrBaseUrl, `/feed/${language}`),
    site_url: getAbsoluteUrl(reqOrBaseUrl, `/`),
    generator: "Daily Blinks Podcast",
    image_url: feedImg,
    language: language,
    pubDate: pubDateStr,
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

async function getChapterListHtmlAsync(book) {
  const chapters = await getChaptersWithAudioLengthsAsync(book);
  let itemHtml = "",
    totalSec = 0;

  for (let chapter of chapters) {
    const length = chapter.length;
    var min = Math.floor(totalSec / 60);
    var sec = Math.floor(totalSec % 60);

    totalSec += length;

    itemHtml += `<li>${min < 10 ? "0" : ""}${min}:${
      sec < 10 ? "0" : ""
    }${sec} | ${chapter.title}</li>`;
  }

  return `<ul>${itemHtml}</ul>`;
}

function jsDateToPubDateString(date) {
  var months = Array(
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  );
  return (
    date.getDate() + " " + months[date.getMonth()] + " " + date.getFullYear()
  );
}
