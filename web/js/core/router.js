/**
 * Tiny History-API router (PRD §106). Routes are declared as
 * `{ path, view, title }` where `path` supports `:params`.
 */

function compile(pattern) {
  const names = [];
  const source = pattern
    .replace(/\/$/, '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:(\w+)/g, (_, name) => {
      names.push(name);
      return '([^/]+)';
    });
  return { regex: new RegExp(`^${source || '/'}/?$`), names };
}

export class Router {
  constructor(routes, { onChange, notFound } = {}) {
    this.routes = routes.map((route) => ({ ...route, ...compile(route.path) }));
    this.onChange = onChange;
    this.notFound = notFound;
    this.current = null;

    window.addEventListener('popstate', () => this._resolve(location.pathname + location.search));
    document.addEventListener('click', (event) => this._intercept(event));
  }

  start() {
    this._resolve(location.pathname + location.search, { replace: true });
  }

  navigate(path, { replace = false } = {}) {
    const [pathname, search = ''] = path.split('?');
    const target = pathname + (search ? `?${search}` : '');
    if (replace) history.replaceState({}, '', target);
    else history.pushState({}, '', target);
    this._resolve(target);
  }

  match(pathname) {
    for (const route of this.routes) {
      const m = route.regex.exec(pathname);
      if (m) {
        const params = {};
        route.names.forEach((name, i) => {
          params[name] = decodeURIComponent(m[i + 1]);
        });
        return { route, params };
      }
    }
    return null;
  }

  isActive(path) {
    if (!this.current) return false;
    const clean = path.replace(/\/$/, '') || '/';
    const here = this.current.path.replace(/\/$/, '') || '/';
    if (clean === '/') return here === '/';
    return here === clean || here.startsWith(`${clean}/`);
  }

  _resolve(url, { replace = false } = {}) {
    const [pathname, search = ''] = url.split('?');
    const query = Object.fromEntries(new URLSearchParams(search));
    const matched = this.match(pathname);
    const entry = matched
      ? { path: pathname, route: matched.route, params: matched.params, query }
      : { path: pathname, route: this.notFound, params: {}, query };

    const changed = !this.current || this.current.path !== pathname || search !== this.current.search;
    if (!changed && !replace) return;

    this.current = { ...entry, search };
    this.onChange?.(entry);
  }

  _intercept(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a[data-link]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('//') || anchor.target === '_blank') return;
    event.preventDefault();
    this.navigate(href);
  }
}
