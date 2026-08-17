/**
 * Runs before first paint to apply the stored or preferred theme.
 * Without this, the page flashes light before hydration.
 */
export function ThemeScript() {
  const script =
    "(function(){try{var t=localStorage.getItem('theme');" +
    "var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;" +
    'if(d)document.documentElement.classList.add("dark")}catch(e){}})();'

  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
