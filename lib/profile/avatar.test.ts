import { AVATAR_MAX_BYTES } from "./constants";
import { isOwnedAvatarPath, validateAvatarFile } from "./avatar";

describe("validateAvatarFile", () => {
  it.each([
    ["image/jpeg", [0xff, 0xd8, 0xff, 0x00], "jpg"],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "png"],
    [
      "image/webp",
      [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
      "webp",
    ],
  ] as const)("accepts a valid %s signature", (mime, signature, extension) => {
    const result = validateAvatarFile({
      bytes: new Uint8Array(signature),
      declaredMime: mime,
      size: signature.length,
    });

    expect(result).toMatchObject({ success: true, extension, mime });
  });

  it("rejects a declared MIME that does not match the file signature", () => {
    expect(
      validateAvatarFile({
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
        declaredMime: "image/png",
        size: 4,
      }),
    ).toMatchObject({ success: false });
  });

  it("rejects an oversized file", () => {
    expect(
      validateAvatarFile({
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00]),
        declaredMime: "image/jpeg",
        size: AVATAR_MAX_BYTES + 1,
      }),
    ).toMatchObject({ success: false });
  });
});

describe("isOwnedAvatarPath", () => {
  const userId = "5f14aa79-cf45-4377-b187-5bf49d19fca2";

  it("accepts a direct object in the authenticated user's folder", () => {
    expect(isOwnedAvatarPath(`${userId}/avatar-123.png`, userId)).toBe(true);
  });

  it.each([
    "other-user/avatar.png",
    `${userId}/nested/avatar.png`,
    `${userId}/../other-user/avatar.png`,
    `${userId}/`,
  ])("rejects an unsafe or foreign path: %s", (path) => {
    expect(isOwnedAvatarPath(path, userId)).toBe(false);
  });
});
