import { multipartTextField } from './multipartBodyFields';

describe('multipartTextField', () => {
  it('возвращает пустую строку для undefined/null', () => {
    expect(multipartTextField(undefined)).toBe('');
    expect(multipartTextField(null)).toBe('');
  });

  it('обрезает пробелы у строки', () => {
    expect(multipartTextField('  uuid  ')).toBe('uuid');
  });

  it('берёт первый элемент массива', () => {
    expect(multipartTextField(['first', 'second'])).toBe('first');
  });

  it('декодирует Buffer как utf8', () => {
    expect(multipartTextField(Buffer.from('привет', 'utf8'))).toBe('привет');
  });
});
