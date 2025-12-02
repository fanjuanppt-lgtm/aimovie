
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Settings as SettingsIcon, Save, Key, CheckCircle, AlertCircle, 
    ExternalLink, Zap, Database, Download, Upload, HardDrive, 
    ShieldAlert, Activity, Terminal, HelpCircle, Link as LinkIcon, MessageSquare, Server,
    Video, Cpu, Archive, FileText
} from 'lucide-react';
import { diagnoseNetwork, DiagnosisResult } from '../services/geminiService';
import { dbService } from '../services/db';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  
  // -- Text Generation Config --
  const [textProvider, setTextProvider] = useState<'gemini' | 'deepseek'>('gemini');
  
  // Gemini Text Config
  const [apiKey, setApiKey] = useState(''); // Gemini Key
  
  // DeepSeek Text Config
  const [deepseekKey, setDeepseekKey] = useState('');
  const [deepseekBaseUrl, setDeepseekBaseUrl] = useState('https://api.deepseek.com');
  const [deepseekModel, setDeepseekModel] = useState('deepseek-chat');

  // -- Image Generation Config --
  const [imageApiKey, setImageApiKey] = useState(''); // Optional override
  const [imageModel, setImageModel] = useState('gemini-3-pro-image-preview');

  // -- AI Studio Integration (Gemini Only) --
  const [hasAiStudio, setHasAiStudio] = useState(false);
  const [isProjectLinked, setIsProjectLinked] = useState(false);

  // -- Diagnostic State --
  const [isDiagnosingText, setIsDiagnosingText] = useState(false);
  const [isDiagnosingImage, setIsDiagnosingImage] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosisResult[]>([]);
  const [overallStatus, setOverallStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');

  // -- DB Management --
  const [dbStats, setDbStats] = useState<any>(null);
  const [isExportingText, setIsExportingText] = useState(false);
  const [isExportingFull, setIsExportingFull] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    // Load User for Export
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
    }

    // 1. Load Text Provider
    const storedProvider = localStorage.getItem('text_provider') as 'gemini' | 'deepseek';
    if (storedProvider) setTextProvider(storedProvider);

    // 2. Load Gemini Keys
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) setApiKey(storedKey);
    
    // 3. Load DeepSeek Config
    const storedDsKey = localStorage.getItem('deepseek_api_key');
    if (storedDsKey) setDeepseekKey(storedDsKey);
    
    const storedDsUrl = localStorage.getItem('deepseek_base_url');
    if (storedDsUrl) setDeepseekBaseUrl(storedDsUrl);

    const storedDsModel = localStorage.getItem('deepseek_model_id');
    if (storedDsModel) setDeepseekModel(storedDsModel);

    // 4. Load Image Config
    const storedImageKey = localStorage.getItem('gemini_api_key_image');
    if (storedImageKey) {
        setImageApiKey(storedImageKey);
    }
    const storedImageModel = localStorage.getItem('image_model_id');
    if (storedImageModel) setImageModel(storedImageModel);

    // Check AI Studio Environment
    if (window.aistudio) {
        setHasAiStudio(true);
        window.aistudio.hasSelectedApiKey().then(setIsProjectLinked);
    }

  }, []);

  // Load stats separately as it depends on user
  useEffect(() => {
      if (currentUser) {
          loadDbStats();
      }
  }, [currentUser]);

  const loadDbStats = async () => {
      try {
          if (!currentUser) return;
          const stats = await dbService.getStats(currentUser.id);
          setDbStats(stats);
      } catch (e) { console.error(e); }
  };

  const handleLinkProject = async () => {
      if (!window.aistudio) return;
      try {
          await window.aistudio.openSelectKey();
          const linked = await window.aistudio.hasSelectedApiKey();
          setIsProjectLinked(linked);
          if (linked) {
              // Automatically clear ALL manual keys to force use of the linked project key (Env)
              // This is critical for accessing Paid APIs (Gemini 3 Pro) without conflict
              localStorage.removeItem('gemini_api_key');
              localStorage.removeItem('gemini_api_key_image');
              
              setApiKey('');
              setImageApiKey('');
              
              alert("Google Cloud 项目已成功关联！\n\n已自动清除手动填写的 API Key，系统将直接使用付费项目的 Billing 权限 (Environment Key)。");
          }
      } catch (e) {
          console.error("Link Project Error:", e);
          alert("关联失败，请稍后重试。");
      }
  };

  const handleSaveKeys = () => {
      // Save Provider
      localStorage.setItem('text_provider', textProvider);

      // Save Gemini Key
      if (apiKey.trim()) {
          localStorage.setItem('gemini_api_key', apiKey.trim());
      } else {
          localStorage.removeItem('gemini_api_key');
      }

      // Save DeepSeek Config
      if (deepseekKey.trim()) localStorage.setItem('deepseek_api_key', deepseekKey.trim());
      else localStorage.removeItem('deepseek_api_key');

      if (deepseekBaseUrl.trim()) localStorage.setItem('deepseek_base_url', deepseekBaseUrl.trim());
      else localStorage.setItem('deepseek_base_url', 'https://api.deepseek.com');

      if (deepseekModel.trim()) localStorage.setItem('deepseek_model_id', deepseekModel.trim());
      else localStorage.setItem('deepseek_model_id', 'deepseek-chat');

      // Save Image Config
      if (imageApiKey.trim()) {
          localStorage.setItem('gemini_api_key_image', imageApiKey.trim());
      } else {
          localStorage.removeItem('gemini_api_key_image');
      }
      localStorage.setItem('image_model_id', imageModel);
      
      alert("配置已保存！");
  };

  const runDiagnostics = async (target: 'text' | 'image') => {
      if (target === 'text') setIsDiagnosingText(true);
      if (target === 'image') setIsDiagnosingImage(true);
      
      setDiagnosticLogs([]); // Clear previous logs
      setOverallStatus('idle');

      try {
          // Pass current input states for live testing without saving first
          const results = await diagnoseNetwork(
              apiKey.trim(), 
              imageApiKey.trim(),
              {
                  provider: textProvider,
                  deepseekKey: deepseekKey.trim(),
                  deepseekBaseUrl: deepseekBaseUrl.trim(),
                  deepseekModel: deepseekModel.trim()
              },
              target
          );
          setDiagnosticLogs(results);
          
          const hasError = results.some(r => r.status === 'error');
          const hasWarning = results.some(r => r.status === 'warning');
          
          if (hasError) setOverallStatus('error');
          else if (hasWarning) setOverallStatus('warning');
          else setOverallStatus('success');

      } catch (e) {
          console.error(e);
          setOverallStatus('error');
      } finally {
          setIsDiagnosingText(false);
          setIsDiagnosingImage(false);
      }
  };

  // DB Handlers
  const handleExportText = async () => {
      if (!currentUser) return;
      setIsExportingText(true);
      try {
          // Pass false to exclude images
          const jsonString = await dbService.exportUserData(currentUser.id, false);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `AI_Cinema_Lite_${currentUser.username}_${new Date().toISOString().slice(0,10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e) { alert("导出失败"); } finally { setIsExportingText(false); }
  };
  
  const handleExportFullZip = async () => {
      if (!currentUser) return;
      setIsExportingFull(true);
      try {
          const zipBlob = await dbService.exportFullBackupZip(currentUser.id);
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `AI_Cinema_FULL_${currentUser.username}_${new Date().toISOString().slice(0,10)}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (e: any) {
          console.error(e);
          alert("全量导出失败，可能是数据量过大或内存不足。请尝试使用轻量级文本导出。");
      } finally {
          setIsExportingFull(false);
      }
  };

  const handleJsonImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!currentUser) return;
      const file = e.target.files?.[0];
      if (!file) return;
      setIsImporting(true);
      setTimeout(() => {
          const reader = new FileReader();
          reader.readAsText(file);
          reader.onload = async () => {
              try {
                  const content = reader.result as string;
                  const parsedData = JSON.parse(content);
                  await dbService.importData(parsedData, currentUser.id);
                  alert("文本数据导入成功！页面将刷新。");
                  window.location.reload();
              } catch (err: any) {
                  console.error(err);
                  alert(`恢复失败: ${err.message}`);
                  setIsImporting(false);
              }
          };
          reader.onerror = () => { alert("读取失败"); setIsImporting(false); };
      }, 100);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const handleZipImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!currentUser) return;
      const file = e.target.files?.[0];
      if (!file) return;
      setIsImporting(true);
      try {
          await dbService.importFullBackupZip(file, currentUser.id);
          alert("全量数据 (包含图片) 导入成功！页面将刷新。");
          window.location.reload();
      } catch (e: any) {
          console.error(e);
          alert(`ZIP 恢复失败: ${e.message}`);
      } finally {
          setIsImporting(false);
          if (zipInputRef.current) zipInputRef.current.value = '';
      }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-32 relative">
      <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
                <div className="p-3 bg-cinematic-800 rounded-lg text-cinematic-gold border border-cinematic-700">
                <SettingsIcon size={24} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-white">全局设置</h1>
                    <p className="text-slate-400 text-sm">Configure AI Engines & Data</p>
                </div>
          </div>
          
          <button 
             onClick={handleSaveKeys}
             className="px-6 py-3 bg-cinematic-gold hover:bg-amber-400 text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-amber-900/20"
           >
               <Save size={18} /> 保存全部配置
           </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          
          {/* LEFT COLUMN: CONFIGURATION PANELS */}
          <div className="lg:col-span-7 flex flex-col gap-8">
               
               {/* 1. TEXT ENGINE CONFIGURATION */}
               <div className="bg-cinematic-800 rounded-xl border border-cinematic-700 p-6 shadow-xl relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                   <div className="flex items-center justify-between mb-6 border-b border-cinematic-700 pb-4">
                       <div className="flex items-center gap-2">
                           <MessageSquare className="text-blue-400" size={24} />
                           <h2 className="text-xl font-bold text-white">1. 文本创作引擎 (Script & Logic)</h2>
                       </div>
                       <div className="px-2 py-1 bg-blue-900/30 text-blue-400 text-xs font-bold rounded border border-blue-900/50">Text API</div>
                   </div>

                   <div className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-300 uppercase mb-3">选择模型提供商</label>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setTextProvider('gemini')}
                                    className={`p-4 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-2 transition-all ${
                                        textProvider === 'gemini' 
                                        ? 'bg-cinematic-gold/10 text-cinematic-gold border-cinematic-gold' 
                                        : 'bg-cinematic-900 text-slate-400 border-cinematic-700 hover:border-slate-500'
                                    }`}
                                >
                                    <Zap size={20} /> Google Gemini
                                    <span className="text-[10px] font-normal opacity-70">速度快，多模态，免费额度高</span>
                                </button>
                                <button 
                                    onClick={() => setTextProvider('deepseek')}
                                    className={`p-4 rounded-xl border-2 text-sm font-bold flex flex-col items-center gap-2 transition-all ${
                                        textProvider === 'deepseek' 
                                        ? 'bg-blue-600/10 text-blue-400 border-blue-500' 
                                        : 'bg-cinematic-900 text-slate-400 border-cinematic-700 hover:border-slate-500'
                                    }`}
                                >
                                    <Cpu size={20} /> DeepSeek / OpenAI
                                    <span className="text-[10px] font-normal opacity-70">逻辑强，适合复杂剧本推理</span>
                                </button>
                            </div>
                        </div>

                        {/* GEMINI TEXT INPUTS */}
                        {textProvider === 'gemini' && (
                            <div className="animate-in fade-in space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Gemini API Key (Scripting)</label>
                                    <input 
                                        type="password"
                                        value={apiKey}
                                        onChange={e => setApiKey(e.target.value)}
                                        placeholder={isProjectLinked ? "已使用 Project Key (Visual 共享)..." : "输入 API Key..."}
                                        disabled={isProjectLinked}
                                        className={`w-full bg-cinematic-900 border border-cinematic-700 rounded px-4 py-3 text-white font-mono text-sm outline-none focus:border-cinematic-gold ${isProjectLinked ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                    {isProjectLinked && <p className="text-[10px] text-green-500 mt-1 flex items-center gap-1"><CheckCircle size={10}/> 已通过 Visual 引擎共享 Google Cloud 项目权限</p>}
                                </div>
                            </div>
                        )}

                        {/* DEEPSEEK INPUTS */}
                        {textProvider === 'deepseek' && (
                            <div className="animate-in fade-in space-y-4 bg-blue-900/10 p-4 rounded-lg border border-blue-900/30">
                                <div>
                                    <label className="block text-xs font-bold text-blue-300 uppercase mb-1">DeepSeek API Key</label>
                                    <input 
                                        type="password"
                                        value={deepseekKey}
                                        onChange={e => setDeepseekKey(e.target.value)}
                                        placeholder="sk-..."
                                        className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white font-mono text-sm outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Base URL</label>
                                        <input 
                                            type="text"
                                            value={deepseekBaseUrl}
                                            onChange={e => setDeepseekBaseUrl(e.target.value)}
                                            placeholder="https://api.deepseek.com"
                                            className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white font-mono text-xs outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Model ID</label>
                                        <input 
                                            type="text"
                                            value={deepseekModel}
                                            onChange={e => setDeepseekModel(e.target.value)}
                                            placeholder="deepseek-chat"
                                            className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-3 py-2 text-white font-mono text-xs outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TEST TEXT BUTTON */}
                        <div className="pt-2">
                             <button 
                                onClick={() => runDiagnostics('text')}
                                disabled={isDiagnosingText}
                                className="w-full py-3 bg-cinematic-700 hover:bg-cinematic-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors text-sm border border-cinematic-600"
                            >
                                {isDiagnosingText ? <Zap className="animate-spin" size={16}/> : <MessageSquare size={16}/>} 
                                测试文本接口 (Test Text API)
                            </button>
                        </div>
                   </div>
               </div>

               {/* 2. VISUAL ENGINE CONFIGURATION */}
               <div className="bg-cinematic-800 rounded-xl border border-cinematic-700 p-6 shadow-xl relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-1 h-full bg-cinematic-gold"></div>
                   <div className="flex items-center justify-between mb-6 border-b border-cinematic-700 pb-4">
                       <div className="flex items-center gap-2">
                           <Video className="text-cinematic-gold" size={24} />
                           <h2 className="text-xl font-bold text-white">2. 视觉/视频引擎 (Visual & Image)</h2>
                       </div>
                       <div className="px-2 py-1 bg-amber-900/30 text-cinematic-gold text-xs font-bold rounded border border-amber-900/50">Gemini Pro</div>
                   </div>

                   <div className="space-y-6">
                        {/* Model Selector */}
                        <div>
                            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">选择视觉模型 (Storyboard / Video)</label>
                            <select 
                                value={imageModel}
                                onChange={e => setImageModel(e.target.value)}
                                className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-4 py-3 text-white text-sm focus:border-cinematic-gold outline-none"
                            >
                                <option value="gemini-3-pro-image-preview">Gemini 3 Pro (电影级画质 - 需付费项目)</option>
                                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash (标准画质 - 速度快)</option>
                            </select>
                        </div>

                        {/* PAID PROJECT LINKING (CRITICAL FOR GEMINI 3 PRO) */}
                        {hasAiStudio && (
                            <div className="bg-gradient-to-br from-cinematic-900 to-black p-4 rounded-xl border border-cinematic-gold/30 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <Zap size={64} className="text-cinematic-gold"/>
                                </div>
                                
                                <h3 className="text-sm font-bold text-cinematic-gold mb-2 flex items-center gap-2">
                                   <Server size={16}/> Google Cloud 项目接入 (付费/Billing)
                                </h3>
                                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                                    Gemini 3 Pro 等高级视觉模型通常需要关联 Google Cloud 结算账户。
                                    请在此处直接选择您的付费项目。
                                </p>

                                {isProjectLinked ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="bg-green-900/20 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2 font-bold text-sm">
                                            <CheckCircle size={18} />
                                            已成功连接 Google Cloud 项目
                                        </div>
                                        <button 
                                            onClick={handleLinkProject} 
                                            className="text-xs text-slate-500 hover:text-white underline text-right"
                                        >
                                            切换/重新选择项目
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={handleLinkProject}
                                        className="w-full py-3 bg-cinematic-gold hover:bg-amber-400 text-black font-bold rounded-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                                    >
                                        <LinkIcon size={18} /> Select a key from a paid project below
                                    </button>
                                )}
                            </div>
                        )}

                        {/* MANUAL OVERRIDE */}
                        <div className={`transition-opacity ${isProjectLinked ? 'opacity-50' : 'opacity-100'}`}>
                             <label className="block text-xs font-bold text-slate-400 uppercase mb-1">手动 Visual API Key (备用/覆盖)</label>
                             <input 
                                type="password"
                                value={imageApiKey}
                                onChange={e => setImageApiKey(e.target.value)}
                                placeholder={isProjectLinked ? "已托管 (Managed)..." : "如未关联项目，可在此输入独立 Key..."}
                                disabled={isProjectLinked}
                                className="w-full bg-cinematic-900 border border-cinematic-700 rounded px-4 py-3 text-white font-mono text-sm outline-none focus:border-cinematic-gold"
                            />
                        </div>
                        
                        {/* TEST VISUAL BUTTON */}
                        <div className="pt-2">
                             <button 
                                onClick={() => runDiagnostics('image')}
                                disabled={isDiagnosingImage}
                                className="w-full py-3 bg-cinematic-700 hover:bg-cinematic-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors text-sm border border-cinematic-600"
                            >
                                {isDiagnosingImage ? <Zap className="animate-spin" size={16}/> : <Video size={16}/>} 
                                测试视觉接口 (Test Visual API)
                            </button>
                        </div>
                   </div>
               </div>
          </div>

          {/* RIGHT COLUMN: DIAGNOSTICS & DATA */}
          <div className="lg:col-span-5 flex flex-col gap-8">
               
               {/* DIAGNOSTIC CONSOLE */}
               <div className="bg-cinematic-800 rounded-xl border border-cinematic-700 p-6 shadow-xl flex flex-col h-[500px]">
                   <div className="flex items-center justify-between mb-4 border-b border-cinematic-700 pb-4">
                       <div className="flex items-center gap-2">
                            <Activity className={overallStatus === 'success' ? "text-green-500" : overallStatus === 'error' ? "text-red-500" : "text-cinematic-gold"} size={20} />
                            <h2 className="text-lg font-bold text-white">连接诊断终端</h2>
                       </div>
                       <button onClick={() => setShowHelp(!showHelp)} className="text-xs text-cinematic-gold hover:underline flex items-center gap-1">
                           <HelpCircle size={12} /> {showHelp ? '隐藏指南' : '排查指南'}
                       </button>
                   </div>
                   
                   {/* Help Guide */}
                   {showHelp && (
                       <div className="mb-4 bg-cinematic-900/80 p-3 rounded-lg border border-cinematic-gold/30 text-[11px] space-y-1 animate-in fade-in">
                           <p className="text-slate-300"><strong className="text-cinematic-gold">Gemini 3 Pro:</strong> 必须关联 Google Cloud 结算账户。</p>
                           <p className="text-slate-300"><strong className="text-cinematic-gold">403 错误:</strong> 请检查 API 是否启用 (Generative Language API)。</p>
                           <p className="text-slate-300"><strong className="text-cinematic-gold">DeepSeek:</strong> 仅支持文本，画图需单独配置 Gemini。</p>
                       </div>
                   )}
                   
                   {/* Terminal Output */}
                   <div className="flex-1 bg-black rounded-lg border border-cinematic-700 p-4 font-mono text-xs overflow-y-auto shadow-inner custom-scrollbar">
                       {diagnosticLogs.length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                               <Terminal size={32} className="opacity-30" />
                               <p>系统待机中 (System Idle)</p>
                               <p className="text-[10px]">请点击左侧 "测试文本" 或 "测试视觉" 按钮</p>
                           </div>
                       ) : (
                           <div className="space-y-3">
                               {diagnosticLogs.map((log, i) => (
                                   <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300 border-b border-white/5 pb-2 last:border-0">
                                       <div className="pt-0.5 flex-shrink-0">
                                           {log.status === 'success' && <span className="text-green-500 font-bold">[OK]</span>}
                                           {log.status === 'error' && <span className="text-red-500 font-bold">[ERR]</span>}
                                           {log.status === 'warning' && <span className="text-yellow-500 font-bold">[WRN]</span>}
                                       </div>
                                       <div>
                                           <div className="font-bold text-slate-300">{log.step}</div>
                                           <div className={`mt-0.5 ${log.status === 'error' ? 'text-red-400' : 'text-slate-500'}`}>
                                               {log.message}
                                           </div>
                                       </div>
                                   </div>
                               ))}
                               {(isDiagnosingText || isDiagnosingImage) && (
                                   <div className="text-cinematic-gold animate-pulse mt-2">
                                       _ 正在建立连接...
                                   </div>
                               )}
                           </div>
                       )}
                   </div>

                   {/* Status Summary */}
                   {overallStatus !== 'idle' && !isDiagnosingText && !isDiagnosingImage && (
                       <div className={`mt-4 p-3 rounded-lg border text-xs font-bold flex items-center gap-2 ${
                           overallStatus === 'success' ? 'bg-green-900/20 border-green-800 text-green-400' :
                           overallStatus === 'error' ? 'bg-red-900/20 border-red-800 text-red-400' :
                           'bg-yellow-900/20 border-yellow-800 text-yellow-400'
                       }`}>
                           {overallStatus === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                           {overallStatus === 'success' ? "测试通过 (System Operational)" : "测试未通过 (System Check Failed)"}
                       </div>
                   )}
               </div>

               {/* DATA MANAGEMENT CARD */}
               <div className="bg-cinematic-800 rounded-xl border border-cinematic-700 p-6 flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-4">
                        <Database className="text-slate-400" size={20} />
                        <h2 className="text-lg font-bold text-white">本地数据管理</h2>
                    </div>
                    
                    <div className="flex-1 bg-cinematic-900/30 rounded-lg p-4 mb-4 border border-cinematic-700/50">
                        {dbStats ? (
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between border-b border-white/5 pb-2 mb-2">
                                     <span className="text-cinematic-gold font-bold">Current User</span>
                                     <span className="text-white font-mono">{currentUser?.username}</span>
                                </div>
                                <div className="flex justify-between"><span className="text-slate-400">Universes</span><span className="text-white font-mono">{dbStats.universes}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Story Eggs</span><span className="text-white font-mono">{dbStats.eggs}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Characters</span><span className="text-white font-mono">{dbStats.characters}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Storyboards</span><span className="text-white font-mono">{dbStats.storyboards}</span></div>
                            </div>
                        ) : <span className="text-xs text-slate-500">Loading stats...</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-auto mb-3">
                         <div className="col-span-2 text-[10px] text-slate-500 uppercase font-bold mb-1">文本备份 (Text Only)</div>
                        <button onClick={handleExportText} disabled={isExportingText} className="py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-xs flex items-center justify-center gap-2">
                            <FileText size={14} /> 仅导出JSON
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-xs flex items-center justify-center gap-2">
                            <Upload size={14} /> 导入JSON
                        </button>
                        <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleJsonImport} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-cinematic-700">
                         <div className="col-span-2 text-[10px] text-cinematic-gold uppercase font-bold mb-1">全量备份 (Full Backup with Images)</div>
                        <button onClick={handleExportFullZip} disabled={isExportingFull} className="py-2 bg-cinematic-gold hover:bg-amber-400 text-black rounded font-bold text-xs flex items-center justify-center gap-2 shadow-lg">
                            <Archive size={14} /> 导出 ZIP 包
                        </button>
                        <button onClick={() => zipInputRef.current?.click()} disabled={isImporting} className="py-2 bg-cinematic-700 hover:bg-cinematic-600 text-white rounded font-bold text-xs flex items-center justify-center gap-2 border border-cinematic-gold/30">
                            <Upload size={14} /> 导入 ZIP 包
                        </button>
                        <input type="file" accept=".zip" ref={zipInputRef} className="hidden" onChange={handleZipImport} />
                    </div>
               </div>
          </div>
      </div>
    </div>
  );
};
