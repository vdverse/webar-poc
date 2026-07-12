import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>WebAR PoC</h1>
      <p>
        <Link to="/dev/ar-proof">Open the AR proof of concept</Link>
      </p>
      <p>
        <Link to="/login">Sign in</Link> · <Link to="/register">Create an account</Link>
      </p>
    </main>
  );
}
