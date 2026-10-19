import { Navigate, Route, Routes } from 'react-router-dom';
import Diagram from './pages/Diagram';
import IpPage from './pages/IpPage';

// The diagram stays mounted under the docs, so pages open from and close back into their block.
export default function App() {
  return (
    <>
      <Diagram />
      <Routes>
        <Route path="/" element={null} />
        <Route path="/ip/:slug" element={<IpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
