import { isValidEmailFormat } from './emailFormat';

describe('isValidEmailFormat', () => {
  it.each([
    'user@example.com',
    'user.name@mail.ru',
    'user_name@mail.ru',
    'delivered+ivan@resend.dev',
    'user!#$%&\'*+-/=?^_`{|}~@x.co'
  ])('accepts %s', (email) => {
    expect(isValidEmailFormat(email)).toBe(true);
  });

  it.each([
    '',
    'user',
    'user@localhost',
    'user@@mail.ru',
    '.user@mail.ru',
    'user.@mail.ru',
    'user..name@mail.ru',
    'кирилл@mail.ru',
    'user name@mail.ru',
    'user@mail.ru.'
  ])('rejects %s', (email) => {
    expect(isValidEmailFormat(email)).toBe(false);
  });
});
