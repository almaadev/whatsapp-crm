import { useQuery } from "@tanstack/react-query";
import { branchService } from "@/services/branchService";

export function useBranch(id) {
  return useQuery({
    queryKey: ["branch", id],
    queryFn: () => branchService.getBranch(id),
    enabled: !!id,
  });
}
