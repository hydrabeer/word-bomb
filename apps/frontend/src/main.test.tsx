import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import React from 'react';

// Stub page components so the routes render lightweight elements
vi.mock('./pages/HomePage.tsx', () => ({
  default: () => React.createElement('div', null, 'Home'),
}));
vi.mock('./pages/RoomRoute.tsx', () => ({
  default: () => React.createElement('div', null, 'RoomRoute'),
}));
vi.mock('./pages/NotFoundPage.tsx', () => ({
  default: () => React.createElement('div', null, 'NotFound'),
}));
vi.mock('./pages/DisconnectedPage.tsx', () => ({
  default: () => React.createElement('div', null, 'Disconnected'),
}));

// Spy on ReactDOM.createRoot and the render call
let renderSpy: ReturnType<typeof vi.fn>;
const createRootSpy = vi.fn(
  () =>
    ({ render: renderSpy }) as unknown as {
      render: (el: React.ReactNode) => void;
    },
);

vi.mock('react-dom/client', () => ({
  createRoot: createRootSpy,
}));

beforeEach(() => {
  renderSpy = vi.fn();
  // fresh root element per test
  document.body.innerHTML = '<div id="root"></div>';
  createRootSpy.mockClear();
});

afterEach(() => {
  // ensure module side-effects re-run cleanly between tests
  vi.resetModules();
});

test('mounts app into #root and calls render with the router tree', async () => {
  const rootEl = document.getElementById('root');
  expect(rootEl).not.toBeNull();

  // Import runs the module and triggers createRoot(...).render(...)
  await import('./main');

  expect(createRootSpy).toHaveBeenCalledTimes(1);
  expect(createRootSpy).toHaveBeenCalledWith(rootEl);
  expect(renderSpy).toHaveBeenCalledTimes(1);
});
