"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "groq-chat-prototype-session-v1";

const initialSession = {
  messages: [],
  totals: {
    prompt: 0,
    completion: 0,
    total: 0,
  },
  requestCount: 0,
  totalLatencyMs: 0,
  createdAt: Date.now(),
};

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-ES").format(value);
}

function formatDate(time) {
  const date = new Date(time);
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const quickPrompts = [
  "Resume este texto en 3 bullets.",
  "Dame 5 ideas de mejora para esta UX.",
  "Explica este concepto como si fuera principiante.",
];

export default function Home() {
  const [session, setSession] = useState(initialSession);
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeView, setActiveView] = useState("chat");
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let nextSession = initialSession;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        nextSession = { ...initialSession, ...JSON.parse(raw) };
      }
    } catch {
      nextSession = initialSession;
    }

    queueMicrotask(() => {
      setSession(nextSession);
      setIsHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [isHydrated, session]);

  const assistantMessages = useMemo(
    () => session.messages.filter((item) => item.role === "assistant"),
    [session.messages]
  );

  const avgLatencyMs =
    session.requestCount > 0
      ? Math.round(session.totalLatencyMs / session.requestCount)
      : 0;

  const sessionTps =
    session.totalLatencyMs > 0
      ? Number(
          (
            session.totals.completion /
            Math.max(session.totalLatencyMs / 1000, 0.001)
          ).toFixed(2)
        )
      : 0;

  const trendValues = assistantMessages.slice(-7).map((entry) => {
    const value = entry.usage?.total_tokens || 0;
    return Math.min(100, Math.max(8, Math.round(value / 8)));
  });

  const modelBreakdown = Object.values(
    assistantMessages.reduce((acc, entry) => {
      const modelName = entry.metrics?.model || "unknown";
      const tokens = entry.usage?.total_tokens || 0;

      if (!acc[modelName]) {
        acc[modelName] = { model: modelName, tokens: 0, count: 0 };
      }

      acc[modelName].tokens += tokens;
      acc[modelName].count += 1;

      return acc;
    }, {})
  ).sort((a, b) => b.tokens - a.tokens);

  const topModel = modelBreakdown[0];

  const submitPrompt = async (event) => {
    event.preventDefault();

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isLoading) {
      return;
    }

    setError("");

    const userMessage = {
      id: createId("user"),
      role: "user",
      content: cleanPrompt,
      createdAt: Date.now(),
    };

    const outboundMessages = [...session.messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setSession((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
    }));

    setPrompt("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: outboundMessages }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Could not generate a response.");
      }

      const usage = data.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      const metrics = data.metrics || {
        model: "unknown",
        latencyMs: 0,
        tokensPerSecond: 0,
      };

      const assistantMessage = {
        id: createId("assistant"),
        role: "assistant",
        content: data.message,
        usage,
        metrics,
        createdAt: Date.now(),
      };

      setSession((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        totals: {
          prompt: prev.totals.prompt + usage.prompt_tokens,
          completion: prev.totals.completion + usage.completion_tokens,
          total: prev.totals.total + usage.total_tokens,
        },
        requestCount: prev.requestCount + 1,
        totalLatencyMs: prev.totalLatencyMs + metrics.latencyMs,
      }));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSession = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }

    setSession({ ...initialSession, createdAt: Date.now() });
    setError("");
    setPrompt("");
    setActiveView("chat");
  };

  return (
    <main className="shell">
      <aside className="sidebar desktop-only">
        <h1>Aether AI</h1>
        <p className="subtle">Enterprise Assistant Prototype</p>
        <button className="primary" onClick={clearSession} type="button">
          Borrar conversacion
        </button>

        <nav>
          <button
            type="button"
            className={activeView === "chat" ? "nav active" : "nav"}
            onClick={() => setActiveView("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            className={activeView === "history" ? "nav active" : "nav"}
            onClick={() => setActiveView("history")}
          >
            History
          </button>
          <button
            type="button"
            className={activeView === "usage" ? "nav active" : "nav"}
            onClick={() => setActiveView("usage")}
          >
            Usage
          </button>
        </nav>
      </aside>

      <section className="panel">
        <header className="topbar">
          <div className="topbar-left">
            <div className="search-shell">
              <input type="text" placeholder="Buscar en conversaciones..." readOnly />
            </div>

            <h2>
              {activeView === "chat"
                ? "Asistente IA"
                : activeView === "history"
                ? "Historial"
                : "Uso de Tokens"}
            </h2>
            <p className="subtle">
              {activeView === "chat"
                ? "Flujo conversacional persistente con metricas por respuesta"
                : activeView === "history"
                ? "Tu sesion se conserva incluso al recargar"
                : "Metricas en tiempo real obtenidas de Groq"}
            </p>
          </div>

          <div className="topbar-actions">
            <button type="button" className="ghost-btn">
              Exportar
            </button>
            <div className="chip">Model: llama-3.1-8b-instant</div>
          </div>
        </header>

        {error ? <div className="error">{error}</div> : null}

        {activeView === "chat" ? (
          <>
            <div className="session-strip">
              <article>
                <span>Tokens sesion</span>
                <strong>{formatNumber(session.totals.total)}</strong>
              </article>
              <article>
                <span>Requests</span>
                <strong>{formatNumber(session.requestCount)}</strong>
              </article>
              <article>
                <span>Latencia media</span>
                <strong>{avgLatencyMs}ms</strong>
              </article>
            </div>

            <div className="messages">
              {session.messages.length === 0 ? (
                <div className="empty-state">
                  <h3>Inicia tu primera conversacion</h3>
                  <p>
                    Este prototipo guarda historial en localStorage y registra
                    consumo de tokens por cada respuesta de Groq.
                  </p>

                  <div className="quick-prompts">
                    {quickPrompts.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPrompt(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {session.messages.map((message) => (
                <article
                  key={message.id}
                  className={message.role === "user" ? "bubble user" : "bubble assistant"}
                >
                  <div className="bubble-head">
                    <span>{message.role === "user" ? "You" : "Assistant"}</span>
                    <time>{formatDate(message.createdAt)}</time>
                  </div>
                  <p>{message.content}</p>

                  {message.role === "assistant" && message.usage ? (
                    <div className="meta-grid">
                      <span>Prompt: {formatNumber(message.usage.prompt_tokens)}</span>
                      <span>
                        Completion: {formatNumber(message.usage.completion_tokens)}
                      </span>
                      <span>Total: {formatNumber(message.usage.total_tokens)}</span>
                      <span>Latency: {message.metrics?.latencyMs || 0}ms</span>
                      <span>TPS: {message.metrics?.tokensPerSecond || 0}</span>
                      <span>Model: {message.metrics?.model || "unknown"}</span>
                    </div>
                  ) : null}
                </article>
              ))}

              {isLoading ? (
                <div className="typing">Asistente procesando tu solicitud...</div>
              ) : null}
            </div>

            <form className="composer" onSubmit={submitPrompt}>
              <input
                name="prompt"
                placeholder="Escribe tu mensaje..."
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                autoComplete="off"
              />
              <button type="submit" disabled={isLoading || !prompt.trim()}>
                Enviar
              </button>
            </form>
          </>
        ) : null}

        {activeView === "history" ? (
          <div className="history-list">
            {assistantMessages.length === 0 ? (
              <p className="subtle">Aun no hay respuestas del asistente.</p>
            ) : (
              assistantMessages
                .slice()
                .reverse()
                .map((entry) => (
                  <article key={entry.id} className="history-card">
                    <h3>{entry.content.slice(0, 80)}...</h3>
                    <div className="history-meta">
                      <span>{entry.metrics?.model || "model"}</span>
                      <span>{formatNumber(entry.usage?.total_tokens || 0)} tokens</span>
                      <span>{formatDate(entry.createdAt)}</span>
                    </div>
                  </article>
                ))
            )}
          </div>
        ) : null}

        {activeView === "usage" ? (
          <div className="usage">
            <div className="stats-grid">
              <article className="stat-card">
                <h3>Tokens totales</h3>
                <strong>{formatNumber(session.totals.total)}</strong>
              </article>
              <article className="stat-card">
                <h3>Tokens prompt</h3>
                <strong>{formatNumber(session.totals.prompt)}</strong>
              </article>
              <article className="stat-card">
                <h3>Tokens completion</h3>
                <strong>{formatNumber(session.totals.completion)}</strong>
              </article>
              <article className="stat-card">
                <h3>Latencia media</h3>
                <strong>{avgLatencyMs}ms</strong>
              </article>
              <article className="stat-card">
                <h3>TPS sesion</h3>
                <strong>{sessionTps}</strong>
              </article>
              <article className="stat-card">
                <h3>Total requests</h3>
                <strong>{formatNumber(session.requestCount)}</strong>
              </article>
            </div>

            <section className="trend-card">
              <div className="trend-head">
                <h3>Tendencia de consumo</h3>
                <span>Ultimos 7 mensajes</span>
              </div>
              <div className="trend-chart" aria-hidden="true">
                {(trendValues.length > 0 ? trendValues : [10, 20, 30, 42, 28, 55, 36]).map(
                  (value, index) => (
                    <i key={`${value}-${index}`} style={{ height: `${value}%` }} />
                  )
                )}
              </div>
            </section>

            <div className="mini-table">
              <div className="row header">
                <span>Ultimas respuestas</span>
                <span>Tokens</span>
                <span>Latencia</span>
              </div>
              {assistantMessages
                .slice(-6)
                .reverse()
                .map((entry) => (
                  <div className="row" key={`${entry.id}-usage`}>
                    <span>{entry.content.slice(0, 40)}...</span>
                    <span>{formatNumber(entry.usage?.total_tokens || 0)}</span>
                    <span>{entry.metrics?.latencyMs || 0}ms</span>
                  </div>
                ))}
            </div>

            <section className="usage-bottom-grid">
              <article className="breakdown-card">
                <h3>Desglose por modelo</h3>
                {modelBreakdown.length === 0 ? (
                  <p className="subtle">Aun no hay respuestas para desglosar.</p>
                ) : (
                  <div className="breakdown-list">
                    {modelBreakdown.map((item) => {
                      const share =
                        session.totals.total > 0
                          ? Math.round((item.tokens / session.totals.total) * 100)
                          : 0;

                      return (
                        <div className="breakdown-row" key={item.model}>
                          <div>
                            <strong>{item.model}</strong>
                            <span>{formatNumber(item.count)} mensajes</span>
                          </div>
                          <div className="breakdown-bar-shell">
                            <i style={{ width: `${Math.max(share, 4)}%` }} />
                          </div>
                          <span>{formatNumber(item.tokens)} tk</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>

              <article className="distribution-card">
                <h3>Distribucion de carga</h3>
                <div className="ring">
                  <span>{formatNumber(session.totals.total)}</span>
                  <small>tokens</small>
                </div>
                <p>
                  Modelo principal: {topModel?.model || "N/A"}
                  <br />
                  Participacion: {topModel && session.totals.total > 0
                    ? Math.round((topModel.tokens / session.totals.total) * 100)
                    : 0}
                  %
                </p>
              </article>
            </section>
          </div>
        ) : null}
      </section>

      <nav className="mobile-nav">
        <button
          type="button"
          className={activeView === "chat" ? "active" : ""}
          onClick={() => setActiveView("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          className={activeView === "history" ? "active" : ""}
          onClick={() => setActiveView("history")}
        >
          Historial
        </button>
        <button
          type="button"
          className={activeView === "usage" ? "active" : ""}
          onClick={() => setActiveView("usage")}
        >
          Uso
        </button>
      </nav>
    </main>
  );
}
