import { Readable } from "node:stream";

export function mockReq(method, url, { body = "", headers = {} } = {}) {
  const r = Readable.from(body === "" ? [] : [Buffer.from(body)]);
  r.method = method; r.url = url; r.headers = headers;
  return r;
}
export function mockRes() {
  const res = { status: null, headers: null, body: "", touched: false };
  res.writeHead = (s, h) => { res.touched = true; res.status = s; res.headers = h ?? {}; };
  res.end = (b = "") => { res.touched = true; res.body += b; };
  res.write = (b) => { res.touched = true; res.body += b; };
  res.setHeader = () => { res.touched = true; };
  return res;
}
