"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, X, Star, Heart, Trash, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "react-toastify";

const EMOJI_CATEGORIES = [
  {
    id: "positive",
    title: "Positive Responses",
    icon: "👍",
    emojis: [
      { char: "👍", name: "thumbs up" },
      { char: "👌", name: "ok hand" },
      { char: "✅", name: "check mark" },
      { char: "✔️", name: "check mark tick" },
      { char: "☑️", name: "check box" },
      { char: "💯", name: "hundred points" },
      { char: "🙌", name: "raising hands" },
      { char: "👏", name: "clapping hands" },
      { char: "🎉", name: "party popper" },
      { char: "🎊", name: "confetti ball" },
      { char: "🌟", name: "glowing star" },
      { char: "⭐", name: "star" },
      { char: "✨", name: "sparkles" }
    ]
  },
  {
    id: "friendly",
    title: "Friendly & Polite",
    icon: "😊",
    emojis: [
      { char: "😊", name: "smiling eyes" },
      { char: "😄", name: "grinning smile" },
      { char: "😃", name: "big eyes smile" },
      { char: "😀", name: "grinning" },
      { char: "🙂", name: "slightly smiling" },
      { char: "🤗", name: "hugging face" },
      { char: "😇", name: "halo smile" },
      { char: "😌", name: "relieved face" },
      { char: "❤️", name: "red heart" },
      { char: "💙", name: "blue heart" },
      { char: "💚", name: "green heart" },
      { char: "💛", name: "yellow heart" },
      { char: "🧡", name: "orange heart" },
      { char: "💜", name: "purple heart" },
      { char: "🤍", name: "white heart" },
      { char: "🩷", name: "pink heart" }
    ]
  },
  {
    id: "thankyou",
    title: "Thank You",
    icon: "🙏",
    emojis: [
      { char: "🙏", name: "folded hands" },
      { char: "🤝", name: "handshake" },
      { char: "💐", name: "bouquet" },
      { char: "🌹", name: "rose" }
    ]
  },
  {
    id: "communication",
    title: "Communication",
    icon: "📞",
    emojis: [
      { char: "📞", name: "telephone receiver" },
      { char: "☎️", name: "telephone" },
      { char: "📱", name: "mobile phone" },
      { char: "📲", name: "mobile phone arrow" },
      { char: "💬", name: "speech balloon" },
      { char: "🗨️", name: "left speech bubble" },
      { char: "📧", name: "email" },
      { char: "📩", name: "envelope arrow" },
      { char: "✉️", name: "envelope" },
      { char: "📨", name: "incoming envelope" }
    ]
  },
  {
    id: "followup",
    title: "Follow-up",
    icon: "📅",
    emojis: [
      { char: "📅", name: "calendar" },
      { char: "🗓️", name: "spiral calendar" },
      { char: "⏰", name: "alarm clock" },
      { char: "⌛", name: "hourglass done" },
      { char: "🕒", name: "three oclock" },
      { char: "🕓", name: "four oclock" },
      { char: "🕔", name: "five oclock" },
      { char: "🔔", name: "bell" },
      { char: "📌", name: "pushpin" },
      { char: "📍", name: "round pushpin" }
    ]
  },
  {
    id: "notes",
    title: "Notes",
    icon: "📝",
    emojis: [
      { char: "📝", name: "memo" },
      { char: "📄", name: "page facing up" },
      { char: "📑", name: "bookmark tabs" },
      { char: "📋", name: "clipboard" },
      { char: "📂", name: "open folder" },
      { char: "📁", name: "folder" },
      { char: "🗂️", name: "dividers" },
      { char: "🖊️", name: "pen" },
      { char: "✍️", name: "writing hand" }
    ]
  },
  {
    id: "sales",
    title: "Sales",
    icon: "💼",
    emojis: [
      { char: "💼", name: "briefcase" },
      { char: "💰", name: "money bag" },
      { char: "💸", name: "money wings" },
      { char: "💳", name: "credit card" },
      { char: "🏦", name: "bank" },
      { char: "📈", name: "chart increasing" },
      { char: "📊", name: "bar chart" },
      { char: "📉", name: "chart decreasing" },
      { char: "🎯", name: "bullseye" },
      { char: "🏆", name: "trophy" }
    ]
  },
  {
    id: "motivation",
    title: "Motivation",
    icon: "🚀",
    emojis: [
      { char: "🚀", name: "rocket" },
      { char: "🔥", name: "fire" },
      { char: "💪", name: "flexed biceps" },
      { char: "⚡", name: "high voltage" },
      { char: "🌈", name: "rainbow" },
      { char: "🎖️", name: "military medal" },
      { char: "🏅", name: "sports medal" }
    ]
  },
  {
    id: "questions",
    title: "Questions",
    icon: "🤔",
    emojis: [
      { char: "🤔", name: "thinking face" },
      { char: "❓", name: "red question mark" },
      { char: "❔", name: "white question mark" },
      { char: "💡", name: "light bulb" },
      { char: "🔍", name: "magnifying glass" },
      { char: "👀", name: "eyes" }
    ]
  },
  {
    id: "pending",
    title: "Pending",
    icon: "⏳",
    emojis: [
      { char: "⏳", name: "hourglass pending" },
      { char: "⌛", name: "hourglass" },
      { char: "🕐", name: "one oclock" },
      { char: "🕑", name: "two oclock" },
      { char: "🕒", name: "three oclock timer" },
      { char: "⏰", name: "alarm clock pending" },
      { char: "🔄", name: "refresh arrows" },
      { char: "🔃", name: "vertical arrows" }
    ]
  },
  {
    id: "issues",
    title: "Issues",
    icon: "❌",
    emojis: [
      { char: "❌", name: "cross mark error" },
      { char: "⚠️", name: "warning alert" },
      { char: "🚫", name: "prohibited sign" },
      { char: "⛔", name: "no entry sign" },
      { char: "🔴", name: "red status dot" },
      { char: "🛑", name: "stop sign" },
      { char: "😕", name: "confused face" },
      { char: "😔", name: "pensive face" },
      { char: "😞", name: "disappointed face" }
    ]
  },
  {
    id: "orders",
    title: "Orders",
    icon: "📦",
    emojis: [
      { char: "📦", name: "package box" },
      { char: "🚚", name: "delivery truck" },
      { char: "🛍️", name: "shopping bags" },
      { char: "🎁", name: "wrapped gift" },
      { char: "📬", name: "mailbox" }
    ]
  },
  {
    id: "healthcare",
    title: "Healthcare",
    icon: "💊",
    emojis: [
      { char: "💊", name: "pill medicine" },
      { char: "🌿", name: "herb leaf" },
      { char: "🍃", name: "fluttering leaf" },
      { char: "🌱", name: "seedling sprout" },
      { char: "🩺", name: "stethoscope" },
      { char: "🏥", name: "hospital building" },
      { char: "👨‍⚕️", name: "male doctor" },
      { char: "👩‍⚕️", name: "female doctor" },
      { char: "❤️‍🩹", name: "mending heart" }
    ]
  },
  {
    id: "information",
    title: "Information",
    icon: "📢",
    emojis: [
      { char: "📢", name: "loudspeaker announcement" },
      { char: "📣", name: "megaphone" },
      { char: "ℹ️", name: "info badge" },
      { char: "📌", name: "pushpin info" },
      { char: "📍", name: "pushpin location" },
      { char: "🔔", name: "alert bell" }
    ]
  },
  {
    id: "numbers",
    title: "Numbers & Status",
    icon: "🔢",
    emojis: [
      { char: "1️⃣", name: "digit one" },
      { char: "2️⃣", name: "digit two" },
      { char: "3️⃣", name: "digit three" },
      { char: "4️⃣", name: "digit four" },
      { char: "5️⃣", name: "digit five" },
      { char: "🔴", name: "red circle status" },
      { char: "🟠", name: "orange circle status" },
      { char: "🟡", name: "yellow circle status" },
      { char: "🟢", name: "green circle status" },
      { char: "🔵", name: "blue circle status" },
      { char: "⚪", name: "white circle status" },
      { char: "⚫", name: "black circle status" }
    ]
  }
];

