import RSS from "rss";
import {
  getBookDetailsAsync,
  getBookListEntriesAsync,
  getBookListEntriesPageAsync,
  getBookListLastModifiedDateAsync,
} from "./storage.mjs";
import { getBookAudioFinalFilePath } from "./paths.mjs";
import { getAbsoluteUrl } from "./url.mjs";
import { getOrCreateRssCacheAsync } from "./cache.mjs";

export async function createFeedAsync(reqOrBaseUrl, language, options = {}) {
  const { page = null, pageSize = null } = options;
  let ids, hasMore = false;

  if (page != null && pageSize != null) {
    const offset = (page - 1) * pageSize;
    ({ entries: ids, hasMore } = await getBookListEntriesPageAsync(
      language,
      offset,
      pageSize
    ));
  } else if (pageSize != null) {
    ({ entries: ids } = await getBookListEntriesPageAsync(language, 0, pageSize));
  } else {
    ids = await getBookListEntriesAsync(language);
  }

  const feed = await createFeedBase(reqOrBaseUrl, language, {
    page,
    hasMore,
    pageSize,
  });

  const books = await Promise.all(ids.map((id) => getBookDetailsAsync(id)));

  for (let book of books) {
    const url = getAbsoluteUrl(reqOrBaseUrl, `/book/${book.id}/audio`);
    const filePath = getBookAudioFinalFilePath(book.id);
    const { duration, pubDate, chapterData } = await getOrCreateRssCacheAsync(book);
    const showNotes = getShowNotes(book, chapterData);
    const imageUrl = getAbsoluteUrl(reqOrBaseUrl, `/book/${book.id}/cover`);
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

async function createFeedBase(reqOrBaseUrl, language, {
  page = null,
  hasMore = false,
  pageSize = null,
} = {}) {
  const pubDate = await getBookListLastModifiedDateAsync(language);
  const feedImg = getAbsoluteUrl(reqOrBaseUrl, `/assets/cover-${language}.jpg`);

  const feedPath =
    page != null ? `/feed/${language}?page=${page}` : `/feed/${language}`;
  const feed = new RSS({
    title: `Daily Blinks ${language.toUpperCase()}`,
    description: "This feed offers the daily blinks from Blinkist",
    feed_url: getAbsoluteUrl(reqOrBaseUrl, feedPath),
    site_url: getAbsoluteUrl(reqOrBaseUrl, `/`),
    generator: "Daily Blinks Podcast",
    image_url: feedImg,
    language: language,
    pubDate: pubDate,
    ttl: 5,
    custom_namespaces: {
      itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
      content: "http://purl.org/rss/1.0/modules/content/",
      atom: "http://www.w3.org/2005/Atom",
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

  const selfUrl = getAbsoluteUrl(reqOrBaseUrl, feedPath);
  feed.custom_elements.push({
    "atom:link": {
      _attr: { rel: "self", href: selfUrl, type: "application/rss+xml" },
    },
  });

  if (page != null && page > 1) {
    const prevUrl = getAbsoluteUrl(
      reqOrBaseUrl,
      `/feed/${language}?page=${page - 1}`
    );
    feed.custom_elements.push({
      "atom:link": {
        _attr: { rel: "prev", href: prevUrl, type: "application/rss+xml" },
      },
    });
  }

  if (page != null && hasMore) {
    const nextUrl = getAbsoluteUrl(
      reqOrBaseUrl,
      `/feed/${language}?page=${page + 1}`
    );
    feed.custom_elements.push({
      "atom:link": {
        _attr: { rel: "next", href: nextUrl, type: "application/rss+xml" },
      },
    });
  }

  return feed;
}

function getShowNotes(book, chapterData) {
  const chapterList = getChapterListHtml(chapterData);
  const title = `<p><strong>${book.title}</strong> - ${book.author}<br/><small>${book.subtitle}</small></p>`;
  const readLink = `<p><a href="https://www.blinkist.com/books/${book.slug}">👉 Blinkist.com</a></p>`;
  return [title, book.about_the_book, chapterList, readLink].join("");
}

function getChapterListHtml(chapterData) {
  let items = [],
    totalSec = 0;

  for (let chapter of chapterData) {
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
