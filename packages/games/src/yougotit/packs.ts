import type { ContentPack } from "@merky/game-sdk";

/** One spectrum card: two ends of a single continuous axis. */
export interface Spectrum {
  left: string;
  right: string;
}

/**
 * Core pack — 96 original spectra across the five research categories
 * (subjective, objective, cultural, moral, qualitative) plus a run of
 * Merky-flavored ones. Every pair is a true continuous axis; all text is
 * original to The Merkive.
 */
export const YOUGOTIT_CORE_SPECTRA: Spectrum[] = [
  // --- Subjective / experiential -----------------------------------------
  { left: "Gross topping", right: "Perfect topping" },
  { left: "Nap-proof room", right: "Nap paradise" },
  { left: "Sounds relaxing", right: "Sounds stressful" },
  { left: "Gym bag smell", right: "Fresh laundry smell" },
  { left: "Dressed for pain", right: "Dressed for comfort" },
  { left: "Acquired taste", right: "Instant favorite" },
  { left: "Puts you to sleep", right: "Keeps you up at night" },
  { left: "Mild salsa", right: "Call the fire brigade" },
  { left: "Elevator music", right: "Festival headliner" },
  { left: "Ice bath", right: "Lava soup" },
  { left: "Whisper quiet", right: "Jet engine loud" },
  { left: "Home-alone food", right: "First-date food" },
  { left: "Early bird hours", right: "Night owl hours" },
  { left: "Needs ketchup", right: "Insulted by ketchup" },
  { left: "Monday morning", right: "Friday afternoon" },
  { left: "Itchy sweater", right: "Cloud-soft hoodie" },
  { left: "Sad desk lunch", right: "Feast of a lifetime" },
  { left: "Karaoke poison", right: "Karaoke gold" },
  { left: "Small talk", right: "Soul talk" },
  { left: "Better served cold", right: "Better piping hot" },
  // --- Objective / quantitative ------------------------------------------
  { left: "Fits in a pocket", right: "Needs a truck" },
  { left: "Costs pocket change", right: "Costs a kidney" },
  { left: "Over in seconds", right: "Takes all day" },
  { left: "Feather light", right: "Crane required" },
  { left: "Snail pace", right: "Light speed" },
  { left: "Happens hourly", right: "Once a century" },
  { left: "Room temperature", right: "Surface of the sun" },
  { left: "Ancient history", right: "Dropped yesterday" },
  { left: "Everyone owns one", right: "One of a kind" },
  { left: "Walking distance", right: "Across the planet" },
  { left: "Lasts one use", right: "Outlives your kids" },
  { left: "Kiddie pool deep", right: "Ocean trench deep" },
  { left: "Zero calories", right: "Entire cheat day" },
  { left: "Five-minute build", right: "Flat-pack nightmare" },
  { left: "Basically extinct", right: "Absolutely everywhere" },
  { left: "Sea level", right: "Top of Everest" },
  { left: "Empty stadium", right: "Sold-out stadium" },
  { left: "Dial-up slow", right: "Fiber fast" },
  { left: "Single bite", right: "Feeds a village" },
  // --- Cultural / pop-culture --------------------------------------------
  { left: "Deep cut", right: "Stadium anthem" },
  { left: "Cult classic", right: "Box office titan" },
  { left: "Grandma-famous", right: "Internet-famous" },
  { left: "Dead meme", right: "Forever meme" },
  { left: "Sidekick energy", right: "Main character energy" },
  { left: "One-hit wonder", right: "Living legend" },
  { left: "Straight to streaming", right: "Awards-season darling" },
  { left: "Garage band", right: "World tour" },
  { left: "Niche hobby", right: "National obsession" },
  { left: "Fashion crime", right: "Runway ready" },
  { left: "Trash TV", right: "Peak TV" },
  { left: "Retired trend", right: "About to blow up" },
  { left: "Lovable villain", right: "Pure evil villain" },
  { left: "Local celebrity", right: "Global icon" },
  { left: "Skippable intro", right: "Unskippable intro" },
  { left: "Background extra", right: "Franchise lead" },
  { left: "Critic bait", right: "Crowd pleaser" },
  { left: "Spoiler-proof", right: "Spoiler landmine" },
  { left: "Tribute band", right: "The real deal" },
  // --- Moral / ethical ----------------------------------------------------
  { left: "White lie", right: "Villain arc" },
  { left: "Borrowing", right: "Grand theft" },
  { left: "Petty crime", right: "Supervillain crime" },
  { left: "Forgiven by Friday", right: "Grudge for life" },
  { left: "Little oopsie", right: "Career-ending scandal" },
  { left: "Pure kindness", right: "Kindness for clout" },
  { left: "Team player move", right: "Snake move" },
  { left: "Honest hustle", right: "Total scam" },
  { left: "Justified pettiness", right: "Unhinged revenge" },
  { left: "Harmless prank", right: "Friendship-ender" },
  { left: "Saint behavior", right: "Chaotic evil" },
  { left: "Fair play", right: "Blatant cheating" },
  { left: "Polite excuse", right: "Bald-faced lie" },
  { left: "Jaywalking guilt", right: "Heist-movie guilt" },
  // --- Qualitative / relational ------------------------------------------
  { left: "Useless gadget", right: "Can't live without it" },
  { left: "Anyone can do it", right: "Ten thousand hours" },
  { left: "Zero effort", right: "Life's work" },
  { left: "Easily replaced", right: "Irreplaceable" },
  { left: "Totally optional", right: "Absolutely mandatory" },
  { left: "Low stakes", right: "Everything on the line" },
  { left: "Fix it with tape", right: "Call a professional" },
  { left: "Common knowledge", right: "Insider secret" },
  { left: "Bunny slope", right: "Double black diamond" },
  { left: "Instantly forgotten", right: "Haunts you forever" },
  { left: "Safe bet", right: "Total gamble" },
  { left: "Underhyped", right: "Overhyped" },
  { left: "Plan B material", right: "The whole plan" },
  { left: "Mild inconvenience", right: "Full catastrophe" },
  { left: "Weekend project", right: "Generational project" },
  { left: "Bare minimum", right: "Gold-plated extra" },
  // --- Merky-flavored -----------------------------------------------------
  { left: "Mildly Merky", right: "Maximum Merk" },
  { left: "Lobby lurker", right: "Party MVP" },
  { left: "Muted mic", right: "Open mic chaos" },
  { left: "AFK energy", right: "Sweaty tryhard" },
  { left: "Casual Sunday match", right: "Grand finals" },
  { left: "Gracious winner", right: "Menace in the chat" },
  { left: "Tutorial level", right: "Final boss" },
  { left: "Bronze rank", right: "Grandmaster" },
];

