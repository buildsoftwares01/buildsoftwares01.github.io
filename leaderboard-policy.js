// Imported by both the browser and Cloudflare Worker. The server always checks names.
export const blockedFragments = [
  'fuck', 'fuk', 'fck', 'fcuk', 'fucc', 'motherf', 'bitch', 'asshole', 'arsehole', 'bullshit', 'shithead',
  'nigger', 'nigga', 'faggot', 'whore', 'porn', 'putain', 'pute', 'salope',
  'connard', 'connasse', 'encul', 'merde', 'chier', 'bougnoul', 'gogot',
  'gopia', 'kokar', 'chutmar', 'bhosdi', 'madarchod', 'bhenchod', 'behenchod', 'chutiya', 'salaud',
];
// Match short words as complete words/names, avoiding e.g. Cassandra and Scunthorpe.
export const blockedWords = ['ass', 'arse', 'shit', 'sh1t', 'cunt', 'dick', 'cock', 'cum', 'sex', 'slut', 'fag', 'con', 'cul', 'bite', 'piss', 'paki', 'pede', 'randi'];
export const collapseLetters = value => value.replace(/(.)\1+/g, '$1');
const leet = value => value.replace(/[01345789]/g, c => ({ 0:'o', 1:'i', 3:'e', 4:'a', 5:'s', 7:'t', 8:'b', 9:'g' }[c]));
export function validateName(input) {
  if (typeof input !== 'string') return { error: 'Please enter a friendly name.' };
  const name = input.normalize('NFKC').replace(/^ +| +$/g, '').replace(/ +/g, ' ');
  if (name.length < 2 || name.length > 20 || !/^[A-Za-zÀ-ÖØ-öø-ÿŒœ0-9 '\-]+$/.test(name)) {
    return { error: 'Use 2–20 letters, numbers, spaces, apostrophes or hyphens.' };
  }
  const plain = name.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ø/g, 'o');
  if ((plain.match(/[a-z]/g) || []).length < 2) return { error: 'Please include at least two letters.' };
  const unnumbered = plain.replace(/\b\d+|\d+\b/g, '');
  const joined = plain.replace(/[^a-z0-9]/g, '').replace(/^\d+|\d+$/g, '');
  const forms = [plain, leet(plain), unnumbered, leet(unnumbered), joined, leet(joined)];
  for (const form of forms) {
    const compact = collapseLetters(form.replace(/[^a-z0-9]/g, ''));
    const words = form.split(/[^a-z0-9]+/).map(collapseLetters);
    if (blockedFragments.some(word => compact.includes(collapseLetters(word))) ||
        blockedWords.some(word => words.includes(collapseLetters(word)) || compact === collapseLetters(word))) {
      return { error: 'Please choose a different, family-friendly name.' };
    }
  }
  return { name };
}

export const gameRules = {
  taptaptap: { name: 'Tap Tap Tap', max: 10000000 },
  flappy: { name: 'Safari Flyer', max: 10000 },
  hextris: { name: 'Hextris', max: 10000000 },
  ohhi: { name: '0h h1', max: 7200000 },
};
export function validBoard(game, board) {
  return Object.hasOwn(gameRules, game) && Number.isInteger(board) && (game === 'ohhi' ? [4, 6, 8, 10].includes(board) : board === 0);
}
export function validScore(game, board, score) {
  return validBoard(game, board) && Number.isInteger(score) && score >= (game === 'ohhi' ? 1000 : 0) && score <= gameRules[game].max;
}
export function formatScore(game, score) {
  if (game !== 'ohhi') return `${score.toLocaleString('en-GB')} pts`;
  return `${Math.floor(score / 60000)}:${String(Math.floor(score / 1000) % 60).padStart(2, '0')}.${Math.floor(score % 1000 / 100)}`;
}
