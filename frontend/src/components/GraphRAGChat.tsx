import React, { useState } from 'react';
import { api } from '../services/api';
import type { GraphRAGResponse } from '../types';
import { Send, Bot, Sparkles, BookOpen, Layers, Terminal, AlertCircle } from 'lucide-react';

export const GraphRAGChat: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<GraphRAGResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sampleQueries = [
    'Which Mumbai wards have high surface temperatures and limited access to public facilities?',
    'Which highly populated localities have limited nearby hospital access?',
    'Find parks and drinking-water points near heat-exposed localities.',
    'Which demographic groups are concentrated in high-exposure areas?',
    "Which heat preparedness measures are recommended by Maharashtra's Heat Action Plan?",
  ];

  async function handleSend(q?: string) {
    const text = q || query;
    if (!text.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setQuery(text);
      const res = await api.queryGraphRAG(text);
      setResponse(res);
    } catch (err: any) {
      setError(err.message || 'Failed to execute GraphRAG query');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner (Genesis: White surface, 1px border #E8E8EC, 12px radius) */}
      <div className="bg-white border border-[#E8E8EC] rounded-12px p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 rounded-[6px] bg-[#6366F1]/10 text-[#6366F1]">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-[#0A0A0A] flex items-center space-x-2">
              <span>GraphRAG Natural Language Intelligence</span>
              <span className="text-[11px] bg-[#F3F4F6] text-[#6366F1] border border-[#E8E8EC] px-2 py-0.5 rounded-full font-mono">
                Hybrid Vector + Cypher
              </span>
            </h2>
            <p className="text-xs text-[#6B6B6B] mt-0.5">
              Traverses Knowledge Graph paths and grounds answers against official Heat Action Plans and IMD standards.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Prompts (Genesis: Pill tag chips, gray-100 bg, gray-600 text, 4px/12px padding) */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-[#6B6B6B] flex items-center space-x-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#6366F1]" />
          <span>Curated Operational & Policy Queries:</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              onClick={() => handleSend(sq)}
              className="text-xs bg-[#F3F4F6] hover:bg-[#E8E8EC] text-[#6B6B6B] hover:text-[#0A0A0A] px-3 py-1.5 rounded-full transition-all text-left"
            >
              "{sq}"
            </button>
          ))}
        </div>
      </div>

      {/* Input Form (Genesis: 6px radius input and button) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2.5"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask any natural-language query regarding Mumbai heat vulnerability, facilities, or policies..."
          className="flex-1 bg-white border border-[#E8E8EC] rounded-[6px] px-3.5 py-2.5 text-sm text-[#0A0A0A] placeholder-[#9C9C9C] focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 transition-all shadow-sm"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-[6px] text-sm font-medium flex items-center space-x-2 shadow-genesis-glow transition-all duration-150 hover:-translate-y-[1px] disabled:opacity-50"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span>Query GraphRAG</span>
        </button>
      </form>

      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] p-4 rounded-12px text-xs flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Response Box (Genesis: White surface, 1px border #E8E8EC, 12px radius) */}
      {response && (
        <div className="bg-white border border-[#E8E8EC] rounded-12px p-6 shadow-sm space-y-6">
          {/* Natural Language Answer */}
          <div>
            <div className="flex items-center space-x-2 text-[#6366F1] font-display font-bold text-sm mb-2.5">
              <Sparkles className="h-4 w-4" />
              <span>Evidence-Backed Synthesized Intelligence</span>
            </div>
            <div className="text-sm text-[#0A0A0A] leading-relaxed whitespace-pre-line bg-[#FAFAFA] p-4 rounded-[8px] border border-[#E8E8EC]">
              {response.answer}
            </div>
          </div>

          {/* Reasoning Path Steps */}
          {response.reasoning_path && response.reasoning_path.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center space-x-2 text-[#0A0A0A] font-display font-semibold text-xs">
                <Layers className="h-3.5 w-3.5 text-[#6366F1]" />
                <span>Explainable Knowledge Graph Traversal Path</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {response.reasoning_path.map((step) => (
                  <div
                    key={step.step_number}
                    className="bg-[#FAFAFA] p-3 rounded-[8px] border border-[#E8E8EC] text-xs space-y-1.5"
                  >
                    <div className="flex justify-between text-[10px] text-[#6366F1] font-mono font-bold">
                      <span>STEP {step.step_number}</span>
                      <span>{step.step_type}</span>
                    </div>
                    <p className="text-[#0A0A0A] text-[11px]">{step.description}</p>
                    <div className="text-[10px] text-[#6B6B6B] font-mono">
                      Nodes: {step.entities_involved.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source Document Citations */}
          {response.citations && response.citations.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center space-x-2 text-[#0A0A0A] font-display font-semibold text-xs">
                <BookOpen className="h-3.5 w-3.5 text-[#F59E0B]" />
                <span>Source Provenance Citations ({response.citations.length} Verified)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {response.citations.map((c, idx) => (
                  <div
                    key={idx}
                    className="bg-[#FAFAFA] p-3.5 rounded-[8px] border border-[#E8E8EC] text-xs space-y-1.5"
                  >
                    <div className="font-display font-bold text-[#0A0A0A] text-xs">{c.document_title}</div>
                    <div className="text-[10px] text-[#6B6B6B] font-mono">{c.section}</div>
                    <p className="text-[11px] text-[#6B6B6B] italic bg-white p-2.5 rounded-[6px] border border-[#E8E8EC]">
                      "{c.excerpt}"
                    </p>
                    <div className="text-[10px] text-[#F59E0B] font-mono font-medium">
                      Key: [{c.citation_key}]
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cypher Query Executed (Collapsible) */}
          {response.cypher_executed && (
            <details className="bg-[#FAFAFA] rounded-[8px] border border-[#E8E8EC] text-xs overflow-hidden">
              <summary className="p-3 font-mono text-[#6B6B6B] cursor-pointer hover:text-[#0A0A0A] flex items-center space-x-2">
                <Terminal className="h-3.5 w-3.5 text-[#10B981]" />
                <span>Underlying Cypher Traversal Query Executed</span>
              </summary>
              <div className="p-3 bg-white border-t border-[#E8E8EC] font-mono text-[11px] text-[#0A0A0A] whitespace-pre overflow-x-auto">
                {response.cypher_executed.trim()}
              </div>
            </details>
          )}

          {/* Scientific Validation Note */}
          <div className="bg-[#FAFAFA] p-3.5 rounded-[8px] border border-[#E8E8EC] text-[11px] text-[#6B6B6B] leading-relaxed">
            <span className="font-semibold text-[#0A0A0A]">Methodological Note: </span>
            {response.scientific_note}
          </div>
        </div>
      )}
    </div>
  );
};
