import test from "node:test";
import assert from "node:assert/strict";
import {
  createSessionToken,
  normalizeStoredContent,
  originIsSame,
  readSessionCookie,
  validateContent,
  verifySessionToken,
} from "../lib/admin-api.js";

function validContent() {
  return {
    texts: { "hello|مرحبا": { en: "Hello", ar: "مرحبا" } },
    settings: {
      restaurantName: "Fast Food",
      restaurantNameAr: "فاست فود",
      phone: "01040544207",
      email: "hello@example.com",
      instagram: "https://instagram.com/fastfood",
      facebook: "",
      tiktok: "",
      currencySymbol: "$",
    },
    menu: [{
      id: "burger-1",
      category: "burgers",
      nameEn: "Burger",
      nameAr: "برغر",
      descriptionEn: "A burger",
      descriptionAr: "برغر",
      price: 8.99,
      priceSuffix: "",
      image: "menu_burger.png",
      badgeEn: "",
      badgeAr: "",
      badgeStyle: "",
      metaIcon: "",
      metaEn: "",
      metaAr: "",
    }],
  };
}

test("validates and normalizes editable site content", () => {
  const result = validateContent(validContent());
  assert.equal(result.settings.restaurantName, "Fast Food");
  assert.equal(result.menu[0].price, 8.99);
  const restored = normalizeStoredContent(JSON.stringify(result));
  assert.equal(restored.texts["hello|مرحبا"].en, "Hello");
  assert.equal(restored.menu[0].price, 8.99);
});

test("rejects unsafe social links, image schemes, and duplicate menu IDs", () => {
  const badLink = validContent();
  badLink.settings.instagram = "javascript:alert(1)";
  assert.throws(() => validateContent(badLink), /must use HTTPS/);

  const badImage = validContent();
  badImage.menu[0].image = "javascript:alert(1)";
  assert.throws(() => validateContent(badImage), /HTTPS/);

  const duplicate = validContent();
  duplicate.menu.push({ ...duplicate.menu[0] });
  assert.throws(() => validateContent(duplicate), /unique/);
});

test("signs expiring admin sessions and reads only the configured cookie", () => {
  process.env.ADMIN_SESSION_SECRET = "test-session-secret-with-more-than-32-characters";
  const token = createSessionToken(1000);
  assert.equal(verifySessionToken(token, 1001), true);
  assert.equal(verifySessionToken(token, 1000 + 8 * 60 * 60 * 1000), false);
  assert.equal(verifySessionToken(`${token}x`, 1001), false);
  assert.equal(
    readSessionCookie({ headers: { cookie: `other=value; fastfood_admin=${token}` } }),
    token,
  );
});

test("requires a same-host, same-scheme request origin", () => {
  const headers = { host: "restaurant.vercel.app", origin: "https://restaurant.vercel.app", "x-forwarded-proto": "https" };
  assert.equal(originIsSame({ headers }), true);
  assert.equal(originIsSame({ headers: { ...headers, origin: "http://restaurant.vercel.app" } }), false);
  assert.equal(originIsSame({ headers: { ...headers, origin: "https://attacker.example" } }), false);
});
