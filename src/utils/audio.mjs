import ffmpeg from "fluent-ffmpeg";
import { getChapterAudioFilePath, getBookCoverFilePath } from "./storage.mjs";
import path from "path";
import fs from "fs";

try {
  const ffmpegPath = require("ffmpeg-static");
  ffmpeg.setFfmpegPath(ffmpegPath);
} catch {
  // noop
}

try {
  const ffprobeLib = require("ffprobe-static");
  ffmpeg.setFfprobePath(ffprobeLib.path);
} catch {
  // noop
}

export function getAudioLengthAsync(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, function (err, metadata) {
      if (err) {
        return reject(err);
      }
      resolve(metadata.format.duration);
    });
  });
}

export async function getChaptersWithAudioLengthsAsync(book) {
  return Promise.all(
    book.chapters.map(async (chapter) => {
      const chapterAudioPath = await getChapterAudioFilePath(
        book.id,
        chapter.id
      );
      const length = await getAudioLengthAsync(chapterAudioPath);
      return {
        ...chapter,
        length,
      };
    })
  );
}

export async function concatAudioFilesAsync(book, outFilePath) {
  const chapterFilePaths = await Promise.all(
    book.chapters.map((chapter) => {
      return getChapterAudioFilePath(book.id, chapter.id);
    })
  );

  return await new Promise((resolve, reject) => {
    const proc = ffmpeg();
    chapterFilePaths.forEach((p) => proc.mergeAdd(p));
    proc
      .on("start", () => {
        console.log("Start encoding", book.id, book.title);
      })
      .on("progress", (progress) => {
        console.info(
          `Encoding... ${progress.percent} % done`,
          book.id,
          book.title
        );
      })
      .on("error", (err) => {
        reject(err);
      })
      .on("end", () => {
        resolve();
      })
      .addOptions(["-movflags", "+faststart"])
      .audioCodec("aac")
      .mergeToFile(outFilePath);
  });
}

export async function enrichAudioAsync(inFilePath, book, outFilePath) {
  const chapterMarksFilePath = path.join(process.cwd(), `temp_${book.id}.txt`);
  const chaptersWithLengths = await getChaptersWithAudioLengthsAsync(book);
  const coverFilePath = await getBookCoverFilePath(book.id);

  let chapterMarksMetaDataStr = `;FFMETADATA1
title=${book.title}
artist=${book.author}`;
  let lastStart = 0;
  for (let chapter of chaptersWithLengths) {
    const end = lastStart + chapter.length;
    chapterMarksMetaDataStr += `
[CHAPTER]
TIMEBASE=1/1000
START=${lastStart * 1000}
END=${end * 1000}
title=${chapter.title}`;
    lastStart = end;
  }

  await fs.promises.writeFile(chapterMarksFilePath, chapterMarksMetaDataStr);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(inFilePath)
        .input(chapterMarksFilePath)
        .input(coverFilePath)
        .on("start", function (cmdline) {
          console.log("Start adding chapter marks", cmdline);
        })
        .on("progress", (progress) => {
          console.info(
            `Chapters... ${progress.percent} % done`,
            book.id,
            book.title
          );
        })
        .on("error", (err) => {
          console.error(err);
          reject(err);
        })
        .on("end", async () => {
          resolve();
        })
        .addOptions([
          "-map_metadata",
          "1",
          "-map 0:a",
          "-map 2",
          "-c",
          "copy",
          "-disposition:v:0",
          "attached_pic",
        ])
        .output(outFilePath)
        .run();
    });
  } finally {
    await fs.promises.unlink(chapterMarksFilePath);
  }
}
