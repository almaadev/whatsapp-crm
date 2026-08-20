"use client";

import React, { useState, useRef, useEffect } from "react";
import { Smartphone, ChevronDown } from "lucide-react";
import { useChatStore } from "@/features/chat/stores/chatStore";

/**
 * SenderSelector component for choosing WhatsApp Sender number.
 * Supports:
 * - Read-only badge if only 1 number exists.
 * - Searchable premium dropdown for multiple numbers.
 * - Responsive layout="overflow" for mobile menus.
 * 
 * @param {Object} props
 * @param {"default"|"overflow"} props.layout - The rendering layout mode
 * @param {string} props.className - Extra CSS classes
 * @param {Function} props.onCloseParent - Handler to close mobile container
 */
export default function SenderSelector({ layout = "default", className = "", onCloseParent }) {
  const availableNumbers = useChatStore((s) => s.availableNumbers);
  const selectedSender = useChatStore((s) => s.selectedSender);
  const setSelectedSender = useChatStore((s) => s.setSelectedSender);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (availableNumbers.length === 0) {
    return layout === "overflow" ? (
      <div className="px-4 py-2 border-b border-slate-100 text-xs text-rose-500 font-bold">
        No WhatsApp senders.
      </div>
    ) : (
      <div className={`flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm select-none ${className}`}>
        <span>No WhatsApp Sender assigned.</span>
      </div>
    );
  }

  const activeSenderDoc = availableNumbers.find(
    (n) => n.phoneNumber === selectedSender || `whatsapp:${n.phoneNumber}` === selectedSender
  ) || availableNumbers[0];

  // Overflow mobile layout (for inside user profile menu)
  if (layout === "overflow") {
    if (availableNumbers.length === 1) {
      return (
        <div className={`px-4 py-2 border-b border-slate-100 flex flex-col gap-0.5 select-none ${className}`}>
          
          <span className="text-xs font-bold text-slate-800">{activeSenderDoc.friendlyName}</span>
          <span className="text-[10px] text-slate-500 font-mono">{activeSenderDoc.phoneNumber}</span>
        </div>
      );
    }

    return (
      <div className={`px-4 py-2 border-b border-slate-100 flex flex-col gap-1.5 select-none ${className}`}>
      
        <select
          value={selectedSender}
          onChange={(e) => {
            setSelectedSender(e.target.value);
            if (onCloseParent) onCloseParent();
          }}
          className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-1.5 focus:outline-none focus:border-[#00a884]"
        >
          {availableNumbers.map((num) => (
            <option key={num._id || num.phoneNumber} value={num.phoneNumber}>
              {num.friendlyName} ({num.phoneNumber})
            </option>
          ))}
        </select>
      </div>
    );
  }

  // If only 1 sender is assigned
  if (availableNumbers.length === 1) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-sm select-none ${className}`}>
        <Smartphone className="w-4 h-4 text-[#00a884] shrink-0" />
        <div className="flex flex-col text-left leading-tight">
          
          <span className="font-bold text-slate-800 truncate max-w-[120px] lg:max-w-[180px]">{activeSenderDoc.friendlyName}</span>
          <span className="text-[10px] text-slate-500 font-mono">{activeSenderDoc.phoneNumber}</span>
        </div>
      </div>
    );
  }

  // Multiple senders
  const filteredNumbers = availableNumbers.filter(
    (n) =>
      n.friendlyName?.toLowerCase().includes(search.toLowerCase()) ||
      n.phoneNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-sm select-none ${className}"
      >
        <Smartphone className="w-4 h-4 text-[#00a884] shrink-0" />
        <div className="flex flex-col text-left leading-tight">
          
          <span className=" font-bold text-slate-800 truncate max-w-[100px] sm:max-w-[120px] lg:max-w-[180px]">
            {activeSenderDoc.friendlyName}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{activeSenderDoc.phoneNumber}</span>
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 shrink-0 ml-1 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 font-semibold text-xs text-slate-700">
          <div className="px-3 py-1 text-[9px] font-black uppercase text-slate-400 tracking-wider">
            Select WhatsApp Sender
          </div>
          


          <div className="max-h-60 overflow-y-auto mt-1 border-t border-slate-100">
            {filteredNumbers.length === 0 ? (
              <div className="px-4 py-3 text-center text-slate-400 text-xs font-medium">
                No sender numbers match "{search}".
              </div>
            ) : (
              filteredNumbers.map((num) => {
                const isSelected = selectedSender === num.phoneNumber;
                return (
                  <button
                    key={num._id || num.phoneNumber}
                    onClick={() => {
                      setSelectedSender(num.phoneNumber);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex flex-col gap-0.5 cursor-pointer ${
                      isSelected ? "bg-emerald-50/70 border-l-4 border-emerald-500" : ""
                    }`}
                  >
                    <span className="font-bold text-slate-800 flex items-center justify-between">
                      {num.friendlyName}
                      {isSelected && <span className="text-[9px] text-[#00a884] font-black uppercase">Active</span>}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono font-medium">
                      {num.phoneNumber}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
