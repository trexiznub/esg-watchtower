import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './state/store';
import { Shell, Toasts } from './components/Shell';
import Landing from './pages/Landing';
import Overview from './pages/Overview';
import Watchlist from './pages/Watchlist';
import News from './pages/News';
import Risk from './pages/Risk';
import Tracker from './pages/Tracker';
import Analytics from './pages/Analytics';
import Digest from './pages/Digest';
import Settings from './pages/Settings';

/* HashRouter keeps every route behind "#", so GitHub Pages only ever serves index.html.
   Deep links and reloads work at any repository path without a 404 fallback. */
export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<Shell />}>
            <Route path="/overview" element={<Overview />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/news" element={<News />} />
            <Route path="/risk" element={<Risk />} />
            <Route path="/tracker" element={<Tracker />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/digest" element={<Digest />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <Toasts />
    </StoreProvider>
  );
}
