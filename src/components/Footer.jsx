const GITHUB_URL = 'https://github.com/dldvk9999/GrowupGame';
const CURRENT_YEAR = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="app-footer">
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="app-footer-link">
        🔗 GitHub: dldvk9999/GrowupGame
      </a>
      <span className="app-footer-copyright">© {CURRENT_YEAR} dldvk9999. All rights reserved.</span>
    </footer>
  );
}
