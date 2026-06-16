import Flags from 'country-flag-icons/react/3x2'

const COUNTRY_CODES = {
  'Argentina': 'ar', 'Brasil': 'br', 'Uruguay': 'uy', 'Colombia': 'co',
  'Ecuador': 'ec', 'Paraguay': 'py', 'Peru': 'pe', 'Chile': 'cl',
  'Bolivia': 'bo', 'Venezuela': 've', 'Mexico': 'mx', 'USA': 'us',
  'United States': 'us', 'South Korea': 'kr', 'Korea Republic': 'kr',
  'Canada': 'ca', 'Costa Rica': 'cr', 'Panama': 'pa', 'Honduras': 'hn',
  'Jamaica': 'jm', 'El Salvador': 'sv', 'Haiti': 'ht',
  'Germany': 'de', 'Espana': 'es', 'Spain': 'es', 'Francia': 'fr',
  'France': 'fr', 'Inglaterra': 'gb-eng', 'England': 'gb-eng',
  'Italia': 'it', 'Italy': 'it', 'Portugal': 'pt', 'Paises Bajos': 'nl',
  'Netherlands': 'nl', 'Belgica': 'be', 'Belgium': 'be',
  'Croacia': 'hr', 'Croatia': 'hr', 'Suiza': 'ch', 'Switzerland': 'ch',
  'Dinamarca': 'dk', 'Denmark': 'dk', 'Serbia': 'rs', 'Polonia': 'pl',
  'Poland': 'pl', 'Escocia': 'gb-sct', 'Scotland': 'gb-sct',
  'Gales': 'gb-wls', 'Wales': 'gb-wls',
  'Japon': 'jp', 'Japan': 'jp', 'Australia': 'au',
  'Arabia Saudita': 'sa', 'Saudi Arabia': 'sa', 'Iran': 'ir', 'Qatar': 'qa',
  'Uzbekistan': 'uz', 'Marruecos': 'ma', 'Morocco': 'ma', 'Senegal': 'sn',
  'Camerun': 'cm', 'Nigeria': 'ng', 'Ghana': 'gh', 'Tunez': 'tn',
  'Tunisia': 'tn', 'Egipto': 'eg', 'Egypt': 'eg',
  'Nueva Zelanda': 'nz', 'New Zealand': 'nz',
  'South Africa': 'za', 'Czechia': 'cz', 'Czech Republic': 'cz',
  'Bosnia-Herzegovina': 'ba', 'Bosnia and Herzegovina': 'ba',
  'Curacao': 'cw', 'Curaçao': 'cw', 'Cape Verde Islands': 'cv',
  'Cabo Verde': 'cv', 'Scotland': 'gb-sct', 'Iceland': 'is',
  'Norway': 'no', 'Noruega': 'no', 'Austria': 'at', 'Austria': 'at',
  'Algeria': 'dz', 'Algeria': 'dz', 'Jordan': 'jo', 'Jordania': 'jo',
  'Iraq': 'iq', 'Irak': 'iq', 'China': 'cn', 'PR China': 'cn',
  'Ivory Coast': 'ci', 'Costa de Marfil': 'ci', 'Congo DR': 'cd',
  'DR Congo': 'cd', 'Gabon': 'ga', 'Burkina Faso': 'bf', 'Zambia': 'zm',
  'Zimbabwe': 'zw', 'Albania': 'al', 'Armenia': 'am', 'Azerbaijan': 'az',
  ' Belarus': 'by', 'Bolivia': 'bo', 'Bulgaria': 'bg', 'Cyprus': 'cy',
  'Czechia': 'cz',
}

export function getCountryCode(country) {
  if (!country) return null
  const lookup = country.toLowerCase()
  for (const [name, code] of Object.entries(COUNTRY_CODES)) {
    if (lookup === name.toLowerCase() ||
        lookup.includes(name.toLowerCase()) ||
        name.toLowerCase().includes(lookup)) {
      return code
    }
  }
  return null
}

export function getFlagUrl(country, width = 40) {
  const code = getCountryCode(country)
  if (!code) return null
  return `https://flagcdn.com/w${width}/${code}.png`
}

export function Flag({ country, size = 24, className = '' }) {
  const code    = getCountryCode(country)
  const isoCode = code ? code.split('-')[0].toUpperCase() : null
  const FlagSvg = isoCode ? Flags[isoCode] : null

  // Fallback: iniciales del código ISO o primeras 2 letras del nombre
  const initials = isoCode ?? (country ? country.slice(0, 2).toUpperCase() : '?')

  if (!FlagSvg) {
    return (
      <span
        className={`inline-flex items-center justify-center bg-iron-200 dark:bg-iron-700 rounded text-iron-500 dark:text-iron-300 font-bold ${className}`}
        style={{ width: size, height: Math.round(size * 0.67), fontSize: Math.round(size * 0.38) }}
      >
        {initials}
      </span>
    )
  }

  return (
    <FlagSvg
      title={country}
      className={`inline-block rounded-sm shadow-sm ${className}`}
      style={{ height: size, width: 'auto' }}
    />
  )
}

export function getFlag(country) {
  const code = getCountryCode(country)
  return code ? code.toUpperCase() : '??'
}