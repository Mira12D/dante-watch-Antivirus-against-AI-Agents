// Two plain questions that are about STATE, not about doing something:
//  - "ist der wachschutz an?", "is the watch on?" -> say whether it is on (never start the set-up because of a question)
//  - "ok bin ich sicher?", "am I safe?" -> look at this machine (the person asks about themselves)
const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");
const WATCH_Q = W("ist (?:der |mein )?(?:wachschutz|w[aä]chter|k[oö]der|watch)(?: schon| jetzt| gerade| eigentlich)? (?:an|aktiv|angeschaltet|eingeschaltet|am laufen|l[aä]uft|scharf|ein)|l[aä]uft (?:der |mein )?wachschutz|wachschutz (?:status|aktiv\\?|an ?\\?)|is (?:the |my )?(?:bait )?(?:watch|guard)(?: service)? (?:on|active|enabled|running|armed)|(?:bait )?watch status|est[aá] (?:activa|activo|encendid[oa]) (?:la )?vigilancia");
export const wantsWatchStatus = (line) => String(line || "").length < 70 && WATCH_Q.test(line);
const SAFE_ME = /^(?:ok(?:ay)?[ ,]+|und[ ,]+|also[ ,]+|so[ ,]+)?(?:bin ich|am i|estoy)\s+(?:denn |eigentlich |now |here |hier )?(?:sicher|safe|secure|seguro)\s*[?!.]*$/iu;
export const wantsSafeMe = (line) => SAFE_ME.test(String(line || "").trim());
