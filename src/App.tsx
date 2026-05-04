import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Today } from './views/Today';
import { CalendarView } from './views/CalendarView';
import { Contacts } from './views/Contacts';
import { Templates } from './views/Templates';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<Today />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/templates" element={<Templates />} />
      </Route>
    </Routes>
  );
}
