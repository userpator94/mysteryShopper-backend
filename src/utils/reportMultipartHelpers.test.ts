import { extractBoundaryFromBody, ensureMultipartContentType } from './reportMultipartHelpers';

describe('extractBoundaryFromBody', () => {
  it('извлекает boundary с начала тела (WebKit)', () => {
    const line = '------WebKitFormBoundaryVIpdmKgpdaf2N2LE\r\n';
    const buf = Buffer.from(line, 'latin1');
    expect(extractBoundaryFromBody(buf)).toBe('----WebKitFormBoundaryVIpdmKgpdaf2N2LE');
  });

  it('извлекает boundary после CRLF (preamble)', () => {
    const raw = 'preamble\r\n--abc123boundary\r\n';
    const buf = Buffer.from(raw, 'latin1');
    expect(extractBoundaryFromBody(buf)).toBe('abc123boundary');
  });

  it('возвращает null для слишком короткого буфера', () => {
    expect(extractBoundaryFromBody(Buffer.from('ab'))).toBeNull();
  });
});

describe('ensureMultipartContentType', () => {
  it('не меняет заголовок при корректном multipart и boundary', () => {
    const req = {
      headers: {
        'content-type': 'multipart/form-data; boundary=----X'
      }
    };
    const buf = Buffer.from('------X\r\n', 'latin1');
    ensureMultipartContentType(req, buf);
    expect(req.headers['content-type']).toBe('multipart/form-data; boundary=----X');
  });

  it('подставляет boundary из тела если Content-Type пустой', () => {
    const req = { headers: {} as Record<string, string | undefined> };
    const buf = Buffer.from('------B\r\n', 'latin1');
    ensureMultipartContentType(req, buf);
    expect(req.headers['content-type']).toBe('multipart/form-data; boundary=----B');
  });

  it('бросает MULTIPART_BOUNDARY_MISSING если нельзя восстановить boundary', () => {
    const req = { headers: {} as Record<string, string | undefined> };
    const buf = Buffer.from('not multipart', 'utf8');
    expect(() => ensureMultipartContentType(req, buf)).toThrow('MULTIPART_BOUNDARY_MISSING');
  });
});
