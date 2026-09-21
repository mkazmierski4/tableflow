import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Root HTML for the static web build. The body colour matches the theme before JS runs,
// so there is no white flash on dark systems.
const CSS = `
body { background-color: #F6F7FB; }
@media (prefers-color-scheme: dark) { body { background-color: #0B1220; } }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>TableFlow</title>
        <meta name="description" content="Book a table in seconds." />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
