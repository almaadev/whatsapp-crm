"use client";

import MobileNavBar from "@/shared/components/layout/MobileNavBar";

export default function InboxPage({ title, listPanel, chatPanel }) {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
      <MobileNavBar title={title} />
      <div className="flex flex-1 overflow-hidden relative">
        {listPanel}
        {chatPanel}
      </div>
    </div>
  );
}
