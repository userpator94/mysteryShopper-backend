import { getAllowedOrigins, isOriginAllowed } from './cors';

describe('getAllowedOrigins', () => {
  it('parses a single origin', () => {
    expect(getAllowedOrigins('https://b2bfb.ru')).toEqual(['https://b2bfb.ru']);
  });

  it('parses a comma-separated list with spaces', () => {
    expect(
      getAllowedOrigins(
        'https://b2bfb.ru, https://www.b2bfb.ru ,https://77-222-43-250.swtest.ru'
      )
    ).toEqual([
      'https://b2bfb.ru',
      'https://www.b2bfb.ru',
      'https://77-222-43-250.swtest.ru'
    ]);
  });

  it('returns the default when the variable is empty or unset', () => {
    expect(getAllowedOrigins(undefined)).toEqual(['http://localhost:3000']);
    expect(getAllowedOrigins('')).toEqual(['http://localhost:3000']);
    expect(getAllowedOrigins('   ')).toEqual(['http://localhost:3000']);
  });

  it('strips trailing slashes', () => {
    expect(getAllowedOrigins('https://b2bfb.ru/')).toEqual(['https://b2bfb.ru']);
    expect(getAllowedOrigins('https://b2bfb.ru/, https://www.b2bfb.ru///')).toEqual([
      'https://b2bfb.ru',
      'https://www.b2bfb.ru'
    ]);
  });
});

describe('isOriginAllowed', () => {
  const allowed = [
    'https://b2bfb.ru',
    'https://www.b2bfb.ru',
    'https://77-222-43-250.swtest.ru'
  ];

  it('allows requests without Origin', () => {
    expect(isOriginAllowed(undefined, allowed)).toBe(true);
  });

  it('allows origins in the allowlist', () => {
    expect(isOriginAllowed('https://b2bfb.ru', allowed)).toBe(true);
  });

  it('rejects an invalid origin', () => {
    expect(isOriginAllowed('https://evil.example', allowed)).toBe(false);
  });
});
