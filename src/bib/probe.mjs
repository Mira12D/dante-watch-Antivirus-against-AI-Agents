// Small hand-written seed per intent (de/en/es), used to bootstrap the classifier.
// "unklar" is the negative class: things people say that are not a Dante task.
const S = {
  gruss: ["hi", "hallo", "hey dante", "moin", "servus", "guten morgen", "na wie gehts", "hello", "hey there", "good evening", "hola", "buenas", "buenos dias", "que tal dante", "yo"],
  hilfe: ["hilfe", "help", "was kannst du", "was kannst du alles", "welche befehle gibt es", "wie funktioniert das", "zeig mir die befehle", "what can you do", "how does this work", "show commands", "ayuda", "que puedes hacer", "como funciona", "?", "ich weiß nicht was ich sagen soll"],
  raus: ["raus", "tschüss", "bye", "exit", "quit", "schlaf", "geh schlafen", "ich bin fertig", "das wars", "mach aus", "goodbye", "im done", "adios", "chao", "salir"],
  pruef: ["prüf", "prüf mal", "check", "scan", "prüf diesen rechner", "ist mein mac sicher", "bin ich sicher", "schau nach lücken", "gibt es lücken", "check this machine", "am i safe", "scan for vulnerabilities", "revisa", "estoy seguro", "busca vulnerabilidades"],
  server: ["server root@host", "prüf meinen server", "check server root@1.2.3.4", "ziel root@box", "schau dir meinen server an", "ist mein server sicher", "mein vps", "verbinde dich mit root@host", "check my server", "scan my vps admin@host", "is my server safe", "revisa mi servidor", "mi servidor esta seguro", "servidor root@host", "geh auf den server"],
  key: ["key ~/.ssh/id_ed25519", "schlüssel ~/.ssh/key", "nimm den key ~/.ssh/id_ed25519", "mein ssh key ist ~/.ssh/x", "benutz den schlüssel", "setz den key", "use key ~/.ssh/id_rsa", "my ssh key is ~/.ssh/k", "set the key", "usa la llave ~/.ssh/k", "mi clave ssh", "clave ~/.ssh/id"],
  pruef_lokal: ["hier", "lokal", "local", "zurück zu meinem rechner", "diesen rechner", "wieder lokal", "back to my machine", "this computer", "localhost", "aqui", "mi computadora", "vuelve a local"],
  fix: ["fix", "fix das", "mach es zu", "schließ die lücke", "repariere das", "kannst du das reparieren", "behebe es", "fix it", "close it", "patch it", "repair the hole", "arreglalo", "cierra el hueco", "repara eso", "mach das heile"],
  demo: ["demo", "zeig mir eine demo", "übung", "probelauf", "zeig wie das geht", "zeig mir die schleife", "test run", "show me a demo", "practice", "show me how it works", "demostracion", "muestrame un ejemplo", "prueba de practica"],
  karte: ["karte", "zeig die karte", "was weißt du", "was hast du gefunden", "letztes ergebnis", "zeig das ergebnis nochmal", "the map", "what did you find", "last result", "show results", "el mapa", "que encontraste", "muestra el resultado"],
  smalltalk: ["erzähl einen witz", "wie gehts dir", "danke dir", "bin müde", "langer tag heute", "tell me a joke", "how are you doing", "thanks man", "rough day", "cuéntame un chiste", "cómo estás", "gracias", "qué día más largo"],
  unklar: ["schreib mir eine mail", "wie wird das wetter", "bestell mir pizza", "mach meine hausaufgaben", "übersetz das ins englische", "write my essay", "whats the weather", "book a flight", "order food", "escribe un correo", "cual es el clima", "haz mi tarea", "wer hat das spiel gewonnen", "kauf aktien"],
};
// "lokal" is no intent of its own (it overlapped "pruef": "check local" is both) - it is a slot.
export const PROBE = Object.entries(S).flatMap(([intent, xs]) => xs.map((text) => ({ intent: intent === "pruef_lokal" ? "pruef" : intent, text })));

// Held-out lines the router never saw - typos included, the way people really type.
export const HELDOUT = [
  ["hallo bruder", "gruss"], ["hey wie gehts dir", "gruss"], ["hola amigo", "gruss"], ["hi dante", "gruss"],
  ["was kann der", "hilfe"], ["welche befehle", "hilfe"], ["help me", "hilfe"], ["que comandos hay", "hilfe"],
  ["tschau", "raus"], ["ich geh jetzt", "raus"], ["exit now", "raus"],
  ["prüff mal bitte", "pruef"], ["ist der rechner sicher", "pruef"], ["chek for holes", "pruef"], ["escanea", "pruef"], ["gibts sicherheitslücken", "pruef"],
  ["servr root@203.0.113.10", "server"], ["kannst du meinen server checken", "server"], ["check admin@myhost", "server"], ["revisa servidor root@host", "server"],
  ["key ~/.ssh/id_ed25519", "key"], ["nimm schlüssel ~/.ssh/a", "key"], ["usa clave ~/.ssh/b", "key"],
  ["zurück lokal", "pruef"], ["mein rechner hier", "pruef"],
  ["fix es bitte", "fix"], ["mach die lücke zu", "fix"], ["please fix", "fix"], ["arregla eso", "fix"],
  ["demo bitte", "demo"], ["zeig mal ne übung", "demo"], ["demo please", "demo"],
  ["was hast du gefunden bruder", "karte"], ["zeig karte", "karte"], ["results", "karte"],
  ["schreib meinem chef", "unklar"], ["wie spät ist es", "unklar"], ["tell me a joke", "smalltalk"], ["pizza bestellen", "unklar"], ["quantenphysik erklären", "unklar"],
];
