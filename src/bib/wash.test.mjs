// Tests for the washer: one line per case (input -> expected), DE/EN/ES plus negatives.
import { test } from "node:test";
import assert from "node:assert/strict";
import { wash } from "./wash.mjs";

const cases = [
  // IP
  ["verbinde mit 203.0.113.10 per ssh", "verbinde mit {IP} per ssh"],
  ["ping 192.168.0.1, dann 10.0.0.5.", "ping {IP}, dann {IP}."],
  ["IPv6 fe80::1ff:fe23:4567:890a ist offen", "IPv6 {IP} ist offen"],
  // ZIEL
  ["ssh root@203.0.113.10 und schau nach", "ssh {ZIEL} und schau nach"],
  ["connect to deploy@myserver please", "connect to {ZIEL} please"],
  ["abre nm-streetwear.space en el navegador", "abre {ZIEL} en el navegador"],
  ["die Seite api.meinshop.de ist down", "die Seite {ZIEL} ist down"],
  // MAIL
  ["schick es an max.muster@firma.de bitte", "schick es an {MAIL} bitte"],
  ["send a copy to Jane+work@gmail.com.", "send a copy to {MAIL}."],
  ["escribe a ana_perez@correo.com.do hoy", "escribe a {MAIL} hoy"],
  // URL
  ["öffne https://shop.example.com/cart?id=5 jetzt", "öffne {URL} jetzt"],
  ["go to www.foo.org/page, then login", "go to {URL}, then login"],
  ["mira http://localhost:3000/admin.", "mira {URL}."],
  // PFAD
  ["lies /etc/nginx/nginx.conf aus", "lies {PFAD} aus"],
  ["liste ~/projekte/shop auf", "liste {PFAD} auf"],
  ["abre C:\\Users\\Ana\\Desktop\\plan.pdf ahora", "abre {PFAD} ahora"],
  ["check /var/www/html/index.php.", "check {PFAD}."],
  // KEY
  ["key sk-abcdefghijklmnopqrstuvwx1234 benutzen", "key {KEY} benutzen"],
  ["token 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 ist da", "token {KEY} ist da"],
  ["lade ~/.ssh/id_ed25519 hoch", "lade {KEY} hoch"],
  ["password: hunter2 setzen", "password: {KEY} setzen"],
  ["la contraseña=abc123 es mía", "la contraseña={KEY} es mía"],
  // TEL
  ["ruf +49 170 1234567 an", "ruf {TEL} an"],
  ["call (809) 555-1234 tomorrow", "call {TEL} tomorrow"],
  ["llama al 809-555-1234 hoy", "llama al {TEL} hoy"],
  // NUM
  ["Kundennummer 12345678 prüfen", "Kundennummer {NUM} prüfen"],
  ["Karte 4111 1111 1111 1111 sperren", "Karte {NUM} sperren"],
  ["pago con IBAN DE89 3704 0044 0532 0130 00 listo", "pago con IBAN {NUM} listo"],
  // NAME
  ["rufe Ahmet Yilmaz an", "rufe {NAME} an"],
  ["Herr Schmidt hat angerufen", "Herr {NAME} hat angerufen"],
  ["my name is Daniel Brown", "my name is {NAME}"],
  ["me llamo Yesenia Pérez y soy profesora", "me llamo {NAME} y soy profesora"],
  ["Dr. Meier kommt morgen", "Dr. {NAME} kommt morgen"],
  ["escrivirle a danny jose alexis un hola", "escrivirle a {NAME} un hola"],
  // Negative: must stay 1:1
  ["escribe a la profesora un correo", "escribe a la profesora un correo"],
  ["ya esta, llama finish con summary usage-log-OK-1234", "ya esta, llama finish con summary usage-log-OK-1234"],
  ["PHP 8.3.6 ist installiert", "PHP 8.3.6 ist installiert"],
  ["prüfe CVE-2026-109618 auf dem Server", "prüfe CVE-2026-109618 auf dem Server"],
  ["open index.php and app.js, then run server.py", "open index.php and app.js, then run server.py"],
  ["24/7 und/oder sí/no and/or km/h", "24/7 und/oder sí/no and/or km/h"],
  ["Kannst Du mir die Datei Schritt für Schritt erklären?", "Kannst Du mir die Datei Schritt für Schritt erklären?"],
  ["Rellena mi planificación de matemática 7mo grado", "Rellena mi planificación de matemática 7mo grado"],
  ["Die Zeit ist 10:30:00 am 2026-10-25", "Die Zeit ist 10:30:00 am 2026-10-25"],
  ["Hola Mundo, Guten Morgen, Good Morning", "Hola Mundo, Guten Morgen, Good Morning"],
  ["use claude-sonnet-4-5-20250929 for this", "use claude-sonnet-4-5-20250929 for this"],
  ["bitte /help und dann weiter", "bitte /help und dann weiter"],
];

test(`wash: ${cases.length} cases`, () => {
  for (const [input, want] of cases) assert.equal(wash(input).text, want, input);
});

test("wash: hits count per placeholder", () => {
  const r = wash("ssh root@1.2.3.4 und mail a@b.de und a@c.de");
  assert.deepEqual(r.hits, { MAIL: 2, ZIEL: 1 });
});

test("wash: clean sentence has no hits", () => {
  assert.deepEqual(wash("Erkläre mir bitte Docker").hits, {});
});

test("wash: idempotent", () => {
  for (const [input] of cases) {
    const once = wash(input).text;
    assert.equal(wash(once).text, once, input);
  }
});

test("wash: non-string input", () => {
  assert.equal(wash(null).text, "");
  assert.equal(wash(undefined).text, "");
});
