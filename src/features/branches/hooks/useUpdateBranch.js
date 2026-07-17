import { useMutation, useQueryClient } from "@tanstack/react-query";
import { branchService } from "@/features/branches/services/branchService";
import { useBranchStore } from "@/features/branches/stores/branchStore";
import { toast } from "react-toastify";

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  const updateBranchStore = useBranchStore((state) => state.updateBranchStore);

  return useMutation({
    mutationFn: ({ id, data }) => branchService.updateBranch(id, data),
    onSuccess: (response, variables) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ["branches"] });
        queryClient.invalidateQueries({ queryKey: ["branch", variables.id] });
        updateBranchStore(variables.id, response.branch);
        toast.success(response.message || "Branch updated successfully!");
      } else {
        toast.error(response.message || "Failed to update branch.");
      }
    },
    onError: (error) => {
      toast.error(error.message || "An error occurred while updating the branch.");
    }
  });
}
