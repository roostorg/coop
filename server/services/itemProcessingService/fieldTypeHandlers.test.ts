import {
  ContainerTypes,
  isContainerType,
  ScalarTypes,
  type ContainerType,
  type Field,
  type ScalarType,
} from '@roostorg/coop-types';
import fc from 'fast-check';

import { FieldArbitrary } from '../../test/arbitraries/ContentType.js';
import {
  detectMediaKindFromUrl,
  fieldTypeHandlers,
} from './fieldTypeHandlers.js';

describe('Content type schemas', () => {
  describe('fieldTypeHandlers', () => {
    describe('IP_ADDRESS', () => {
      const { coerce } = fieldTypeHandlers[ScalarTypes.IP_ADDRESS];

      test('accepts valid IPv4 addresses', () => {
        expect(coerce('192.0.2.1', [])).toBe('192.0.2.1');
        expect(coerce('203.0.113.255', [])).toBe('203.0.113.255');
      });

      test('accepts valid IPv6 addresses', () => {
        expect(coerce('2001:db8::1', [])).toBe('2001:db8::1');
        expect(coerce('::1', [])).toBe('::1');
      });

      test('treats empty / whitespace-only strings as field omitted (returns null)', () => {
        expect(coerce('', [])).toBeNull();
        expect(coerce('   ', [])).toBeNull();
        expect(coerce('\t\n', [])).toBeNull();
      });

      test('strips leading/trailing whitespace before validating', () => {
        expect(coerce(' 192.0.2.1', [])).toBe('192.0.2.1');
        expect(coerce('192.0.2.1 ', [])).toBe('192.0.2.1');
        expect(coerce(' 2600:1700:10f0:6d60:7007:c2c9:d164:bb47', [])).toBe(
          '2600:1700:10f0:6d60:7007:c2c9:d164:bb47',
        );
      });

      test('rejects malformed IPs and non-string inputs', () => {
        expect(coerce('not-an-ip', [])).toBeInstanceOf(Error);
        expect(coerce('999.999.999.999', [])).toBeInstanceOf(Error);
        expect(coerce('192.0.2.1 extra', [])).toBeInstanceOf(Error);
        expect(coerce(42, [])).toBeInstanceOf(Error);
        expect(coerce({ ip: '192.0.2.1' }, [])).toBeInstanceOf(Error);
      });
    });

    test('should never accept null as a valid field value', () => {
      for (const [fieldType, handlers] of Object.entries(fieldTypeHandlers)) {
        if (!isContainerType(fieldType as keyof typeof fieldTypeHandlers)) {
          expect(
            (handlers as (typeof fieldTypeHandlers)[ScalarType]).coerce(
              null,
              [],
            ),
          ).toBeInstanceOf(Error);
        } else {
          const dummyContainerFieldArb = FieldArbitrary.filter(
            (it) => it.type === fieldType,
          ) as fc.Arbitrary<Field<ContainerType>>;

          fc.assert(
            fc.property(dummyContainerFieldArb, (containerField) => {
              expect(
                (handlers as (typeof fieldTypeHandlers)[ContainerType]).coerce(
                  null,
                  [],
                  containerField.container as never,
                ),
              ).toBeInstanceOf(Error);
            }),
          );
        }
      }

      // Check in values of container types too.
      expect(
        fieldTypeHandlers[ContainerTypes.MAP].coerce({ hello: null }, [], {
          containerType: ContainerTypes.MAP,
          keyScalarType: ScalarTypes.STRING,
          valueScalarType: ScalarTypes.STRING,
        }),
      ).toBeInstanceOf(Error);
      expect(
        fieldTypeHandlers[ContainerTypes.ARRAY].coerce([null], [], {
          containerType: ContainerTypes.ARRAY,
          keyScalarType: null,
          valueScalarType: ScalarTypes.STRING,
        }),
      ).toBeInstanceOf(Error);
    });
  });

  describe('MEDIA coercion', () => {
    const { coerce } = fieldTypeHandlers[ScalarTypes.MEDIA];

    test.each([
      ['https://example.com/cat.jpg', ScalarTypes.IMAGE],
      ['https://example.com/cat.JPG', ScalarTypes.IMAGE],
      ['https://example.com/photo.jpeg', ScalarTypes.IMAGE],
      ['https://example.com/anim.gif', ScalarTypes.IMAGE],
      ['https://example.com/pic.webp', ScalarTypes.IMAGE],
      ['https://example.com/clip.mp4', ScalarTypes.VIDEO],
      ['https://example.com/clip.mov', ScalarTypes.VIDEO],
      ['https://example.com/clip.webm', ScalarTypes.VIDEO],
      ['https://example.com/song.mp3', ScalarTypes.AUDIO],
      ['https://example.com/song.m4a', ScalarTypes.AUDIO],
      ['https://example.com/song.wav', ScalarTypes.AUDIO],
    ])('resolves %s to mediaType=%s', (url, expectedKind) => {
      expect(coerce(url, [])).toEqual({ url, mediaType: expectedKind });
    });

    test.each([
      // Ambiguous container — .ogg can be audio or video; stay unresolved.
      'https://example.com/song.ogg',
      // No extension.
      'https://example.com/profile/123',
      // Unknown extension.
      'https://example.com/file.xyz',
      // Trailing dot.
      'https://example.com/file.',
    ])('returns mediaType=null for unresolved URL %s', (url) => {
      expect(coerce(url, [])).toEqual({ url, mediaType: null });
    });

    test('treats empty string as missing (returns null)', () => {
      expect(coerce('', [])).toBeNull();
    });

    test.each([
      ['not a url', 'invalid string'],
      // eslint-disable-next-line no-script-url -- testing that a javascript: URL is rejected
      ['javascript:alert(1)', 'blocked scheme'],
      ['ftp://example.com/x.mp3', 'unsupported scheme'],
    ])('rejects %s (%s)', (url) => {
      expect(coerce(url, [])).toBeInstanceOf(Error);
    });

    test.each([42, true, {}, []])('rejects non-string input %p', (value) => {
      expect(coerce(value, [])).toBeInstanceOf(Error);
    });

    test('keeps the original URL casing in the returned object', () => {
      expect(coerce('https://example.com/cat.PNG?v=2', [])).toEqual({
        url: 'https://example.com/cat.PNG?v=2',
        mediaType: ScalarTypes.IMAGE,
      });
    });
  });

  describe('detectMediaKindFromUrl', () => {
    test('returns null for unparseable URL', () => {
      expect(detectMediaKindFromUrl('not a url')).toBeNull();
    });

    test('uses the last dot in the pathname', () => {
      expect(
        detectMediaKindFromUrl('https://example.com/path.with.dots/file.mp4'),
      ).toBe(ScalarTypes.VIDEO);
    });

    test('ignores extensions in the query string', () => {
      expect(
        detectMediaKindFromUrl('https://example.com/foo?x=y.mp4'),
      ).toBeNull();
    });
  });
});