export default function EmojiPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [recentlyUsed, setRecentlyUsed] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [hoveredEmoji, setHoveredEmoji] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [contextMenu, setContextMenu] = useState(null); // { x, y, emoji }
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef(null);

  // Load from local storage
  useEffect(() => {
    try {
      const recents = localStorage.getItem("crm-emoji-recent");
      if (recents) setRecentlyUsed(JSON.parse(recents));

      const favs = localStorage.getItem("crm-emoji-favorites");
      if (favs) setFavorites(JSON.parse(favs));
    } catch (e) {
      console.error("Local storage load failed", e);
    }
  }, []);

  // Filter emojis based on search query
  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return EMOJI_CATEGORIES;

    return EMOJI_CATEGORIES.map((cat) => {
      const matched = cat.emojis.filter(
        (e) => e.char.includes(query) || e.name.toLowerCase().includes(query)
      );
      return { ...cat, emojis: matched };
    }).filter((cat) => cat.emojis.length > 0);
  }, [search]);

  // Flattened visible list for arrow key navigation
  const visibleEmojiList = useMemo(() => {
    let list = [];
    
    // Add favorites first
    if (favorites.length > 0) {
      favorites.forEach(char => {
        list.push({ char, name: "Favorite" });
      });
    }

    // Add recent
    if (recentlyUsed.length > 0) {
      recentlyUsed.forEach(char => {
        if (!favorites.includes(char)) {
          list.push({ char, name: "Recent" });
        }
      });
    }

    // Add from categories
    filteredCategories.forEach(cat => {
      if (!collapsedCategories[cat.id]) {
        cat.emojis.forEach(e => {
          list.push(e);
        });
      }
    });

    return list;
  }, [favorites, recentlyUsed, filteredCategories, collapsedCategories]);

  // Handle single click selection
  const handleEmojiClick = (emojiChar) => {
    // Invoke select callback
    onSelect(emojiChar);

    // Save to recents
    setRecentlyUsed((prev) => {
      const filtered = prev.filter((char) => char !== emojiChar);
      const updated = [emojiChar, ...filtered].slice(0, 10);
      localStorage.setItem("crm-emoji-recent", JSON.stringify(updated));
      return updated;
    });

    onClose();
  };

  // Double click toggles favorite
  const handleEmojiDoubleClick = (emojiChar) => {
    setFavorites((prev) => {
      let updated;
      if (prev.includes(emojiChar)) {
        updated = prev.filter((char) => char !== emojiChar);
      } else {
        updated = [...prev, emojiChar];
      }
      localStorage.setItem("crm-emoji-favorites", JSON.stringify(updated));
      return updated;
    });
    toast.success(`Favorite list updated!`);
  };

  // Right click trigger
  const handleEmojiContextMenu = (e, emojiChar) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      emoji: emojiChar
    });
  };

  const toggleFavorite = (emojiChar) => {
    handleEmojiDoubleClick(emojiChar);
    setContextMenu(null);
  };

  const removeRecent = (emojiChar) => {
    setRecentlyUsed((prev) => {
      const updated = prev.filter((char) => char !== emojiChar);
      localStorage.setItem("crm-emoji-recent", JSON.stringify(updated));
      return updated;
    });
    setContextMenu(null);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (visibleEmojiList.length === 0) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % visibleEmojiList.length);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + visibleEmojiList.length) % visibleEmojiList.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = visibleEmojiList[selectedIndex];
        if (selected) handleEmojiClick(selected.char);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visibleEmojiList, selectedIndex]);

  // Click outside closes context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const toggleCategory = (id) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div
      ref={containerRef}
      className="w-[440px] h-[500px] bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 select-none text-slate-800"
    >
      {/* Header section */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">😀</span>
          <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-700">Emoji Picker</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 shadow-sm transition-all"
        >
          <X size={14} />
        </button>
      </div>

      {/* Sticky search bar */}
      <div className="p-3.5 border-b border-slate-100 shrink-0">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3.5 text-slate-400" />
          <input
            placeholder="Search emojis..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold"
          />
        </div>
      </div>

      {/* Emoji Scroll viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
        
        {/* Favorites section (if populated) */}
        {favorites.length > 0 && !search && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Heart size={10} className="text-rose-500 fill-rose-500 animate-pulse" /> Favorites (Double-click to remove)
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {favorites.map((char) => (
                <button
                  key={char}
                  onClick={() => handleEmojiClick(char)}
                  onDoubleClick={() => handleEmojiDoubleClick(char)}
                  onContextMenu={(e) => handleEmojiContextMenu(e, char)}
                  onMouseEnter={() => setHoveredEmoji({ char, name: "Favorite Emoji" })}
                  onMouseLeave={() => setHoveredEmoji(null)}
                  className="w-9 h-9 flex items-center justify-center text-lg hover:scale-125 transition-transform rounded-lg hover:bg-white hover:shadow-sm"
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recently Used section */}
        {recentlyUsed.length > 0 && !search && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Star size={10} className="text-amber-500 fill-amber-500" /> Recently Used
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {recentlyUsed.map((char) => (
                <button
                  key={char}
                  onClick={() => handleEmojiClick(char)}
                  onDoubleClick={() => handleEmojiDoubleClick(char)}
                  onContextMenu={(e) => handleEmojiContextMenu(e, char)}
                  onMouseEnter={() => setHoveredEmoji({ char, name: "Recent Emoji" })}
                  onMouseLeave={() => setHoveredEmoji(null)}
                  className="w-9 h-9 flex items-center justify-center text-lg hover:scale-125 transition-transform rounded-lg hover:bg-white hover:shadow-sm"
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Categories list */}
        {filteredCategories.map((cat) => {
          const isCollapsed = collapsedCategories[cat.id];
          return (
            <div key={cat.id} className="space-y-2">
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center justify-between text-left text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors border-b border-slate-100 pb-1"
              >
                <span className="flex items-center gap-1.5">
                  <span className="text-sm shrink-0">{cat.icon}</span>
                  {cat.title}
                </span>
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              </button>

              {!isCollapsed && (
                <div className="flex flex-wrap gap-1.5">
                  {cat.emojis.map((emoji) => {
                    const isFav = favorites.includes(emoji.char);
                    return (
                      <button
                        key={emoji.char}
                        onClick={() => handleEmojiClick(emoji.char)}
                        onDoubleClick={() => handleEmojiDoubleClick(emoji.char)}
                        onContextMenu={(e) => handleEmojiContextMenu(e, emoji.char)}
                        onMouseEnter={() => setHoveredEmoji(emoji)}
                        onMouseLeave={() => setHoveredEmoji(null)}
                        className={`w-9 h-9 flex items-center justify-center text-lg hover:scale-125 transition-transform rounded-lg hover:bg-white hover:shadow-sm relative
                          ${isFav ? "border border-rose-100/60 bg-rose-50/20" : ""}
                        `}
                      >
                        {emoji.char}
                        {isFav && (
                          <span className="absolute top-0.5 right-0.5 w-1 h-1 bg-rose-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-xs font-semibold">No emojis match your search.</div>
        )}
      </div>

      {/* Floating Tooltip Footer bar */}
      <div className="h-10 shrink-0 bg-slate-50 border-t border-slate-100 flex items-center px-4 justify-between text-[11px] font-bold text-slate-405 text-slate-500">
        {hoveredEmoji ? (
          <span className="capitalize flex items-center gap-1 truncate max-w-[80%]">
            <span className="text-sm">{hoveredEmoji.char}</span>
            <span>{hoveredEmoji.name}</span>
          </span>
        ) : (
          <span>Hover to preview • Double-click to Favorite</span>
        )}
      </div>

      {/* Context Menu Popup */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y - 10, left: contextMenu.x + 10 }}
          className="fixed bg-white border border-slate-200 rounded-xl shadow-xl z-[90] py-1 text-xs font-bold text-slate-650 w-44 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => toggleFavorite(contextMenu.emoji)}
            className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
          >
            <Heart size={12} className="text-rose-500" />
            {favorites.includes(contextMenu.emoji) ? "Remove Favorite" : "Add to Favorites"}
          </button>
          {recentlyUsed.includes(contextMenu.emoji) && (
            <button
              onClick={() => removeRecent(contextMenu.emoji)}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-rose-600"
            >
              <Trash size={12} />
              Remove Recent
            </button>
          )}
        </div>
      )}
    </div>
  );
}