/**
 * After Dark pack — 44 spicier-but-not-explicit spectra. Innuendo and
 * chaotic-confession energy only; nothing hateful or graphic.
 */
export const YOUGOTIT_AFTERDARK_SPECTRA: Spectrum[] = [
  { left: "Swipe left instantly", right: "Swipe right instantly" },
  { left: "First-date story", right: "Fifth-drink story" },
  { left: "Innocent text", right: "Delete-this text" },
  { left: "Safe for grandma", right: "HR incident" },
  { left: "G-rated dream", right: "Tell-no-one dream" },
  { left: "Walking red flag", right: "Certified green flag" },
  { left: "One drink in", right: "Lost my shoes" },
  { left: "Group chat safe", right: "Burner phone only" },
  { left: "Peck on the cheek", right: "Get a room" },
  { left: "Buttoned all the way", right: "Buttons optional" },
  { left: "Honeymoon phase", right: "Roommates with rings" },
  { left: "Smooth line", right: "Blocked immediately" },
  { left: "Would tell my mom", right: "Taking it to the grave" },
  { left: "Mild crush", right: "Shrine in the closet" },
  { left: "PG sleepover", right: "Vegas weekend" },
  { left: "Good-morning texter", right: "2 AM 'u up?' texter" },
  { left: "Beach cover-up", right: "Clothing optional" },
  { left: "Handshake goodbye", right: "Stayed for breakfast" },
  { left: "Book club energy", right: "Bachelorette energy" },
  { left: "Wholesome hobby", right: "Hobby you lie about" },
  { left: "Extra vanilla", right: "Opposite of vanilla" },
  { left: "Replies in seconds", right: "Left on read for weeks" },
  { left: "Meet-the-parents ready", right: "Hide from the parents" },
  { left: "Any-wifi search", right: "Incognito only" },
  { left: "Home by nine", right: "Became the HR meeting" },
  { left: "Candlelit dinner", right: "Drive-thru at 3 AM" },
  { left: "Slow burn", right: "Whirlwind fling" },
  { left: "Marriage material", right: "Cautionary tale" },
  { left: "Blushes at hand-holding", right: "Unshockable" },
  { left: "Keeps the receipts", right: "Burns the evidence" },
  { left: "Modest fit", right: "Traffic-stopping fit" },
  { left: "Polite peck", right: "Fireworks" },
  { left: "Cuddle session", right: "Cardio session" },
  { left: "Sweet nothings", right: "Filthy somethings" },
  { left: "Strictly platonic", right: "Anything but platonic" },
  { left: "Tame bachelor party", right: "Stays in Vegas" },
  { left: "Background check first", right: "Love at first sight" },
  { left: "Accurate profile pic", right: "Full catfish" },
  { left: "Gives butterflies", right: "Gives the ick" },
  { left: "Whispered rumor", right: "Front-page scandal" },
  { left: "Halloween cute", right: "Halloween scandalous" },
  { left: "Friendly exes", right: "Witness protection exes" },
  { left: "Never flirts", right: "Flirts with a lamppost" },
  { left: "Date-night playlist", right: "Do-not-disturb playlist" },
];

/**
 * Built-in fallback clues, used when the clue timer expires (or a bot
 * covers an abandoned Oracle). Picked via ctx.rng.
 */
export const YOUGOTIT_FALLBACK_CLUES: string[] = [
  "TOTAL MERKY VIBES",
  "SOMEWHERE IN THE MIDDLE",
  "TRUST THE WAVE",
  "A LITTLE OF BOTH",
  "PURE CHAOS",
  "DEALER'S CHOICE",
  "HONESTLY? UNCLEAR",
  "YOU GOT THIS ONE",
];

export const yougotitPacks: ContentPack[] = [
  {
    id: "yougotit-core",
    gameId: "yougotit",
    titleKey: "games.yougotit.packs.core",
    locale: "en",
    nsfw: false,
    payload: { prompts: YOUGOTIT_CORE_SPECTRA },
  },
  {
    id: "yougotit-afterdark",
    gameId: "yougotit",
    titleKey: "games.yougotit.packs.afterdark",
    locale: "en",
    nsfw: true,
    payload: { prompts: YOUGOTIT_AFTERDARK_SPECTRA },
  },
];
