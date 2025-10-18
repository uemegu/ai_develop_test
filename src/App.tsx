import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import "./App.css";

type Quote = {
  id: string;
  text: string;
  author: string;
  background?: string;
  isCustom?: boolean;
  createdAt?: string;
};

type View = "today" | "favorites" | "add";

const QUOTES_URL = "./quotes.json";
const BACKGROUNDS = [
  "./backgrounds/image1.webp",
  "./backgrounds/image2.webp",
  "./backgrounds/image3.webp",
] as const;
const PINNED_STORAGE_KEY = "AI_DEV_PINNED_QUOTES_V1";
const CUSTOM_STORAGE_KEY = "AI_DEV_CUSTOM_QUOTES_V1";

const getRandomBackground = () =>
  BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];

const uniqueById = (quotes: Quote[]) => {
  const map = new Map<string, Quote>();
  quotes.forEach((quote) => {
    if (!map.has(quote.id)) {
      map.set(quote.id, quote);
    }
  });
  return Array.from(map.values());
};

const safeParseQuotes = (value: string | null) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): Quote | null => {
        if (!item) return null;
        const text = String(item.text ?? "").trim();
        const author = String(item.author ?? "").trim();
        if (!text || !author) return null;
        return {
          id: String(item.id ?? ""),
          text,
          author,
          background:
            typeof item.background === "string" ? item.background : undefined,
          isCustom: Boolean(item.isCustom),
          createdAt:
            typeof item.createdAt === "string" ? item.createdAt : undefined,
        };
      })
      .filter((quote): quote is Quote => Boolean(quote?.id));
  } catch (error) {
    console.warn("Failed to parse stored quotes", error);
    return [];
  }
};

const withBackground = (quote: Quote): Quote => ({
  ...quote,
  background: quote.background ?? getRandomBackground(),
});

const generateId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `custom-${Math.random().toString(36).slice(2, 11)}`;

