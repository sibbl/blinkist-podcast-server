import ffmpeg from "fluent-ffmpeg";
import {
  getChapterAudioFilePath,
  getBookAudioFinalFilePath,
  getBookCoverFilePath
} from "./paths.mjs";
import path from "path";
import fs from "fs";

async function trySetFfmpegPathsAsync() {
  try {
    const ffmpegStatic = await import("ffmpeg-static");
    ffmpeg.setFfmpegPath(ffmpegStatic.default);
  } catch (e) {
    // noop, use local ffmpeg
  }

  try {
    const ffprobeLib = await import("ffprobe-static");
    ffmpeg.setFfprobePath(ffprobeLib.default.path);
  } catch (e) {
    // noop, use local ffprobe
  }
}

export async function getAudioLengthAsync(filePath) {
  await trySetFfmpegPathsAsync();
  return await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, function (err, metadata) {
      if (err) {
        return reject(err);
      }
      resolve(metadata.format.duration);
    });
  });
}

export async function getChaptersWithAudioLengthsAsync(book, audioFilePath = null) {
  if (
    book.chapters.length > 0 &&
    book.chapters.every((chapter) => Number.isFinite(chapter.start))
  ) {
    const totalLength = await getAudioLengthAsync(
      audioFilePath || getBookAudioFinalFilePath(book.id)
    );
    return book.chapters.map((chapter, index) => {
      const nextChapter = book.chapters[index + 1];
      const end = nextChapter?.start ?? totalLength;
      return {
        ...chapter,
        length: Math.max(end - chapter.start, 0),
      };
    });
  }

  if (audioFilePath) {
    return book.chapters.map((chapter) => ({
      ...chapter,
      length: null,
    }));
  }

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

export async function concatAudioFilesAsync(book, outFilePath, audioBitrate) {
  await trySetFfmpegPathsAsync();
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
      .audioCodec("aac");

    if (audioBitrate) {
      proc.audioBitrate(audioBitrate);
    }

    proc.mergeToFile(outFilePath);
  });
}

export async function enrichAudioAsync(
  inFilePath,
  book,
  outFilePath,
  audioBitrate = null
) {
  await trySetFfmpegPathsAsync();
  const chapterMarksFilePath = path.join(process.cwd(), `temp_${book.id}.txt`);
  const chaptersWithLengths = await getChaptersWithAudioLengthsAsync(
    book,
    inFilePath
  );
  const coverFilePath = await getBookCoverFilePath(book.id);

  let chapterMarksMetaDataStr = `;FFMETADATA1
title=${book.title}
artist=${book.author}`;
  let lastStart = 0;
  for (let chapter of chaptersWithLengths) {
    if (!Number.isFinite(chapter.start) || !Number.isFinite(chapter.length)) {
      continue;
    }
    const start = Number.isFinite(chapter.start) ? chapter.start : lastStart;
    const end = start + chapter.length;
    chapterMarksMetaDataStr += `
[CHAPTER]
TIMEBASE=1/1000
START=${start * 1000}
END=${end * 1000}
title=${chapter.title}`;
    lastStart = end;
  }

  await fs.promises.writeFile(chapterMarksFilePath, chapterMarksMetaDataStr);

  try {
    await new Promise((resolve, reject) => {
      const proc = ffmpeg()
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
          "-disposition:v:0",
          "attached_pic",
        ]);

      if (audioBitrate) {
        proc.audioCodec("aac").audioBitrate(audioBitrate).videoCodec("copy");
      } else {
        proc.addOptions(["-c", "copy"]);
      }

      proc.output(outFilePath).run();
    });
  } finally {
    await fs.promises.unlink(chapterMarksFilePath);
  }
}
