import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Key, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

export const Settings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      setTestResult(null); // Reset test on save
    } else {
      localStorage.removeItem('gemini_api_key');
      alert("API Key 已清除");
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey) return alert("请先输入 API Key");
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Hello, reply with "OK".',
      });
      
      if (response.text) {
        setTestResult('success');
      } else {
        throw new Error("Empty response");
      }
    } catch (error) {
      console.error(error);
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-8 h-8 text-cinematic-gold" />
        <h1 className="text-3xl font-bold text-white">全局设置</h1>
      </div>

      <div className="bg-cinematic-800 rounded-xl border border-cinematic-700 p-8 shadow-lg">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-cinematic-900 rounded-lg text-cinematic-accent">
            <Key size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Gemini API 配置</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              为了在部署环境（如 Vercel, GitHub Pages）中正常使用 AI 功能，您需要配置自己的 Google Gemini API Key。<br/>
              您的 Key 仅存储在本地浏览器中 (LocalStorage)，不会发送给任何第三方服务器。
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Google Gemini API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入以 AIza 开头的密钥..."
              className="w-full bg-cinematic-900 border border-cinematic-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-cinematic-gold focus:border-transparent outline-none transition-all font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noreferrer"
              className="text-sm text-cinematic-accent hover:text-blue-400 flex items-center gap-1 hover:underline"
            >
              <ExternalLink size={14} /> 获取免费 API Key
            </a>

            <div className="flex gap-3">
              <button
                onClick={handleTestConnection}
                disabled={isTesting || !apiKey}
                className="px-4 py-2 bg-cinematic-700 hover:bg-cinematic-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isTesting ? '连接测试中...' : '测试连接'}
              </button>
              
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-cinematic-gold hover:bg-amber-400 text-black rounded-lg text-sm font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2"
              >
                {isSaved ? <CheckCircle size={16} /> : <Save size={16} />}
                {isSaved ? '已保存' : '保存配置'}
              </button>
            </div>
          </div>

          {/* Test Feedback */}
          {testResult === 'success' && (
            <div className="mt-4 p-3 bg-green-900/30 border border-green-800 rounded-lg flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle size={16} /> 连接成功！AI 功能已就绪。
            </div>
          )}
          
          {testResult === 'error' && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle size={16} /> 连接失败，请检查 Key 是否正确或网络是否通畅。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};