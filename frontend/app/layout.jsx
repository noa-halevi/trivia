import '../styles/globals.css';

export const metadata = {
  title: 'TRIVIUM',
  description: 'Real-time multiplayer trivia',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
