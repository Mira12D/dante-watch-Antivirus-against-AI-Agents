// Short sayings shown during long steps, in Dante's voice.
import { lang } from "../i18n.mjs";

const QUIPS = {
  de: ["zählt die Kreise der Hölle …", "poliert das Schwert …", "liest Virgils Karte …", "fragt den Fährmann …", "sucht die Tür, die offen stand …", "schärft die Zeilen …", "trinkt einen Espresso …", "prüft die Papiere von Charon …", "wartet, bis der Hund aufhört zu bellen …", "geht noch einen Kreis tiefer …", "schaut hinter jede Tür …", "nimmt es nicht für sicher, bis die Zeile da ist …"],
  en: ["counting the circles of Hell …", "polishing the sword …", "reading Virgil's map …", "asking the ferryman …", "looking for the door that stood open …", "sharpening the lines …", "having an espresso …", "checking Charon's papers …", "waiting for the dog to stop barking …", "going one circle deeper …", "looking behind every door …", "not calling it safe until the line is there …"],
  es: ["contando los círculos del infierno …", "puliendo la espada …", "leyendo el mapa de Virgilio …", "preguntando al barquero …", "buscando la puerta que quedó abierta …", "afilando las líneas …", "tomando un espresso …", "revisando los papeles de Caronte …", "esperando a que el perro deje de ladrar …", "bajando un círculo más …", "mirando detrás de cada puerta …", "sin darlo por seguro hasta que esté la línea …"],
};
let at = Math.floor(Math.random() * 12), tick = 0;
/** A saying that changes every ~4 seconds of calls (each frame calls once), so a long wait does not repeat itself. */
export function quip() {
  const xs = QUIPS[lang()] || QUIPS.en;
  if (tick++ % 33 === 0) at = Math.floor(Math.random() * xs.length);
  return xs[at % xs.length];
}
