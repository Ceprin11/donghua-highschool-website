import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { createApp } from "../server/app.js";
import { createAdmin } from "../server/auth.js";
import { closeDatabase, openDatabase } from "../server/db.js";

const USERNAME = "auth-test-admin";
const OLD_PASSWORD = "old-secure-password-123";
const NEW_PASSWORD = "new-secure-password-456";
let directory;
let db;
let app;
let server;
let origin;

function client(ip) {
  const state = { cookie: "", csrf: "", ip };
  return {
    get cookie() { return state.cookie; },
    async request(route, options = {}) {
      const headers = new Headers(options.headers || {});
      if (options.origin !== null) headers.set("Origin", options.origin || origin);
      headers.set("X-Forwarded-For", state.ip);
      if (state.cookie) headers.set("Cookie", state.cookie);
      if (options.csrf !== false && options.method && options.method !== "GET" && state.csrf) headers.set("X-CSRF-Token", state.csrf);
      let body = options.body;
      if (body && typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob)) {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(body);
      }
      const response = await fetch(`${origin}${route}`, { ...options, headers, body });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) state.cookie = setCookie.split(";", 1)[0];
      const contentType = response.headers.get("content-type") || "";
      const result = contentType.includes("application/json") ? await response.json() : await response.text();
      if (result?.csrfToken) state.csrf = result.csrfToken;
      return { response, body: result };
    },
  };
}

async function startServer() {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "donghua-auth-"));
  db = openDatabase(directory);
  createAdmin(db, USERNAME, OLD_PASSWORD);
  const initial = createApp({ dataDir: directory, publicOrigin: "http://127.0.0.1:0", db, secureCookies: false, trustProxy: true });
  const firstServer = await new Promise((resolve) => {
    const instance = initial.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = firstServer.address();
  origin = `http://127.0.0.1:${address.port}`;
  await new Promise((resolve) => firstServer.close(resolve));
  closeDatabase(db);
  db = openDatabase(directory);
  app = createApp({ dataDir: directory, publicOrigin: origin, db, secureCookies: false, trustProxy: true });
  server = await new Promise((resolve, reject) => {
    const instance = app.listen(Number(address.port), "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });
}

before(startServer);
after(async () => {
  await new Promise((resolve) => server?.close(resolve));
  closeDatabase(db);
  await fs.rm(directory, { recursive: true, force: true });
});

async function establishSession(testClient) {
  const result = await testClient.request("/api/auth/session");
  assert.equal(result.response.status, 200);
  assert.ok(result.body.csrfToken);
  return result;
}

async function login(testClient, password = OLD_PASSWORD) {
  await establishSession(testClient);
  const result = await testClient.request("/api/auth/login", { method: "POST", body: { username: USERNAME, password } });
  assert.equal(result.response.status, 200);
  return result;
}

test("login rotates the anonymous session and logout revokes it", async () => {
  const testClient = client("198.51.100.71");
  await establishSession(testClient);
  const anonymousCookie = testClient.cookie;
  const noCsrf = await testClient.request("/api/auth/login", { method: "POST", body: { username: USERNAME, password: OLD_PASSWORD }, csrf: false });
  assert.equal(noCsrf.response.status, 403);
  const wrongOrigin = await testClient.request("/api/auth/login", { method: "POST", body: { username: USERNAME, password: OLD_PASSWORD }, origin: "http://evil.example" });
  assert.equal(wrongOrigin.response.status, 403);
  const loggedIn = await testClient.request("/api/auth/login", { method: "POST", body: { username: USERNAME, password: OLD_PASSWORD } });
  assert.equal(loggedIn.response.status, 200);
  assert.notEqual(testClient.cookie, anonymousCookie);
  assert.equal((await testClient.request("/api/auth/session")).body.authenticated, true);
  const loggedOut = await testClient.request("/api/auth/logout", { method: "POST", body: {} });
  assert.equal(loggedOut.response.status, 200);
  assert.equal((await testClient.request("/api/auth/session")).body.authenticated, false);
});

test("expired session is revoked and replaced by an anonymous session", async () => {
  const testClient = client("198.51.100.72");
  await login(testClient);
  const sessionId = decodeURIComponent(testClient.cookie.split("=", 2)[1]);
  db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(new Date(Date.now() - 1_000).toISOString(), sessionId);
  const result = await testClient.request("/api/auth/session");
  assert.equal(result.response.status, 200);
  assert.equal(result.body.authenticated, false);
  assert.ok(testClient.cookie);
});

test("password change revokes every old session and accepts only the new password", async () => {
  const first = client("198.51.100.73");
  const second = client("198.51.100.74");
  await login(first);
  await login(second);
  const changed = await first.request("/api/auth/password", { method: "POST", body: { currentPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD } });
  assert.equal(changed.response.status, 200);
  assert.equal((await first.request("/api/auth/session")).body.authenticated, true);
  assert.equal((await second.request("/api/auth/session")).body.authenticated, false);

  const oldLogin = client("198.51.100.75");
  await establishSession(oldLogin);
  const rejected = await oldLogin.request("/api/auth/login", { method: "POST", body: { username: USERNAME, password: OLD_PASSWORD } });
  assert.equal(rejected.response.status, 401);
  const newLogin = await oldLogin.request("/api/auth/login", { method: "POST", body: { username: USERNAME, password: NEW_PASSWORD } });
  assert.equal(newLogin.response.status, 200);
});

test("repeated bad logins are rate limited", async () => {
  const testClient = client("198.51.100.76");
  await establishSession(testClient);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await testClient.request("/api/auth/login", { method: "POST", body: { username: USERNAME, password: "wrong-password-000" } });
    assert.equal(result.response.status, 401);
  }
  const limited = await testClient.request("/api/auth/login", { method: "POST", body: { username: USERNAME, password: OLD_PASSWORD } });
  assert.equal(limited.response.status, 429);
});

