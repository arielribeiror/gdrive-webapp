import Busboy from "busboy";
import fs from "fs";
import { pipeline } from "stream/promises";
import { logger } from "./logger";

export default class UploadHeader {
  constructor({ io, socketId, downloadsFolder }) {
    this.io = io;
    this.socketId = socketId;
    this.downloadsFolder = downloadsFolder;
  }

  handleFileBuffer() {}

  async onFile(fieldName, file, filename) {
    const saveTo = `${this.downloadsFolder}/${filename}`;

    await pipeline(
      file,
      this.handleFileBuffer(filename),
      fs.createWriteStream(saveTo)
    );

    logger.info(`File [${filename}] finished`);
  }

  registerEvents(headers, onFinish) {
    const busboy = new Busboy({ headers });

    busboy.on("file", this.onFile.bind(this));
    busboy.on("finish", onFinish);

    return busboy;
  }
}
