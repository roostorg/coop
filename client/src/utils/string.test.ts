import {
  splitByWhitespaceAndCommas,
  titleCaseEnumString,
  toHumanReadableLabel,
  truncateIdIfNeeded,
} from './string';

describe('String utils tests', () => {
  describe('Split by whitespace and commas', () => {
    it('Split well formatted comma string without whitespace', () => {
      const inputString = '1,2,3,4,5';
      expect(splitByWhitespaceAndCommas(inputString)).toMatchObject([
        '1',
        '2',
        '3',
        '4',
        '5',
      ]);
    });

    it('Split well formatted comma string with spaces', () => {
      const inputString = '1, 2, 3, 4, 5';
      expect(splitByWhitespaceAndCommas(inputString)).toMatchObject([
        '1',
        '2',
        '3',
        '4',
        '5',
      ]);
    });

    it('Split well formatted comma string with newlines', () => {
      const inputString = '1\n2\n3\n4\n5';
      expect(splitByWhitespaceAndCommas(inputString)).toMatchObject([
        '1',
        '2',
        '3',
        '4',
        '5',
      ]);
    });

    it('Split well formatted comma string with commas and spaces and newlines', () => {
      const inputString = ' 1\n ,2         \n3,4\n5';
      expect(splitByWhitespaceAndCommas(inputString)).toMatchObject([
        '1',
        '2',
        '3',
        '4',
        '5',
      ]);
    });

    it('Split multidigit numbers with commas and spaces and newlines', () => {
      const inputString = ' 123\n ,234         \n345,456\n567';
      expect(splitByWhitespaceAndCommas(inputString)).toMatchObject([
        '123',
        '234',
        '345',
        '456',
        '567',
      ]);
    });
  });
  describe('Title case strings', () => {
    it('Title case all lower case string', () => {
      const inputString = 'the_quick_brown_fox_runs_over_the_lazy_dog';
      expect(titleCaseEnumString(inputString)).toEqual(
        'The Quick Brown Fox Runs Over The Lazy Dog',
      );
    });
    it('Title case all upper case string', () => {
      const inputString = 'THE_QUICK_BROWN_FOX_RUNS_OVER_THE_LAZY_DOG';
      expect(titleCaseEnumString(inputString)).toEqual(
        'The Quick Brown Fox Runs Over The Lazy Dog',
      );
    });
    it('Title case random case string', () => {
      const inputString = 'THe_QUiCK_BroWN_fOX_runS_OVer_ThE_lAzY_dOg';
      expect(titleCaseEnumString(inputString)).toEqual(
        'The Quick Brown Fox Runs Over The Lazy Dog',
      );
    });
  });

  describe('To human-readable labels', () => {
    test('camelCase transformation', () =>
      expect(toHumanReadableLabel('camelCaseExample')).toBe(
        'Camel Case Example',
      ));

    test('snake_case transformation', () =>
      expect(toHumanReadableLabel('snake_case_example')).toBe(
        'Snake Case Example',
      ));

    test('space delineated transformation', () =>
      expect(toHumanReadableLabel('space delineated example')).toBe(
        'Space Delineated Example',
      ));

    test('kebab-case transformation', () =>
      expect(toHumanReadableLabel('kebab-case-example')).toBe(
        'Kebab Case Example',
      ));

    test('PascalCase transformation', () =>
      expect(toHumanReadableLabel('PascalCaseExample')).toBe(
        'Pascal Case Example',
      ));

    test('string without specific format', () => {
      expect(toHumanReadableLabel('plainstring')).toBe('Plainstring');
    });
  });

  describe('Truncate ID if necessary', () => {
    test('Truncate empty string', () => {
      expect(truncateIdIfNeeded('', 10)).toBe('');
    });
    test("Don't truncate short string", () => {
      expect(truncateIdIfNeeded('12345', 10)).toBe('12345');
    });
    test('Truncate long string', () => {
      expect(truncateIdIfNeeded('1234567890', 5)).toBe('12345...');
    });
  });
});
