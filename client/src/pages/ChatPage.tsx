import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatInterface } from '../components/chat/ChatInterface';
import { ArrowLeft, Brain } from 'lucide-react';

export const ChatPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-darkbg flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-darkborder bg-darksurface/30 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-darkborder rounded-xl text-textmuted hover:text-textmain hover:bg-darksurface transition duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>

          <h1 className="text-lg font-bold text-textmain flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary animate-pulse" />
            Grounded AI Knowledge Chat
          </h1>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-950/60 text-green-400 border border-green-800/40">
              llama3.2
            </span>
          </div>
        </div>
      </header>

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col">
        <ChatInterface />
      </main>
    </div>
  );
};

export default ChatPage;
