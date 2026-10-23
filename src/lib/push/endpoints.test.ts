import { describe, expect, it } from "vitest";
import { endpointPushValido } from "./endpoints";

describe("endpointPushValido", () => {
  it("acepta los servicios push de los navegadores", () => {
    for (const e of [
      "https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH",
      "https://fcm.googleapis.com/wp/dQw4w9WgXcQ",
      "https://android.googleapis.com/gcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk",
      "https://web.push.apple.com/QGuQyavXutnMH",
      "https://wns2-bl2p.notify.windows.com/w/?token=BQYAAAB",
    ]) {
      expect(endpointPushValido(e), e).toBe(true);
    }
  });

  it("rechaza direcciones elegidas por un atacante (SSRF)", () => {
    for (const e of [
      "https://127.0.0.1:8443/ssrf",
      "https://169.254.169.254/latest/meta-data/",
      "https://ssrf-prueba.127.0.0.1.nip.io:8443/x",
      "https://localhost/x",
      "https://fcm.googleapis.com:8443/fcm/send/x",
      "https://fcm.googleapis.com:443/fcm/send/x",
      "https://fcm.googleapis.com.evil.example/x",
      "https://fcm.googleapis.com@evil.example/x",
      "https://user:pass@fcm.googleapis.com/x",
      "https://evilfcm.googleapis.com/x",
      "https://push.apple.com.evil.example/x",
      "https://fcm.googleapis.com./x",
      "http://fcm.googleapis.com/fcm/send/x",
      "https://fcm.googleapis.com",
      "no es una url",
      `https://fcm.googleapis.com/${"x".repeat(1000)}`,
      null,
      42,
    ]) {
      expect(endpointPushValido(e), String(e)).toBe(false);
    }
  });
});
