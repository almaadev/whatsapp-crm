import { useQuery } from "@tanstack/react-query";
import { branchService } from "@/features/branches/services/branchService";
import { useBranchStore } from "@/store/branchStore";
import { useEffect } from "react";

export function useBranches() {
  const searchText = useBranchStore((state) => state.searchText);
  const selectedStatus = useBranchStore((state) => state.selectedStatus);
  const page = useBranchStore((state) => state.pagination.page);
  const limit = useBranchStore((state) => state.pagination.limit);
  
  const setBranches = useBranchStore((state) => state.setBranches);
  const setPagination = useBranchStore((state) => state.setPagination);
  const setLoading = useBranchStore((state) => state.setLoading);

  const query = useQuery({
    queryKey: ["branches", { searchText, selectedStatus, page, limit }],
    queryFn: () => branchService.getBranches({ search: searchText, status: selectedStatus, page, limit }),
    placeholderData: (prev) => prev,
  });

  const { data, isFetching } = query;

  useEffect(() => {
    setLoading(isFetching);
  }, [isFetching, setLoading]);

  useEffect(() => {
    if (data?.success) {
      setBranches(data.branches || []);
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          pages: data.pagination.pages,
        });
      }
    }
  }, [data, setBranches, setPagination]);

  return query;
}
