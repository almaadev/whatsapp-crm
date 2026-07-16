import { useMutation, useQueryClient } from "@tanstack/react-query";
import { branchService } from "@/services/branchService";
import { useBranchStore } from "@/store/branchStore";
import { toast } from "react-toastify";

export function useCreateBranch() {
  const queryClient = useQueryClient();
  const addBranchStore = useBranchStore((state) => state.addBranchStore);

  return useMutation({
    mutationFn: (data) => branchService.createBranch(data),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ["branches"] });
        addBranchStore(response.branch);
        toast.success(response.message || "Branch created successfully!");
      } else {
        toast.error(response.message || "Failed to create branch.");
      }
    },
    onError: (error) => {
      toast.error(error.message || "An error occurred while creating the branch.");
    }
  });
}
