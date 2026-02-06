import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './Drawer';

describe('Drawer', () => {
  // https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it('should render the Drawer component and open/close properly', async () => {
    render(
      <Drawer>
        <DrawerTrigger asChild>
          <div>Open Drawer</div>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Drawer Title</DrawerTitle>
            <DrawerDescription>
              This is a description for the drawer content.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4">
            <p>Here is some content inside the drawer.</p>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <div>Close Drawer</div>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>,
    );

    expect(screen.queryByText('Drawer Title')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Open Drawer'));

    await waitFor(() => {
      expect(screen.getByText('Drawer Title')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Close Drawer'));

    await waitFor(() => {
      expect(screen.queryByText('Drawer Title')).not.toBeInTheDocument();
    });
  });
});
