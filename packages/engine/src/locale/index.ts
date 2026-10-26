// Locale name tables for the engine (plan.md section 2, module `locale`).
// Weekday, Gregorian month, lunar month, sign, nakshatra, planet, tithi, yoga, karana and paksha names
// in en / hi / bho, plus the planet glyphs used inside the chart SVG. Digits are always Latin (design 7).
// Register: Hindi = standard Khari Boli; Bhojpuri = respectful standard register in Devanagari, following the
// forms used by the design mocks (_i18n-today.js: बियफे, सुक, एतवार, आसिन, कातिक, सतभिखा). Every Bhojpuri string
// is subject to the owner's Bhojpuri review like all bho UI strings (design 7).

export type Lang = 'en' | 'hi' | 'bho';
export const LANGS: readonly Lang[] = ['en', 'hi', 'bho'];

export type PlanetId = 'Su' | 'Mo' | 'Ma' | 'Me' | 'Ju' | 'Ve' | 'Sa' | 'Ra' | 'Ke';
export const PLANET_IDS: readonly PlanetId[] = ['Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];

/** English keys used by the vendored jyotish fork for each planet id. */
export const PLANET_KEYS: Record<PlanetId, 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu'> = {
  Su: 'Sun',
  Mo: 'Moon',
  Ma: 'Mars',
  Me: 'Mercury',
  Ju: 'Jupiter',
  Ve: 'Venus',
  Sa: 'Saturn',
  Ra: 'Rahu',
  Ke: 'Ketu',
};

export function planetIdFromKey(key: string): PlanetId | undefined {
  return (Object.keys(PLANET_KEYS) as PlanetId[]).find((id) => PLANET_KEYS[id] === key);
}

// ---- Weekdays (0 = Sunday, as Date#getUTCDay) ----
export const weekdayNames: Record<Lang, readonly string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
  bho: ['एतवार', 'सोमार', 'मंगर', 'बुध', 'बियफे', 'सुक', 'सनिचर'],
};
export const weekdayShort: Record<Lang, readonly string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  hi: ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
  bho: ['एतवार', 'सोम', 'मंगर', 'बुध', 'बियफे', 'सुक', 'सनिचर'],
};

