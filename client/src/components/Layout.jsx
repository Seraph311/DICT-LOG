import TopBar from './TopBar.jsx';

export default function Layout({ children }) {
  return (
    <div className="app">
      <TopBar />

      <main className="page">{children}</main>

      <footer className="footer">
        <span>DICT Camarines Norte Provincial Office</span>
        <span>Academic prototype — synthetic data only</span>
      </footer>
    </div>
  );
}
