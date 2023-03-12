import * as tls from "node:tls";
import { Buffer } from "node:buffer";

type Enumerate<
  N extends number,
  Acc extends number[] = []
> = Acc["length"] extends N
  ? Acc[number]
  : Enumerate<N, [...Acc, Acc["length"]]>;

type IntRange<F extends number, T extends number> = Exclude<
  Enumerate<T>,
  Enumerate<F>
>;

export type GeminiStatusCodes = IntRange<10, 99>;

class TimeoutError extends Error {
  constructor(message) {
    super(message);
  }
  timeout;
  code;
  errno;
}

export type Headers = {
  /** A two-digit numeric status code */
  statusCode: GeminiStatusCodes;
  /** A string asociated to the status code */
  meta: string;
};

export type Response = {
  /** The hostname obtained from the passed URL */
  hostname: string;
  /** The path obtained from the passed URL */
  path: string;
  /** The server IP address */
  address: string;
  /** The port in which the server responded to the request  */
  port: number;
  /** The headers parsed from the server response */
  headers?: Partial<Headers>;
  /** The raw headers obtained from the server response */
  rawHeaders?: Buffer;
  /** The body obtained from the server response */
  body?: Buffer;
  /** The server certificate */
  certificate?: Buffer;
};

const CRLF = "\r\n";

/**
 * A Gemini protocol client
 *
 * @remarks
 * ```
 * If the url passed has a port defined then that\'s the one used instead of the opts one. (Default value: 1965)
 * Default timeout: 60 sec.
 * ```
 *
 * @example
 * ```
 * import client from 'gemini-client';
 *
 * const req = client('gemini://gemini.circumlunar.space/');
 * const res = await req;
 * console.log(res);
 * ```
 *
 * @param url - the url to request
 * @param opts - request options which are used in the tls connection
 * @returns a promise with a {@link Response} object
 */
async function client(
  url: string,
  opts: Partial<tls.ConnectionOptions>
): Promise<Response> {
  const parsedUrl = new URL(url);

  const res: Partial<Response> = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname,
  };

  const socket = tls.connect({
    minVersion: "TLSv1.2",
    host: parsedUrl.hostname,
    servername: parsedUrl.hostname,
    port: parseInt(parsedUrl.port, 10) || opts.port || 1965,
    rejectUnauthorized: false,
    timeout: opts.timeout || 60 * 1000,
    ...opts,
  });
  socket.once("timeout", () => {
    const err = new TimeoutError("connect timeout");
    err.timeout = opts.timeout;
    err.code = "ETIMEDOUT"; // is it okay to mimic syscall errors?
    err.errno = -60;
    socket.destroy(err);
    return err;
  });

  socket.on("connect", () => (res.port = socket.remotePort));

  socket.on("lookup", (err, address, family, host) => (res.address = address));
  socket.on(
    "keylog",
    (line) => (res.certificate = socket.getPeerCertificate(true).raw)
  );

  socket.write(`${url}\r\n`);
  let body = Buffer.from([]);
  let header = Buffer.from([]);
  const length = 0;

  for await (const data of socket) {
    if (!res.headers) {
      header = Buffer.concat([header, data]);
      if (header.includes(CRLF)) {
        const dataHeader = header.subarray(
          0,
          header.indexOf(CRLF) + CRLF.length
        );
        body = Buffer.concat([
          body,
          Buffer.from(data.subarray(data.indexOf(CRLF) + CRLF.length)),
        ]);
        res.rawHeaders = Buffer.from(dataHeader);
        res.headers = {};
        const headers = dataHeader.toString().split(/[\t ]/);
        if (headers.length > 1) {
          res.headers = {
            statusCode: parseInt(headers[0].trim(), 10) as GeminiStatusCodes,
            meta: headers.slice(1).join(" ").trim(),
          };
        }
      }
    } else {
      body = Buffer.concat([body, Buffer.from(data)]);
    }
  }

  res.body = body;
  return res as Response;
}

export { client };
export default client;