// ---- Gregorian months (0 = January) ----
export const monthNames: Record<Lang, readonly string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  bho: ['जनवरी', 'फरवरी', 'मार्च', 'अप्रिल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
};
export const monthShort: Record<Lang, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi: ['जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुला', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'],
  bho: ['जन', 'फर', 'मार्च', 'अप्रि', 'मई', 'जून', 'जुला', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'],
};

// ---- Lunar months (0 = Chaitra). The same twelve names serve Purnimanta and Amanta reckoning;
// the two systems differ in which month a date belongs to, not in the names. ----
export const lunarMonthNames: Record<Lang, readonly string[]> = {
  en: ['Chaitra', 'Vaishakha', 'Jyeshtha', 'Ashadha', 'Shravana', 'Bhadrapada', 'Ashwin', 'Kartik', 'Margashirsha', 'Pausha', 'Magha', 'Phalguna'],
  hi: ['चैत्र', 'वैशाख', 'ज्येष्ठ', 'आषाढ़', 'श्रावण', 'भाद्रपद', 'आश्विन', 'कार्तिक', 'मार्गशीर्ष', 'पौष', 'माघ', 'फाल्गुन'],
  bho: ['चइत', 'बइसाख', 'जेठ', 'असाढ़', 'सावन', 'भादो', 'आसिन', 'कातिक', 'अगहन', 'पूस', 'माघ', 'फागुन'],
};
export const adhikLabel: Record<Lang, string> = { en: 'Adhik', hi: 'अधिक', bho: 'अधिक' };

// ---- Signs (0 = Mesha / Aries). English uses the Sanskrit names as in the design mocks; the Western
// names are available separately for glossary cross-references. ----
export const signNames: Record<Lang, readonly string[]> = {
  en: ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'],
  hi: ['मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या', 'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुंभ', 'मीन'],
  bho: ['मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या', 'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुंभ', 'मीन'],
};
export const signNamesWestern: readonly string[] = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

// ---- Nakshatras (0 = Ashwini) ----
export const nakshatraNames: Record<Lang, readonly string[]> = {
  en: [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
    'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
  ],
  hi: [
    'अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा', 'आर्द्रा', 'पुनर्वसु', 'पुष्य', 'आश्लेषा',
    'मघा', 'पूर्वा फाल्गुनी', 'उत्तरा फाल्गुनी', 'हस्त', 'चित्रा', 'स्वाति', 'विशाखा', 'अनुराधा', 'ज्येष्ठा',
    'मूल', 'पूर्वाषाढ़ा', 'उत्तराषाढ़ा', 'श्रवण', 'धनिष्ठा', 'शतभिषा', 'पूर्वभाद्रपदा', 'उत्तरभाद्रपदा', 'रेवती',
  ],
  bho: [
    'अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा', 'आर्द्रा', 'पुनर्वसु', 'पुष्य', 'आश्लेषा',
    'मघा', 'पूर्वा फाल्गुनी', 'उत्तरा फाल्गुनी', 'हस्त', 'चित्रा', 'स्वाति', 'विशाखा', 'अनुराधा', 'ज्येष्ठा',
    'मूल', 'पूर्वाषाढ़ा', 'उत्तराषाढ़ा', 'श्रवण', 'धनिष्ठा', 'सतभिखा', 'पूर्वभाद्रपदा', 'उत्तरभाद्रपदा', 'रेवती',
  ],
};
/** Short forms for narrow table columns (design 4: "P. Bhadrapada 4"). */
export const nakshatraShort: Record<Lang, readonly string[]> = {
  en: nakshatraNames.en.map((n) => n.replace(/^Purva /, 'P. ').replace(/^Uttara /, 'U. ')),
  hi: nakshatraNames.hi.map(shortDevanagari),
  bho: nakshatraNames.bho.map(shortDevanagari),
};

/**
 * पूर्वाषाढ़ा / उत्तराषाढ़ा are sandhi forms (पूर्व + आषाढ़ा): the vowel sign ा after व belongs to the second word, so the
 * abbreviation must restore the independent आ ("पू. आषाढ़ा"), not leave a bare sign ("पू. ाषाढ़ा" - the A02 output, fixed
 * by the Phase A fixer). पूर्वभाद्रपदा / उत्तरभाद्रपदा are plain compounds -> "पू. भाद्रपदा".
 */
function shortDevanagari(n: string): string {
  return n
    .replace(/^पूर्वा /, 'पू. ')
    .replace(/^उत्तरा /, 'उ. ')
    .replace(/^पूर्वा(?=ष)/, 'पू. आ')
    .replace(/^उत्तरा(?=ष)/, 'उ. आ')
    .replace(/^पूर्व/, 'पू. ')
    .replace(/^उत्तर/, 'उ. ');
}

// ---- Planets ----
export const planetNames: Record<Lang, Record<PlanetId, string>> = {
  en: { Su: 'Sun', Mo: 'Moon', Ma: 'Mars', Me: 'Mercury', Ju: 'Jupiter', Ve: 'Venus', Sa: 'Saturn', Ra: 'Rahu', Ke: 'Ketu' },
  hi: { Su: 'सूर्य', Mo: 'चंद्र', Ma: 'मंगल', Me: 'बुध', Ju: 'गुरु', Ve: 'शुक्र', Sa: 'शनि', Ra: 'राहु', Ke: 'केतु' },
  bho: { Su: 'सूर्य', Mo: 'चंद्र', Ma: 'मंगल', Me: 'बुध', Ju: 'गुरु', Ve: 'शुक्र', Sa: 'शनि', Ra: 'राहु', Ke: 'केतु' },
};
export const lagnaName: Record<Lang, string> = { en: 'Lagna', hi: 'लग्न', bho: 'लग्न' };

/** Chart glyphs (design 4): Latin two-letter and Devanagari short forms. */
export const planetGlyphs: Record<'latin' | 'devanagari', Record<PlanetId, string>> = {
  latin: { Su: 'Su', Mo: 'Mo', Ma: 'Ma', Me: 'Me', Ju: 'Ju', Ve: 'Ve', Sa: 'Sa', Ra: 'Ra', Ke: 'Ke' },
  devanagari: { Su: 'सू', Mo: 'चं', Ma: 'मं', Me: 'बु', Ju: 'गु', Ve: 'शु', Sa: 'श', Ra: 'रा', Ke: 'के' },
};
export function glyphScript(lang: Lang): 'latin' | 'devanagari' {
  return lang === 'en' ? 'latin' : 'devanagari';
}

// ---- Tithis (0 = Shukla Pratipada ... 14 = Purnima, 15 = Krishna Pratipada ... 29 = Amavasya) ----
const tithiBase: Record<Lang, readonly string[]> = {
  en: ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi'],
  hi: ['प्रतिपदा', 'द्वितीया', 'तृतीया', 'चतुर्थी', 'पंचमी', 'षष्ठी', 'सप्तमी', 'अष्टमी', 'नवमी', 'दशमी', 'एकादशी', 'द्वादशी', 'त्रयोदशी', 'चतुर्दशी'],
  bho: ['प्रतिपदा', 'द्वितीया', 'तृतीया', 'चतुर्थी', 'पंचमी', 'षष्ठी', 'सप्तमी', 'अष्टमी', 'नवमी', 'दशमी', 'एकादशी', 'द्वादशी', 'त्रयोदशी', 'चतुर्दशी'],
};
export const purnimaName: Record<Lang, string> = { en: 'Purnima', hi: 'पूर्णिमा', bho: 'पूर्णिमा' };
export const amavasyaName: Record<Lang, string> = { en: 'Amavasya', hi: 'अमावस्या', bho: 'अमावस्या' };
export const tithiNames: Record<Lang, readonly string[]> = {
  en: [...tithiBase.en, purnimaName.en, ...tithiBase.en, amavasyaName.en],
  hi: [...tithiBase.hi, purnimaName.hi, ...tithiBase.hi, amavasyaName.hi],
  bho: [...tithiBase.bho, purnimaName.bho, ...tithiBase.bho, amavasyaName.bho],
};
export const pakshaNames: Record<Lang, readonly [string, string]> = {
  en: ['Shukla', 'Krishna'],
  hi: ['शुक्ल', 'कृष्ण'],
  bho: ['शुक्ल', 'कृष्ण'],
};

// ---- Yogas (0 = Vishkambha) ----
export const yogaNames: Record<Lang, readonly string[]> = {
  en: [
    'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula',
    'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan',
    'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti',
  ],
  hi: [
    'विष्कुम्भ', 'प्रीति', 'आयुष्मान', 'सौभाग्य', 'शोभन', 'अतिगण्ड', 'सुकर्मा', 'धृति', 'शूल',
    'गण्ड', 'वृद्धि', 'ध्रुव', 'व्याघात', 'हर्षण', 'वज्र', 'सिद्धि', 'व्यतीपात', 'वरीयान',
    'परिघ', 'शिव', 'सिद्ध', 'साध्य', 'शुभ', 'शुक्ल', 'ब्रह्म', 'इन्द्र', 'वैधृति',
  ],
  bho: [
    'विष्कुम्भ', 'प्रीति', 'आयुष्मान', 'सौभाग्य', 'शोभन', 'अतिगण्ड', 'सुकर्मा', 'धृति', 'शूल',
    'गण्ड', 'वृद्धि', 'ध्रुव', 'व्याघात', 'हर्षण', 'वज्र', 'सिद्धि', 'व्यतीपात', 'वरीयान',
    'परिघ', 'शिव', 'सिद्ध', 'साध्य', 'शुभ', 'शुक्ल', 'ब्रह्म', 'इन्द्र', 'वैधृति',
  ],
};

// ---- Karanas: 7 repeating (0-6) + 4 fixed (7-10) ----
export const karanaNames: Record<Lang, readonly string[]> = {
  en: ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti', 'Shakuni', 'Chatushpada', 'Naga', 'Kimstughna'],
  hi: ['बव', 'बालव', 'कौलव', 'तैतिल', 'गर', 'वणिज', 'विष्टि', 'शकुनि', 'चतुष्पद', 'नाग', 'किंस्तुघ्न'],
  bho: ['बव', 'बालव', 'कौलव', 'तैतिल', 'गर', 'वणिज', 'विष्टि', 'शकुनि', 'चतुष्पद', 'नाग', 'किंस्तुघ्न'],
};
/** Vishti karana is Bhadra; the UI appends this in brackets (design mocks: "Vishti (Bhadra)"). */
export const bhadraName: Record<Lang, string> = { en: 'Bhadra', hi: 'भद्रा', bho: 'भद्रा' };

/** Sign lord as a planet id (0 = Mesha). */
export const SIGN_LORDS: readonly PlanetId[] = ['Ma', 'Ve', 'Me', 'Mo', 'Su', 'Me', 'Ve', 'Ma', 'Ju', 'Sa', 'Sa', 'Ju'];

/** Latin-digit zero padding helper shared by formatters (design 7: Latin digits only). */
export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
