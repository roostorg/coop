import { fireEvent, render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';

import ItemTypeForm from './ItemTypeForm';

vi.mock('../../../graphql/generated', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../graphql/generated')>();
  const mutation = () => [vi.fn(), { loading: false }];

  return {
    ...actual,
    useGQLCreateContentTypeMutation: mutation,
    useGQLCreateThreadTypeMutation: mutation,
    useGQLCreateUserTypeMutation: mutation,
    useGQLUpdateContentTypeMutation: mutation,
    useGQLUpdateThreadTypeMutation: mutation,
    useGQLUpdateUserTypeMutation: mutation,
    useGQLItemTypeFormOrgQuery: () => ({ loading: false }),
    useGQLItemTypeQuery: () => ({ loading: false }),
    useGQLPermissionGatedRouteLoggedInUserQuery: () => ({
      loading: false,
      data: { me: { permissions: [] } },
    }),
  };
});

vi.mock('./ItemTypeFormRightPanel', () => ({ default: () => null }));

test('gives stable unique names to the native text inputs', () => {
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/dashboard/settings/item_types/form']}>
        <ItemTypeForm />
      </MemoryRouter>
    </HelmetProvider>,
  );

  expect(screen.getByPlaceholderText('Name').getAttribute('name')).toBe(
    'item-type-name',
  );
  expect(
    screen.getByPlaceholderText('Description (optional)').getAttribute('name'),
  ).toBe('item-type-description');
  expect(screen.getByPlaceholderText('Field Name').getAttribute('name')).toBe(
    'item-type-field-0-name',
  );

  fireEvent.click(screen.getByRole('button', { name: /add field/i }));

  const fieldNameInputs = screen.getAllByPlaceholderText('Field Name');
  expect(fieldNameInputs).toHaveLength(2);
  expect(fieldNameInputs[0].getAttribute('name')).toBe(
    'item-type-field-0-name',
  );
  expect(fieldNameInputs[1].getAttribute('name')).toBe(
    'item-type-field-1-name',
  );
});
