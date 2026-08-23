import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './store/AppContext';
import Header from './components/Header/Header';
import Home from './pages/Home/Home';
import Catalog from './pages/Catalog/Catalog';
import ProductDetail from './pages/ProductDetail/ProductDetail';
import Cart from './pages/Cart/Cart';
import Checkout from './pages/Checkout/Checkout';
import CustomerArea from './pages/CustomerArea/CustomerArea';
import Admin from './pages/Admin/Admin';
import Chatbot from './components/Chatbot/Chatbot';

// Componente auxiliar para rolar a tela ao topo na mudança de rota
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="app-wrapper">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/catalogo" element={<Catalog />} />
              <Route path="/produto/:id" element={<ProductDetail />} />
              <Route path="/carrinho" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/cliente" element={<CustomerArea />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </main>
          {/* Chatbot flutuante presente em todas as páginas */}
          <Chatbot />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}
