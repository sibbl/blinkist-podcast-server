import express from "express";
import {
  createFeedAsync,
  doesBookExist,
  getBookAudioData,
  getBookDetails,
  getBookCover,
} from "./utils/index.mjs";

export default class Server {
  constructor({ port, languages }) {
    this.port = process.env.PORT || port;
    this.languages = languages;
  }

  run() {
    this.app = express();

    this.app.set('trust proxy', 'loopback');
    this.app.enable('trust proxy');

    this.app.get("/feed/:language", async (req, res) => {
      const language = req.params.language;
      if (this.languages.indexOf(language) < 0) {
        return res.status(400).send("This language is not configured");
      }
      const feedContent = await createFeedAsync(req, language);
      res.set("Content-Type", "application/xml");
      res.send(feedContent);
    });

    this.app.get("/book/:bookId/audio", async (req, res) => {
      const bookId = req.params.bookId;
      const isBookAvailable = await doesBookExist(bookId);
      if (!isBookAvailable) {
        return res.status(400).send("Book not found");
      }
      const book = await getBookDetails(bookId);
      const audioData = await getBookAudioData(book);
      res.set("Content-Type", "audio/m4a");
      res.send(audioData);
    });

    this.app.get("/book/:bookId/cover", async (req, res) => {
      const bookId = req.params.bookId;
      const isBookAvailable = await doesBookExist(bookId);
      if (!isBookAvailable) {
        return res.status(400).send("Book not found");
      }
      const book = await getBookDetails(bookId);
      const coverData = await getBookCover(book);
      res.set("Content-Type", "image/jpeg");
      res.send(coverData);
    });

    this.app.use(express.static("public"));

    this.app.listen(this.port, () => {
      console.log(`App is listening on port ${this.port}!`);
    });
  }
}
