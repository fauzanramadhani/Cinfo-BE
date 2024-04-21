const isValidHex = (input) => {
  // Periksa apakah input adalah string
  if (typeof input !== "string") {
    return false;
  }

  // Periksa apakah panjang string adalah 24 karakter
  if (input.length !== 24) {
    return false;
  }

  // Periksa apakah input terdiri dari karakter heksadesimal (0-9, a-f, A-F)
  const hexRegex = /^[0-9a-fA-F]+$/;
  if (!hexRegex.test(input)) {
    return false;
  }

  return true;
};

module.exports = { isValidHex };
