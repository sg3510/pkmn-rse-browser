import net from "node:net";

import { parseNonNegativeInt, parseNumeric } from "./numbers.js";

type PendingRead = {
  resolve: (line: string) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

export interface MgbaConnectionOptions {
  host: string;
  port: number;
  defaultTimeoutMs?: number;
  connectTimeoutMs?: number;
}

export class MgbaClient {
  private readonly socket: net.Socket;
  private readonly defaultTimeoutMs: number;
  private buffer = "";
  private readonly lineQueue: string[] = [];
  private readonly pendingReads: PendingRead[] = [];
  private closed = false;

  private constructor(socket: net.Socket, defaultTimeoutMs: number) {
    this.socket = socket;
    this.defaultTimeoutMs = defaultTimeoutMs;

    this.socket.on("data", (chunk: Buffer) => {
      this.handleData(chunk);
    });

    this.socket.on("error", (error: Error) => {
      this.rejectPendingReads(error);
    });

    this.socket.on("close", () => {
      this.closed = true;
      this.rejectPendingReads(new Error("Socket closed."));
    });
  }

  static async connect(options: MgbaConnectionOptions): Promise<MgbaClient> {
    const port = parseNonNegativeInt(options.port, "port");
    const defaultTimeoutMs = parseNonNegativeInt(options.defaultTimeoutMs ?? 10_000, "defaultTimeoutMs");
    const connectTimeoutMs = parseNonNegativeInt(options.connectTimeoutMs ?? defaultTimeoutMs, "connectTimeoutMs");

    return await new Promise<MgbaClient>((resolve, reject) => {
      const socket = net.createConnection({ host: options.host, port });

      const timeout = setTimeout(() => {
        socket.destroy(new Error(`Timed out connecting to ${options.host}:${port}`));
      }, connectTimeoutMs);

      const onError = (error: Error): void => {
        clearTimeout(timeout);
        socket.off("connect", onConnect);
        reject(error);
      };

      const onConnect = (): void => {
        clearTimeout(timeout);
        socket.off("error", onError);
        resolve(new MgbaClient(socket, defaultTimeoutMs));
      };

      socket.once("error", onError);
      socket.once("connect", onConnect);
    });
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    try {
      await this.writeLine("QUIT");
    } catch {
      // Ignore write failures during close.
    }

    await new Promise<void>((resolve) => {
      if (this.socket.destroyed) {
        resolve();
        return;
      }

      const onClose = (): void => {
        clearTimeout(forceCloseTimer);
        this.socket.off("close", onClose);
        resolve();
      };

      this.socket.once("close", onClose);
      this.socket.end();

      const forceCloseTimer = setTimeout(() => {
        this.socket.off("close", onClose);
        this.socket.destroy();
        resolve();
      }, 500);
    });
  }

  async ping(): Promise<void> {
    await this.request("PING");
  }

  async frame(): Promise<number> {
    const [rawFrame = "0"] = await this.request("FRAME");
    return parseNonNegativeInt(parseNumeric(rawFrame, "FRAME response"), "FRAME response");
  }

  async setKeys(mask: number): Promise<void> {
    const safeMask = parseNonNegativeInt(mask, "mask");
    await this.request("SET_KEYS", [String(safeMask)]);
  }

  async pressMask(mask: number): Promise<void> {
    const safeMask = parseNonNegativeInt(mask, "mask");
    await this.request("PRESS", [String(safeMask)]);
  }

  async releaseMask(mask: number): Promise<void> {
    const safeMask = parseNonNegativeInt(mask, "mask");
    await this.request("RELEASE", [String(safeMask)]);
  }

  async clearKeys(): Promise<void> {
    await this.request("CLEAR_KEYS");
  }

  async advance(frames: number, mask?: number): Promise<number> {
    const safeFrames = parseNonNegativeInt(frames, "frames");
    if (safeFrames < 1) {
      throw new Error("frames must be at least 1.");
    }

    const args = [String(safeFrames)];
    if (mask !== undefined) {
      args.push(String(parseNonNegativeInt(mask, "mask")));
    }

    const timeoutMs = Math.max(this.defaultTimeoutMs, safeFrames * 30);
    const [rawFrame = "0"] = await this.request("ADVANCE", args, timeoutMs);
    return parseNonNegativeInt(parseNumeric(rawFrame, "ADVANCE response"), "ADVANCE response");
  }

  async read8(address: number): Promise<number> {
    return await this.readValue("READ8", address);
  }

  async read16(address: number): Promise<number> {
    return await this.readValue("READ16", address);
  }

  async read32(address: number): Promise<number> {
    return await this.readValue("READ32", address);
  }

  async write8(address: number, value: number): Promise<void> {
    await this.writeValue("WRITE8", address, value);
  }

  async write16(address: number, value: number): Promise<void> {
    await this.writeValue("WRITE16", address, value);
  }

  async write32(address: number, value: number): Promise<void> {
    await this.writeValue("WRITE32", address, value);
  }

  async screenshot(absolutePath: string): Promise<void> {
    await this.request("SCREENSHOT", [absolutePath]);
  }

  async saveState(absolutePath: string): Promise<void> {
    await this.request("SAVE_STATE", [absolutePath]);
  }

  async loadState(absolutePath: string): Promise<void> {
    await this.request("LOAD_STATE", [absolutePath]);
  }

  async reset(): Promise<void> {
    await this.request("RESET");
  }

  private async readValue(command: "READ8" | "READ16" | "READ32", address: number): Promise<number> {
    const safeAddress = parseNonNegativeInt(address, "address");
    const [rawValue = "0"] = await this.request(command, [String(safeAddress)]);
    return parseNonNegativeInt(parseNumeric(rawValue, `${command} response`), `${command} response`);
  }

  private async writeValue(
    command: "WRITE8" | "WRITE16" | "WRITE32",
    address: number,
    value: number
  ): Promise<void> {
    const safeAddress = parseNonNegativeInt(address, "address");
    const safeValue = parseNonNegativeInt(value, "value");
    await this.request(command, [String(safeAddress), String(safeValue)]);
  }

  private async request(command: string, args: string[] = [], timeoutMs = this.defaultTimeoutMs): Promise<string[]> {
    const payload = [command, ...args].join("\t");
    await this.writeLine(payload);
    const response = await this.readLine(timeoutMs);

    const fields = response.split("\t");
    const status = fields[0];
    const rest = fields.slice(1);

    if (status === "OK") {
      return rest;
    }

    if (status === "ERR") {
      throw new Error(rest.join("\t") || `${command} failed.`);
    }

    throw new Error(`Unexpected response from mGBA bridge: ${response}`);
  }

  private async writeLine(line: string): Promise<void> {
    if (this.closed) {
      throw new Error("Socket is closed.");
    }

    await new Promise<void>((resolve, reject) => {
      this.socket.write(`${line}\n`, (error?: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async readLine(timeoutMs: number): Promise<string> {
    if (this.lineQueue.length > 0) {
      return this.lineQueue.shift() as string;
    }

    return await new Promise<string>((resolve, reject) => {
      const waiter: PendingRead = {
        resolve: (line: string) => {
          clearTimeout(waiter.timer);
          resolve(line);
        },
        reject: (error: Error) => {
          clearTimeout(waiter.timer);
          reject(error);
        },
        timer: setTimeout(() => {
          const index = this.pendingReads.indexOf(waiter);
          if (index >= 0) {
            this.pendingReads.splice(index, 1);
          }
          reject(new Error(`Timed out waiting for bridge response after ${timeoutMs}ms.`));
        }, timeoutMs)
      };

      this.pendingReads.push(waiter);
    });
  }

  private handleData(chunk: Buffer): void {
    this.buffer += chunk.toString("utf8");

    while (true) {
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex < 0) {
        break;
      }

      let line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }
      if (line.length === 0) {
        continue;
      }

      if (this.pendingReads.length > 0) {
        const waiter = this.pendingReads.shift() as PendingRead;
        waiter.resolve(line);
      } else {
        this.lineQueue.push(line);
      }
    }
  }

  private rejectPendingReads(error: Error): void {
    while (this.pendingReads.length > 0) {
      const waiter = this.pendingReads.shift() as PendingRead;
      waiter.reject(error);
    }
  }
}
