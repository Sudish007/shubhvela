// UI + web string keys the kundli client bundle needs; the template embeds exactly these (per language) as JSON.
export const CLIENT_KEYS = [
  'common.approx', 'common.approxMinutes', 'common.why', 'common.howComputed',
  'onboarding.genderFemale', 'onboarding.genderMale', 'onboarding.genderSkip',
  'settings.ayanamsa.lahiri', 'settings.ayanamsa.kp', 'settings.ayanamsa.raman', 'settings.nodes.mean', 'settings.nodes.true',
  'charts.styleNorth', 'charts.styleSouth', 'charts.styleEast', 'charts.lagna', 'charts.planet_col', 'charts.sign_col', 'charts.nakshatra_col',
  'charts.chartA11yHouse', 'charts.chartA11yEmpty', 'charts.houseSystem.whole-sign',
  'dignity.exalted', 'dignity.debilitated', 'dignity.own', 'dignity.friend', 'dignity.enemy', 'dignity.neutral', 'dignity.combust', 'dignity.retro', 'dignity.vargottama', 'dignity.approx',
  'dasha.balance',
  'yogas.found_one', 'yogas.found_other',
  ...['ruchaka', 'bhadra', 'hamsa', 'malavya', 'sasa', 'gaja-kesari', 'budhaditya', 'chandra-mangala', 'sunapha', 'anapha', 'durudhara', 'kemadruma', 'vesi', 'vasi', 'ubhayachari', 'adhi', 'vasumati', 'amala', 'saraswati', 'lakshmi', 'shakata', 'guru-chandala', 'kala-sarpa', 'neecha-bhanga-raja', 'harsha', 'sarala', 'vimala', 'dhana-2-11', 'raja-kendra-trikona', 'dharma-karmadhipati', 'parivartana'].map((id) => `yogas.name.${id}`),
  'form.noPlace', 'form.searching', 'form.onlineFailed', 'form.needPlace', 'form.errorTitle', 'form.placePicked', 'form.placeResults', 'form.linkError', 'form.linkErrorDate',
  'onboarding.dateError', 'onboarding.timeError', 'onboarding.nameError',
  'result.computing', 'result.d1Title', 'result.d1TitleAnon', 'result.moonTitle', 'result.moonTitleAnon', 'result.bornLine', 'result.bornLineUnknown', 'result.placeCoords',
  'result.lagnaRow', 'result.lagnaApproxNote', 'result.lagnaNote', 'result.moonUnknownNote', 'result.moonRow', 'result.moonNote', 'result.moonNoteApprox',
  'result.yogasRow', 'result.yogasNone', 'result.yogaCancelled', 'result.rulesOnTap', 'result.copied', 'result.copyFailed', 'result.whyA11y', 'result.a11yChart',
  'detail.now', 'detail.next', 'detail.mahadasha', 'detail.antardasha', 'detail.balance',
  'computed.text', 'computed.library',
  'why.rule', 'why.source', 'why.inputs', 'why.loading', 'why.unavailable', 'why.close', 'why.convention',
  'm.invalid',
];

/** Keys the data-pages bundle (city picker recompute) needs per page kind; the template embeds exactly these as #i18n. */
export const DATA_CLIENT_KEYS = {
  festival: ['data.pickedCity', 'panchang.sunriseSunset', 'panchang.moonriseMoonset', 'mini.none', 'today.noSun'],
  muhurat: [
    'muhurat.rulesMet', 'muhurat.notMet', 'muhurat.allPanchangMet', 'muhurat.night_tag', 'muhurat.clipped', 'muhurat.noneThisMonth', 'muhurat.windowsH',
    ...['tithi', 'nakshatra', 'vara', 'chandra-bala', 'tara-bala', 'rahu-kaal', 'bhadra', 'panchak', 'abhijit', 'choghadiya'].map((r) => `muhurat.rule.${r}`),
    ...['amrit', 'chal', 'kaal', 'labh', 'rog', 'shubh', 'udveg'].map((c) => `band.chog.${c}`),
  ],
  vrat: [
    'common.till', 'events.tithiDate', 'panchang.krishna', 'panchang.shukla',
    'vrat.nextH', 'vrat.howComputed', 'vrat.vaishnavaLabel', 'vrat.hariVasaraLabel', 'vrat.chhath.nahayKhay', 'vrat.chhath.kharna', 'vrat.chhath.ushaArghya', 'vrat.angaraki',
    ...['ghatasthapana', 'ghatasthapana-abhijit', 'madhyahna', 'moonrise', 'nishita', 'parana', 'pradosh', 'sandhya', 'sunrise', 'sunset-to-sunrise'].map((k) => `vrat.time.${k}`),
    ...['amavasya', 'chhath', 'ekadashi-aja', 'ekadashi-amalaki', 'ekadashi-apara', 'ekadashi-devshayani', 'ekadashi-devutthana', 'ekadashi-indira', 'ekadashi-jaya', 'ekadashi-kamada', 'ekadashi-kamika', 'ekadashi-mohini', 'ekadashi-mokshada', 'ekadashi-nirjala', 'ekadashi-padmini', 'ekadashi-papankusha', 'ekadashi-papmochani', 'ekadashi-parama', 'ekadashi-parivartini', 'ekadashi-pausha-putrada', 'ekadashi-rama', 'ekadashi-saphala', 'ekadashi-shattila', 'ekadashi-shravana-putrada', 'ekadashi-utpanna', 'ekadashi-varuthini', 'ekadashi-vijaya', 'ekadashi-yogini', 'karwa-chauth', 'masik-shivaratri', 'navratri-chaitra', 'navratri-sharad', 'pradosh-bhauma', 'pradosh-bhrigu', 'pradosh-guru', 'pradosh-ravi', 'pradosh-saumya', 'pradosh-shani', 'pradosh-soma', 'purnima', 'sankashti', 'sankashti-angaraki', 'satyanarayan', 'teej-hariyali', 'teej-hartalika', 'teej-kajari', 'vinayaka-chaturthi'].map((n) => `vrat.name.${n}`),
  ],
};
export const ALL_DATA_CLIENT_KEYS = [...new Set([...DATA_CLIENT_KEYS.festival, ...DATA_CLIENT_KEYS.muhurat, ...DATA_CLIENT_KEYS.vrat])];
