function isPrivateIpv4(hostname) {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
}

function isLocalDevelopmentOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:') return false;
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return hostname === 'localhost' || hostname === '::1' || hostname === '127.0.0.1' || isPrivateIpv4(hostname);
  } catch {
    return false;
  }
}

function parseAllowedOrigins(value = '') {
  return new Set(value.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    try {
      const url = new URL(item);
      return url.origin;
    } catch {
      return '';
    }
  }).filter(Boolean));
}

function createCorsOptions(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const configuredOrigins = parseAllowedOrigins(env.CORS_ORIGINS);
  return {
    origin(origin, callback) {
      if (!origin || configuredOrigins.has(origin)) return callback(null, true);
      if (!production && isLocalDevelopmentOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
  };
}

module.exports = { createCorsOptions, isLocalDevelopmentOrigin, parseAllowedOrigins };
