// Paynamics field-validation response codes (FR series) returned in notification/
// response payloads. Maps code -> human-readable message for logging and support.

export interface PaynamicsResponseCodeInfo {
  code: string;
  title: string;
  message: string;
}

export const PAYNAMICS_RESPONSE_CODES: Record<string, PaynamicsResponseCodeInfo> = {
  FR001: { code: 'FR001', title: 'Invalid Request_id format', message: 'Request id is not in alpha numeric characters or the Length < 32' },
  FR002: { code: 'FR002', title: 'Invalid Amount format', message: 'Amount is not in numeric characters or the Length is incorrect' },
  FR003: { code: 'FR003', title: 'Invalid First name format', message: 'First name is not in alpha characters or the Length < 30' },
  FR004: { code: 'FR004', title: 'Invalid Last name format', message: 'Last name is not in alpha characters or the Length < 32' },
  FR005: { code: 'FR005', title: 'Invalid Addr 1 format', message: 'Addr 1 is not alpha numeric special characters or the Length < 100' },
  FR006: { code: 'FR006', title: 'Invalid Addr 2 format', message: 'Addr 2 is not in alpha numeric special characters or the Length < 100' },
  FR007: { code: 'FR007', title: 'Invalid State format', message: 'State is not alpha characters or the Length < 30' },
  FR008: { code: 'FR008', title: 'Invalid City format', message: 'City is not alpha characters or the Length < 30' },
  FR009: { code: 'FR009', title: 'Invalid ZipCode format', message: 'ZipCode is not alpha numeric characters or the Length < 12' },
  FR010: { code: 'FR010', title: 'Invalid I.P. Address format', message: 'Ip address is not in alpha numeric special characters or the Length < 20' },
  FR011: { code: 'FR011', title: 'Invalid Exp month format', message: 'Expiry month is not numeric characters or the Length < 2' },
  FR012: { code: 'FR012', title: 'Invalid Exp Year format', message: 'Expiry Year is not numeric characters or the Length < 4' },
  FR013: { code: 'FR013', title: 'Invalid Phone format', message: 'Phone Format is invalid. Format should be country code (area code) phone number. Sample: 1(240) 652-5009' },
  FR014: { code: 'FR014', title: 'Invalid Date and Time Format', message: 'Date and Time format is incorrect. Format should be YYYY-MM-DD HH:MM:SS:000. Sample: 2010-03-23 18:06:44.493' },
  FR015: { code: 'FR015', title: 'Invalid email format', message: 'Email Format is incorrect. This should be character@character.character' },
  FR016: { code: 'FR016', title: 'Invalid notification url format', message: 'URL format is not valid. Format should be http://domain.com or https://domain.com' },
  FR017: { code: 'FR017', title: 'Invalid Card Number', message: 'Card Number is invalid. For Visa, Mastercard, JCB, card number should be 16 digits. AMEX should be 15 digits.' },
  FR018: { code: 'FR018', title: 'Invalid Luhn Check Sum', message: 'Card number submitted did not pass the Luhn formula' },
  FR019: { code: 'FR019', title: 'Invalid Card Type', message: 'Card type is not valid for this Merchant ID/Merchant Account.' },
  FR020: { code: 'FR020', title: 'Invalid Client_id format', message: 'Client_id format is not valid' },
  FR021: { code: 'FR021', title: 'Invalid Client_token format', message: 'Client_token format is not valid' },
  FR022: { code: 'FR022', title: 'Invalid Rebill Period', message: 'The rebill period sent is not defined in the Paygate System.' },
  FR023: { code: 'FR023', title: 'ABA/Account number length mismatch', message: 'ABA is X and length of account number is not Y' },
  FR024: { code: 'FR024', title: 'ABA/Account number prefix mismatch', message: 'ABA is X and account number does not start with Y' },
  FR025: { code: 'FR025', title: 'Account number too long', message: 'Account number length should not be greater than 17 characters.' },
  FR026: { code: 'FR026', title: 'Invalid Account number numerals', message: 'Account number contains invalid numerals (i.e. 123456)' },
  FR027: { code: 'FR027', title: 'Invalid Fractional Length', message: 'Parameter passed on the Fractional length was not valid.' },
  FR028: { code: 'FR028', title: 'Invalid ABA number', message: 'ABA number provided was invalid.' },
  FR029: { code: 'FR029', title: 'Invalid Fractional', message: 'Invalid Fractional' },
  FR030: { code: 'FR030', title: 'Missing Fields – ACH', message: 'Request contains missing fields (i.e. processtype, parent_id, mersubid, accttype, consumername, accountname, host_ip, or client_ip, etc)' },
  FR031: { code: 'FR031', title: 'Missing Country Parameter', message: 'The country parameter is required for the transaction to proceed.' },
  FR032: { code: 'FR032', title: 'Invalid Request Fields Format', message: 'Request contains invalid field or value (i.e. request_id, accountnumber, fname, lname, city, address1, etc). May also be an acquiring processor/host format restriction.' },
  FR033: { code: 'FR033', title: 'Invalid parameter values', message: 'Transaction request contains values that did not follow certain logic conditions. Contact Paynamics Technical support to investigate further.' },
  FR034: { code: 'FR034', title: 'Invalid notification payload', message: 'Notification payload has incorrect format or data objects that do not exist or were not passed by merchant.' },
  FR035: { code: 'FR035', title: 'Parameter value too long', message: 'The length of the value for parameter is longer than the maximum limit. Refer to response advise for details.' },
  FR036: { code: 'FR036', title: 'Invalid Request Format', message: 'The request submitted has an invalid format. Refer to API documentation for proper request format.' },
  FR037: { code: 'FR037', title: 'Invalid Request Id', message: 'The response code submitted to update transaction is not existing on request id list.' },
  FR038: { code: 'FR038', title: 'Invalid Expiry Limit', message: 'Expiry limit has an invalid value. Possible reason is invalid date or date provided already passed.' },
  FR039: { code: 'FR039', title: 'Reference Number Already Exists', message: 'The reference number provided already exists on record. Provide a unique reference number and try again.' },
  FR040: { code: 'FR040', title: 'No Reference Number Provided', message: 'The merchant linked to this transaction requires its own reference number but none was given. Provide a unique reference number and try again.' },
  FR041: { code: 'FR041', title: 'Invalid Mobile format', message: 'Mobile is not in alpha numeric characters or the Length < 32' },
  FR042: { code: 'FR042', title: 'Invalid ClientIp format', message: 'Client IP is not in alpha numeric characters or the Length < 40' },
  FR043: { code: 'FR043', title: 'Invalid 3D Secure format', message: '3D Secure Policy is not in alpha numeric characters or the Length < 20' },
  FR044: { code: 'FR044', title: 'Invalid Original Request Id format', message: 'Original Request Id is not in alpha numeric characters or the Length < 32' },
  FR045: { code: 'FR045', title: 'Invalid ClientId format', message: 'Client Id is not in alpha numeric characters or the Length < 32' },
  FR046: { code: 'FR046', title: 'No Idempotency Key Found', message: 'Provide Idempotency-Key value on request header.' },
  FR047: { code: 'FR047', title: 'Invalid Idempotency Key', message: 'Idempotency key must equal Request ID.' },
  FR048: { code: 'FR048', title: 'Invalid Original Gateway Id format', message: 'Original Gateway Id is not in alpha numeric characters or the Length < 32' },
  FR049: { code: 'FR049', title: 'Invalid responseUrl format', message: 'URL format is not valid. Format should contain http:// or https:// at the beginning of the address.' },
};

/** Codes that represent a successful transaction result, as opposed to an FR validation failure. */
export const PAYNAMICS_SUCCESS_RESPONSE_CODES = new Set(['00', '0']);

export function getPaynamicsResponseCodeInfo(code: string | null | undefined): PaynamicsResponseCodeInfo | null {
  if (!code) return null;
  return PAYNAMICS_RESPONSE_CODES[code.toUpperCase()] ?? null;
}

export function isPaynamicsSuccessCode(code: string | null | undefined): boolean {
  return !!code && PAYNAMICS_SUCCESS_RESPONSE_CODES.has(code);
}

export function isPaynamicsValidationError(code: string | null | undefined): boolean {
  return !!code && /^FR\d{3}$/i.test(code);
}
