import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from 'libphonenumber-js';

export interface PaymentProject {
  project_name: string;
  project_id: number;
  merchant_id: string | null;
}

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'PH';
export const SUPPORTED_PHONE_COUNTRIES = getCountries();
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export const PHONE_COUNTRY_OPTIONS = SUPPORTED_PHONE_COUNTRIES.map((iso) => {
  const name = regionNames.of(iso) || iso;
  const dialPrefix = getDialingPrefix(iso);
  const flag = iso
    .toUpperCase()
    .replace(/./g, (character) => String.fromCodePoint(127397 + character.charCodeAt(0)));
  return { iso, name, dialPrefix, flag };
}).sort((a, b) => a.name.localeCompare(b.name));

export function searchPhoneCountries(query: string) {
  const normalized = query.trim().toLowerCase();
  return PHONE_COUNTRY_OPTIONS.filter((option) => (
    !normalized ||
    option.name.toLowerCase().includes(normalized) ||
    option.iso.toLowerCase().includes(normalized) ||
    option.dialPrefix.includes(normalized.replace(/\s/g, ''))
  ));
}

export function isSupportedPhoneCountry(value: string): boolean {
  return SUPPORTED_PHONE_COUNTRIES.includes(value as CountryCode);
}

export function getDialingPrefix(country: CountryCode): string {
  return `+${getCountryCallingCode(country)}`;
}

export type PhoneLengthInfo = {
  supportedLengths: number[];
  min: number;
  max: number;
};

const phoneLengthCache = new Map<CountryCode, PhoneLengthInfo>();

export function getPhoneLengthInfo(country: CountryCode): PhoneLengthInfo {
  const cached = phoneLengthCache.get(country);
  if (cached) return cached;

  const supportedLengths = country === 'PH'
    ? [10]
    : Array.from({ length: 15 }, (_, index) => index + 1).filter(
      (length) => validatePhoneNumberLength('2'.repeat(length), country) === undefined
    );
  const reliableLengths = supportedLengths.length > 0 ? supportedLengths : [15];
  const info = {
    supportedLengths: reliableLengths,
    min: reliableLengths[0],
    max: reliableLengths[reliableLengths.length - 1],
  };
  phoneLengthCache.set(country, info);
  return info;
}

export function countPhoneDigits(value: string): number {
  return value.replace(/\D/g, '').length;
}

export function wouldExceedPhoneDigitLimit(
  currentValue: string,
  selectedValue: string,
  insertedValue: string,
  country: CountryCode
): boolean {
  const nextDigitCount = countPhoneDigits(currentValue)
    - countPhoneDigits(selectedValue)
    + countPhoneDigits(insertedValue);
  return nextDigitCount > getPhoneLengthInfo(country).max;
}

export function getPhoneLengthHint(value: string, country: CountryCode): string {
  const count = countPhoneDigits(value);
  const { supportedLengths, min, max } = getPhoneLengthInfo(country);
  if (min === max) return `${count} / ${max} digits`;

  const consecutive = supportedLengths.every(
    (length, index) => index === 0 || length === supportedLengths[index - 1] + 1
  );
  const supported = consecutive
    ? `${min}–${max}`
    : supportedLengths.join(', ');
  return `${count} digits · supported ${supported}`;
}

function formatNationalInput(country: CountryCode, value: string): string {
  let digits = value.replace(/\D/g, '');
  if (country === 'PH' && digits.startsWith('0')) digits = digits.slice(1);
  return new AsYouType(country).input(digits);
}

export function normalizePhoneInput(
  value: string,
  selectedCountry: CountryCode
): { country: CountryCode; input: string } {
  const trimmed = value.trim();
  if (!trimmed) return { country: selectedCountry, input: '' };

  const international = trimmed.startsWith('+')
    ? trimmed
    : trimmed.startsWith('00')
      ? `+${trimmed.slice(2)}`
      : null;

  if (international) {
    let parsed = parsePhoneNumberFromString(international);
    const internationalDigits = international.replace(/\D/g, '');
    const selectedCallingCode = getCountryCallingCode(selectedCountry);
    if (
      parsed &&
      !parsed.isValid() &&
      internationalDigits.startsWith(`${selectedCallingCode}${selectedCallingCode}`)
    ) {
      parsed = parsePhoneNumberFromString(
        `+${selectedCallingCode}${internationalDigits.slice(selectedCallingCode.length * 2)}`
      );
    }
    if (parsed?.country) {
      return {
        country: parsed.country,
        input: formatNationalInput(parsed.country, parsed.nationalNumber),
      };
    }
  }

  let digits = trimmed.replace(/\D/g, '');
  if (selectedCountry === 'PH' && digits.startsWith('0')) digits = digits.slice(1);
  const callingCode = getCountryCallingCode(selectedCountry);
  if (digits.startsWith(callingCode) && digits.length > callingCode.length + 4) {
    const parsed = parsePhoneNumberFromString(`+${digits}`);
    if (parsed?.country === selectedCountry) {
      return {
        country: selectedCountry,
        input: formatNationalInput(selectedCountry, parsed.nationalNumber),
      };
    }
  }

  const localParsed = parsePhoneNumberFromString(digits, selectedCountry);
  if (localParsed?.country && (
    localParsed.country === selectedCountry ||
    getCountryCallingCode(localParsed.country) === callingCode
  )) {
    return {
      country: selectedCountry,
      input: formatNationalInput(selectedCountry, localParsed.nationalNumber),
    };
  }

  return {
    country: selectedCountry,
    input: formatNationalInput(selectedCountry, digits),
  };
}

export function getPhoneValidationError(value: string, country: CountryCode): string | null {
  if (!value.trim()) return 'Mobile number is required';
  const normalized = normalizePhoneInput(value, country);
  const digitCount = countPhoneDigits(normalized.input);
  const { max } = getPhoneLengthInfo(country);
  if (digitCount > max) return `Use at most ${max} digits`;
  if (country === 'PH' && !normalized.input.replace(/\D/g, '').startsWith('9')) {
    return 'Philippine mobile numbers must begin with 9';
  }
  const parsed = parsePhoneNumberFromString(value, country);
  const compatibleCountry = parsed?.country && (
    parsed.country === country ||
    getCountryCallingCode(parsed.country) === getCountryCallingCode(country)
  );
  if (!parsed || !compatibleCountry || !parsed.isValid()) {
    return `Enter a valid ${country} phone number`;
  }
  return null;
}

export function toE164PhoneNumber(value: string, country: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(value, country);
  const compatibleCountry = parsed?.country && (
    parsed.country === country ||
    getCountryCallingCode(parsed.country) === getCountryCallingCode(country)
  );
  return compatibleCountry && parsed.isValid() ? parsed.number : null;
}

export function normalizeServerContactNumber(value: string): string | null {
  const legacyPhilippine = /^09\d{9}$/.test(value)
    ? parsePhoneNumberFromString(value, 'PH')
    : null;
  const parsed = legacyPhilippine || parsePhoneNumberFromString(value);
  return parsed?.isValid() ? parsed.number : null;
}

export function getProjectMerchantId(
  projectId: string,
  projects: PaymentProject[]
): string | null {
  if (!projectId) return null;
  return projects.find((project) => String(project.project_id) === projectId)?.merchant_id ?? null;
}
