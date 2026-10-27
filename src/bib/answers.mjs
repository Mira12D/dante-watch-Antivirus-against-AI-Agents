// Canned answers for questions Dante can answer without running anything: five lines at most each.
// None of them states a result; verdicts come only from a check and its evidence line.
export const ANSWERS = {
  frage_luecke: {
    de: ["PHP2Shell (CVE-2026-109618/-619) ist eine Lücke im PHP-Kern.", "Wer sie trifft, kann über eine Webanfrage eigene Befehle auf dem Server ausführen (RCE).", "Betroffen sind nur Rechner mit PHP. Ob deiner es ist, sag ich dir erst mit echter Zeile:", "„prüf“ für diesen Rechner, „server user@host“ für einen Server."],
    es: ["PHP2Shell (CVE-2026-109618/-619) es una falla en el núcleo de PHP.", "Quien la usa puede ejecutar sus propios comandos en el servidor con una petición web (RCE).", "Solo afecta a equipos con PHP. Si el tuyo lo está, te lo digo con una línea real:", "„revisa“ para este equipo, „server usuario@host“ para un servidor."],
    en: ["PHP2Shell (CVE-2026-109618/-619) is a hole in the PHP core.", "Whoever hits it can run their own commands on the server through a web request (RCE).", "Only machines with PHP are affected. Whether yours is, I tell you only with a real line:", "„check“ for this machine, „server user@host“ for a server."],
  },
  frage_urteil: {
    de: ["SICHER sag ich nur, wenn eine echte Zeile es belegt.", "UNBEKANNT heißt: ich konnte nicht nachsehen. Nicht: alles gut.", "RISIKO heißt: die Zeilen zeigen eine offene Stelle.", "Unter jedem Urteil steht der Befehl und was er geantwortet hat — prüf mich nach."],
    es: ["SICHER (seguro) solo lo digo si una línea real lo prueba.", "UNBEKANNT (desconocido) significa: no pude mirar. No significa: todo bien.", "RISIKO (riesgo) significa: las líneas muestran algo abierto.", "Debajo de cada veredicto está el comando y lo que respondió — compruébalo."],
    en: ["SICHER (safe) I only say when a real line proves it.", "UNBEKANNT (unknown) means: I could not look. Not: all good.", "RISIKO (risk) means: the lines show something open.", "Under every verdict stands the command and what it answered — check me."],
  },
  frage_gehackt: {
    de: ["Ob jemand drin war, kann ich dir nicht sagen — ich suche offene Türen, keine Einbrecher.", "Was ich kann: prüfen, ob eine bekannte Tür offen steht („prüf“ / „server user@host“).", "Wenn du glaubst, jemand war drin: Passwörter und SSH-Schlüssel tauschen, Logs sichern,", "im Zweifel einen Profi holen. Ehrlich ist besser als beruhigt."],
    es: ["Si alguien entró, no te lo puedo decir — busco puertas abiertas, no intrusos.", "Lo que sí puedo: ver si una puerta conocida está abierta („revisa“ / „server usuario@host“).", "Si crees que alguien entró: cambia contraseñas y llaves SSH, guarda los logs,", "y si dudas, llama a un profesional. Mejor honesto que tranquilo."],
    en: ["Whether someone got in, I cannot tell you — I look for open doors, not burglars.", "What I can do: check if a known door is open („check“ / „server user@host“).", "If you think someone was in: change passwords and SSH keys, save the logs,", "and when in doubt, call a pro. Honest beats reassured."],
  },
  frage_dante: {
    de: ["Ich bin Dante, ein Wächter im Terminal.", "Ich sende nichts — kein Netz, kein Konto, keine Abhängigkeit.", "Was ich verstehe, kommt aus einer Bib, die im Paket liegt; keine KI im Hintergrund.", "Ich ändere nichts ohne dein Ja, und jedes Urteil trägt seine echte Zeile."],
    es: ["Soy Dante, un guardián en la terminal.", "No envío nada — sin red, sin cuenta, sin dependencias.", "Lo que entiendo viene de una biblioteca dentro del paquete; no hay IA detrás.", "No cambio nada sin tu sí, y cada veredicto lleva su línea real."],
    en: ["I am Dante, a watchman in the terminal.", "I send nothing — no network, no account, no dependencies.", "What I understand comes from a bib inside the package; no AI behind me.", "I change nothing without your yes, and every verdict carries its real line."],
  },
  // Small talk: short, in character (a calm guide, dry, warm), never a claim about the user's systems.
  smalltalk: {
    de: [["Mir gehts gut — ich bin wach, das ist mein Zustand.", "Wenn du willst, schau ich nach deinen Servern."], ["Ich sitz hier und pass auf. Ruhige Schicht bisher.", "Sag Bescheid, wenn ich was ansehen soll."], ["Ich hör zu.", "Und wenn's um Server geht, kann ich sogar was tun."], ["Danke. Ich mach nur meinen Job: hinsehen, nichts erfinden."], ["Lange Schicht? Dann lass mich die Runde machen — „prüf“ reicht."], ["Ich bin ein Wächter, kein großer Plauderer.", "Aber ich bin da."], ["Ein Witz? Ein Server kommt in eine Bar. Der Wirt: „Port 80 ist geschlossen.“", "…ich bleib lieber beim Wachen."], ["Ehrlich gesagt kenne ich nur Zeilen. Deine Geschichte hör ich mir trotzdem an."]],
    en: [["I'm fine — awake, that's my state.", "If you like, I'll look at your servers."], ["Sitting here, keeping watch. Quiet shift so far.", "Tell me when I should look at something."], ["I'm listening.", "And if it's about servers, I can even do something."], ["Thanks. I just do my job: look, invent nothing."], ["Long shift? Let me do the round — „check“ is enough."], ["I'm a watchman, not much of a talker.", "But I'm here."], ["A joke? A server walks into a bar. Bartender: „Port 80 is closed.“", "…I'll stick to watching."], ["Honestly, all I know are lines. I'll still hear your story."]],
    es: [["Estoy bien — despierto, ese es mi estado.", "Si quieres, miro tus servidores."], ["Aquí sentado, vigilando. Turno tranquilo hasta ahora.", "Avísame cuando deba mirar algo."], ["Te escucho.", "Y si es de servidores, hasta puedo hacer algo."], ["Gracias. Solo hago mi trabajo: mirar, no inventar nada."], ["¿Turno largo? Déjame hacer la ronda — „revisa“ basta."], ["Soy un guardián, no un gran conversador.", "Pero aquí estoy."], ["¿Un chiste? Un servidor entra a un bar. El cantinero: „El puerto 80 está cerrado.“", "…mejor sigo vigilando."], ["La verdad, solo conozco líneas. Igual escucho tu historia."]],
  },
  unklar: {
    de: ["Das ist nicht meine Arbeit — ich wache über Server. Sag „hilfe“."],
    es: ["Eso no es mi trabajo — vigilo servidores. Di „ayuda“."],
    en: ["That is not my work — I watch over servers. Say „help“."],
  },
};
