// Questions about a system, recognised by their words in German, English and Spanish: "what is my system / which is my mac / how
// much RAM" (information) and "what is going on there / why is it slow / who is logged in / which ports are open" (activity).
// These are answers to be read off the machine, not checks. The classifier learns free phrasings; this catches the plain ones.
import { CHECK_VERB } from "./pick.mjs";
import { asksWhichServers } from "./servers.mjs";

const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");
const THING = W("system\\p{L}*|sistema|betriebssystem|rechner|mac|macbook|laptop|computer|server|maschine|kiste|os|versi[oó]n|linux|windows|unix|bsd|ram|arbeitsspeicher|speicher|festplatte|platte|cpu|prozessor|hardware|machine|memory|disk|storage|processor|ordenador|equipo|memoria|disco|procesador|m[aá]quina|servidor");
const ASK = W("was ist|was f[uü]r|welche[rsmn]?|wie viel\\p{L}*|wieviel\\p{L}*|wie voll|wie gro(?:ß|ss)|how much|how big|which|what(?:'s| is)?|qu[eé]|cu[aá]l(?:es)?|cu[aá]nt[ao]s?|info\\p{L}*|information|zeig\\p{L}*|show|muestr\\p{L}*|dame|gib mir|tell me");
const HEALTH = W("in ordnung|gesund|sicher|sauber|healthy|safe|clean|secure|bien|sano|seguro|limpio");
const KNOWN = W("kenn\\p{L}*|gefunden|know|found|conoc\\p{L}*|encontr\\p{L}*|finde|find|busca\\p{L}*");
const STATUS = W("wie geht\\p{L}*|wie l[aä]uft|wie steht|how are|how is|how's|c[oó]mo est[aá]n|c[oó]mo van");
const GOING = W("was (?:\\p{L}+ ){0,4}l[aä]uft|what runs|qu[eé] corre|was ist (?:da |dort |hier |gerade |denn )*los|was geht (?:\\p{L}+ ){0,4}ab|was l[aä]uft(?: da| dort| gerade| hier| so| grad| denn)*|was passiert|was frisst|warum \\p{L}*(?: \\p{L}+)* langsam|wer ist (?:gerade |grad )?(?:eingeloggt|angemeldet|drauf)|welche ports|welche dienste|what(?:'s| is) (?:going on|happening|running|up with)|why is (?:it|my \\p{L}+) so slow|why .{0,20}slow|who(?:'s| is) logged|which ports|what is eating|what(?:'s| is) using|qu[eé] pasa|qu[eé] est[aá] (?:corriendo|pasando)|por qu[eé] .{0,20}lent[oa]|qui[eé]n est[aá] (?:conectado|dentro)|qu[eé] puertos|qu[eé] se ejecuta");

/** "was ist mein system", "welcher ist mein mac", "wie viel ram hab ich", "what machine is this", "qué sistema tengo" */
export const wantsSysInfo = (line, hasTarget) => !hasTarget && THING.test(line) && ASK.test(line) && !(asksWhichServers(line) && !W("system\\p{L}*|betriebssystem|os|version|ram|cpu|platte").test(line)) && !CHECK_VERB.test(line) && !HEALTH.test(line) && !KNOWN.test(line) && !STATUS.test(line) && !GOING.test(line);
/** "was ist da los", "warum ist der so langsam", "wer ist eingeloggt", "which ports are open" */
export const wantsGoingOn = (line, hasTarget) => !hasTarget && GOING.test(line) && !CHECK_VERB.test(line) && !STATUS.test(line);

const ALL = W("welche (?:systeme|rechner|maschinen)|(?:which|what) (?:systems|machines|computers)|qu[eé] (?:sistemas|equipos|m[aá]quinas)|cu[aá]les (?:son )?(?:mis )?(?:sistemas|equipos|m[aá]quinas)|(?:alle )?meine (?:systeme|rechner|maschinen)|alle (?:systeme|rechner|maschinen)|(?:all )?my (?:systems|machines|computers)|everything i own|mis (?:sistemas|equipos|m[aá]quinas)|todos mis (?:sistemas|equipos)|alles was ich habe|todo lo que tengo");
const OVERVIEW = W("habe ich|hab ich|have i|do i have|tengo|sagen|erz[aä]hl\\p{L}*|zeig\\p{L}*|[uü]berblick|wei(?:ß|ss)t?|kennst|tell|show|overview|know|list|dime|muestr\\p{L}*|resumen|sabes|cu[eé]ntame|what can you|was kannst du");
/** "was kannst du mir über meine systeme sagen", "tell me about my machines", "dame un resumen de mis sistemas": all machines at once */
const WHICHQ = W("welche|which|qu[eé]|cu[aá]les");
export const wantsAllSystems = (line, hasTarget) => !hasTarget && ALL.test(line) && (OVERVIEW.test(line) || WHICHQ.test(line)) && !CHECK_VERB.test(line) && !GOING.test(line) && !W("sicher|safe|seguros?|gesund").test(line);
