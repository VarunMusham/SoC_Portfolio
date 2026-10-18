import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import IpPage from './pages/IpPage';

// The SoC map stays mounted under the docs, so pages open from and close back into the live scene.
export default function App() {
  return (
    <>
      <Landing />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/ip/:slug" element={<IpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
