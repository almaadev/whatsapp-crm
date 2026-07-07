import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { reportRepository } from "@/shared/api/repositories/reportRepository";

const getFormattedDateTime = (date) => {
  const d = new Date(date);
  const pad = (n) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export function useMessageLogsState(isAuthorized) {
  // --- DATA STATES ---
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [messageData, setMessageData] = useState({
    messages: [],
    analytics: {},
  });

  // --- API FILTER STATES ---
  const [fetchLimit, setFetchLimit] = useState("500");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [apiStatusFilter, setApiStatusFilter] = useState("all");
  const [activeDateChip, setActiveDateChip] = useState("all");

  // --- CLIENT UI STATES ---
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [clientDirection, setClientDirection] = useState("all");
  const [clientMediaOnly, setClientMediaOnly] = useState(false);
  const [clientFailedOnly, setClientFailedOnly] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // --- FETCH DATA ---
  const fetchLogs = useCallback(
    async (
      optStart = startDate,
      optEnd = endDate,
      optStatus = apiStatusFilter,
      optLimit = fetchLimit,
    ) => {
      if (!isAuthorized) return;
      setFetching(true);
      try {
        let queryStr = `limit=${optLimit}`;
        if (optStart) queryStr += `&startDate=${encodeURIComponent(optStart)}`;
        if (optEnd) queryStr += `&endDate=${encodeURIComponent(optEnd)}`;
        if (optStatus !== "all") queryStr += `&status=${encodeURIComponent(optStatus)}`;

        const { data } = await reportRepository.getMessageLogs(queryStr);

        if (data.success) {
          setMessageData({
            messages: data.messages || [],
            analytics: data.analytics || {},
          });
          setCurrentPage(1);
        } else {
          toast.error(data.error || "Failed to load logs");
        }
      } catch (error) {
        toast.error("Error connecting to server");
      } finally {
        setLoading(false);
        setFetching(false);
      }
    },
    [startDate, endDate, apiStatusFilter, fetchLimit, isAuthorized]
  );

  useEffect(() => {
    if (isAuthorized) fetchLogs();
  }, [isAuthorized]); // initial fetch

  // --- DATE CHIP LOGIC ---
  const applyDateChip = useCallback(
    (chip) => {
      setActiveDateChip(chip);
      setCurrentPage(1);
      const today = new Date();
      let sDate = "",
        eDate = "";

      if (chip === "today") {
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        sDate = getFormattedDateTime(start);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        eDate = getFormattedDateTime(end);
      } else if (chip === "yesterday") {
        const start = new Date(today);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        sDate = getFormattedDateTime(start);
        const end = new Date(today);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        eDate = getFormattedDateTime(end);
      } else if (chip === "last7") {
        const start = new Date(today);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        sDate = getFormattedDateTime(start);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        eDate = getFormattedDateTime(end);
      } else if (chip === "last30") {
        const start = new Date(today);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        sDate = getFormattedDateTime(start);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        eDate = getFormattedDateTime(end);
      }

      setStartDate(sDate);
      setEndDate(eDate);
      fetchLogs(sDate, eDate, apiStatusFilter, fetchLimit);
    },
    [apiStatusFilter, fetchLimit, fetchLogs]
  );

  // --- CLIENT-SIDE PROCESSING ---
  const filteredMessages = useMemo(() => {
    return messageData.messages.filter((msg) => {
      if (debouncedSearchQuery) {
        const lowerQ = debouncedSearchQuery.toLowerCase();
        const toMatch = msg.to ? msg.to.toLowerCase().includes(lowerQ) : false;
        const fromMatch = msg.from
          ? msg.from.toLowerCase().includes(lowerQ)
          : false;
        const bodyMatch = msg.body
          ? msg.body.toLowerCase().includes(lowerQ)
          : false;
        const sidMatch = msg.id ? msg.id.toLowerCase().includes(lowerQ) : false;
        if (!toMatch && !fromMatch && !bodyMatch && !sidMatch) return false;
      }
      if (clientDirection !== "all") {
        const isOut = msg.direction?.includes("outbound");
        if (clientDirection === "outbound" && !isOut) return false;
        if (clientDirection === "inbound" && isOut) return false;
      }
      if (clientMediaOnly && (msg.numMedia || msg.mediaCount || 0) === 0)
        return false;
      if (
        clientFailedOnly &&
        !["failed", "undelivered"].includes(msg.status?.toLowerCase())
      )
        return false;

      return true;
    });
  }, [
    messageData.messages,
    debouncedSearchQuery,
    clientDirection,
    clientMediaOnly,
    clientFailedOnly,
  ]);

  const liveMetrics = useMemo(() => {
    let delivered = 0,
      failed = 0,
      inbound = 0,
      outbound = 0,
      media = 0;
    filteredMessages.forEach((m) => {
      const s = m.status?.toLowerCase() || "";
      const isOut = m.direction?.includes("outbound");
      const mCount = m.numMedia || m.mediaCount || 0;
      if (["delivered", "read"].includes(s)) delivered++;
      if (["failed", "undelivered"].includes(s)) failed++;
      if (isOut) outbound++;
      else inbound++;
      if (mCount > 0) media++;
    });

    return {
      total: filteredMessages.length,
      delivered,
      failed,
      inbound,
      outbound,
      media,
    };
  }, [filteredMessages]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMessages.length / itemsPerPage),
  );
  const paginatedMessages = filteredMessages.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return {
    state: {
      loading,
      fetching,
      fetchLimit,
      startDate,
      endDate,
      apiStatusFilter,
      activeDateChip,
      searchQuery,
      clientDirection,
      clientMediaOnly,
      clientFailedOnly,
      currentPage,
      itemsPerPage,
    },
    setters: {
      setFetchLimit,
      setStartDate,
      setEndDate,
      setApiStatusFilter,
      setActiveDateChip,
      setSearchQuery,
      setClientDirection,
      setClientMediaOnly,
      setClientFailedOnly,
      setCurrentPage,
      setItemsPerPage,
    },
    derived: {
      filteredMessages,
      liveMetrics,
      totalPages,
      paginatedMessages,
    },
    actions: {
      fetchLogs,
      applyDateChip,
    }
  };
}
