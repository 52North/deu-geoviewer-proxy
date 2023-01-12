export default (words) => {
  const permutations = new Set();
  words.forEach((word) => {
    const letters = word.split("");
    const permCount = 1 << word.length;
    for (let perm = 0; perm < permCount; perm++) {
      letters.reduce((perm, letter, i) => {
        letters[i] = perm & 1 ? letter.toUpperCase() : letter.toLowerCase();
        return perm >> 1;
      }, perm);
      permutations.add(letters.join(""));
    }
  });
  return [...permutations];
};
