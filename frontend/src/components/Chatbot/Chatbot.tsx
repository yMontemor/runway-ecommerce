import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { products } from '../../data/products';
import type { Product } from '../../types';
import './Chatbot.css';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  recommendations?: Product[];
}

export default function Chatbot() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Olá! Sou o assistente RunWay. Vou te ajudar a encontrar o tênis ideal para sua corrida. Qual é o seu foco de treino hoje?'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Escutar evento do Header para abrir o Chatbot
  useEffect(() => {
    const handleOpenChat = () => setIsOpen(true);
    window.addEventListener('open-chatbot', handleOpenChat);
    return () => window.removeEventListener('open-chatbot', handleOpenChat);
  }, []);

  // Rolar para o final do chat ao receber mensagens
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSuggestionClick = (suggestion: string) => {
    // 1. Mensagem do usuário
    const userMsgId = `msg_${Date.now()}`;
    const userMsg: Message = { id: userMsgId, sender: 'user', text: suggestion };
    
    // 2. Resposta do bot baseada no termo
    const botMsgId = `msg_${Date.now() + 1}`;
    let replyText: string;
    let filteredRecs: Product[];

    const norm = suggestion.toLowerCase();
    if (norm.includes('trilha')) {
      replyText = 'Para corrida em trilha (Trail), você precisa de tênis com tração superior, sola aderente (como Vibram) e proteção contra detritos. Aqui estão nossas melhores recomendações:';
      filteredRecs = products.filter(p => p.category === 'TRAIL');
    } else if (norm.includes('maratona')) {
      replyText = 'Para maratonas e competições de alta performance, recomendo modelos com placa de fibra de carbono e entressola super responsiva para máxima economia de energia:';
      filteredRecs = products.filter(p => p.category === 'COMPETIÇÃO');
    } else if (norm.includes('velocidade')) {
      replyText = 'Para treinos de tiro e ritmo (velocidade), procure calçados leves e dinâmicos com placa de nylon ou amortecimento ágil:';
      filteredRecs = products.filter(p => p.category === 'VELOCIDADE');
    } else if (norm.includes('10km') || norm.includes('longa')) {
      replyText = 'Para rodagens longas e conforto contínuo (como provas de 10km a meia maratona), estes modelos garantem estabilidade e amortecimento máximo de impacto:';
      filteredRecs = products.filter(p => p.category === 'LONGA DISTÂNCIA');
    } else {
      // Treino diário
      replyText = 'Para rodagens diárias e treinos de volume com durabilidade e amortecimento equilibrado, sugiro estes modelos versáteis:';
      filteredRecs = products.filter(p => p.category === 'TREINO DIÁRIO').slice(0, 3);
    }

    const botMsg: Message = {
      id: botMsgId,
      sender: 'bot',
      text: replyText,
      recommendations: filteredRecs
    };

    setMessages(prev => [...prev, userMsg, botMsg]);
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    setInputValue('');

    // Mensagem do usuário
    const userMsg: Message = { id: `msg_${Date.now()}`, sender: 'user', text: userText };
    setMessages(prev => [...prev, userMsg]);

    // Resposta simulada do bot
    setTimeout(() => {
      handleSuggestionClick(userText);
    }, 600);
  };

  const handleViewProduct = (productId: string) => {
    setIsOpen(false);
    navigate(`/produto/${productId}`);
  };

  return (
    <div className="chatbot-wrapper">
      
      {/* Botão Flutuante Verde Neon */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)} 
          className="chatbot-trigger-btn"
          title="Assistente RunWay"
          type="button"
          aria-label="Abrir assistente"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      )}

      {/* Painel do Chat */}
      {isOpen && (
        <div className="chatbot-panel">
          
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <span className="bot-avatar-dot"></span>
              <div>
                <h4 className="bot-title">Assistente RunWay</h4>
                <span className="bot-status">Online agora</span>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="chatbot-close-btn"
              type="button"
              aria-label="Fechar assistente"
            >
              &times;
            </button>
          </div>

          {/* Área de Mensagens */}
          <div className="chatbot-body">
            {messages.map(msg => (
              <div key={msg.id} className={`chat-message ${msg.sender}`}>
                <div className="message-bubble">
                  {msg.text}
                </div>
                
                {/* Recomendações de tênis */}
                {msg.recommendations && msg.recommendations.length > 0 && (
                  <div className="chat-recommendations">
                    {msg.recommendations.map(prod => (
                      <div key={prod.id} className="chat-prod-card">
                        <img src={prod.image} alt={prod.name} className="chat-prod-img" />
                        <div className="chat-prod-details">
                          <span className="chat-prod-brand">{prod.brand}</span>
                          <h5 className="chat-prod-name">{prod.name}</h5>
                          <span className="chat-prod-price">
                            {prod.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => handleViewProduct(prod.id)}
                            className="chat-prod-view-btn"
                          >
                            VER PRODUTO
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Sugestões de Cliques Rápidos */}
          <div className="chatbot-suggestions">
            <button type="button" onClick={() => handleSuggestionClick('10km')}>10km</button>
            <button type="button" onClick={() => handleSuggestionClick('Maratona')}>Maratona</button>
            <button type="button" onClick={() => handleSuggestionClick('Trilha')}>Trilha</button>
            <button type="button" onClick={() => handleSuggestionClick('Treino diário')}>Treino diário</button>
            <button type="button" onClick={() => handleSuggestionClick('Velocidade')}>Velocidade</button>
          </div>

          {/* Campo de Entrada de Mensagem */}
          <form onSubmit={handleSendText} className="chatbot-footer">
            <input
              type="text"
              placeholder="Digite sua mensagem..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="chatbot-input"
            />
            <button type="submit" className="chatbot-send-btn" aria-label="Enviar mensagem">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>

        </div>
      )}
    </div>
  );
}
