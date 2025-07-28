import express from "express";
import { createFeedAsync } from "./utils/feed.mjs";
import {
  doesBookExistAsync,
  getBookAudioDataAsync,
  getBookDetailsAsync,
  getBookCoverAsync,
} from "./utils/storage.mjs";

export default class Server {
  constructor({ port, languages, feedPageSize }) {
    this.port = process.env.PORT || port;
    this.languages = languages;
    this.feedPageSize = feedPageSize;
  }

  run() {
    this.app = express();

    this.app.set("trust proxy", "loopback");
    this.app.enable("trust proxy");

    this.app.get("/feed/:language", async (req, res) => {
      const language = req.params.language;
      if (this.languages.indexOf(language) < 0) {
        return res.status(400).send("This language is not configured");
      }

      const page = parseInt(req.query.page);
      const options =
        !isNaN(page) && page > 0
          ? { page, pageSize: this.feedPageSize }
          : { page: 1, pageSize: this.feedPageSize };

      const feedContent = await createFeedAsync(req, language, options);
      res.set("Content-Type", "application/xml");
      res.send(feedContent);
    });

    this.app.get("/book/:bookId/audio", async (req, res) => {
      const bookId = req.params.bookId;
      const isBookAvailable = await doesBookExistAsync(bookId);
      if (!isBookAvailable) {
        return res.status(400).send("Book not found");
      }
      const book = await getBookDetailsAsync(bookId);
      const audioData = await getBookAudioDataAsync(book);
      res.set("Content-Type", "audio/m4a");
      res.send(audioData);
    });

    this.app.get("/book/:bookId/cover", async (req, res) => {
      const bookId = req.params.bookId;
      const isBookAvailable = await doesBookExistAsync(bookId);
      if (!isBookAvailable) {
        return res.status(400).send("Book not found");
      }
      const book = await getBookDetailsAsync(bookId);
      const coverData = await getBookCoverAsync(book);
      res.set("Content-Type", "image/jpeg");
      res.send(coverData);
    });

    this.app.use(express.static("public"));

    this.app.listen(this.port, () => {
      console.log(`App is listening on port ${this.port}!`);
    });
  }
}
