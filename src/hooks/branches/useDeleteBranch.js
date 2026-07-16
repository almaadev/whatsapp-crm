import { useMutation, useQueryClient } from "@tanstack/react-query";
import { branchService } from "@/services/branchService";
import { useBranchStore } from "@/store/branchStore";
import { toast } from "react-toastify";

export function useDeleteBranch() {
  const queryClient = useQueryClient();
  const removeBranchStore = useBranchStore((state) => state.removeBranchStore);

  return useMutation({
    mutationFn: (id) => branchService.deleteBranch(id),
    onSuccess: (response, id) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ["branches"] });
        removeBranchStore(id);
        toast.success(response.message || "Branch deleted successfully!");
      } else {
        toast.error(response.message || "Failed to delete branch.");
      }
    },
    onError: (error) => {
      toast.error(error.message || "An error occurred while deleting the branch.");
    }
  });
}
