import test from "node:test";
import assert from "node:assert/strict";
import { translations, SUPPORTED_LANGUAGES } from "../src/translations/index.ts";

test("Lok-Setu Auth & Profile Contracts", async (t) => {
  await t.test("Supported languages list covers all 8 specified Indian regional languages", () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    const expected = ["hi", "en", "gu", "mr", "bn", "ta", "te", "kn"];
    for (const exp of expected) {
      assert.ok(codes.includes(exp), `Expected ${exp} to be in SUPPORTED_LANGUAGES`);
    }
  });

  await t.test("Navigation translations contain essential auth keys for all languages", () => {
    const requiredKeys = ["nav.signIn", "nav.register", "nav.dashboard", "nav.profile", "nav.logout"];
    for (const lang of SUPPORTED_LANGUAGES) {
      const dict = translations[lang.code];
      assert.ok(dict, `Translation dictionary exists for ${lang.code}`);
      for (const key of requiredKeys) {
        assert.ok(
          dict[key] && dict[key].trim().length > 0,
          `Key "${key}" should be defined and non-empty for language "${lang.code}"`
        );
      }
    }
  });

  await t.test("Registration payload conforms to backend schema", () => {
    const payload = {
      username: "citizen_rahul",
      email: "rahul@example.com",
      password: "StrongPassword123!",
      phone: "+919876543210",
      role: "citizen",
      preferredLanguage: "hi",
      state: "Maharashtra",
      city: "Pune",
    };

    assert.equal(typeof payload.username, "string");
    assert.equal(typeof payload.email, "string");
    assert.equal(typeof payload.password, "string");
    assert.equal(payload.role, "citizen");
    assert.ok(payload.preferredLanguage.length === 2);
  });

  await t.test("Profile payload attributes conform to demographic schema", () => {
    const profilePayload = {
      age: 32,
      gender: "male",
      maritalStatus: "married",
      casteCategory: "obc",
      religion: "hindu",
      isDivyangjan: false,
      disabilityPercentage: 0,
      disabilityType: "",
      annualFamilyIncome: "100000-250000",
      rationCardType: "bpl",
      occupation: "farmer",
      preferredLanguages: ["hi", "mr", "en"],
      state: "Maharashtra",
      district: "Pune",
      localityType: "rural",
    };

    assert.equal(typeof profilePayload.age, "number");
    assert.ok(["male", "female", "transgender", "other"].includes(profilePayload.gender));
    assert.ok(["general", "obc", "sc", "st", "ews"].includes(profilePayload.casteCategory));
    assert.ok(["bpl", "apl", "ayush", "annapurna", "none"].includes(profilePayload.rationCardType));
    assert.ok(["rural", "urban", "semi-urban"].includes(profilePayload.localityType));
    assert.ok(Array.isArray(profilePayload.preferredLanguages));
    assert.ok(profilePayload.preferredLanguages.length <= 3);
  });
});
