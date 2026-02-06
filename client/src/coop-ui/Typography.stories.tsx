import { Heading, Text } from '@/coop-ui/Typography';
import { Meta } from '@storybook/react';
import React from 'react';

export default {
  title: 'Components/Typography',
  component: Text,
} as Meta;

const sizes = [
  'XXS',
  'XS',
  'SM',
  'base',
  'LG',
  'XL',
  '2XL',
  '3XL',
  '4XL',
  '5XL',
] as const;
const weights = ['regular', 'medium', 'semibold', 'bold'] as const;

export const TextVariants = () => {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          minWidth: '600px',
          textAlign: 'left',
        }}
      >
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>
              Size \ Weight
            </th>
            {weights.map((weight) => (
              <th
                key={weight}
                style={{ borderBottom: '1px solid #ccc', padding: '8px' }}
              >
                {weight}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sizes.map((size) => (
            <tr key={size}>
              <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                {size}
              </td>
              {weights.map((weight) => (
                <td
                  key={weight}
                  style={{ borderBottom: '1px solid #eee', padding: '8px' }}
                >
                  <Text size={size} weight={weight}>
                    The quick brown fox jumps over the lazy dog.
                  </Text>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const HeadingVariants = () => {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          minWidth: '600px',
          textAlign: 'left',
        }}
      >
        <thead>
          <tr>
            <th style={{ borderBottom: '1px solid #ccc', padding: '8px' }}>
              Size \ Weight
            </th>
            {weights.map((weight) => (
              <th
                key={weight}
                style={{ borderBottom: '1px solid #ccc', padding: '8px' }}
              >
                {weight}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sizes.map((size) => (
            <tr key={size}>
              <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>
                {size}
              </td>
              {weights.map((weight) => (
                <td
                  key={weight}
                  style={{ borderBottom: '1px solid #eee', padding: '8px' }}
                >
                  <Heading size={size} weight={weight}>
                    The quick brown fox jumps over the lazy dog.
                  </Heading>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
