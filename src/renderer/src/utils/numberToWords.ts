/**
 * Convert a number to French words
 * Used for printing amounts on cash vouchers
 */
export function numberToFrenchWords(num: number): string {
  if (num === 0) return 'zéro'

  const ones = [
    '',
    'un',
    'deux',
    'trois',
    'quatre',
    'cinq',
    'six',
    'sept',
    'huit',
    'neuf',
    'dix',
    'onze',
    'douze',
    'treize',
    'quatorze',
    'quinze',
    'seize',
    'dix-sept',
    'dix-huit',
    'dix-neuf'
  ]

  const tens = [
    '',
    '',
    'vingt',
    'trente',
    'quarante',
    'cinquante',
    'soixante',
    'soixante-dix',
    'quatre-vingt',
    'quatre-vingt-dix'
  ]

  function convertLessThanThousand(n: number): string {
    if (n === 0) return ''
    if (n < 20) return ones[n]

    if (n < 100) {
      const ten = Math.floor(n / 10)
      const one = n % 10

      if (ten === 7 || ten === 9) {
        // Special cases: 70-79, 90-99
        return tens[ten - 1] + '-' + ones[10 + one]
      }

      if (one === 0) return tens[ten]
      if (one === 1 && ten === 8) return 'quatre-vingt-un'
      return tens[ten] + (one === 1 && ten !== 8 ? '-et-un' : '-' + ones[one])
    }

    const hundred = Math.floor(n / 100)
    const rest = n % 100

    let result = hundred === 1 ? 'cent' : ones[hundred] + ' cent'
    if (hundred > 1 && rest === 0) result += 's'
    if (rest > 0) result += ' ' + convertLessThanThousand(rest)

    return result
  }

  function convert(n: number): string {
    if (n === 0) return 'zéro'

    const million = Math.floor(n / 1000000)
    const thousand = Math.floor((n % 1000000) / 1000)
    const remainder = n % 1000

    let result = ''

    if (million > 0) {
      result += convertLessThanThousand(million) + ' million'
      if (million > 1) result += 's'
    }

    if (thousand > 0) {
      if (result) result += ' '
      if (thousand === 1) {
        result += 'mille'
      } else {
        result += convertLessThanThousand(thousand) + ' mille'
      }
    }

    if (remainder > 0) {
      if (result) result += ' '
      result += convertLessThanThousand(remainder)
    }

    return result
  }

  return convert(Math.floor(num))
}
