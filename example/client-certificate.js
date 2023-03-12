// To generate the key and cert run:`openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=gemini"`
import client from "../dist/index.js";
import fs from "node:fs";
const key = fs.readFileSync("key.pem");
const cert = fs.readFileSync("cert.pem");
let res = await client("gemini://station.martinrue.com/join", { key, cert });
console.log(res.body.toString());
