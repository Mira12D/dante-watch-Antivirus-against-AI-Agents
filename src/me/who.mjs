// "wie heiße ich?", "what is my name", "¿cómo me llamo?": the person asks what Dante knows about THEM. He answers from user.md or says he does not know.
const W = (alt) => new RegExp("(?<![\\p{L}\\p{N}])(?:" + alt + ")(?![\\p{L}\\p{N}])", "iu");
const NAME = W("wie hei(?:ß|ss)e ich|wie ist mein name|wei(?:ß|ss)t du (?:noch )?(?:wie ich hei(?:ß|ss)e|meinen namen)|kennst du meinen namen|what(?:'s| is) my name|do you (?:know|remember) my name|how do you call me|who am i|c[oó]mo me llamo|cu[aá]l es mi nombre|sabes mi nombre");
export const wantsMyName = (line) => String(line || "").length < 60 && NAME.test(line);
