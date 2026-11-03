import { AppProvider } from './context/AppContext';
import { MainLayout } from './layouts/MainLayout';
import { LandingPage } from './pages/LandingPage';

export function App() {
  return (
    <AppProvider>
      <MainLayout>
        <LandingPage />
      </MainLayout>
    </AppProvider>
  );
}

export default App;