function App() {
  const [view, setView] = useState<View>("today");
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [, setCustomQuotes] = useState<Quote[]>([]);
  const [pinnedQuotes, setPinnedQuotes] = useState<Quote[]>([]);
  const [todayQuote, setTodayQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const persistPinned = useCallback((items: Quote[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(items));
  }, []);

  const persistCustom = useCallback((items: Quote[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(items));
  }, []);

  const ensureTodayQuote = useCallback(
    (quotes: Quote[]) => {
      if (!quotes.length) {
        setTodayQuote(null);
        return;
      }
      setTodayQuote((current) => {
        if (!current) {
          return withBackground(
            quotes[Math.floor(Math.random() * quotes.length)]
          );
        }
        const exists = quotes.some((quote) => quote.id === current.id);
        if (exists) {
          return current;
        }
        return withBackground(
          quotes[Math.floor(Math.random() * quotes.length)]
        );
      });
    },
    [setTodayQuote]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const storedCustom =
          typeof window !== "undefined"
            ? safeParseQuotes(window.localStorage.getItem(CUSTOM_STORAGE_KEY))
            : [];
        const storedPinned =
          typeof window !== "undefined"
            ? safeParseQuotes(window.localStorage.getItem(PINNED_STORAGE_KEY))
            : [];

        const normalizedCustom = storedCustom.map((quote) => ({
          ...quote,
          isCustom: true,
        }));

        if (!cancelled) {
          setCustomQuotes(normalizedCustom);
          persistCustom(normalizedCustom);
        }

        const response = await fetch(QUOTES_URL);
        if (!response.ok) {
          throw new Error("名言リストの取得に失敗しました");
        }
        const baseQuotes: Quote[] = await response.json();
        const normalizedBase = baseQuotes
          .map((quote) => ({
            ...quote,
            text: String(quote.text ?? "").trim(),
            author: String(quote.author ?? "").trim(),
            background: undefined,
            isCustom: false,
          }))
          .filter((quote) => quote.id && quote.text && quote.author);

        const mergedQuotes = uniqueById([
          ...normalizedBase,
          ...normalizedCustom,
        ]);
        const normalizedPinned = storedPinned.map((quote) =>
          withBackground(quote)
        );

        if (!cancelled) {
          setError(null);
          setAllQuotes(mergedQuotes);
          setPinnedQuotes(normalizedPinned);
          persistPinned(normalizedPinned);
          ensureTodayQuote(mergedQuotes);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(
            "名言の読み込みに失敗しました。リロードして再試行してください。"
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [ensureTodayQuote, persistCustom, persistPinned]);

  useEffect(() => {
    if (allQuotes.length) {
      ensureTodayQuote(allQuotes);
    }
  }, [allQuotes, ensureTodayQuote]);

  const isTodayPinned = useMemo(() => {
    if (!todayQuote) return false;
    return pinnedQuotes.some((quote) => quote.id === todayQuote.id);
  }, [pinnedQuotes, todayQuote]);

  const handleShuffleQuote = () => {
    if (!allQuotes.length) return;
    setTodayQuote((previous) => {
      if (allQuotes.length === 1) {
        return withBackground(allQuotes[0]);
      }
      let next: Quote;
      do {
        next = withBackground(
          allQuotes[Math.floor(Math.random() * allQuotes.length)]
        );
      } while (previous && next.id === previous.id);
      return next;
    });
  };

  const handlePinQuote = (quote: Quote) => {
    setPinnedQuotes((current) => {
      if (current.some((item) => item.id === quote.id)) {
        return current;
      }
      const next = [...current, withBackground(quote)];
      persistPinned(next);
      return next;
    });
  };

  const handleAddQuote = (text: string, author: string) => {
    const trimmedText = text.trim();
    const trimmedAuthor = author.trim() || "Anonymous";
    if (!trimmedText) return;

    const newQuote: Quote = {
      id: `custom-${generateId()}`,
      text: trimmedText,
      author: trimmedAuthor,
      background: getRandomBackground(),
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    setCustomQuotes((prev) => {
      const next = [...prev, newQuote];
      persistCustom(next);
      return next;
    });

    setAllQuotes((prev) => uniqueById([...prev, newQuote]));
    handlePinQuote(newQuote);
    setView("favorites");
  };

  const handleUpdatePinned = (id: string, text: string, author: string) => {
    const trimmedText = text.trim();
    const trimmedAuthor = author.trim() || "Anonymous";
    if (!trimmedText) return;

    setPinnedQuotes((prev) => {
      const next = prev.map((quote) =>
        quote.id === id
          ? { ...quote, text: trimmedText, author: trimmedAuthor }
          : quote
      );
      persistPinned(next);
      return next;
    });

    setAllQuotes((prev) =>
      prev.map((quote) => {
        if (quote.id !== id) return quote;
        if (!quote.isCustom) return quote;
        const updated = { ...quote, text: trimmedText, author: trimmedAuthor };
        return updated;
      })
    );

    setCustomQuotes((prev) => {
      const exists = prev.some((quote) => quote.id === id);
      if (!exists) return prev;
      const next = prev.map((quote) =>
        quote.id === id
          ? { ...quote, text: trimmedText, author: trimmedAuthor }
          : quote
      );
      persistCustom(next);
      return next;
    });
  };

  const handleDeletePinned = (id: string) => {
    setPinnedQuotes((prev) => {
      const next = prev.filter((quote) => quote.id !== id);
      persistPinned(next);
      return next;
    });

    setCustomQuotes((prev) => {
      const next = prev.filter((quote) => quote.id !== id);
      if (next.length !== prev.length) {
        persistCustom(next);
        setAllQuotes((quotes) => quotes.filter((quote) => quote.id !== id));
      }
      return next;
    });
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Inspiration</h1>
      </header>

      <main className="app__content">
        {error && <div className="error-banner">{error}</div>}

        {view === "today" && (
          <TodayQuoteSection
            isLoading={isLoading}
            quote={todayQuote}
            isPinned={isTodayPinned}
            onPin={() => todayQuote && handlePinQuote(todayQuote)}
            onShuffle={handleShuffleQuote}
          />
        )}

        {view === "favorites" && (
          <FavoritesSection
            quotes={pinnedQuotes}
            onDelete={handleDeletePinned}
            onUpdate={handleUpdatePinned}
          />
        )}

        {view === "add" && <AddQuoteSection onAdd={handleAddQuote} />}
      </main>

      <nav className="app__nav">
        <button
          type="button"
          className={`nav-button ${
            view === "today" ? "nav-button--active" : ""
          }`}
          onClick={() => setView("today")}
        >
          <TodayIcon />
          今日の格言
        </button>
        <button
          type="button"
          className={`nav-button ${
            view === "favorites" ? "nav-button--active" : ""
          }`}
          onClick={() => setView("favorites")}
        >
          <FavoriteIcon />
          お気に入り
        </button>
        <button
          type="button"
          className={`nav-button ${view === "add" ? "nav-button--active" : ""}`}
          onClick={() => setView("add")}
        >
          <AddIcon />
          名言を登録
        </button>
      </nav>
    </div>
  );
}

type TodayQuoteSectionProps = {
  isLoading: boolean;
  quote: Quote | null;
  isPinned: boolean;
  onPin: () => void;
  onShuffle: () => void;
};

function TodayQuoteSection({
  isLoading,
  quote,
  isPinned,
  onPin,
  onShuffle,
}: TodayQuoteSectionProps) {
  if (isLoading) {
    return <div className="empty-state">名言を読み込んでいます...</div>;
  }

  if (!quote) {
    return (
      <div className="empty-state">
        表示できる名言がありません。名言を登録してみましょう。
      </div>
    );
  }

  return (
    <section className="today-card" aria-live="polite">
      <div
        className="today-card__bg"
        style={{
          backgroundImage: `url(${quote.background ?? getRandomBackground()})`,
        }}
      />
      <div className="today-card__scrim" />
      <p className="today-card__quote">{quote.text}</p>
      <p className="today-card__author">{quote.author}</p>
      <div className="today-card__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={onPin}
          disabled={isPinned}
        >
          <PinIcon />
          {isPinned ? "ピン留め済み" : "ピン留めする"}
        </button>
        <button
          type="button"
          className="button button--ghost"
          onClick={onShuffle}
        >
          <ShuffleIcon />
          別の格言
        </button>
      </div>
    </section>
  );
}

type FavoritesSectionProps = {
  quotes: Quote[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string, author: string) => void;
};

function FavoritesSection({
  quotes,
  onDelete,
  onUpdate,
}: FavoritesSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftAuthor, setDraftAuthor] = useState("");

  const startEdit = (quote: Quote) => {
    setEditingId(quote.id);
    setDraftText(quote.text);
    setDraftAuthor(quote.author);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftText("");
    setDraftAuthor("");
  };

  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId) return;
    if (!draftText.trim()) return;
    onUpdate(editingId, draftText, draftAuthor);
    cancelEdit();
  };

  if (!quotes.length) {
    return (
      <div className="empty-state">ピン留めした名言がここに表示されます。</div>
    );
  }

  return (
    <section>
      <h2 className="section-title">お気に入りの格言</h2>
      <div className="favorites">
        {quotes.map((quote) => {
          const isEditing = editingId === quote.id;
          const style = {
            "--card-bg": quote.background ? `url(${quote.background})` : "none",
          } as CSSProperties;

          return (
            <article key={quote.id} className="favorite-card" style={style}>
              {isEditing ? (
                <form onSubmit={submitEdit}>
                  <textarea
                    value={draftText}
                    onChange={(event) => setDraftText(event.target.value)}
                    required
                  />
                  <input
                    type="text"
                    value={draftAuthor}
                    onChange={(event) => setDraftAuthor(event.target.value)}
                    placeholder="Anonymous"
                  />
                  <div className="favorite-card__actions">
                    <button type="submit" className="button button--primary">
                      <SaveIcon />
                      保存する
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={cancelEdit}
                    >
                      <CloseIcon />
                      キャンセル
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="favorite-card__quote">{quote.text}</p>
                  <p className="favorite-card__author">{quote.author}</p>
                  <div className="favorite-card__actions">
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => startEdit(quote)}
                    >
                      <EditIcon />
                      編集
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => onDelete(quote.id)}
                    >
                      <TrashIcon />
                      削除
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

type AddQuoteSectionProps = {
  onAdd: (text: string, author: string) => void;
};

function AddQuoteSection({ onAdd }: AddQuoteSectionProps) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim()) {
      setError("格言は必須です。");
      return;
    }
    onAdd(text, author);
    setText("");
    setAuthor("");
    setError(null);
  };

  return (
    <section>
      <h2 className="section-title">名言を登録</h2>
      <form className="add-form" onSubmit={handleSubmit}>
        <label>
          格言
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (error) setError(null);
            }}
            placeholder="心に響いた言葉を残しましょう"
          />
        </label>
        <label>
          発言者（任意）
          <input
            value={author}
            onChange={(event) => {
              setAuthor(event.target.value);
              if (error) setError(null);
            }}
            placeholder="匿名でも構いません"
          />
        </label>
        {error && (
          <span className="helper-text" role="alert">
            {error}
          </span>
        )}
        <div className="add-form__actions">
          <button type="submit" className="button button--primary">
            <AddIcon />
            登録してピン留め
          </button>
        </div>
      </form>
    </section>
  );
}

const TodayIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 3a1 1 0 0 1 1 1v1h8V4a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 7.5v11A2.5 2.5 0 0 1 19.5 21h-15A2.5 2.5 0 0 1 2 18.5v-11A2.5 2.5 0 0 1 4.5 5H6V4a1 1 0 0 1 1-1Zm13.5 6h-17v9.5c0 .276.224.5.5.5h16a.5.5 0 0 0 .5-.5V9Z" />
  </svg>
);

const FavoriteIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m12 20.273-7.447 3.92 1.422-8.3L.948 9.807l8.321-1.21L12 .997l2.731 7.6 8.321 1.21-5.027 6.086 1.422 8.3Z" />
  </svg>
);

const AddIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z" />
  </svg>
);

const PinIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m15 2 7 7-6.293 1.504L10.5 15.712l-2.207 2.207 2.793 2.793-1.414 1.414-4.5-4.5 1.414-1.414 2.793 2.793L11.293 16.5 13.496 8.293 15 2Z" />
  </svg>
);

const ShuffleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17.586 3.586 22 8l-4.414 4.414-1.414-1.414L17.172 9H16a4.99 4.99 0 0 0-3.864 1.847l-1.554 1.864-1.538-1.277 1.53-1.838A6.99 6.99 0 0 1 16 7h1.172l-1-1-1.586-1.414 1.414-1.414ZM10.9 12.11l1.53 1.838A6.99 6.99 0 0 1 16 17h1.172l-1-1-1.586-1.414 1.414-1.414L22 19l-4.414 4.414-1.414-1.414L17.172 21H16a4.99 4.99 0 0 0-3.864-1.847l-1.565-1.88-1.535 1.274-1.53 1.838A6.99 6.99 0 0 1 2 21H0v-2h2a4.99 4.99 0 0 0 3.864-1.847l1.549-1.854-1.536-1.277-1.53-1.838A6.99 6.99 0 0 1 2 9H0V7h2a6.99 6.99 0 0 1 5.414 2.586l1.552 1.874 1.534 1.274Z" />
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21.707 6.707 19.5 8.914l-4.414-4.414 2.207-2.207a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1 0 1.414ZM17.086 10.328 6.414 21H2v-4.414L12.672 5.914l4.414 4.414Z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 3a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2h5v2H2V3h7Zm-5 5h16l-1 13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 8Zm5 2v9h2v-9H9Zm4 0v9h2v-9h-2Z" />
  </svg>
);

const SaveIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 2h10l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm5 18h4v-5h-4v5Zm-2 0v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5h2V8.414L14.586 4H8v16h2Z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.343 4.929 12 10.586l5.657-5.657 1.414 1.414L13.414 12l5.657 5.657-1.414 1.414L12 13.414l-5.657 5.657-1.414-1.414L10.586 12 4.929 6.343l1.414-1.414Z" />
  </svg>
);

export default App;
