export function seededRandom(seed: string) {
  const hashFromSeed = seed.split('').reduce(function (a, b) {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
  // Adapted from http://indiegamr.com/generate-repeatable-random-numbers-in-js/
  const x = Math.sin(hashFromSeed) * 10000;
  return x - Math.floor(x);
}
