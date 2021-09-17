import { describe, test, expect, beforeEach, jest } from "@jest/globals";
import fs from "fs";
import { resolve } from "path";
import { pipeline } from "stream/promises";
import { logger } from "../../src/logger";
import UploadHeader from "../../src/uploadHandler";
import TestUtil from "../_util/testUtil";

describe("#UploadHandler test suite", () => {
  const ioObj = {
    to: (id) => ioObj,
    emit: (event, message) => {},
  };

  beforeEach(() => {
    jest.spyOn(logger, "info").mockImplementation();
  });

  describe("#registerEvents", () => {
    test("should call onFile and onFinish functions on Busboy instance", () => {
      const uploadHandler = new UploadHeader({
        io: ioObj,
        socketId: "01",
      });

      jest.spyOn(uploadHandler, uploadHandler.onFile.name).mockResolvedValue();

      const headers = {
        "content-type": "multipart/form-data; boundary=",
      };

      const onFinish = jest.fn();
      const busboyInstance = uploadHandler.registerEvents(headers, onFinish);

      const fileStream = TestUtil.generateReadableStream([
        "chunk",
        "of",
        "data",
      ]);
      busboyInstance.emit("file", "fieldname", fileStream, "filename.txt");

      busboyInstance.listeners("finish")[0].call();

      expect(uploadHandler.onFile).toHaveBeenCalled();
      expect(onFinish).toHaveBeenCalled();
    });
  });

  describe("#onFile", () => {
    test("given a stream file it should save it on disk", async () => {
      const chunks = ["hey", "dude"];
      const downloadsFolder = "/tmp";
      const handler = new UploadHeader({
        io: ioObj,
        socketId: "01",
        downloadsFolder,
      });

      const onData = jest.fn();
      jest
        .spyOn(fs, fs.createWriteStream.name)
        .mockImplementation(() => TestUtil.generateWritableStream(onData));

      const onTransform = jest.fn();
      jest
        .spyOn(handler, handler.handleFileBuffer.name)
        .mockImplementation(() =>
          TestUtil.generateTransformStream(onTransform)
        );

      const params = {
        fieldname: "video",
        file: TestUtil.generateReadableStream(chunks),
        filename: "mockFile.mov",
      };

      await handler.onFile(...Object.values(params));

      expect(onData.mock.calls.join()).toEqual(chunks.join());
      expect(onTransform.mock.calls.join()).toEqual(chunks.join());

      const expectedFilename = resolve(
        handler.downloadsFolder,
        params.filename
      );
      expect(fs.createWriteStream).toHaveBeenCalledWith(expectedFilename);
    });
  });

  describe("#handleFileBuffer", () => {
    test("should call emit function and it is a transform stream", async () => {
      jest.spyOn(ioObj, ioObj.to.name);
      jest.spyOn(ioObj, ioObj.emit.name);

      const handler = new UploadHeader({
        io: ioObj,
        socketId: "01",
      });

      jest.spyOn(handler, handler.canExecute.name).mockReturnValueOnce(true);

      const messages = ["hello"];
      const source = TestUtil.generateReadableStream(messages);
      const onWrite = jest.fn();
      const target = TestUtil.generateWritableStream(onWrite);

      await pipeline(source, handler.handleFileBuffer("filename.txt"), target);

      expect(ioObj.to).toHaveBeenCalledTimes(messages.length);
      expect(ioObj.emit).toHaveBeenCalledTimes(messages.length);

      expect(onWrite).toBeCalledTimes(messages.length);
      expect(onWrite.mock.calls.join()).toEqual(messages.join());
    });

    test("given message timerDelay as 2secs it should emit only two messages during 3 seconds period", async () => {
      jest.spyOn(ioObj, ioObj.emit.name);

      const day = "2021-07-01 01:01";
      const onInitVariable = TestUtil.getTimeFromDate(`${day}:01`);
      const onFirstCanExecute = TestUtil.getTimeFromDate(`${day}:02`);
      const onSecondCanExecute = TestUtil.getTimeFromDate(`${day}:03`);
      const onThirdCanExecute = TestUtil.getTimeFromDate(`${day}:04`);

      const onSecondUpdateLastMessageSent = onThirdCanExecute;

      TestUtil.mockDateNow([
        onInitVariable,
        onFirstCanExecute,
        onSecondCanExecute,
        onThirdCanExecute,
        onSecondUpdateLastMessageSent,
      ]);

      const messageTimeDelay = 2000;

      const messages = ["hello", "hello", "world"];
      const filename = "filename.avi";
      const expectedMessagesSent = 2;

      const source = TestUtil.generateReadableStream(messages);
      const handler = new UploadHeader({
        messageTimeDelay,
        io: ioObj,
        socketId: "01",
      });

      await pipeline(source, handler.handleFileBuffer(filename));

      expect(ioObj.emit).toHaveBeenCalledTimes(expectedMessagesSent);

      const [firstCallResult, secondCallResult] = ioObj.emit.mock.calls;
      expect(firstCallResult).toEqual([
        handler.ON_UPLOAD_EVENT,
        { processedAlready: "hello".length, filename },
      ]);
      expect(secondCallResult).toEqual([
        handler.ON_UPLOAD_EVENT,
        { processedAlready: "helloworld".length, filename },
      ]);
    });
  });

  describe("#canExecute", () => {
    test("should return true when time is later than specified delay", () => {
      const timerDelay = 1000;
      const uploadHandler = new UploadHeader({
        io: {},
        socketId: "",
        messageTimeDelay: timerDelay,
      });

      const tickNow = TestUtil.getTimeFromDate("2021-07-01 00:00:03");
      TestUtil.mockDateNow([tickNow]);

      const lastExecution = TestUtil.getTimeFromDate("2021-07-01 00:00:00");

      const result = uploadHandler.canExecute(lastExecution);
      expect(result).toBeTruthy();
    });

    test("should return false when time isnt later than specified delay", () => {
      const timerDelay = 3000;
      const uploadHandler = new UploadHeader({
        io: {},
        socketId: "",
        messageTimeDelay: timerDelay,
      });

      const now = TestUtil.getTimeFromDate("2021-07-01 00:00:02");
      TestUtil.mockDateNow([now]);

      const lastExecution = TestUtil.getTimeFromDate("2021-07-01 00:00:01");

      const result = uploadHandler.canExecute(lastExecution);
      expect(result).toBeFalsy();
    });
  });
});

// PAREI EM 01:50:41 //////////////////////////