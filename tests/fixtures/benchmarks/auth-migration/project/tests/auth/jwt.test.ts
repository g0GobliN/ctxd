import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { signAccessToken, verifyAccessToken } from "../../src/auth/jwt.js";

describe("access tokens", () => {
  it("round-trips valid claims", () => {
    const token = signAccessToken({
      sub: "user-1",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
      scope: ["read"],
    });
    assert.equal(verifyAccessToken(token)?.sub, "user-1");
  });

  it("rejects an expired token", () => {
    const token = signAccessToken({ sub: "u", iat: 0, exp: 1, scope: [] });
    assert.equal(verifyAccessToken(token), undefined);
  });

  it("rejects a tampered signature", () => {
    const token = signAccessToken({
      sub: "user-1",
      iat: 0,
      exp: Math.floor(Date.now() / 1000) + 900,
      scope: [],
    });
    assert.equal(verifyAccessToken(`${token}x`), undefined);
  });
});
