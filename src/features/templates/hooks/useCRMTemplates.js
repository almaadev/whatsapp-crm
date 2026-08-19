import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { crmTemplateRepository } from "@/shared/api/repositories/crmTemplateRepository";

export const CRM_TEMPLATES_QUERY_KEY = ["crm-templates"];

export function useCRMTemplates(params = {}) {
  return useQuery({
    queryKey: [...CRM_TEMPLATES_QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await crmTemplateRepository.getTemplates(params);
      return data?.data || [];
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCRMTemplate(id) {
  return useQuery({
    queryKey: ["crm-template", id],
    queryFn: async () => {
      if (!id) return null;
      const { data } = await crmTemplateRepository.getTemplateById(id);
      return data?.data || null;
    },
    enabled: Boolean(id),
  });
}

export function useCreateCRMTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => crmTemplateRepository.createTemplate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CRM_TEMPLATES_QUERY_KEY });
    },
  });
}

export function useUpdateCRMTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => crmTemplateRepository.updateTemplate(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: CRM_TEMPLATES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["crm-template", variables.id] });
    },
  });
}

export function useDeleteCRMTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => crmTemplateRepository.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CRM_TEMPLATES_QUERY_KEY });
    },
  });
}
