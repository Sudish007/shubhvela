// Settings -> Location for Today (spec F5: the band is computed at the profile's current location, GPS or chosen
// city). 'city' = the self profile's place (default, no permission); 'gps' = coarse device location, asked for only
// when Today next computes. The note states that the location never leaves the phone.
import { useState } from 'react';
import { getSetting, setSetting, type LocationMode } from '../../src/db/settings';
import { useLang } from '../../src/i18n';
import { ChoiceScreen } from '../../src/settings/ChoiceScreen';
import { LOCATION_KEY } from '../../src/settingsLabels';

const ORDER: readonly LocationMode[] = ['city', 'gps'];

export default function LocationScreen() {
  const { t } = useLang();
  const [value, setValue] = useState<LocationMode>(() => getSetting('locationMode'));
  return (
    <ChoiceScreen<LocationMode>
      title={t('settings.location')}
      note={t('settings.locationNote')}
      choices={ORDER.map((v) => ({ value: v, label: t(LOCATION_KEY[v]) }))}
      value={value}
      onChange={(v) => {
        setSetting('locationMode', v);
        setValue(v);
      }}
      testID="location-screen"
    />
  );
}
