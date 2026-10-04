import type { Country, Region } from "../types";

const R: Record<string, Region> = {
  AF: "Africa",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  SA: "South America",
  OC: "Oceania",
};

/**
 * atlasName|ISO3|Display name|region|subregion (blank = none)
 * Several atlas names may map to the same ISO3 (e.g. Somaliland -> SOM).
 * Atlas features that are not listed here (Antarctica, uninhabited territories) are not playable.
 */
const TABLE = `
Algeria|DZA|Algeria|AF|North Africa
Angola|AGO|Angola|AF|Central Africa
Benin|BEN|Benin|AF|West Africa
Botswana|BWA|Botswana|AF|Southern Africa
Burkina Faso|BFA|Burkina Faso|AF|West Africa
Burundi|BDI|Burundi|AF|East Africa
Cabo Verde|CPV|Cabo Verde|AF|West Africa
Cameroon|CMR|Cameroon|AF|Central Africa
Central African Rep.|CAF|Central African Republic|AF|Central Africa
Chad|TCD|Chad|AF|Central Africa
Comoros|COM|Comoros|AF|East Africa
Congo|COG|Republic of the Congo|AF|Central Africa
Dem. Rep. Congo|COD|DR Congo|AF|Central Africa
Côte d'Ivoire|CIV|Côte d'Ivoire|AF|West Africa
Djibouti|DJI|Djibouti|AF|East Africa
Egypt|EGY|Egypt|AF|North Africa
Eq. Guinea|GNQ|Equatorial Guinea|AF|Central Africa
Eritrea|ERI|Eritrea|AF|East Africa
eSwatini|SWZ|Eswatini|AF|Southern Africa
Ethiopia|ETH|Ethiopia|AF|East Africa
Gabon|GAB|Gabon|AF|Central Africa
Gambia|GMB|The Gambia|AF|West Africa
Ghana|GHA|Ghana|AF|West Africa
Guinea|GIN|Guinea|AF|West Africa
Guinea-Bissau|GNB|Guinea-Bissau|AF|West Africa
Kenya|KEN|Kenya|AF|East Africa
Lesotho|LSO|Lesotho|AF|Southern Africa
Liberia|LBR|Liberia|AF|West Africa
Libya|LBY|Libya|AF|North Africa
Madagascar|MDG|Madagascar|AF|East Africa
Malawi|MWI|Malawi|AF|Southern Africa
Mali|MLI|Mali|AF|West Africa
Mauritania|MRT|Mauritania|AF|West Africa
Mauritius|MUS|Mauritius|AF|East Africa
Morocco|MAR|Morocco|AF|North Africa
Mozambique|MOZ|Mozambique|AF|Southern Africa
Namibia|NAM|Namibia|AF|Southern Africa
Niger|NER|Niger|AF|West Africa
Nigeria|NGA|Nigeria|AF|West Africa
Rwanda|RWA|Rwanda|AF|East Africa
São Tomé and Principe|STP|São Tomé and Príncipe|AF|Central Africa
Senegal|SEN|Senegal|AF|West Africa
Seychelles|SYC|Seychelles|AF|East Africa
Sierra Leone|SLE|Sierra Leone|AF|West Africa
Somalia|SOM|Somalia|AF|East Africa
Somaliland|SOM|Somalia|AF|East Africa
South Africa|ZAF|South Africa|AF|Southern Africa
S. Sudan|SSD|South Sudan|AF|East Africa
Sudan|SDN|Sudan|AF|North Africa
Tanzania|TZA|Tanzania|AF|East Africa
Togo|TGO|Togo|AF|West Africa
Tunisia|TUN|Tunisia|AF|North Africa
Uganda|UGA|Uganda|AF|East Africa
W. Sahara|ESH|Western Sahara|AF|North Africa
Zambia|ZMB|Zambia|AF|Southern Africa
Zimbabwe|ZWE|Zimbabwe|AF|Southern Africa
Saint Helena|SHN|Saint Helena|AF|West Africa
Afghanistan|AFG|Afghanistan|AS|South Asia
Armenia|ARM|Armenia|AS|Caucasus
Azerbaijan|AZE|Azerbaijan|AS|Caucasus
Bahrain|BHR|Bahrain|AS|Middle East
Bangladesh|BGD|Bangladesh|AS|South Asia
Bhutan|BTN|Bhutan|AS|South Asia
Brunei|BRN|Brunei|AS|Southeast Asia
Cambodia|KHM|Cambodia|AS|Southeast Asia
China|CHN|China|AS|East Asia
Georgia|GEO|Georgia|AS|Caucasus
Hong Kong|HKG|Hong Kong|AS|East Asia
Macao|MAC|Macao|AS|East Asia
India|IND|India|AS|South Asia
Indonesia|IDN|Indonesia|AS|Southeast Asia
Iran|IRN|Iran|AS|Middle East
Iraq|IRQ|Iraq|AS|Middle East
Israel|ISR|Israel|AS|Middle East
Japan|JPN|Japan|AS|East Asia
Jordan|JOR|Jordan|AS|Middle East
Kazakhstan|KAZ|Kazakhstan|AS|Central Asia
Kuwait|KWT|Kuwait|AS|Middle East
Kyrgyzstan|KGZ|Kyrgyzstan|AS|Central Asia
Laos|LAO|Laos|AS|Southeast Asia
Lebanon|LBN|Lebanon|AS|Middle East
Malaysia|MYS|Malaysia|AS|Southeast Asia
Maldives|MDV|Maldives|AS|South Asia
Mongolia|MNG|Mongolia|AS|East Asia
Myanmar|MMR|Myanmar|AS|Southeast Asia
Nepal|NPL|Nepal|AS|South Asia
North Korea|PRK|North Korea|AS|East Asia
Oman|OMN|Oman|AS|Middle East
Pakistan|PAK|Pakistan|AS|South Asia
Palestine|PSE|Palestine|AS|Middle East
Philippines|PHL|Philippines|AS|Southeast Asia
Qatar|QAT|Qatar|AS|Middle East
Saudi Arabia|SAU|Saudi Arabia|AS|Middle East
Singapore|SGP|Singapore|AS|Southeast Asia
South Korea|KOR|South Korea|AS|East Asia
Sri Lanka|LKA|Sri Lanka|AS|South Asia
Syria|SYR|Syria|AS|Middle East
Taiwan|TWN|Taiwan|AS|East Asia
Tajikistan|TJK|Tajikistan|AS|Central Asia
Thailand|THA|Thailand|AS|Southeast Asia
Timor-Leste|TLS|Timor-Leste|AS|Southeast Asia
Turkey|TUR|Turkey|AS|Middle East
Turkmenistan|TKM|Turkmenistan|AS|Central Asia
United Arab Emirates|ARE|United Arab Emirates|AS|Middle East
Uzbekistan|UZB|Uzbekistan|AS|Central Asia
Vietnam|VNM|Vietnam|AS|Southeast Asia
Yemen|YEM|Yemen|AS|Middle East
Albania|ALB|Albania|EU|Balkans
Andorra|AND|Andorra|EU|Southern Europe
Austria|AUT|Austria|EU|Western Europe
Belarus|BLR|Belarus|EU|Eastern Europe
Belgium|BEL|Belgium|EU|Western Europe
Bosnia and Herz.|BIH|Bosnia and Herzegovina|EU|Balkans
Bulgaria|BGR|Bulgaria|EU|Balkans
Croatia|HRV|Croatia|EU|Balkans
Cyprus|CYP|Cyprus|EU|Southern Europe
N. Cyprus|CYP|Cyprus|EU|Southern Europe
Czechia|CZE|Czechia|EU|Eastern Europe
Denmark|DNK|Denmark|EU|Northern Europe
Estonia|EST|Estonia|EU|Baltics
Faeroe Is.|FRO|Faroe Islands|EU|Northern Europe
Finland|FIN|Finland|EU|Northern Europe
France|FRA|France|EU|Western Europe
Germany|DEU|Germany|EU|Western Europe
Greece|GRC|Greece|EU|Southern Europe
Hungary|HUN|Hungary|EU|Eastern Europe
Iceland|ISL|Iceland|EU|Northern Europe
Ireland|IRL|Ireland|EU|Northern Europe
Italy|ITA|Italy|EU|Southern Europe
Kosovo|XKX|Kosovo|EU|Balkans
Latvia|LVA|Latvia|EU|Baltics
Liechtenstein|LIE|Liechtenstein|EU|Western Europe
Lithuania|LTU|Lithuania|EU|Baltics
Luxembourg|LUX|Luxembourg|EU|Western Europe
Macedonia|MKD|North Macedonia|EU|Balkans
Malta|MLT|Malta|EU|Southern Europe
Moldova|MDA|Moldova|EU|Eastern Europe
Monaco|MCO|Monaco|EU|Western Europe
Montenegro|MNE|Montenegro|EU|Balkans
Netherlands|NLD|Netherlands|EU|Western Europe
Norway|NOR|Norway|EU|Northern Europe
Poland|POL|Poland|EU|Eastern Europe
Portugal|PRT|Portugal|EU|Southern Europe
Romania|ROU|Romania|EU|Eastern Europe
Russia|RUS|Russia|EU|Eastern Europe
San Marino|SMR|San Marino|EU|Southern Europe
Serbia|SRB|Serbia|EU|Balkans
Slovakia|SVK|Slovakia|EU|Eastern Europe
Slovenia|SVN|Slovenia|EU|Southern Europe
Spain|ESP|Spain|EU|Southern Europe
Sweden|SWE|Sweden|EU|Northern Europe
Switzerland|CHE|Switzerland|EU|Western Europe
Ukraine|UKR|Ukraine|EU|Eastern Europe
United Kingdom|GBR|United Kingdom|EU|Western Europe
Vatican|VAT|Vatican City|EU|Southern Europe
Åland|ALA|Åland|EU|Northern Europe
Jersey|JEY|Jersey|EU|Western Europe
Guernsey|GGY|Guernsey|EU|Western Europe
Isle of Man|IMN|Isle of Man|EU|Western Europe
Antigua and Barb.|ATG|Antigua and Barbuda|NA|Caribbean
Bahamas|BHS|The Bahamas|NA|Caribbean
Barbados|BRB|Barbados|NA|Caribbean
Belize|BLZ|Belize|NA|Central America
Canada|CAN|Canada|NA|
Costa Rica|CRI|Costa Rica|NA|Central America
Cuba|CUB|Cuba|NA|Caribbean
Dominica|DMA|Dominica|NA|Caribbean
Dominican Rep.|DOM|Dominican Republic|NA|Caribbean
El Salvador|SLV|El Salvador|NA|Central America
Grenada|GRD|Grenada|NA|Caribbean
Guatemala|GTM|Guatemala|NA|Central America
Haiti|HTI|Haiti|NA|Caribbean
Honduras|HND|Honduras|NA|Central America
Jamaica|JAM|Jamaica|NA|Caribbean
Mexico|MEX|Mexico|NA|
Nicaragua|NIC|Nicaragua|NA|Central America
Panama|PAN|Panama|NA|Central America
Saint Lucia|LCA|Saint Lucia|NA|Caribbean
St. Kitts and Nevis|KNA|Saint Kitts and Nevis|NA|Caribbean
St. Vin. and Gren.|VCT|Saint Vincent and the Grenadines|NA|Caribbean
Trinidad and Tobago|TTO|Trinidad and Tobago|NA|Caribbean
United States of America|USA|United States|NA|
Greenland|GRL|Greenland|NA|
Puerto Rico|PRI|Puerto Rico|NA|Caribbean
U.S. Virgin Is.|VIR|U.S. Virgin Islands|NA|Caribbean
Anguilla|AIA|Anguilla|NA|Caribbean
Aruba|ABW|Aruba|NA|Caribbean
Bermuda|BMU|Bermuda|NA|
British Virgin Is.|VGB|British Virgin Islands|NA|Caribbean
Cayman Is.|CYM|Cayman Islands|NA|Caribbean
Curaçao|CUW|Curaçao|NA|Caribbean
Montserrat|MSR|Montserrat|NA|Caribbean
Sint Maarten|SXM|Sint Maarten|NA|Caribbean
St-Martin|MAF|Saint Martin|NA|Caribbean
St-Barthélemy|BLM|Saint Barthélemy|NA|Caribbean
Turks and Caicos Is.|TCA|Turks and Caicos Islands|NA|Caribbean
St. Pierre and Miquelon|SPM|Saint Pierre and Miquelon|NA|
Argentina|ARG|Argentina|SA|
Bolivia|BOL|Bolivia|SA|
Brazil|BRA|Brazil|SA|
Chile|CHL|Chile|SA|
Colombia|COL|Colombia|SA|
Ecuador|ECU|Ecuador|SA|
Guyana|GUY|Guyana|SA|
Paraguay|PRY|Paraguay|SA|
Peru|PER|Peru|SA|
Suriname|SUR|Suriname|SA|
Uruguay|URY|Uruguay|SA|
Venezuela|VEN|Venezuela|SA|
Falkland Is.|FLK|Falkland Islands|SA|
Australia|AUS|Australia|OC|
New Zealand|NZL|New Zealand|OC|
Fiji|FJI|Fiji|OC|Melanesia
Papua New Guinea|PNG|Papua New Guinea|OC|Melanesia
Solomon Is.|SLB|Solomon Islands|OC|Melanesia
Vanuatu|VUT|Vanuatu|OC|Melanesia
New Caledonia|NCL|New Caledonia|OC|Melanesia
Samoa|WSM|Samoa|OC|Polynesia
Tonga|TON|Tonga|OC|Polynesia
Niue|NIU|Niue|OC|Polynesia
Cook Is.|COK|Cook Islands|OC|Polynesia
Fr. Polynesia|PYF|French Polynesia|OC|Polynesia
Wallis and Futuna Is.|WLF|Wallis and Futuna|OC|Polynesia
American Samoa|ASM|American Samoa|OC|Polynesia
Pitcairn Is.|PCN|Pitcairn Islands|OC|Polynesia
Kiribati|KIR|Kiribati|OC|Micronesia
Micronesia|FSM|Micronesia|OC|Micronesia
Marshall Is.|MHL|Marshall Islands|OC|Micronesia
Nauru|NRU|Nauru|OC|Micronesia
Palau|PLW|Palau|OC|Micronesia
N. Mariana Is.|MNP|Northern Mariana Islands|OC|Micronesia
Guam|GUM|Guam|OC|Micronesia
Norfolk Island|NFK|Norfolk Island|OC|
`;

const byIso = new Map<string, Country>();
const byAtlasName = new Map<string, Country>();

for (const line of TABLE.trim().split("\n")) {
  const [atlasName, iso3, name, reg, sub] = line.split("|");
  let c = byIso.get(iso3);
  if (!c) {
    c = { iso3, name, region: R[reg], subregion: sub ? sub : null, atlasNames: [] };
    byIso.set(iso3, c);
  }
  c.atlasNames.push(atlasName);
  byAtlasName.set(atlasName, c);
}

export const COUNTRIES: readonly Country[] = [...byIso.values()];

export function countryByIso(iso3: string): Country | undefined {
  return byIso.get(iso3);
}

export function countryByAtlasName(atlasName: string): Country | undefined {
  return byAtlasName.get(atlasName);
}

export const REGIONS: readonly Region[] = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];
