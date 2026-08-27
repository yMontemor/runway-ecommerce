import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import type { Product } from '../../types';
import { generateBotResponse, initialChatContext, type ChatContext } from './chatbotEngine';
import './Chatbot.css';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  recommendations?: Product[];
}

export default function Chatbot() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isChatbotOpen: isOpen, setIsChatbotOpen: setIsOpen, toggleChatbot } = useApp();
  const showFloatingTrigger = location.pathname === '/' || location.pathname === '/catalogo';
  const [context, setContext] = useState<ChatContext>(initialChatContext);
  const [suggestions, setSuggestions] = useState<string[]>([
    'Quero um tênis para treino diário',
    'Quero correr longas distâncias',
    'Quero um tênis para velocidade',
    'Quero opções até R$ 800',
    'Me ajude a escolher'
  ]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Olá! 👋 Sou o assistente da RunWay. Posso te ajudar a encontrar um tênis do nosso catálogo de acordo com seu tipo de treino, distância, numeração e orçamento. O que você está procurando?'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Escutar eventos do Header e de outros pontos para alternar (toggle) ou abrir o Chatbot
  useEffect(() => {
    const handleToggleChat = () => toggleChatbot();
    const handleOpenChat = () => setIsOpen(true);

    window.addEventListener('toggle-chatbot', handleToggleChat);
    window.addEventListener('open-chatbot', handleOpenChat);

    return () => {
      window.removeEventListener('toggle-chatbot', handleToggleChat);
      window.removeEventListener('open-chatbot', handleOpenChat);
    };
  }, [toggleChatbot, setIsOpen]);

  // Rolar para o final do chat ao receber mensagens
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, isTyping]);

  const processUserMessage = (userText: string) => {
    // 1. Registrar mensagem do usuário
    const userMsgId = `msg_${Date.now()}`;
    const userMsg: Message = { id: userMsgId, sender: 'user', text: userText };
    
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // 2. Processar resposta via motor de recomendação
    setTimeout(() => {
      const reply = generateBotResponse(userText, context);
      
      const botMsgId = `msg_${Date.now() + 1}`;
      const botMsg: Message = {
        id: botMsgId,
        sender: 'bot',
        text: reply.text,
        recommendations: reply.recommendations
      };

      setMessages(prev => [...prev, botMsg]);
      setSuggestions(reply.suggestions);
      setContext(reply.context);
      setIsTyping(false);
    }, 450);
  };

  const handleSuggestionClick = (suggestion: string) => {
    processUserMessage(suggestion);
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    setInputValue('');
    processUserMessage(userText);
  };

  const handleViewProduct = (productId: string) => {
    setIsOpen(false);
    navigate(`/produto/${productId}`);
  };

  // Renderizar texto com quebras de linha e negritos simples
  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, lineIdx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={lineIdx} style={{ display: 'block', minHeight: line === '' ? '0.4rem' : undefined }}>
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </span>
      );
    });
  };

  return (
    <div className="chatbot-wrapper">
      
      {/* Botão Flutuante Verde Neon */}
      {!isOpen && showFloatingTrigger && (
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
                <span className="bot-status">Especialista em Corrida</span>
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
                  {renderFormattedText(msg.text)}
                </div>
                
                {/* Recomendações em Cards */}
                {msg.recommendations && msg.recommendations.length > 0 && (
                  <div className="chat-recommendations">
                    {msg.recommendations.map(prod => (
                      <div key={prod.id} className="chat-prod-card">
                        <img src={prod.image} alt={prod.name} className="chat-prod-img" />
                        <div className="chat-prod-details">
                          <div className="chat-prod-header-line">
                            <span className="chat-prod-brand">{prod.brand}</span>
                            <span className="chat-prod-cat-tag">{prod.categories[0]}</span>
                          </div>
                          <h5 className="chat-prod-name">{prod.name}</h5>
                          <div className="chat-prod-meta-line">
                            <span className="chat-prod-sizes-info">
                              {context.shoeSize && prod.sizes.includes(context.shoeSize)
                                ? `Tam. ${context.shoeSize} disp.`
                                : `Tam. ${Math.min(...prod.sizes)} ao ${Math.max(...prod.sizes)}`}
                            </span>
                            <span className="chat-prod-price">
                              {prod.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleViewProduct(prod.id)}
                            className="chat-prod-view-btn"
                          >
                            VER DETALHES
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="chat-message bot">
                <div className="message-bubble" style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                  Consultando catálogo da RunWay...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Sugestões de Cliques Rápidos */}
          {suggestions.length > 0 && (
            <div className="chatbot-suggestions">
              {suggestions.map((sug, idx) => (
                <button key={idx} type="button" onClick={() => handleSuggestionClick(sug)}>
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Campo de Entrada de Mensagem */}
          <form onSubmit={handleSendText} className="chatbot-footer">
            <input
              type="text"
              placeholder="Digite sua dúvida ou preferência..."
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
